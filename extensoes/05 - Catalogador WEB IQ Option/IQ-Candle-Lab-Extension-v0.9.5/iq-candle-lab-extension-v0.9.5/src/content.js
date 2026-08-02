(() => {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/page-bridge.js');
  script.onload = () => script.remove();
  (document.documentElement || document.head).appendChild(script);

  let state = {
    status: 'inicializando',
    events: 0,
    candles: 0,
    lastEvent: null,
    symbol: null,
    activeId: null,
    floating: [],
    contexts: null,
    marketQuality: null,
    recommendationMode: 'classic',
    focusedStrategyId: null,
    collapsed: false
  };

  let host, shadow;
  let drag = null;

  const POSITION_KEY = 'iqCandleLabFloatingPosition';

  function directionLabel(value) {
    return value === 'green' ? 'CALL · Verde' :
      value === 'red' ? 'PUT · Vermelho' : 'Aguardando';
  }

  function contextStateLabel(value) {
    return value === 'green' ? 'Verde'
      : value === 'red' ? 'Vermelho'
      : value === 'neutral' ? 'Neutro'
      : 'Insuficiente';
  }

  function contextCards() {
    const contexts = state.contexts;
    if (!contexts) return [];
    return [
      { key: 'mar', title: 'Mar', timeframe: 'M30', data: contexts.mar },
      { key: 'mare', title: 'Maré', timeframe: 'M15', data: contexts.mare },
      { key: 'onda', title: 'Onda', timeframe: 'M5', data: contexts.onda },
      { key: 'marola', title: 'Marola', timeframe: 'M1', data: contexts.marola }
    ];
  }

  function formatTime(timestamp) {
    if (!timestamp) return 'Aguardando';
    return new Date(timestamp * 1000).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function isSignalExpired(signal) {
    return Boolean(signal && (signal.state === 'expirada' || Number(signal.seconds) < -5));
  }

  function bestRecommendedEntry(items) {
    return (items || [])
      .filter(item => item.liveSignal && !isSignalExpired(item.liveSignal) &&
        item.recommendation?.recommendation === 'ENTER')
      .sort((a,b) =>
        Number(b.recommendation?.score||0)-Number(a.recommendation?.score||0) ||
        Number(b.metrics?.rate||0)-Number(a.metrics?.rate||0) ||
        Number(b.metrics?.sample||0)-Number(a.metrics?.sample||0)
      )[0] || null;
  }

  function effectiveRecommendation(rec, signal) {
    if (isSignalExpired(signal)) {
      return {
        recommendation: 'EXPIRED',
        level: 'expired',
        label: 'Sinal expirado — não entrar',
        score: 0,
        explanation: 'A janela de entrada desta estratégia já passou. Aguarde o próximo quadrante válido para uma nova oportunidade.'
      };
    }
    return rec || null;
  }

  function entryStateLabel(signal) {
    if (!signal) return 'Aguardando';
    if (isSignalExpired(signal)) return 'Expirada';
    return signal.state || 'Aguardando';
  }

  function recommendationLabel(rec) {
    if (!rec) return 'Sem recomendação';
    return rec.label || 'Sem recomendação';
  }

  function certaintyLabel(signal) {
    if (!signal) return 'Aguardando';
    if (signal.certainty === 'mathematically_defined') return 'Matematicamente definida';
    if (signal.certainty === 'confirmed') return 'Confirmada';
    return 'Provisória';
  }
  function shortResult(result) {
    if (result === 'WIN') return 'IN';
    if (result === 'WIN G1') return 'G1';
    if (result === 'WIN G2') return 'G2';
    return 'LOSS';
  }

  function streakInfo(results) {
    const ordered = [...(results || [])];
    if (!ordered.length) return { currentType: 'none', currentCount: 0, maxWins: 0, maxLosses: 0 };
    let maxWins = 0, maxLosses = 0, runWins = 0, runLosses = 0;
    for (const row of ordered) {
      const isWin = row.result.startsWith('WIN');
      if (isWin) {
        runWins += 1; runLosses = 0; maxWins = Math.max(maxWins, runWins);
      } else {
        runLosses += 1; runWins = 0; maxLosses = Math.max(maxLosses, runLosses);
      }
    }
    let currentCount = 0;
    const currentWin = ordered.at(-1).result.startsWith('WIN');
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (ordered[i].result.startsWith('WIN') === currentWin) currentCount++;
      else break;
    }
    return { currentType: currentWin ? 'win' : 'loss', currentCount, maxWins, maxLosses };
  }

  function resultSquares(results, limit = 10) {
    const rows = [...(results || [])].slice(-limit);
    if (!rows.length) return '<div class="empty">Sem base histórica suficiente.</div>';
    return `<div class="strip">${rows.map(row => {
      const outcome = row.result === 'LOSS'
        ? 'loss'
        : row.result === 'WIN G2'
          ? 'g2'
          : row.result === 'WIN G1'
            ? 'g1'
            : 'entry-win';
      const title = `${new Date(row.at * 1000).toLocaleString('pt-BR')} · ${row.result}`;
      return `<span class="sq ${outcome}" title="${title}">${shortResult(row.result)}</span>`;
    }).join('')}</div>`;
  }
  function probabilityBreakdown(metrics) {
    const sample = Number(metrics?.sample || 0);
    const direct = Number(metrics?.direct || 0);
    const g1 = Number(metrics?.g1 || 0);
    const g2 = Number(metrics?.g2 || 0);
    const losses = Number(metrics?.losses || 0);
    const pct = value => sample ? Math.round((value / sample) * 1000) / 10 : 0;
    const initialLosses = g1 + g2 + losses;
    const afterG1Losses = g2 + losses;
    const g1Recovery = initialLosses ? Math.round((g1 / initialLosses) * 1000) / 10 : 0;
    const g2Recovery = afterG1Losses ? Math.round((g2 / afterG1Losses) * 1000) / 10 : 0;
    const galeDependence = sample ? ((g1 + g2) / sample) * 100 : 0;

    let dependenceLabel = 'Baixa';
    if (galeDependence >= 35) dependenceLabel = 'Alta';
    else if (galeDependence >= 20) dependenceLabel = 'Moderada';

    return {
      direct: pct(direct),
      untilG1: pct(direct + g1),
      untilG2: pct(direct + g1 + g2),
      loss: pct(losses),
      g1Recovery,
      g2Recovery,
      dependenceLabel,
      galeDependence: Math.round(galeDependence * 10) / 10,
      sample
    };
  }

  function probabilityDetails(metrics) {
    const p = probabilityBreakdown(metrics);
    return `<div class="probability-details">
      <div class="probability-details-head">
        <strong>Probabilidades históricas</strong>
        <span>Amostra ${p.sample}</span>
      </div>
      <div class="probability-grid">
        <div><span>IN</span><strong>${p.direct.toFixed(1)}%</strong></div>
        <div><span>Até G1</span><strong>${p.untilG1.toFixed(1)}%</strong></div>
        <div><span>Até G2</span><strong>${p.untilG2.toFixed(1)}%</strong></div>
        <div><span>LOSS</span><strong>${p.loss.toFixed(1)}%</strong></div>
      </div>
      <div class="probability-extra">
        <span>Recuperação G1: ${p.g1Recovery.toFixed(1)}%</span>
        <span>Recuperação G2: ${p.g2Recovery.toFixed(1)}%</span>
        <span>Dependência de Gale: ${p.dependenceLabel}</span>
      </div>
    </div>`;
  }

  function restorePosition(card) {
    chrome.storage.local.get(POSITION_KEY, result => {
      const pos = result?.[POSITION_KEY];
      if (!pos) return;
      card.style.left = `${pos.left}px`;
      card.style.top = `${pos.top}px`;
      card.style.right = 'auto';
    });
  }

  function savePosition(card) {
    const rect = card.getBoundingClientRect();
    chrome.storage.local.set({
      [POSITION_KEY]: {
        left: Math.round(rect.left),
        top: Math.round(rect.top)
      }
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function startDrag(event) {
    if (event.target.closest('button')) return;
    const card = shadow.querySelector('.card');
    const rect = card.getBoundingClientRect();
    drag = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    card.classList.add('dragging');
    event.preventDefault();
  }

  function moveDrag(event) {
    if (!drag) return;
    const card = shadow.querySelector('.card');
    const maxLeft = Math.max(0, window.innerWidth - card.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - card.offsetHeight);
    const left = clamp(event.clientX - drag.offsetX, 0, maxLeft);
    const top = clamp(event.clientY - drag.offsetY, 0, maxTop);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.right = 'auto';
  }

  function endDrag() {
    if (!drag) return;
    const card = shadow.querySelector('.card');
    card.classList.remove('dragging');
    savePosition(card);
    drag = null;
  }

  function ensureOverlay() {
    if (host || !document.documentElement) return;

    host = document.createElement('div');
    host.id = 'iq-candle-lab-root';
    shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `<style>
      *{box-sizing:border-box}
      .card{
        position:fixed;z-index:2147483647;right:18px;top:88px;width:330px;
        max-height:calc(100vh - 32px);background:#101827;color:#eef2ff;
        border:1px solid #334155;border-radius:12px;box-shadow:0 18px 50px #0008;
        font:13px/1.4 Arial,sans-serif;overflow:hidden;user-select:none
      }
      .card.dragging{opacity:.94;cursor:grabbing}
      .head{
        display:flex;justify-content:space-between;align-items:center;
        padding:11px 12px;background:#172033;font-weight:700;cursor:grab
      }
      .head-actions{display:flex;gap:6px}
      .body{padding:12px;overflow:auto;max-height:calc(100vh - 90px);user-select:text}
      .row{display:flex;justify-content:space-between;margin:6px 0}
      .mode-badge{display:inline-flex;margin-top:5px;padding:3px 7px;border-radius:999px;font-size:9px;font-weight:800}
      .mode-badge.classic{background:#172a45;color:#93c5fd}
      .mode-badge.analytical{background:#3b2f12;color:#fcd34d}
      .muted{color:#94a3b8}.ok{color:#4ade80}.warn{color:#fbbf24}
      .btn{border:0;background:#26344d;color:#fff;padding:6px 9px;border-radius:7px;cursor:pointer}
      .icon-btn{width:28px;height:28px;padding:0;font-weight:700}
      .hidden .body{display:none}
      .context-strip{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}
      .context-card{background:#172033;border:1px solid #334155;border-radius:9px;padding:8px}
      .context-card-head{display:flex;justify-content:space-between;gap:6px;align-items:center}
      .context-card strong{font-size:12px}
      .context-card small{color:#94a3b8;font-size:10px}
      .context-badge{display:inline-flex;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:800}
      .context-badge.green{background:#123b2f;color:#86efac}
      .context-badge.red{background:#461b28;color:#fda4af}
      .context-badge.neutral{background:#1f2937;color:#cbd5e1}
      .context-badge.insufficient{background:#27303d;color:#94a3b8}
      .context-meta{margin-top:5px;color:#cbd5e1;font-size:10px}
      .top-pick{display:none;margin-top:10px;border:1px solid #facc15;background:linear-gradient(135deg,#3b2f12,#172033);border-radius:10px;padding:11px;cursor:pointer}
      .top-pick.active{display:block;animation:starPulse 1.5s ease-in-out infinite}
      .top-pick-head{display:flex;justify-content:space-between;gap:8px;align-items:center}
      .top-pick-title{display:flex;align-items:center;gap:7px;color:#fde68a;font-weight:900}
      .top-pick-title .star{font-size:18px}
      .top-pick-direction{font-weight:900}
      .top-pick-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
      .top-pick-grid div{background:#0f172a;border-radius:7px;padding:7px}
      .top-pick-grid span{display:block;color:#94a3b8;font-size:9px}
      .top-pick-grid strong{display:block;margin-top:2px;font-size:11px}
      .top-pick-note{margin-top:7px;color:#dbeafe;font-size:10px}
      @keyframes starPulse{0%,100%{box-shadow:0 0 0 0 rgba(250,204,21,.18)}50%{box-shadow:0 0 0 5px rgba(250,204,21,.25)}}
      .signals{margin-top:10px;border-top:1px solid #334155;padding-top:8px}
      .signal{padding:10px;margin-top:8px;background:#172033;border-radius:8px;cursor:pointer;border:1px solid transparent}
      .signal:hover{border-color:#465b7b}
      .signal.selected{border-color:#60a5fa;background:#172a45}
      .signal-head{display:flex;justify-content:space-between;gap:8px}
      .green{color:#4ade80}.red{color:#fb7185}
      .small{font-size:11px;color:#94a3b8;margin-top:3px}
      .metrics{display:flex;gap:8px;margin-top:6px;font-size:11px;flex-wrap:wrap}
      .metrics span{background:#0f172a;border-radius:6px;padding:3px 6px}
      .rec{margin-top:6px;font-size:11px}
      .favorable{color:#4ade80}.caution{color:#fbbf24}
      .unfavorable{color:#fb7185}.insufficient{color:#94a3b8}
      .empty{font-size:12px;color:#94a3b8;padding:7px 0}
      .focus{display:none}
      .focus.active{display:block}
      .list.hidden-list{display:none}
      .focus-card{background:#172033;border:1px solid #465b7b;border-radius:10px;padding:11px}
      .focus-title{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
      .decision{
        margin-top:9px;padding:9px;border-radius:8px;font-weight:700
      }
      .decision.favorable{background:#123b2f}
      .decision.caution{background:#3b2f12}
      .decision.unfavorable{background:#461b28}
      .decision.insufficient{background:#27303d}
      .decision.expired{background:#4b1220;color:#fecdd3;border:1px solid #be123c}
      .certainty{margin-top:8px;padding:7px 8px;border-radius:7px;font-size:11px;font-weight:700}
      .certainty.provisional{background:#3b2f12;color:#fcd34d}
      .certainty.mathematically_defined{background:#123b2f;color:#6ee7b7}
      .certainty.confirmed{background:#172a45;color:#93c5fd}
      .certainty.expired{background:#4b1220;color:#fecdd3;border:1px solid #be123c}
      .countdown{font-size:18px;font-weight:800;margin-top:4px}
      .entry-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}
      .entry-grid div{background:#0f172a;border-radius:7px;padding:7px}
      .entry-grid span{display:block;color:#94a3b8;font-size:10px}
      .entry-grid strong{display:block;margin-top:3px;font-size:12px}
      .results{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:9px}
      .results div{background:#0f172a;border-radius:7px;padding:7px;text-align:center}
      .results span{display:block;color:#94a3b8;font-size:9px}
      .results strong{display:block;margin-top:2px}
      .note{margin-top:8px;color:#b9c6d8;font-size:11px}
      .strip{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
      .sq{display:inline-grid;place-items:center;min-width:24px;height:20px;padding:0 4px;border-radius:5px;font-size:9px;font-weight:800;border:1px solid transparent}
      .sq.entry-win{background:#123b2f;color:#6ee7b7;border-color:#34d399}
      .sq.g1{background:#3b3212;color:#fde68a;border-color:#facc15}
      .sq.g2{background:#4a2510;color:#fdba74;border-color:#f97316}
      .sq.loss{background:#461b28;color:#fda4af;border-color:#fb7185;box-shadow:inset 0 0 0 1px #fb7185}
      .signal.recommended{position:relative;border-color:#34d399;animation:recommendedPulse 1.35s ease-in-out infinite}
      .signal.recommended::before{content:'ENTRADA RECOMENDADA';display:inline-flex;margin-bottom:7px;padding:3px 7px;border-radius:999px;background:#14532d;color:#86efac;font-size:9px;font-weight:900;letter-spacing:.05em}
      .signal.expired{position:relative;border-color:#be123c;background:#23121a}
      .signal.expired::before{content:'SINAL EXPIRADO';display:inline-flex;margin-bottom:7px;padding:3px 7px;border-radius:999px;background:#4b1220;color:#fecdd3;font-size:9px;font-weight:900;letter-spacing:.05em}
      .focus-card.recommended{position:relative;border-color:#34d399;animation:recommendedPulse 1.35s ease-in-out infinite}
      .focus-card.expired{position:relative;border-color:#be123c;background:#23121a}
      @keyframes recommendedPulse{
        0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.15)}
        50%{box-shadow:0 0 0 5px rgba(52,211,153,.28)}
      }
      @media (prefers-reduced-motion: reduce){
        .signal.recommended,.focus-card.recommended{animation:none}
      }
      .probability-details{margin-top:10px;background:#0b1628;border:1px solid #2b3c59;border-radius:9px;padding:9px}
      .probability-details-head{display:flex;justify-content:space-between;gap:8px;align-items:center}
      .probability-details-head span{color:#94a3b8;font-size:10px}
      .probability-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:8px}
      .probability-grid div{background:#0f172a;border-radius:7px;padding:6px;text-align:center}
      .probability-grid span{display:block;color:#94a3b8;font-size:9px}
      .probability-grid strong{display:block;margin-top:2px;font-size:11px}
      .probability-extra{display:grid;gap:3px;margin-top:8px;color:#cbd5e1;font-size:10px}
      .strip-stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:7px}
      .strip-stats span{background:#0f172a;border-radius:6px;padding:3px 6px;font-size:10px}
      .footer-actions{display:flex;gap:6px;margin-top:10px}
      .footer-actions .btn{flex:1}
    </style>
    <div class="card">
      <div class="head">
        <span>IQ Candle Lab</span>
        <div class="head-actions">
          <button class="btn icon-btn" id="reset-position" title="Voltar para a posição padrão">↺</button>
          <button class="btn icon-btn" id="toggle" title="Recolher">−</button>
        </div>
      </div>
      <div class="body">
        <div class="row"><span class="muted">Captura</span><b id="status">Inicializando</b></div>
        <div class="row"><span class="muted">Ativo</span><b id="symbol">—</b></div>
        <div class="row"><span class="muted">Velas salvas</span><b id="candles">0</b></div>
        <div><span id="mode-badge" class="mode-badge classic">Modo clássico</span></div>

        <div class="context-strip" id="context-strip"></div>
        <div class="top-pick" id="top-pick"></div>
        <div class="signals list" id="signals"></div>
        <div class="signals focus" id="focus"></div>

        <div class="footer-actions">
          <button class="btn" id="back-list" style="display:none">Voltar às estratégias</button>
          <button class="btn" id="open">Abrir análise</button>
        </div>
      </div>
    </div>`;

    document.documentElement.appendChild(host);

    const card = shadow.querySelector('.card');
    const head = shadow.querySelector('.head');
    restorePosition(card);

    head.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);

    shadow.getElementById('toggle').onclick = event => {
      event.stopPropagation();
      card.classList.toggle('hidden');
      state.collapsed = card.classList.contains('hidden');
      shadow.getElementById('toggle').textContent = state.collapsed ? '+' : '−';
    };

    shadow.getElementById('reset-position').onclick = event => {
      event.stopPropagation();
      card.style.left = 'auto';
      card.style.right = '18px';
      card.style.top = '88px';
      chrome.storage.local.remove(POSITION_KEY);
    };

    shadow.getElementById('open').onclick = () =>
      chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });

    shadow.getElementById('back-list').onclick = () => {
      state.focusedStrategyId = null;
      render();
    };

    render();
  }



  function renderContexts() {
    const container = shadow.getElementById('context-strip');
    const cards = contextCards();
    if (!cards.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = cards.map(item => {
      const data = item.data || {};
      const stateValue = data.state || 'insufficient';
      const strength = Number(data.strength || 0);
      const sample = Number(data.sample || 0);
      return `
        <div class="context-card">
          <div class="context-card-head">
            <div>
              <strong>${item.title}</strong>
              <small>${item.timeframe}</small>
            </div>
            <span class="context-badge ${stateValue}">${contextStateLabel(stateValue)}</span>
          </div>
          <div class="context-meta">${strength}% de força · amostra ${sample}</div>
        </div>`;
    }).join('');
  }

  function renderTopPick() {
    const container = shadow.getElementById('top-pick');
    const best = bestRecommendedEntry(state.floating);
    if (!best) {
      container.classList.remove('active');
      container.innerHTML = '';
      return;
    }
    const signal = best.liveSignal;
    const rec = best.recommendation;
    const mq = state.marketQuality;
    container.classList.add('active');
    container.innerHTML = `
      <div class="top-pick-head">
        <div class="top-pick-title"><span class="star">★</span><span>Melhor entrada recomendada</span></div>
        <div class="top-pick-direction ${signal.direction}">${directionLabel(signal.direction)}</div>
      </div>
      <div class="top-pick-grid">
        <div><span>Estratégia</span><strong>${best.shortName}</strong></div>
        <div><span>Horário</span><strong>${formatTime(signal.entryAt)}</strong></div>
        <div><span>Score</span><strong>${rec.score}%</strong></div>
        <div><span>Histórico</span><strong>${Number(best.metrics.rate||0).toFixed(1)}% · ${best.metrics.sample||0}</strong></div>
      </div>
      <div class="top-pick-note">
        ${signal.seconds > 0 ? `${signal.seconds}s para a entrada.` : 'Entrada agora.'}
        ${mq ? ` Regime: ${mq.regimeLabel}; intensidade: ${mq.intensityLabel}.` : ''}
      </div>`;
    container.onclick = () => {
      state.focusedStrategyId = best.strategyId;
      render();
    };
  }

  function renderFocused(item) {
    const focus = shadow.getElementById('focus');
    const signal = item.liveSignal;
    const rec = effectiveRecommendation(item.recommendation, signal);
    const m = item.metrics;
    const direction = signal?.direction;

    const entryTime = signal ? formatTime(signal.entryAt) : 'Aguardando condição';
    const entryMode = direction ? directionLabel(direction) : 'Sem direção definida';
    const entryState = entryStateLabel(signal);
    const expired = isSignalExpired(signal);

    focus.innerHTML = `
      <div class="focus-card ${expired ? 'expired' : (rec?.recommendation === 'ENTER' ? 'recommended' : '')}">
        <div class="focus-title">
          <div>
            <strong>${item.name}</strong>
            <div class="small">${signal ? `Estado: ${entryState}` : 'Aguardando novo gatilho'}</div>
          </div>
          <b class="${direction || 'muted'}">${direction ? directionLabel(direction) : 'Aguardando'}</b>
        </div>

        <div class="decision ${rec?.level || 'insufficient'}">
          ${recommendationLabel(rec)}
          ${rec ? `<div class="small">${rec.score}% de score combinado</div>` : ''}
        </div>

        ${signal ? `<div class="certainty ${expired ? 'expired' : signal.certainty}">
          ${expired ? 'Janela encerrada' : certaintyLabel(signal)}
          <div class="small">${expired ? 'Este sinal já expirou e não deve mais ser utilizado para entrada.' : (signal.reason || '')}</div>
          <div class="countdown">${expired ? 'Não entrar' : (signal.seconds > 0 ? `${signal.seconds}s para a entrada` : 'Entrada agora')}</div>
        </div>` : ''}

        <div class="entry-grid">
          <div><span>Horário da entrada</span><strong>${entryTime}</strong></div>
          <div><span>Como entrar</span><strong>${entryMode}</strong></div>
          <div><span>Momento</span><strong>${signal ? (expired ? 'Janela expirada' : 'Q1 do próximo quadrante') : 'Aguardando'}</strong></div>
          <div><span>Gale configurado</span><strong>Até G${item.galeLevel ?? 0}</strong></div>
        </div>

        <div class="results">
          <div><span>Taxa</span><strong>${Number(m.rate || 0).toFixed(1)}%</strong></div>
          <div><span>Amostra</span><strong>${m.sample || 0}</strong></div>
          <div><span>Win</span><strong>${m.direct || 0}</strong></div>
          <div><span>Win G1</span><strong>${m.g1 || 0}</strong></div>
          <div><span>Win G2</span><strong>${m.g2 || 0}</strong></div>
          <div><span>Loss</span><strong>${m.losses || 0}</strong></div>
        </div>

        ${probabilityDetails(m)}

        ${(() => { const s = streakInfo(m.results); return `
          <div class="note">Sequência visual das últimas ocorrências</div>
          ${resultSquares(m.results, 14)}
          <div class="strip-stats">
            <span>Atual: ${s.currentType === 'none' ? '—' : `${s.currentCount} ${s.currentType === 'win' ? 'win' : 'loss'}`}</span>
            <span>Máx. wins: ${s.maxWins}</span>
            <span>Máx. losses: ${s.maxLosses}</span>
          </div>`; })()}

        <div class="note">${rec?.explanation || 'Ainda não existe recomendação contextual.'}</div>
        ${rec?.aligned?.length ? `<div class="small">A favor: ${rec.aligned.join(', ')}</div>` : ''}
        ${rec?.contrary?.length ? `<div class="small">Contra: ${rec.contrary.join(', ')}</div>` : ''}
      </div>`;

    shadow.getElementById('signals').classList.add('hidden-list');
    focus.classList.add('active');
    shadow.getElementById('back-list').style.display = 'block';
  }

  function renderList() {
    const list = shadow.getElementById('signals');
    const focus = shadow.getElementById('focus');
    focus.classList.remove('active');
    list.classList.remove('hidden-list');
    shadow.getElementById('back-list').style.display = 'none';

    list.innerHTML = state.floating.length
      ? state.floating.map(item => {
          const signal = item.liveSignal;
          const rec = effectiveRecommendation(item.recommendation, signal);
          const direction = signal?.direction;
          const expired = isSignalExpired(signal);
          return `<div class="signal ${expired ? 'expired' : (rec?.recommendation === 'ENTER' ? 'recommended' : '')}" data-strategy-id="${item.strategyId}">
            <div class="signal-head">
              <strong>${item.shortName}</strong>
              ${direction
                ? `<b class="${direction}">${directionLabel(direction)}</b>`
                : '<b class="muted">Aguardando</b>'}
            </div>
            <div class="small">${
              signal
                ? `${expired ? 'Expirada' : certaintyLabel(signal)} · ${expired ? 'não entrar' : (signal.seconds > 0 ? `entrada em ${signal.seconds}s` : 'entrada agora')}`
                : 'sem condição no quadrante atual'
            }</div>
            <div class="metrics">
              <span>${Number(item.metrics.rate || 0).toFixed(1)}%</span>
              <span>${item.metrics.sample || 0} ocorrências</span>
              <span>${item.metrics.losses || 0} loss</span>
            </div>
            ${resultSquares(item.metrics.results, 10)}
            ${(() => { const s = streakInfo(item.metrics.results); return `<div class="strip-stats"><span>Atual: ${s.currentType === 'none' ? '—' : `${s.currentCount} ${s.currentType === 'win' ? 'win' : 'loss'}`}</span><span>Máx W: ${s.maxWins}</span><span>Máx L: ${s.maxLosses}</span></div>`; })()}
            ${rec ? `<div class="rec ${rec.level}">${rec.label} · ${rec.score}%</div>` : ''}
          </div>`;
        }).join('')
      : '<div class="empty">Nenhuma estratégia marcada como flutuante.</div>';


    list.querySelectorAll('[data-strategy-id]').forEach(element => {
      element.addEventListener('click', () => {
        state.focusedStrategyId = element.dataset.strategyId;
        render();
      });
    });
  }

  function render() {
    if (!shadow) return;

    shadow.getElementById('status').textContent = state.status;
    shadow.getElementById('status').className =
      state.status === 'capturando' ? 'ok' : 'warn';
    shadow.getElementById('symbol').textContent = state.symbol || '—';
    shadow.getElementById('candles').textContent = state.candles;
    const modeBadge = shadow.getElementById('mode-badge');
    modeBadge.className = `mode-badge ${state.recommendationMode}`;
    modeBadge.textContent = state.recommendationMode === 'analytical'
      ? 'Modo analítico'
      : 'Modo clássico';

    renderContexts();
    renderTopPick();

    const focused = state.floating.find(
      item => item.strategyId === state.focusedStrategyId
    );

    if (focused) renderFocused(focused);
    else renderList();
  }

  async function refreshAnalysis() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FLOATING_ANALYSIS'
      });

      if (response?.ok) {
        state.symbol = response.analysis.symbol;
        state.contexts = response.analysis.contexts || null;
        state.marketQuality = response.analysis.marketQuality || null;
        state.recommendationMode = response.analysis.recommendationMode || 'classic';
        state.floating = (response.analysis.floating || []).map(item => ({
          ...item,
          galeLevel: item.galeLevel ?? 0
        }));
        if (
          state.focusedStrategyId &&
          !state.floating.some(item => item.strategyId === state.focusedStrategyId)
        ) {
          state.focusedStrategyId = null;
        }
        render();
      }
    } catch (_) {}
  }

  function extractMarketContext(value, found = {}, depth = 0) {
    if (depth > 7 || value == null) return found;
    if (Array.isArray(value)) {
      for (const item of value) extractMarketContext(item, found, depth + 1);
      return found;
    }
    if (typeof value !== 'object') return found;

    const activeCandidates = [
      value.active_id, value.activeId, value.instrument_active_id,
      value.instrumentActiveId, value.active
    ];

    if (found.activeId == null) {
      const active = activeCandidates.find(v =>
        typeof v === 'number' || (typeof v === 'string' && v.trim())
      );
      if (active != null && typeof active !== 'object') found.activeId = active;
    }

    if (!found.symbol) {
      const symbol = value.symbol ?? value.instrument ?? value.asset_name ??
        value.instrument_name ?? value.name;
      if (typeof symbol === 'string' && symbol.length <= 40) found.symbol = symbol;
    }

    const tf = Number(
      value.timeframe ?? value.period ?? value.interval ?? value.size
    );
    if (!found.timeframeSec && [60,300,900,1800,3600,86400].includes(tf)) {
      found.timeframeSec = tf;
    }

    for (const child of Object.values(value)) {
      extractMarketContext(child, found, depth + 1);
    }
    return found;
  }

  function walk(value, out = [], depth = 0) {
    if (depth > 7 || value == null) return out;
    if (Array.isArray(value)) {
      value.forEach(v => walk(v, out, depth + 1));
      return out;
    }
    if (typeof value !== 'object') return out;

    const hasOpen = 'open' in value || 'opening' in value || 'o' in value;
    const hasClose = 'close' in value || 'closing' in value || 'c' in value;
    const hasTime = ['from','to','start','open_time','timestamp','at']
      .some(k => k in value);

    if (hasOpen && hasClose && hasTime) out.push(value);

    Object.values(value).forEach(v => walk(v, out, depth + 1));
    return out;
  }

  window.addEventListener('IQ_CANDLE_LAB_BRIDGE', async event => {
    const envelope = event.detail;
    if (!envelope) return;

    state.events += 1;
    state.lastEvent = envelope.type;

    if (
      envelope.type === 'BRIDGE_READY' ||
      envelope.type === 'WS_OPEN'
    ) {
      state.status = 'capturando';
    }

    const payload = envelope.detail?.payload;
    const rawCandles = payload ? walk(payload) : [];
    const inferred = payload ? extractMarketContext(payload) : {};

    if (inferred.activeId != null) state.activeId = inferred.activeId;
    if (inferred.symbol) state.symbol = inferred.symbol;

    const context = {
      origin: /candles/i.test(envelope.detail?.name || '')
        ? 'history'
        : 'realtime',
      activeId: inferred.activeId ?? state.activeId,
      symbol: inferred.symbol ?? state.symbol,
      timeframeSec: inferred.timeframeSec
    };

    const normalized = rawCandles.map(raw => ({ raw, context }));

    if (normalized.length) {
      const response = await chrome.runtime.sendMessage({
        type: 'CANDLES',
        candles: normalized
      });
      state.candles += response?.saved || 0;
      await refreshAnalysis();
    }

    chrome.runtime.sendMessage({
      type: 'DIAGNOSTIC',
      entry: {
        kind: envelope.type,
        eventName: envelope.detail?.name,
        url: location.href
      }
    });

    ensureOverlay();
    render();
  });

  document.addEventListener('DOMContentLoaded', ensureOverlay);
  setTimeout(ensureOverlay, 1500);
  setInterval(refreshAnalysis, 5000);
})();

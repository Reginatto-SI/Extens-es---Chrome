const fmt = ts => ts ? new Date(ts * 1000).toLocaleString('pt-BR') : '—';
const fmtTime = ts => ts ? new Date(ts * 1000).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—';
const labelColor = c => c === 'green' ? 'Verde' : c === 'red' ? 'Vermelho' : c === 'doji' ? 'Doji' : c === 'neutral' ? 'Neutro' : c;
const badge = c => `<span class="badge ${c}">${labelColor(c)}</span>`;
function contextHtml(c){ return `<strong>${labelColor(c.state)}</strong><p>${c.strength}% de força · amostra ${c.sample}</p>`; }
function rateClass(rate){ return rate >= 75 ? 'good' : rate >= 60 ? 'medium' : 'low'; }
function certaintyBadge(signal){
  if (!signal) return '';
  const label = signal.certainty === 'mathematically_defined'
    ? 'Matematicamente definida'
    : signal.certainty === 'confirmed'
      ? 'Confirmada'
      : 'Provisória';
  return `<span class="certainty-badge ${signal.certainty}">${label}</span>`;
}
function resultBadge(result){
  const cls = result === 'LOSS' ? 'result-loss' : result.includes('G') ? 'result-gale' : 'result-win';
  return `<span class="result-badge ${cls}">${result}</span>`;
}
function resultShort(result){
  if (result === 'WIN') return 'IN';
  if (result === 'WIN G1') return 'G1';
  if (result === 'WIN G2') return 'G2';
  return 'LOSS';
}
function streakInfo(results){
  const ordered = [...(results || [])];
  if (!ordered.length) return { currentType: 'none', currentCount: 0, maxWins: 0, maxLosses: 0 };
  let maxWins = 0, maxLosses = 0, runWins = 0, runLosses = 0;
  for (const row of ordered) {
    const win = row.result.startsWith('WIN');
    if (win) {
      runWins += 1; runLosses = 0;
      maxWins = Math.max(maxWins, runWins);
    } else {
      runLosses += 1; runWins = 0;
      maxLosses = Math.max(maxLosses, runLosses);
    }
  }
  let currentCount = 0;
  const currentWin = ordered.at(-1).result.startsWith('WIN');
  for (let i = ordered.length - 1; i >= 0; i--) {
    const isWin = ordered[i].result.startsWith('WIN');
    if (isWin === currentWin) currentCount++;
    else break;
  }
  return { currentType: currentWin ? 'win' : 'loss', currentCount, maxWins, maxLosses };
}
function resultSquares(results, limit = 16){
  const rows = [...(results || [])].slice(-limit);
  return rows.length
    ? `<div class="result-strip">${rows.map(row => {
        const outcome = row.result === 'LOSS'
          ? 'loss'
          : row.result === 'WIN G2'
            ? 'g2'
            : row.result === 'WIN G1'
              ? 'g1'
              : 'entry-win';
        const label = resultShort(row.result);
        const title = `${fmt(row.at)} · ${row.direction === 'green' ? 'CALL/Verde' : 'PUT/Vermelho'} · ${row.result}`;
        return `<span class="result-square ${outcome}" title="${title}">${label}</span>`;
      }).join('')}</div>`
    : '<p class="empty">Sem ocorrências suficientes.</p>';
}
function resultVisualBlock(results, limit = 16){
  const streak = streakInfo(results || []);
  return `
    <div class="result-visual">
      <div class="result-visual-head">
        <strong>Sequência visual</strong>
        <small>Últimas ${Math.min((results || []).length, limit)} ocorrências</small>
      </div>
      ${resultSquares(results, limit)}
      <div class="result-stats">
        <span>Atual: ${streak.currentType === 'none' ? '—' : `${streak.currentCount} ${streak.currentType === 'win' ? 'win' : 'loss'}`}</span>
        <span>Máx. wins: ${streak.maxWins}</span>
        <span>Máx. losses: ${streak.maxLosses}</span>
      </div>
    </div>`;
}
function probabilityBreakdown(metrics){
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

function probabilityDetailsBlock(metrics){
  const p = probabilityBreakdown(metrics);
  return `
    <div class="probability-details">
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
        <span>Dependência de Gale: ${p.dependenceLabel} (${p.galeDependence.toFixed(1)}%)</span>
      </div>
    </div>`;
}
function isSignalExpired(signal){
  return Boolean(signal && (signal.state === 'expirada' || Number(signal.seconds) < -5));
}
function effectiveRecommendation(rec, signal){
  if (isSignalExpired(signal)) {
    return {
      recommendation: 'EXPIRED',
      level: 'expired',
      label: 'Sinal expirado — não entrar',
      score: 0,
      aligned: [],
      contrary: [],
      explanation: 'A janela desta entrada já passou. Aguarde uma nova condição válida em vez de entrar atrasado.'
    };
  }
  return rec || null;
}
function recommendationHtml(rec){
  if (!rec) return '<p class="empty">Sem entrada projetada no quadrante atual.</p>';
  return `<div class="recommendation ${rec.level}">
    <strong>${rec.label}</strong>
    <span>${rec.score}% de score combinado</span>
    <p>${rec.explanation}</p>
    ${rec.marketQuality ? `<small>Regime: ${rec.marketQuality.regimeLabel} · Intensidade: ${rec.marketQuality.intensityLabel} · Corpo médio: ${rec.marketQuality.averageBodyRatio}%</small>` : ''}
    ${rec.aligned.length ? `<small>A favor: ${rec.aligned.join(', ')}</small>` : ''}
    ${rec.contrary.length ? `<small>Contra: ${rec.contrary.join(', ')}</small>` : ''}
  </div>`;
}
function closeStrategyModal(){
  const modal = document.getElementById('strategy-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
}
function openStrategyModal(strategyId){
  const item = currentAnalysis?.backtests.find(x => x.strategy.id === strategyId);
  if (!item) return;
  const {strategy, metrics, liveSignal} = item;
  const recommendation = effectiveRecommendation(item.recommendation, liveSignal);
  const expired = isSignalExpired(liveSignal);
  document.getElementById('modal-category').textContent = strategy.category;
  document.getElementById('modal-title').textContent = strategy.name;
  const nextEntry = liveSignal
    ? `<div class="next-entry ${expired ? 'expired' : liveSignal.direction}">
        <span>Próxima entrada identificada</span>
        <strong>${liveSignal.direction === 'green' ? 'CALL · Verde' : 'PUT · Vermelho'}</strong>
        <small>${fmt(liveSignal.entryAt)} · ${expired ? 'expirada' : liveSignal.state}</small>
        <div class="modal-certainty">${expired ? '<span class="certainty-badge expired">Expirada</span>' : certaintyBadge(liveSignal)}</div>
        <p class="signal-reason">${expired ? 'Este sinal já passou da janela de entrada e não deve ser seguido.' : (liveSignal.reason || '')}</p>
        <b class="modal-countdown">${expired ? 'Não entrar' : (liveSignal.seconds > 0 ? `${liveSignal.seconds}s restantes` : 'Entrada agora')}</b>
      </div>`
    : `<div class="next-entry neutral"><span>Próxima entrada</span><strong>Aguardando condição</strong><small>A estratégia ainda não encontrou gatilho no quadrante atual.</small></div>`;

  const rows = [...metrics.results].reverse().slice(0,50);
  document.getElementById('modal-body').innerHTML = `
    <p class="modal-description">${strategy.description}</p>
    <div class="modal-summary">
      <div><span>Taxa observada</span><strong class="${rateClass(metrics.rate)}">${metrics.rate.toFixed(1)}%</strong></div>
      <div><span>Amostra</span><strong>${metrics.sample}</strong></div>
      <div><span>Win direto</span><strong>${metrics.direct}</strong></div>
      <div><span>Win G1</span><strong>${metrics.g1}</strong></div>
      <div><span>Win G2</span><strong>${metrics.g2}</strong></div>
      <div><span>Loss</span><strong>${metrics.losses}</strong></div>
    </div>
    <div class="modal-columns">
      <section>
        <h3>Entrada atual</h3>
        ${nextEntry}
      </section>
      <section>
        <h3>Recomendação pelos contextos</h3>
        ${recommendationHtml(recommendation)}
      </section>
    </div>
    ${probabilityDetailsBlock(metrics)}
    <section>
      <div class="section-head">
        <h3>Linha do tempo de resultados</h3>
        <span class="muted">Últimas ${Math.min(rows.length,50)} ocorrências</span>
      </div>
      ${resultVisualBlock(metrics.results, 24)}
      <div class="result-timeline">
        ${rows.length ? rows.map(row => `
          <div class="timeline-row">
            <div class="timeline-time"><strong>${fmt(row.at)}</strong><small>${row.direction === 'green' ? 'CALL · Verde' : 'PUT · Vermelho'}</small></div>
            <div>${resultBadge(row.result)}</div>
            <div class="timeline-candles">
              ${row.target.candles.slice(0,3).map((c,i)=>`<span class="mini-candle ${c.color}" title="${fmt(c.from)}">Q${i+1}</span>`).join('')}
            </div>
          </div>`).join('') : '<p class="empty">Nenhuma ocorrência histórica encontrada.</p>'}
      </div>
    </section>`;

  const modal = document.getElementById('strategy-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
}


let currentAnalysis = null;
let currentRecommendationMode = 'classic';

function setupTabs() {
  document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
    });
  });
}

async function toggleStrategy(id, field, value) {
  await IQLAB.updateStrategy(id, { [field]: value });
  await render();
}

function renderStrategies(backtests) {
  const target = document.getElementById('strategy-list');
  target.innerHTML = backtests.map(({strategy:s, metrics:m}) => `
    <article class="strategy-card ${s.active ? '' : 'disabled'}" data-strategy-id="${s.id}">
      <div class="strategy-head">
        <div>
          <span class="category">${s.category}</span>
          <h3>${s.name}</h3>
        </div>
        <label class="switch-label"><input type="checkbox" data-action="active" data-id="${s.id}" ${s.active?'checked':''}><span>Ativa</span></label>
      </div>
      <p>${s.description}</p>
      <div class="rule-box"><strong>Regra:</strong> ${s.rule}</div>
      <div class="strategy-metrics">
        <div><span>Taxa observada</span><strong class="${rateClass(m.rate)}">${m.rate.toFixed(1)}%</strong></div>
        <div><span>Amostra</span><strong>${m.sample}</strong></div>
        <div><span>Win direto</span><strong>${m.direct}</strong></div>
        <div><span>G1 / G2</span><strong>${m.g1} / ${m.g2}</strong></div>
        <div><span>Loss</span><strong>${m.losses}</strong></div>
      </div>
      ${resultVisualBlock(m.results, 14)}
      <div class="strategy-actions">
        <label class="switch-label"><input type="checkbox" data-action="floating" data-id="${s.id}" ${s.floating?'checked':''}><span>Mostrar flutuante</span></label>
        <span class="muted">Gale até G${s.galeLevel}</span>
      </div>
    </article>
  `).join('');

  target.querySelectorAll('input[data-action]').forEach(input => {
    input.addEventListener('change', event => {
      event.stopPropagation();
      toggleStrategy(input.dataset.id, input.dataset.action, input.checked);
    });
  });
  target.querySelectorAll('.strategy-card[data-strategy-id]').forEach(card => {
    card.addEventListener('click', event => {
      if (event.target.closest('input, label')) return;
      openStrategyModal(card.dataset.strategyId);
    });
  });
}

async function setRecommendationMode(mode) {
  currentRecommendationMode = mode;
  await IQLAB.setSetting('recommendationMode', mode);
  await render();
}

function renderRecommendationMode(mode) {
  currentRecommendationMode = mode;
  document.querySelectorAll('input[name="recommendation-mode"]').forEach(input => {
    input.checked = input.value === mode;
  });
  const description = document.getElementById('mode-description');
  description.innerHTML = mode === 'analytical'
    ? '<strong>Modo analítico ativo:</strong> intensidade, regime e alinhamento direcional podem bloquear sinais que seriam aceitos no modo clássico.'
    : '<strong>Modo clássico ativo:</strong> recomendação baseada principalmente em histórico, amostra e Mar, Maré, Onda e Marola.';
}

async function render() {
  const [candles, diagnostics, strategies, recommendationMode] = await Promise.all([
    IQLAB.getAllCandles(),
    IQLAB.getDiagnostics(30),
    IQLAB.getStrategies(),
    IQLAB.getSetting('recommendationMode', 'classic')
  ]);
  const a = await IQLAB.analyze(candles, strategies, { recommendationMode });
  renderRecommendationMode(recommendationMode);
  currentAnalysis = a;

  document.getElementById('m-total').textContent = a.total;
  document.getElementById('m-symbol').textContent = a.symbol || 'Aguardando captura';
  document.getElementById('m-last').textContent = a.latest ? fmt(a.latest.from) : '—';
  document.getElementById('m-quads').textContent = a.quadrants.filter(q => q.complete).length;

  const timeframeCounts = candles.reduce((acc, candle) => {
    const measured = Number(candle.to) - Number(candle.from);
    const tf = Number(candle.timeframeSec) === 60 || measured === 60
      ? 60
      : Number(candle.timeframeSec || measured || 0);
    acc[tf] = (acc[tf] || 0) + 1;
    return acc;
  }, {});
  const timeframeEntries = Object.entries(timeframeCounts).sort((x,y) => Number(x[0]) - Number(y[0]));
  document.getElementById('timeframe-summary').innerHTML = timeframeEntries.length
    ? timeframeEntries.map(([tf,count]) => `<div class="tf-chip ${Number(tf)===60?'tf-ok':'tf-other'}"><strong>${tf}s</strong><span>${count} velas</span></div>`).join('')
    : '<p class="empty">Nenhuma vela armazenada.</p>';

  const d = a.captureDiagnostics;
  const gapEntries = Object.entries(d.gapHistogram).sort((x,y)=>Number(x[0])-Number(y[0]));
  const gapText = gapEntries.length
    ? gapEntries.map(([seconds,count]) => `${seconds}s × ${count}`).join(', ')
    : 'sem intervalos calculados';
  document.getElementById('formation-diagnostic').innerHTML = `
    <div class="diagnostic-grid">
      <div><span>M1 do ativo atual</span><strong>${d.m1Detected}</strong></div>
      <div><span>M1 considerados fechados</span><strong>${d.m1Closed}</strong></div>
      <div><span>Minutos únicos</span><strong>${d.uniqueMinutes}</strong></div>
      <div><span>Duplicidades</span><strong>${d.duplicates}</strong></div>
      <div><span>Maior sequência contínua</span><strong>${d.longestConsecutiveRun} min</strong></div>
      <div><span>Quadrantes parciais</span><strong>${d.partialQuadrants}</strong></div>
    </div>
    <div class="diagnostic-message ${d.completeQuadrants ? 'success' : 'warning'}">
      ${d.completeQuadrants
        ? `Foram reconhecidos ${d.completeQuadrants} quadrantes completos.`
        : `Nenhum quadrante completo. Intervalos encontrados: ${gapText}. Para formar um quadrante são necessários cinco minutos consecutivos.`}
    </div>`;
  document.getElementById('diagnostic-json').textContent = JSON.stringify({
    generatedAt: new Date().toISOString(),
    activeId: a.currentAssetId,
    symbol: a.symbol,
    diagnostics: d,
    contextModel: a.contextModel,
    assetCoverage: a.assetCoverage,
    aggregatedComplete: {
      M5: a.aggregated.m5.length,
      M15: a.aggregated.m15.length,
      M30: a.aggregated.m30.length,
      H1: a.aggregated.h1.length,
      D1: a.aggregated.d1.length
    },
    contexts: a.contexts
  }, null, 2);

  for (const [k,v] of Object.entries(a.contexts)) {
    document.getElementById(`ctx-${k}`).innerHTML = contextHtml(v);
    const model = a.contextModel[k];
    const label = document.getElementById(`ctx-label-${k}`);
    if (label && model) label.textContent = `· ${model.label}`;
  }

  document.getElementById('asset-coverage').innerHTML = a.assetCoverage.length
    ? `<table><thead><tr><th>Ativo</th><th>ID</th><th>Período</th><th>Velas</th><th>Fechadas</th><th>Primeira</th><th>Última</th></tr></thead><tbody>${
        a.assetCoverage.map(row => `<tr>
          <td>${row.symbol || '—'}</td>
          <td>${row.activeId ?? '—'}</td>
          <td>${row.timeframeSec}s</td>
          <td>${row.total}</td>
          <td>${row.closed}</td>
          <td>${fmt(row.first)}</td>
          <td>${fmt(row.last)}</td>
        </tr>`).join('')
      }</tbody></table>`
    : '<p class="empty">Nenhuma cobertura histórica disponível.</p>';

  document.getElementById('live-signals').innerHTML = a.liveSignals.length
    ? `<div class="signal-list">${a.liveSignals.map(s => `
        <button class="signal-row signal-button" data-strategy-id="${s.strategyId}">
          <div>
            <strong>${s.name}</strong>
            <small>${isSignalExpired(s) ? 'expirada · não entrar' : `${s.state} · entrada ${fmtTime(s.entryAt)} · ${s.seconds > 0 ? `${s.seconds}s` : 'agora'}`}</small>
            <div>${isSignalExpired(s) ? '<span class="certainty-badge expired">Expirada</span>' : certaintyBadge(s)}</div>
            ${resultSquares((currentAnalysis?.backtests.find(x => x.strategy.id === s.strategyId)?.metrics?.results) || [], 10)}
          </div>
          <div class="signal-direction">${badge(s.direction)}</div>
        </button>`).join('')}</div>`
    : '<p class="empty">Nenhuma estratégia ativa encontrou condição no último quadrante completo.</p>';

  const ranked = a.backtests.filter(x => x.strategy.active).slice(0,6);
  document.getElementById('ranking').innerHTML = ranked.length
    ? ranked.map((x,i) => `<button class="rank-row rank-button" data-strategy-id="${x.strategy.id}"><span class="rank-number">${i+1}</span><div><strong>${x.strategy.shortName}</strong><small>${x.metrics.sample} ocorrências</small></div><b class="${rateClass(x.metrics.rate)}">${x.metrics.rate.toFixed(1)}%</b></button>`).join('')
    : '<p class="empty">Nenhuma estratégia ativa.</p>';

  document.querySelectorAll('[data-strategy-id]').forEach(element => {
    if (element.closest('#strategy-list')) return;
    element.addEventListener('click', () => openStrategyModal(element.dataset.strategyId));
  });

  renderStrategies(a.backtests);

  const quads = [...a.quadrants].sort((x,y)=>y.start-x.start).slice(0,30);
  document.getElementById('quadrants').innerHTML = quads.length
    ? `<table><thead><tr><th>Início</th><th>Ativo</th><th>Sequência</th><th>Maioria</th><th>Status</th></tr></thead><tbody>${quads.map(q => `<tr><td>${fmt(q.start)}</td><td>${q.symbol}</td><td>${q.sequence.map(badge).join(' ')}</td><td>${badge(q.majority)}</td><td>${q.complete?'Completo':'Incompleto'}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">Ainda não existem quadrantes.</p>';

  document.getElementById('candles').innerHTML = candles.length
    ? `<table><thead><tr><th>Horário</th><th>Ativo</th><th>TF</th><th>Abertura</th><th>Fechamento</th><th>Cor</th><th>Fechado</th></tr></thead><tbody>${[...candles].sort((a,b)=>b.from-a.from).slice(0,150).map(c=>`<tr><td>${fmt(c.from)}</td><td>${c.symbol}</td><td>${c.timeframeSec}s</td><td>${c.open}</td><td>${c.close}</td><td>${badge(c.color)}</td><td>${c.closed?'Sim':'Não'}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">Abra a IQ Option e aguarde a captura das mensagens de velas.</p>';

  document.getElementById('diagnostics').innerHTML = diagnostics.length
    ? `<table><thead><tr><th>Horário</th><th>Tipo</th><th>Evento</th></tr></thead><tbody>${diagnostics.map(d=>`<tr><td>${new Date(d.createdAt).toLocaleTimeString('pt-BR')}</td><td>${d.kind||'—'}</td><td>${d.eventName||'—'}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">Nenhum evento diagnosticado.</p>';
}

document.getElementById('refresh').onclick = render;
document.getElementById('export').onclick = async () => {
  const candles = await IQLAB.getAllCandles();
  const strategies = await IQLAB.getStrategies();
  const blob = new Blob([JSON.stringify({ version:2, exportedAt:new Date().toISOString(), candles, strategies }, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`iq-candle-lab-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
};

setupTabs();
render();
setInterval(render, 5000);

document.getElementById('copy-diagnostic').onclick = async () => {
  const text = document.getElementById('diagnostic-json').textContent;
  try {
    await navigator.clipboard.writeText(text);
    document.getElementById('copy-diagnostic').textContent = 'Copiado';
    setTimeout(() => document.getElementById('copy-diagnostic').textContent = 'Copiar diagnóstico', 1500);
  } catch (_) {}
};

document.querySelectorAll('[data-close-modal]').forEach(element => {
  element.addEventListener('click', closeStrategyModal);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeStrategyModal();
});

document.querySelectorAll('input[name="recommendation-mode"]').forEach(input => {
  input.addEventListener('change', () => {
    if (input.checked) setRecommendationMode(input.value);
  });
});

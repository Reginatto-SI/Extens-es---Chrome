(() => {
  if (window.__MAPS_EMPRESAS_CONTENT_LOADED__) {
    console.log('[Maps_Empresas] Content script já carregado.');
    return;
  }

  window.__MAPS_EMPRESAS_CONTENT_LOADED__ = true;
  const SESSION_KEYS = {
    leads: 'mapsEmpresasLeads',
    fieldMap: 'mapsEmpresasFieldMap',
    status: 'mapsEmpresasStatus',
    lastMessage: 'mapsEmpresasLastMessage',
    targetTabId: 'mapsEmpresasTargetTabId'
  };

  const state = {
    trainingMode: false,
    selectingField: null,
    captureEnabled: false,
    leads: [],
    fieldMap: {},
    observer: null,
    debounceTimer: null,
    highlightedElement: null,
    previousBodyCursor: '',
    status: 'Aguardando',
    lastMessage: '',
    floatingPanel: null,
    floatingPanelMinimized: false,
    assistedScanEnabled: false,
    assistedScanMode: 'medium',
    assistedScanTimer: null,
    assistedScanOptions: {
      intervalMs: 1800,
      maxSteps: 50,
      currentStep: 0,
      unchangedSteps: 0,
      maxUnchangedSteps: 5,
      lastLeadCount: 0,
      lastScrollTop: 0,
      noScrollSteps: 0
    }
  };

  const FIELD_LABELS = {
    listContainer: 'lista lateral',
    name: 'nome',
    phone: 'telefone',
    address: 'endereço',
    website: 'site'
  };

  const ASSISTED_SCAN_MODES = {
    short: { label: 'Curta', maxSteps: 20, intervalMs: 1500, maxUnchangedSteps: 4 },
    medium: { label: 'Média', maxSteps: 50, intervalMs: 1800, maxUnchangedSteps: 5 },
    long: { label: 'Longa', maxSteps: 100, intervalMs: 2200, maxUnchangedSteps: 8 }
  };

  const PHONE_REGEX = /(?:\+55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s]?\d{4}\b/g;
  const WEBSITE_REGEX = /(?:https?:\/\/)?(?:www\.)?[\w.-]+\.(?:com\.br|com|net\.br|net|org\.br|org|br)(?:\/[\w\-.~:/?#[\]@!$&'()*+,;=%]*)?/gi;
  const RATING_REGEX = /\b([1-5][,.][0-9])\b/;
  const REVIEW_COUNT_REGEX = /(?:\(|\b)(\d{1,3}(?:\.\d{3})*|\d+)(?:\)|\s+avalia(?:ç|c)(?:ões|oes))/i;
  const ADDRESS_HINT_REGEX = /(rua|avenida|av\.?|rodovia|travessa|praça|praca|alameda|estrada|bairro|cep|nº|numero|número)/i;

  // Restaura apenas o estado de sessão; não há banco, backend ou storage permanente.
  const sessionReady = initializeContent();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('[Maps_Empresas] Comando recebido:', message?.type);
    (async () => {
      await sessionReady;

      switch (message?.type) {
        case 'START_TRAINING':
          return startTraining();
        case 'SELECT_FIELD':
          return selectField(message.fieldName);
        case 'START_CAPTURE':
          return startCapture();
        case 'START_VISIBLE_CAPTURE':
          return startVisibleCapture();
        case 'START_ASSISTED_SCAN':
          return startAssistedScan();
        case 'TOGGLE_FLOATING_PANEL':
          return toggleFloatingPanel();
        case 'PAUSE_CAPTURE':
          return pauseCapture();
        case 'CLEAR_DATA':
          return clearData();
        case 'GET_STATE':
          await loadSession();
          return makeResponse('Estado carregado.');
        default:
          return { ok: false, message: 'Comando não reconhecido.' };
      }
    })()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, message: error.message || 'Erro inesperado.' }));
    return true;
  });

  async function initializeContent() {
    await loadSession();
    console.log('[Maps_Empresas] Content script carregado.');
  }

  function startTraining() {
    state.trainingMode = true;
    state.selectingField = null;
    state.captureEnabled = false;
    stopAssistedScanTimer();
    stopObserver();
    return syncSession('Aguardando', 'Treinamento iniciado. Escolha um campo para selecionar.');
  }

  function selectField(fieldName) {
    if (!FIELD_LABELS[fieldName]) {
      return Promise.resolve({ ok: false, message: 'Campo inválido para treinamento.' });
    }

    state.trainingMode = true;
    state.selectingField = fieldName;
    console.log(`[Maps_Empresas] Modo seleção ativo: ${fieldName}`);
    setTrainingCursor();
    removeHighlight();
    document.addEventListener('mouseover', handleSelectionMouseOver, true);
    document.addEventListener('mouseout', handleSelectionMouseOut, true);
    document.addEventListener('click', handleSelectionClick, true);
    return syncSession(`Treinando: selecione o campo ${FIELD_LABELS[fieldName]}`, 'Clique no elemento correspondente no Google Maps.');
  }

  async function startCapture() {
    state.trainingMode = false;
    state.selectingField = null;
    state.captureEnabled = true;
    state.assistedScanEnabled = false;
    stopAssistedScanTimer();
    removeSelectionListeners();
    removeHighlight();
    resetTrainingCursor();
    startObserver();
    await scanPage();
    return syncSession('Capturando', 'Captura iniciada. Role a lista manualmente para encontrar mais empresas.');
  }

  async function startVisibleCapture() {
    state.trainingMode = false;
    state.selectingField = null;
    state.captureEnabled = true;
    state.assistedScanEnabled = false;
    stopAssistedScanTimer();
    stopObserver();
    removeSelectionListeners();
    removeHighlight();
    resetTrainingCursor();
    await scanPage('Capturando', 'Captura visível concluída.');
    state.captureEnabled = false;
    return syncSession('Aguardando', 'Captura visível concluída.');
  }

  function pauseCapture() {
    state.captureEnabled = false;
    state.assistedScanEnabled = false;
    stopAssistedScanTimer();
    stopObserver();
    removeSelectionListeners();
    removeHighlight();
    resetTrainingCursor();
    console.log('[Maps_Empresas] Varredura assistida pausada.');
    return syncSession('Pausado', 'Captura pausada.');
  }

  async function clearData() {
    state.leads = [];
    state.fieldMap = {};
    state.captureEnabled = false;
    state.trainingMode = false;
    state.selectingField = null;
    state.assistedScanEnabled = false;
    stopAssistedScanTimer();
    stopObserver();
    removeSelectionListeners();
    removeHighlight();
    resetTrainingCursor();
    await chrome.storage.session.remove(SESSION_KEYS.targetTabId);
    return syncSession('Aguardando', 'Dados limpos com sucesso.');
  }

  async function scanPage(status = 'Capturando', message = 'Captura atualizada com os dados visíveis.', shouldSync = true) {
    if (!state.captureEnabled) return;
    scanListContainer();
    scanDetailsPanel();
    console.log('[Maps_Empresas] Leads capturados:', state.leads.length);
    if (shouldSync) await syncSession(status, message);
  }

  function scanListContainer() {
    const containers = getListContainers();
    containers.forEach((container) => {
      getCandidateCards(container).forEach((card) => {
        const lead = extractLeadFromElement(card);
        saveLead(lead);
      });
    });
  }

  function scanDetailsPanel() {
    const detailCandidates = [
      document.querySelector('[role="main"]'),
      document.querySelector('[aria-label][role="region"]'),
      document.querySelector('div[role="main"]')
    ].filter(Boolean);

    detailCandidates.forEach((panel) => {
      const lead = extractLeadFromElement(panel);
      saveLead(lead);
    });
  }

  function extractLeadFromElement(element) {
    if (!element) return null;
    const text = normalizeText(element.innerText || element.textContent || '');
    if (!text || text.length < 3) return null;

    const trained = extractUsingTraining(element);
    const phones = extractPhones(text);
    const website = trained.website || extractWebsite(text) || extractWebsiteFromLinks(element);
    const lines = text.split('\n').map(normalizeText).filter(Boolean);
    const name = trained.name || findName(element, lines);
    const address = trained.address || findAddress(lines);
    const phone = trained.phone || phones[0] || '';

    const lead = {
      name,
      phone,
      address,
      website,
      rating: findRating(text),
      reviewCount: findReviewCount(text),
      category: findCategory(lines, name, address, phone),
      url: location.href,
      capturedAt: new Date().toISOString()
    };

    return lead.name || lead.phone || lead.website || lead.address ? lead : null;
  }

  function extractPhones(text) {
    const matches = normalizeText(text).match(PHONE_REGEX) || [];
    return [...new Set(matches.map((phone) => phone.trim()).filter(isLikelyBrazilianPhone))];
  }

  function extractWebsite(text) {
    const matches = normalizeText(text).match(WEBSITE_REGEX) || [];
    return matches.map(cleanWebsite).find(Boolean) || '';
  }

  function normalizeText(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function makeLeadKey(lead) {
    if (!lead) return '';
    if (lead.phone) return `phone:${onlyDigits(lead.phone)}`;
    if (lead.name && lead.address) return `name-address:${slug(lead.name)}:${slug(lead.address)}`;
    if (lead.name && lead.url) return `name-url:${slug(lead.name)}:${lead.url.split('?')[0]}`;
    return '';
  }

  // Deduplica localmente por telefone, nome+endereço ou nome+URL antes de sincronizar a sessão.
  function saveLead(lead) {
    const key = makeLeadKey(lead);
    if (!key) return false;

    const existingIndex = state.leads.findIndex((item) => makeLeadKey(item) === key);
    if (existingIndex >= 0) {
      state.leads[existingIndex] = { ...state.leads[existingIndex], ...lead };
      return false;
    }

    state.leads.push(lead);
    return true;
  }

  async function syncSession(status, message) {
    try {
      await chrome.storage.session.set({
        [SESSION_KEYS.leads]: state.leads,
        [SESSION_KEYS.fieldMap]: state.fieldMap,
        [SESSION_KEYS.status]: status || 'Aguardando',
        [SESSION_KEYS.lastMessage]: message || ''
      });
      state.status = status || 'Aguardando';
      state.lastMessage = message || '';
      console.log('[Maps_Empresas] Sessão sincronizada:', state.status);
      if (state.floatingPanel) await renderFloatingPanel();
      return makeResponse(message || 'OK');
    } catch (error) {
      return reportStorageError(error);
    }
  }

  async function loadSession() {
    try {
      const data = await chrome.storage.session.get(Object.values(SESSION_KEYS));
      state.leads = Array.isArray(data[SESSION_KEYS.leads]) ? data[SESSION_KEYS.leads] : [];
      state.fieldMap = data[SESSION_KEYS.fieldMap] && typeof data[SESSION_KEYS.fieldMap] === 'object' ? data[SESSION_KEYS.fieldMap] : {};
      state.status = data[SESSION_KEYS.status] || 'Aguardando';
      state.lastMessage = data[SESSION_KEYS.lastMessage] || '';
    } catch (error) {
      await reportStorageError(error);
    }
    return state;
  }


  // Controla a UI principal da versão 2.0 dentro do Google Maps, sem tentar reabrir o popup do Chrome.
  async function toggleFloatingPanel() {
    if (!isGoogleMapsPage()) {
      return { ok: false, message: 'O painel só pode ser aberto em páginas do Google Maps.' };
    }

    state.floatingPanelMinimized = false;
    ensureFloatingPanel();
    await renderFloatingPanel();
    console.log('[Maps_Empresas] Painel flutuante aberto.');
    return makeResponse('Painel flutuante aberto.');
  }

  function isGoogleMapsPage() {
    return ['www.google.com', 'www.google.com.br'].includes(location.hostname) && location.pathname.startsWith('/maps');
  }

  function ensureFloatingPanel() {
    if (state.floatingPanel?.isConnected) return state.floatingPanel;

    const panel = document.createElement('section');
    panel.id = 'maps-empresas-floating-panel';
    panel.setAttribute('aria-live', 'polite');
    panel.style.cssText = [
      'position: fixed',
      'right: 16px',
      'bottom: 16px',
      'width: min(340px, calc(100vw - 32px))',
      'z-index: 2147483647',
      'box-sizing: border-box',
      'font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'color: #172033',
      'background: #ffffff',
      'border: 1px solid #dbe3ef',
      'border-radius: 18px',
      'box-shadow: 0 18px 44px rgba(15, 23, 42, 0.22)',
      'overflow: hidden'
    ].join(';');
    document.body.appendChild(panel);
    state.floatingPanel = panel;
    return panel;
  }

  async function renderFloatingPanel() {
    const panel = ensureFloatingPanel();
    await loadSession();

    if (state.floatingPanelMinimized) {
      panel.innerHTML = '';
      panel.style.width = 'auto';
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.textContent = `Maps_Empresas • ${state.leads.length} leads`;
      tab.style.cssText = 'border: 0; padding: 12px 14px; border-radius: 999px; color: #fff; background: #2563eb; font-weight: 800; cursor: pointer; box-shadow: none;';
      tab.addEventListener('click', () => {
        state.floatingPanelMinimized = false;
        renderFloatingPanel();
      });
      panel.appendChild(tab);
      return;
    }

    panel.style.width = 'min(340px, calc(100vw - 32px))';
    panel.innerHTML = `
      <div style="padding: 14px 14px 12px; background: linear-gradient(135deg, #1d4ed8, #0891b2); color: #fff;">
        <strong style="display:block; font-size: 16px;">Maps_Empresas 2.0</strong>
        <span style="display:block; margin-top: 4px; font-size: 12px; opacity: .9;">Painel flutuante do Google Maps</span>
      </div>
      <div style="display:grid; grid-template-columns: 1fr auto; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #e2e8f0;">
        <div><span style="display:block; color:#64748b; font-size: 11px; font-weight: 800; text-transform: uppercase;">Status</span><strong>${escapeHtml(state.status || 'Aguardando')}</strong></div>
        <div><span style="display:block; color:#64748b; font-size: 11px; font-weight: 800; text-transform: uppercase;">Empresas</span><strong>${state.leads.length}</strong></div>
      </div>
      <div style="padding: 12px 14px;">
        <p style="min-height: 36px; margin: 0 0 10px; padding: 9px 10px; border: 1px solid #bfdbfe; border-radius: 12px; color:#1e3a8a; background:#eff6ff; font-size: 12px; line-height: 1.35;">${escapeHtml(state.lastMessage || 'Abra ou mantenha o Maps nesta aba e escolha uma ação.')}</p>
        <div data-role="lead-preview" style="margin-bottom: 10px; padding: 9px 10px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc;">${renderLeadPreview()}</div>
        <div style="margin-bottom: 10px;">
          <strong style="display:block; margin-bottom: 6px; color:#475569; font-size: 11px; text-transform: uppercase;">Modo de varredura</strong>
          <div data-role="scan-mode-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 6px;"></div>
        </div>
        <div data-role="field-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;"></div>
        <div data-role="action-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;"></div>
      </div>
    `;

    const scanModeGrid = panel.querySelector('[data-role="scan-mode-grid"]');
    Object.entries(ASSISTED_SCAN_MODES).forEach(([mode, config]) => {
      scanModeGrid.appendChild(createScanModeButton(mode, config.label));
    });

    const fieldGrid = panel.querySelector('[data-role="field-grid"]');
    [
      ['listContainer', 'Selecionar lista lateral'],
      ['name', 'Selecionar nome'],
      ['phone', 'Selecionar telefone'],
      ['address', 'Selecionar endereço'],
      ['website', 'Selecionar site']
    ].forEach(([field, label]) => {
      fieldGrid.appendChild(createPanelButton(state.fieldMap[field] ? `✓ ${label}` : label, () => selectField(field), Boolean(state.fieldMap[field])));
    });

    const actionGrid = panel.querySelector('[data-role="action-grid"]');
    actionGrid.appendChild(createPanelButton('Iniciar captura visível', startVisibleCapture, false, '#15803d'));
    actionGrid.appendChild(createPanelButton('Iniciar varredura assistida', startAssistedScan, false, '#2563eb'));
    actionGrid.appendChild(createPanelButton('Pausar', pauseCapture));
    actionGrid.appendChild(createPanelButton('Limpar', clearData, false, '#dc2626'));
    actionGrid.appendChild(createPanelButton('Minimizar', () => {
      state.floatingPanelMinimized = true;
      renderFloatingPanel();
    }));
  }

  function createScanModeButton(mode, label) {
    const button = document.createElement('button');
    const selected = state.assistedScanMode === mode;
    button.type = 'button';
    button.textContent = selected ? `✓ ${label}` : label;
    button.style.cssText = [
      'min-height: 32px',
      'padding: 6px 8px',
      `border: 1px solid ${selected ? '#2563eb' : '#dbe3ef'}`,
      'border-radius: 10px',
      `color: ${selected ? '#1e3a8a' : '#172033'}`,
      `background: ${selected ? '#dbeafe' : '#ffffff'}`,
      'font-size: 12px',
      'font-weight: 800',
      'cursor: pointer'
    ].join(';');
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        await setAssistedScanMode(mode);
      } catch (error) {
        console.error('[Maps_Empresas] Erro ao executar ação do painel:', error);
        await syncSession('Erro', 'Erro ao executar ação no painel. Veja o console para detalhes.');
      }
    });
    return button;
  }

  function createPanelButton(label, handler, selected = false, background = '#ffffff') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    const isFilled = background !== '#ffffff';
    button.style.cssText = [
      'min-height: 38px',
      'padding: 8px 10px',
      `border: 1px solid ${selected ? '#16a34a' : '#dbe3ef'}`,
      'border-radius: 12px',
      `color: ${isFilled ? '#ffffff' : selected ? '#166534' : '#172033'}`,
      `background: ${selected ? '#ecfdf5' : background}`,
      'font-size: 12px',
      'font-weight: 800',
      'cursor: pointer'
    ].join(';');
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      try {
        await handler();
      } catch (error) {
        console.error('[Maps_Empresas] Erro ao executar ação do painel:', error);
        await syncSession('Erro', 'Erro ao executar ação no painel. Veja o console para detalhes.');
      }
    });
    return button;
  }

  function getAssistedScanModeConfig() {
    return ASSISTED_SCAN_MODES[state.assistedScanMode] || ASSISTED_SCAN_MODES.medium;
  }

  async function setAssistedScanMode(mode) {
    if (!ASSISTED_SCAN_MODES[mode]) return;

    state.assistedScanMode = mode;
    const config = getAssistedScanModeConfig();
    state.assistedScanOptions = {
      ...state.assistedScanOptions,
      maxSteps: config.maxSteps,
      intervalMs: Math.max(1000, config.intervalMs),
      maxUnchangedSteps: config.maxUnchangedSteps
    };
    await syncSession(state.status || 'Aguardando', `Modo de varredura definido: ${config.label}.`);
  }

  // Executa varredura assistida com rolagem moderada apenas no container lateral selecionado/encontrado.
  async function startAssistedScan() {
    const container = getAssistedListContainer();
    if (!container) {
      return syncSession('Aguardando', 'Selecione a lista lateral ou aguarde os resultados do Maps antes de iniciar a varredura assistida.');
    }

    const modeConfig = getAssistedScanModeConfig();
    state.trainingMode = false;
    state.selectingField = null;
    state.captureEnabled = true;
    state.assistedScanEnabled = true;
    state.assistedScanOptions = {
      ...state.assistedScanOptions,
      maxSteps: modeConfig.maxSteps,
      intervalMs: Math.max(1000, modeConfig.intervalMs),
      maxUnchangedSteps: modeConfig.maxUnchangedSteps,
      currentStep: 0,
      unchangedSteps: 0,
      lastLeadCount: state.leads.length,
      lastScrollTop: container.scrollTop,
      noScrollSteps: 0
    };
    stopObserver();
    removeSelectionListeners();
    removeHighlight();
    resetTrainingCursor();
    console.log('[Maps_Empresas] Varredura assistida iniciada.');
    await syncSession('Varredura assistida', 'Varredura assistida iniciada. A lista lateral será rolada de forma controlada.');
    runAssistedScanStep();
    return makeResponse('Varredura assistida iniciada.');
  }

  async function runAssistedScanStep() {
    if (!state.assistedScanEnabled || !state.captureEnabled) return;

    const options = state.assistedScanOptions;
    const container = getAssistedListContainer();
    if (!container) {
      await stopAssistedScan('Lista lateral não encontrada. Varredura assistida pausada.');
      return;
    }

    if (options.currentStep >= options.maxSteps || options.unchangedSteps >= options.maxUnchangedSteps) {
      await stopAssistedScan('Varredura assistida finalizada pelos limites de segurança.', true);
      return;
    }

    console.log('[Maps_Empresas] Container de varredura:', container);
    const scrollBefore = container.scrollTop;
    const leadCountBefore = state.leads.length;
    await scanPage('Varredura assistida', 'Varredura assistida capturou os dados visíveis e rolou a lista lateral.', false);

    const scrollAmount = Math.max(220, Math.floor(container.clientHeight * 0.8));
    container.scrollTop = scrollBefore + scrollAmount;
    await wait(350);
    const scrollAfter = container.scrollTop;
    const hasNewLeads = state.leads.length > options.lastLeadCount;
    const hasScrolled = scrollAfter > scrollBefore;

    options.currentStep += 1;
    options.noScrollSteps = hasScrolled ? 0 : (options.noScrollSteps || 0) + 1;
    options.unchangedSteps = hasNewLeads || hasScrolled ? 0 : options.unchangedSteps + 1;
    options.lastLeadCount = state.leads.length;
    options.lastScrollTop = scrollAfter;

    console.log('[Maps_Empresas] Scroll realizado:', scrollAfter);
    console.log('[Maps_Empresas] Scroll antes/depois:', scrollBefore, scrollAfter);
    console.log('[Maps_Empresas] Leads antes/depois:', leadCountBefore, state.leads.length);
    await syncSession('Varredura assistida', `Varredura em andamento: etapa ${options.currentStep}/${options.maxSteps}, leads: ${state.leads.length}.`);

    if (options.currentStep >= 2 && options.noScrollSteps >= 2) {
      await stopAssistedScan('Fim provável da lista lateral detectado.', true);
      return;
    }

    state.assistedScanTimer = setTimeout(runAssistedScanStep, options.intervalMs);
  }

  async function stopAssistedScan(message, showSummary = false) {
    state.captureEnabled = false;
    state.assistedScanEnabled = false;
    stopAssistedScanTimer();
    stopObserver();
    console.log('[Maps_Empresas] Varredura assistida pausada.');
    await syncSession('Pausado', showSummary ? `Varredura pausada. Total capturado: ${state.leads.length} empresas.` : message);
  }

  function stopAssistedScanTimer() {
    if (state.assistedScanTimer) clearTimeout(state.assistedScanTimer);
    state.assistedScanTimer = null;
  }

  function getAssistedListContainer() {
    const trainedData = state.fieldMap.listContainer || {};
    const trained = getElementFromTraining('listContainer', document);
    if (isScrollableContainer(trained)) return trained;

    const trainedScrollableParent = findScrollableParent(trained);
    if (trainedScrollableParent) return trainedScrollableParent;

    const trainedScrollable = safeQuery(document, trainedData.scrollableSelector);
    if (isScrollableContainer(trainedScrollable)) return trainedScrollable;

    const trainedContainer = safeQuery(document, trainedData.containerSelector);
    if (isScrollableContainer(trainedContainer)) return trainedContainer;

    const containerScrollableParent = findScrollableParent(trainedContainer);
    if (containerScrollableParent) return containerScrollableParent;

    return getListContainers().find(isScrollableContainer) || null;
  }

  function findScrollableParent(element) {
    let current = element;

    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const canScroll = current.scrollHeight > current.clientHeight + 20;
      const overflowY = style.overflowY;

      if (canScroll && ['auto', 'scroll', 'overlay'].includes(overflowY)) {
        return current;
      }

      if (canScroll && current.getAttribute('role') === 'feed') {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  function isScrollableContainer(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    const canScroll = element.scrollHeight > element.clientHeight + 20;
    const hasScrollableOverflow = ['auto', 'scroll', 'overlay'].includes(style.overflowY);
    return Boolean(canScroll && (hasScrollableOverflow || element.getAttribute('role') === 'feed'));
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function setTrainingCursor() {
    if (!state.previousBodyCursor) state.previousBodyCursor = document.body.style.cursor || '';
    document.body.style.cursor = 'crosshair';
  }

  function resetTrainingCursor() {
    if (state.previousBodyCursor !== undefined) document.body.style.cursor = state.previousBodyCursor || '';
    state.previousBodyCursor = '';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  function renderLeadPreview() {
    const recentLeads = state.leads.slice(-5).reverse();
    const items = recentLeads.length
      ? recentLeads.map((lead) => `<li style="margin: 3px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(getLeadPreviewLabel(lead))}</li>`).join('')
      : '<li style="margin: 3px 0; color:#64748b;">Nenhum lead capturado ainda.</li>';

    return `
      <strong style="display:block; margin-bottom: 5px; color:#475569; font-size: 11px; text-transform: uppercase;">Últimos capturados</strong>
      <ul style="margin:0; padding-left: 16px; font-size: 12px; line-height: 1.35;">${items}</ul>
    `;
  }

  function getLeadPreviewLabel(lead) {
    return normalizeText(lead?.name || lead?.phone || 'Lead sem nome');
  }

  // Centraliza o tratamento de falhas do storage temporário e avisa a UI quando ela está aberta.
  async function reportStorageError(error) {
    console.error('[Maps_Empresas] Erro de storage:', error);
    const message = 'Não foi possível acessar os dados temporários da extensão. Atualize a extensão e recarregue o Google Maps.';

    try {
      await chrome.storage.session.set({
        [SESSION_KEYS.leads]: state.leads,
        [SESSION_KEYS.fieldMap]: state.fieldMap,
        [SESSION_KEYS.status]: 'Aguardando',
        [SESSION_KEYS.lastMessage]: message
      });
    } catch (storageError) {
      console.error('[Maps_Empresas] Erro de storage:', storageError);
    }

    chrome.runtime.sendMessage({
      type: 'STORAGE_ERROR',
      message
    }).catch(() => {});
    return { ok: false, message };
  }

  // Gera seletores curtos priorizando atributos semânticos e evitando caminhos gigantes html > body.
  function buildSmartSelector(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';

    const candidates = [];
    const tag = element.tagName.toLowerCase();
    const stableAttributes = ['aria-label', 'data-item-id', 'data-value', 'role', 'href'];

    if (element.id && !looksGenerated(element.id)) candidates.push(`#${cssEscape(element.id)}`);

    stableAttributes.forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value && value.length < 90) candidates.push(`${tag}[${attr}="${cssEscape(value)}"]`);
    });

    const stableClasses = [...element.classList].filter((className) => !looksGenerated(className)).slice(0, 3);
    if (stableClasses.length) candidates.push(`${tag}.${stableClasses.map(cssEscape).join('.')}`);
    candidates.push(tag);

    const unique = candidates.find((selector) => isUniqueSelector(selector, element));
    if (unique) return unique;

    const parts = [];
    let current = element;
    while (current && current !== document.body && parts.length < 5) {
      const currentTag = current.tagName.toLowerCase();
      const attr = ['aria-label', 'role', 'data-item-id'].find((name) => current.getAttribute(name));
      if (attr) {
        parts.unshift(`${currentTag}[${attr}="${cssEscape(current.getAttribute(attr))}"]`);
      } else {
        const classes = [...current.classList].filter((className) => !looksGenerated(className)).slice(0, 2);
        parts.unshift(classes.length ? `${currentTag}.${classes.map(cssEscape).join('.')}` : `${currentTag}:nth-of-type(${getIndexAmongSameTag(current)})`);
      }
      const selector = parts.join(' > ');
      if (selector.length < 220 && isUniqueSelector(selector, element)) return selector;
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  function getRelativePath(element, root) {
    if (!element || !root || element === root) return '';
    const parts = [];
    let current = element;
    while (current && current !== root && parts.length < 6) {
      parts.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${getIndexAmongSameTag(current)})`);
      current = current.parentElement;
    }
    return parts.join(' > ');
  }

  function highlightElement(element) {
    if (!element || element === state.highlightedElement || element.closest?.('#maps-empresas-floating-panel')) return;
    removeHighlight();
    state.highlightedElement = element;
    element.dataset.mapsEmpresasPreviousOutline = element.style.outline || '';
    element.dataset.mapsEmpresasPreviousCursor = element.style.cursor || '';
    element.style.outline = '3px solid #2563eb';
    element.style.outlineOffset = '2px';
    element.style.cursor = 'crosshair';
  }

  function removeHighlight() {
    if (!state.highlightedElement) return;
    const element = state.highlightedElement;
    element.style.outline = element.dataset.mapsEmpresasPreviousOutline || '';
    element.style.cursor = element.dataset.mapsEmpresasPreviousCursor || '';
    delete element.dataset.mapsEmpresasPreviousOutline;
    delete element.dataset.mapsEmpresasPreviousCursor;
    state.highlightedElement = null;
  }

  function handleSelectionMouseOver(event) {
    if (!state.selectingField) return;
    highlightElement(event.target);
  }

  function handleSelectionMouseOut() {
    if (!state.selectingField) return;
    removeHighlight();
  }

  async function handleSelectionClick(event) {
    if (!state.selectingField || event.target.closest?.('#maps-empresas-floating-panel')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const element = event.target;
    const container = findNearestContainer(element);
    const selectedField = state.selectingField;
    const scrollableParent = selectedField === 'listContainer'
      ? findScrollableParent(element)
      : null;
    state.fieldMap[selectedField] = {
      exampleText: normalizeText(element.innerText || element.textContent || '').slice(0, 220),
      tagName: element.tagName,
      selector: buildSmartSelector(element),
      relativePath: getRelativePath(element, container),
      approximateIndex: getApproximateIndex(element, container),
      containerSelector: container ? buildSmartSelector(container) : '',
      scrollableSelector: scrollableParent ? buildSmartSelector(scrollableParent) : '',
      scrollableTagName: scrollableParent ? scrollableParent.tagName : '',
      scrollableExampleText: scrollableParent ? normalizeText(scrollableParent.innerText || '').slice(0, 220) : '',
      savedAt: new Date().toISOString()
    };

    const successMessage = `Campo selecionado com sucesso: ${FIELD_LABELS[selectedField]}`;
    const response = await syncSession('Aguardando', successMessage);
    if (!response.ok) return;

    console.log('[Maps_Empresas] Campo selecionado:', selectedField);
    chrome.runtime.sendMessage({
      type: 'FIELD_SELECTED',
      field: selectedField,
      message: successMessage
    }).catch(() => {});
    state.selectingField = null;
    removeSelectionListeners();
    removeHighlight();
  }

  // Observa mudanças visíveis do Maps com debounce para evitar captura agressiva.
  function startObserver() {
    stopObserver();
    state.observer = new MutationObserver(() => {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(scanPage, 1000);
    });
    state.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function stopObserver() {
    if (state.observer) state.observer.disconnect();
    state.observer = null;
    clearTimeout(state.debounceTimer);
  }

  function removeSelectionListeners() {
    document.removeEventListener('mouseover', handleSelectionMouseOver, true);
    document.removeEventListener('mouseout', handleSelectionMouseOut, true);
    document.removeEventListener('click', handleSelectionClick, true);
    resetTrainingCursor();
  }

  function getListContainers() {
    const trained = getElementFromTraining('listContainer', document);
    const candidates = [
      trained,
      document.querySelector('[role="feed"]'),
      document.querySelector('[aria-label*="Resultados"]'),
      document.querySelector('[aria-label*="results"]'),
      document.querySelector('div[role="main"]')
    ].filter(Boolean);
    return [...new Set(candidates)];
  }

  function getCandidateCards(container) {
    const selectors = ['[role="article"]', '[role="feed"] > div', 'a[href*="/maps/place/"]'];
    const cards = selectors.flatMap((selector) => [...container.querySelectorAll(selector)]);
    const filtered = cards.filter((item) => normalizeText(item.innerText || item.textContent || '').length > 8);
    return filtered.length ? [...new Set(filtered)] : [container];
  }

  // Combina o treinamento visual com fallback por texto para resistir a mudanças do DOM do Maps.
  function extractUsingTraining(root) {
    const pick = (field) => {
      const trained = state.fieldMap[field];
      if (!trained) return '';
      const byRelative = trained.relativePath ? safeQuery(root, trained.relativePath) : null;
      const bySelector = trained.selector ? safeQuery(root, trained.selector) || safeQuery(document, trained.selector) : null;
      const text = normalizeText((byRelative || bySelector)?.innerText || (byRelative || bySelector)?.textContent || '');
      return text || fallbackByExample(root, trained.exampleText);
    };

    return {
      name: pick('name'),
      phone: extractPhones(pick('phone'))[0] || pick('phone'),
      address: pick('address'),
      website: extractWebsite(pick('website')) || pick('website')
    };
  }

  function getElementFromTraining(field, root) {
    const trained = state.fieldMap[field];
    if (!trained) return null;
    return safeQuery(root, trained.selector) || safeQuery(document, trained.selector);
  }

  function findName(element, lines) {
    const heading = element.querySelector('h1, h2, h3, [role="heading"]');
    const headingText = normalizeText(heading?.innerText || heading?.textContent || '');
    if (headingText) return headingText.split('\n')[0];
    return lines.find((line) => !extractPhones(line).length && !extractWebsite(line) && line.length > 2 && line.length < 90) || '';
  }

  function findAddress(lines) {
    return lines.find((line) => ADDRESS_HINT_REGEX.test(line) && line.length < 180) || '';
  }

  function findRating(text) {
    const match = normalizeText(text).match(RATING_REGEX);
    return match ? match[1].replace(',', '.') : '';
  }

  function findReviewCount(text) {
    const match = normalizeText(text).match(REVIEW_COUNT_REGEX);
    return match ? match[1] : '';
  }

  function findCategory(lines, name, address, phone) {
    return lines.find((line) => line !== name && line !== address && line !== phone && !extractPhones(line).length && !extractWebsite(line) && line.length > 2 && line.length < 60) || '';
  }

  function extractWebsiteFromLinks(element) {
    const links = [...element.querySelectorAll('a[href]')].map((link) => link.href).filter((href) => !href.includes('google.') && !href.includes('/maps/'));
    return links.map(cleanWebsite).find(Boolean) || '';
  }

  function fallbackByExample(root, exampleText) {
    const example = normalizeText(exampleText);
    if (!example || example.length < 3) return '';
    const firstWords = example.split(' ').slice(0, 4).join(' ');
    const textNodeElement = [...root.querySelectorAll('a, span, div, button')].find((node) => normalizeText(node.innerText || node.textContent || '').includes(firstWords));
    return normalizeText(textNodeElement?.innerText || textNodeElement?.textContent || '');
  }

  function findNearestContainer(element) {
    return element.closest('[role="article"], [role="main"], [role="feed"], [aria-label]') || document.body;
  }

  function getApproximateIndex(element, root) {
    if (!root) return 0;
    return [...root.querySelectorAll(element.tagName.toLowerCase())].indexOf(element);
  }

  function isLikelyBrazilianPhone(phone) {
    const digits = onlyDigits(phone).replace(/^55/, '');
    return digits.length === 10 || digits.length === 11;
  }

  function cleanWebsite(value) {
    return String(value || '').replace(/[),.;]+$/, '').trim();
  }

  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function slug(value) {
    return normalizeText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  }

  function safeQuery(root, selector) {
    if (!root || !selector) return null;
    try { return root.querySelector(selector); } catch (_error) { return null; }
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/(["\\#.;:[\]>+~*'=])/g, '\\$1');
  }

  function looksGenerated(value) {
    return !value || value.length > 36 || /^[a-zA-Z]{1,3}\d{2,}$/.test(value) || /[A-Z0-9_-]{10,}/.test(value);
  }

  function isUniqueSelector(selector, element) {
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === element;
    } catch (_error) {
      return false;
    }
  }

  function getIndexAmongSameTag(element) {
    if (!element.parentElement) return 1;
    return [...element.parentElement.children].filter((child) => child.tagName === element.tagName).indexOf(element) + 1;
  }

  function makeResponse(message) {
    return {
      ok: true,
      message,
      leadCount: state.leads.length,
      status: state.captureEnabled ? 'Capturando' : state.trainingMode && state.selectingField ? `Treinando: selecione o campo ${FIELD_LABELS[state.selectingField]}` : undefined
    };
  }
})();

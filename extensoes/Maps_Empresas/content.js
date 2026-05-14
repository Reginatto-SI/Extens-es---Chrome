(() => {
  const SESSION_KEYS = {
    leads: 'mapsEmpresasLeads',
    fieldMap: 'mapsEmpresasFieldMap',
    status: 'mapsEmpresasStatus',
    lastMessage: 'mapsEmpresasLastMessage'
  };

  const state = {
    trainingMode: false,
    selectingField: null,
    captureEnabled: false,
    leads: [],
    fieldMap: {},
    observer: null,
    debounceTimer: null,
    highlightedElement: null
  };

  const FIELD_LABELS = {
    listContainer: 'lista lateral',
    name: 'nome',
    phone: 'telefone',
    address: 'endereço',
    website: 'site'
  };

  const PHONE_REGEX = /(?:\+55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s]?\d{4}\b/g;
  const WEBSITE_REGEX = /(?:https?:\/\/)?(?:www\.)?[\w.-]+\.(?:com\.br|com|net\.br|net|org\.br|org|br)(?:\/[\w\-.~:/?#[\]@!$&'()*+,;=%]*)?/gi;
  const RATING_REGEX = /\b([1-5][,.][0-9])\b/;
  const REVIEW_COUNT_REGEX = /(?:\(|\b)(\d{1,3}(?:\.\d{3})*|\d+)(?:\)|\s+avalia(?:ç|c)(?:ões|oes))/i;
  const ADDRESS_HINT_REGEX = /(rua|avenida|av\.?|rodovia|travessa|praça|praca|alameda|estrada|bairro|cep|nº|numero|número)/i;

  // Restaura apenas o estado de sessão; não há banco, backend ou storage permanente.
  loadSession();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      switch (message?.type) {
        case 'START_TRAINING':
          return startTraining();
        case 'SELECT_FIELD':
          return selectField(message.fieldName);
        case 'START_CAPTURE':
          return startCapture();
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

  function startTraining() {
    state.trainingMode = true;
    state.selectingField = null;
    state.captureEnabled = false;
    stopObserver();
    return syncSession('Aguardando', 'Treinamento iniciado. Escolha um campo para selecionar.');
  }

  function selectField(fieldName) {
    if (!FIELD_LABELS[fieldName]) {
      return Promise.resolve({ ok: false, message: 'Campo inválido para treinamento.' });
    }

    state.trainingMode = true;
    state.selectingField = fieldName;
    removeHighlight();
    document.addEventListener('mouseover', handleSelectionMouseOver, true);
    document.addEventListener('mouseout', handleSelectionMouseOut, true);
    document.addEventListener('click', handleSelectionClick, true);
    return syncSession(`Treinando: selecione o campo ${FIELD_LABELS[fieldName]}`, `Clique no elemento de ${FIELD_LABELS[fieldName]} no Google Maps.`);
  }

  async function startCapture() {
    state.trainingMode = false;
    state.selectingField = null;
    state.captureEnabled = true;
    removeSelectionListeners();
    removeHighlight();
    startObserver();
    await scanPage();
    return syncSession('Capturando', 'Captura iniciada. Role a lista manualmente para encontrar mais empresas.');
  }

  function pauseCapture() {
    state.captureEnabled = false;
    stopObserver();
    return syncSession('Pausado', 'Captura pausada.');
  }

  function clearData() {
    state.leads = [];
    state.fieldMap = {};
    state.captureEnabled = false;
    state.trainingMode = false;
    state.selectingField = null;
    stopObserver();
    removeSelectionListeners();
    removeHighlight();
    return chrome.storage.session.set({
      [SESSION_KEYS.leads]: [],
      [SESSION_KEYS.fieldMap]: {},
      [SESSION_KEYS.status]: 'Aguardando',
      [SESSION_KEYS.lastMessage]: 'Dados limpos com sucesso.'
    }).then(() => makeResponse('Dados limpos com sucesso.'));
  }

  async function scanPage() {
    if (!state.captureEnabled) return;
    scanListContainer();
    scanDetailsPanel();
    await syncSession('Capturando', 'Captura atualizada com os dados visíveis.');
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

  function syncSession(status, message) {
    return chrome.storage.session.set({
      [SESSION_KEYS.leads]: state.leads,
      [SESSION_KEYS.fieldMap]: state.fieldMap,
      [SESSION_KEYS.status]: status || 'Aguardando',
      [SESSION_KEYS.lastMessage]: message || ''
    }).then(() => makeResponse(message || 'OK'));
  }

  async function loadSession() {
    const data = await chrome.storage.session.get(Object.values(SESSION_KEYS));
    state.leads = Array.isArray(data[SESSION_KEYS.leads]) ? data[SESSION_KEYS.leads] : [];
    state.fieldMap = data[SESSION_KEYS.fieldMap] && typeof data[SESSION_KEYS.fieldMap] === 'object' ? data[SESSION_KEYS.fieldMap] : {};
    return state;
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
    if (!element || element === state.highlightedElement) return;
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

  function handleSelectionClick(event) {
    if (!state.selectingField) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const element = event.target;
    const container = findNearestContainer(element);
    const fieldName = state.selectingField;
    state.fieldMap[fieldName] = {
      exampleText: normalizeText(element.innerText || element.textContent || '').slice(0, 220),
      tagName: element.tagName,
      selector: buildSmartSelector(element),
      relativePath: getRelativePath(element, container),
      approximateIndex: getApproximateIndex(element, container),
      containerSelector: container ? buildSmartSelector(container) : '',
      savedAt: new Date().toISOString()
    };

    state.selectingField = null;
    removeSelectionListeners();
    removeHighlight();
    syncSession('Aguardando', 'Campo selecionado com sucesso.');
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

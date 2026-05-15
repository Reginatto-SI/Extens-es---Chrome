const SESSION_KEYS = {
  leads: 'mapsEmpresasLeads',
  fieldMap: 'mapsEmpresasFieldMap',
  status: 'mapsEmpresasStatus',
  lastMessage: 'mapsEmpresasLastMessage',
  targetTabId: 'mapsEmpresasTargetTabId'
};

const elements = {
  statusText: document.getElementById('statusText'),
  leadCount: document.getElementById('leadCount'),
  message: document.getElementById('message'),
  targetTabText: document.getElementById('targetTabText'),
  startTraining: document.getElementById('startTraining'),
  startCapture: document.getElementById('startCapture'),
  pauseCapture: document.getElementById('pauseCapture'),
  exportCsv: document.getElementById('exportCsv'),
  clearData: document.getElementById('clearData'),
  fieldButtons: [...document.querySelectorAll('[data-field]')]
};

const CSV_COLUMNS = [
  ['name', 'Nome'],
  ['phone', 'Telefone'],
  ['address', 'Endereco'],
  ['website', 'Site'],
  ['rating', 'Avaliacao'],
  ['reviewCount', 'QtdAvaliacoes'],
  ['category', 'Categoria'],
  ['url', 'URL'],
  ['capturedAt', 'CapturadoEm']
];

const TARGETED_START_COMMANDS = new Set(['START_TRAINING', 'START_CAPTURE']);

const FIELD_LABELS = {
  listContainer: 'lista lateral',
  name: 'nome',
  phone: 'telefone',
  address: 'endereço',
  website: 'site'
};

document.addEventListener('DOMContentLoaded', initializePopup);

// Recebe confirmações e erros enviados pelo content script enquanto o popup está aberto.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'FIELD_SELECTED') {
    setMessage(message.message || 'Campo selecionado com sucesso.');
    refreshFromSession();
    updateTargetTabStatus();
  }

  if (message?.type === 'STORAGE_ERROR') {
    setMessage(message.message || 'Erro ao acessar os dados temporários da extensão.');
  }
});

async function initializePopup() {
  prepareFieldButtons();
  await refreshFromSession();
  bindActions();
  await updateTargetTabStatus();
}

function prepareFieldButtons() {
  elements.fieldButtons.forEach((button) => {
    button.classList.add('field-button');
    button.dataset.defaultText = button.textContent;
  });
}

function bindActions() {
  elements.startTraining.addEventListener('click', () => sendToMapsTab({ type: 'START_TRAINING' }));
  elements.startCapture.addEventListener('click', () => sendToMapsTab({ type: 'START_CAPTURE' }));
  elements.pauseCapture.addEventListener('click', () => sendToMapsTab({ type: 'PAUSE_CAPTURE' }));
  elements.clearData.addEventListener('click', clearData);
  elements.exportCsv.addEventListener('click', exportCsv);

  elements.fieldButtons.forEach((button) => {
    button.addEventListener('click', () => sendToMapsTab({ type: 'SELECT_FIELD', fieldName: button.dataset.field }));
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isGoogleMapsUrl(url = '') {
  try {
    const parsed = new URL(url);
    return ['www.google.com', 'www.google.com.br'].includes(parsed.hostname) && parsed.pathname.startsWith('/maps');
  } catch (_error) {
    return false;
  }
}

async function getSavedTargetTabId() {
  const data = await chrome.storage.session.get(SESSION_KEYS.targetTabId);
  return Number.isInteger(data[SESSION_KEYS.targetTabId]) ? data[SESSION_KEYS.targetTabId] : null;
}

async function getTabById(tabId) {
  if (!Number.isInteger(tabId)) return null;
  try {
    return await chrome.tabs.get(tabId);
  } catch (_error) {
    return null;
  }
}

async function getTargetMapsTab() {
  const savedTabId = await getSavedTargetTabId();

  if (savedTabId) {
    const savedTab = await getTabById(savedTabId);
    if (!savedTab) {
      return {
        ok: false,
        message: 'A aba do Google Maps usada na captura foi fechada. Abra o Maps novamente.'
      };
    }

    if (!isGoogleMapsUrl(savedTab.url)) {
      return {
        ok: false,
        message: 'A aba do Google Maps usada na captura não está mais no Maps. Abra o Maps novamente.'
      };
    }

    return { ok: true, tab: savedTab, source: 'saved' };
  }

  const activeTab = await getActiveTab();
  if (activeTab?.id && isGoogleMapsUrl(activeTab.url)) {
    return { ok: true, tab: activeTab, source: 'active' };
  }

  return {
    ok: false,
    message: 'Abra o Google Maps antes de iniciar.'
  };
}

// Todas as ações operam na aba alvo do Google Maps e são iniciadas manualmente pelo usuário.
async function sendToMapsTab(message) {
  const target = await getTargetMapsTab();
  if (!target.ok) {
    setMessage(target.message);
    await updateTargetTabStatus();
    return;
  }

  if (TARGETED_START_COMMANDS.has(message.type)) {
    await chrome.storage.session.set({ [SESSION_KEYS.targetTabId]: target.tab.id });
  }

  try {
    const response = await sendMessageToTab(target.tab, message);
    if (!response?.ok) {
      setMessage(response?.message || 'Não foi possível executar a ação.');
      return;
    }
    setMessage(response.message || 'Ação concluída.');
    await refreshFromSession();
    await updateTargetTabStatus();
  } catch (error) {
    console.error('[Maps_Empresas] Falha ao enviar comando:', error);
    setMessage('Recarregue a aba do Google Maps e tente novamente.');
  }
}

async function sendMessageToTab(tab, message, retryMissingContentScript = true) {
  console.log('[Maps_Empresas] Enviando comando:', message.type, 'para aba', tab.id);

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    if (retryMissingContentScript && isMissingContentScriptError(error)) {
      await injectContentScript(tab.id);
      console.log('[Maps_Empresas] Content script injetado; reenviando comando:', message.type);
      return sendMessageToTab(tab, message, false);
    }

    throw error;
  }
}

function isMissingContentScriptError(error) {
  return String(error?.message || '').includes('Receiving end does not exist');
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

async function refreshFromSession() {
  const data = await chrome.storage.session.get(Object.values(SESSION_KEYS));
  const leads = Array.isArray(data[SESSION_KEYS.leads]) ? data[SESSION_KEYS.leads] : [];
  const fieldMap = data[SESSION_KEYS.fieldMap] && typeof data[SESSION_KEYS.fieldMap] === 'object' ? data[SESSION_KEYS.fieldMap] : {};
  elements.leadCount.textContent = String(leads.length);
  elements.statusText.textContent = data[SESSION_KEYS.status] || 'Aguardando';
  setMessage(data[SESSION_KEYS.lastMessage] || 'Abra o Google Maps antes de iniciar.');
  updateFieldButtons(fieldMap);
}

function updateFieldButtons(fieldMap) {
  elements.fieldButtons.forEach((button) => {
    const fieldName = button.dataset.field;
    const isSelected = Boolean(fieldMap[fieldName]);
    button.classList.toggle('is-selected', isSelected);
    const defaultText = button.dataset.defaultText || button.textContent;
    button.textContent = isSelected ? `Selecionado: ${FIELD_LABELS[fieldName] || fieldName}` : defaultText;
  });
}

async function updateTargetTabStatus() {
  const savedTabId = await getSavedTargetTabId();
  const savedTab = await getTabById(savedTabId);
  const isSavedMapsTab = Boolean(savedTab?.id && isGoogleMapsUrl(savedTab.url));
  elements.targetTabText.textContent = isSavedMapsTab ? 'Aba alvo: Google Maps ativa' : 'Aba alvo: não definida';
}

// Exportação local, sem bibliotecas externas, usando separador amigável ao Excel em português.
async function exportCsv() {
  const data = await chrome.storage.session.get(SESSION_KEYS.leads);
  const leads = Array.isArray(data[SESSION_KEYS.leads]) ? data[SESSION_KEYS.leads] : [];
  if (!leads.length) {
    setMessage('Nenhuma empresa capturada ainda.');
    return;
  }

  const header = CSV_COLUMNS.map(([, label]) => label).join(';');
  const rows = leads.map((lead) => CSV_COLUMNS.map(([key]) => escapeCsvValue(lead[key])).join(';'));
  const csv = `\ufeff${[header, ...rows].join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Maps_Empresas_leads_${formatDateForFile(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setMessage('CSV exportado com sucesso.');
}

async function clearData() {
  const target = await getTargetMapsTab();

  if (target.ok) {
    try {
      await sendMessageToTab(target.tab, { type: 'CLEAR_DATA' });
    } catch (_error) {
      setMessage('Não foi possível avisar a aba do Maps, mas a sessão da extensão foi limpa.');
    }
  }

  await chrome.storage.session.remove(SESSION_KEYS.targetTabId);
  await chrome.storage.session.set({
    [SESSION_KEYS.leads]: [],
    [SESSION_KEYS.fieldMap]: {},
    [SESSION_KEYS.status]: 'Aguardando',
    [SESSION_KEYS.lastMessage]: 'Dados limpos com sucesso.'
  });
  await refreshFromSession();
  await updateTargetTabStatus();
}

function escapeCsvValue(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatDateForFile(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function setMessage(message) {
  elements.message.textContent = message;
}

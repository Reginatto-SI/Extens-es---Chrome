const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const fileList = document.getElementById("fileList");
const selectFilesBtn = document.getElementById("selectFilesBtn");
const mergeBtn = document.getElementById("mergeBtn");
const statusMessage = document.getElementById("statusMessage");
const versionBadge = document.getElementById("versionBadge");
const progressWrapper = document.getElementById("progressWrapper");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");
const consoleLog = document.getElementById("consoleLog");
const clearConsoleBtn = document.getElementById("clearConsoleBtn");
const completionModal = document.getElementById("completionModal");
const modalSummary = document.getElementById("modalSummary");
const modalDownloadBtn = document.getElementById("modalDownloadBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const headerRowInput = document.getElementById("headerRowInput");
const divergencePanel = document.getElementById("divergencePanel");
const divergenceList = document.getElementById("divergenceList");

let selectedFiles = [];
let mergedWorkbook = null;
let isProcessing = false;
let processedFilesCount = 0;
let mergedRowsCount = 0;

const defaultMergeLabel = "Unificar arquivos";

versionBadge.textContent = `v${chrome.runtime.getManifest().version}`;
addLog(`Extensão iniciada - v${chrome.runtime.getManifest().version}`);
addLog(`Versão carregada: ${chrome.runtime.getManifest().version}`);

chrome.storage.local.set({
  extensionVersion: chrome.runtime.getManifest().version,
  extensionUpdatedAt: new Date().toISOString()
});

selectFilesBtn.addEventListener("click", () => fileInput.click());
clearConsoleBtn.addEventListener("click", () => {
  consoleLog.innerHTML = "";
  addLog("Console limpo pelo usuário.", "warning");
});

fileInput.addEventListener("change", (event) => {
  setFiles(Array.from(event.target.files));
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("active");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("active"));

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("active");
  const files = Array.from(event.dataTransfer.files);
  setFiles(files);
});

mergeBtn.addEventListener("click", async () => {
  if (isProcessing) return;

  if (!selectedFiles.length) {
    setStatus("Selecione ao menos um arquivo .xlsx para unificar.", "error");
    addLog("Tentativa de processar sem arquivos selecionados.", "warning");
    return;
  }

  const headerRowNumber = Number(headerRowInput.value);
  if (!Number.isInteger(headerRowNumber) || headerRowNumber < 1) {
    setStatus("Informe uma linha de cabeçalho válida (mínimo 1).", "error");
    addLog("Linha de cabeçalho inválida informada.", "error");
    return;
  }

  startProcessingState();
  addLog("Iniciando processamento.");
  hideDivergences();

  try {
    const validationResult = await window.ExcelUtils.validateFilesHeaders(selectedFiles, headerRowNumber, (message, type = "info") => {
      addLog(message, type);
    });

    if (!validationResult.valid) {
      mergedWorkbook = null;
      processedFilesCount = 0;
      mergedRowsCount = 0;
      updateProgress("Validação interrompeu a unificação", 0);
      setStatus("Arquivos com divergência de colunas. Corrija antes de unificar.", "error");
      addLog("Unificação bloqueada por divergência de colunas.", "error");
      renderDivergences(validationResult.invalidFiles);
      return;
    }

    addLog("Validação de colunas concluída: todos os arquivos seguem o padrão.", "success");

    const rows = await window.ExcelUtils.readFilesAsRows(selectedFiles, ({ current, total, percent, fileName }) => {
      processedFilesCount = current;
      addLog(`Processando ${fileName}.`);
      updateProgress(`Processando ${fileName} — ${current} de ${total} arquivos (${percent}%)`, percent);
      addLog(`${fileName} processado com sucesso.`, "success");
    });

    mergedWorkbook = window.ExcelUtils.generateWorkbookFromRows(rows);
    mergedRowsCount = rows.length;

    if (mergedWorkbook && selectedFiles.length > 0 && mergedRowsCount > 0) {
      updateProgress("100% - Concluído", 100);
      setStatus("Arquivo pronto para download.", "success");
      addLog("Conclusão da unificação.", "success");
      openCompletionModal();
    } else {
      mergedWorkbook = null;
      setStatus("Não foi possível concluir a unificação: nenhum dado válido foi consolidado.", "error");
      addLog("Unificação sem dados válidos: modal de sucesso não exibido.", "warning");
    }
  } catch (error) {
    mergedWorkbook = null;
    if (!processedFilesCount) {
      updateProgress("Erro antes do processamento dos arquivos", 0);
    }
    setStatus(`Erro ao processar arquivos: ${error.message || "falha inesperada."}`, "error");
    addLog(`Erro ao processar arquivo: ${error.message || "falha inesperada."}`, "error");
  } finally {
    finishProcessingState();
  }
});

modalDownloadBtn.addEventListener("click", handleDownload);
closeModalBtn.addEventListener("click", closeCompletionModal);
completionModal.addEventListener("click", (event) => {
  if (event.target === completionModal) {
    closeCompletionModal();
  }
});

function handleDownload() {
  if (!mergedWorkbook) {
    setStatus("Nenhum arquivo gerado para download.", "error");
    addLog("Download bloqueado: arquivo consolidado não encontrado.", "error");
    return;
  }

  addLog("Download iniciado.", "success");
  window.ExcelUtils.downloadWorkbook(mergedWorkbook, "planilhas-unificadas.xlsx");
}

function setFiles(files) {
  if (isProcessing) return;

  selectedFiles = files.filter((file) => file.name.toLowerCase().endsWith(".xlsx"));
  mergedWorkbook = null;
  processedFilesCount = 0;
  mergedRowsCount = 0;
  hideDivergences();
  closeCompletionModal();
  resetProgress();
  renderFileList();

  if (!selectedFiles.length) {
    setStatus("Nenhum arquivo .xlsx válido selecionado.", "error");
    addLog("Nenhum arquivo .xlsx válido selecionado.", "warning");
    return;
  }

  setStatus(`${selectedFiles.length} arquivo(s) carregado(s) para unificação.`, "");
  addLog(`${selectedFiles.length} arquivo(s) selecionado(s).`);
}

function renderFileList() {
  fileList.innerHTML = "";
  selectedFiles.forEach((file) => {
    const item = document.createElement("li");
    item.textContent = file.name;
    fileList.appendChild(item);
  });
}

function renderDivergences(invalidFiles) {
  divergenceList.innerHTML = "";

  invalidFiles.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "divergenceItem";
    const differencesPreview = entry.result.differences.slice(0, 3).map((difference) => {
      const position = difference.index + 1;
      if (difference.type === "different") {
        return `Coluna ${position}: esperado \"${difference.expected}\" e encontrado \"${difference.found}\"`;
      }
      if (difference.type === "extra") {
        return `Coluna extra na posição ${position}: \"${difference.found}\"`;
      }
      return `Coluna ausente na posição ${position}: esperado \"${difference.expected}\"`;
    });

    item.innerHTML = `
      <strong>${entry.fileName}</strong>
      <div>Tipo: divergência de estrutura de colunas</div>
      <div>Colunas esperadas: ${entry.result.expectedColumns} • Colunas encontradas: ${entry.result.foundColumns}</div>
      <ul>${differencesPreview.map((text) => `<li>${text}</li>`).join("")}</ul>
    `;
    divergenceList.appendChild(item);
  });

  divergencePanel.classList.remove("hidden");
}

function hideDivergences() {
  divergenceList.innerHTML = "";
  divergencePanel.classList.add("hidden");
}

function setStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = "statusMessage";
  if (type) statusMessage.classList.add(type);
}

function updateProgress(message, percent) {
  progressWrapper.classList.remove("hidden");
  progressText.textContent = message;
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
}

function resetProgress() {
  progressWrapper.classList.add("hidden");
  progressText.textContent = "Aguardando processamento...";
  progressPercent.textContent = "0%";
  progressFill.style.width = "0%";
}

function startProcessingState() {
  // Bloqueio do botão para evitar múltiplos cliques durante processamento.
  isProcessing = true;
  mergeBtn.disabled = true;
  mergeBtn.textContent = "Processando...";
  processedFilesCount = 0;
  updateProgress("0% - Iniciando processamento", 0);
}

function finishProcessingState() {
  isProcessing = false;
  mergeBtn.disabled = false;
  mergeBtn.textContent = defaultMergeLabel;
}

// Console interno para diagnóstico simples de processamento.
function addLog(message, type = "info") {
  const time = new Date().toLocaleTimeString("pt-BR");
  const line = document.createElement("div");
  line.className = `logLine ${type}`;
  line.textContent = `[${time}] ${message}`;
  consoleLog.appendChild(line);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

// Modal de conclusão como ponto principal do download após sucesso.
function openCompletionModal() {
  modalSummary.textContent = `Arquivos processados: ${processedFilesCount} • Linhas consolidadas: ${mergedRowsCount}`;
  completionModal.classList.remove("hidden");
}

function closeCompletionModal() {
  completionModal.classList.add("hidden");
}

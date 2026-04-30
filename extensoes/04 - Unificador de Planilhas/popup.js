const modelInput = document.getElementById("modelInput");
const modelFileName = document.getElementById("modelFileName");
const selectModelBtn = document.getElementById("selectModelBtn");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const fileList = document.getElementById("fileList");
const selectFilesBtn = document.getElementById("selectFilesBtn");
const mergeBtn = document.getElementById("mergeBtn");
const blockOnDivergenceInput = document.getElementById("blockOnDivergenceInput");
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

let modelFile = null;
let selectedFiles = [];
let mergedWorkbook = null;
let isProcessing = false;
let processedFilesCount = 0;
let mergedRowsCount = 0;

const defaultMergeLabel = "Unificar arquivos";

versionBadge.textContent = `v${chrome.runtime.getManifest().version}`;
addLog(`Extensão iniciada - v${chrome.runtime.getManifest().version}`);

selectModelBtn.addEventListener("click", () => modelInput.click());
selectFilesBtn.addEventListener("click", () => fileInput.click());

clearConsoleBtn.addEventListener("click", () => {
  consoleLog.innerHTML = "";
  addLog("Console limpo pelo usuário.", "warning");
});

modelInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file || !file.name.toLowerCase().endsWith(".xlsx")) {
    modelFile = null;
    modelFileName.textContent = "Nenhum arquivo modelo selecionado.";
    addLog("Arquivo modelo inválido ignorado.", "warning");
    return;
  }
  modelFile = file;
  modelFileName.textContent = file.name;
  addLog(`Arquivo modelo selecionado: ${file.name}`);
  setStatus("Arquivo modelo selecionado. Agora escolha os arquivos para unificar.", "");
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
  setFiles(Array.from(event.dataTransfer.files));
});

mergeBtn.addEventListener("click", async () => {
  if (isProcessing) return;

  if (!modelFile) {
    setStatus("Selecione um arquivo modelo .xlsx antes de unificar.", "error");
    addLog("Validação bloqueada: arquivo modelo não selecionado.", "error");
    return;
  }

  if (!selectedFiles.length) {
    setStatus("Selecione ao menos um arquivo .xlsx para unificar.", "error");
    addLog("Validação bloqueada: nenhum arquivo para unificação.", "error");
    return;
  }

  const headerRowNumber = Number(headerRowInput.value);
  if (!Number.isInteger(headerRowNumber) || headerRowNumber < 1) {
    setStatus("Informe uma linha de cabeçalho válida (mínimo 1).", "error");
    addLog("Linha de cabeçalho inválida informada.", "error");
    return;
  }

  startProcessingState();
  hideDivergences();
  addLog(`Início da validação com arquivo modelo: ${modelFile.name}`);
  addLog(`Quantidade de arquivos para unificar: ${selectedFiles.length}`);
  addLog(`Linha de cabeçalho usada: ${headerRowNumber}`);

  try {
    const validationResult = await window.ExcelUtils.validateFilesHeaders(modelFile, selectedFiles, headerRowNumber, (message, type = "info") => {
      addLog(message, type);
    });

    if (!validationResult.valid) {
      renderDivergences(validationResult.invalidFiles);
      if (blockOnDivergenceInput.checked) {
        mergedWorkbook = null;
        setStatus("Arquivos com divergência de colunas. Corrija antes de unificar.", "error");
        addLog("Unificação bloqueada por divergência de colunas.", "error");
        updateProgress("Unificação bloqueada por divergência", 0);
        return;
      }

      addLog("Divergências detectadas, porém unificação permitida por configuração.", "warning");
      setStatus("Divergências detectadas. Unificação continuará com alerta.", "");
    }

    const rows = await window.ExcelUtils.readFilesAsRows(selectedFiles, ({ current, total, percent, fileName }) => {
      processedFilesCount = current;
      updateProgress(`Processando ${fileName} — ${current} de ${total} arquivos (${percent}%)`, percent);
      addLog(`${fileName} processado com sucesso.`, "success");
    });

    mergedWorkbook = window.ExcelUtils.generateWorkbookFromRows(rows);
    mergedRowsCount = rows.length;

    if (mergedWorkbook && mergedRowsCount > 0) {
      updateProgress("100% - Concluído", 100);
      setStatus("Arquivo pronto para download.", "success");
      addLog("Conclusão da unificação.", "success");
      openCompletionModal();
    } else {
      mergedWorkbook = null;
      setStatus("Não foi possível concluir a unificação: nenhum dado válido foi consolidado.", "error");
      addLog("Unificação sem dados válidos.", "warning");
    }
  } catch (error) {
    mergedWorkbook = null;
    setStatus(`Erro ao processar arquivos: ${error.message || "falha inesperada."}`, "error");
    addLog(`Erro ao processar arquivo: ${error.message || "falha inesperada."}`, "error");
  } finally {
    finishProcessingState();
  }
});

modalDownloadBtn.addEventListener("click", handleDownload);
closeModalBtn.addEventListener("click", closeCompletionModal);
completionModal.addEventListener("click", (event) => {
  if (event.target === completionModal) closeCompletionModal();
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
  resetProgress();
  closeCompletionModal();
  hideDivergences();
  renderFileList();

  if (!selectedFiles.length) {
    setStatus("Nenhum arquivo .xlsx válido selecionado para unificação.", "error");
    addLog("Nenhum arquivo .xlsx válido para unificação.", "warning");
    return;
  }

  setStatus(`${selectedFiles.length} arquivo(s) selecionado(s) para unificação.`, "");
  addLog(`${selectedFiles.length} arquivo(s) selecionado(s) para unificar.`);
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
    const preview = entry.result.differences.slice(0, 5).map((difference) => {
      const position = difference.index + 1;
      if (difference.type === "different") {
        return `Coluna ${position}: esperado "${difference.expected}" e encontrado "${difference.found}"`;
      }
      if (difference.type === "extra") {
        return `Coluna extra na posição ${position}: "${difference.found}"`;
      }
      return `Coluna ausente na posição ${position}: esperado "${difference.expected}"`;
    });

    const additional = entry.result.differences.length - preview.length;
    item.innerHTML = `
      <strong>${entry.fileName}</strong>
      <div>Colunas esperadas: ${entry.result.expectedColumns}</div>
      <div>Colunas encontradas: ${entry.result.foundColumns}</div>
      <ul>${preview.map((text) => `<li>${text}</li>`).join("")}</ul>
      ${additional > 0 ? `<div class="extraDiff">+ ${additional} divergências adicionais não exibidas</div>` : ""}
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

function addLog(message, type = "info") {
  const time = new Date().toLocaleTimeString("pt-BR");
  const line = document.createElement("div");
  line.className = `logLine ${type}`;
  line.textContent = `[${time}] ${message}`;
  consoleLog.appendChild(line);
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

function openCompletionModal() {
  modalSummary.textContent = `Arquivos processados: ${processedFilesCount} • Linhas consolidadas: ${mergedRowsCount}`;
  completionModal.classList.remove("hidden");
}

function closeCompletionModal() {
  completionModal.classList.add("hidden");
}

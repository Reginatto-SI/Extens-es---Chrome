const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const fileList = document.getElementById("fileList");
const selectFilesBtn = document.getElementById("selectFilesBtn");
const mergeBtn = document.getElementById("mergeBtn");
const downloadBtn = document.getElementById("downloadBtn");
const statusMessage = document.getElementById("statusMessage");
const versionBadge = document.getElementById("versionBadge");
const progressWrapper = document.getElementById("progressWrapper");
const progressText = document.getElementById("progressText");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");

let selectedFiles = [];
let mergedWorkbook = null;
let isProcessing = false;

const defaultMergeLabel = "Unificar arquivos";

versionBadge.textContent = `v${chrome.runtime.getManifest().version}`;
chrome.storage.local.set({
  extensionVersion: chrome.runtime.getManifest().version,
  extensionUpdatedAt: new Date().toISOString()
});

selectFilesBtn.addEventListener("click", () => fileInput.click());
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
    return;
  }

  startProcessingState();

  try {
    setStatus("Iniciando processamento dos arquivos...", "");

    const rows = await window.ExcelUtils.readFilesAsRows(selectedFiles, ({ current, total, percent, fileName }) => {
      updateProgress(`Processando ${fileName} — ${current} de ${total} arquivos (${percent}%)`, percent);
    });

    mergedWorkbook = window.ExcelUtils.generateWorkbookFromRows(rows);
    downloadBtn.disabled = false;
    setStatus("Unificação concluída com sucesso. Arquivo pronto para download.", "success");
  } catch (error) {
    mergedWorkbook = null;
    downloadBtn.disabled = true;
    setStatus(`Erro ao processar arquivos: ${error.message || "falha inesperada."}`, "error");
  } finally {
    finishProcessingState();
  }
});

downloadBtn.addEventListener("click", () => {
  if (!mergedWorkbook) {
    setStatus("Nenhum arquivo gerado para download.", "error");
    return;
  }

  window.ExcelUtils.downloadWorkbook(mergedWorkbook, "planilhas-unificadas.xlsx");
});

function setFiles(files) {
  if (isProcessing) return;

  // Regra obrigatória: aceitar apenas arquivos .xlsx.
  selectedFiles = files.filter((file) => file.name.toLowerCase().endsWith(".xlsx"));
  mergedWorkbook = null;
  downloadBtn.disabled = true;
  resetProgress();
  renderFileList();

  if (!selectedFiles.length) {
    setStatus("Nenhum arquivo .xlsx válido selecionado.", "error");
    return;
  }

  setStatus(`${selectedFiles.length} arquivo(s) carregado(s) para unificação.`, "");
}

function renderFileList() {
  fileList.innerHTML = "";
  selectedFiles.forEach((file) => {
    const item = document.createElement("li");
    item.textContent = file.name;
    fileList.appendChild(item);
  });
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
  // Bloqueia clique duplicado e deixa explícito que a unificação está em andamento.
  isProcessing = true;
  mergeBtn.disabled = true;
  mergeBtn.textContent = "Processando...";
  downloadBtn.disabled = true;
  updateProgress("Iniciando processamento dos arquivos...", 0);
}

function finishProcessingState() {
  isProcessing = false;
  mergeBtn.disabled = false;
  mergeBtn.textContent = defaultMergeLabel;
}

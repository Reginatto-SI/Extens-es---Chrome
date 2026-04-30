const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const fileList = document.getElementById("fileList");
const selectFilesBtn = document.getElementById("selectFilesBtn");
const mergeBtn = document.getElementById("mergeBtn");
const downloadBtn = document.getElementById("downloadBtn");
const statusMessage = document.getElementById("statusMessage");
const versionBadge = document.getElementById("versionBadge");

let selectedFiles = [];
let mergedWorkbook = null;

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
  if (!selectedFiles.length) {
    setStatus("Selecione ao menos um arquivo .xlsx para unificar.", "error");
    return;
  }

  try {
    setStatus("Processando arquivos...", "");
    const rows = await window.ExcelUtils.readFilesAsRows(selectedFiles);
    mergedWorkbook = window.ExcelUtils.generateWorkbookFromRows(rows);
    downloadBtn.disabled = false;
    setStatus("Unificação concluída com sucesso.", "success");
  } catch (error) {
    mergedWorkbook = null;
    downloadBtn.disabled = true;
    setStatus(error.message || "Erro ao processar arquivos.", "error");
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
  // Regra obrigatória: aceitar apenas arquivos .xlsx.
  selectedFiles = files.filter((file) => file.name.toLowerCase().endsWith(".xlsx"));
  mergedWorkbook = null;
  downloadBtn.disabled = true;
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

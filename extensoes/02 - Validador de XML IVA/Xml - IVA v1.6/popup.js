const state = {
  allResults: [],
  filteredResults: [],
  analysisType: "",
  ignoredFiles: 0,
  showTaxValues: false
};

document.addEventListener("DOMContentLoaded", () => {
  const els = {
    dropzone: document.getElementById("dropzone"),
    filesInput: document.getElementById("filesInput"),
    folderInput: document.getElementById("folderInput"),
    filesTrigger: document.getElementById("filesTrigger"),
    folderTrigger: document.getElementById("folderTrigger"),
    analysisType: document.getElementById("analysisType"),
    modeSummary: document.getElementById("modeSummary"),
    resultsBody: document.getElementById("resultsBody"),
    totalCount: document.getElementById("totalCount"),
    okCount: document.getElementById("okCount"),
    errorCount: document.getElementById("errorCount"),
    filteredCount: document.getElementById("filteredCount"),
    filteredIbsTotal: document.getElementById("filteredIbsTotal"),
    filteredCbsTotal: document.getElementById("filteredCbsTotal"),
    totalsPanel: document.getElementById("totalsPanel"),
    searchInput: document.getElementById("searchInput"),
    startDate: document.getElementById("startDate"),
    endDate: document.getElementById("endDate"),
    onlyErrorsToggle: document.getElementById("onlyErrorsToggle"),
    showTaxValuesToggle: document.getElementById("showTaxValuesToggle"),
    copyKeysBtn: document.getElementById("copyKeysBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    exportPdfBtn: document.getElementById("exportPdfBtn"),
    clearBtn: document.getElementById("clearBtn"),
    lastRun: document.getElementById("lastRun"),
    printMeta: document.getElementById("printMeta"),
    xmlModal: document.getElementById("xmlModal"),
    xmlModalBackdrop: document.getElementById("xmlModalBackdrop"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    xmlContent: document.getElementById("xmlContent"),
    xmlModalMeta: document.getElementById("xmlModalMeta"),
    analysisBadge: document.getElementById("analysisBadge"),
    keyColumnTitle: document.getElementById("keyColumnTitle")
  };

  bindEvents(els);
  syncAnalysisModeUi(els);
  updateAnalysisBadge(els);
  renderTable(els);
  updateStats(els);
  updateFilteredTotals(els);
  syncTotalsVisibility(els);
});

function bindEvents(els) {
  els.analysisType.addEventListener("change", () => {
    state.analysisType = els.analysisType.value;
    resetStateAndUi(els);
    syncAnalysisModeUi(els);
    updateAnalysisBadge(els);
  });

  els.filesInput.addEventListener("change", async (e) => {
    await handleSelectedFiles(e.target.files, els);
    e.target.value = "";
  });

  els.folderInput.addEventListener("change", async (e) => {
    await handleSelectedFiles(e.target.files, els);
    e.target.value = "";
  });

  els.dropzone.addEventListener("dragover", (e) => {
    if (!isAnalysisTypeSelected()) return;
    e.preventDefault();
    els.dropzone.classList.add("dragover");
  });

  els.dropzone.addEventListener("dragleave", () => {
    els.dropzone.classList.remove("dragover");
  });

  els.dropzone.addEventListener("drop", async (e) => {
    if (!isAnalysisTypeSelected()) return;
    e.preventDefault();
    els.dropzone.classList.remove("dragover");
    await handleSelectedFiles(e.dataTransfer.files, els);
  });

  els.searchInput.addEventListener("input", () => {
    applyFilters(els);
  });

  els.startDate.addEventListener("change", () => {
    applyFilters(els);
  });

  els.endDate.addEventListener("change", () => {
    applyFilters(els);
  });

  els.onlyErrorsToggle.addEventListener("change", () => {
    applyFilters(els);
  });

  els.showTaxValuesToggle.addEventListener("change", () => {
    state.showTaxValues = els.showTaxValuesToggle.checked;
    syncTotalsVisibility(els);
    renderTable(els);
    updateFilteredTotals(els);
  });

  els.copyKeysBtn.addEventListener("click", async () => {
    const keys = state.filteredResults
      .filter((item) => !item.ok && item.chave)
      .map((item) => item.chave);

    if (!keys.length) {
      alert("Nenhuma chave com erro para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(keys.join("\n"));
      alert(`Copiadas ${keys.length} chave(s) com erro.`);
    } catch (error) {
      console.error("Erro ao copiar chaves:", error);
      alert("Não foi possível copiar as chaves.");
    }
  });

  els.exportCsvBtn.addEventListener("click", () => {
    exportCsv(state.filteredResults);
  });

  els.exportPdfBtn.addEventListener("click", () => {
    exportPdf(els);
  });

  els.clearBtn.addEventListener("click", () => {
    resetStateAndUi(els);
    updateAnalysisBadge(els);
  });

  els.closeModalBtn.addEventListener("click", () => {
    closeXmlModal(els);
  });

  els.xmlModalBackdrop.addEventListener("click", () => {
    closeXmlModal(els);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeXmlModal(els);
    }
  });
}

function resetStateAndUi(els) {
  state.allResults = [];
  state.filteredResults = [];
  state.ignoredFiles = 0;
  state.showTaxValues = false;

  els.searchInput.value = "";
  els.startDate.value = "";
  els.endDate.value = "";
  els.onlyErrorsToggle.checked = true;
  els.showTaxValuesToggle.checked = false;
  els.lastRun.textContent = "Sem análise";

  if (els.printMeta) {
    els.printMeta.textContent = "";
  }

  closeXmlModal(els);
  updateAnalysisBadge(els);
  renderTable(els);
  updateStats(els);
  updateFilteredTotals(els);
  syncTotalsVisibility(els);
}

function isAnalysisTypeSelected() {
  return Boolean(state.analysisType);
}

function syncAnalysisModeUi(els) {
  const enabled = isAnalysisTypeSelected();

  els.filesInput.disabled = !enabled;
  els.folderInput.disabled = !enabled;

  els.dropzone.classList.toggle("disabled", !enabled);
  els.filesTrigger.classList.toggle("disabled", !enabled);
  els.folderTrigger.classList.toggle("disabled", !enabled);

  if (!enabled) {
    els.modeSummary.textContent = "Selecione o tipo de análise para liberar a importação dos XMLs.";
    return;
  }

  els.modeSummary.textContent =
    state.analysisType === "emitidas"
      ? "Modo ativo: validação de impostos para Notas Emitidas."
      : "Modo ativo: validação de impostos para Notas Recebidas.";
}

function updateAnalysisBadge(els) {
  const label = formatAnalysisType(state.analysisType);
  els.analysisBadge.textContent = `Tipo de análise: ${label}`;
  els.keyColumnTitle.textContent =
    label && label !== "-"
      ? `Chave NF-e (${label})`
      : "Chave NF-e";
}

function syncTotalsVisibility(els) {
  els.totalsPanel.classList.toggle("hidden", !state.showTaxValues);
}

async function handleSelectedFiles(fileList, els) {
  if (!isAnalysisTypeSelected()) {
    alert("Selecione primeiro o tipo de análise.");
    return;
  }

  const files = Array.from(fileList || []).filter((file) =>
    file.name.toLowerCase().endsWith(".xml")
  );

  if (!files.length) {
    alert("Nenhum arquivo XML válido foi selecionado.");
    return;
  }

  const parsedResults = [];
  let ignoredFiles = 0;

  for (const [index, file] of files.entries()) {
    if (index > 0 && index % 20 === 0) {
      await pauseToKeepUiResponsive();
    }

    try {
      const text = await file.text();

      if (!cleanText(text)) {
        ignoredFiles += 1;
        continue;
      }

      const result = parseNFeXml(
        text,
        file.webkitRelativePath || file.name,
        state.analysisType
      );

      if (!result) {
        ignoredFiles += 1;
        continue;
      }

      parsedResults.push(result);
    } catch (error) {
      console.error(`Erro ao processar ${file.name}:`, error);

      parsedResults.push(
        buildErrorResult({
          fileName: file.webkitRelativePath || file.name,
          analysisType: state.analysisType,
          problemas: [`Erro ao processar arquivo: ${error.message || error}`]
        })
      );
    }
  }

  state.allResults = parsedResults;
  state.ignoredFiles = ignoredFiles;

  els.lastRun.textContent = `Analisado em ${formatDateTime(new Date())}`;
  applyFilters(els);

  if (!parsedResults.length && ignoredFiles > 0) {
    alert("Os arquivos selecionados foram ignorados porque não continham uma NF-e utilizável.");
  }
}

function pauseToKeepUiResponsive() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function parseNFeXml(xmlText, fileName, analysisType) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  const parserError = xml.querySelector("parsererror");
  if (parserError) {
    throw new Error("XML inválido ou malformado.");
  }

  const infNFe = findFirstByLocalName(xml, "infNFe");

  if (!infNFe) {
    return null;
  }

  const ide = findFirstChildByLocalName(infNFe, "ide");
  const emit = findFirstChildByLocalName(infNFe, "emit");
  const dest = findFirstChildByLocalName(infNFe, "dest");

  const chave = cleanText((infNFe.getAttribute("Id") || "").replace(/^NFe/i, ""));
  const emitente = getTextByLocalName(emit, "xNome");
  const destinatario = getTextByLocalName(dest, "xNome");
  const natureza = getTextByLocalName(ide, "natOp");

  const dataEmissaoRaw =
    getTextByLocalName(ide, "dhEmi") ||
    getTextByLocalName(ide, "dEmi");

  const dataEmissao = formatNFeDateForDisplay(dataEmissaoRaw);
  const dataEmissaoFiltro = formatNFeDateForFilter(dataEmissaoRaw);

  const dets = findAllByLocalName(infNFe, "det");
  const cfops = [
    ...new Set(
      dets
        .map((det) => getTextByLocalName(det, "CFOP"))
        .filter(Boolean)
    )
  ];

  const taxAmounts = extractTaxAmounts(infNFe);
  const taxDetection = detectTaxTags(infNFe, taxAmounts);

  const problemas = [];

  if (!emitente) problemas.push("Emitente não encontrado.");
  if (!destinatario) problemas.push("Destinatário não encontrado.");
  if (!natureza) problemas.push("Natureza da operação não encontrada.");
  if (!chave) problemas.push("Chave da NF-e não encontrada.");
  if (!dataEmissao) problemas.push("Data de emissão não encontrada.");
  if (!cfops.length) problemas.push("Nenhum CFOP encontrado.");
  if (!taxDetection.hasBoth) problemas.push(taxDetection.message);

  const possuiAlgumDadoPrincipal =
    Boolean(chave) ||
    Boolean(emitente) ||
    Boolean(destinatario) ||
    Boolean(natureza) ||
    Boolean(dataEmissao) ||
    cfops.length > 0;

  if (!possuiAlgumDadoPrincipal) {
    return null;
  }

  return {
    ok: problemas.length === 0,
    tipoAnalise: formatAnalysisType(analysisType),
    analysisType,
    chave,
    dataEmissao,
    dataEmissaoRaw,
    dataEmissaoFiltro,
    emitente,
    destinatario,
    arquivo: fileName,
    natureza,
    cfops,
    tributos: taxDetection.hasBoth ? "Encontrado" : "Não encontrado",
    hasIBS: taxDetection.hasIBS,
    hasCBS: taxDetection.hasCBS,
    ibsValue: taxAmounts.ibsValue,
    cbsValue: taxAmounts.cbsValue,
    ibsValueFormatted: formatCurrencyBr(taxAmounts.ibsValue),
    cbsValueFormatted: formatCurrencyBr(taxAmounts.cbsValue),
    problemas,
    xmlOriginal: xmlText
  };
}

function detectTaxTags(root, taxAmounts = { ibsValue: 0, cbsValue: 0 }) {
  const hasIBS =
    hasAnyTag(root, ["IBS"]) ||
    hasAnyTag(root, ["gIBS"]) ||
    hasAnyTag(root, ["vIBS"]) ||
    hasAnyTag(root, ["vIBSUF"]) ||
    hasAnyTag(root, ["vIBSMun"]) ||
    hasAnyTag(root, ["CSTIBS"]) ||
    taxAmounts.ibsValue > 0;

  const hasCBS =
    hasAnyTag(root, ["CBS"]) ||
    hasAnyTag(root, ["gCBS"]) ||
    hasAnyTag(root, ["vCBS"]) ||
    hasAnyTag(root, ["CSTCBS"]) ||
    taxAmounts.cbsValue > 0;

  const hasCombinedGroup = hasAnyTag(root, ["IBSCBS", "IBSCBSTot"]);

  if (hasCombinedGroup || (hasIBS && hasCBS)) {
    return {
      hasIBS: true,
      hasCBS: true,
      hasBoth: true,
      message: ""
    };
  }

  if (!hasIBS && !hasCBS) {
    return {
      hasIBS: false,
      hasCBS: false,
      hasBoth: false,
      message: "Tags de IBS/CBS não encontradas."
    };
  }

  if (!hasIBS) {
    return {
      hasIBS: false,
      hasCBS: true,
      hasBoth: false,
      message: "Tag/estrutura de IBS não encontrada."
    };
  }

  return {
    hasIBS: true,
    hasCBS: false,
    hasBoth: false,
    message: "Tag/estrutura de CBS não encontrada."
  };
}

function extractTaxAmounts(infNFe) {
  const totalNode = findFirstByLocalName(infNFe, "IBSCBSTot");

  if (totalNode) {
    const totalVIBS = parseXmlNumber(getTextByLocalName(totalNode, "vIBS"));
    const totalVIBSUF = parseXmlNumber(getTextByLocalName(totalNode, "vIBSUF"));
    const totalVIBSMun = parseXmlNumber(getTextByLocalName(totalNode, "vIBSMun"));
    const totalVCBS = parseXmlNumber(getTextByLocalName(totalNode, "vCBS"));

    const ibsByTotal = Number.isFinite(totalVIBS)
      ? totalVIBS
      : sumFinite([totalVIBSUF, totalVIBSMun]);

    const cbsByTotal = Number.isFinite(totalVCBS) ? totalVCBS : 0;

    return {
      ibsValue: roundTo2(ibsByTotal),
      cbsValue: roundTo2(cbsByTotal)
    };
  }

  const detNodes = findAllByLocalName(infNFe, "det");

  let ibsSum = 0;
  let cbsSum = 0;
  let foundAny = false;

  for (const det of detNodes) {
    const impostoNode = findFirstByLocalName(det, "imposto");
    if (!impostoNode) continue;

    const itemIbsCbsNode =
      findFirstByLocalName(impostoNode, "gIBSCBS") ||
      findFirstByLocalName(impostoNode, "IBSCBS");

    if (!itemIbsCbsNode) continue;

    const itemVIBS = parseXmlNumber(getTextByLocalName(itemIbsCbsNode, "vIBS"));
    const itemVIBSUF = parseXmlNumber(getTextByLocalName(itemIbsCbsNode, "vIBSUF"));
    const itemVIBSMun = parseXmlNumber(getTextByLocalName(itemIbsCbsNode, "vIBSMun"));
    const itemVCBS = parseXmlNumber(getTextByLocalName(itemIbsCbsNode, "vCBS"));

    const itemIbsValue = Number.isFinite(itemVIBS)
      ? itemVIBS
      : sumFinite([itemVIBSUF, itemVIBSMun]);

    if (Number.isFinite(itemIbsValue)) {
      ibsSum += itemIbsValue;
      foundAny = true;
    }

    if (Number.isFinite(itemVCBS)) {
      cbsSum += itemVCBS;
      foundAny = true;
    }
  }

  if (foundAny) {
    return {
      ibsValue: roundTo2(ibsSum),
      cbsValue: roundTo2(cbsSum)
    };
  }

  return {
    ibsValue: 0,
    cbsValue: 0
  };
}

function sumFinite(values = []) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return NaN;
  return valid.reduce((acc, value) => acc + value, 0);
}

function parseXmlNumber(value) {
  const text = cleanText(value);

  if (!text) {
    return NaN;
  }

  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }

  if (/^-?\d+(,\d+)?$/.test(text)) {
    return Number(text.replace(",", "."));
  }

  const normalized = text.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function roundTo2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function buildErrorResult({ fileName, analysisType, problemas = [] }) {
  return {
    ok: false,
    tipoAnalise: formatAnalysisType(analysisType),
    analysisType,
    chave: "",
    dataEmissao: "",
    dataEmissaoRaw: "",
    dataEmissaoFiltro: "",
    emitente: "",
    destinatario: "",
    arquivo: fileName,
    natureza: "",
    cfops: [],
    tributos: "Não encontrado",
    hasIBS: false,
    hasCBS: false,
    ibsValue: 0,
    cbsValue: 0,
    ibsValueFormatted: formatCurrencyBr(0),
    cbsValueFormatted: formatCurrencyBr(0),
    problemas,
    xmlOriginal: ""
  };
}

function formatAnalysisType(value) {
  if (value === "emitidas") return "Notas Emitidas";
  if (value === "recebidas") return "Notas Recebidas";
  return "-";
}

function applyFilters(els) {
  const search = normalizeText(els.searchInput.value.trim());
  const onlyErrors = els.onlyErrorsToggle.checked;
  const startDate = els.startDate.value;
  const endDate = els.endDate.value;

  state.filteredResults = state.allResults.filter((item) => {
    const matchesError = onlyErrors ? !item.ok : true;

    const haystack = normalizeText(
      [
        item.tipoAnalise,
        item.chave,
        item.dataEmissao,
        item.emitente,
        item.destinatario,
        item.arquivo,
        item.natureza,
        (item.cfops || []).join(" "),
        item.tributos,
        item.ibsValueFormatted,
        item.cbsValueFormatted,
        (item.problemas || []).join(" ")
      ].join(" ")
    );

    const matchesSearch = !search || haystack.includes(search);
    const matchesDate = matchesDateRange(item.dataEmissaoFiltro, startDate, endDate);

    return matchesError && matchesSearch && matchesDate;
  });

  renderTable(els);
  updateStats(els);
  updateFilteredTotals(els);
  syncTotalsVisibility(els);
}

function matchesDateRange(itemDate, startDate, endDate) {
  if (!startDate && !endDate) {
    return true;
  }

  if (!itemDate) {
    return false;
  }

  if (startDate && itemDate < startDate) {
    return false;
  }

  if (endDate && itemDate > endDate) {
    return false;
  }

  return true;
}

function renderTable(els) {
  const rows = state.filteredResults;

  if (!rows.length) {
    const emptyMessage = state.allResults.length
      ? "Nenhum resultado encontrado para o filtro aplicado."
      : "Nenhum XML analisado.";

    els.resultsBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="10">${escapeHtml(emptyMessage)}</td>
      </tr>
    `;
    return;
  }

  els.resultsBody.innerHTML = rows
    .map(
      (item, index) => `
        <tr>
          <td class="col-status">
            <span class="badge ${item.ok ? "ok" : "error"}">
              ${item.ok ? "OK" : "ERRO"}
            </span>
          </td>
          <td class="key col-chave">
            <span class="key-copy" data-copy-key="${index}" title="Clique para copiar a chave">
              ${escapeHtml(item.chave || "-")}
            </span>
          </td>
          <td class="col-data">${escapeHtml(item.dataEmissao || "-")}</td>
          <td class="emitter col-emitente">${escapeHtml(item.emitente || "-")}</td>
          <td class="recipient col-destinatario">${escapeHtml(item.destinatario || "-")}</td>
          <td class="natop col-natureza">${escapeHtml(item.natureza || "-")}</td>
          <td class="col-cfop">${renderChips(item.cfops)}</td>
          <td class="col-ibs tax-cell-center">${renderSingleTax(item, "ibs")}</td>
          <td class="col-cbs tax-cell-center">${renderSingleTax(item, "cbs")}</td>
          <td class="action-cell col-acoes no-print">
            <button class="btn secondary small" data-view-xml="${index}" type="button">
              Ver XML
            </button>
          </td>
        </tr>
      `
    )
    .join("");

  bindTableActions(els);
}

function renderSingleTax(item, type) {
  if (!state.showTaxValues) {
    const ok = item.tributos === "Encontrado";
    return `<span class="badge ${ok ? "ok" : "error"}">${ok ? "OK" : "-"}</span>`;
  }

  const isIBS = type === "ibs";
  const value = isIBS ? item.ibsValue : item.cbsValue;
  const hasTax = isIBS ? item.hasIBS : item.hasCBS;

  if (!hasTax && value === 0) {
    return `<span class="tax-pill error">-</span>`;
  }

  return `<span class="tax-pill ok">${escapeHtml(formatCurrencyBr(value))}</span>`;
}

function bindTableActions(els) {
  els.resultsBody.querySelectorAll("[data-copy-key]").forEach((el) => {
    el.addEventListener("click", async () => {
      const index = Number(el.getAttribute("data-copy-key"));
      const item = state.filteredResults[index];

      if (!item || !item.chave || item.chave === "-") {
        return;
      }

      try {
        await navigator.clipboard.writeText(item.chave);
        el.classList.add("copied");
        const originalText = el.textContent;

        el.textContent = "Copiado!";

        setTimeout(() => {
          el.textContent = originalText;
          el.classList.remove("copied");
        }, 900);
      } catch (error) {
        console.error("Erro ao copiar chave:", error);
        alert("Não foi possível copiar a chave.");
      }
    });
  });

  els.resultsBody.querySelectorAll("[data-view-xml]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.getAttribute("data-view-xml"));
      const item = state.filteredResults[index];
      openXmlModal(item, els);
    });
  });
}

function openXmlModal(item, els) {
  if (!item) {
    return;
  }

  els.xmlModal.classList.remove("hidden");
  els.xmlModal.setAttribute("aria-hidden", "false");
  els.xmlContent.textContent = item.xmlOriginal || "XML não disponível.";
  els.xmlModalMeta.textContent = item.arquivo || "Arquivo sem nome";
}

function closeXmlModal(els) {
  els.xmlModal.classList.add("hidden");
  els.xmlModal.setAttribute("aria-hidden", "true");
  els.xmlContent.textContent = "";
  els.xmlModalMeta.textContent = "Arquivo selecionado";
}

function updateStats(els) {
  const total = state.allResults.length;
  const ok = state.allResults.filter((item) => item.ok).length;
  const error = total - ok;

  els.totalCount.textContent = String(total);
  els.okCount.textContent = String(ok);
  els.errorCount.textContent = String(error);
}

function updateFilteredTotals(els) {
  const filteredCount = state.filteredResults.length;
  const ibsTotal = state.filteredResults.reduce((acc, item) => acc + Number(item.ibsValue || 0), 0);
  const cbsTotal = state.filteredResults.reduce((acc, item) => acc + Number(item.cbsValue || 0), 0);

  els.filteredCount.textContent = String(filteredCount);
  els.filteredIbsTotal.textContent = formatCurrencyBr(ibsTotal);
  els.filteredCbsTotal.textContent = formatCurrencyBr(cbsTotal);
}

function renderChips(values = []) {
  if (!values.length) return "-";
  return values
    .map((value) => `<span class="tag-chip">${escapeHtml(value)}</span>`)
    .join("");
}

function findFirstByLocalName(root, localName) {
  if (!root) return null;

  const target = String(localName || "").toLowerCase();
  const nodes = root.getElementsByTagName("*");

  for (const node of nodes) {
    const name = (node.localName || node.nodeName || "").toLowerCase();
    if (name === target) {
      return node;
    }
  }

  return null;
}

function findAllByLocalName(root, localName) {
  if (!root) return [];

  const target = String(localName || "").toLowerCase();
  const nodes = root.getElementsByTagName("*");
  const matches = [];

  for (const node of nodes) {
    const name = (node.localName || node.nodeName || "").toLowerCase();
    if (name === target) {
      matches.push(node);
    }
  }

  return matches;
}

function findFirstChildByLocalName(parent, localName) {
  if (!parent) return null;

  const target = String(localName || "").toLowerCase();

  for (const node of parent.children || []) {
    const name = (node.localName || node.nodeName || "").toLowerCase();
    if (name === target) {
      return node;
    }
  }

  return null;
}

function getTextByLocalName(parent, localName) {
  if (!parent) return "";
  const node = findFirstByLocalName(parent, localName);
  return cleanText(node ? node.textContent : "");
}

function hasAnyTag(xmlDoc, tagNames = []) {
  const wanted = tagNames.map((name) => String(name).toLowerCase());
  const nodes = xmlDoc.getElementsByTagName("*");

  for (const node of nodes) {
    const name = (node.localName || node.nodeName || "").toLowerCase();
    if (wanted.includes(name)) {
      return true;
    }
  }

  return false;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatNFeDateForDisplay(value) {
  const text = cleanText(value);

  if (!text) {
    return "";
  }

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    const hasTime = text.includes("T");
    return new Intl.DateTimeFormat(
      "pt-BR",
      hasTime
        ? { dateStyle: "short", timeStyle: "short" }
        : { dateStyle: "short" }
    ).format(parsed);
  }

  const onlyDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (onlyDateMatch) {
    const [, year, month, day] = onlyDateMatch;
    return `${day}/${month}/${year}`;
  }

  return text;
}

function formatNFeDateForFilter(value) {
  const text = cleanText(value);

  if (!text) {
    return "";
  }

  const onlyDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (onlyDateMatch) {
    return `${onlyDateMatch[1]}-${onlyDateMatch[2]}-${onlyDateMatch[3]}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatCurrencyBr(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function exportCsv(rows) {
  if (!rows.length) {
    alert("Não há dados para exportar.");
    return;
  }

  const headers = [
    "status",
    "tipo_analise",
    "chave",
    "data_emissao",
    "emitente",
    "destinatario",
    "natureza",
    "cfops",
    "valor_ibs",
    "valor_cbs",
    "arquivo"
  ];

  const lines = rows.map((item) => [
    item.ok ? "OK" : "ERRO",
    item.tipoAnalise,
    item.chave,
    item.dataEmissao,
    item.emitente,
    item.destinatario,
    item.natureza,
    (item.cfops || []).join(" | "),
    formatCurrencyBr(item.ibsValue),
    formatCurrencyBr(item.cbsValue),
    item.arquivo
  ]);

  const csv = [headers, ...lines]
    .map((row) => row.map(csvEscape).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `validacao-nfe-ibs-cbs-${state.analysisType || "analise"}-${Date.now()}.csv`;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportPdf(els) {
  if (!state.filteredResults.length) {
    alert("Não há dados para gerar o PDF.");
    return;
  }

  const tipo = formatAnalysisType(state.analysisType);
  const total = state.allResults.length;
  const ok = state.allResults.filter((item) => item.ok).length;
  const erro = total - ok;
  const exibidos = state.filteredResults.length;
  const filtroErro = els.onlyErrorsToggle.checked ? "Sim" : "Não";
  const mostrarValores = els.showTaxValuesToggle.checked ? "Sim" : "Não";
  const busca = els.searchInput.value.trim() || "Sem filtro de texto";
  const dataInicial = els.startDate.value || "Sem data inicial";
  const dataFinal = els.endDate.value || "Sem data final";
  const ignorados = state.ignoredFiles || 0;
  const totalIbs = state.filteredResults.reduce((acc, item) => acc + Number(item.ibsValue || 0), 0);
  const totalCbs = state.filteredResults.reduce((acc, item) => acc + Number(item.cbsValue || 0), 0);
  const data = formatDateTime(new Date());

  els.printMeta.textContent =
    `Tipo de análise: ${tipo} | Total analisado: ${total} | OK: ${ok} | Com erro: ${erro} | ` +
    `Resultados exibidos: ${exibidos} | Mostrar só erros: ${filtroErro} | Mostrar valores IBS/CBS: ${mostrarValores} | ` +
    `Total IBS filtrado: ${formatCurrencyBr(totalIbs)} | Total CBS filtrado: ${formatCurrencyBr(totalCbs)} | ` +
    `Busca: ${busca} | Data inicial: ${dataInicial} | Data final: ${dataFinal} | ` +
    `Arquivos ignorados: ${ignorados} | Gerado em: ${data}`;

  closeXmlModal(els);

  setTimeout(() => {
    window.print();
  }, 100);
}
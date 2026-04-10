(() => {
  // Sinal para debug (o popup.html não tem mais script inline, então isso é só interno)
  window.__JM_BOOT_OK__ = true;

  const EXT_VERSION = "1.1.4";

  const STORAGE_KEY = "jm_clientes_data_v1";
  const LOGS_KEY = "jm_clientes_logs_v1";
  const MAX_LOGS = 200;

  const DEFAULT_FIELDS = [
    "Código",
    "ERP",
    "Apelido",
    "Razão Social",
    "Perfil",
    "Tributação",
    "CPF/CNPJ",
    "IE",
    "RESPONSAVEL"
  ];

  let fields = [...DEFAULT_FIELDS];
  let clients = [];
  let editingIndex = null;

  const $ = (id) => document.getElementById(id);

  function safeString(v) {
    if (v === null || v === undefined) return "";
    try { return String(v); } catch { return ""; }
  }

  function nowStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function foldText(s) {
    return safeString(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  // Remove tudo que não é letra/número (isso faz a busca ignorar pontuação e espaços)
  function stripNonAlnum(s) {
    return foldText(s).replace(/[^a-z0-9]/g, "");
  }

  // Remove tudo que não é dígito (para copiar CNPJ/IE apenas números)
  function stripNonDigits(s) {
    return safeString(s).replace(/\D/g, "");
  }

  function escapeHtml(s) {
    return safeString(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(msg) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => t.classList.add("hidden"), 1400);
  }

  function setStatus(text, type = "ok") {
    const pill = $("statusPill");
    if (!pill) return;

    pill.textContent = text;
    pill.style.background = type === "ok" ? "#eef4ff" : type === "warn" ? "#fff7e6" : "#fff5f5";
    pill.style.borderColor = type === "ok" ? "#cfe0ff" : type === "warn" ? "#ffd591" : "#ffb3b3";
    pill.style.color = type === "ok" ? "#0b3fb3" : type === "warn" ? "#874d00" : "#8a0000";
  }

  async function appendLog(level, message, extra) {
    const line = `[${nowStr()}] ${level.toUpperCase()}: ${message}${extra ? " | " + safeString(extra) : ""}`;

    try {
      const res = await chrome.storage.local.get(LOGS_KEY);
      const arr = Array.isArray(res[LOGS_KEY]) ? res[LOGS_KEY] : [];
      arr.push(line);

      const trimmed = arr.slice(Math.max(0, arr.length - MAX_LOGS));
      await chrome.storage.local.set({ [LOGS_KEY]: trimmed });
    } catch {
      // sem crash
    }

    refreshLogsUI().catch(() => {});
  }

  async function refreshLogsUI() {
    const logsText = $("logsText");
    if (!logsText) return;

    const res = await chrome.storage.local.get(LOGS_KEY);
    const arr = Array.isArray(res[LOGS_KEY]) ? res[LOGS_KEY] : [];
    logsText.textContent = arr.length ? arr.join("\n") : "Sem logs ainda.";
  }

  function hookGlobalErrors() {
    window.addEventListener("error", (e) => {
      appendLog("error", "window.error", `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
    });

    window.addEventListener("unhandledrejection", (e) => {
      const msg = e?.reason?.message || safeString(e?.reason) || "unhandledrejection";
      appendLog("error", "unhandledrejection", msg);
    });
  }

  function normalizeClient(obj) {
    const c = {};
    fields.forEach(f => c[f] = safeString(obj?.[f] ?? ""));
    // preserva campos extras do import (se existirem)
    Object.keys(obj || {}).forEach(k => {
      if (!fields.includes(k)) c[k] = safeString(obj[k]);
    });
    return c;
  }

  async function saveData() {
    await chrome.storage.local.set({ [STORAGE_KEY]: { fields, clients } });
    await appendLog("log", "Dados salvos", `clientes=${clients.length}, campos=${fields.length}`);
  }

  async function loadData() {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    const data = res?.[STORAGE_KEY];

    if (data && Array.isArray(data.fields) && Array.isArray(data.clients)) {
      fields = data.fields.length ? data.fields : [...DEFAULT_FIELDS];
      clients = data.clients.map(normalizeClient);
    } else {
      fields = [...DEFAULT_FIELDS];
      clients = [];
    }

    await appendLog("log", "Dados carregados", `clientes=${clients.length}, campos=${fields.length}`);
  }

  function render(filterText = "") {
    const head = $("tableHead");
    const body = $("tableBody");
    const empty = $("emptyState");
    if (!head || !body) return;

    head.innerHTML = `<tr>${fields.map(f => `<th>${escapeHtml(f)}</th>`).join("")}</tr>`;
    body.innerHTML = "";

    const queryRaw = (filterText || "").trim();

    // ✅ Busca ignorando pontuação
    const filtered = clients
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => {
        if (!queryRaw) return true;
        const q = stripNonAlnum(queryRaw);
        if (!q) return true;

        return Object.values(c).some(val => stripNonAlnum(val).includes(q));
      });

    if (empty) empty.classList.toggle("hidden", filtered.length > 0);

    filtered.forEach(({ c, idx }) => {
      const tr = document.createElement("tr");

      fields.forEach((fieldName) => {
        const td = document.createElement("td");
        td.textContent = safeString(c[fieldName] ?? "");
        td.title = "Clique para copiar";

        td.addEventListener("click", async () => {
          // ✅ Copiar CNPJ e IE somente números
          let textToCopy = td.textContent;
          if (["CPF/CNPJ", "IE"].includes(fieldName)) {
            textToCopy = stripNonDigits(textToCopy);
          }

          try {
            await navigator.clipboard.writeText(textToCopy);
            showToast("Copiado!");
            appendLog("log", "Copiado", `${fieldName}=${textToCopy}`);
          } catch (err) {
            showToast("Não foi possível copiar.");
            appendLog("error", "Falha ao copiar", err?.message || err);
          }
        });

        tr.appendChild(td);
      });

      tr.title = "Duplo clique para editar";
      tr.addEventListener("dblclick", () => openModal(idx));

      body.appendChild(tr);
    });
  }

  function openModal(index = null) {
    const modal = $("modal");
    const title = $("modalTitle");
    const container = $("formFields");
    const delBtn = $("deleteBtn");

    if (!modal || !title || !container) return;

    editingIndex = index;
    title.textContent = (index === null) ? "Novo Cliente" : "Editar Cliente";
    if (delBtn) delBtn.classList.toggle("hidden", index === null);

    container.innerHTML = "";

    fields.forEach((fieldName) => {
      const wrap = document.createElement("div");
      wrap.className = "formField";

      const label = document.createElement("label");
      label.textContent = fieldName;

      const input = document.createElement("input");
      input.name = fieldName;
      input.placeholder = fieldName;

      const value = (index !== null && clients[index]) ? clients[index][fieldName] : "";
      input.value = safeString(value);

      wrap.appendChild(label);
      wrap.appendChild(input);
      container.appendChild(wrap);
    });

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

    const first = container.querySelector("input");
    if (first) first.focus();

    appendLog("log", "Modal aberto", index === null ? "novo" : `editar index=${index}`);
  }

  function closeModal() {
    const modal = $("modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    editingIndex = null;
    appendLog("log", "Modal fechado");
  }

  async function checkVersion() {
    const res = await chrome.storage.local.get("lastVersion");
    const lastVersion = res.lastVersion;
    if (lastVersion !== EXT_VERSION) {
      showToast(`Atualizado para v${EXT_VERSION}`);
      await chrome.storage.local.set({ lastVersion: EXT_VERSION });
      await appendLog("log", "Versão alterada", `v=${EXT_VERSION}`);
    }
  }

  function bindEvents() {
    const addBtn = $("addBtn");
    const fieldsBtn = $("fieldsBtn");
    const exportBtn = $("exportBtn");
    const importBtn = $("importBtn");
    const importFile = $("importFile");
    const searchInput = $("searchInput");
    const closeModalBtn = $("closeModal");
    const cancelBtn = $("cancelBtn");
    const form = $("clientForm");
    const deleteBtn = $("deleteBtn");

    const toggleLogsBtn = $("toggleLogsBtn");
    const logsPanel = $("logsPanel");
    const copyLogsBtn = $("copyLogsBtn");
    const clearLogsBtn = $("clearLogsBtn");

    const openAppBtn = $("openAppBtn");

    // ✅ Abrir em tela grande (voltou a funcionar)
    if (openAppBtn) {
      openAppBtn.addEventListener("click", async () => {
        await appendLog("log", "Clique", "Abrir em tela grande");
        try {
          chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
        } catch (err) {
          showToast("Não foi possível abrir a tela grande.");
          appendLog("error", "Falha ao abrir tela grande", err?.message || err);
        }
      });
    }

    if (addBtn) addBtn.addEventListener("click", () => { appendLog("log", "Clique", "+ Novo"); openModal(null); });
    if (closeModalBtn) closeModalBtn.addEventListener("click", () => { appendLog("log", "Clique", "Fechar modal"); closeModal(); });
    if (cancelBtn) cancelBtn.addEventListener("click", () => { appendLog("log", "Clique", "Cancelar"); closeModal(); });

    const modal = $("modal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => render(e.target.value));
    }

    if (fieldsBtn) {
      fieldsBtn.addEventListener("click", async () => {
        await appendLog("log", "Clique", "Campos");
        const name = prompt("Nome do novo campo:");
        if (!name) return;
        const trimmed = name.trim();
        if (!trimmed) return;

        if (fields.includes(trimmed)) {
          showToast("Esse campo já existe.");
          appendLog("warn", "Campo já existe", trimmed);
          return;
        }

        fields.push(trimmed);
        clients = clients.map(c => ({ ...c, [trimmed]: "" }));
        await saveData();
        render(searchInput?.value || "");
        showToast("Campo adicionado.");
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {};
        new FormData(form).forEach((v, k) => (data[k] = safeString(v)));
        const normalized = normalizeClient(data);

        if (editingIndex === null) {
          clients.push(normalized);
          showToast("Cliente criado.");
          appendLog("log", "Cliente criado");
        } else {
          clients[editingIndex] = normalized;
          showToast("Cliente atualizado.");
          appendLog("log", "Cliente atualizado", `index=${editingIndex}`);
        }

        await saveData();
        closeModal();
        render(searchInput?.value || "");
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        appendLog("log", "Clique", "Excluir");
        if (editingIndex === null) return;

        const ok = confirm("Excluir este cliente?");
        if (!ok) return;

        clients.splice(editingIndex, 1);
        await saveData();
        closeModal();
        render(searchInput?.value || "");
        showToast("Cliente excluído.");
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener("click", async () => {
        appendLog("log", "Clique", "Exportar");
        try {
          const payload = { fields, clients };
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "jm-clientes-backup.json";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          showToast("Exportado.");
        } catch (err) {
          showToast("Erro ao exportar.");
          appendLog("error", "Erro ao exportar", err?.message || err);
        }
      });
    }

    if (importBtn && importFile) {
      importBtn.addEventListener("click", () => {
        appendLog("log", "Clique", "Importar");
        importFile.click();
      });

      importFile.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          const text = await file.text();
          const parsed = JSON.parse(text);

          if (!parsed || !Array.isArray(parsed.fields) || !Array.isArray(parsed.clients)) {
            showToast("Arquivo inválido.");
            appendLog("warn", "Import inválido");
            return;
          }

          fields = parsed.fields.length ? parsed.fields : [...DEFAULT_FIELDS];
          clients = parsed.clients.map(normalizeClient);

          await saveData();
          render(searchInput?.value || "");
          showToast("Importado com sucesso.");
          appendLog("log", "Importado OK", `clientes=${clients.length}, campos=${fields.length}`);
        } catch (err) {
          showToast("Erro ao importar.");
          appendLog("error", "Erro ao importar", err?.message || err);
        } finally {
          importFile.value = "";
        }
      });
    }

    // ✅ Logs (voltou a funcionar)
    if (toggleLogsBtn && logsPanel) {
      toggleLogsBtn.addEventListener("click", async () => {
        logsPanel.classList.toggle("hidden");
        await refreshLogsUI();
        appendLog("log", "Clique", "Logs (toggle)");
      });
    }

    if (copyLogsBtn) {
      copyLogsBtn.addEventListener("click", async () => {
        await refreshLogsUI();
        const text = $("logsText")?.textContent || "";
        try {
          await navigator.clipboard.writeText(text);
          showToast("Logs copiados.");
          appendLog("log", "Logs copiados");
        } catch (err) {
          showToast("Não foi possível copiar logs.");
          appendLog("error", "Falha ao copiar logs", err?.message || err);
        }
      });
    }

    if (clearLogsBtn) {
      clearLogsBtn.addEventListener("click", async () => {
        const ok = confirm("Limpar logs?");
        if (!ok) return;
        await chrome.storage.local.set({ [LOGS_KEY]: [] });
        await refreshLogsUI();
        showToast("Logs limpos.");
        appendLog("log", "Logs limpos");
      });
    }
  }

  async function boot() {
    hookGlobalErrors();

    setStatus("Status: carregando…", "warn");
    appendLog("log", "Boot iniciado");

    bindEvents();
    await checkVersion();
    await loadData();

    render($("searchInput")?.value || "");

    setStatus("Status: ok", "ok");
    appendLog("log", "Boot finalizado");
  }

  document.addEventListener("DOMContentLoaded", () => {
    boot().catch((err) => {
      setStatus("Status: erro (boot)", "err");
      appendLog("error", "Falha no boot", err?.message || err);

      const fatal = $("fatalBox");
      if (fatal) fatal.classList.remove("hidden");
    });
  });
})();

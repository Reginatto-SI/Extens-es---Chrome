(() => {
  const STORAGE_KEY = "central_jm_data_v1";
  const APP_VERSION = "1.0.0";

  /**
   * Modelo principal da aplicação separado em camadas:
   * - structure: define grupos e campos dinâmicos
   * - records: dados preenchidos por registro
   * - preferences: preferências de uso da interface
   */
  const appState = {
    structure: { groups: [] },
    records: [],
    preferences: {
      selectedRecordId: null,
      selectedGroupId: null,
      lastUpdatedAt: null
    }
  };

  let editingRecordId = null;
  let selectedConfigGroupId = null;

  const FIELD_TYPES = [
    { value: "short_text", label: "Texto curto" },
    { value: "long_text", label: "Texto longo" },
    { value: "number", label: "Número" },
    { value: "phone", label: "Telefone" },
    { value: "email", label: "E-mail" },
    { value: "link", label: "Link" },
    { value: "password", label: "Senha" },
    { value: "date", label: "Data" },
    { value: "cpf_cnpj", label: "CPF/CNPJ" },
    { value: "state_registration", label: "Inscrição estadual" },
    { value: "options", label: "Lista de opções" },
    { value: "checkbox", label: "Checkbox" }
  ];

  const $ = (id) => document.getElementById(id);
  const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const safe = (v) => (v === null || v === undefined ? "" : String(v));
  const stripDigits = (v) => safe(v).replace(/\D/g, "");
  const fold = (v) => safe(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function normalizeLink(link) {
    if (!link) return "";
    if (/^https?:\/\//i.test(link)) return link;
    return `https://${link}`;
  }

  function formatDate(ts) {
    if (!ts) return "-";
    return new Date(ts).toLocaleString("pt-BR");
  }

  async function copyText(value, shouldCleanDigits = false) {
    const toCopy = shouldCleanDigits ? stripDigits(value) : safe(value);
    await navigator.clipboard.writeText(toCopy);
    alert(`Copiado: ${toCopy}`);
  }

  function buildDefaultData() {
    const gClient = {
      id: uid("group"),
      name: "Dados do Cliente (exemplo)",
      order: 1,
      fields: [
        { id: uid("field"), name: "CPF/CNPJ", type: "cpf_cnpj", order: 1, options: [], isPrimaryKey: true },
        { id: uid("field"), name: "Razão Social", type: "short_text", order: 2, options: [], isPrimaryKey: false },
        { id: uid("field"), name: "Inscrição Estadual", type: "state_registration", order: 3, options: [], isPrimaryKey: false }
      ]
    };

    const gAccess = {
      id: uid("group"),
      name: "Acessos (exemplo)",
      order: 2,
      fields: [
        { id: uid("field"), name: "Portal", type: "link", order: 1, options: [], isPrimaryKey: false },
        { id: uid("field"), name: "Login", type: "short_text", order: 2, options: [], isPrimaryKey: false },
        { id: uid("field"), name: "Senha", type: "password", order: 3, options: [], isPrimaryKey: false }
      ]
    };

    const sampleRecord = {
      id: uid("record"),
      title: "Cliente Exemplo LTDA",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      values: {
        [gClient.fields[0].id]: "12.345.678/0001-99",
        [gClient.fields[1].id]: "Cliente Exemplo LTDA",
        [gClient.fields[2].id]: "001.234.567.890",
        [gAccess.fields[0].id]: "https://www.gov.br",
        [gAccess.fields[1].id]: "usuario.exemplo",
        [gAccess.fields[2].id]: "senha@123"
      }
    };

    return {
      structure: { groups: [gClient, gAccess] },
      records: [sampleRecord],
      preferences: { selectedRecordId: sampleRecord.id, selectedGroupId: "", lastUpdatedAt: Date.now() }
    };
  }

  async function saveState() {
    appState.preferences.lastUpdatedAt = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEY]: appState });
  }

  async function loadState() {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    const data = res[STORAGE_KEY];
    if (!data || !Array.isArray(data?.structure?.groups)) {
      Object.assign(appState, buildDefaultData());
      await saveState();
      return;
    }

    appState.structure = data.structure;
    appState.records = Array.isArray(data.records) ? data.records : [];
    appState.preferences = {
      selectedRecordId: data.preferences?.selectedRecordId || null,
      selectedGroupId: data.preferences?.selectedGroupId || "",
      lastUpdatedAt: data.preferences?.lastUpdatedAt || null
    };
  }

  function getAllFields() {
    return appState.structure.groups
      .sort((a, b) => a.order - b.order)
      .flatMap((group) => group.fields.sort((a, b) => a.order - b.order).map((field) => ({ ...field, groupId: group.id, groupName: group.name })));
  }

  function getFieldById(fieldId) {
    return getAllFields().find((field) => field.id === fieldId);
  }

  function renderGroupFilter() {
    const select = $("groupFilter");
    const current = appState.preferences.selectedGroupId || "";
    select.innerHTML = '<option value="">Todos os grupos</option>';
    appState.structure.groups
      .sort((a, b) => a.order - b.order)
      .forEach((group) => {
        const option = document.createElement("option");
        option.value = group.id;
        option.textContent = group.name;
        select.appendChild(option);
      });
    select.value = current;
  }

  function recordMatchesSearch(record, query, groupId) {
    if (!query && !groupId) return true;
    const q = fold(query);

    const scopedFields = getAllFields().filter((field) => !groupId || field.groupId === groupId);
    const haystack = [record.title, ...scopedFields.map((field) => record.values?.[field.id] ?? "")].map(fold).join(" ");
    return !q || haystack.includes(q);
  }

  function renderRecords() {
    const list = $("recordsList");
    const empty = $("emptyState");
    const count = $("recordCount");

    const query = $("searchInput").value.trim();
    const groupId = appState.preferences.selectedGroupId || "";

    const filtered = appState.records
      .filter((record) => recordMatchesSearch(record, query, groupId))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    list.innerHTML = "";

    if (filtered.length === 0) {
      empty.classList.remove("hidden");
    } else {
      empty.classList.add("hidden");
      filtered.forEach((record) => {
        const card = document.createElement("article");
        card.className = `recordCard ${record.id === appState.preferences.selectedRecordId ? "active" : ""}`;
        card.innerHTML = `
          <div class="recordCardTitle"></div>
          <div class="recordCardMeta"></div>
          <div class="rowActions">
            <button class="btn small" data-action="open">Abrir</button>
            <button class="btn small" data-action="edit">Editar</button>
            <button class="btn small" data-action="duplicate">Duplicar</button>
            <button class="btn small danger" data-action="delete">Excluir</button>
          </div>
        `;
        card.querySelector(".recordCardTitle").textContent = record.title;
        card.querySelector(".recordCardMeta").textContent = `Atualizado em ${formatDate(record.updatedAt)}`;

        card.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", (event) => {
            event.stopPropagation();
            const action = btn.dataset.action;
            if (action === "open") selectRecord(record.id);
            if (action === "edit") openRecordModal(record.id);
            if (action === "duplicate") duplicateRecord(record.id);
            if (action === "delete") deleteRecord(record.id);
          });
        });

        card.addEventListener("click", () => selectRecord(record.id));
        list.appendChild(card);
      });
    }

    count.textContent = `${filtered.length} item(ns)`;
  }

  function renderDetails() {
    const container = $("detailsContent");
    const actions = $("detailActions");
    const record = appState.records.find((item) => item.id === appState.preferences.selectedRecordId);
    if (!record) {
      container.innerHTML = '<p class="muted">Selecione um registro para visualizar os dados organizados por grupo.</p>';
      actions.classList.add("hidden");
      return;
    }

    actions.classList.remove("hidden");
    container.innerHTML = "";

    appState.structure.groups
      .sort((a, b) => a.order - b.order)
      .forEach((group) => {
        const panel = document.createElement("section");
        panel.className = "groupPanel";
        const title = document.createElement("h4");
        title.textContent = group.name;
        panel.appendChild(title);

        const kv = document.createElement("div");
        kv.className = "kv";

        group.fields
          .sort((a, b) => a.order - b.order)
          .forEach((field) => {
            const row = document.createElement("div");
            row.className = "kvRow";

            const label = document.createElement("div");
            label.className = "kvLabel";
            label.textContent = field.name;

            const value = document.createElement("div");
            value.className = "kvValue";
            const rawValue = record.values?.[field.id];
            value.textContent = field.type === "password" && rawValue ? "••••••••" : safe(rawValue) || "-";

            const actionsWrap = document.createElement("div");
            actionsWrap.className = "rowActions";

            // Regra explícita: CPF/CNPJ e IE copiam sem pontuação, somente dígitos.
            if (["cpf_cnpj", "state_registration"].includes(field.type) && rawValue) {
              const copyBtn = document.createElement("button");
              copyBtn.type = "button";
              copyBtn.className = "btn small";
              copyBtn.textContent = "Copiar limpo";
              copyBtn.addEventListener("click", () => copyText(rawValue, true));
              actionsWrap.appendChild(copyBtn);
            }

            if (field.type === "link" && rawValue) {
              const openBtn = document.createElement("button");
              openBtn.type = "button";
              openBtn.className = "btn small";
              openBtn.textContent = "Abrir";
              openBtn.addEventListener("click", () => window.open(normalizeLink(rawValue), "_blank", "noopener"));

              const copyLinkBtn = document.createElement("button");
              copyLinkBtn.type = "button";
              copyLinkBtn.className = "btn small";
              copyLinkBtn.textContent = "Copiar";
              copyLinkBtn.addEventListener("click", () => copyText(rawValue));

              actionsWrap.append(openBtn, copyLinkBtn);
            }

            row.append(label, value, actionsWrap);
            kv.appendChild(row);
          });

        panel.appendChild(kv);
        container.appendChild(panel);
      });
  }

  function renderAll() {
    renderGroupFilter();
    renderRecords();
    renderDetails();
    $("versionBadge").textContent = `v${APP_VERSION}`;
    const updatedAt = appState.preferences.lastUpdatedAt ? formatDate(appState.preferences.lastUpdatedAt) : "n/a";
    $("statusBadge").textContent = `Local • atualizado ${updatedAt}`;
  }

  function selectRecord(recordId) {
    appState.preferences.selectedRecordId = recordId;
    saveState();
    renderAll();
  }

  function confirmDanger(message) {
    return window.confirm(message);
  }

  async function deleteRecord(recordId) {
    if (!confirmDanger("Confirma excluir este registro?")) return;
    appState.records = appState.records.filter((record) => record.id !== recordId);
    if (appState.preferences.selectedRecordId === recordId) {
      appState.preferences.selectedRecordId = appState.records[0]?.id || null;
    }
    await saveState();
    renderAll();
  }

  async function duplicateRecord(recordId) {
    const original = appState.records.find((record) => record.id === recordId);
    if (!original) return;
    const clone = {
      ...original,
      id: uid("record"),
      title: `${original.title} (cópia)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      values: { ...(original.values || {}) }
    };
    appState.records.unshift(clone);
    appState.preferences.selectedRecordId = clone.id;
    await saveState();
    renderAll();
  }

  function createInputForField(field, value = "") {
    const wrap = document.createElement("div");
    wrap.className = "formField";

    const label = document.createElement("label");
    label.textContent = field.name;

    let input;
    if (field.type === "long_text") {
      input = document.createElement("textarea");
    } else if (field.type === "options") {
      input = document.createElement("select");
      const options = field.options?.length ? field.options : ["Sem opções"];
      options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        input.appendChild(option);
      });
    } else if (field.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = value === true || value === "true";
    } else {
      input = document.createElement("input");
      const typeMap = {
        short_text: "text",
        number: "number",
        phone: "tel",
        email: "email",
        link: "url",
        password: "password",
        date: "date",
        cpf_cnpj: "text",
        state_registration: "text"
      };
      input.type = typeMap[field.type] || "text";
      input.value = safe(value);
    }

    input.dataset.fieldId = field.id;
    wrap.append(label, input);
    return wrap;
  }

  function openRecordModal(recordId = null) {
    const modal = $("recordModal");
    const title = $("recordModalTitle");
    const deleteBtn = $("deleteRecordBtn");
    const dynamicGroups = $("dynamicGroups");
    const record = appState.records.find((item) => item.id === recordId);

    editingRecordId = recordId;
    title.textContent = recordId ? "Editar registro" : "Novo registro";
    deleteBtn.classList.toggle("hidden", !recordId);
    $("recordTitle").value = record?.title || "";
    dynamicGroups.innerHTML = "";

    appState.structure.groups.sort((a, b) => a.order - b.order).forEach((group) => {
      const groupEl = document.createElement("section");
      groupEl.className = "dynamicGroup";
      groupEl.innerHTML = `<h4>${group.name}</h4>`;

      group.fields.sort((a, b) => a.order - b.order).forEach((field) => {
        groupEl.appendChild(createInputForField(field, record?.values?.[field.id]));
      });

      dynamicGroups.appendChild(groupEl);
    });

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeRecordModal() {
    $("recordModal").classList.add("hidden");
    $("recordModal").setAttribute("aria-hidden", "true");
    editingRecordId = null;
  }

  async function handleRecordSubmit(event) {
    event.preventDefault();

    const title = $("recordTitle").value.trim();
    if (!title) {
      alert("Informe o título principal do registro.");
      return;
    }

    const values = {};
    $("recordForm").querySelectorAll("[data-field-id]").forEach((input) => {
      const fieldId = input.dataset.fieldId;
      values[fieldId] = input.type === "checkbox" ? input.checked : input.value;
    });

    if (editingRecordId) {
      const record = appState.records.find((item) => item.id === editingRecordId);
      if (!record) return;
      record.title = title;
      record.values = values;
      record.updatedAt = Date.now();
      appState.preferences.selectedRecordId = record.id;
    } else {
      const record = {
        id: uid("record"),
        title,
        values,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      appState.records.unshift(record);
      appState.preferences.selectedRecordId = record.id;
    }

    await saveState();
    closeRecordModal();
    renderAll();
  }

  function openConfigModal() {
    $("configModal").classList.remove("hidden");
    $("configModal").setAttribute("aria-hidden", "false");
    selectedConfigGroupId = selectedConfigGroupId || appState.structure.groups[0]?.id || null;
    renderConfig();
  }

  function closeConfigModal() {
    $("configModal").classList.add("hidden");
    $("configModal").setAttribute("aria-hidden", "true");
  }

  function renderConfig() {
    renderConfigGroups();
    renderConfigFields();
  }

  function renderConfigGroups() {
    const groupsList = $("groupsList");
    groupsList.innerHTML = "";

    appState.structure.groups.sort((a, b) => a.order - b.order).forEach((group, index, arr) => {
      const row = document.createElement("div");
      row.className = "listRow";
      row.innerHTML = `
        <input value="${group.name}" data-kind="group-name" />
        <div class="rowActions">
          <button class="btn small" data-kind="select">Campos</button>
          <button class="btn small" data-kind="up" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="btn small" data-kind="down" ${index === arr.length - 1 ? "disabled" : ""}>↓</button>
          <button class="btn small danger" data-kind="delete">Excluir</button>
        </div>
      `;

      row.querySelector('[data-kind="group-name"]').addEventListener("change", async (e) => {
        group.name = e.target.value.trim() || group.name;
        await saveState();
        renderAll();
        renderConfig();
      });

      row.querySelector('[data-kind="select"]').addEventListener("click", () => {
        selectedConfigGroupId = group.id;
        renderConfig();
      });

      row.querySelector('[data-kind="up"]').addEventListener("click", async () => {
        if (index === 0) return;
        [arr[index - 1].order, arr[index].order] = [arr[index].order, arr[index - 1].order];
        await saveState();
        renderAll();
        renderConfig();
      });

      row.querySelector('[data-kind="down"]').addEventListener("click", async () => {
        if (index === arr.length - 1) return;
        [arr[index + 1].order, arr[index].order] = [arr[index].order, arr[index + 1].order];
        await saveState();
        renderAll();
        renderConfig();
      });

      row.querySelector('[data-kind="delete"]').addEventListener("click", async () => {
        if (!confirmDanger(`Excluir grupo "${group.name}" e seus campos?`)) return;
        const fieldIds = group.fields.map((field) => field.id);
        appState.records.forEach((record) => {
          fieldIds.forEach((fieldId) => delete record.values[fieldId]);
        });
        appState.structure.groups = appState.structure.groups.filter((item) => item.id !== group.id);
        selectedConfigGroupId = appState.structure.groups[0]?.id || null;
        await saveState();
        renderAll();
        renderConfig();
      });

      groupsList.appendChild(row);
    });
  }

  function renderConfigFields() {
    const fieldsList = $("fieldsList");
    fieldsList.innerHTML = "";

    const group = appState.structure.groups.find((item) => item.id === selectedConfigGroupId);
    if (!group) {
      fieldsList.innerHTML = '<p class="muted">Selecione um grupo para gerenciar campos.</p>';
      return;
    }

    group.fields.sort((a, b) => a.order - b.order).forEach((field, index, arr) => {
      const row = document.createElement("div");
      row.className = "listRow";

      const optionText = safe(field.options?.join(","));
      row.innerHTML = `
        <input value="${field.name}" data-kind="field-name" />
        <select data-kind="field-type">${FIELD_TYPES.map((t) => `<option value="${t.value}" ${t.value === field.type ? "selected" : ""}>${t.label}</option>`).join("")}</select>
        <input value="${optionText}" data-kind="field-options" placeholder="Opções separadas por vírgula (somente lista de opções)" />
        <label><input type="checkbox" data-kind="primary" ${field.isPrimaryKey ? "checked" : ""} /> Identificador principal</label>
        <div class="rowActions">
          <button class="btn small" data-kind="up" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="btn small" data-kind="down" ${index === arr.length - 1 ? "disabled" : ""}>↓</button>
          <button class="btn small danger" data-kind="delete">Excluir</button>
        </div>
      `;

      row.querySelector('[data-kind="field-name"]').addEventListener("change", async (e) => {
        field.name = e.target.value.trim() || field.name;
        await saveState();
        renderAll();
      });

      row.querySelector('[data-kind="field-type"]').addEventListener("change", async (e) => {
        field.type = e.target.value;
        await saveState();
        renderAll();
      });

      row.querySelector('[data-kind="field-options"]').addEventListener("change", async (e) => {
        field.options = e.target.value.split(",").map((opt) => opt.trim()).filter(Boolean);
        await saveState();
        renderAll();
      });

      row.querySelector('[data-kind="primary"]').addEventListener("change", async (e) => {
        field.isPrimaryKey = e.target.checked;
        await saveState();
      });

      row.querySelector('[data-kind="up"]').addEventListener("click", async () => {
        if (index === 0) return;
        [arr[index - 1].order, arr[index].order] = [arr[index].order, arr[index - 1].order];
        await saveState();
        renderAll();
        renderConfig();
      });

      row.querySelector('[data-kind="down"]').addEventListener("click", async () => {
        if (index === arr.length - 1) return;
        [arr[index + 1].order, arr[index].order] = [arr[index].order, arr[index + 1].order];
        await saveState();
        renderAll();
        renderConfig();
      });

      row.querySelector('[data-kind="delete"]').addEventListener("click", async () => {
        if (!confirmDanger(`Excluir campo "${field.name}"?`)) return;
        group.fields = group.fields.filter((item) => item.id !== field.id);
        appState.records.forEach((record) => delete record.values[field.id]);
        await saveState();
        renderAll();
        renderConfig();
      });

      fieldsList.appendChild(row);
    });
  }

  async function addGroup() {
    const name = prompt("Nome do novo grupo:");
    if (!name?.trim()) return;
    appState.structure.groups.push({ id: uid("group"), name: name.trim(), order: appState.structure.groups.length + 1, fields: [] });
    selectedConfigGroupId = appState.structure.groups[appState.structure.groups.length - 1].id;
    await saveState();
    renderAll();
    renderConfig();
  }

  async function addField() {
    const group = appState.structure.groups.find((item) => item.id === selectedConfigGroupId);
    if (!group) {
      alert("Selecione um grupo primeiro.");
      return;
    }

    const name = prompt("Nome do novo campo:");
    if (!name?.trim()) return;

    group.fields.push({
      id: uid("field"),
      name: name.trim(),
      type: "short_text",
      order: group.fields.length + 1,
      options: [],
      isPrimaryKey: false
    });

    await saveState();
    renderAll();
    renderConfig();
  }

  function exportData() {
    // Exporta estrutura + registros + preferências em JSON robusto e versionado.
    const payload = {
      meta: { app: "central-jm", version: APP_VERSION, exportedAt: new Date().toISOString() },
      data: appState
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `central-jm-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function mergeRecordValues(existingValues, incomingValues) {
    const merged = { ...(existingValues || {}) };
    Object.entries(incomingValues || {}).forEach(([key, value]) => {
      const incoming = safe(value);
      const current = safe(merged[key]);
      merged[key] = incoming || current;
    });
    return merged;
  }

  function getPrimaryFieldIds() {
    return getAllFields().filter((field) => field.isPrimaryKey).map((field) => field.id);
  }

  function findRecordMatch(incomingRecord) {
    const byId = appState.records.find((record) => record.id === incomingRecord.id);
    if (byId) return byId;

    const primaryFields = getPrimaryFieldIds();
    for (const fieldId of primaryFields) {
      const incomingValue = safe(incomingRecord.values?.[fieldId]);
      if (!incomingValue) continue;
      const matched = appState.records.find((record) => safe(record.values?.[fieldId]) === incomingValue);
      if (matched) return matched;
    }
    return null;
  }

  function mergeImportStructure(importedState) {
    const fieldIdMap = new Map();

    importedState.structure?.groups?.forEach((incomingGroup) => {
      const groupMatchById = appState.structure.groups.find((g) => g.id === incomingGroup.id);
      const groupMatchByName = appState.structure.groups.find((g) => fold(g.name) === fold(incomingGroup.name));
      const group = groupMatchById || groupMatchByName || {
        id: incomingGroup.id || uid("group"),
        name: incomingGroup.name || "Grupo importado",
        order: appState.structure.groups.length + 1,
        fields: []
      };

      if (!groupMatchById && !groupMatchByName) {
        appState.structure.groups.push(group);
      } else {
        group.name = incomingGroup.name || group.name;
      }

      incomingGroup.fields?.forEach((incomingField) => {
        const fieldMatchById = group.fields.find((f) => f.id === incomingField.id);
        const fieldMatchByName = group.fields.find((f) => fold(f.name) === fold(incomingField.name));
        const field = fieldMatchById || fieldMatchByName || {
          id: incomingField.id || uid("field"),
          name: incomingField.name || "Campo importado",
          type: incomingField.type || "short_text",
          order: group.fields.length + 1,
          options: incomingField.options || [],
          isPrimaryKey: !!incomingField.isPrimaryKey
        };

        if (!fieldMatchById && !fieldMatchByName) {
          group.fields.push(field);
        } else {
          field.name = incomingField.name || field.name;
          field.type = incomingField.type || field.type;
          field.options = incomingField.options || field.options;
          field.isPrimaryKey = !!incomingField.isPrimaryKey;
        }

        if (incomingField.id) {
          fieldIdMap.set(incomingField.id, field.id);
        }
      });
    });

    return fieldIdMap;
  }

  function mergeImportRecords(importedState, fieldIdMap) {
    importedState.records?.forEach((incomingRecord) => {
      const remappedValues = {};
      Object.entries(incomingRecord.values || {}).forEach(([incomingFieldId, value]) => {
        const targetFieldId = fieldIdMap.get(incomingFieldId) || incomingFieldId;
        remappedValues[targetFieldId] = value;
      });

      const normalizedIncoming = {
        ...incomingRecord,
        values: remappedValues
      };

      const existing = findRecordMatch(normalizedIncoming);
      if (existing) {
        existing.title = normalizedIncoming.title || existing.title;
        existing.values = mergeRecordValues(existing.values, normalizedIncoming.values);
        existing.updatedAt = Date.now();
      } else {
        appState.records.push({
          id: normalizedIncoming.id || uid("record"),
          title: normalizedIncoming.title || "Registro importado",
          createdAt: normalizedIncoming.createdAt || Date.now(),
          updatedAt: Date.now(),
          values: normalizedIncoming.values || {}
        });
      }
    });
  }

  async function importData(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedState = parsed.data || parsed;

      // Import com mesclagem determinística:
      // 1) mescla estrutura por id/nome
      // 2) remapeia campos importados para ids locais
      // 3) mescla registros por id e, quando disponível, por campo marcado como identificador principal
      const fieldIdMap = mergeImportStructure(importedState);
      mergeImportRecords(importedState, fieldIdMap);

      if (!appState.preferences.selectedRecordId && appState.records[0]) {
        appState.preferences.selectedRecordId = appState.records[0].id;
      }

      await saveState();
      renderAll();
      alert("Importação concluída com mesclagem de dados.");
    } catch (error) {
      alert(`Falha ao importar arquivo: ${error.message}`);
    }
  }

  function wireEvents() {
    $("newRecordBtn").addEventListener("click", () => openRecordModal());
    $("configureBtn").addEventListener("click", openConfigModal);
    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("exportBtn").addEventListener("click", exportData);
    $("searchInput").addEventListener("input", renderRecords);

    $("groupFilter").addEventListener("change", async (event) => {
      appState.preferences.selectedGroupId = event.target.value;
      await saveState();
      renderAll();
    });

    $("detailEditBtn").addEventListener("click", () => openRecordModal(appState.preferences.selectedRecordId));
    $("detailDuplicateBtn").addEventListener("click", () => duplicateRecord(appState.preferences.selectedRecordId));
    $("detailDeleteBtn").addEventListener("click", () => deleteRecord(appState.preferences.selectedRecordId));

    $("closeRecordModalBtn").addEventListener("click", closeRecordModal);
    $("cancelRecordBtn").addEventListener("click", closeRecordModal);
    $("recordForm").addEventListener("submit", handleRecordSubmit);
    $("deleteRecordBtn").addEventListener("click", async () => {
      if (!editingRecordId) return;
      await deleteRecord(editingRecordId);
      closeRecordModal();
    });

    $("closeConfigModalBtn").addEventListener("click", closeConfigModal);
    $("addGroupBtn").addEventListener("click", addGroup);
    $("addFieldBtn").addEventListener("click", addField);

    $("importFile").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (file) await importData(file);
      event.target.value = "";
    });
  }

  async function init() {
    wireEvents();
    await loadState();
    renderAll();
  }

  init();
})();

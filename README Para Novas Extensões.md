
## 📄 README_PADRAO_EXTENSOES.md
````markdown
# 🧩 Padrão Oficial — Extensões Chrome (UI e Arquitetura)

## 📌 Objetivo
Este documento define o padrão obrigatório para desenvolvimento de extensões neste repositório.

Todas as extensões devem seguir exatamente este modelo de:
- Interface (UI/UX)
- Estrutura
- Comportamento
- Versionamento

---

## 🧠 REGRA PRINCIPAL

> Todas as extensões devem se comportar como aplicações completas, e não como popups simples.

---

## 🖥️ Padrão de Interface (OBRIGATÓRIO)

### ❌ NÃO usar:
- Popup pequeno do Chrome

### ✅ SEMPRE usar:
- Abertura em nova aba do navegador

Exemplo obrigatório:

```javascript
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("popup.html");
  await chrome.tabs.create({ url });
});
````

---

## 🎨 Identidade Visual (PADRÃO GLOBAL)

Todas as extensões devem seguir o mesmo padrão visual:

### Cores principais:

* Fundo: gradiente escuro (azul profundo)
* Primária: azul (#4f8cff)
* Sucesso: verde (#24c78d)
* Erro: vermelho (#ff5e73)

### Estilo:

* Interface moderna (estilo dashboard)
* Uso de cards/painéis
* Bordas arredondadas (radius ~14px a 18px)
* Sombras suaves
* Fonte padrão: Inter / Segoe UI / Roboto

---

## 🧱 Estrutura da Interface

Toda extensão deve conter:

* Header (título + descrição)
* Área de ação principal
* Painéis organizados
* Filtros (quando aplicável)
* Tabela/listagem (se houver dados)
* Ações claras (botões)
* Feedback visual (OK / ERRO)

---

## ⚙️ Comportamento

* A extensão deve ser clara e direta
* O usuário deve entender tudo “batendo o olho”
* Não exigir aprendizado complexo
* Evitar cliques desnecessários
* Priorizar produtividade

---

## 🔁 Versionamento (OBRIGATÓRIO)

Toda alteração relevante deve gerar nova versão.

### Regra:

* Sempre atualizar o campo `version` no `manifest.json`

Exemplo:

```json
"version": "1.2.0"
```

### Padrão de versão:

* `1.0.0` → versão inicial
* `1.1.0` → nova funcionalidade
* `1.1.1` → correção

---

## 🧠 Registro de versão interno

A extensão deve registrar:

* Versão atual
* Data da última atualização

Exemplo:

```javascript
chrome.storage.local.set({
  extensionVersion: chrome.runtime.getManifest().version,
  extensionUpdatedAt: new Date().toISOString()
});
```

---

## 🚫 Regras proibidas

* Não criar popup simples
* Não usar design diferente do padrão
* Não inventar novos estilos
* Não criar múltiplos layouts sem necessidade

---

## ✅ Boas práticas obrigatórias

* Código limpo e comentado
* UX simples e objetiva
* Feedback visual claro
* Performance leve
* Estrutura reutilizável

---

## 🧠 Filosofia do projeto

> Se parecer um sistema profissional, está certo.
> Se parecer uma extensão simples, está errado.

---

## 📌 Regra final

Todas as novas extensões devem seguir este padrão como base.

Não criar novos padrões.
Não reinventar estrutura.
Apenas adaptar este modelo ao problema.

Pode Seguir como base visual: "extensoes/02 - Validador de XML IVA/"
---


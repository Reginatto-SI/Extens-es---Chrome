
# 🧩 Extensões Chrome — Uso Corporativo

## 📌 Objetivo do Repositório
Este repositório centraliza extensões desenvolvidas para o Google Chrome com foco em **uso interno e corporativo**.

As extensões aqui presentes têm como finalidade:
- Automatizar tarefas do dia a dia
- Melhorar produtividade da equipe
- Facilitar processos operacionais dentro de sistemas web
- Padronizar interações e reduzir erros manuais

⚠️ **Importante:** Este repositório NÃO é voltado para uso público. Todas as extensões são desenvolvidas para cenários específicos do ambiente de trabalho.

---

## 🧠 Diretriz para Desenvolvimento (LEIA ANTES DE CODAR)

Se você é uma IA (ex: Codex) ou desenvolvedor contribuindo neste repositório, siga obrigatoriamente estas regras:

### 1. Foco principal
- Sempre priorizar **simplicidade, clareza e eficiência**
- Resolver o problema com a **menor complexidade possível**
- Evitar overengineering

---

### 2. Padrão de qualidade
Toda extensão deve:
- Ser **estável e previsível**
- Ter comportamento **determinístico** (sem heurísticas desnecessárias)
- Evitar efeitos colaterais no sistema do usuário
- Ter código **limpo, organizado e comentado**

---

### 3. Regras obrigatórias
- ❌ NÃO inventar funcionalidades não solicitadas
- ❌ NÃO alterar comportamento existente sem necessidade
- ❌ NÃO adicionar dependências externas sem justificativa
- ❌ NÃO criar lógica genérica demais (sempre focar no caso real)

- ✅ Sempre comentar partes importantes do código
- ✅ Sempre manter padrão visual consistente
- ✅ Sempre validar entradas e evitar erros silenciosos

---

### 4. Estrutura esperada das extensões

Cada extensão deve seguir, preferencialmente:

```

/nome-da-extensao
├── manifest.json
├── content.js
├── background.js (se necessário)
├── popup.html (se houver interface)
├── popup.js
├── styles.css
└── README.md (opcional, mas recomendado)

```

---

### 5. UX e Interface
- Interface deve ser **simples, direta e funcional**
- Evitar poluição visual
- Informações importantes devem ser visíveis rapidamente
- Sempre priorizar “bater o olho e entender”

---

### 6. Performance
- Scripts devem ser leves
- Evitar loops desnecessários
- Evitar execução contínua sem necessidade
- Usar listeners apenas quando necessário

---

### 7. Segurança
- Nunca expor dados sensíveis
- Nunca armazenar informações sem necessidade
- Sempre validar origem de dados manipulados no DOM

---

### 8. Escopo das extensões
Essas extensões são utilizadas principalmente para:
- Manipulação de telas de sistemas web
- Leitura e exibição de dados (ex: XML, tabelas, relatórios)
- Automatização de preenchimento
- Melhorias visuais e operacionais

---

## 🚫 O que NÃO fazer
- Transformar a extensão em um sistema completo
- Criar backend desnecessário
- Complexificar algo que pode ser simples
- Reescrever algo que já funciona

---

## ✅ O que sempre buscar
- Clareza
- Simplicidade
- Performance
- Manutenção fácil
- Código explicativo

---

## 📎 Observação Final
Este repositório é voltado para produtividade real no ambiente de trabalho.

Se a solução não for **prática no dia a dia**, ela não serve.

> Regra de ouro: se o usuário precisar pensar demais para usar, está errado.

---
```

# PRD — Unificador de Planilhas

## 1) Objetivo
Permitir que o usuário carregue múltiplos arquivos Excel `.xlsx` e gere um único arquivo final com os dados concatenados (append), sem alterações de conteúdo.

## 2) Escopo (simples e determinístico)
- Entrada: múltiplos arquivos `.xlsx` escolhidos pelo usuário.
- Leitura: somente a primeira aba de cada arquivo.
- Validação: comparação determinística dos cabeçalhos usando o primeiro arquivo como referência.
- Processamento: concatenação simples das linhas na ordem de carregamento.
- Saída: arquivo `.xlsx` único para download.

## 3) Fluxo do usuário
1. Usuário abre a extensão em nova aba.
2. Usuário seleciona ou arrasta arquivos `.xlsx`.
3. Usuário informa a linha do cabeçalho (padrão 1).
4. Sistema lista os arquivos carregados.
5. Usuário clica em **Unificar arquivos**.
6. Sistema valida colunas (quantidade, nomes e ordem) com base no primeiro arquivo.
7. Se houver divergência, sistema bloqueia a unificação e exibe os arquivos fora do padrão.
8. Se não houver divergência, sistema processa os arquivos em sequência.
9. Sistema exibe progresso por quantidade de arquivos (texto + barra).
10. Sistema exibe modal de conclusão com botão de download.

## 4) Regras de negócio
- Aceitar apenas arquivos `.xlsx`.
- Ler apenas a primeira aba de cada arquivo.
- Manter a ordem dos arquivos conforme carregados.
- O primeiro arquivo carregado define o padrão de colunas.
- Linha de cabeçalho configurável (mínimo 1).
- Comparar cabeçalhos com `trim()` simples, sem normalização agressiva.
- Ao encontrar divergência, apenas informar e bloquear a unificação.
- Concatenar os dados exatamente como lidos (append) quando todos forem compatíveis.
- Não remover cabeçalhos duplicados.
- Preservar conteúdo visual do Excel na leitura (datas, valores monetários e textos formatados).

## 5) Limitações claras
- Não há normalização de dados.
- Não há deduplicação.
- Não há limpeza de conteúdo.
- Não há correção automática para arquivos divergentes.
- Não há preview de dados.
- O progresso é estimado por arquivos concluídos, não por célula/linha processada.

## 6) Premissas técnicas
- A biblioteca XLSX deve ser local (`vendor/xlsx.full.min.js`) para respeitar as regras de segurança do Manifest V3.
- Deve existir console interno para facilitar diagnóstico de processamento.
- A conclusão do fluxo deve priorizar modal com ação principal de download.

## 7) Fora de escopo (sem overengineering)
- Mapeamento inteligente de colunas.
- União por chave de negócio.
- Regras de validação complexas.
- Processamento de múltiplas abas por arquivo.

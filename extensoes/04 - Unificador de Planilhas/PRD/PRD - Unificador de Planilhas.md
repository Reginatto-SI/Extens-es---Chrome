# PRD — Unificador de Planilhas

## 1) Objetivo
Permitir que o usuário carregue múltiplos arquivos Excel `.xlsx` e gere um único arquivo final com os dados concatenados (append), sem alterações de conteúdo.

## 2) Escopo (simples e determinístico)
- Entrada: múltiplos arquivos `.xlsx` escolhidos pelo usuário.
- Leitura: somente a primeira aba de cada arquivo.
- Processamento: concatenação simples das linhas na ordem de carregamento.
- Saída: arquivo `.xlsx` único para download.

## 3) Fluxo do usuário
1. Usuário abre a extensão em nova aba.
2. Usuário seleciona ou arrasta arquivos `.xlsx`.
3. Sistema lista os arquivos carregados.
4. Usuário clica em **Unificar arquivos**.
5. Sistema processa os arquivos em sequência.
6. Sistema exibe progresso por quantidade de arquivos (texto + barra).
7. Sistema exibe sucesso ou erro.
8. Usuário clica em **Baixar arquivo**.

## 4) Regras de negócio
- Aceitar apenas arquivos `.xlsx`.
- Ler apenas a primeira aba de cada arquivo.
- Manter a ordem dos arquivos conforme carregados.
- Concatenar os dados exatamente como lidos (append).
- Não remover cabeçalhos duplicados.
- Não interpretar estrutura de colunas.
- Preservar conteúdo visual do Excel na leitura (datas, valores monetários e textos formatados).

## 5) Limitações claras
- Não há normalização de dados.
- Não há deduplicação.
- Não há limpeza de conteúdo.
- Não há tratamento de incompatibilidades entre formatos de linha.
- Não há preview de dados.
- O progresso é estimado por arquivos concluídos, não por célula/linha processada.

## 6) Fora de escopo (sem overengineering)
- Mapeamento inteligente de colunas.
- União por chave de negócio.
- Regras de validação complexas.
- Processamento de múltiplas abas por arquivo.

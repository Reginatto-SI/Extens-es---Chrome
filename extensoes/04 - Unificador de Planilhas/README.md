# Unificador de Planilhas

Extensão Chrome para unificar múltiplos arquivos `.xlsx` em um único arquivo final por concatenação simples.

## Como usar
1. Abra a extensão.
2. Selecione o **Arquivo modelo** `.xlsx` (referência de colunas).
3. Selecione ou arraste os **Arquivos para unificar** `.xlsx`.
4. Informe **Linha do cabeçalho** (padrão `8`, mínimo `1`).
5. Escolha se deve **Bloquear unificação se houver divergência** (marcado por padrão).
6. Clique em **Unificar arquivos**.
7. A extensão valida as colunas comparando todos os arquivos contra o arquivo modelo.

## Regras
- Lê somente a primeira aba de cada arquivo.
- Mantém a ordem dos arquivos carregados.
- Usa apenas o arquivo modelo selecionado como referência de colunas.
- Compara quantidade, nomes e ordem das colunas na linha de cabeçalho informada.
- Se houver divergência, bloqueia a unificação e mostra os arquivos fora do padrão.
- Não remove cabeçalhos duplicados.
- Não corrige arquivos divergentes automaticamente.
- Não faz normalização, deduplicação ou limpeza.
- Preserva o conteúdo visual exibido no Excel (datas, moeda e textos formatados).

## Observações técnicas
- A biblioteca XLSX é carregada localmente (`vendor/xlsx.full.min.js`) por exigência de segurança do Manifest V3 (`script-src 'self'`).
- A extensão possui console interno de processamento para diagnóstico.
- O progresso exibido é baseado na quantidade de arquivos concluídos.
- O modal de conclusão é o ponto principal para iniciar o download final.

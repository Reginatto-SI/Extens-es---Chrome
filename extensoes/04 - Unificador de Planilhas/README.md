# Unificador de Planilhas

Extensão Chrome para unificar múltiplos arquivos `.xlsx` em um único arquivo final por concatenação simples.

## Como usar
1. Abra a extensão.
2. Selecione ou arraste arquivos `.xlsx`.
3. Informe **Linha do cabeçalho** (padrão `1`).
4. Clique em **Unificar arquivos**.
5. A extensão valida as colunas usando o primeiro arquivo como referência.
6. Se não houver divergências, acompanhe o progresso e baixe no modal de conclusão.

## Regras
- Lê somente a primeira aba de cada arquivo.
- Mantém a ordem dos arquivos carregados.
- Usa o primeiro arquivo carregado como modelo de colunas.
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

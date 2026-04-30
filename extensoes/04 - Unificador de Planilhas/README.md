# Unificador de Planilhas

Extensão Chrome para unificar múltiplos arquivos `.xlsx` em um único arquivo final por concatenação simples.

## Como usar
1. Abra a extensão.
2. Selecione ou arraste arquivos `.xlsx`.
3. Clique em **Unificar arquivos**.
4. Acompanhe o progresso por arquivo (texto + barra de progresso).
5. Ao concluir, use o modal para **Baixar arquivo consolidado**.

## Regras
- Lê somente a primeira aba de cada arquivo.
- Mantém a ordem dos arquivos carregados.
- Não remove cabeçalhos duplicados.
- Não faz normalização, deduplicação ou limpeza.
- Preserva o conteúdo visual exibido no Excel (datas, moeda e textos formatados).

## Observações técnicas
- A biblioteca XLSX é carregada localmente (`vendor/xlsx.full.min.js`) por exigência de segurança do Manifest V3 (`script-src 'self'`).
- A extensão possui console interno de processamento para diagnóstico.
- O progresso exibido é baseado na quantidade de arquivos concluídos.
- O modal de conclusão é o ponto principal para iniciar o download final.

# Validador NF-e IBS/CBS

Extensão desenvolvida para analisar arquivos XML de NF-e e identificar, de forma rápida e visual, a presença das informações de IBS e CBS nas notas fiscais.

## Objetivo

A extensão foi criada para facilitar a conferência de XMLs de NF-e, permitindo ao usuário:

- importar vários arquivos XML de uma vez
- validar se a nota possui estrutura de IBS e CBS
- visualizar dados principais da NF-e
- exibir os valores de IBS e CBS encontrados no XML
- totalizar os valores de IBS e CBS conforme os filtros aplicados
- exportar os resultados para CSV
- gerar relatório em PDF
- visualizar o XML original da nota analisada

## Como a extensão funciona

Ao abrir a extensão, o usuário deve primeiro escolher o tipo de análise:

- Notas Emitidas
- Notas Recebidas

Depois disso, a importação dos XMLs é liberada. Os arquivos podem ser adicionados de duas formas:

- selecionando arquivos XML manualmente
- selecionando uma pasta contendo XMLs

A extensão lê cada arquivo XML e procura as principais informações da NF-e, como:

- chave da nota
- data de emissão
- emitente
- destinatário
- natureza da operação
- CFOP

Em seguida, realiza a validação das informações relacionadas a IBS e CBS.

## Validação de IBS e CBS

A extensão verifica se o XML possui a estrutura esperada para IBS e CBS.

Além da estrutura, a extensão também tenta localizar os valores dos tributos no XML.

Na leitura dos valores, a prioridade é:

1. bloco total da nota (`IBSCBSTot`)
2. caso não exista, leitura dos valores nos itens da NF-e

Os valores normalmente são obtidos das tags como:

- `vIBS`
- `vIBSUF`
- `vIBSMun`
- `vCBS`

## Exibição dos resultados

Após a análise, os XMLs são listados em tabela com as principais informações da nota.

A tabela mostra:

- status da validação
- chave NF-e
- data de emissão
- emitente
- destinatário
- natureza da operação
- CFOP(s)
- IBS
- CBS
- ação para visualizar o XML

### Status

- **OK**: quando a nota possui as informações esperadas
- **ERRO**: quando falta alguma informação importante ou a estrutura de IBS/CBS não foi encontrada corretamente

## Mostrar valores IBS e CBS

A extensão possui a opção:

**Mostrar valores IBS e CBS**

Quando essa opção está marcada:

- a tabela passa a exibir os valores monetários de IBS e CBS
- aparecem cards de totalização na tela
- os totais seguem exatamente os filtros aplicados pelo usuário

Quando essa opção está desmarcada:

- os cards de totalização ficam ocultos
- a tabela exibe apenas a indicação geral de validação

## Totalização

Quando a opção de mostrar valores está ativa, a extensão apresenta:

- quantidade de notas exibidas
- total IBS filtrado
- total CBS filtrado

Importante:
os totalizadores respeitam os filtros ativos na tela, ou seja, consideram apenas os XMLs exibidos naquele momento.

## Filtros disponíveis

A extensão permite filtrar os resultados por:

- busca por texto
- data inicial
- data final
- mostrar somente notas com erro

A busca por texto pode localizar informações como:

- chave
- emitente
- destinatário
- CFOP
- natureza da operação
- data
- nome do arquivo

## Recursos adicionais

### Copiar chaves com erro
Permite copiar rapidamente todas as chaves das notas que apresentaram erro na validação.

### Exportar CSV
Gera um arquivo CSV com os resultados analisados, incluindo os valores de IBS e CBS.

### Gerar PDF
Gera uma versão para impressão ou salvamento em PDF com os dados exibidos na tela.

### Ver XML
Abre uma janela para visualização completa do XML original da nota.

## Observações importantes

- A extensão analisa apenas arquivos XML válidos de NF-e
- Arquivos sem estrutura utilizável de NF-e podem ser ignorados
- A conferência é baseada nas tags presentes no XML importado
- Os valores exibidos dependem das informações efetivamente destacadas no XML
- Em layouts diferentes de XML, a leitura pode depender da estrutura adotada pelo emissor

## Indicação de uso

Esta extensão é útil para:

- escritórios contábeis
- setor fiscal
- conferência de notas emitidas
- conferência de notas recebidas
- auditoria de XMLs
- validação operacional de IBS e CBS

## Desenvolvido por

Edimar Reginato  
JM Assessoria e Contabilidade MT
# Maps_Empresas

Extensão local para Google Chrome que auxilia a captura manual e assistida de dados **visíveis** de empresas no Google Maps.

## Características

- Manifest V3.
- Uso próprio/local.
- Sem backend, servidor, login, banco de dados ou APIs externas.
- Sem envio de dados para terceiros.
- Sem técnicas de bypass, captcha, anti-bloqueio, login automático ou automação agressiva.
- Dados mantidos somente em memória da aba e em `chrome.storage.session`; não há `chrome.storage.local` nem armazenamento permanente.
- Os dados podem permanecer em `chrome.storage.session` durante a sessão do navegador, mas podem ser perdidos se a aba, a sessão do navegador ou a extensão forem encerradas/recarregadas.
- O botão **Limpar dados** apaga os leads, o treinamento salvo na sessão da extensão e a referência da aba alvo do Google Maps.
- A captura só começa quando o usuário abre o Google Maps e aciona manualmente a extensão.

## Como carregar no Chrome

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `extensoes/Maps_Empresas` deste repositório.
5. Fixe a extensão na barra do Chrome, se desejar.

## Como usar

1. Abra o Google Maps em `https://www.google.com/maps/` ou `https://www.google.com.br/maps/`.
2. Pesquise um nicho, por exemplo: restaurantes, clínicas ou lojas.
3. Abra a extensão `Maps_Empresas`.
4. Clique em **Iniciar treinamento**.
5. Clique em cada botão de seleção e depois clique no elemento correspondente da página:
   - **Selecionar lista lateral**
   - **Selecionar nome**
   - **Selecionar telefone**
   - **Selecionar endereço**
   - **Selecionar site**
6. Clique em **Iniciar captura**. A extensão salva a aba do Maps como aba alvo da sessão para permitir pausar, retomar ou selecionar campos mesmo se você abrir o popup em outra aba.
7. Role a lista manualmente no Google Maps para capturar mais resultados visíveis.
8. Clique em **Exportar CSV** para baixar a planilha com separador `;` e BOM UTF-8.
9. Clique em **Limpar dados** quando quiser apagar os dados da sessão da extensão, incluindo leads, treinamento em sessão e aba alvo.

## Colunas exportadas

O arquivo CSV usa o nome `Maps_Empresas_leads_YYYY-MM-DD_HH-mm.csv` e contém as colunas:

```text
Nome;Telefone;Endereco;Site;Avaliacao;QtdAvaliacoes;Categoria;URL;CapturadoEm
```

## Observações técnicas

O Google Maps muda o DOM com frequência. Por isso, a extensão combina:

- seletores treinados pelo usuário;
- caminho relativo dentro do card ou painel;
- texto de exemplo;
- heurísticas de nomes, endereços, avaliações e categorias;
- regex para telefone brasileiro e site.

A captura usa `MutationObserver` com debounce de aproximadamente 1 segundo, evitando intervalos agressivos. A navegação do Maps só é interceptada no modo de seleção visual.


## Sessão e aba alvo

Ao iniciar treinamento ou captura, a extensão grava o `tabId` da aba do Google Maps em `chrome.storage.session` usando a chave `mapsEmpresasTargetTabId`. Enquanto essa aba existir e continuar no Google Maps, os comandos seguintes do popup tentam usá-la como alvo, mesmo que o usuário esteja visualizando outra aba. Se a aba alvo for fechada, a extensão mostra uma mensagem amigável pedindo para abrir o Maps novamente.

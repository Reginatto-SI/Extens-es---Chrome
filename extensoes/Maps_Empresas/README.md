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
- A captura e a varredura assistida só começam quando o usuário abre o Google Maps e aciona manualmente a extensão.

## Novidades da versão 2.0

A versão 2.0 adiciona um painel flutuante dentro da própria página do Google Maps. O popup padrão do Chrome fecha quando você clica na página, então o painel flutuante é o fluxo recomendado para treinar campos, capturar dados visíveis, pausar, limpar e acompanhar o contador sem precisar reabrir o popup várias vezes.

Também foi adicionada a **varredura assistida**, que rola somente a lista lateral selecionada/identificada e captura os dados visíveis em ciclos controlados. Ela não clica automaticamente em empresas, não abre novas páginas e não tenta contornar bloqueios.

## Como carregar no Chrome

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `extensoes/Maps_Empresas` deste repositório.
5. Fixe a extensão na barra do Chrome, se desejar.

## Como abrir o painel flutuante

1. Abra o Google Maps em `https://www.google.com/maps/` ou `https://www.google.com.br/maps/`.
2. Pesquise um nicho, por exemplo: restaurantes, clínicas ou lojas.
3. Abra o popup da extensão `Maps_Empresas`.
4. Clique em **Abrir painel no Maps**.
5. Use o painel no canto inferior direito da página como fluxo principal.

O popup continua disponível e mantém a exportação CSV, mas o painel flutuante evita o problema de UX causado pelo fechamento automático do popup quando você interage com o Google Maps.

## Como treinar campos pelo painel

1. No painel flutuante, clique em um dos botões:
   - **Selecionar lista lateral**
   - **Selecionar nome**
   - **Selecionar telefone**
   - **Selecionar endereço**
   - **Selecionar site**
2. Quando a mensagem informar para clicar no elemento correspondente, clique no item correto dentro do Google Maps.
3. O cursor muda para `crosshair` e o elemento sob o mouse recebe destaque para confirmar a seleção visual.
4. O treinamento é salvo em `chrome.storage.session` com a chave `mapsEmpresasFieldMap`.
5. Botões de campos já selecionados aparecem marcados com `✓` no painel.

## Como usar captura visível

1. Treine os campos desejados, principalmente a lista lateral quando possível.
2. Clique em **Iniciar captura visível** no painel.
3. A extensão captura os cards e painéis atualmente visíveis.
4. Essa ação não faz scroll; ela apenas atualiza os leads encontrados na tela.
5. O contador e a seção **Últimos capturados** do painel são atualizados com a quantidade e o preview dos leads salvos em `mapsEmpresasLeads`.

## Como usar varredura assistida

1. Treine a **lista lateral** ou mantenha os resultados do Maps visíveis para que a extensão tente identificá-la pelas heurísticas existentes.
2. Escolha o **Modo de varredura** no painel:
   - **Curta**: até 20 etapas, intervalo de 1,5 segundo e 4 etapas sem mudança.
   - **Média**: até 50 etapas, intervalo de 1,8 segundo e 5 etapas sem mudança.
   - **Longa**: até 100 etapas, intervalo de 2,2 segundos e 8 etapas sem mudança.
3. Clique em **Iniciar varredura assistida** no painel.
4. A extensão captura os cards visíveis com `scanPage()`.
5. Em seguida, rola somente o container da lista lateral em cerca de 80% da altura visível.
6. A cada etapa, o painel mostra o progresso no formato `etapa X/Y` e atualiza a seção **Últimos capturados** com até 5 leads recentes.
7. A varredura para quando você clica em **Pausar**, quando atinge o limite de etapas, quando não encontra novos leads por etapas consecutivas ou quando o scroll deixa de avançar, indicando possível fim da lista.

A varredura assistida é manualmente iniciada pelo usuário e não faz cliques automáticos em empresas, não rola a página inteira, não abre abas e não usa automação agressiva.

## Como pausar

Clique em **Pausar** no painel ou em **Pausar captura** no popup. A extensão:

- desativa a captura;
- desativa a varredura assistida;
- limpa o timer de varredura;
- para o `MutationObserver`;
- salva o status `Pausado` em `chrome.storage.session`;
- atualiza o painel flutuante, se ele estiver aberto.

## Como exportar CSV

1. Abra o popup da extensão.
2. Clique em **Exportar CSV**.
3. O arquivo é gerado localmente com BOM UTF-8, separador `;` e nome no padrão:

```text
Maps_Empresas_leads_YYYY-MM-DD_HH-mm.csv
```

## Como limpar dados

Clique em **Limpar** no painel ou **Limpar dados** no popup. A extensão limpa:

- `mapsEmpresasLeads`;
- `mapsEmpresasFieldMap`;
- `mapsEmpresasTargetTabId`;
- timers e estados de captura/varredura em memória.

Após limpar, a mensagem exibida é **Dados limpos com sucesso.**

## Colunas exportadas

O CSV contém as colunas:

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

A captura manual por popup usa `MutationObserver` com debounce de aproximadamente 1 segundo. A varredura assistida usa timer controlado de no mínimo 1 segundo e rola apenas o container lateral encontrado pelo treinamento ou pelas heurísticas de lista.

## Sessão e aba alvo

Ao abrir o painel, iniciar treinamento ou iniciar captura, a extensão grava o `tabId` da aba do Google Maps em `chrome.storage.session` usando a chave `mapsEmpresasTargetTabId`. Enquanto essa aba existir e continuar no Google Maps, os comandos seguintes do popup tentam usá-la como alvo, mesmo que o usuário esteja visualizando outra aba. Se a aba alvo for fechada, a extensão mostra uma mensagem amigável pedindo para abrir o Maps novamente.

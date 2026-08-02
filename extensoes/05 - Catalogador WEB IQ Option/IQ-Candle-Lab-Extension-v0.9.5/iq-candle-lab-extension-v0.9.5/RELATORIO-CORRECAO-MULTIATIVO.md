# Relatório da correção multiativo

## Resumo executivo

A correção separa **captura**, **instrumento selecionado** e **análise exibida**. Todos os candles identificados continuam sendo persistidos, mas somente uma seleção confirmada pode mudar o painel. O fluxo deixa de inferir seleção pelo último candle e passa a usar uma chave `activeId:timeframeSec`, correlação de histórico por `request_id` e versões de análise.

## Causa raiz e evidências no fluxo anterior

1. `content.js` copiava `activeId` e `symbol` de qualquer payload para um único `state` global.
2. O contexto de um candle sem identidade herdava `state.activeId`, isto é, o ativo do último evento.
3. Cada lote capturado chamava `refreshAnalysis()`, inclusive lotes de ativos não visíveis.
4. `IQLAB.analyze()` escolhia como ativo corrente o candle globalmente mais recente.
5. O background analisava todo o banco sem receber a identidade selecionada.
6. Respostas `candles` não eram correlacionadas ao comando que as originou. O método de “religação” podia atribuir registros desconhecidos usando outro candle confiável do lote.
7. Respostas assíncronas não possuíam token de versão; uma resposta antiga podia substituir a nova.
8. A lista e os cards usavam `innerHTML` em todas as atualizações, mesmo sem mudança visual.
9. O índice único por símbolo/timeframe/instante não representava a identidade real do instrumento.

O sintoma reproduzível no código era: `76, 86, 76, 86` atualizava sucessivamente o estado global, solicitava quatro análises e cada análise escolhia o último registro persistido.

## Fluxo corrigido

### WebSocket e bridge

`page-bridge.js` observa agora tanto `message` quanto `send`. Comandos de histórico `get-candles` registram:

```js
pendingHistory.set(String(requestId), { activeId, timeframeSec, requestedAt });
```

Quando chega `candles`, a resposta recebe a correlação da solicitação original. Assinaturas são reportadas como tráfego, mas **não** são consideradas seleção, porque a página pode manter várias simultaneamente. `candle-generated` identifica apenas o instrumento transmitido.

### Estado por aba e instrumento

`multi-asset.js` introduz um estado pequeno, sem substituir a arquitetura existente:

```js
TabState = {
  selectedInstrumentKey,
  instruments: Map,
  selectionVersion,
  analysisSequence,
  discardedAnalyses
}
```

O background mantém um `TabState` por `sender.tab.id` e o remove quando a aba Chrome é fechada. Cada instrumento registra seus próprios horários realtime/histórico, contagem, status e metadados.

### Identificação do selecionado

A seleção usa evidência estruturada da aba DOM realmente ativa, confirmada em duas observações estáveis e correlacionada ao mapa `activeId -> símbolo`. `get-candles` serve somente para correlacionar histórico. Eventos recebidos, inclusive `candle-generated`, `candles` e `underlying-list-changed`, nunca selecionam um instrumento. Se a IQ Option mudar sua marcação acessível, o painel preserva a última seleção confirmada em vez de alternar pelo tráfego.

### Histórico

O bridge guarda requisições pendentes por `request_id`. A resposta fora de ordem recupera exatamente `activeId` e timeframe do comando correspondente. Se a resposta trouxer identidade própria válida ela também pode ser normalizada, mas nunca herda o instrumento selecionado global.

### Captura e IndexedDB

Todos os candles válidos são enviados ao background e persistidos. A chave primária já era correta (`activeId|timeframeSec|from`) e foi preservada. A versão do banco passou de 10 para 11 apenas para substituir o índice único baseado em símbolo pelo índice `activeId + timeframeSec + from`. Nenhum banco ou histórico é apagado.

O mecanismo inseguro de religação automática deixou de ser chamado na captura. Assim, um histórico desconhecido não é renomeado a partir de outro ativo do lote. EURUSD normal/OTC e timeframes diferentes permanecem separados por `activeId` e timeframe.

### Análise e concorrência

`FLOATING_ANALYSIS` inclui `instrumentKey`. O background filtra os candles pelo `activeId` e timeframe solicitados antes de formar quadrantes. Tokens contêm sequência, versão da seleção e chave. Tanto background quanto content descartam resultados obsoletos; um resultado de 76 não pode ser aplicado depois da seleção de 77.

### Estabilidade visual

Candles de instrumentos não selecionados são armazenados, mas não acionam análise nem renderização. `render()` calcula uma assinatura do estado visual e retorna quando nada mudou. A árvore inicial do Shadow DOM continua sendo criada uma única vez e os cards deixam de ser desmontados por tráfego alheio. Durante uma troca real, os cards anteriores são preservados até a resposta válida do novo instrumento.

## Arquivos e funções alteradas

- `manifest.json`: carrega o módulo multiativo antes do content script.
- `src/multi-asset.js`: chave, estado, seleção, captura, tokens, limites e snapshot de diagnóstico.
- `src/page-bridge.js`: interceptação de saída, correlação e classificação seleção/transmissão.
- `src/content.js`: seleção explícita, estado por instrumento, filtro de atualização visual, versão de análise e assinatura de render.
- `src/background.js`: estado por `sender.tab.id`, análise direcionada e descarte obsoleto.
- `src/shared.js`: migração v11, filtro explícito da análise e limite de quadrantes.
- `dashboard.html` / `src/dashboard.js`: configuração e diagnóstico.
- `tests/multi-asset.test.js`: regressões multiativo.

## Quadrantes analisados

Foi adicionada a configuração persistida `quadrantLimit`: padrão 500, mínimo 20 e máximo 5000. O backtest recebe somente os quadrantes completos mais recentes; o quadrante parcial atual é mantido exclusivamente para o sinal ao vivo. A tela informa limite, disponíveis e efetivamente usados. Alterar o campo reprocessa uma vez; ticks de ativos não selecionados não reprocessam.

## Diagnóstico seguro

O diagnóstico registra: chave/ID selecionados, instrumentos recebendo, símbolo, timeframe, último candle, contagem, requisição atual, descartes e renderizações. Cobertura e formação mostram candles e quadrantes por identidade. Não são lidos ou registrados cookies, tokens, credenciais, saldo ou dados pessoais.

## Testes criados

O teste automatizado cobre: ativo único; dois e três ativos alternados; troca real única; históricos fora de ordem; análise obsoleta; separação normal/OTC; timeframes; ausência de alteração de seleção/render pelo tráfego; e limites/uso dos quadrantes completos.

## Comandos executados e resultados

- `node --check src/content.js src/background.js src/page-bridge.js src/shared.js`: sintaxe válida.
- `node tests/multi-asset.test.js`: regressões aprovadas após alinhar a fixture ao início real de um quadrante.
- Validação de manifest e revisão do diff são executadas antes do commit.

## Limitações restantes

- A IQ Option não publica um contrato estável para mensagens internas. Mudanças nos nomes/contêineres de histórico ou na marcação acessível das abas exigirão atualização dos adaptadores conservadores.
- Sem instrumentação real da conta/plataforma no ambiente automatizado, seletores e payloads reais devem ser validados manualmente.
- O dashboard independente mantém sua visão histórica do ativo mais recente quando aberto fora de uma aba da IQ Option; o painel flutuante é o consumidor vinculado à seleção por aba.

## Validação manual detalhada na IQ Option

1. Em `chrome://extensions`, ative o modo do desenvolvedor e carregue a raiz desta extensão sem compactação.
2. Abra a IQ Option e o console; confirme `BRIDGE_READY` no diagnóstico, sem erros.
3. Abra três pares internos (por exemplo EUR/USD OTC, AUD/CAD OTC e EUR/GBP OTC).
4. Selecione o primeiro e aguarde ao menos 30 segundos.
5. Confirme que o cabeçalho e os cards não alternam, embora o diagnóstico liste os três ativos recebendo candles.
6. Selecione o segundo. Confirme exatamente uma troca no painel e que o primeiro continua presente na cobertura histórica.
7. Aguarde 30 segundos e confirme que candles do primeiro/terceiro não mudam status, cabeçalho, cards ou sinais.
8. Selecione o terceiro e repita a validação.
9. Volte ao primeiro e confirme restauração/reanálise correta sem limpeza global.
10. Altere o timeframe e confirme uma nova chave `activeId:timeframe`, sem misturar candles, quadrantes ou estatísticas.
11. Abra “Análise” > “Diagnóstico”; verifique selecionado, ativos recebendo, últimos candles, contagens, timeframes, quadrantes, limite usado, sequência, descartes e renders.
12. Em “Base da análise”, teste 10, 500 e 6000: os valores devem ser normalizados para 20, 500 e 5000 e persistir após reabrir a página.
13. Confirme a ausência de erros no console e que nenhuma ordem, Call ou Put foi acionada pela extensão.

## Checklist de segurança e escopo

- [x] A causa de identidade foi corrigida antes da otimização visual.
- [x] Estratégias e Gale não foram alterados.
- [x] IndexedDB foi preservado com migração versionada.
- [x] Não há operação automática, backend ou dependência nova.
- [x] Captura multiativo e painel mono-seleção estão separados.
- [x] Respostas históricas e análises antigas não sobrescrevem a seleção atual.

## Refinamento após revisão técnica

### Auditoria da evidência disponível

O repositório não contém capturas reais de Network/console nem fixtures do protocolo da IQ Option. A auditoria do código confirmou que os comandos observáveis possuem nomes, `request_id`, `active_id`, `size`, `from`, `to` e `count` em contêineres conhecidos (`envelope`, `msg`, `body` e `params`), mas não existe no código evidência de que `get-candles` seja exclusivo do gráfico visível. Pelo contrário, a plataforma mantém várias abas e assinaturas, portanto históricos paralelos são plausíveis. Assim:

- `get-candles`/`candles-history` passou a ser exclusivamente uma **solicitação de histórico**;
- subscribe/unsubscribe é exclusivamente estado de **assinatura**;
- `candle-generated`, `candles` e `underlying-list-changed` são exclusivamente **dados recebidos**;
- nenhum desses quatro grupos muda `selectedInstrumentKey`;
- a seleção confirmada exige uma aba DOM com `role="tab"` e estado ativo estruturado (`aria-selected`, `data-active` ou classe ativa), símbolo validado, correspondência no mapa `activeId -> symbol` e duas observações estáveis separadas por 120 ms.

O mapa confiável é alimentado por objetos estruturados do `underlying-list-changed` que contenham simultaneamente ID e campo explícito de símbolo. O campo genérico `name` foi removido da identificação. Nomes de eventos/comandos conhecidos são rejeitados pelo validador.

### Conflitos e idempotência

O resolvedor mantém um candidato pendente. Um candidato diferente antes da confirmação é diagnosticado como contraditório e substitui o anterior, sem aplicação imediata. Duas observações estáveis confirmam a seleção; repetir a mesma evidência depois disso é idempotente. A limitação deliberada é conservadora: se a IQ Option não expuser semântica de aba acessível ou um mapa ID/símbolo, a extensão preserva a última seleção em vez de inferir pelo histórico.

### Snapshots e consistência visual

As análises válidas são armazenadas em `Map<InstrumentKey, AnalysisSnapshot>`, incluindo chave, símbolo, timeframe, instante, cards, contextos, qualidade e quadrantes usados. Na troca, somente um snapshot cuja chave seja idêntica à seleção pode ser exibido. Sem snapshot do novo ativo, cards/contextos anteriores são removidos e o painel mostra sincronização; nunca há cabeçalho novo sobre estatísticas antigas.

### Coalescência de análise

Se chegar um tick enquanto uma análise está em voo, `analysisDirty` é marcado sem abrir outra requisição. Ao concluir, uma única nova análise é enfileirada se a seleção ainda existir. Há intervalo mínimo de 250 ms entre inícios, e versões/chaves continuam descartando respostas antigas.

### Correlações históricas

Cada instância de WebSocket possui seu próprio repositório de correlações, TTL de 60 segundos e máximo de 100 solicitações. Há limpeza a cada 15 segundos e em toda inclusão/consulta; a entrada é consumida na resposta, todas são removidas no fechamento do socket e expirações geram `HISTORY_CORRELATION_EXPIRED`. Respostas tardias geram `HISTORY_UNCORRELATED` e não herdam identidade global.

### Contagem e dashboard

O estado separa `receivedEvents` de `uniqueCandles`. A unicidade usa `activeId:timeframeSec:from` em uma janela limitada às 2.000 chaves recentes por instrumento, evitando crescimento ilimitado; o IndexedDB continua sendo a fonte persistente deduplicada. O dashboard agora possui seleção própria persistida e não muda porque outro ativo produziu o último candle. Mensagens dependentes de captura sem `sender.tab` são rejeitadas, em vez de compartilhar estado artificial `-1`.

### Testes integrados adicionados

`tests/integration-replay.test.js` usa os módulos reais do bridge, normalizador, estado e análise para reproduzir: três históricos paralelos sem seleção; respostas fora de ordem; realtime multiativo; seleção DOM confirmada única; snapshots isolados; símbolos genéricos rejeitados; contagem evento/vela; coalescência; TTL; e análise final filtrada. Os testes puros anteriores foram preservados.

### Validação manual complementar

Além do roteiro anterior, inspecione no DevTools os payloads de saída e confirme os contêineres reais de `request_id` e parâmetros. Clique alternadamente nas abas internas e verifique um único diagnóstico de seleção confirmada. Dispare/reproduza históricos em segundo plano e confirme apenas `HISTORY_REQUEST`, sem sincronização visual. Aguarde mais de 60 segundos antes de uma resposta simulada/tardia e confirme `HISTORY_UNCORRELATED`. Esses pontos dependem da interface e do protocolo reais, indisponíveis no ambiente automatizado.

## Sincronização em tempo real entre dashboard e painel flutuante

### Problema anterior

As alterações persistidas pelo dashboard só alcançavam o painel na chegada de outro candle ou no polling de cinco segundos. O IndexedDB não dispara `chrome.storage.onChanged`; portanto esse mecanismo não resolveria mudanças de estratégias. O polling foi preservado exclusivamente como recuperação.

### Arquitetura e contrato

Após `IQLAB.updateStrategy()` ou `IQLAB.setSetting()` concluir sua transação, o helper único `publishConfigurationChange()` envia `CONFIGURATION_CHANGED`. O background valida e completa o contrato com `type`, `strategyId` opcional, `optimisticRemove`, revisão monotônica, motivo, instante e origem. Em seguida consulta todas as abas IQ Option e envia `CONFIGURATION_INVALIDATED` individualmente. Falha em uma aba é coletada no diagnóstico da publicação e não impede as demais.

As mutações existentes na versão 0.9.5 são `active`, `floating`, `recommendationMode` e `quadrantLimit`; todas publicam depois da persistência. A interface atual não possui criação, edição livre, duplicação, exclusão, importação ou restauração manual de estratégias. Nenhuma regra/Gale inexistente foi inventada. Se esses CRUDs forem adicionados, devem usar o mesmo helper após a respectiva transação.

### Revisão, snapshots e concorrência

`iqCandleLabConfigurationRevision` vive em `chrome.storage.local`, enquanto IndexedDB permanece a fonte dos dados. Incrementos são serializados e recuperados depois de uma suspensão/recriação do service worker. O content ignora revisões duplicadas/antigas, invalida todos os snapshots e só reutiliza um snapshot quando chave e revisão coincidem. Cada requisição e resposta `FLOATING_ANALYSIS` carrega a revisão; background e content descartam uma resposta se a revisão mudar durante o cálculo.

Desativar uma estratégia ou retirar `floating` remove o card inequivocamente assim que a invalidação chega, antes do recálculo confirmatório. Ativação, modo, limite e demais mudanças existentes solicitam recálculo imediato. Mudanças ocorridas durante análise entram em `pendingReasons`, marcam `analysisDirty` e geram no máximo uma análise consolidada com a revisão mais recente.

### Múltiplas abas, loops e polling

Cada aba recebe a mesma invalidação, mas mantém seu próprio `TabState` e recalcula apenas seu `selectedInstrumentKey`. Content scripts não republicam mensagens, mensagens antigas são idempotentes e polling/candles nunca incrementam a revisão. O polling de cinco segundos usa a coalescência existente e a assinatura visual impede render sem mudança.

### Observer e diagnóstico

O observer global de atributos foi removido. Um observer temporário acompanha somente inserções até encontrar conservadoramente a região da aba ativa; depois, apenas esse contêiner recebe observação de atributos. A inspeção é limitada a uma execução agendada a cada 100 ms. O diagnóstico inclui revisão, última mudança, motivo, snapshots invalidados, duplicatas, latência dashboard→painel, razões pendentes, inspeções DOM e candidatos descartados. A publicação no dashboard informa abas notificadas e falhas.

### Testes adicionados

`tests/configuration-sync.test.js` simula persistência/publicação, duas abas independentes, remoção imediata, ativação, edição, modo, limite, duplicatas, mensagem antiga, análise obsoleta, recuperação de revisão após reinício e escopo do observer. O replay comprova atualização sem candle e sem polling. Os testes multiativo e de protocolo anteriores continuam ativos.

### Validação manual

1. Instale a extensão atualizada, abra a IQ Option e confirme o painel flutuante.
2. Abra `dashboard.html` e mantenha as duas páginas visíveis.
3. Desative uma estratégia flutuante e confirme desaparecimento imediato, sem candle novo.
4. Reative-a e confirme o recálculo; depois retire `Mostrar flutuante` e confirme nova remoção imediata.
5. Alterne clássico/analítico e confirme atualização do badge/cards sem aguardar cinco segundos.
6. Troque o limite de 500 para 200 e confirme `quadrantsUsed` na análise/diagnóstico.
7. Repita com duas abas Chrome da IQ Option, mantendo instrumentos internos diferentes. Ambas devem atualizar sem compartilhar seleção.
8. Confirme no diagnóstico revisões crescentes, latência, abas notificadas e zero/erros esperados de envio.
9. Confirme que nenhuma página precisou de refresh e que os consoles permanecem sem erros.

### Limitações

A validação real de suspensão do service worker, latência entre processos e identificação do contêiner de abas depende do Chrome com a IQ Option aberta. O teste automatizado usa mocks fiéis às APIs chamadas, mas não substitui essa verificação manual.

## Carga histórica e inicialização progressiva da análise

### Diagnóstico e causa encontrada

A auditoria estática percorreu `WebSocket.send(get-candles) → store por socket → message(candles) → IQ_CANDLE_LAB_BRIDGE → content → normalizeCandleDetailed → background → IndexedDB → buildQuadrants → analyze → painel/dashboard`. A causa relevante era dupla: o bridge consumia histórico exclusivamente por `request_id`, enquanto respostas sem esse campo ficavam sem correlação; ainda assim o content encaminhava o lote, e o normalizador aplicava os defaults perigosos `activeId = unknown` e timeframe M1. Além disso, não havia diagnóstico agregado dos motivos de rejeição. O limite já era aplicado por `slice(-quadrantLimit)` e não bloqueava explicitamente a análise, mas a interface não distinguia limite, disponibilidade e mínimo, tornando a ausência de base persistida indistinguível de uma espera por 500.

O repositório não contém HAR, captura de Network, console de uma sessão real ou fixture bruta da IQ Option. Portanto não é possível afirmar quantas solicitações a plataforma faz, quantos candles fornece por lote, se uma solicitação produz múltiplas respostas, nem se a quantidade entregue alcança 2.500 M1 (500 quadrantes). Os campos comprovados pelos fixtures existentes são `name=get-candles`, `request_id`, `body.active_id`, `body.size` (período) e `body.count` (quantidade). O código permanece somente observador; não envia pedidos próprios.

### Fluxo histórico corrigido

O adaptador de comando examina apenas contêineres conhecidos (`value`, `msg`, `body`, `params`, `msg.body` e `msg.params`) e registra `requestId`, `activeId`, `timeframeSec`, `requestedCount`, `from`, `to`, `requestedAt` e `socketId`. Uma resposta com ID usa correspondência exata. Sem ID, ela usa a fila somente quando existe exatamente uma solicitação pendente naquela instância de WebSocket; duas ou mais entradas são ambíguas e o lote não recebe identidade. A entrada é consumida após a resposta. Como não há fixture demonstrando múltiplas respostas por pedido, reter uma correlação consumida seria uma associação não comprovada e não foi implementado.

Um lote não correlacionado gera um único `HISTORY_UNCORRELATED` estruturado com ID (ou `null`), quantidade detectável, socket, instante e motivo. O content não o encaminha à persistência. Para lotes correlacionados, o background registra uma linha `HISTORY_BATCH` com recebidos, normalizados, descartados, persistidos e contadores por motivo (`missing-active-id`, `missing-timeframe`, `invalid-time`, `invalid-ohlc` e `uncorrelated-history`, quando aplicável). A chave do IndexedDB continua deduplicando `activeId + timeframeSec + from`; não há religação pelo ativo selecionado.

### `closed`, timeframe e quadrantes

Histórico não é marcado fechado apenas por sua origem. A vela é fechada quando o payload a marca explicitamente ou quando `to` já terminou antes do instante atual; assim o último período ainda em formação permanece aberto. O timeframe histórico vem da solicitação correlacionada. No adaptador comprovado, `size` é período e `count` é quantidade; `count` nunca chega ao normalizador como timeframe. Quando `from/to` comprovam uma duração conhecida, essa duração prevalece. Valores ausentes/desconhecidos são rejeitados, sem fallback histórico para 60.

`buildQuadrants` mantém somente M1 fechados, normaliza segundos/milissegundos na entrada, ordena cronologicamente, deduplica cada posição pela atualização mais recente e exige os minutos consecutivos 00–04, 05–09 etc. O diagnóstico agora inclui M1 armazenados/fechados, primeiro/último timestamp, minutos únicos, duplicidades, lacunas, sequência máxima e quadrantes completos/parciais.

### Limite, mínimo e inicialização progressiva

`quadrantLimit` é exclusivamente o máximo recente. `completeQuadrantsAvailable` é a quantidade completa no banco e `quadrantsUsed = min(disponíveis, limite)`. `minimumQuadrantsRequired` é derivado das estratégias ativas: regras comuns precisam de um quadrante e `two_quadrants_majority` precisa de dois; quando há estratégias com mínimos diferentes, a análise progressiva fica disponível assim que ao menos uma delas pode trabalhar. Nenhuma exigência global de 500 foi criada e regras/Gale não mudaram.

Ao confirmar a seleção, o content solicita imediatamente `FLOATING_ANALYSIS`. O background consulta todo o IndexedDB e filtra pela chave selecionada, de modo que uma sessão reaberta analisa dados existentes sem aguardar WebSocket. Lotes históricos correlacionados são persistidos em uma transação e provocam uma análise consolidada; a fila já existente coalesce eventos concorrentes. Seleção, configuração e realtime relevante continuam acionando atualização.

Dashboard e painel exibem limite, completos disponíveis, usados, ausentes e um dos estados: sem quadrante/capturando, análise parcial ou base completa. Estatísticas continuam calculáveis com amostra reduzida; cada estratégia preserva seu próprio comportamento de amostra.

### Paginação e limitações

Não foi implementada paginação. Não há evidência de protocolo, máximo por chamada, cursor/paginação ou comportamento de múltiplos lotes que autorize a extensão a transmitir `get-candles`. Assim, **não é possível confirmar neste ambiente que a IQ Option fornece histórico suficiente sozinha**. A correção aproveita integralmente o que a página já solicitar e correlacionar. Se a observação manual demonstrar menos que o necessário, uma paginação controlada deverá ser uma etapa posterior, baseada em payload real e limites comprovados.

### Testes automatizados adicionados

`tests/history-progressive.test.js` cobre os 12 cenários solicitados: 2.500/500; 250/50; vazio e primeiro quadrante; lote de mil; ausência de correlação; ordem decrescente; fechamento histórico seguro; separação size/count e M1; refresh na seleção com banco existente; limite maior que 37; lacunas; e deduplicação histórico/realtime. Também testa o fallback de fila unívoco e sua recusa quando ambíguo.

### Roteiro manual com evidência real

1. Limpe apenas o diagnóstico (não o banco), recarregue a extensão e abra DevTools/Network da IQ Option.
2. Registre, para cada `get-candles`, socket, contêiner, `request_id`, `active_id`, `size`, `count`, `from/to/end` e horário.
3. Conte respostas `candles`, seus contêineres, IDs e número de itens; verifique múltiplas respostas para o mesmo pedido.
4. Selecione um ativo com banco preexistente e confirme análise antes de qualquer novo candle.
5. Compare `HISTORY_REQUEST`, `HISTORY_BATCH` e `HISTORY_UNCORRELATED`; um lote ambíguo não pode aumentar o banco.
6. Confira no dashboard primeiro/último M1, fechados, lacunas, completos, limite, disponíveis, utilizados e ausentes.
7. Com limite 500 e menos dados, confirme “Análise parcial”; com zero, confirme a explicação de captura.
8. Reabra o Chrome/extension sem apagar IndexedDB e confirme análise imediata após a identificação do instrumento.
9. Exporte os payloads anonimizados para fixtures antes de considerar paginação ou suporte a múltiplas respostas por solicitação.

### Refinamento: disponibilidade estrutural, persistência e fixtures do protocolo

A disponibilidade deixou de ser um mínimo global calculado por `Math.min`. `getStrategyMinimumQuadrants()` centraliza o requisito observado em `signalForStrategy`: `previous_majority`, `previous_minority`, posições Q1/Q5, alternância e padrões 4×1 usam um quadrante completo; `two_quadrants_majority` usa dois. Os aliases `position_repeat` e `position_inverse` também são reconhecidos sem alterar as regras existentes. Cada backtest informa seu requisito, disponibilidade, motivo de indisponibilidade, métricas, sinal e recomendação. Uma estratégia abaixo do mínimo recebe métricas explicitamente insuficientes (`rate: null`) e não executa backtest, sinal ou recomendação.

O status global considera somente estratégias ativas e marcadas para o painel flutuante: `waiting-identity` sem identidade confirmada; `waiting-history` sem quadrante completo; `insufficient` quando nenhuma estratégia aplicável alcança o mínimo; `partial` quando ao menos uma pode executar abaixo do teto; e `complete` quando a quantidade usada alcança `quadrantLimit`. O painel e dashboard mostram requisito estrutural sem apresentar 0% como estatística, além de limite, disponíveis, usados, distância até o teto e contagens de estratégias disponíveis/indisponíveis.

`putCandles()` não chama mais todo `put` de persistência nova. Uma leitura consolidada na mesma transação classifica `inserted`, `updated`, `unchanged` e `written`; timestamps de captura e origem não criam atualização falsa. Antes da transação, `prepareCandleBatch()` normaliza e deduplica o lote, informando `received`, `normalized`, `rejected`, `uniqueInBatch` e motivos agregados. Assim, “written” significa somente inserção ou alteração efetiva, nunca “novos candles”.

O diagnóstico `HISTORY_UNCORRELATED` inclui `socketId`, `requestId`, evento, quantidade da resposta, total pendente e resumo limitado a ID/ativo/timeframe/count/from/to/idade. A associação ao ativo selecionado continua proibida. Cada socket mantém apenas seu próprio store, TTL e limite.

O modo opcional **Diagnóstico do protocolo** fica desativado por padrão e limita a 100 fixtures por ciclo habilitado. Ele registra somente direção, evento, socket, IDs, contexto histórico, contagens, primeiro/último timestamp, horários e caminhos estruturais relevantes. Valores de payload, cookies, tokens, saldo e dados de conta nunca entram na fixture. O dashboard permite habilitar o modo e exportar JSON anonimizado com até 100 registros persistidos.

Para exportar: abra **Diagnóstico**, habilite **Diagnóstico do protocolo**, provoque a carga normal de histórico navegando pelos ativos e clique em **Exportar fixtures**. Compare solicitações/respostas pelos IDs, contagens, timestamps e `structurePaths`. A evidência ainda necessária antes de paginação é: cursor real (`from`, `to` ou `end`), máximo por página, repetição de `request_id`, cardinalidade pedido/resposta e condição de parada. A extensão permanece observadora: usa todo histórico disponibilizado pela IQ Option, mas não promete preencher o teto nem transmite `get-candles` complementar.

Os testes adicionais cobrem mínimos individuais, status insuficiente/parcial/completo, classificação de 100 inserções com duplicatas e registros existentes/alterados, inicialização funcional orientada à seleção com base persistida, lote único de mil, histórico ambíguo com duas pendências, fixture sem campos sensíveis e cards sem percentual/recomendação enganosa. A validação do volume e formato reais continua dependente de uma sessão manual na IQ Option.

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

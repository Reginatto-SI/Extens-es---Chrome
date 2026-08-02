const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Multi = require('../src/multi-asset.js');
const Bridge = require('../src/page-bridge.js');

function raw(activeId, from, symbol) {
  return { active_id: activeId, symbol, from, to: from + 60, open: 1, close: 1.1, max: 1.2, min: .9 };
}

async function run() {
  // Bridge real: pedidos de histórico correlacionam, mas não produzem evidência de seleção.
  const correlations = Bridge.createCorrelationStore({ ttlMs: 100, max: 3 });
  const tab = Multi.createTabState(42);
  Multi.selectInstrument(tab, { activeId: 76, timeframeSec: 60, symbol: 'EURUSD-OTC' });
  for (const id of [76, 86, 77]) {
    const command = { name: 'get-candles', request_id: `req-${id}`, body: { active_id: id, size: 60, count: 100 } };
    correlations.add(Bridge.requestId(command), Bridge.commandContext(command), 1000);
  }
  assert.equal(correlations.size(), 3);
  assert.equal(tab.selectedInstrumentKey, '76:60');

  // Respostas fora de ordem percorrem bridge -> normalização -> estado/background simulado.
  const sandbox = { console, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/multi-asset.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/shared.js'), 'utf8'), sandbox);
  vm.runInContext('globalThis.__IQLAB = IQLAB', sandbox);
  const stored = [];
  for (const id of [77, 86, 76]) {
    const correlation = correlations.take(`req-${id}`, 1050);
    const normalized = sandbox.__IQLAB.normalizeCandle(raw(id, 600, `${id}-OTC`), { ...correlation, origin: 'history' });
    stored.push(normalized);
  }
  Multi.recordCandles(tab, stored);
  assert.deepEqual(stored.map(c => String(c.activeId)), ['77', '86', '76']);
  assert.equal(tab.selectedInstrumentKey, '76:60');

  // Realtime de outros ativos é catalogado sem alterar estado interno selecionado.
  Multi.recordCandles(tab, [
    sandbox.__IQLAB.normalizeCandle(raw(76, 660, 'EURUSD-OTC')),
    sandbox.__IQLAB.normalizeCandle(raw(86, 660, 'AUDCAD-OTC')),
    sandbox.__IQLAB.normalizeCandle(raw(77, 660, 'EURGBP-OTC'))
  ]);
  assert.equal(tab.selectedInstrumentKey, '76:60');

  // Uma evidência DOM estável confirma exatamente uma troca; eventos não repetem a troca.
  const resolver = Multi.createSelectionResolver({ settleMs: 10 });
  const evidence = { source:'active-dom-tab', activeId:77, timeframeSec:60, symbol:'EURGBP-OTC', confidence:.95 };
  assert.equal(resolver.consider(tab, { ...evidence, observedAt: 2000 }).applied, false);
  assert.equal(resolver.consider(tab, { ...evidence, observedAt: 2020 }).applied, true);
  assert.equal(tab.selectedInstrumentKey, '77:60');
  assert.equal(resolver.consider(tab, { ...evidence, observedAt: 2040 }).idempotent, true);

  // Snapshot errado nunca pode alimentar a view do instrumento novo.
  const snapshots = new Map([['76:60', { instrumentKey:'76:60', floating:['card-76'] }]]);
  assert.equal(Multi.snapshotForSelection(snapshots, '77:60'), null);
  snapshots.set('77:60', { instrumentKey:'77:60', floating:['card-77'] });
  assert.deepEqual(Multi.snapshotForSelection(snapshots, '77:60').floating, ['card-77']);

  // Eventos genéricos nunca passam pela validação de símbolo.
  for (const name of ['candle-generated','candles','quote-generated','underlying-list-changed','subscribeMessage','unsubscribeMessage','get-candles']) {
    assert.equal(Multi.validSymbol(name), null);
  }

  // Duplicatas contam eventos recebidos, mas uma única vela.
  const duplicateTab = Multi.createTabState(43);
  Multi.recordCandles(duplicateTab, [stored[0], stored[0], stored[0]]);
  assert.equal(duplicateTab.instruments.get('77:60').receivedEvents, 3);
  assert.equal(duplicateTab.instruments.get('77:60').uniqueCandles, 1);

  // A decisão usada pelo content coalesce ticks: um em voo, dirty e uma repetição ao concluir.
  assert.equal(Multi.analysisQueueAction(false), 'start');
  assert.equal(Multi.analysisQueueAction(true), 'mark-dirty');
  assert.equal(Multi.shouldRerunAnalysis(true, '77:60'), true);
  assert.equal(Multi.shouldRerunAnalysis(false, '77:60'), false);

  // Correlação expirada é removida e uma resposta tardia fica sem identidade herdada.
  const expiring = Bridge.createCorrelationStore({ ttlMs: 50 });
  expiring.add('old', { activeId: 86, timeframeSec: 60 }, 1000);
  assert.equal(expiring.take('old', 1100), null);
  assert.equal(expiring.expiredCount(), 1);

  // Análise real retorna apenas o instrumento selecionado, completando o replay até a resposta/view.
  const analysis = await sandbox.__IQLAB.analyze(stored, [], { activeId:77, timeframeSec:60, quadrantLimit:500 });
  assert.equal(String(analysis.currentAssetId), '77');
  assert.equal(analysis.symbol, '77-OTC');
  console.log('integrated multi-asset replay: ok');
}

run().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Multi = require('../src/multi-asset.js');

function candle(activeId, timeframeSec = 60, symbol = `ACTIVE-${activeId}`, from = 1) {
  return { activeId, timeframeSec, symbol, from, origin: 'realtime', capturedAt: from * 1000 };
}

// 1–4 e 9: candles concorrentes nunca alteram seleção/renderização.
{
  const tab = Multi.createTabState(10);
  assert.equal(Multi.selectInstrument(tab, candle(76), 'teste'), true);
  const version = tab.selectionVersion;
  Multi.recordCandles(tab, [candle(76), candle(86), candle(76, 60, 'EURUSD-OTC', 2), candle(86, 60, 'AUDCAD-OTC', 2)]);
  assert.equal(tab.selectedInstrumentKey, '76:60');
  assert.equal(tab.instruments.get('76:60').candleCount, 2);
  assert.equal(tab.instruments.get('86:60').candleCount, 2);
  assert.equal(tab.selectionVersion, version);
  Multi.recordCandles(tab, [candle(77), candle(86)]);
  assert.equal(tab.selectedInstrumentKey, '76:60');
  assert.equal(Multi.selectInstrument(tab, candle(77), 'troca real'), true);
  assert.equal(Multi.selectInstrument(tab, candle(77), 'duplicada'), false);
  Multi.recordCandles(tab, [candle(76), candle(86)]);
  assert.equal(tab.selectedInstrumentKey, '77:60');
}

// 5: respostas históricas fora de ordem permanecem na identidade correlacionada.
{
  const tab = Multi.createTabState(11);
  Multi.recordCandles(tab, [
    { ...candle(77, 60, 'EURGBP-OTC'), origin: 'history' },
    { ...candle(76, 60, 'EURUSD-OTC'), origin: 'history' }
  ]);
  assert.equal(tab.instruments.get('76:60').lastHistoricalAt, 1000);
  assert.equal(tab.instruments.get('77:60').lastHistoricalAt, 1000);
}

// 6: resultado assíncrono anterior não pode ser aplicado após troca.
{
  const tab = Multi.createTabState(12);
  Multi.selectInstrument(tab, candle(76));
  const old = Multi.beginAnalysis(tab);
  Multi.selectInstrument(tab, candle(77));
  const current = Multi.beginAnalysis(tab);
  assert.equal(Multi.mayApplyAnalysis(tab, current), true);
  assert.equal(Multi.mayApplyAnalysis(tab, old), false);
  assert.equal(tab.discardedAnalyses, 1);
}

// 7–8: activeId e timeframe compõem a chave, inclusive normal/OTC.
assert.notEqual(Multi.instrumentKey(1, 60), Multi.instrumentKey(76, 60));
assert.notEqual(Multi.instrumentKey(76, 60), Multi.instrumentKey(76, 300));

// 10: limite padrão e bordas persistíveis.
assert.equal(Multi.clampQuadrantLimit(undefined), 500);
assert.equal(Multi.clampQuadrantLimit(10), 20);
assert.equal(Multi.clampQuadrantLimit(9000), 5000);
assert.equal(Multi.clampQuadrantLimit(750), 750);

// Verifica a implementação real de análise: somente os últimos completos são usados.
{
  const context = { console, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/multi-asset.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/shared.js'), 'utf8'), context);
  const rows = [];
  const now = Math.floor((Math.floor(Date.now() / 1000) - 100000) / 300) * 300;
  for (let q = 0; q < 30; q++) for (let p = 0; p < 5; p++) {
    const from = now + q * 300 + p * 60;
    rows.push({ id:`76|60|${from}`, activeId:76, symbol:'EURUSD-OTC', timeframeSec:60,
      from, to:from+60, open:1, close:1.1, high:1.2, low:.9, color:'green', closed:true });
  }
  vm.runInContext('globalThis.__analyze = IQLAB.analyze', context);
  context.__analyze(rows, [], { activeId: 76, timeframeSec: 60, quadrantLimit: 20 }).then(result => {
    assert.equal(result.completeQuadrantsAvailable, 30);
    assert.equal(result.quadrantsUsed, 20);
    console.log('multi-asset regression tests: ok');
  }).catch(error => { console.error(error); process.exitCode = 1; });
}

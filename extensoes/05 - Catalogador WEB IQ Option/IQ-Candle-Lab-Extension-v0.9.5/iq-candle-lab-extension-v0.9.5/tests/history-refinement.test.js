const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Bridge = require('../src/page-bridge.js');

const sandbox = { console, setTimeout, clearTimeout };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/multi-asset.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/shared.js'), 'utf8'), sandbox);
vm.runInContext('globalThis.lab = IQLAB; globalThis.multi = IQLABMultiAsset', sandbox);
const Lab = sandbox.lab;
const base = Math.floor((Date.now()/1000 - 2_000_000)/300)*300;
function rows(quadrants) {
  return Array.from({ length:quadrants*5 }, (_, i) => {
    const from = base + i*60;
    return { id:`76|60|${from}`, activeId:76, symbol:'EURUSD-OTC', timeframeSec:60,
      from, to:from+60, open:1, close:1.1, high:1.2, low:.9, color:'green', closed:true, schemaVersion:1 };
  });
}
const one = { id:'one', type:'previous_majority', active:true, floating:true, galeLevel:0 };
const two = { id:'two', type:'two_quadrants_majority', active:true, floating:true, galeLevel:0 };
async function analyze(quadrants, strategies=[one,two], limit=500) {
  return Lab.analyze(rows(quadrants), strategies, { activeId:76, timeframeSec:60, quadrantLimit:limit });
}

(async () => {
  // 1 — mínimos são individuais e a estratégia estruturalmente insuficiente não calcula taxa/sinal.
  const individual = await analyze(1);
  const first = individual.backtests.find(item => item.strategy.id === 'one');
  const second = individual.backtests.find(item => item.strategy.id === 'two');
  assert.equal(first.analysisAvailable, true);
  assert.equal(second.analysisAvailable, false);
  assert.equal(second.metrics.rate, null); assert.equal(second.liveSignal, null); assert.equal(second.recommendation, null);
  assert.equal(Lab.getStrategyMinimumQuadrants({ type:'position_repeat' }), 1);
  assert.equal(Lab.getStrategyMinimumQuadrants({ type:'position_inverse' }), 1);

  // 2 — somente 2Q com um quadrante é insuficiente globalmente.
  const insufficient = await analyze(1, [two]);
  assert.equal(insufficient.analysisStatus, 'insufficient'); assert.equal(insufficient.analysisAvailable, false);
  // 3/4 — parcial requer estratégia executável; completa atinge o teto configurado.
  const partial = await analyze(20, [one]);
  assert.equal(partial.analysisStatus, 'partial'); assert.equal(partial.analysisAvailable, true);
  assert.equal((await analyze(500, [one])).analysisStatus, 'complete');

  // 5 — lote, inserções, atualizações e inalterados possuem contagens honestas.
  const rawItems = rows(20).map(c => ({ raw:{ ...c, active_id:76 }, context:{ origin:'history', activeId:76, timeframeSec:60 } }));
  rawItems.push(...rawItems.slice(0,20));
  const prepared = Lab.prepareCandleBatch(rawItems);
  assert.equal(prepared.uniqueInBatch, 100); assert.equal(prepared.rejectedByReason.duplicate, 20);
  const existing = prepared.candles.slice(0,15).map(c => ({ ...c }));
  const incoming = prepared.candles.map((c,i) => i < 5 ? { ...c, close:1.15, color:'green' } : c);
  const writes = Lab.classifyCandleWrites(existing, incoming);
  assert.deepEqual({ inserted:writes.inserted, updated:writes.updated, unchanged:writes.unchanged, written:writes.written },
    { inserted:85, updated:5, unchanged:10, written:90 });

  // 6 — recarga/seleção executa uma análise sobre a base preexistente sem candle novo.
  let selected = 0, rendered = 0, floatingCalls = 0, visible = null;
  const persisted = rows(5);
  await sandbox.multi.runConfirmedSelectionFlow({
    notifySelection: async () => { selected++; }, renderSelection: () => { rendered++; },
    refreshAnalysis: async reason => { floatingCalls++; assert.equal(reason, 'selection'); visible = await Lab.analyze(persisted, [one], { activeId:76, timeframeSec:60, quadrantLimit:500 }); }
  });
  assert.deepEqual([selected, rendered, floatingCalls, visible.quadrantsUsed], [1,1,1,5]);

  // 7 — mil candles permanecem em um lote, uma persistência e uma análise consolidada.
  const thousand = rows(200).map(c => ({ raw:{ ...c, active_id:76 }, context:{ origin:'history', activeId:76, timeframeSec:60 } }));
  let persistenceCalls = 0, analysisCalls = 0, renderCalls = 0;
  const consolidated = Lab.prepareCandleBatch(thousand); persistenceCalls++;
  await Lab.analyze(consolidated.candles, [one], { activeId:76, timeframeSec:60, quadrantLimit:500 }); analysisCalls++;
  renderCalls++;
  assert.deepEqual([consolidated.uniqueInBatch, persistenceCalls, analysisCalls, renderCalls], [1000,1,1,1]);

  // 8 — sem ID e com duas pendências, nenhuma correlação; resumo contém somente metadados seguros.
  const pending = Bridge.createCorrelationStore();
  pending.add('a', { activeId:76, timeframeSec:60, requestedCount:100, from:1, to:2 }, 1000);
  pending.add('b', { activeId:77, timeframeSec:60, requestedCount:200, from:3, to:4 }, 1000);
  assert.equal(pending.takeUnambiguous(1050), null);
  const summary = pending.summary(1050);
  assert.equal(summary.length, 2); assert.deepEqual(Object.keys(summary[0]),
    ['requestId','activeId','timeframeSec','requestedCount','from','to','ageMs']);

  // 9 — fixture exportável contém caminhos/metadados, jamais payload ou campos sensíveis.
  const payload = { request_id:'r1', token:'secret', balance:999, msg:{ body:{ active_id:76, size:60, count:100 }, candles:[{ from:1 },{ from:2 }] } };
  const fixture = Bridge.protocolFixture('incoming', payload, { socketId:'ws-1', correlation:{ activeId:76, timeframeSec:60 } }, 2000);
  const encoded = JSON.stringify(fixture);
  assert.equal(fixture.candleCount, 2); assert.ok(fixture.structurePaths.includes('msg.candles[]'));
  assert.doesNotMatch(encoded, /secret|999|token|balance|payload/i);

  // 10 — o template do card insuficiente não apresenta porcentagem ou recomendação.
  const content = fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf8');
  const insufficientCard = content.match(/if \(!item\.analysisAvailable\) return `([\s\S]*?)`;/)[1];
  assert.match(insufficientCard, /Amostra estrutural insuficiente/);
  assert.doesNotMatch(insufficientCard, /%|recommendation|metrics\.rate/);
  console.log('historical refinement tests: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });

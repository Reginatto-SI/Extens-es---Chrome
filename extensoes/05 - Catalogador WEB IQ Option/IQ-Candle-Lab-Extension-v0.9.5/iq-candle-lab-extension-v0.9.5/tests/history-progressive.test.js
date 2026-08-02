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
const base = Math.floor((Date.now() / 1000 - 2_000_000) / 300) * 300;
function candles(count, options = {}) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    if (options.gaps?.includes(i)) continue;
    const from = base + i * 60;
    rows.push({ id:`76|60|${from}`, activeId:76, symbol:'EURUSD-OTC', timeframeSec:60,
      from, to:from+60, open:1, close:1.1, high:1.2, low:.9, color:'green', closed:true });
  }
  return options.reverse ? rows.reverse() : rows;
}
async function analyze(rows, limit = 500, strategies = [{ type:'previous_majority', active:true, floating:true }]) {
  return Lab.analyze(rows, strategies, { activeId:76, timeframeSec:60, quadrantLimit:limit });
}

(async () => {
  // 1 — o histórico suficiente já armazenado inicia com os 500 quadrantes, sem tick novo.
  assert.equal((await analyze(candles(2500))).quadrantsUsed, 500);
  // 2 — 250 candles formam e usam 50, sem aguardar o limite 500.
  const partial = await analyze(candles(250));
  assert.equal(partial.quadrantsUsed, 50); assert.equal(partial.analysisStatus, 'partial');
  // 3 — vazio aguarda; cinco fechados liberam a estratégia de um quadrante.
  assert.equal((await analyze([])).analysisStatus, 'waiting-history');
  assert.equal((await analyze(candles(5))).analysisAvailable, true);
  // 4 — um lote de mil itens válidos normaliza integralmente e forma 200 quadrantes.
  const correlation = { activeId:76, timeframeSec:60, origin:'history' };
  const batch = candles(1000).map(c => Lab.normalizeCandle({ ...c, active_id:76 }, correlation));
  assert.equal(batch.filter(Boolean).length, 1000); assert.equal((await analyze(batch)).quadrantsUsed, 200);
  // 5 — histórico sem correlação é rejeitado, sem fallback para o selecionado.
  assert.equal(Lab.normalizeCandleDetailed({ from:base, to:base+60, open:1, close:2, high:2, low:1 }, { origin:'history' }).reason, 'uncorrelated-history');
  // 6 — ordem decrescente não altera a formação.
  assert.equal((await analyze(candles(185, { reverse:true }))).quadrantsUsed, 37);
  // 7 — histórico passado fecha; o período futuro não é fechado por origem apenas.
  const past = Lab.normalizeCandle({ active_id:76, from:base, to:base+60, open:1, close:2, max:2, min:1 }, correlation);
  const future = Math.floor(Date.now()/60000)*60 + 120;
  const open = Lab.normalizeCandle({ active_id:76, from:future, to:future+60, open:1, close:2, max:2, min:1 }, correlation);
  assert.equal(past.closed, true); assert.equal(open.closed, false);
  // 8 — size é período somente no adaptador get-candles; count nunca vira timeframe.
  const command = { name:'get-candles', request_id:'r', body:{ active_id:76, size:60, count:100 } };
  assert.deepEqual(Bridge.commandContext(command), { activeId:76, timeframeSec:60, from:null, to:null, requestedCount:100 });
  assert.equal(Bridge.commandContext({ name:'get-candles', body:{ active_id:76, size:100, count:60 } }).timeframeSec, undefined);
  assert.equal(Lab.normalizeCandle({ active_id:76, from:base, to:base+300, open:1, close:2, max:2, min:1 }, correlation).timeframeSec, 300);
  // 9 — o fluxo confirmado consulta a análise persistida sem depender de WebSocket.
  let notified = 0, rendered = 0, analyzed = 0;
  await sandbox.multi.runConfirmedSelectionFlow({
    notifySelection: async () => { notified++; }, renderSelection: () => { rendered++; },
    refreshAnalysis: async reason => { assert.equal(reason, 'selection'); analyzed++; await analyze(candles(25)); }
  });
  assert.deepEqual([notified, rendered, analyzed], [1, 1, 1]);
  // 10 — 37 disponíveis significam 37 usados e amostra reduzida.
  const thirtySeven = await analyze(candles(185));
  assert.equal(thirtySeven.completeQuadrantsAvailable, 37); assert.equal(thirtySeven.quadrantsUsed, 37);
  // 11 — lacunas impedem somente quadrantes incompletos e aparecem no diagnóstico.
  const gapped = candles(100, { gaps:[2, 17] });
  const gapAnalysis = await analyze(gapped);
  assert.equal(gapAnalysis.completeQuadrantsAvailable, 18);
  assert.ok(Object.keys(gapAnalysis.captureDiagnostics.gapHistogram).length > 0);
  // 12 — histórico/realtime com a mesma identidade deduplica na formação.
  const duplicate = [...candles(5), { ...candles(5)[0], origin:'realtime', updatedAt:Date.now() }];
  assert.equal((await analyze(duplicate)).completeQuadrantsAvailable, 1);
  // Fila sem request_id só correlaciona quando não existe ambiguidade no mesmo socket.
  const queue = Bridge.createCorrelationStore();
  queue.add('one', { activeId:76, timeframeSec:60, socketId:'ws-1' });
  assert.equal(queue.takeUnambiguous().activeId, 76);
  queue.add('a', { activeId:76 }); queue.add('b', { activeId:77 });
  assert.equal(queue.takeUnambiguous(), null);
  console.log('historical progressive analysis tests: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });

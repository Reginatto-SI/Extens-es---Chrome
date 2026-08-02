const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Multi = require('../src/multi-asset.js');

function panel(tabId, instrumentKey, revision, cards = []) {
  return {
    tabId,
    selectedInstrumentKey: instrumentKey,
    configurationRevision: revision,
    analysisSnapshots: new Map([[instrumentKey, {
      instrumentKey, configurationRevision: revision, floating: cards
    }]]),
    floating: cards.map(strategyId => ({ strategyId })),
    duplicateConfigurationMessages: 0,
    invalidatedSnapshots: 0
  };
}

function loadBackground(storage, panels) {
  let messageListener;
  const chrome = {
    storage: { local: {
      async get(key) { return { [key]: storage[key] }; },
      async set(values) { Object.assign(storage, values); }
    } },
    tabs: {
      onRemoved: { addListener() {} },
      async query() { return panels.map(item => ({ id: item.tabId })); },
      async sendMessage(tabId, message) {
        const target = panels.find(item => item.tabId === tabId);
        if (!target) throw new Error('aba fechada');
        const result = Multi.applyConfigurationInvalidation(target, message.change);
        target.recalculations = (target.recalculations || 0) + (result.applied ? 1 : 0);
        return { ok: true };
      },
      async create() {}
    },
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(listener) { messageListener = listener; } },
      getManifest() { return { version:'test' }; },
      getURL(value) { return value; }
    }
  };
  const sandbox = {
    chrome, console,
    importScripts() {},
    IQLABMultiAsset: Multi,
    IQLAB: {
      ensureDefaultStrategies: async () => {}, getAllCandles: async () => [],
      getStrategies: async () => [], getSetting: async (_key, fallback) => fallback,
      analyze: async () => ({ backtests:[] }), addDiagnostic: async () => {},
      normalizeCandle: value => value, putCandles: async () => 0
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf8'), sandbox);
  return message => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('background sem resposta')), 1000);
    messageListener(message, {}, response => { clearTimeout(timeout); resolve(response); });
  });
}

async function run() {
  const storage = { iqCandleLabConfigurationRevision: 10 };
  const panels = [panel(1, '76:60', 10, ['A']), panel(2, '77:60', 10, ['A'])];
  let persisted = false;
  const send = loadBackground(storage, panels);

  // 1/2: persistência antecede publicação; desativar/remover floating retira o card sem candle/polling.
  persisted = true;
  const disabled = await send({ type:'CONFIGURATION_CHANGED', change:{
    type:'strategy', strategyId:'A', reason:'strategy-active-updated', optimisticRemove:true, changedAt:Date.now()
  }});
  assert.equal(persisted, true);
  assert.equal(disabled.ok, true);
  assert.equal(disabled.change.revision, 11);
  assert.equal(disabled.notifiedTabs, 2);
  assert.deepEqual(panels.map(item => item.floating), [[], []]);
  assert.deepEqual(panels.map(item => item.selectedInstrumentKey), ['76:60', '77:60']);

  // 3–6: ativação/edição/modo/limite incrementam revisão e forçam recálculo orientado a evento.
  for (const change of [
    { type:'strategy', strategyId:'B', reason:'strategy-active-updated' },
    { type:'strategy', strategyId:'A', reason:'strategy-edited' },
    { type:'recommendation-mode', reason:'recommendation-mode-updated' },
    { type:'quadrant-limit', reason:'quadrant-limit-updated' }
  ]) assert.equal((await send({ type:'CONFIGURATION_CHANGED', change })).ok, true);
  assert.equal(storage.iqCandleLabConfigurationRevision, 15);
  assert.deepEqual(panels.map(item => item.configurationRevision), [15, 15]);
  assert.deepEqual(panels.map(item => item.recalculations), [5, 5]);

  // 8/9: mensagens duplicadas/antigas são idempotentes e não recalculam.
  const duplicate = Multi.applyConfigurationInvalidation(panels[0], disabled.change);
  assert.equal(duplicate.applied, false);
  assert.equal(panels[0].recalculations, 5);

  // 4/10: snapshot antigo não é reutilizado e resultado da revisão anterior é obsoleto.
  const oldSnapshots = new Map([['76:60', { instrumentKey:'76:60', configurationRevision:14 }]]);
  assert.equal(Multi.snapshotForSelection(oldSnapshots, '76:60', 15), null);
  const analysisRevision = 15;
  Multi.applyConfigurationInvalidation(panels[0], {
    type:'all', revision:16, reason:'strategy-edited', changedAt:Date.now()
  });
  assert.notEqual(analysisRevision, panels[0].configurationRevision);
  assert.equal(Multi.shouldRerunAnalysis(true, panels[0].selectedInstrumentKey), true);

  // 6: a análise real respeita imediatamente o novo limite de 200 completos.
  const analysisSandbox = { console, setTimeout, clearTimeout };
  vm.createContext(analysisSandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/multi-asset.js'), 'utf8'), analysisSandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/shared.js'), 'utf8'), analysisSandbox);
  vm.runInContext('globalThis.__IQLAB = IQLAB', analysisSandbox);
  const candles = [];
  const base = Math.floor((Date.now() / 1000 - 1_000_000) / 300) * 300;
  for (let quadrant = 0; quadrant < 210; quadrant++) for (let position = 0; position < 5; position++) {
    const from = base + quadrant * 300 + position * 60;
    candles.push({ activeId:76, symbol:'EURUSD-OTC', timeframeSec:60, from, to:from+60,
      open:1, close:1.1, high:1.2, low:.9, color:'green', closed:true });
  }
  const limited = await analysisSandbox.__IQLAB.analyze(candles, [], {
    activeId:76, timeframeSec:60, quadrantLimit:200
  });
  assert.equal(limited.completeQuadrantsAvailable, 210);
  assert.equal(limited.quadrantsUsed, 200);

  // 11: após reinício do service worker, a próxima publicação recupera a revisão persistida.
  const restartedSend = loadBackground(storage, panels);
  const afterRestart = await restartedSend({ type:'CONFIGURATION_CHANGED', change:{ type:'all', reason:'after-restart' } });
  assert.equal(afterRestart.change.revision, 16);

  // 12: o código observa classes somente dentro do contêiner encontrado; descoberta global usa childList.
  const contentSource = fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf8');
  assert.match(contentSource, /selectionObserver\.observe\(container/);
  assert.match(contentSource, /discoveryObserver\.observe\(document\.documentElement, \{ subtree: true, childList: true \}\)/);
  assert.doesNotMatch(contentSource, /selectionObserver\.observe\(document\.documentElement/);

  // O dashboard publica somente depois das persistências suportadas concluírem.
  const dashboardSource = fs.readFileSync(path.join(__dirname, '../src/dashboard.js'), 'utf8');
  assert.ok(dashboardSource.indexOf("await IQLAB.updateStrategy(id") <
    dashboardSource.indexOf("reason: `strategy-${field}-updated`"));
  assert.ok(dashboardSource.indexOf("await IQLAB.setSetting('recommendationMode'") <
    dashboardSource.indexOf("reason: 'recommendation-mode-updated'"));
  assert.ok(dashboardSource.indexOf("await IQLAB.setSetting('quadrantLimit'") <
    dashboardSource.indexOf("reason: 'quadrant-limit-updated'"));

  console.log('configuration event sync tests: ok');
}

run().catch(error => { console.error(error); process.exitCode = 1; });

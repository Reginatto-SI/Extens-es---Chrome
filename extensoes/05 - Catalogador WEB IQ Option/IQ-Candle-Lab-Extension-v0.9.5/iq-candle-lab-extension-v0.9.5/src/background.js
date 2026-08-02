importScripts('multi-asset.js', 'shared.js');

const tabStates = new Map();
const CONFIGURATION_REVISION_KEY = 'iqCandleLabConfigurationRevision';
let revisionQueue = Promise.resolve();
function getTabState(tabId) {
  if (!tabStates.has(tabId)) tabStates.set(tabId, IQLABMultiAsset.createTabState(tabId));
  return tabStates.get(tabId);
}

chrome.tabs?.onRemoved?.addListener(tabId => tabStates.delete(tabId));

async function getConfigurationRevision() {
  const stored = await chrome.storage.local.get(CONFIGURATION_REVISION_KEY);
  return Number(stored?.[CONFIGURATION_REVISION_KEY] || 0);
}

async function publishConfigurationChange(input) {
  // Serializa incrementos para manter a revisão monotônica mesmo com cliques rápidos.
  revisionQueue = revisionQueue.catch(() => undefined).then(async () => {
    const revision = await getConfigurationRevision() + 1;
    const change = IQLABMultiAsset.normalizeConfigurationChange(input, revision);
    if (!change) throw new Error('Alteração de configuração inválida');
    await chrome.storage.local.set({ [CONFIGURATION_REVISION_KEY]: revision });
    const tabs = await chrome.tabs.query({ url: ['https://iqoption.com/*', 'https://*.iqoption.com/*'] });
    let notifiedTabs = 0;
    const failures = [];
    await Promise.all((tabs || []).map(async tab => {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'CONFIGURATION_INVALIDATED', change });
        notifiedTabs += 1;
      } catch (error) {
        // Uma aba fechada/content script ausente não invalida a publicação global.
        failures.push({ tabId: tab.id, error: error.message });
      }
    }));
    return { change, notifiedTabs, failures };
  });
  return revisionQueue;
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.local.set({ installedAt: Date.now(), version: chrome.runtime.getManifest().version });
  await IQLAB.ensureDefaultStrategies();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'OPEN_DASHBOARD') {
      await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
      sendResponse({ ok: true }); return;
    }
    if (message.type === 'GET_CONFIGURATION_REVISION') {
      sendResponse({ ok: true, revision: await getConfigurationRevision() }); return;
    }
    if (message.type === 'CONFIGURATION_CHANGED') {
      const result = await publishConfigurationChange(message.change);
      sendResponse({ ok: true, ...result }); return;
    }
    const captureTabId = sender.tab?.id;
    const requiresCaptureTab = ['CANDLES', 'SELECT_INSTRUMENT', 'DIAGNOSTIC',
      'FLOATING_ANALYSIS', 'MULTI_ASSET_DIAGNOSTIC'].includes(message.type);
    if (requiresCaptureTab && captureTabId == null) {
      sendResponse({ ok: false, error: 'Mensagem dependente de captura sem sender.tab' }); return;
    }
    const tab = captureTabId == null ? null : getTabState(captureTabId);
    if (message.type === 'CANDLES') {
      // Um diagnóstico agregado por lote evita descarte silencioso e logs por candle.
      const prepared = IQLAB.prepareCandleBatch(message.candles || []);
      const normalized = prepared.candles;
      const rejectedByReason = prepared.rejectedByReason;
      const persistence = await IQLAB.putCandles(normalized);
      const touched = IQLABMultiAsset.recordCandles(tab, normalized);
      if (message.origin === 'history') {
        await IQLAB.addDiagnostic({
          kind: 'HISTORY_BATCH', tabId: sender.tab?.id,
          requestId: message.requestId ?? null, socketId: message.socketId ?? null,
          received: (message.candles || []).length, normalized: normalized.length,
          discarded: (message.candles || []).length - normalized.length,
          discardedByReason: rejectedByReason,
          uniqueInBatch: normalized.length,
          inserted: persistence.inserted,
          updated: persistence.updated,
          unchanged: persistence.unchanged,
          written: persistence.written
        });
      }
      sendResponse({ ok: true, saved: persistence.written, persistence, normalized: normalized.length,
        discarded: (message.candles || []).length - normalized.length,
        discardedByReason: rejectedByReason, touched, state: IQLABMultiAsset.snapshot(tab) }); return;
    }
    if (message.type === 'SELECT_INSTRUMENT') {
      const changed = IQLABMultiAsset.selectInstrument(tab, message.instrument, message.reason);
      sendResponse({ ok: true, changed, state: IQLABMultiAsset.snapshot(tab) }); return;
    }
    if (message.type === 'DIAGNOSTIC') {
      await IQLAB.addDiagnostic({ ...message.entry, tabId: sender.tab?.id });
      sendResponse({ ok: true }); return;
    }
    if (message.type === 'SUMMARY' || message.type === 'FLOATING_ANALYSIS') {
      const selectedKey = message.instrumentKey || tab?.selectedInstrumentKey || null;
      const token = tab ? IQLABMultiAsset.beginAnalysis(tab, selectedKey) : null;
      const configurationRevision = await getConfigurationRevision();
      if (message.type === 'FLOATING_ANALYSIS' &&
        Number(message.configurationRevision) !== configurationRevision) {
        sendResponse({ ok: false, stale: true, configurationRevision }); return;
      }
      const [candles, strategies, recommendationMode, quadrantLimit] = await Promise.all([
        IQLAB.getAllCandles(),
        IQLAB.getStrategies(),
        IQLAB.getSetting('recommendationMode', 'classic'),
        IQLAB.getSetting('quadrantLimit', IQLABMultiAsset.DEFAULT_QUADRANT_LIMIT)
      ]);
      const [activeId, timeframeSec] = String(selectedKey || '').split(':');
      const analysis = await IQLAB.analyze(candles, strategies, {
        recommendationMode,
        activeId: selectedKey ? activeId : null,
        timeframeSec: selectedKey ? Number(timeframeSec) : null,
        quadrantLimit: IQLABMultiAsset.clampQuadrantLimit(quadrantLimit)
      });

      if (message.type === 'FLOATING_ANALYSIS' &&
        configurationRevision !== await getConfigurationRevision()) {
        sendResponse({ ok: false, stale: true, configurationRevision: await getConfigurationRevision() }); return;
      }

      if (message.type === 'FLOATING_ANALYSIS' && !IQLABMultiAsset.mayApplyAnalysis(tab, token)) {
        sendResponse({ ok: false, stale: true }); return;
      }

      if (message.type === 'FLOATING_ANALYSIS') {
        const floating = analysis.backtests
          .filter(item => item.strategy.active && item.strategy.floating)
          .map(item => ({
            strategyId: item.strategy.id,
            name: item.strategy.name,
            shortName: item.strategy.shortName || item.strategy.name,
            galeLevel: item.strategy.galeLevel || 0,
            minimumQuadrantsRequired: item.minimumQuadrantsRequired,
            availableQuadrants: item.availableQuadrants,
            analysisAvailable: item.analysisAvailable,
            unavailableReason: item.unavailableReason,
            metrics: item.metrics,
            liveSignal: item.liveSignal,
            recommendation: item.recommendation
          }));

        sendResponse({
          ok: true,
          analysis: {
            symbol: analysis.symbol,
            contexts: analysis.contexts,
            marketQuality: analysis.marketQuality,
            recommendationMode: analysis.recommendationMode,
            instrumentKey: selectedKey,
            quadrantsUsed: analysis.quadrantsUsed,
            completeQuadrantsAvailable: analysis.completeQuadrantsAvailable,
            quadrantLimit: analysis.quadrantLimit,
            quadrantsMissing: analysis.quadrantsMissing,
            minimumQuadrantsRequired: analysis.minimumQuadrantsRequired,
            analysisStatus: analysis.analysisStatus,
            analysisAvailable: analysis.analysisAvailable,
            availableStrategyCount: analysis.availableStrategyCount,
            unavailableStrategyCount: analysis.unavailableStrategyCount,
            minimumAvailableRequirement: analysis.minimumAvailableRequirement,
            configurationRevision,
            floating
          }
        });
        return;
      }

      sendResponse({ ok: true, analysis });
      return;
    }
    if (message.type === 'MULTI_ASSET_DIAGNOSTIC') {
      sendResponse({ ok: true, state: IQLABMultiAsset.snapshot(tab) }); return;
    }
    sendResponse({ ok: false, error: 'Mensagem desconhecida' });
  })().catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

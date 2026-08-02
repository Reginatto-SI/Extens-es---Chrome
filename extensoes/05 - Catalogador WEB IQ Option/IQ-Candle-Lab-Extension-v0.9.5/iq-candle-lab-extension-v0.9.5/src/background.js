importScripts('shared.js');

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
    if (message.type === 'CANDLES') {
      const normalized = (message.candles || []).map(item => IQLAB.normalizeCandle(item.raw, item.context)).filter(Boolean);
      const reliable = normalized.find(c => c.activeId != null && c.activeId !== 'unknown');
      let relinked = 0;
      if (reliable) {
        const result = await IQLAB.relinkHistoricalCandles(reliable.activeId, reliable.symbol);
        relinked = result.updated || 0;
      }
      const saved = await IQLAB.putCandles(normalized);
      sendResponse({ ok: true, saved, relinked }); return;
    }
    if (message.type === 'DIAGNOSTIC') {
      await IQLAB.addDiagnostic({ ...message.entry, tabId: sender.tab?.id });
      sendResponse({ ok: true }); return;
    }
    if (message.type === 'SUMMARY' || message.type === 'FLOATING_ANALYSIS') {
      const [candles, strategies, recommendationMode] = await Promise.all([
        IQLAB.getAllCandles(),
        IQLAB.getStrategies(),
        IQLAB.getSetting('recommendationMode', 'classic')
      ]);
      const analysis = await IQLAB.analyze(candles, strategies, { recommendationMode });

      if (message.type === 'FLOATING_ANALYSIS') {
        const floating = analysis.backtests
          .filter(item => item.strategy.active && item.strategy.floating)
          .map(item => ({
            strategyId: item.strategy.id,
            name: item.strategy.name,
            shortName: item.strategy.shortName || item.strategy.name,
            galeLevel: item.strategy.galeLevel || 0,
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
            floating
          }
        });
        return;
      }

      sendResponse({ ok: true, analysis });
      return;
    }
    sendResponse({ ok: false, error: 'Mensagem desconhecida' });
  })().catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

/* Estado pequeno e reutilizável para separar captura, seleção e análise. */
const IQLABMultiAsset = (() => {
  const DEFAULT_QUADRANT_LIMIT = 500;
  const MIN_QUADRANT_LIMIT = 20;
  const MAX_QUADRANT_LIMIT = 5000;
  const MAX_RECENT_CANDLE_KEYS = 2000;
  const REJECTED_SYMBOLS = new Set([
    'candle-generated', 'candles', 'quote-generated', 'underlying-list-changed',
    'subscribemessage', 'unsubscribemessage', 'get-candles'
  ]);
  const CONFIGURATION_CHANGE_TYPES = new Set([
    'strategies', 'strategy', 'recommendation-mode', 'quadrant-limit', 'all'
  ]);

  function normalizeTimeframe(value, fallback = 60) {
    const timeframe = Number(value);
    return Number.isFinite(timeframe) && timeframe > 0 ? timeframe : fallback;
  }

  function instrumentKey(activeId, timeframeSec = 60) {
    if (activeId == null || String(activeId).toLowerCase() === 'unknown') return null;
    return `${String(activeId)}:${normalizeTimeframe(timeframeSec)}`;
  }

  function clampQuadrantLimit(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_QUADRANT_LIMIT;
    return Math.min(MAX_QUADRANT_LIMIT, Math.max(MIN_QUADRANT_LIMIT, parsed));
  }

  function validSymbol(value) {
    if (typeof value !== 'string') return null;
    const symbol = value.trim();
    if (!symbol || symbol.length > 40 || REJECTED_SYMBOLS.has(symbol.toLowerCase())) return null;
    // Símbolos conhecidos possuem letras e não são nomes genéricos de protocolo.
    return /[A-Z]{3}/i.test(symbol) ? symbol : null;
  }

  function createTabState(chromeTabId = null) {
    return {
      chromeTabId,
      selectedInstrumentKey: null,
      instruments: new Map(),
      selectionVersion: 0,
      analysisSequence: 0,
      discardedAnalyses: 0,
      renderCount: 0,
      lastSyncReason: 'inicialização',
      errors: []
    };
  }

  function ensureInstrument(tab, input) {
    const key = instrumentKey(input.activeId, input.timeframeSec);
    if (!key) return null;
    const current = tab.instruments.get(key) || {
      key,
      activeId: input.activeId,
      symbol: input.symbol || `ACTIVE-${input.activeId}`,
      marketType: input.marketType || 'unknown',
      timeframeSec: normalizeTimeframe(input.timeframeSec),
      lastRealtimeAt: null,
      lastHistoricalAt: null,
      lastAnalyzedAt: null,
      candleCount: 0,
      receivedEvents: 0,
      uniqueCandles: 0,
      recentCandleKeys: new Map(),
      completeQuadrants: 0,
      quadrantsUsed: 0,
      status: 'initializing',
      analysis: null
    };
    const symbol = validSymbol(input.symbol);
    if (symbol && !/^ACTIVE-/.test(symbol)) current.symbol = symbol;
    if (input.marketType) current.marketType = input.marketType;
    tab.instruments.set(key, current);
    return current;
  }

  function recordCandles(tab, candles) {
    const touched = new Set();
    for (const candle of candles || []) {
      const instrument = ensureInstrument(tab, candle);
      if (!instrument) continue;
      const historical = candle.origin === 'history';
      const at = Number(candle.capturedAt || Date.now());
      if (historical) instrument.lastHistoricalAt = at;
      else instrument.lastRealtimeAt = at;
      instrument.receivedEvents += 1;
      const candleKey = `${instrument.key}:${Number(candle.from)}`;
      if (Number.isFinite(Number(candle.from)) && !instrument.recentCandleKeys.has(candleKey)) {
        instrument.recentCandleKeys.set(candleKey, true);
        instrument.uniqueCandles += 1;
        instrument.candleCount = instrument.uniqueCandles;
        if (instrument.recentCandleKeys.size > MAX_RECENT_CANDLE_KEYS) {
          instrument.recentCandleKeys.delete(instrument.recentCandleKeys.keys().next().value);
        }
      }
      instrument.status = 'capturing';
      touched.add(instrument.key);
    }
    return [...touched];
  }

  function selectInstrument(tab, input, reason = 'seleção confirmada') {
    const instrument = ensureInstrument(tab, input);
    if (!instrument || instrument.key === tab.selectedInstrumentKey) return false;
    tab.selectedInstrumentKey = instrument.key;
    tab.selectionVersion += 1;
    tab.lastSyncReason = reason;
    return true;
  }

  function beginAnalysis(tab, key = tab.selectedInstrumentKey) {
    return { key, sequence: ++tab.analysisSequence, selectionVersion: tab.selectionVersion };
  }

  function mayApplyAnalysis(tab, token) {
    const valid = Boolean(token && token.key && token.key === tab.selectedInstrumentKey &&
      token.sequence === tab.analysisSequence && token.selectionVersion === tab.selectionVersion);
    if (!valid) tab.discardedAnalyses += 1;
    return valid;
  }

  function snapshot(tab) {
    return {
      chromeTabId: tab.chromeTabId,
      selectedInstrumentKey: tab.selectedInstrumentKey,
      selectedActiveId: tab.selectedInstrumentKey?.split(':')[0] || null,
      selectionVersion: tab.selectionVersion,
      analysisSequence: tab.analysisSequence,
      discardedAnalyses: tab.discardedAnalyses,
      renderCount: tab.renderCount,
      lastSyncReason: tab.lastSyncReason,
      instruments: [...tab.instruments.values()].map(({ analysis, recentCandleKeys, ...item }) => ({ ...item })),
      errors: tab.errors.slice(-10)
    };
  }

  function createSelectionResolver(options = {}) {
    const settleMs = Number(options.settleMs || 120);
    let pending = null;
    return {
      consider(tab, evidence) {
        const key = instrumentKey(evidence?.activeId, evidence?.timeframeSec);
        const allowed = ['active-dom-tab', 'main-chart-state', 'structured-command'].includes(evidence?.source);
        if (!key || !allowed || Number(evidence.confidence || 0) < 0.85) {
          return { applied: false, reason: 'evidência insuficiente' };
        }
        if (key === tab.selectedInstrumentKey) {
          pending = null;
          return { applied: false, idempotent: true, reason: 'seleção já ativa' };
        }
        const observedAt = Number(evidence.observedAt || Date.now());
        if (!pending || pending.key !== key) {
          const conflict = Boolean(pending && pending.key !== key);
          pending = { key, evidence, firstAt: observedAt, confirmations: 1 };
          return { applied: false, conflict, reason: conflict ? 'candidato contraditório' : 'aguardando confirmação' };
        }
        pending.confirmations += 1;
        if (observedAt - pending.firstAt < settleMs && evidence.confidence < 1) {
          return { applied: false, reason: 'aguardando estabilidade' };
        }
        const applied = selectInstrument(tab, evidence, `evidência ${evidence.source}`);
        pending = null;
        return { applied, key, reason: applied ? 'seleção confirmada' : 'seleção não alterada' };
      },
      pending: () => pending
    };
  }

  function normalizeConfigurationChange(change, revision, now = Date.now()) {
    if (!change || !CONFIGURATION_CHANGE_TYPES.has(change.type) ||
      typeof change.reason !== 'string' || !change.reason.trim()) return null;
    return {
      type: change.type,
      strategyId: typeof change.strategyId === 'string' ? change.strategyId : undefined,
      optimisticRemove: change.optimisticRemove === true,
      revision: Number(revision),
      reason: change.reason.trim().slice(0, 120),
      changedAt: Number(change.changedAt || now),
      source: 'dashboard'
    };
  }

  function snapshotForSelection(snapshots, selectedInstrumentKey, configurationRevision = null) {
    const snapshot = snapshots?.get(selectedInstrumentKey) || null;
    if (snapshot?.instrumentKey !== selectedInstrumentKey) return null;
    if (configurationRevision != null && snapshot.configurationRevision !== configurationRevision) return null;
    return snapshot;
  }

  function analysisQueueAction(analysisPending) {
    return analysisPending ? 'mark-dirty' : 'start';
  }

  function shouldRerunAnalysis(analysisDirty, selectedInstrumentKey) {
    return Boolean(analysisDirty && selectedInstrumentKey);
  }

  function applyConfigurationInvalidation(state, change) {
    if (!change || !Number.isFinite(Number(change.revision)) ||
      Number(change.revision) <= Number(state.configurationRevision || 0)) {
      state.duplicateConfigurationMessages = Number(state.duplicateConfigurationMessages || 0) + 1;
      return { applied: false, invalidatedSnapshots: 0 };
    }
    const invalidatedSnapshots = state.analysisSnapshots?.size || 0;
    state.analysisSnapshots?.clear();
    state.configurationRevision = Number(change.revision);
    state.lastConfigurationChange = change;
    state.lastConfigurationChangedAt = Date.now();
    state.lastInvalidationReason = change.reason;
    state.invalidatedSnapshots = Number(state.invalidatedSnapshots || 0) + invalidatedSnapshots;
    if (change.optimisticRemove && change.strategyId && Array.isArray(state.floating)) {
      state.floating = state.floating.filter(item => item.strategyId !== change.strategyId);
    }
    return { applied: true, invalidatedSnapshots };
  }

  return {
    DEFAULT_QUADRANT_LIMIT, MIN_QUADRANT_LIMIT, MAX_QUADRANT_LIMIT,
    normalizeTimeframe, instrumentKey, clampQuadrantLimit, validSymbol, createTabState,
    ensureInstrument, recordCandles, selectInstrument, beginAnalysis,
    mayApplyAnalysis, snapshot, createSelectionResolver, snapshotForSelection,
    analysisQueueAction, shouldRerunAnalysis, normalizeConfigurationChange,
    applyConfigurationInvalidation
  };
})();

if (typeof module !== 'undefined') module.exports = IQLABMultiAsset;

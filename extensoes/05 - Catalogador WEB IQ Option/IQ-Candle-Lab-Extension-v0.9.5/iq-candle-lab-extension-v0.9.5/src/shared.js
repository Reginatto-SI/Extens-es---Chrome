const IQLAB = (() => {
  const DB_NAME = 'iq-candle-lab';
  const DB_VERSION = 10;
  const STORES = {
    candles: 'candles',
    diagnostics: 'diagnostics',
    settings: 'settings',
    strategies: 'strategies'
  };

  const DEFAULT_STRATEGIES = [
    {
      id: 'mhi-majority',
      name: 'MHI — Maioria do quadrante',
      shortName: 'MHI Maioria',
      description: 'Analisa o último quadrante M1 completo e projeta a maioria de cores para a Q1 do quadrante seguinte.',
      rule: 'Quadrante anterior completo, sem doji. Entrada na Q1 seguinte a favor da maioria.',
      type: 'previous_majority',
      active: true,
      floating: true,
      galeLevel: 2,
      native: true,
      category: 'MHI',
      version: 1
    },
    {
      id: 'mhi-minority',
      name: 'MHI — Minoria do quadrante',
      shortName: 'MHI Minoria',
      description: 'Analisa o último quadrante M1 completo e projeta a cor minoritária para a Q1 do quadrante seguinte.',
      rule: 'Quadrante anterior completo, sem doji. Entrada na Q1 seguinte a favor da minoria.',
      type: 'previous_minority',
      active: true,
      floating: true,
      galeLevel: 2,
      native: true,
      category: 'MHI',
      version: 1
    },
    {
      id: 'repeat-q1',
      name: 'Repetição da Q1',
      shortName: 'Repetição Q1',
      description: 'Usa a cor da Q1 do quadrante anterior como referência para a Q1 do quadrante seguinte.',
      rule: 'Repetir na próxima Q1 a cor da Q1 anterior. Doji invalida.',
      type: 'repeat_q1',
      active: true,
      floating: false,
      galeLevel: 1,
      native: true,
      category: 'Posição',
      version: 1
    },
    {
      id: 'invert-q1',
      name: 'Inversão da Q1',
      shortName: 'Inversão Q1',
      description: 'Usa a cor contrária à Q1 do quadrante anterior.',
      rule: 'Entrar na próxima Q1 na cor oposta à Q1 anterior. Doji invalida.',
      type: 'invert_q1',
      active: true,
      floating: false,
      galeLevel: 1,
      native: true,
      category: 'Posição',
      version: 1
    },
    {
      id: 'repeat-q5',
      name: 'Repetição da Q5',
      shortName: 'Repetição Q5',
      description: 'Projeta para a próxima Q1 a mesma cor da Q5 do quadrante anterior.',
      rule: 'Repetir na próxima Q1 a cor da Q5 anterior. Doji invalida.',
      type: 'repeat_q5',
      active: true,
      floating: false,
      galeLevel: 1,
      native: true,
      category: 'Posição',
      version: 1
    },
    {
      id: 'invert-q5',
      name: 'Inversão da Q5',
      shortName: 'Inversão Q5',
      description: 'Projeta para a próxima Q1 a cor contrária à Q5 do quadrante anterior.',
      rule: 'Entrar na próxima Q1 na cor oposta à Q5 anterior. Doji invalida.',
      type: 'invert_q5',
      active: true,
      floating: false,
      galeLevel: 1,
      native: true,
      category: 'Posição',
      version: 1
    },
    {
      id: 'alternation-continuation',
      name: 'Continuação da alternância',
      shortName: 'Alternância',
      description: 'Detecta um quadrante totalmente alternado e projeta a continuação da alternância.',
      rule: 'Se as cinco cores alternarem sem doji, entrar na próxima Q1 na cor oposta à Q5.',
      type: 'alternation',
      active: true,
      floating: false,
      galeLevel: 1,
      native: true,
      category: 'Sequência',
      version: 1
    },
    {
      id: 'four-one-minority',
      name: 'Padrão 4×1 — Minoria',
      shortName: '4×1 Minoria',
      description: 'Identifica quadrante com quatro velas de uma cor e uma da outra, projetando a cor minoritária.',
      rule: 'Composição 4×1, sem doji. Entrada na próxima Q1 pela cor minoritária.',
      type: 'four_one_minority',
      active: true,
      floating: false,
      galeLevel: 2,
      native: true,
      category: 'Predominância',
      version: 1
    },
    {
      id: 'four-one-majority',
      name: 'Padrão 4×1 — Maioria',
      shortName: '4×1 Maioria',
      description: 'Identifica quadrante com quatro velas de uma cor e uma da outra, projetando a cor predominante.',
      rule: 'Composição 4×1, sem doji. Entrada na próxima Q1 pela cor majoritária.',
      type: 'four_one_majority',
      active: false,
      floating: false,
      galeLevel: 2,
      native: true,
      category: 'Predominância',
      version: 1
    },
    {
      id: 'two-quadrants-majority',
      name: 'Maioria dos dois quadrantes',
      shortName: '2Q Maioria',
      description: 'Combina as dez velas dos dois últimos quadrantes completos e utiliza a predominância total.',
      rule: 'Dois quadrantes completos, sem empate total. Entrada na Q1 seguinte pela maioria das dez velas.',
      type: 'two_quadrants_majority',
      active: true,
      floating: false,
      galeLevel: 2,
      native: true,
      category: 'Multi-quadrante',
      version: 1
    }
  ];

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.candles)) {
          const store = db.createObjectStore(STORES.candles, { keyPath: 'id' });
          store.createIndex('by_symbol_timeframe_from', ['symbol', 'timeframeSec', 'from'], { unique: true });
          store.createIndex('by_from', 'from');
          store.createIndex('by_symbol', 'symbol');
          store.createIndex('by_timeframe', 'timeframeSec');
        }
        if (!db.objectStoreNames.contains(STORES.diagnostics)) {
          const store = db.createObjectStore(STORES.diagnostics, { keyPath: 'id', autoIncrement: true });
          store.createIndex('by_createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(STORES.settings)) {
          db.createObjectStore(STORES.settings, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.strategies)) {
          db.createObjectStore(STORES.strategies, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function candleColor(open, close, high, low, tolerance = 0.05) {
    const range = Math.abs(high - low);
    if (range === 0 || Math.abs(close - open) <= range * tolerance) return 'doji';
    return close > open ? 'green' : 'red';
  }

  function normalizeEpoch(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  }

  function normalizeCandle(raw, context = {}) {
    if (!raw || typeof raw !== 'object') return null;
    const from = normalizeEpoch(raw.from ?? raw.start ?? raw.open_time ?? raw.timestamp ?? raw.at);
    let to = normalizeEpoch(raw.to ?? raw.end ?? raw.close_time);
    let timeframeSec = Number(raw.timeframe ?? raw.period ?? raw.interval ?? raw.size ?? context.timeframeSec);
    const measuredDuration = from && to && to > from ? to - from : null;

    // Alguns payloads da IQ Option usam "size" para outros significados.
    // Quando a duração medida é compatível com um candle conhecido, ela tem prioridade.
    const knownTimeframes = [60, 300, 900, 1800, 3600, 86400];
    if (measuredDuration && knownTimeframes.includes(measuredDuration)) {
      timeframeSec = measuredDuration;
    } else if (!Number.isFinite(timeframeSec) || !knownTimeframes.includes(timeframeSec)) {
      timeframeSec = measuredDuration && measuredDuration >= 30 ? measuredDuration : 60;
    }

    if (!to && from) to = from + timeframeSec;
    const open = Number(raw.open ?? raw.opening ?? raw.o);
    const close = Number(raw.close ?? raw.closing ?? raw.c);
    const high = Number(raw.max ?? raw.high ?? raw.h ?? Math.max(open, close));
    const low = Number(raw.min ?? raw.low ?? raw.l ?? Math.min(open, close));
    if (![from, to, open, close, high, low].every(Number.isFinite)) return null;
    if (!(from < to && low <= open && low <= close && high >= open && high >= close)) return null;
    const activeId = raw.active_id ?? raw.activeId ?? raw.active ?? context.activeId ?? 'unknown';
    const symbol = String(raw.symbol ?? raw.instrument ?? raw.asset ?? context.symbol ?? `ACTIVE-${activeId}`);
    const marketType = /otc/i.test(symbol) ? 'otc' : (context.marketType || 'unknown');
    const now = Math.floor(Date.now() / 1000);
    const closed = raw.closed === true || raw.is_closed === true || to <= now - 1;
    return {
      id: `${activeId}|${timeframeSec}|${from}`,
      activeId, symbol, marketType, timeframeSec, from, to,
      open, close, high, low,
      volume: Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : undefined,
      closed,
      color: candleColor(open, close, high, low),
      origin: context.origin || 'realtime',
      capturedAt: Date.now(),
      updatedAt: Date.now(),
      schemaVersion: 1
    };
  }

  async function putCandles(candles) {
    const valid = candles.filter(Boolean);
    if (!valid.length) return 0;
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.candles, 'readwrite');
      const store = tx.objectStore(STORES.candles);
      valid.forEach(c => store.put(c));
      tx.oncomplete = () => resolve(valid.length);
      tx.onerror = () => reject(tx.error);
    }).finally(() => db.close());
  }

  async function addDiagnostic(entry) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.diagnostics, 'readwrite');
      tx.objectStore(STORES.diagnostics).add({ ...entry, createdAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    }).finally(() => db.close());
  }


  async function relinkHistoricalCandles(targetActiveId, targetSymbol) {
    if (targetActiveId == null) return { updated: 0 };
    const db = await openDb();
    try {
      const tx = db.transaction(STORES.candles, 'readwrite');
      const store = tx.objectStore(STORES.candles);
      const all = await requestToPromise(store.getAll());
      let updated = 0;

      // Só religa registros sem ativo confiável. Não mistura ativos conhecidos.
      for (const candle of all) {
        const unknownActive = candle.activeId == null ||
          candle.activeId === 'unknown' ||
          String(candle.activeId).toLowerCase() === 'unknown';
        const genericSymbol = !candle.symbol || /^ACTIVE-(unknown|undefined|null)$/i.test(String(candle.symbol));

        if (unknownActive || genericSymbol) {
          const activeId = targetActiveId;
          const symbol = targetSymbol || `ACTIVE-${activeId}`;
          const replacement = {
            ...candle,
            id: `${activeId}|${candle.timeframeSec}|${candle.from}`,
            activeId,
            symbol,
            marketType: /otc/i.test(symbol) ? 'otc' : candle.marketType,
            updatedAt: Date.now()
          };
          if (replacement.id !== candle.id) store.delete(candle.id);
          store.put(replacement);
          updated++;
        }
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      return { updated };
    } finally {
      db.close();
    }
  }

  async function getAllCandles() {
    const db = await openDb();
    try { return await requestToPromise(db.transaction(STORES.candles).objectStore(STORES.candles).getAll()); }
    finally { db.close(); }
  }

  async function getDiagnostics(limit = 100) {
    const db = await openDb();
    try {
      const all = await requestToPromise(db.transaction(STORES.diagnostics).objectStore(STORES.diagnostics).getAll());
      return all.sort((a,b) => b.createdAt - a.createdAt).slice(0, limit);
    } finally { db.close(); }
  }

  async function getSetting(key, fallback) {
    const db = await openDb();
    try {
      const row = await requestToPromise(db.transaction(STORES.settings).objectStore(STORES.settings).get(key));
      return row ? row.value : fallback;
    } finally { db.close(); }
  }

  async function setSetting(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.settings, 'readwrite');
      tx.objectStore(STORES.settings).put({ key, value });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    }).finally(() => db.close());
  }

  async function ensureDefaultStrategies() {
    const db = await openDb();
    try {
      const tx = db.transaction(STORES.strategies, 'readwrite');
      const store = tx.objectStore(STORES.strategies);
      for (const preset of DEFAULT_STRATEGIES) {
        const existing = await requestToPromise(store.get(preset.id));
        if (!existing) store.put({ ...preset, createdAt: Date.now(), updatedAt: Date.now() });
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }

  async function getStrategies() {
    await ensureDefaultStrategies();
    const db = await openDb();
    try {
      const rows = await requestToPromise(db.transaction(STORES.strategies).objectStore(STORES.strategies).getAll());
      return rows.sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'));
    } finally { db.close(); }
  }

  async function updateStrategy(id, patch) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORES.strategies, 'readwrite');
      const store = tx.objectStore(STORES.strategies);
      const current = await requestToPromise(store.get(id));
      if (!current) throw new Error('Estratégia não encontrada');
      store.put({ ...current, ...patch, updatedAt: Date.now() });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }

  function quadrantStart(from) { return Math.floor(from / 300) * 300; }
  function quadrantPosition(from) { return Math.floor((from - quadrantStart(from)) / 60) + 1; }

  function isClosedNow(candle, now = Math.floor(Date.now() / 1000)) {
    return candle.closed === true || Number(candle.to) <= now - 1;
  }

  function isM1Candle(candle) {
    const duration = Number(candle.to) - Number(candle.from);
    return Number(candle.timeframeSec) === 60 || duration === 60;
  }

  function assetKey(candle) {
    return String(candle.activeId ?? candle.symbol ?? 'unknown');
  }

  function buildQuadrants(candles) {
    const groups = new Map();
    const now = Math.floor(Date.now() / 1000);

    candles
      .filter(c => isM1Candle(c) && isClosedNow(c, now))
      .forEach(c => {
        const minuteFrom = Math.floor(Number(c.from) / 60) * 60;
        const start = quadrantStart(minuteFrom);
        const position = quadrantPosition(minuteFrom);
        if (position < 1 || position > 5) return;

        const aKey = assetKey(c);
        const key = `${aKey}|${start}`;
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            assetKey: aKey,
            activeId: c.activeId,
            symbol: c.symbol,
            start,
            byPosition: new Map()
          });
        }

        const current = groups.get(key).byPosition.get(position);
        if (!current || Number(c.updatedAt || 0) >= Number(current.updatedAt || 0)) {
          groups.get(key).byPosition.set(position, { ...c, from: minuteFrom, position, closed: true });
        }
      });

    return [...groups.values()].map(group => {
      const quadrantCandles = [1,2,3,4,5]
        .map(position => group.byPosition.get(position))
        .filter(Boolean);
      const colors = quadrantCandles.map(c => c.color);
      const green = colors.filter(c => c === 'green').length;
      const red = colors.filter(c => c === 'red').length;
      const doji = colors.filter(c => c === 'doji').length;
      const complete = quadrantCandles.length === 5 &&
        quadrantCandles.every((c, index) => c.position === index + 1);

      return {
        key: group.key,
        assetKey: group.assetKey,
        activeId: group.activeId,
        symbol: group.symbol,
        start: group.start,
        candles: quadrantCandles,
        missingPositions: [1,2,3,4,5].filter(p => !group.byPosition.has(p)),
        complete,
        sequence: colors,
        green,
        red,
        doji,
        majority: green === red ? 'neutral' : green > red ? 'green' : 'red',
        minority: green === red ? 'neutral' : green < red ? 'green' : 'red'
      };
    }).sort((a,b) => a.start - b.start);
  }

  function aggregateCandles(candles, timeframeSec) {
    const now = Math.floor(Date.now() / 1000);
    const source = candles
      .filter(c => isM1Candle(c) && isClosedNow(c, now))
      .sort((a,b) => Number(a.from) - Number(b.from));

    const groups = new Map();
    for (const candle of source) {
      const start = Math.floor(Number(candle.from) / timeframeSec) * timeframeSec;
      const key = `${assetKey(candle)}|${timeframeSec}|${start}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          activeId: candle.activeId,
          symbol: candle.symbol,
          marketType: candle.marketType,
          timeframeSec,
          from: start,
          to: start + timeframeSec,
          candles: []
        });
      }
      groups.get(key).candles.push(candle);
    }

    const expected = Math.round(timeframeSec / 60);
    return [...groups.values()].map(group => {
      const uniqueMinutes = new Map();
      for (const candle of group.candles) {
        const minute = Math.floor(Number(candle.from) / 60) * 60;
        uniqueMinutes.set(minute, candle);
      }
      const items = [...uniqueMinutes.values()].sort((a,b) => Number(a.from) - Number(b.from));
      const complete = items.length === expected &&
        items.every((c, index) => Math.floor(Number(c.from)/60)*60 === group.from + index * 60);
      if (!items.length) return null;
      const first = items[0], last = items.at(-1);
      return {
        id: group.id,
        activeId: group.activeId,
        symbol: group.symbol,
        marketType: group.marketType,
        timeframeSec,
        from: group.from,
        to: group.to,
        open: first.open,
        close: last.close,
        high: Math.max(...items.map(c => Number(c.high))),
        low: Math.min(...items.map(c => Number(c.low))),
        closed: complete && group.to <= now,
        complete,
        color: candleColor(first.open, last.close, Math.max(...items.map(c => Number(c.high))), Math.min(...items.map(c => Number(c.low)))),
        origin: 'aggregated',
        sourceCount: items.length
      };
    }).filter(Boolean);
  }

  function buildCaptureDiagnostics(candles, currentAssetId) {
    const now = Math.floor(Date.now() / 1000);
    const current = currentAssetId == null ? candles : candles.filter(c => assetKey(c) === String(currentAssetId));
    const m1 = current.filter(isM1Candle);
    const closed = m1.filter(c => isClosedNow(c, now));
    const minuteStarts = closed.map(c => Math.floor(Number(c.from) / 60) * 60);
    const uniqueStarts = [...new Set(minuteStarts)].sort((a,b) => a-b);
    const duplicates = minuteStarts.length - uniqueStarts.length;
    const gaps = {};
    for (let i = 1; i < uniqueStarts.length; i++) {
      const diff = uniqueStarts[i] - uniqueStarts[i-1];
      gaps[diff] = (gaps[diff] || 0) + 1;
    }
    const positionCounts = {1:0,2:0,3:0,4:0,5:0};
    uniqueStarts.forEach(start => positionCounts[quadrantPosition(start)]++);
    let longestRun = uniqueStarts.length ? 1 : 0;
    let currentRun = uniqueStarts.length ? 1 : 0;
    for (let i = 1; i < uniqueStarts.length; i++) {
      if (uniqueStarts[i] - uniqueStarts[i-1] === 60) currentRun++;
      else currentRun = 1;
      longestRun = Math.max(longestRun, currentRun);
    }
    const quadrants = buildQuadrants(current);
    const partial = quadrants.filter(q => !q.complete);
    return {
      totalStored: candles.length,
      currentAssetStored: current.length,
      m1Detected: m1.length,
      m1Closed: closed.length,
      uniqueMinutes: uniqueStarts.length,
      duplicates,
      longestConsecutiveRun: longestRun,
      gapHistogram: gaps,
      positionCounts,
      completeQuadrants: quadrants.filter(q => q.complete).length,
      partialQuadrants: partial.length,
      recentPartials: partial.slice(-10).reverse().map(q => ({
        start: q.start,
        positions: q.candles.map(c => c.position),
        missing: q.missingPositions
      })),
      recentMinutes: uniqueStarts.slice(-15).reverse()
    };
  }


  function getAssetCoverage(candles) {
    const now = Math.floor(Date.now() / 1000);
    const groups = new Map();

    for (const candle of candles) {
      const key = `${assetKey(candle)}|${Number(candle.timeframeSec) || (Number(candle.to)-Number(candle.from))}`;
      if (!groups.has(key)) {
        groups.set(key, {
          activeId: candle.activeId,
          symbol: candle.symbol,
          timeframeSec: Number(candle.timeframeSec) || (Number(candle.to)-Number(candle.from)),
          total: 0,
          closed: 0,
          first: null,
          last: null
        });
      }
      const row = groups.get(key);
      row.total++;
      if (isClosedNow(candle, now)) row.closed++;
      row.first = row.first == null ? Number(candle.from) : Math.min(row.first, Number(candle.from));
      row.last = row.last == null ? Number(candle.from) : Math.max(row.last, Number(candle.from));
    }

    return [...groups.values()]
      .sort((a,b) => b.total - a.total || String(a.symbol).localeCompare(String(b.symbol)));
  }

  function opposite(color) {
    return color === 'green' ? 'red' : color === 'red' ? 'green' : 'neutral';
  }

  function signalForStrategy(strategy, previous, previous2) {
    if (!previous?.complete) return null;
    const seq = previous.sequence;
    const noDoji = previous.doji === 0;
    switch (strategy.type) {
      case 'previous_majority':
        return noDoji && previous.majority !== 'neutral' ? previous.majority : null;
      case 'previous_minority':
        return noDoji && previous.minority !== 'neutral' ? previous.minority : null;
      case 'repeat_q1':
        return seq[0] !== 'doji' ? seq[0] : null;
      case 'invert_q1':
        return seq[0] !== 'doji' ? opposite(seq[0]) : null;
      case 'repeat_q5':
        return seq[4] !== 'doji' ? seq[4] : null;
      case 'invert_q5':
        return seq[4] !== 'doji' ? opposite(seq[4]) : null;
      case 'alternation': {
        if (!noDoji) return null;
        const alternates = seq.every((c,i) => i === 0 || c !== seq[i-1]);
        return alternates ? opposite(seq[4]) : null;
      }
      case 'four_one_minority':
        return noDoji && ((previous.green === 4 && previous.red === 1) || (previous.red === 4 && previous.green === 1))
          ? previous.minority : null;
      case 'four_one_majority':
        return noDoji && ((previous.green === 4 && previous.red === 1) || (previous.red === 4 && previous.green === 1))
          ? previous.majority : null;
      case 'two_quadrants_majority': {
        if (!previous2?.complete) return null;
        const colors = [...previous2.sequence, ...previous.sequence].filter(c => c !== 'doji');
        const g = colors.filter(c => c === 'green').length;
        const r = colors.filter(c => c === 'red').length;
        return g === r ? null : g > r ? 'green' : 'red';
      }
      default:
        return null;
    }
  }

  function evaluateEntry(direction, target, galeLevel = 0) {
    if (!target?.complete || !direction || direction === 'neutral') return null;
    const attempts = target.candles.slice(0, Math.min(3, galeLevel + 1));
    for (let i = 0; i < attempts.length; i++) {
      if (attempts[i].color === 'doji') continue;
      if (attempts[i].color === direction) return i === 0 ? 'WIN' : `WIN G${i}`;
    }
    return 'LOSS';
  }

  function backtestStrategy(strategy, quadrants) {
    const complete = quadrants.filter(q => q.complete);
    const results = [];
    for (let i = 1; i < complete.length; i++) {
      const target = complete[i];
      const previous = complete[i - 1];
      if (target.start !== previous.start + 300) continue;
      const previous2 = i >= 2 && previous.start === complete[i-2].start + 300 ? complete[i-2] : null;
      const direction = signalForStrategy(strategy, previous, previous2);
      if (!direction) continue;
      const result = evaluateEntry(direction, target, strategy.galeLevel || 0);
      if (result) results.push({ at: target.start, direction, result, previous, target });
    }
    const wins = results.filter(r => r.result.startsWith('WIN')).length;
    const direct = results.filter(r => r.result === 'WIN').length;
    const g1 = results.filter(r => r.result === 'WIN G1').length;
    const g2 = results.filter(r => r.result === 'WIN G2').length;
    const losses = results.filter(r => r.result === 'LOSS').length;
    const rate = results.length ? Math.round((wins / results.length) * 1000) / 10 : 0;
    return { sample: results.length, wins, direct, g1, g2, losses, rate, results };
  }


  function getCurrentQuadrant(candles) {
    const now = Math.floor(Date.now() / 1000);
    const m1 = candles
      .filter(isM1Candle)
      .sort((a,b) => Number(a.from) - Number(b.from));

    const currentStart = quadrantStart(now);
    const current = m1.filter(c => quadrantStart(Number(c.from)) === currentStart);

    const byPosition = new Map();
    for (const candle of current) {
      const minuteFrom = Math.floor(Number(candle.from) / 60) * 60;
      const position = quadrantPosition(minuteFrom);
      const previous = byPosition.get(position);
      if (!previous || Number(candle.updatedAt || 0) >= Number(previous.updatedAt || 0)) {
        byPosition.set(position, { ...candle, position });
      }
    }

    const candlesOrdered = [1,2,3,4,5].map(p => byPosition.get(p)).filter(Boolean);
    const q5 = byPosition.get(5) || null;
    const secondsToClose = Math.max(0, currentStart + 300 - now);

    return {
      start: currentStart,
      candles: candlesOrdered,
      byPosition,
      q5,
      q5Started: now >= currentStart + 240,
      secondsToClose,
      nextEntryAt: currentStart + 300,
      complete: candlesOrdered.length === 5 && candlesOrdered.every((c,i) => c.position === i+1 && isClosedNow(c))
    };
  }

  function previewSignalForStrategy(strategy, currentQuadrant, previousQuadrant, previous2Quadrant) {
    if (!currentQuadrant?.q5Started) return null;

    const closedBeforeQ5 = [1,2,3,4]
      .map(p => currentQuadrant.byPosition.get(p))
      .filter(c => c && isClosedNow(c));

    if (closedBeforeQ5.length < 4) return null;

    const provisionalQ5 = currentQuadrant.q5;
    const provisionalSequence = [
      ...closedBeforeQ5.map(c => c.color),
      provisionalQ5?.color || null
    ];

    const green4 = closedBeforeQ5.filter(c => c.color === 'green').length;
    const red4 = closedBeforeQ5.filter(c => c.color === 'red').length;
    const doji4 = closedBeforeQ5.filter(c => c.color === 'doji').length;

    let direction = null;
    let certainty = 'provisional';
    let reason = 'Aguardando o fechamento da Q5.';
    let canChange = true;

    switch (strategy.type) {
      case 'previous_majority':
        if (doji4 > 0) return null;
        if (Math.abs(green4 - red4) >= 2) {
          direction = green4 > red4 ? 'green' : 'red';
          certainty = 'mathematically_defined';
          reason = 'A maioria já não pode ser alterada pela Q5.';
          canChange = false;
        } else if (provisionalQ5 && provisionalQ5.color !== 'doji') {
          const g = green4 + (provisionalQ5.color === 'green' ? 1 : 0);
          const r = red4 + (provisionalQ5.color === 'red' ? 1 : 0);
          direction = g === r ? null : g > r ? 'green' : 'red';
        }
        break;

      case 'previous_minority':
        if (doji4 > 0) return null;
        if (Math.abs(green4 - red4) >= 2) {
          direction = green4 < red4 ? 'green' : 'red';
          certainty = 'mathematically_defined';
          reason = 'A minoria já não pode ser alterada pela Q5.';
          canChange = false;
        } else if (provisionalQ5 && provisionalQ5.color !== 'doji') {
          const g = green4 + (provisionalQ5.color === 'green' ? 1 : 0);
          const r = red4 + (provisionalQ5.color === 'red' ? 1 : 0);
          direction = g === r ? null : g < r ? 'green' : 'red';
        }
        break;

      case 'repeat_q1': {
        const q1 = previousQuadrant?.candles?.[0];
        if (q1 && q1.color !== 'doji') {
          direction = q1.color;
          certainty = 'mathematically_defined';
          reason = 'A direção depende da Q1 anterior e já está definida.';
          canChange = false;
        }
        break;
      }

      case 'invert_q1': {
        const q1 = previousQuadrant?.candles?.[0];
        if (q1 && q1.color !== 'doji') {
          direction = opposite(q1.color);
          certainty = 'mathematically_defined';
          reason = 'A direção depende da Q1 anterior e já está definida.';
          canChange = false;
        }
        break;
      }

      case 'repeat_q5':
        if (provisionalQ5 && provisionalQ5.color !== 'doji') {
          direction = provisionalQ5.color;
          certainty = 'provisional';
          reason = 'A direção acompanha a cor atual da Q5 e ainda pode mudar.';
        }
        break;

      case 'invert_q5':
        if (provisionalQ5 && provisionalQ5.color !== 'doji') {
          direction = opposite(provisionalQ5.color);
          certainty = 'provisional';
          reason = 'A direção é oposta à cor atual da Q5 e ainda pode mudar.';
        }
        break;

      case 'alternation': {
        if (closedBeforeQ5.some(c => c.color === 'doji')) return null;
        const firstFour = closedBeforeQ5.map(c => c.color);
        const alternatingFour = firstFour.every((c,i) => i === 0 || c !== firstFour[i-1]);
        if (!alternatingFour) return null;

        const expectedQ5 = opposite(firstFour[3]);
        if (provisionalQ5 && provisionalQ5.color === expectedQ5) {
          direction = opposite(expectedQ5);
          certainty = 'provisional';
          reason = 'A alternância está ocorrendo, mas depende do fechamento da Q5.';
        }
        break;
      }

      case 'four_one_minority':
      case 'four_one_majority': {
        if (doji4 > 0) return null;
        const currentQ5Color = provisionalQ5?.color;
        if (!currentQ5Color || currentQ5Color === 'doji') return null;
        const g = green4 + (currentQ5Color === 'green' ? 1 : 0);
        const r = red4 + (currentQ5Color === 'red' ? 1 : 0);
        const isFourOne = (g === 4 && r === 1) || (r === 4 && g === 1);
        if (!isFourOne) return null;
        direction = strategy.type === 'four_one_minority'
          ? (g < r ? 'green' : 'red')
          : (g > r ? 'green' : 'red');
        certainty = 'provisional';
        reason = 'O padrão 4×1 depende do fechamento definitivo da Q5.';
        break;
      }

      case 'two_quadrants_majority': {
        if (!previousQuadrant?.complete || !previous2Quadrant?.complete) return null;
        const colors = [...previous2Quadrant.sequence, ...previousQuadrant.sequence].filter(c => c !== 'doji');
        const g = colors.filter(c => c === 'green').length;
        const r = colors.filter(c => c === 'red').length;
        if (g !== r) {
          direction = g > r ? 'green' : 'red';
          certainty = 'mathematically_defined';
          reason = 'A direção usa quadrantes anteriores e já está definida.';
          canChange = false;
        }
        break;
      }
    }

    if (!direction || direction === 'neutral') return null;

    return {
      direction,
      certainty,
      reason,
      canChange,
      entryAt: currentQuadrant.nextEntryAt,
      seconds: currentQuadrant.secondsToClose,
      q5Color: provisionalQ5?.color || null,
      state: certainty === 'mathematically_defined' ? 'definida' : 'provisória'
    };
  }

  function getLiveSignals(strategies, quadrants, candles = []) {
    const complete = quadrants.filter(q => q.complete);
    const latest = complete.at(-1);
    const previous2 = complete.length >= 2 ? complete.at(-2) : null;
    const now = Math.floor(Date.now() / 1000);

    const currentQuadrant = getCurrentQuadrant(candles);
    const confirmedEntryAt = latest ? latest.start + 300 : null;

    return strategies.filter(s => s.active).map(strategy => {
      const preview = previewSignalForStrategy(strategy, currentQuadrant, latest, previous2);

      if (preview) {
        return {
          strategyId: strategy.id,
          name: strategy.name,
          shortName: strategy.shortName || strategy.name,
          floating: strategy.floating,
          direction: preview.direction,
          entryAt: preview.entryAt,
          seconds: preview.seconds,
          state: preview.state,
          certainty: preview.certainty,
          reason: preview.reason,
          canChange: preview.canChange,
          q5Color: preview.q5Color
        };
      }

      if (!latest) return null;

      const direction = signalForStrategy(strategy, latest, previous2);
      if (!direction) return null;

      const seconds = confirmedEntryAt - now;
      return {
        strategyId: strategy.id,
        name: strategy.name,
        shortName: strategy.shortName || strategy.name,
        floating: strategy.floating,
        direction,
        entryAt: confirmedEntryAt,
        seconds,
        state: seconds >= -60 ? 'confirmada' : 'expirada',
        certainty: 'confirmed',
        reason: 'A Q5 fechou e a condição foi confirmada.',
        canChange: false,
        q5Color: latest.sequence?.[4] || null
      };
    }).filter(Boolean);
  }

  function contextFromCandles(candles, count) {
    const now = Math.floor(Date.now() / 1000);
    const sample = candles.filter(c => isClosedNow(c, now) && c.complete !== false).sort((a,b) => b.from-a.from).slice(0,count);
    if (sample.length < Math.min(3, count)) return { state: 'insufficient', strength: 0, sample: sample.length };
    const green = sample.filter(c => c.color === 'green').length;
    const red = sample.filter(c => c.color === 'red').length;
    const diff = Math.abs(green-red);
    return {
      state: green === red ? 'neutral' : green > red ? 'green' : 'red',
      strength: Math.round(diff / sample.length * 100),
      sample: sample.length
    };
  }



  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
    if (!sorted.length) return 0;
    const m = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[m] : (sorted[m-1] + sorted[m]) / 2;
  }

  function analyzeMarketQuality(candles) {
    const recent = candles.filter(c => isM1Candle(c) && isClosedNow(c))
      .sort((a,b) => Number(a.from) - Number(b.from)).slice(-30);

    if (recent.length < 10) {
      return { regime:'insufficient', regimeLabel:'Amostra insuficiente', intensityLabel:'Indefinida',
        score:0, averageBodyRatio:0, averageRelativeRange:0, directionalBias:'neutral',
        explanation:'Ainda não existem velas suficientes para avaliar intensidade e regime.' };
    }

    const ranges = recent.map(c => Math.max(0, Number(c.high)-Number(c.low)));
    const ref = median(ranges) || 1;
    const rows = recent.map(c => {
      const range = Math.max(0, Number(c.high)-Number(c.low));
      const body = Math.abs(Number(c.close)-Number(c.open));
      return { color:c.color, bodyRatio:range ? body/range : 0, relative:range/ref };
    });

    const avgBody = rows.reduce((a,b)=>a+b.bodyRatio,0)/rows.length;
    const avgRelative = rows.reduce((a,b)=>a+b.relative,0)/rows.length;
    const green = rows.filter(x=>x.color==='green').length;
    const red = rows.filter(x=>x.color==='red').length;
    const diff = Math.abs(green-red)/rows.length;
    const strong = rows.filter(x=>x.relative>=1.25 && x.bodyRatio>=0.6).length;
    const weak = rows.filter(x=>x.relative<0.7 || x.bodyRatio<0.35).length;

    let regime='lateral', regimeLabel='Lateral', score=50;
    if (avgRelative < .75 && weak >= rows.length*.45) {
      regime='compression'; regimeLabel='Compressão'; score=45;
    } else if (avgRelative >= 1.45 && diff < .2) {
      regime='volatile_noise'; regimeLabel='Volátil sem direção'; score=30;
    } else if (diff >= .4 && avgBody >= .55 && strong >= rows.length*.25) {
      regime='strong_directional'; regimeLabel='Direcional forte'; score=80;
    } else if (diff >= .25 && avgBody >= .45) {
      regime='moderate_directional'; regimeLabel='Direcional moderado'; score=65;
    }

    let intensityLabel='Normal';
    if (avgRelative >= 2) intensityLabel='Extrema';
    else if (avgRelative >= 1.5 && avgBody >= .6) intensityLabel='Forte';
    else if (avgRelative < .8 || avgBody < .35) intensityLabel='Fraca';

    const directionalBias = green===red ? 'neutral' : green>red ? 'green' : 'red';

    return {
      regime, regimeLabel, intensityLabel, score,
      averageBodyRatio:Math.round(avgBody*100),
      averageRelativeRange:Math.round(avgRelative*100)/100,
      directionalBias, sample:recent.length,
      explanation:`Regime ${regimeLabel.toLowerCase()}, intensidade ${intensityLabel.toLowerCase()} e viés ${directionalBias==='green'?'verde':directionalBias==='red'?'vermelho':'neutro'}.`
    };
  }

  function contextRecommendation(contexts, direction, metrics, marketQuality, recommendationMode = 'classic') {
    const entries = [
      ['Mar', contexts.mar],
      ['Maré', contexts.mare],
      ['Onda', contexts.onda],
      ['Marola', contexts.marola]
    ];

    const usable = entries.filter(([,ctx]) => ctx && !['insufficient','neutral'].includes(ctx.state));
    const aligned = usable.filter(([,ctx]) => ctx.state === direction);
    const contrary = usable.filter(([,ctx]) => ctx.state !== direction);

    const contextScore = usable.length ? Math.round((aligned.length / usable.length) * 100) : 0;
    const historicalRate = Number(metrics?.rate || 0);
    const sample = Number(metrics?.sample || 0);

    let sampleScore = 0;
    if (sample >= 150) sampleScore = 100;
    else if (sample >= 50) sampleScore = 80;
    else if (sample >= 20) sampleScore = 60;
    else if (sample > 0) sampleScore = 30;

    const analyticalMode = recommendationMode === 'analytical';
    const marketScore = Number(marketQuality?.score || 50);
    const directionalAlignment = marketQuality?.directionalBias === 'neutral'
      ? 50 : marketQuality?.directionalBias === direction ? 100 : 0;
    const regimePenalty = analyticalMode
      ? (marketQuality?.regime === 'volatile_noise' ? -15
        : marketQuality?.regime === 'strong_directional' && directionalAlignment === 0 ? -20
        : marketQuality?.regime === 'compression' ? -5 : 0)
      : 0;

    const combinedScore = analyticalMode
      ? Math.max(0, Math.min(100, Math.round(
          contextScore*.35 + historicalRate*.35 + sampleScore*.10 +
          marketScore*.10 + directionalAlignment*.10 + regimePenalty
        )))
      : Math.max(0, Math.min(100, Math.round(
          contextScore*.45 + historicalRate*.40 + sampleScore*.15
        )));

    let recommendation = 'WAIT';
    let label = 'Aguardar';
    let level = 'caution';
    let reason = 'Condições ainda não são suficientes para recomendar uma entrada.';

    if (!usable.length) {
      recommendation = 'WAIT';
      label = 'Aguardar por contexto';
      level = 'insufficient';
      reason = 'Ainda não existem períodos suficientes para validar Mar, Maré, Onda e Marola.';
    } else if (sample < 20) {
      recommendation = 'WAIT';
      label = 'Não recomendado — amostra baixa';
      level = 'unfavorable';
      reason = `A estratégia possui apenas ${sample} ocorrências históricas.`;
    } else if (
      analyticalMode
        ? (combinedScore >= 75 && contextScore >= 75 && historicalRate >= 70)
        : (combinedScore >= 65 && contextScore >= 50 && historicalRate >= 65)
    ) {
      recommendation = 'ENTER';
      label = 'Entrada recomendada';
      level = 'favorable';
      reason = analyticalMode
        ? 'O histórico, os contextos e a qualidade do mercado estão alinhados com a direção projetada.'
        : 'O histórico e a maioria dos contextos estão alinhados com a direção projetada.';
    } else if (combinedScore < (analyticalMode ? 50 : 45) || contextScore <= 25) {
      recommendation = 'AVOID';
      label = 'Entrada não recomendada';
      level = 'unfavorable';
      reason = 'O contexto está majoritariamente contrário ou o desempenho histórico não sustenta a entrada.';
    } else {
      recommendation = 'WAIT';
      label = 'Aguardar confirmação';
      level = 'caution';
      reason = 'Há sinais mistos entre histórico e contexto. Aguarde uma condição mais consistente.';
    }

    return {
      recommendation,
      level,
      label,
      score: combinedScore,
      contextScore,
      historicalRate,
      sample,
      aligned: aligned.map(([name]) => name),
      contrary: contrary.map(([name]) => name),
      explanation: reason,
      marketQuality: marketQuality || null,
      recommendationMode
    };
  }

  async function analyze(candles, strategiesInput, options = {}) {
    const strategies = strategiesInput || await getStrategies();
    const sorted = [...candles].sort((a,b) => Number(b.from)-Number(a.from));
    const latest = sorted[0] || null;
    const currentAssetId = latest ? assetKey(latest) : null;
    const current = currentAssetId ? sorted.filter(c => assetKey(c) === currentAssetId) : [];
    const symbol = latest?.symbol;

    const quadrants = buildQuadrants(current);
    const completed = quadrants.filter(q => q.complete);
    const m5 = aggregateCandles(current, 300);
    const m15 = aggregateCandles(current, 900);
    const m30 = aggregateCandles(current, 1800);
    const h1 = aggregateCandles(current, 3600);
    const d1 = aggregateCandles(current, 86400);

    const marketQuality = analyzeMarketQuality(current);
    const liveSignals = getLiveSignals(strategies, quadrants, current);
    const signalByStrategy = new Map(liveSignals.map(signal => [signal.strategyId, signal]));

    const backtests = strategies.map(strategy => {
      const metrics = backtestStrategy(strategy, quadrants);
      const liveSignal = signalByStrategy.get(strategy.id) || null;
      const latestDirection = liveSignal?.direction || null;
      const recommendation = latestDirection
        ? contextRecommendation({
            marola: contextFromCandles(current.filter(isM1Candle), 15),
            onda: contextFromCandles(m5, 12),
            mare: contextFromCandles(m15, 8),
            mar: contextFromCandles(m30, 6)
          }, latestDirection, metrics, marketQuality, options.recommendationMode || 'classic')
        : null;

      return {
        strategy,
        metrics,
        liveSignal,
        recommendation
      };
    }).sort((a,b) => b.metrics.rate - a.metrics.rate || b.metrics.sample - a.metrics.sample);

    return {
      latest,
      currentAssetId,
      symbol,
      total: candles.length,
      quadrants,
      latestQuadrant: completed.at(-1) || null,
      aggregated: {
        m5: m5.filter(c => c.complete),
        m15: m15.filter(c => c.complete),
        m30: m30.filter(c => c.complete),
        h1: h1.filter(c => c.complete),
        d1: d1.filter(c => c.complete)
      },
      contextModel: {
        baseTimeframe: 60,
        marola: { timeframeSec: 60, label: 'M1', sampleTarget: 15 },
        onda: { timeframeSec: 300, label: 'M5', sampleTarget: 12 },
        mare: { timeframeSec: 900, label: 'M15', sampleTarget: 8 },
        mar: { timeframeSec: 1800, label: 'M30', sampleTarget: 6 }
      },
      contexts: {
        marola: contextFromCandles(current.filter(isM1Candle), 15),
        onda: contextFromCandles(m5, 12),
        mare: contextFromCandles(m15, 8),
        mar: contextFromCandles(m30, 6)
      },
      assetCoverage: getAssetCoverage(candles),
      captureDiagnostics: buildCaptureDiagnostics(candles, currentAssetId),
      strategies,
      backtests,
      liveSignals,
      marketQuality,
      recommendationMode: options.recommendationMode || 'classic'
    };
  }

  return {
    openDb, normalizeCandle, putCandles, addDiagnostic, getAllCandles, getDiagnostics,
    getSetting, setSetting, ensureDefaultStrategies, getStrategies, updateStrategy,
    buildQuadrants, aggregateCandles, buildCaptureDiagnostics, getAssetCoverage, relinkHistoricalCandles, backtestStrategy, signalForStrategy, getCurrentQuadrant, previewSignalForStrategy, getLiveSignals, analyzeMarketQuality, contextRecommendation, analyze
  };
})();

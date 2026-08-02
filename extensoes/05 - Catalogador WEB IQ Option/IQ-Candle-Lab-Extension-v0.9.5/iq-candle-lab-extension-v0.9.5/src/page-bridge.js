const IQLABPageBridgeCore = (() => {
  const HISTORY_TTL_MS = 60_000;
  const MAX_PENDING_HISTORY = 100;

  function safeParse(data) {
    if (typeof data !== 'string') return null;
    try { return JSON.parse(data); } catch { return null; }
  }

  function eventName(value) {
    for (const item of knownContainers(value)) {
      const name = item.name ?? item.event ?? item.type;
      if (typeof name === 'string') return name;
    }
    return undefined;
  }

  function knownContainers(value) {
    return [value, value?.msg, value?.body, value?.params, value?.msg?.body, value?.msg?.params]
      .filter(item => item && typeof item === 'object' && !Array.isArray(item));
  }

  function requestId(value) {
    for (const item of knownContainers(value)) {
      const id = item.request_id ?? item.requestId;
      if (typeof id === 'string' || typeof id === 'number') return id;
    }
    return null;
  }

  function relevantStructurePaths(value, prefix = '', paths = [], depth = 0) {
    if (depth > 7 || value == null || typeof value !== 'object') return paths;
    if (Array.isArray(value)) {
      if (value.length && prefix) paths.push(`${prefix}[]`);
      if (value[0] && typeof value[0] === 'object') relevantStructurePaths(value[0], `${prefix}[]`, paths, depth + 1);
      return [...new Set(paths)];
    }
    const relevant = new Set(['name','event','type','request_id','requestId','active_id','activeId',
      'instrument_active_id','timeframe','period','interval','size','count','from','to','end','candles']);
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (relevant.has(key)) paths.push(Array.isArray(child) ? `${path}[]` : path);
      if (child && typeof child === 'object') relevantStructurePaths(child, path, paths, depth + 1);
    }
    return [...new Set(paths)];
  }

  function candleSummary(value) {
    const candidates = [value?.candles, value?.msg?.candles, value?.body?.candles,
      value?.msg?.body?.candles, Array.isArray(value?.msg) ? value.msg : null]
      .find(Array.isArray) || [];
    const times = candidates.map(candle => Number(candle?.from ?? candle?.start ?? candle?.timestamp))
      .filter(Number.isFinite).sort((a,b) => a-b);
    return { candleCount: candidates.length, firstFrom: times[0] ?? null, lastFrom: times.at(-1) ?? null };
  }

  function protocolFixture(direction, value, metadata = {}, at = Date.now()) {
    const context = metadata.correlation || commandContext(value);
    const candles = candleSummary(value);
    return {
      direction, name: eventName(value) || metadata.name || 'unknown', socketId: metadata.socketId,
      requestId: requestId(value) ?? metadata.requestId ?? null,
      ...(direction === 'incoming' ? {
        correlated: Boolean(metadata.correlation), activeId: context?.activeId ?? null,
        timeframeSec: context?.timeframeSec ?? null, ...candles, receivedAt: at
      } : {
        activeId: context?.activeId ?? null, timeframeSec: context?.timeframeSec ?? null,
        requestedCount: context?.requestedCount, from: context?.from ?? null, to: context?.to ?? null,
        sentAt: at
      }),
      structurePaths: relevantStructurePaths(value)
    };
  }

  function commandContext(value) {
    for (const item of knownContainers(value)) {
      const activeId = item.active_id ?? item.activeId ?? item.instrument_active_id;
      if (typeof activeId !== 'string' && typeof activeId !== 'number') continue;
      // No comando comprovado get-candles, size é o período e count é a quantidade.
      const timeframe = Number(item.timeframe ?? item.period ?? item.interval ?? item.size);
      return {
        activeId,
        timeframeSec: [60,300,900,1800,3600,86400].includes(timeframe) ? timeframe : undefined,
        from: item.from ?? null,
        to: item.to ?? item.end ?? null,
        requestedCount: Number.isFinite(Number(item.count)) ? Number(item.count) : undefined
      };
    }
    return {};
  }

  function createCorrelationStore(options = {}) {
    const ttlMs = Number(options.ttlMs || HISTORY_TTL_MS);
    const max = Number(options.max || MAX_PENDING_HISTORY);
    const onExpire = typeof options.onExpire === 'function' ? options.onExpire : null;
    const rows = new Map();
    let expired = 0;
    function cleanup(now = Date.now()) {
      const previousExpired = expired;
      for (const [id, row] of rows) {
        if (now - row.requestedAt > ttlMs) {
          rows.delete(id);
          expired += 1;
        }
      }
      if (expired > previousExpired) onExpire?.(expired - previousExpired);
      while (rows.size > max) rows.delete(rows.keys().next().value);
      return expired;
    }
    return {
      add(id, context, now = Date.now()) {
        cleanup(now);
        if (id == null) return false;
        rows.set(String(id), { ...context, requestId: id, requestedAt: now });
        cleanup(now);
        return true;
      },
      take(id, now = Date.now()) {
        cleanup(now);
        if (id == null) return null;
        const row = rows.get(String(id)) || null;
        rows.delete(String(id));
        return row;
      },
      takeUnambiguous(now = Date.now()) {
        cleanup(now);
        // A ordem do socket só é usada quando há exatamente um pedido pendente.
        if (rows.size !== 1) return null;
        const [id, row] = rows.entries().next().value;
        rows.delete(id);
        return row;
      },
      cleanup,
      clear() { rows.clear(); },
      size() { return rows.size; },
      expiredCount() { return expired; },
      summary(now = Date.now()) {
        cleanup(now);
        return [...rows.values()].map(row => ({
          requestId: row.requestId, activeId: row.activeId, timeframeSec: row.timeframeSec,
          requestedCount: row.requestedCount, from: row.from ?? null, to: row.to ?? null,
          ageMs: Math.max(0, now - row.requestedAt)
        }));
      }
    };
  }

  return {
    HISTORY_TTL_MS, MAX_PENDING_HISTORY, safeParse, eventName, requestId,
    commandContext, relevantStructurePaths, candleSummary, protocolFixture, createCorrelationStore
  };
})();

if (typeof module !== 'undefined') module.exports = IQLABPageBridgeCore;

if (typeof window !== 'undefined') (() => {
  if (window.__IQ_CANDLE_LAB_BRIDGE__) return;
  window.__IQ_CANDLE_LAB_BRIDGE__ = true;
  const NativeWebSocket = window.WebSocket;
  let messageCount = 0;
  let socketSequence = 0;
  let protocolDiagnosticsEnabled = false;
  let protocolFixtureCount = 0;
  const MAX_PROTOCOL_FIXTURES = 100;

  function emit(type, detail) {
    window.dispatchEvent(new CustomEvent('IQ_CANDLE_LAB_BRIDGE', { detail: { type, detail, at: Date.now() } }));
  }

  function emitProtocolFixture(direction, value, metadata) {
    if (!protocolDiagnosticsEnabled || protocolFixtureCount >= MAX_PROTOCOL_FIXTURES) return;
    protocolFixtureCount += 1;
    emit('PROTOCOL_FIXTURE', IQLABPageBridgeCore.protocolFixture(direction, value, metadata));
  }

  window.addEventListener('IQ_CANDLE_LAB_PROTOCOL_DIAGNOSTICS', event => {
    protocolDiagnosticsEnabled = event.detail?.enabled === true;
    if (!protocolDiagnosticsEnabled) protocolFixtureCount = 0;
  });

  function WrappedWebSocket(...args) {
    const socket = new NativeWebSocket(...args);
    const socketId = `ws-${++socketSequence}`;
    const url = String(args[0] || '');
    const correlations = IQLABPageBridgeCore.createCorrelationStore({
      onExpire: count => emit('HISTORY_CORRELATION_EXPIRED', { url, expired: count })
    });
    const nativeSend = socket.send;
    const cleanupTimer = setInterval(() => {
      correlations.cleanup();
    }, 15_000);

    socket.send = function(data) {
      const parsed = IQLABPageBridgeCore.safeParse(data);
      if (parsed) {
        const name = IQLABPageBridgeCore.eventName(parsed) || 'unknown';
        const context = IQLABPageBridgeCore.commandContext(parsed);
        const id = IQLABPageBridgeCore.requestId(parsed);
        if (/^(get-candles|candles-history)$/i.test(name) && context.activeId != null) {
          correlations.add(id, { ...context, socketId });
          // Histórico é somente correlação; jamais constitui candidato de seleção.
          emit('HISTORY_REQUEST', { name, url, socketId, requestId: id, correlation: { ...context, socketId }, pending: correlations.size() });
          emitProtocolFixture('outgoing', parsed, { name, socketId, requestId: id, correlation: context });
        } else if (/subscribe|unsubscribe/i.test(name)) {
          emit('SUBSCRIPTION_COMMAND', { name, url, correlation: context });
        } else {
          emit('OUTGOING_COMMAND', { name, url });
        }
      }
      return nativeSend.call(this, data);
    };

    socket.addEventListener('open', () => emit('WS_OPEN', { url }));
    socket.addEventListener('close', e => {
      clearInterval(cleanupTimer);
      correlations.clear();
      emit('WS_CLOSE', { url, code: e.code, reason: e.reason });
    });
    socket.addEventListener('error', () => emit('WS_ERROR', { url }));
    socket.addEventListener('message', e => {
      const parsed = IQLABPageBridgeCore.safeParse(e.data);
      if (!parsed) return;
      messageCount += 1;
      const name = IQLABPageBridgeCore.eventName(parsed);
      const id = IQLABPageBridgeCore.requestId(parsed);
      // Algumas respostas não repetem request_id; a fila só é segura sem concorrência.
      const correlation = name === 'candles'
        ? (id == null ? correlations.takeUnambiguous() : correlations.take(id))
        : null;
      if (name === 'candles' && !correlation) {
        const candleCount = Array.isArray(parsed?.msg?.candles) ? parsed.msg.candles.length
          : Array.isArray(parsed?.candles) ? parsed.candles.length
          : Array.isArray(parsed?.msg) ? parsed.msg.length : 0;
        emit('HISTORY_UNCORRELATED', {
          kind: 'HISTORY_UNCORRELATED', eventName: name, requestId: id,
          responseCandleCount: candleCount, socketId,
          pendingRequestCount: correlations.size(), pendingRequestsSummary: correlations.summary(),
          receivedAt: Date.now(), reason: correlations.size() > 1
            ? 'ambiguous-pending-requests' : 'request-not-found-or-expired'
        });
      }
      if (name === 'candles') emitProtocolFixture('incoming', parsed, {
        name, socketId, requestId: id, correlation
      });
      if (['quote-generated','underlying-list-changed','candles','candle-generated'].includes(name)) {
        emit('IQ_EVENT', { name, payload: parsed, url, messageCount, correlation });
      }
    });
    return socket;
  }
  WrappedWebSocket.prototype = NativeWebSocket.prototype;
  Object.setPrototypeOf(WrappedWebSocket, NativeWebSocket);
  ['CONNECTING','OPEN','CLOSING','CLOSED'].forEach(k => Object.defineProperty(WrappedWebSocket, k, { value: NativeWebSocket[k] }));
  window.WebSocket = WrappedWebSocket;
  emit('BRIDGE_READY', { href: location.href });
})();

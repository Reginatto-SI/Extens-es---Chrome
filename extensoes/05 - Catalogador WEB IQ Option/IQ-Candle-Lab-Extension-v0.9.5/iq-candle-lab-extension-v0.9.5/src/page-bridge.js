const IQLABPageBridgeCore = (() => {
  const HISTORY_TTL_MS = 60_000;
  const MAX_PENDING_HISTORY = 100;

  function safeParse(data) {
    if (typeof data !== 'string') return null;
    try { return JSON.parse(data); } catch { return null; }
  }

  function eventName(value) {
    return value?.name ?? value?.event ?? value?.type ?? value?.msg?.name ?? value?.msg?.type;
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

  function commandContext(value) {
    for (const item of knownContainers(value)) {
      const activeId = item.active_id ?? item.activeId ?? item.instrument_active_id;
      if (typeof activeId !== 'string' && typeof activeId !== 'number') continue;
      const timeframe = Number(item.timeframe ?? item.period ?? item.interval ?? item.size);
      return {
        activeId,
        timeframeSec: [60,300,900,1800,3600,86400].includes(timeframe) ? timeframe : 60,
        from: item.from ?? null,
        to: item.to ?? item.end ?? null,
        count: item.count ?? null
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
      cleanup,
      clear() { rows.clear(); },
      size() { return rows.size; },
      expiredCount() { return expired; }
    };
  }

  return {
    HISTORY_TTL_MS, MAX_PENDING_HISTORY, safeParse, eventName, requestId,
    commandContext, createCorrelationStore
  };
})();

if (typeof module !== 'undefined') module.exports = IQLABPageBridgeCore;

if (typeof window !== 'undefined') (() => {
  if (window.__IQ_CANDLE_LAB_BRIDGE__) return;
  window.__IQ_CANDLE_LAB_BRIDGE__ = true;
  const NativeWebSocket = window.WebSocket;
  let messageCount = 0;

  function emit(type, detail) {
    window.dispatchEvent(new CustomEvent('IQ_CANDLE_LAB_BRIDGE', { detail: { type, detail, at: Date.now() } }));
  }

  function WrappedWebSocket(...args) {
    const socket = new NativeWebSocket(...args);
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
          correlations.add(id, context);
          // Histórico é somente correlação; jamais constitui candidato de seleção.
          emit('HISTORY_REQUEST', { name, url, requestId: id, correlation: context, pending: correlations.size() });
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
      const correlation = name === 'candles' ? correlations.take(id) : null;
      if (name === 'candles' && !correlation) {
        emit('HISTORY_UNCORRELATED', { name, url, requestId: id });
      }
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

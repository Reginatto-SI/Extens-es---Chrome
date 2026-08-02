(() => {
  if (window.__IQ_CANDLE_LAB_BRIDGE__) return;
  window.__IQ_CANDLE_LAB_BRIDGE__ = true;
  const NativeWebSocket = window.WebSocket;
  let messageCount = 0;

  function emit(type, detail) {
    window.dispatchEvent(new CustomEvent('IQ_CANDLE_LAB_BRIDGE', { detail: { type, detail, at: Date.now() } }));
  }

  function safeParse(data) {
    if (typeof data !== 'string') return null;
    try { return JSON.parse(data); } catch { return null; }
  }

  function inspect(data, url) {
    const parsed = safeParse(data);
    if (!parsed) return;
    messageCount += 1;
    const name = parsed.name ?? parsed.event ?? parsed.type ?? parsed.msg?.name;
    if (['quote-generated','underlying-list-changed','candles','candle-generated'].includes(name)) {
      emit('IQ_EVENT', { name, payload: parsed, url, messageCount });
      return;
    }
    const text = JSON.stringify(parsed);
    if (/candle-generated|"candles"|quote-generated|underlying-list-changed/i.test(text)) {
      emit('IQ_EVENT_CANDIDATE', { name: name || 'unknown', payload: parsed, url, messageCount });
    }
  }

  function WrappedWebSocket(...args) {
    const socket = new NativeWebSocket(...args);
    const url = String(args[0] || '');
    socket.addEventListener('open', () => emit('WS_OPEN', { url }));
    socket.addEventListener('close', e => emit('WS_CLOSE', { url, code: e.code, reason: e.reason }));
    socket.addEventListener('error', () => emit('WS_ERROR', { url }));
    socket.addEventListener('message', e => inspect(e.data, url));
    return socket;
  }
  WrappedWebSocket.prototype = NativeWebSocket.prototype;
  Object.setPrototypeOf(WrappedWebSocket, NativeWebSocket);
  ['CONNECTING','OPEN','CLOSING','CLOSED'].forEach(k => Object.defineProperty(WrappedWebSocket, k, { value: NativeWebSocket[k] }));
  window.WebSocket = WrappedWebSocket;
  emit('BRIDGE_READY', { href: location.href });
})();

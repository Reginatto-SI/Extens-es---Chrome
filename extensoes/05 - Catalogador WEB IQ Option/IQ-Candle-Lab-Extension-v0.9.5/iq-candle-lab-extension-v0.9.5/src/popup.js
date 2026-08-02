(async () => {
  const candles = await IQLAB.getAllCandles();
  const a = IQLAB.analyze(candles);
  document.getElementById('total').textContent = a.total;
  document.getElementById('symbol').textContent = a.symbol || 'Aguardando';
  document.getElementById('quadrant').textContent = a.latestQuadrant ? a.latestQuadrant.sequence.map(c => c[0].toUpperCase()).join(' ') : 'Sem quadrante';
  document.getElementById('open').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
})();

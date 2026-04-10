chrome.action.onClicked.addListener(async () => {
  // A extensão sempre abre em nova aba para manter o padrão de aplicação completa.
  await chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
});

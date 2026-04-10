chrome.action.onClicked.addListener(async () => {
  try {
    const url = chrome.runtime.getURL("popup.html");
    await chrome.tabs.create({ url });
  } catch (error) {
    console.error("Erro ao abrir a tela do validador:", error);
  }
});
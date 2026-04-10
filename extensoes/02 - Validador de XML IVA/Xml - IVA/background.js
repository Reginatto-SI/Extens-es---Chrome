chrome.action.onClicked.addListener(async () => {
  try {
    const url = chrome.runtime.getURL("popup.html");
    await chrome.tabs.create({ url });
  } catch (error) {
    console.error("Erro ao abrir a tela do validador:", error);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  try {
    // Registra a versão e o horário da última instalação/atualização da extensão.
    await chrome.storage.local.set({
      extensionVersion: chrome.runtime.getManifest().version,
      extensionUpdatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Erro ao registrar metadados da extensão:", error);
  }
});

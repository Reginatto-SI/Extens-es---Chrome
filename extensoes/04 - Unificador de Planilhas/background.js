chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("popup.html");
  await chrome.tabs.create({ url });
});

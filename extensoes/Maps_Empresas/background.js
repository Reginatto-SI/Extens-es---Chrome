const SESSION_DEFAULTS = {
  mapsEmpresasLeads: [],
  mapsEmpresasFieldMap: {},
  mapsEmpresasStatus: 'Aguardando',
  mapsEmpresasLastMessage: ''
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.session.get(Object.keys(SESSION_DEFAULTS));
  await chrome.storage.session.set({
    ...SESSION_DEFAULTS,
    ...Object.fromEntries(
      Object.entries(current).filter(([, value]) => value !== undefined)
    )
  });
});

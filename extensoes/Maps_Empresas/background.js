// Libera o storage.session para content scripts no MV3 antes de qualquer sincronização.
async function ensureSessionAccessLevel() {
  try {
    if (chrome.storage?.session?.setAccessLevel) {
      await chrome.storage.session.setAccessLevel({
        accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
      });
    }
  } catch (error) {
    console.error('[Maps_Empresas] Falha ao configurar acesso ao storage.session:', error);
  }
}

const SESSION_DEFAULTS = {
  mapsEmpresasLeads: [],
  mapsEmpresasFieldMap: {},
  mapsEmpresasStatus: 'Aguardando',
  mapsEmpresasLastMessage: ''
};

ensureSessionAccessLevel();

async function initializeSessionDefaults() {
  const current = await chrome.storage.session.get(Object.keys(SESSION_DEFAULTS));
  await chrome.storage.session.set({
    ...SESSION_DEFAULTS,
    ...Object.fromEntries(
      Object.entries(current).filter(([, value]) => value !== undefined)
    )
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureSessionAccessLevel();

  // Em atualização, não regrava defaults para preservar o estado temporário existente quando possível.
  if (details.reason === 'install') {
    await initializeSessionDefaults();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureSessionAccessLevel();
});

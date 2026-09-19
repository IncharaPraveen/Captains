const extensionApi = globalThis.browser ?? globalThis.chrome;

function applyEnabledState(enabled) {
  document.documentElement.classList.toggle("captains-extension-enabled", enabled);
}

extensionApi.storage.local.get({ enabled: true }, ({ enabled }) => {
  applyEnabledState(enabled);
});

extensionApi.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.enabled) {
    applyEnabledState(changes.enabled.newValue);
  }
});

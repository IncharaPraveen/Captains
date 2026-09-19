const extensionApi = globalThis.browser ?? globalThis.chrome;

extensionApi.runtime.onInstalled.addListener(() => {
  extensionApi.storage.local.get("enabled", (result) => {
    if (typeof result.enabled === "undefined") {
      extensionApi.storage.local.set({ enabled: true });
    }
  });
});

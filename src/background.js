const extensionApi = globalThis.browser ?? globalThis.chrome;

extensionApi.runtime.onInstalled.addListener(() => {
  extensionApi.storage.local.get(
    ["openDyslexic"],
    (result) => {
      const defaults = {};

      if (typeof result.openDyslexic === "undefined") {
        defaults.openDyslexic = false;
      }

      if (Object.keys(defaults).length > 0) {
        extensionApi.storage.local.set(defaults);
      }
    },
  );
});

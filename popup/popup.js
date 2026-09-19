const extensionApi = globalThis.browser ?? globalThis.chrome;
const enabledInput = document.querySelector("#enabled");
const status = document.querySelector("#status");

extensionApi.storage.local.get({ enabled: true }, ({ enabled }) => {
  enabledInput.checked = enabled;
});

enabledInput.addEventListener("change", () => {
  extensionApi.storage.local.set({ enabled: enabledInput.checked }, () => {
    status.textContent = "Saved";
    window.setTimeout(() => {
      status.textContent = "";
    }, 1200);
  });
});

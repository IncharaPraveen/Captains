globalThis.Captains ??= {};
globalThis.Captains.features ??= {};

globalThis.Captains.features.openDyslexic = {
  setEnabled(enabled) {
    document.documentElement.classList.toggle(
      "captains-open-dyslexic",
      enabled,
    );
  },
};

// Coordinates features that run inside the current webpage.
const extensionApi = globalThis.browser ?? globalThis.chrome;
const features = globalThis.Captains.features;

extensionApi.storage.local.get(
  { openDyslexic: false },
  ({ openDyslexic }) => {
    features.openDyslexic.setEnabled(openDyslexic);
  },
);

extensionApi.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.openDyslexic) {
    features.openDyslexic.setEnabled(changes.openDyslexic.newValue);
  }
});

extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "CAPTAINS_EXTRACT_READER":
      sendResponse(features.extract.forReader());
      break;
    case "CAPTAINS_START_READING":
      features.textToSpeech.start();
      sendResponse({ ok: true });
      break;
    case "CAPTAINS_STOP_READING":
      features.textToSpeech.stop();
      sendResponse({ ok: true });
      break;
    default:
      return false;
  }

  return false;
});

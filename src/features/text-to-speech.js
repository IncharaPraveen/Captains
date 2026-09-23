globalThis.Captains ??= {};
globalThis.Captains.features ??= {};

globalThis.Captains.features.textToSpeech = {
  start() {
    const text = document.body?.innerText.trim();

    if (!text) {
      return;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  },

  stop() {
    window.speechSynthesis.cancel();
  },
};

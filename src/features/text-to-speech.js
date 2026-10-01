globalThis.Captains ??= {};
globalThis.Captains.features ??= {};

function preferredSpeechVoice() {
  const voices = window.speechSynthesis.getVoices();
  const americanVoices = voices.filter((voice) =>
    /^en[-_]US$/i.test(voice.lang),
  );
  const maleName = /alex|david|daniel|guy|james|john|mark|mike|male/i;

  return americanVoices.find((voice) => maleName.test(voice.name))
    ?? americanVoices[0]
    ?? voices.find((voice) => /^en/i.test(voice.lang))
    ?? null;
}

globalThis.Captains.features.textToSpeech = {
  speak(text) {
    const value = text?.trim();
    if (!value) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.voice = preferredSpeechVoice();
    utterance.rate = 0.95;
    utterance.pitch = 0.95;
    window.speechSynthesis.speak(utterance);
  },

  start() {
    this.speak(document.body?.innerText);
  },

  stop() {
    window.speechSynthesis.cancel();
  },
};

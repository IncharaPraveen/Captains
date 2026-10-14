const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const vm = require("node:vm");

function setup(text = "First word. Second word.") {
  const elements = new Map();
  const documentListeners = new Map();
  const timers = [];
  const spoken = [];
  const synthesis = {
    paused: false,
    cancel() {},
    pause() { this.paused = true; },
    resume() { this.paused = false; },
    speak(utterance) { spoken.push(utterance); },
    getVoices() { return []; },
  };
  const makeElement = id => {
    if (!elements.has(id)) elements.set(id, {
      value: id === "#rate" || id === "#volume" ? "1" : "0",
      style: { setProperty() {} },
      listeners: {},
      addEventListener(type, callback) { this.listeners[type] = callback; },
      contains() { return false; },
      setAttribute() {},
    });
    return elements.get(id);
  };
  const shadow = { innerHTML: "", querySelector: makeElement };
  const host = {
    dataset: {},
    hidden: true,
    style: { setProperty() {}, getPropertyValue() { return ""; } },
    attachShadow: () => shadow,
    contains: () => false,
    getBoundingClientRect: () => ({ width: 360, height: 180 }),
  };
  const document = {
    createElement: () => host,
    addEventListener(type, callback) { documentListeners.set(type, callback); },
    documentElement: { lang: "en", append() {} },
  };
  const selection = {
    rangeCount: 1,
    isCollapsed: false,
    toString: () => text,
    getRangeAt: () => ({
      getBoundingClientRect: () => ({
        left: 10, top: 10, right: 110, bottom: 30, width: 100, height: 20,
      }),
    }),
  };
  const context = {
    document,
    window: { speechSynthesis: synthesis, getSelection: () => selection,
      innerWidth: 800, innerHeight: 600, addEventListener() {} },
    SpeechSynthesisUtterance: function(text) { this.text = text; },
    requestAnimationFrame(callback) { callback(); },
    setTimeout(callback, delay) {
      const timer = { callback, delay };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) { if (timer) timer.canceled = true; },
  };
  vm.runInNewContext(
    readFileSync(require.resolve("../src/features/text-to-speech.js"), "utf8"),
    context,
  );
  context.Captains.features.textToSpeech.initialize();
  const fire = (id, type = "click") => elements.get(`#${id}`).listeners[type]();
  const flush = () => {
    while (timers.length) {
      const timer = timers.shift();
      if (!timer.canceled) timer.callback();
    }
  };
  documentListeners.get("mouseup")({ target: {} });
  return { elements, spoken, synthesis, fire, flush, timers };
}

test("Stop then Play ignores completion events from canceled speech", () => {
  const audio = setup();
  audio.fire("play");
  audio.flush();
  const oldEnd = audio.spoken[0].onend;
  audio.fire("stop");
  audio.fire("play");
  oldEnd();
  audio.flush();
  assert.equal(audio.spoken.length, 2);
  assert.equal(audio.spoken[1].text, "First word. Second word.");
  assert.equal(audio.elements.get("#play").disabled, true);
  audio.spoken[1].onerror({ error: "synthesis-failed" });
  assert.equal(audio.elements.get("#play").disabled, false);
});

test("rapid Play, Stop, Play only starts the latest request", () => {
  const audio = setup();
  audio.fire("play");
  audio.fire("stop");
  audio.fire("play");
  audio.flush();
  assert.equal(audio.spoken.length, 1);
});

test("speed and volume changes restart from the current word", () => {
  const audio = setup();
  audio.fire("play");
  audio.flush();
  audio.spoken[0].onboundary({ charIndex: 12 });
  audio.elements.get("#rate").value = "1.5";
  audio.fire("rate", "input");
  audio.elements.get("#volume").value = "0.4";
  audio.fire("volume", "input");
  audio.flush();
  assert.equal(audio.spoken.length, 2);
  assert.equal(audio.spoken[1].text, "Second word.");
  assert.equal(audio.spoken[1].rate, 1.5);
  assert.equal(audio.spoken[1].volume, 0.4);
});

test("settings while paused wait for Play; Stop resets the word position", () => {
  const audio = setup();
  audio.fire("play");
  audio.flush();
  audio.spoken[0].onboundary({ charIndex: 12 });
  audio.fire("pause");
  audio.elements.get("#rate").value = "2";
  audio.fire("rate", "input");
  audio.flush();
  assert.equal(audio.spoken.length, 1);
  audio.fire("play");
  audio.flush();
  assert.equal(audio.spoken[1].text, "Second word.");
  assert.equal(audio.synthesis.paused, false);
  audio.fire("stop");
  audio.fire("play");
  audio.flush();
  assert.equal(audio.spoken[2].text, "First word. Second word.");
});

test("Pause before speech starts and Stop cancel queued work", () => {
  const audio = setup();
  audio.fire("play");
  audio.fire("pause");
  audio.flush();
  assert.equal(audio.spoken.length, 0);
  audio.fire("play");
  audio.fire("stop");
  audio.flush();
  assert.equal(audio.spoken.length, 0);
  audio.fire("play");
  audio.flush();
  assert.equal(audio.spoken.length, 1);
});

test("progress follows word events, seeking restarts, and completion reaches 100%", () => {
  const audio = setup();
  audio.fire("play");
  audio.flush();
  audio.spoken[0].onboundary({ charIndex: 6 });
  assert.equal(audio.elements.get("#progress").value, "6");
  audio.elements.get("#progress").value = "15";
  audio.fire("progress", "input");
  audio.flush();
  assert.equal(audio.spoken[1].text, "Second word.");
  audio.spoken[1].onend();
  assert.equal(audio.elements.get("#progress-value").textContent, "100%");
  audio.fire("play");
  audio.flush();
  assert.equal(audio.spoken[2].text, "First word. Second word.");
});

test("voices without boundary events advance progress at chunk completion", () => {
  const text = "A sentence with several words. ".repeat(20);
  const audio = setup(text);
  audio.fire("play");
  audio.flush();
  let completed = "";
  while (completed.length < text.trim().length) {
    const utterance = audio.spoken.at(-1);
    assert.ok(utterance.text.length > 0 && utterance.text.length <= 201);
    completed += utterance.text;
    utterance.onend();
    assert.equal(Number(audio.elements.get("#progress").value), completed.length);
  }
  assert.equal(completed, text.trim());
  assert.equal(audio.elements.get("#progress-value").textContent, "100%");
});

test("Stop clears pause and Play allows native cancellation to settle", () => {
  const audio = setup();
  audio.fire("play");
  audio.flush();
  audio.fire("pause");
  audio.fire("stop");
  assert.equal(audio.synthesis.paused, false);
  audio.fire("play");
  assert.ok(audio.timers.at(-1).delay > 0);
  audio.flush();
  assert.equal(audio.spoken.length, 2);
});

test("Play, Pause, Play before timers run starts one utterance", () => {
  const audio = setup();
  audio.fire("play");
  audio.fire("pause");
  audio.fire("play");
  audio.flush();
  assert.equal(audio.spoken.length, 1);
});

test("Summarise shows a concise local summary of the selected text", () => {
  const audio = setup(
    "Cancer screening can identify disease earlier. Earlier detection may improve treatment options. Screening also creates false positives and anxiety. Patients should discuss individual risks with a clinician.",
  );
  audio.fire("summarise");
  assert.equal(audio.elements.get("#summary").hidden, false);
  assert.ok(audio.elements.get("#summary-text").textContent.length > 0);
  assert.ok(audio.elements.get("#summary-text").textContent.length < 183);
});

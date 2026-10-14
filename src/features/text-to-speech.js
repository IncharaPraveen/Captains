(() => {
"use strict";

globalThis.Captains ??= {};
globalThis.Captains.features ??= {};

if (globalThis.Captains.features.textToSpeech?.version === "0.1.4") return;

globalThis.Captains.features.textToSpeech?.stop?.();
document.querySelectorAll?.("captains-read-aloud")?.forEach((element) => {
  element.remove();
});

const CHUNK_LENGTH = 200;
const CANCEL_SETTLE_TIME = 150;
const SUMMARY_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for",
  "from", "had", "has", "have", "he", "her", "his", "i", "in", "is", "it",
  "its", "of", "on", "or", "our", "she", "that", "the", "their", "they",
  "this", "to", "was", "we", "were", "which", "who", "will", "with", "you",
]);

let initialized = false;
let host;
let controls;
let selectedText = "";
let selectedUtterance;
let playback = "stopped";
let playbackRequest = 0;
let selectionOffset = 0;
let restartTimer;
let readyAt = 0;
let selectionCaptureTimer;
let summaryRequest = 0;

function createControls() {
  host = document.createElement("captains-read-aloud");
  host.dataset.captainsVersion = "0.1.3";
  host.hidden = true;
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("z-index", "2147483647", "important");
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial !important;
        box-sizing: border-box !important;
        color-scheme: light !important;
        display: block !important;
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif !important;
        left: var(--captains-left, 8px) !important;
        max-width: calc(100vw - 16px) !important;
        position: fixed !important;
        top: var(--captains-top, 8px) !important;
        width: 380px !important;
        z-index: 2147483647 !important;
      }

      :host([hidden]) { display: none !important; }
      * { box-sizing: border-box; }

      .panel {
        background: #ffffff;
        border: 1px solid #d7dee8;
        border-radius: 14px;
        box-shadow: 0 14px 38px rgb(15 23 42 / 22%);
        color: #172033;
        overflow: hidden;
      }

      .topbar {
        align-items: center;
        display: flex;
        gap: 8px;
        padding: 10px 10px 8px 12px;
      }

      .title {
        flex: 1;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.01em;
      }

      .status {
        color: #657086;
        font-size: 12px;
      }

      button {
        align-items: center;
        background: #f3f6fa;
        border: 1px solid #d7dee8;
        border-radius: 8px;
        color: #172033;
        cursor: pointer;
        display: inline-flex;
        font: 600 13px/1 ui-sans-serif, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
        height: 34px;
        justify-content: center;
        padding: 0 12px;
      }

      button:hover:not(:disabled) { background: #e8edf5; }
      button:focus-visible, input:focus-visible, summary:focus-visible {
        outline: 3px solid #7bb8ff;
        outline-offset: 2px;
      }
      button:disabled { cursor: default; opacity: 0.42; }

      .close {
        background: transparent;
        border-color: transparent;
        border-radius: 50%;
        font-size: 20px;
        font-weight: 400;
        height: 30px;
        padding: 0;
        width: 30px;
      }

      .transport {
        align-items: center;
        display: flex;
        gap: 7px;
        padding: 0 12px 10px;
      }

      .summarise { margin-left: auto; }

      .play {
        background: #1769e0;
        border-color: #1769e0;
        color: #fff;
        min-width: 68px;
      }
      .play:hover:not(:disabled) { background: #0d58c3; }

      .progress-row {
        align-items: center;
        display: grid;
        gap: 9px;
        grid-template-columns: 1fr auto;
        padding: 0 12px 11px;
      }

      input[type="range"] {
        appearance: none;
        accent-color: #1769e0;
        background: #dce3ed;
        border-radius: 999px;
        cursor: pointer;
        height: 5px;
        margin: 0;
        min-width: 0;
        width: 100%;
      }

      input[type="range"]::-webkit-slider-thumb {
        appearance: none;
        background: #1769e0;
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgb(15 23 42 / 28%);
        height: 17px;
        width: 17px;
      }

      output {
        color: #657086;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        min-width: 32px;
        text-align: right;
      }

      details { border-top: 1px solid #e8edf3; }

      summary {
        color: #4d596f;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        list-style-position: inside;
        padding: 9px 12px;
        user-select: none;
      }

      .settings {
        display: grid;
        gap: 10px;
        padding: 2px 12px 12px;
      }

      label {
        align-items: center;
        color: #4d596f;
        display: grid;
        font-size: 12px;
        gap: 8px;
        grid-template-columns: 48px 1fr 38px;
      }

      .summary {
        background: #f7f9fc;
        border-top: 1px solid #e3e8f0;
        padding: 11px 12px 12px;
      }

      .summary[hidden] { display: none; }

      .summary-heading {
        color: #4d596f;
        display: block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        margin-bottom: 5px;
        text-transform: uppercase;
      }

      .summary p {
        color: #273248;
        font-size: 13px;
        line-height: 1.45;
        margin: 0;
        max-height: 130px;
        overflow: auto;
      }

      @media (prefers-reduced-motion: no-preference) {
        .panel { animation: captains-in 120ms ease-out; }
        @keyframes captains-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.985); }
        }
      }
    </style>
    <aside class="panel" aria-label="Read selected text aloud">
      <div class="topbar">
        <span class="title">Read selection</span>
        <span id="status" class="status" role="status">Ready</span>
        <button id="close" class="close" type="button" aria-label="Close read-aloud controls">&times;</button>
      </div>
      <div class="transport">
        <button id="play" class="play" type="button">Start</button>
        <button id="pause" type="button">Pause</button>
        <button id="stop" type="button">Stop</button>
        <button id="summarise" class="summarise" type="button">Summarise</button>
      </div>
      <div class="progress-row">
        <input id="progress" type="range" min="0" max="1" step="1" value="0" aria-label="Reading progress" />
        <output id="progress-value" for="progress">0%</output>
      </div>
      <details>
        <summary>Voice settings</summary>
        <div class="settings">
          <label>
            <span>Speed</span>
            <input id="rate" type="range" min="0.5" max="2" step="0.1" value="1" />
            <output id="rate-value" for="rate">1x</output>
          </label>
          <label>
            <span>Volume</span>
            <input id="volume" type="range" min="0" max="1" step="0.05" value="1" />
            <output id="volume-value" for="volume">100%</output>
          </label>
        </div>
      </details>
      <section id="summary" class="summary" aria-live="polite" hidden>
        <span class="summary-heading">Summary</span>
        <p id="summary-text"></p>
      </section>
    </aside>
  `;

  controls = {
    close: shadow.querySelector("#close"),
    pause: shadow.querySelector("#pause"),
    play: shadow.querySelector("#play"),
    progress: shadow.querySelector("#progress"),
    progressValue: shadow.querySelector("#progress-value"),
    rate: shadow.querySelector("#rate"),
    rateValue: shadow.querySelector("#rate-value"),
    status: shadow.querySelector("#status"),
    stop: shadow.querySelector("#stop"),
    summarise: shadow.querySelector("#summarise"),
    summary: shadow.querySelector("#summary"),
    summaryText: shadow.querySelector("#summary-text"),
    volume: shadow.querySelector("#volume"),
    volumeValue: shadow.querySelector("#volume-value"),
  };

  controls.play.addEventListener("click", play);
  controls.pause.addEventListener("click", pause);
  controls.stop.addEventListener("click", stop);
  controls.close.addEventListener("click", close);
  controls.summarise.addEventListener("click", summariseSelection);
  controls.rate.addEventListener("input", updateSettings);
  controls.volume.addEventListener("input", updateSettings);
  controls.progress.addEventListener("input", seek);
  document.documentElement.append(host);
  updateSettingsLabels();
  updateProgress();
  updateButtons();
}

function sentenceWords(sentence) {
  return sentence
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
}

function summarizeText(text) {
  const sentences = text
    .match(/[^.!?]+(?:[.!?]+|$)/g)
    ?.map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean) ?? [];

  if (sentences.length <= 2) return sentences.join(" ") || text;

  const frequencies = new Map();
  for (const word of sentenceWords(text)) {
    if (word.length < 3 || SUMMARY_STOP_WORDS.has(word)) continue;
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  }

  const numberOfSentences = Math.min(sentences.length, text.length > 900 ? 3 : 2);
  return sentences
    .map((sentence, index) => {
      const words = sentenceWords(sentence);
      const score = words.reduce(
        (total, word) => total + (frequencies.get(word) ?? 0),
        index === 0 ? 1.5 : 0,
      ) / Math.sqrt(Math.max(1, words.length));
      return { index, score, sentence };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, numberOfSentences)
    .sort((left, right) => left.index - right.index)
    .map(({ sentence }) => sentence)
    .join(" ");
}

function repositionExpandedPanel() {
  requestAnimationFrame(() => {
    const panelRect = host.getBoundingClientRect();
    const top = Number.parseFloat(
      host.style.getPropertyValue("--captains-top"),
    ) || 8;
    if (top + panelRect.height > window.innerHeight - 8) {
      host.style.setProperty(
        "--captains-top",
        `${Math.max(8, window.innerHeight - panelRect.height - 8)}px`,
        "important",
      );
    }
  });
}

async function summariseSelection() {
  if (!selectedText) return;

  const request = ++summaryRequest;
  const text = selectedText;
  controls.summary.hidden = false;
  controls.summaryText.textContent = "Creating summary…";
  controls.status.textContent = "Summarising…";
  controls.summarise.disabled = true;
  repositionExpandedPanel();

  try {
    const summariser = globalThis.Captains.features.summariser;
    if (!summariser?.summarise) {
      throw new Error("The online summariser is unavailable.");
    }

    const summary = await summariser.summarise(text);
    if (request !== summaryRequest) return;
    controls.summaryText.textContent = summary;
    controls.status.textContent = "Summarised";
  } catch {
    if (request !== summaryRequest) return;
    controls.summaryText.textContent = summarizeText(text);
    controls.status.textContent = "Local summary";
  } finally {
    if (request === summaryRequest) {
      controls.summarise.disabled = false;
      repositionExpandedPanel();
    }
  }
}

function updateProgress() {
  controls.progress.max = String(Math.max(1, selectedText.length));
  controls.progress.value = String(selectionOffset);
  const percent = selectedText
    ? Math.round((selectionOffset / selectedText.length) * 100)
    : 0;
  controls.progressValue.textContent = `${percent}%`;
  controls.progress.setAttribute("aria-valuetext", `${percent}% read`);
}

function updateButtons() {
  controls.play.disabled = playback === "playing";
  controls.pause.disabled = playback !== "playing";
  controls.stop.disabled = playback === "stopped";
}

function updateSettingsLabels() {
  controls.rateValue.textContent = `${Number(controls.rate.value)}x`;
  controls.volumeValue.textContent = `${Math.round(Number(controls.volume.value) * 100)}%`;
}

function cancelSpeech() {
  ++playbackRequest;
  clearTimeout(restartTimer);

  if (selectedUtterance) {
    selectedUtterance.onend = null;
    selectedUtterance.onerror = null;
    selectedUtterance.onboundary = null;
    selectedUtterance.onstart = null;
  }

  selectedUtterance = undefined;
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  readyAt = Date.now() + CANCEL_SETTLE_TIME;
}

function stop() {
  cancelSpeech();
  selectionOffset = 0;
  playback = "stopped";
  controls.status.textContent = "Ready";
  updateProgress();
  updateButtons();
}

function close() {
  clearTimeout(selectionCaptureTimer);
  stop();
  host.hidden = true;
}

function pause() {
  if (playback !== "playing") return;
  window.speechSynthesis.pause();
  playback = "paused";
  controls.status.textContent = "Paused";
  updateButtons();
}

function play() {
  if (!selectedText) return;
  const speechSynthesis = window.speechSynthesis;

  if (playback === "paused" && selectedUtterance) {
    speechSynthesis.resume();
    playback = "playing";
    controls.status.textContent = "Playing";
  } else if (playback !== "playing") {
    clearTimeout(restartTimer);
    if (selectionOffset >= selectedText.length) selectionOffset = 0;
    updateProgress();
    const request = playbackRequest;
    const offset = selectionOffset;
    playback = "playing";
    controls.status.textContent = "Starting…";
    restartTimer = setTimeout(() => {
      if (request !== playbackRequest || playback !== "playing") return;
      speakChunk(request, offset);
    }, Math.max(0, readyAt - Date.now()));
  }

  updateButtons();
}

function speakChunk(request, offset) {
  const speechSynthesis = window.speechSynthesis;
  let end = Math.min(selectedText.length, offset + CHUNK_LENGTH);

  if (end < selectedText.length) {
    const space = selectedText.lastIndexOf(" ", end);
    if (space > offset) end = space + 1;
  }

  const utterance = new SpeechSynthesisUtterance(selectedText.slice(offset, end));
  utterance.rate = Number(controls.rate.value);
  utterance.volume = Number(controls.volume.value);
  utterance.lang = document.documentElement.lang || "en";

  const language = utterance.lang.split("-")[0].toLowerCase();
  const localVoice = speechSynthesis.getVoices().find((voice) =>
    voice.localService && voice.lang.split("-")[0].toLowerCase() === language,
  );
  if (localVoice) utterance.voice = localVoice;

  const isCurrent = () =>
    request === playbackRequest && selectedUtterance === utterance;

  utterance.onstart = () => {
    if (isCurrent()) controls.status.textContent = "Playing";
  };
  utterance.onboundary = (event) => {
    if (!isCurrent() || playback !== "playing") return;
    selectionOffset = Math.min(end, offset + event.charIndex);
    updateProgress();
  };
  utterance.onend = () => {
    if (!isCurrent()) return;
    selectionOffset = end;
    updateProgress();
    selectedUtterance = undefined;

    if (end < selectedText.length) {
      if (playback === "playing") speakChunk(request, end);
      return;
    }

    playback = "stopped";
    controls.status.textContent = "Finished";
    updateButtons();
  };
  utterance.onerror = (event) => {
    if (!isCurrent()) return;
    selectedUtterance = undefined;
    playback = "stopped";
    controls.status.textContent = event.error === "not-allowed"
      ? "Press Play again"
      : "Audio unavailable";
    updateButtons();
  };

  selectedUtterance = utterance;
  speechSynthesis.resume();
  speechSynthesis.speak(utterance);
}

function updateSettings() {
  updateSettingsLabels();
  const previousPlayback = playback;
  if (previousPlayback === "stopped") return;

  cancelSpeech();
  playback = "paused";
  controls.status.textContent = "Paused";
  if (previousPlayback === "playing") play();
  else updateButtons();
}

function seek() {
  const previousPlayback = playback;
  cancelSpeech();
  let offset = Math.max(
    0,
    Math.min(selectedText.length, Number(controls.progress.value)),
  );

  while (
    offset > 0 &&
    offset < selectedText.length &&
    !/\s/.test(selectedText[offset - 1])
  ) {
    offset--;
  }

  selectionOffset = offset;
  updateProgress();
  playback = previousPlayback === "stopped" ? "stopped" : "paused";
  controls.status.textContent = playback === "paused" ? "Paused" : "Ready";
  if (previousPlayback === "playing" && offset < selectedText.length) play();
  else updateButtons();
}

function positionControls(selectionRect) {
  requestAnimationFrame(() => {
    if (host.hidden) return;
    const panelRect = host.getBoundingClientRect();
    const gap = 10;
    const edge = 8;
    const selectionCenter = selectionRect.left + selectionRect.width / 2;
    const left = Math.max(
      edge,
      Math.min(
        window.innerWidth - panelRect.width - edge,
        selectionCenter - panelRect.width / 2,
      ),
    );
    let top = selectionRect.bottom + gap;

    if (top + panelRect.height > window.innerHeight - edge) {
      top = selectionRect.top - panelRect.height - gap;
    }

    host.style.setProperty("--captains-left", `${left}px`, "important");
    host.style.setProperty(
      "--captains-top",
      `${Math.max(edge, top)}px`,
      "important",
    );
  });
}

function selectionRect(range, pointerEvent) {
  if (
    pointerEvent &&
    Number.isFinite(pointerEvent.clientX) &&
    Number.isFinite(pointerEvent.clientY)
  ) {
    return {
      bottom: pointerEvent.clientY,
      height: 1,
      left: pointerEvent.clientX,
      right: pointerEvent.clientX,
      top: pointerEvent.clientY,
      width: 1,
    };
  }

  const clientRects = typeof range.getClientRects === "function"
    ? [...range.getClientRects()]
    : [];
  return clientRects.at(-1) ?? range.getBoundingClientRect();
}

function captureSelection(pointerEvent) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) {
    if (playback === "stopped") host.hidden = true;
    return;
  }

  const text = selection.toString().replace(/\s+/g, " ").trim();
  if (!text) {
    if (playback === "stopped") host.hidden = true;
    return;
  }

  const rect = selectionRect(selection.getRangeAt(0), pointerEvent);
  if (!rect.width && !rect.height) {
    if (playback === "stopped") host.hidden = true;
    return;
  }

  if (text !== selectedText) {
    summaryRequest += 1;
    stop();
    selectedText = text;
    selectionOffset = 0;
    controls.summary.hidden = true;
    controls.summaryText.textContent = "";
    controls.status.textContent = "Ready";
    updateProgress();
  }

  host.hidden = false;
  positionControls(rect);
  updateButtons();
}

function scheduleSelectionCapture() {
  clearTimeout(selectionCaptureTimer);
  selectionCaptureTimer = setTimeout(() => captureSelection(), 120);
}

function initialize() {
  if (initialized || !document.documentElement) return;
  initialized = true;
  createControls();

  document.addEventListener("pointerup", (event) => {
    if (!host.contains(event.target)) captureSelection(event);
  }, true);
  document.addEventListener("mouseup", (event) => {
    if (!host.contains(event.target)) captureSelection(event);
  }, true);
  document.addEventListener("touchend", (event) => {
    if (!host.contains(event.target)) captureSelection();
  }, true);
  document.addEventListener("keyup", (event) => {
    if (event.key.startsWith("Arrow") || event.key === "Shift") {
      captureSelection();
    }
  }, true);
  document.addEventListener("selectionchange", scheduleSelectionCapture, true);
  window.addEventListener("pagehide", cancelSpeech);
}

globalThis.Captains.features.textToSpeech = {
  version: "0.1.4",
  initialize,
  stop() {
    if (initialized) stop();
  },
};

initialize();
})();

const extensionApi = globalThis.browser ?? globalThis.chrome;
const title = document.querySelector("#title");
const sourceLink = document.querySelector("#source-link");
const readerContent = document.querySelector("#reader-content");
const readerError = document.querySelector("#reader-error");
const openDyslexicInput = document.querySelector("#reader-open-dyslexic");
const fontStatus = document.querySelector("#reader-font-status");
const layoutInput = document.querySelector("#reader-layout");
const layoutStatus = document.querySelector("#reader-layout-status");
const selectionActions = document.querySelector("#selection-actions");
const selectionPlayReading = document.querySelector("#selection-play-reading");
const selectionStopReading = document.querySelector("#selection-stop-reading");
const speechProgress = document.querySelector("#selection-speech-progress");
const selectionSummarise = document.querySelector("#selection-summarise");
const summaryPanel = document.querySelector("#summary-panel");
const summaryStatus = document.querySelector("#summary-status");
const summaryText = document.querySelector("#summary-text");
let openDyslexicFontsPromise;
let fontApplicationVersion = 0;
let originalReaderHtml;
let readerLayoutEnabled = false;
let selectedText = "";
let selectedRange = null;
let summaryOpen = false;
let speechParts = [];
let speechPartIndex = 0;

function hideSelectionPanels() {
  selectionActions.hidden = true;
  summaryPanel.hidden = true;
}

function clearSelectionState() {
  hideSelectionPanels();
  selectedText = "";
  selectedRange = null;
  summaryOpen = false;
}

function positionSelectionPanels() {
  if (!selectedRange) return;

  const columnRect = readerContent.getBoundingClientRect();
  const selectionRect = selectedRange.getBoundingClientRect();
  const selectionVisible =
    selectionRect.bottom > 0 && selectionRect.top < window.innerHeight;

  if (!selectionVisible) {
    hideSelectionPanels();
    return;
  }

  const panelWidth = Math.max(
    selectionActions.offsetWidth || 260,
    summaryPanel.offsetWidth || 360,
  );
  const gap = 16;
  const rightSideLeft = columnRect.right + gap;
  const canUseRightSide = rightSideLeft + panelWidth <= window.innerWidth - 8;
  const left = canUseRightSide
    ? rightSideLeft
    : Math.max(8, window.innerWidth - panelWidth - 8);
  const top = Math.max(8, Math.min(selectionRect.top, window.innerHeight - 80));

  selectionActions.style.left = `${left}px`;
  selectionActions.style.top = `${top}px`;
  selectionActions.hidden = false;

  if (summaryOpen) {
    summaryPanel.hidden = false;
    const actionBottom = top + selectionActions.offsetHeight;
    summaryPanel.style.left = `${left}px`;
    summaryPanel.style.top = `${actionBottom + gap}px`;
  }
}

function updateSelectionActions() {
  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? "";
  if (
    !text ||
    !selection?.rangeCount ||
    !selection.anchorNode ||
    !readerContent.contains(selection.anchorNode)
  ) {
    clearSelectionState();
    return;
  }

  selectedText = text;
  selectedRange = selection.getRangeAt(0).cloneRange();
  speechParts = splitSpeechText(selectedText);
  speechPartIndex = 0;
  speechProgress.max = Math.max(0, speechParts.length - 1);
  speechProgress.value = 0;

  positionSelectionPanels();
  selectionActions.hidden = false;
}

function splitSpeechText(text) {
  return text.match(/[^.!?]+(?:[.!?]+|$)/g)
    ?.map((part) => part.trim())
    .filter(Boolean) ?? [text];
}

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

function speakSpeechPart() {
  if (!speechParts.length || speechPartIndex >= speechParts.length) return;

  const utterance = new SpeechSynthesisUtterance(
    speechParts[speechPartIndex],
  );
  utterance.voice = preferredSpeechVoice();
  utterance.rate = 0.95;
  utterance.pitch = 0.95;
  utterance.onend = () => {
    if (speechPartIndex < speechParts.length - 1) {
      speechPartIndex += 1;
      speechProgress.value = speechPartIndex;
      speakSpeechPart();
    } else {
      selectionPlayReading.textContent = "Play";
      speechParts = [];
      speechPartIndex = 0;
      speechProgress.value = 0;
    }
  };
  window.speechSynthesis.speak(utterance);
}

function toggleSelectionReading() {
  if (!selectedText) return;

  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    selectionPlayReading.textContent = "Pause";
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
    selectionPlayReading.textContent = "Play";
    return;
  }

  window.speechSynthesis.cancel();
  speakSpeechPart();
  selectionPlayReading.textContent = "Pause";
}

function stopSelectionReading() {
  window.speechSynthesis.cancel();
  speechParts = [];
  speechPartIndex = 0;
  speechProgress.max = 0;
  speechProgress.value = 0;
  selectionPlayReading.textContent = "Play";
}

function seekSelectionReading() {
  if (!selectedText) return;

  speechPartIndex = Number(speechProgress.value);
  window.speechSynthesis.cancel();
  speakSpeechPart();
  selectionPlayReading.textContent = "Pause";
}

async function summariseSelection() {
  if (!selectedText) return;

  summaryPanel.hidden = false;
  summaryOpen = true;
  summaryStatus.textContent = "Simplifying selected text…";
  summaryText.textContent = "";
  selectionSummarise.disabled = true;

  positionSelectionPanels();

  try {
    summaryText.textContent =
      await globalThis.Captains.features.summariser.summarise(selectedText);
    summaryStatus.textContent = "";
  } catch (error) {
    summaryStatus.textContent = error.message;
  } finally {
    selectionSummarise.disabled = false;
  }
}

function setReaderLayout(enabled) {
  if (enabled === readerLayoutEnabled) return;

  layoutInput.checked = enabled;
  layoutStatus.textContent = enabled
    ? "Readable layout active"
    : "Standard layout active";

  if (enabled) {
    originalReaderHtml = readerContent.innerHTML;
    globalThis.Captains.features.layout.apply(readerContent);
    readerLayoutEnabled = true;
    return;
  }

  if (originalReaderHtml !== undefined) {
    readerContent.innerHTML = originalReaderHtml;
  }

  originalReaderHtml = undefined;
  readerLayoutEnabled = false;
}

function loadOpenDyslexicFonts() {
  if (!openDyslexicFontsPromise) {
    const fontDefinitions = [
      ["OpenDyslexic-Regular.woff2", "400", "normal"],
      ["OpenDyslexic-Italic.woff2", "400", "italic"],
      ["OpenDyslexic-Bold.woff2", "700", "normal"],
      ["OpenDyslexic-Bold-Italic.woff2", "700", "italic"],
    ];

    openDyslexicFontsPromise = Promise.all(
      fontDefinitions.map(async ([fileName, weight, style]) => {
        const source = extensionApi.runtime.getURL(`assets/fonts/${fileName}`);
        const font = new FontFace(
          "Captains OpenDyslexic",
          `url("${source}") format("woff2")`,
          { weight, style },
        );

        const loadedFont = await font.load();
        document.fonts.add(loadedFont);
      }),
    );
  }

  return openDyslexicFontsPromise;
}

async function applyOpenDyslexic(enabled) {
  const applicationVersion = ++fontApplicationVersion;
  openDyslexicInput.checked = enabled;

  if (enabled) {
    fontStatus.textContent = "Loading OpenDyslexic…";

    try {
      await loadOpenDyslexicFonts();
    } catch {
      if (applicationVersion === fontApplicationVersion) {
        document.documentElement.classList.remove(
          "captains-reader-open-dyslexic",
        );
        document.body.classList.remove("captains-reader-open-dyslexic");
        openDyslexicInput.checked = false;
        fontStatus.textContent = "OpenDyslexic could not load";
      }

      return false;
    }
  }

  if (applicationVersion !== fontApplicationVersion) {
    return null;
  }

  document.documentElement.classList.toggle(
    "captains-reader-open-dyslexic",
    enabled,
  );
  document.body.classList.toggle("captains-reader-open-dyslexic", enabled);
  fontStatus.textContent = enabled
    ? "OpenDyslexic active"
    : "Standard font active";
  return true;
}

function showError(message) {
  title.textContent = "Reading view unavailable";
  readerContent.hidden = true;
  readerError.textContent = message;
  readerError.hidden = false;
}

async function loadReaderDocument() {
  const documentId = new URLSearchParams(window.location.search).get("id");

  if (!documentId) {
    showError("No page content was provided. Open reading view again from the Captains popup.");
    return;
  }

  const storageKey = `readerDocument:${documentId}`;
  const stored = await extensionApi.storage.session.get(storageKey);
  const readerDocument = stored[storageKey];

  if (!readerDocument) {
    showError("This reading view has expired. Open it again from the Captains popup.");
    return;
  }

  document.title = `${readerDocument.title} — Captains`;
  if (readerDocument.language) {
    document.documentElement.lang = readerDocument.language;
  }
  title.textContent = readerDocument.title || "Untitled page";
  sourceLink.href = readerDocument.sourceUrl;
  sourceLink.hidden = false;

  if (!readerDocument.contentHtml?.trim()) {
    showError("Captains did not find any non-promotional reading content on this page.");
    return;
  }

  readerContent.innerHTML = readerDocument.contentHtml;
  extensionApi.storage.local.get({ layout: false }, ({ layout }) => {
    document.documentElement.classList.toggle(
      "captains-readable-layout",
      Boolean(layout),
    );
    setReaderLayout(Boolean(layout));
  });
}

layoutInput.addEventListener("change", async () => {
  const enabled = layoutInput.checked;
  setReaderLayout(enabled);

  try {
    await extensionApi.storage.local.set({ layout: enabled });
  } catch {
    setReaderLayout(!enabled);
  }
});

extensionApi.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.layout) return;

  const enabled = Boolean(changes.layout.newValue);
  document.documentElement.classList.toggle(
    "captains-readable-layout",
    enabled,
  );
  setReaderLayout(enabled);
});

document.addEventListener("selectionchange", updateSelectionActions);
document.addEventListener("mousedown", (event) => {
  if (
    !selectionActions.contains(event.target) &&
    !summaryPanel.contains(event.target)
  ) {
    clearSelectionState();
  }
});
document.addEventListener("scroll", () => {
  positionSelectionPanels();
}, { passive: true });
selectionActions.addEventListener("mousedown", (event) => {
  if (event.target !== speechProgress) {
    event.preventDefault();
  }
});
summaryPanel.addEventListener("mousedown", (event) => {
  event.stopPropagation();
});
selectionPlayReading.addEventListener("click", toggleSelectionReading);
selectionStopReading.addEventListener("click", stopSelectionReading);
speechProgress.addEventListener("input", seekSelectionReading);
selectionSummarise.addEventListener("click", summariseSelection);

extensionApi.storage.local.get(
  { openDyslexic: false },
  ({ openDyslexic }) => applyOpenDyslexic(openDyslexic),
);

openDyslexicInput.addEventListener("change", async () => {
  const enabled = openDyslexicInput.checked;
  const applied = await applyOpenDyslexic(enabled);

  if (applied === null) {
    return;
  }

  const savedValue = applied ? enabled : false;

  try {
    await extensionApi.storage.local.set({ openDyslexic: savedValue });
  } catch {
    await applyOpenDyslexic(!savedValue);
  }
});

extensionApi.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.openDyslexic) {
    applyOpenDyslexic(changes.openDyslexic.newValue);
  }
});

loadReaderDocument().catch(() => {
  showError("Captains could not prepare this page. Return to the original page and try again.");
});

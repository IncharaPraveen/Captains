const extensionApi = globalThis.browser ?? globalThis.chrome;
const title = document.querySelector("#title");
const sourceLink = document.querySelector("#source-link");
const readerContent = document.querySelector("#reader-content");
const readerError = document.querySelector("#reader-error");
const openDyslexicInput = document.querySelector("#reader-open-dyslexic");
const fontStatus = document.querySelector("#reader-font-status");
let openDyslexicFontsPromise;
let fontApplicationVersion = 0;

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
}

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

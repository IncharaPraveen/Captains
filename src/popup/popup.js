const extensionApi = globalThis.browser ?? globalThis.chrome;
const openDyslexicInput = document.querySelector("#open-dyslexic");
const layoutInput = document.querySelector("#layout");
const openReaderButton = document.querySelector("#open-reader");
const status = document.querySelector("#status");

function setStatus(message) {
  status.textContent = message;
}

async function getActiveTab() {
  const [tab] = await extensionApi.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tab;
}

async function sendToActivePage(type) {
  const tab = await getActiveTab();

  if (!tab?.id) {
    throw new Error("No active webpage was found.");
  }

  return extensionApi.tabs.sendMessage(tab.id, { type });
}

async function ensureSelectionTools() {
  const tab = await getActiveTab();

  if (!tab?.id || !/^https?:/i.test(tab.url ?? "")) {
    setStatus("Selection tools are unavailable on this browser page.");
    return;
  }

  try {
    await extensionApi.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/features/text-to-speech.js"],
    });
    setStatus("Selection tools are ready on this page.");
  } catch {
    setStatus("Allow Captains site access, then refresh this page.");
  }
}

extensionApi.storage.local.get(
  { openDyslexic: false, layout: false },
  ({ openDyslexic, layout }) => {
    openDyslexicInput.checked = openDyslexic;
    layoutInput.checked = layout;
  },
);

ensureSelectionTools().catch(() => {
  setStatus("Allow Captains site access, then refresh this page.");
});

openDyslexicInput.addEventListener("change", () => {
  extensionApi.storage.local.set(
    { openDyslexic: openDyslexicInput.checked },
    () => setStatus("Font preference saved for all websites."),
  );
});

layoutInput.addEventListener("change", () => {
  extensionApi.storage.local.set(
    { layout: layoutInput.checked },
    () => setStatus("Readable layout preference saved."),
  );
});

openReaderButton.addEventListener("click", async () => {
  try {
    setStatus("Preparing reading view…");
    const readerDocument = await sendToActivePage("CAPTAINS_EXTRACT_READER");
    const documentId = crypto.randomUUID();
    const storageKey = `readerDocument:${documentId}`;

    await extensionApi.storage.session.set({ [storageKey]: readerDocument });
    await extensionApi.tabs.create({
      url: extensionApi.runtime.getURL(
        `src/reader/reader.html?id=${encodeURIComponent(documentId)}`,
      ),
    });
  } catch (error) {
    setStatus("Refresh a normal webpage and try again.");
  }
});

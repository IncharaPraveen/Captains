const extensionApi = globalThis.browser ?? globalThis.chrome;
const openDyslexicInput = document.querySelector("#open-dyslexic");
const openReaderButton = document.querySelector("#open-reader");
const startReadingButton = document.querySelector("#start-reading");
const stopReadingButton = document.querySelector("#stop-reading");
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

extensionApi.storage.local.get(
  { openDyslexic: false },
  ({ openDyslexic }) => {
    openDyslexicInput.checked = openDyslexic;
  },
);

openDyslexicInput.addEventListener("change", () => {
  extensionApi.storage.local.set(
    { openDyslexic: openDyslexicInput.checked },
    () => setStatus("Font preference saved for all websites."),
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

startReadingButton.addEventListener("click", async () => {
  try {
    await sendToActivePage("CAPTAINS_START_READING");
    setStatus("Reading the current page.");
  } catch (error) {
    setStatus("Refresh a normal webpage and try again.");
  }
});

stopReadingButton.addEventListener("click", async () => {
  try {
    await sendToActivePage("CAPTAINS_STOP_READING");
    setStatus("Reading stopped.");
  } catch (error) {
    setStatus("Refresh a normal webpage and try again.");
  }
});

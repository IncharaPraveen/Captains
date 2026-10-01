globalThis.Captains ??= {};
globalThis.Captains.features ??= {};

const selectionToolbar = document.createElement("div");
selectionToolbar.className = "captains-selection-toolbar";
selectionToolbar.hidden = true;
selectionToolbar.setAttribute("role", "toolbar");
selectionToolbar.innerHTML = `
  <button type="button" data-action="speak">Read aloud</button>
  <button type="button" data-action="summarise">Summarise</button>
  <span class="captains-selection-status" aria-live="polite"></span>
`;
document.documentElement.append(selectionToolbar);

let selectedText = "";
let selectionRange = null;

function hideToolbar() {
  selectionToolbar.hidden = true;
  selectionRange = null;
}

function showToolbar() {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  if (!text || !selection.rangeCount) {
    hideToolbar();
    return;
  }

  selectedText = text;
  selectionRange = selection.getRangeAt(0).cloneRange();
  const rect = selectionRange.getBoundingClientRect();
  selectionToolbar.hidden = false;
  selectionToolbar.style.left = `${Math.min(
    Math.max(8, rect.left + window.scrollX),
    window.scrollX + window.innerWidth - selectionToolbar.offsetWidth - 8,
  )}px`;
  selectionToolbar.style.top = `${rect.bottom + window.scrollY + 8}px`;
}

function setStatus(message) {
  selectionToolbar.querySelector(".captains-selection-status").textContent = message;
}

document.addEventListener("mouseup", (event) => {
  if (!selectionToolbar.contains(event.target)) {
    window.setTimeout(showToolbar, 0);
  }
});

document.addEventListener("selectionchange", () => {
  window.clearTimeout(selectionToolbar.selectionTimer);
  selectionToolbar.selectionTimer = window.setTimeout(showToolbar, 50);
});

document.addEventListener("keyup", (event) => {
  if (["Shift", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    showToolbar();
  }
});

selectionToolbar.addEventListener("mousedown", (event) => event.preventDefault());
selectionToolbar.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button || !selectedText) return;

  if (button.dataset.action === "speak") {
    globalThis.Captains.features.textToSpeech.speak(selectedText);
    setStatus("Reading…");
    return;
  }

  if (button.dataset.action === "summarise") {
    button.disabled = true;
    setStatus("Summarising…");
    try {
      const summary = await globalThis.Captains.features.summariser.summarise(selectedText);
      setStatus("");
      selectionToolbar.insertAdjacentHTML(
        "beforeend",
        `<div class="captains-summary" role="status"></div>`,
      );
      selectionToolbar.querySelector(".captains-summary").textContent = summary;
    } catch (error) {
      setStatus(error.message || "Could not summarise the selection.");
    } finally {
      button.disabled = false;
    }
  }
});

document.addEventListener("scroll", hideToolbar, { passive: true });
document.addEventListener("mousedown", (event) => {
  if (!selectionToolbar.contains(event.target)) hideToolbar();
});

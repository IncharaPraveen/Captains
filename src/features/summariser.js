(() => {
"use strict";

globalThis.Captains ??= {};
globalThis.Captains.features ??= {};

if (globalThis.Captains.features.summariser?.version === "0.1.0") return;

const DEFAULT_ENDPOINT = "https://captains-api.onrender.com/api/summarise";
const REQUEST_TIMEOUT_MS = 75_000;

async function summarise(text) {
  const value = text?.trim();
  if (!value) throw new Error("Select some text to summarise first.");

  const endpoint = globalThis.Captains.config?.summariserEndpoint
    ?? DEFAULT_ENDPOINT;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: value }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The summariser took too long to respond.");
    }
    throw new Error("Could not reach the summariser.");
  } finally {
    clearTimeout(timeout);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`The summariser returned ${response.status}.`);
  }

  if (!response.ok) {
    throw new Error(result.error || `The summariser returned ${response.status}.`);
  }

  const summary = result.summary;
  if (typeof summary !== "string" || !summary.trim()) {
    throw new Error("The summariser returned no summary.");
  }
  return summary.trim();
}

globalThis.Captains.features.summariser = {
  version: "0.1.0",
  summarise,
};
})();

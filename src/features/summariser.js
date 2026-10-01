globalThis.Captains ??= {};
globalThis.Captains.features ??= {};

// The API key must stay in the backend; this URL is intentionally configurable
// so production can point at a deployed HTTPS service.
const DEFAULT_SUMMARISER_ENDPOINT = "http://localhost:8787/api/summarise";

globalThis.Captains.features.summariser = {
  async summarise(text) {
    const value = text?.trim();
    if (!value) throw new Error("Select some text to simplify first.");

    const endpoint = globalThis.Captains.config?.summariserEndpoint ?? DEFAULT_SUMMARISER_ENDPOINT;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: value,
        instruction: "Summarise this text in clear, simple English. Keep the important facts and do not add information.",
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(
        result.error || `The simplification service returned ${response.status}.`,
      );
    }
    const summary = result.summary ?? result.text ?? result.output;
    if (typeof summary !== "string" || !summary.trim()) {
      throw new Error("The simplification service returned no summary.");
    }
    return summary.trim();
  },
};

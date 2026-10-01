globalThis.Captains ??= {};
globalThis.Captains.features ??= {};

// The API key must stay in the backend; this URL is intentionally configurable
// so production can point at a deployed HTTPS service.
const DEFAULT_SUMMARISER_ENDPOINT =
  "https://captains-api.onrender.com/api/summarise";
const SUMMARISER_TIMEOUT_MS = 75_000;

globalThis.Captains.features.summariser = {
  async summarise(text) {
    const value = text?.trim();
    if (!value) throw new Error("Select some text to simplify first.");

    const endpoint = globalThis.Captains.config?.summariserEndpoint ?? DEFAULT_SUMMARISER_ENDPOINT;
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      SUMMARISER_TIMEOUT_MS,
    );
    let response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: value,
          instruction: "Summarise this text in clear, simple English. Keep the important facts and do not add information.",
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          "The simplification service took too long to respond. Please try again.",
        );
      }
      throw new Error(
        "Could not reach the simplification service. Please try again.",
      );
    } finally {
      window.clearTimeout(timeout);
    }

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(
        response.ok
          ? "The simplification service returned an invalid response."
          : `The simplification service returned ${response.status}.`,
      );
    }
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

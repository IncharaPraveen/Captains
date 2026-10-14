const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const vm = require("node:vm");

function loadSummariser(fetch) {
  const context = {
    AbortController,
    clearTimeout,
    fetch,
    setTimeout,
  };
  vm.runInNewContext(
    readFileSync(require.resolve("../src/features/summariser.js"), "utf8"),
    context,
  );
  return context.Captains.features.summariser;
}

test("online summariser sends the selection and returns the API summary", async () => {
  let request;
  const summariser = loadSummariser(async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      async json() { return { summary: "A clear AI summary." }; },
    };
  });

  assert.equal(await summariser.summarise("  Long selected text.  "), "A clear AI summary.");
  assert.equal(request.url, "https://captains-api.onrender.com/api/summarise");
  assert.deepEqual(JSON.parse(request.options.body), { text: "Long selected text." });
});

test("online summariser reports backend errors", async () => {
  const summariser = loadSummariser(async () => ({
    ok: false,
    status: 502,
    async json() { return { error: "Groq request failed" }; },
  }));

  await assert.rejects(
    summariser.summarise("Selected text"),
    /Groq request failed/,
  );
});

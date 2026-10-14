// Runs the normal-page selection player in isolated headless Chrome using native TTS.
// Run: node tests/chrome-audio-smoke.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "captains-chrome-audio-"));
  const root = path.resolve(__dirname, "..");
  const server = http.createServer((req, res) => {
    if (req.url.split("?")[0] === "/page.html") {
      res.setHeader("Content-Type", "text/html");
      res.end(`<!doctype html><html lang="en"><body>
        <div style="height: 2000px"></div>
        <p id="article">First sentence has enough words to track the playback progress. Second sentence continues the audio so we can stop and start again. Third sentence finishes the selected text.</p>
        <script src="/text-to-speech.js"></script>
        <script>Captains.features.textToSpeech.initialize();</script>
      </body></html>`);
      return;
    }
    const files = {
      "/text-to-speech.js": "src/features/text-to-speech.js",
    };
    const file = files[req.url.split("?")[0]];
    if (!file) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
    res.end(fs.readFileSync(path.join(root, file)));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const chrome = spawn(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "about:blank",
  ], { windowsHide: true, stdio: "ignore" });
  let socket;
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { port = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; break; } catch {}
      await delay(100);
    }
    assert.ok(port, "Chrome did not start its debugging endpoint");
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(5000) })).json();
    socket = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Chrome debugging socket did not open")), 5000);
      socket.onopen = () => { clearTimeout(timer); resolve(); };
      socket.onerror = error => { clearTimeout(timer); reject(error); };
    });
    let sequence = 0;
    const pending = new Map();
    socket.onmessage = ({ data }) => {
      const response = JSON.parse(data);
      const callback = pending.get(response.id);
      if (callback) { pending.delete(response.id); callback(response); }
    };
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome command timed out: ${method}`)); }, 5000);
      pending.set(id, response => {
        clearTimeout(timer);
        response.error ? reject(new Error(JSON.stringify(response.error))) : resolve(response.result);
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const response = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
      if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result.value;
    };
    await command("Page.enable");
    await command("Page.addScriptToEvaluateOnNewDocument", { source: `
      globalThis.audioEvents = [];
      const originalSpeak = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = utterance => {
        for (const type of ["start", "boundary", "end", "error"]) {
          utterance.addEventListener(type, event => audioEvents.push({type, error: event.error, charIndex: event.charIndex}));
        }
        originalSpeak(utterance);
      };
    ` });
    await command("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/page.html` });
    const waitFor = async (expression, timeout = 10000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await delay(100);
      }
      throw new Error(`Timed out: ${expression}; state=${JSON.stringify(await evaluate('({events: audioEvents, status: document.querySelector("captains-read-aloud")?.shadowRoot.querySelector("#status")?.textContent, voices: speechSynthesis.getVoices().map(v => v.name)})'))}`);
    };
    await waitFor('document.querySelector("#article")?.textContent.includes("First sentence")');
    await waitFor("speechSynthesis.getVoices().length > 0");
    await evaluate(`(() => {
      const range = document.createRange(); range.selectNodeContents(document.querySelector("#article"));
      window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
      document.querySelector("#article").dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      document.querySelector("captains-read-aloud").shadowRoot.querySelector("#summarise").click();
      document.querySelector("captains-read-aloud").shadowRoot.querySelector("#play").click();
    })()`);
    assert.ok(await evaluate(`(() => {
      const rect = document.querySelector("captains-read-aloud").getBoundingClientRect();
      return rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth;
    })()`), "Selection player was rendered outside the viewport");
    await waitFor('document.querySelector("captains-read-aloud").shadowRoot.querySelector("#summary-text").textContent.length > 0');
    await waitFor('audioEvents.some(e => e.type === "start")');
    const click = id => evaluate(`document.querySelector("captains-read-aloud").shadowRoot.querySelector("#${id}").click()`);
    await click("stop"); await click("play");
    await waitFor('audioEvents.filter(e => e.type === "start").length >= 2');
    await waitFor('Number(document.querySelector("captains-read-aloud").shadowRoot.querySelector("#progress").value) > 0');
    for (let cycle = 0; cycle < 3; cycle++) {
      const starts = await evaluate('audioEvents.filter(e => e.type === "start").length');
      await click("stop"); await click("play");
      await waitFor(`audioEvents.filter(e => e.type === "start").length > ${starts}`);
    }
    let starts = await evaluate('audioEvents.filter(e => e.type === "start").length');
    await evaluate(`(() => {
      const progress = document.querySelector("captains-read-aloud").shadowRoot.querySelector("#progress");
      progress.value = 65; progress.dispatchEvent(new Event("input"));
    })()`);
    await waitFor(`audioEvents.filter(e => e.type === "start").length > ${starts}`);
    assert.ok(await evaluate('Number(document.querySelector("captains-read-aloud").shadowRoot.querySelector("#progress").value) >= 60'), "Seek did not advance progress");
    starts = await evaluate('audioEvents.filter(e => e.type === "start").length');
    await click("pause"); await click("stop"); await click("play");
    await waitFor(`audioEvents.filter(e => e.type === "start").length > ${starts}`);
    console.log("PASS: webpage selection speech restarts repeatedly, advances progress, and seeks.");
    await click("stop");
  } finally {
    socket?.close();
    chrome.kill();
    server.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

import "node:process";
import http from "node:http";
import fs from "node:fs";

// Load the local .env without adding a dependency.
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(['"]?)(.*?)\2\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[3];
  }
}

const port = Number(process.env.PORT || 8787);
const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return sendJson(response, 204, {});
  if (request.method !== "POST" || request.url !== "/api/summarise") {
    return sendJson(response, 404, { error: "Not found" });
  }
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes("REPLACE")) {
    return sendJson(response, 500, { error: "GROQ_API_KEY is not configured on the server." });
  }

  try {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const input = JSON.parse(raw);
    const text = typeof input.text === "string" ? input.text.trim() : "";
    if (!text) return sendJson(response, 400, { error: "text is required" });

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: "Rewrite text in clear, simple English. Keep important facts and shorten the paragraph. Do not add information." },
          { role: "user", content: text },
        ],
      }),
    });
    const result = await groqResponse.json();
    if (!groqResponse.ok) {
      const message = result.error?.message || "Groq request failed";
      console.error(`Groq API ${groqResponse.status}: ${message}`);
      return sendJson(response, 502, { error: message });
    }
    return sendJson(response, 200, { summary: result.choices?.[0]?.message?.content?.trim() });
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof SyntaxError ? "Invalid JSON" : "Summarisation failed" });
  }
});

server.listen(port, "0.0.0.0", () => console.log(`Captains summariser listening on http://localhost:${port}`));

import "node:process";
import http from "node:http";
import fs from "node:fs";

// Load a local .env for development without adding a production dependency.
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(['"]?)(.*?)\2\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[3];
  }
}

const port = Number(process.env.PORT || 8787);
const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const maxBodyBytes = 250_000;

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > maxBodyBytes) {
      const error = new Error("Request is too large");
      error.status = 413;
      throw error;
    }
  }
  return JSON.parse(raw || "{}");
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return sendJson(response, 204, {});
  if (request.method === "GET" && request.url === "/health") {
    return sendJson(response, 200, { status: "ok" });
  }
  if (request.method !== "POST" || request.url !== "/api/summarise") {
    return sendJson(response, 404, { error: "Not found" });
  }
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes("REPLACE")) {
    return sendJson(response, 500, {
      error: "GROQ_API_KEY is not configured on the server.",
    });
  }

  try {
    const input = await readJson(request);
    const text = typeof input.text === "string" ? input.text.trim() : "";
    if (!text) return sendJson(response, 400, { error: "text is required" });

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "Summarise the text in clear, simple English. Keep the important facts, be concise, and do not add information.",
            },
            { role: "user", content: text },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
    const result = await groqResponse.json();

    if (!groqResponse.ok) {
      const message = result.error?.message || "Groq request failed";
      console.error(`Groq API ${groqResponse.status}: ${message}`);
      return sendJson(response, 502, { error: message });
    }

    const summary = result.choices?.[0]?.message?.content?.trim();
    if (!summary) {
      return sendJson(response, 502, { error: "Groq returned no summary" });
    }
    return sendJson(response, 200, { summary });
  } catch (error) {
    if (error?.name === "TimeoutError") {
      return sendJson(response, 504, { error: "Groq request timed out" });
    }
    return sendJson(response, error.status || 400, {
      error: error instanceof SyntaxError ? "Invalid JSON" : error.message,
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Captains summariser listening on port ${port}`);
});

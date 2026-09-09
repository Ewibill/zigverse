#!/usr/bin/env node
/* =============================================================================
   tools/serve.mjs — A TRUSTED ORIGIN, ON DEMAND
   run:  node tools\serve.mjs          then open the URL it prints
         node tools\serve.mjs 8081     if 8080 is taken

   WHY THIS EXISTS: Web MIDI is only granted on a SECURE CONTEXT. `file://` is
   not one, so a page opened by double-clicking can never see the EWI — it fails
   silently, with no permission prompt at all. `http://localhost` IS a secure
   context by definition, so serving the repo locally is the whole fix.

   The same trap was met from the other side once already: GitHub Pages was
   adopted for the Bee partly because HTTPS gave MIDI permission somewhere to
   land. This is the local version of that, with no push required.

   No dependencies, no install, nothing to keep running between sessions.
   Serves the repo read-only. Ctrl+C ends it.
   ========================================================================== */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mid":  "audio/midi",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".md":   "text/plain; charset=utf-8"
};

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    /* resolve, then confirm the result is still INSIDE the repo — a request for
       /../../etc/passwd resolves out of it, and this is what stops that */
    let file = path.resolve(ROOT, "." + url);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end("outside the repo"); return; }

    const s = await stat(file).catch(() => null);
    if (s && s.isDirectory()) file = path.join(file, "index.html");

    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"          /* so a re-run of the installer is seen on reload */
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("\n  ZIGVERSE — serving " + ROOT);
  console.log("  a trusted origin, so Web MIDI can be granted\n");
  console.log("    http://localhost:" + PORT + "/tools/relay_scope.html\n");
  console.log("  Ctrl+C to stop.\n");
});
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.log("\n  Port " + PORT + " is busy. Try:  node tools\\serve.mjs 8081\n");
  else console.log("\n  " + e.message + "\n");
  process.exit(1);
});

#!/usr/bin/env node
/* ============================================================================
   tools/metal_gate.mjs — THE MACHINE HALF OF THE METAL GATE.  RUN ON THE MAC.
   ----------------------------------------------------------------------------
     node tools/metal_gate.mjs dist/Zigverse_Engine_vX.html
     node tools/metal_gate.mjs dist/Zigverse_Engine_vX.html '#dpr=1&crowd=3000'

   Requires: node 18+, `npm i ws`, and Google Chrome installed.

   WHY
   Every verification gate we own runs on SwiftShader, which is permissive in
   exactly the way NVIDIA is. It will pass a file that Metal rejects. That is
   how 2026-08-12 happened: a bundle cleared every check and then produced a
   black canvas on the Air at 12:44 AM, four hours before a summit.

   Chrome on a Mac compiles WGSL through Dawn to MSL. This script drives that
   real Chrome headlessly against a real Metal device and reports whether the
   pipelines actually built. It is the only check that can answer that.

   WHAT IT CATCHES
   Anything Metal refuses: vertex stack overflow, struct member not found,
   binding limits, entry point validation. Known and unknown alike.

   READING THE RESULT
   PASS  — pipelines built, agents present, no GPU errors. Ship it.
   FAIL  — the first Metal error is printed. Everything after it is an echo;
           ignore the cascade and fix the first one.
   ==========================================================================*/

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const file = process.argv[2];
const hash = process.argv[3] || "";
if (!file) { console.error("usage: node metal_gate.mjs <bundle.html> [#flags]"); process.exit(2); }
if (!fs.existsSync(file)) { console.error("no such file: " + file); process.exit(2); }

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/opt/google/chrome/chrome",
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error("Chrome not found. Install Google Chrome."); process.exit(2); }

const dir = path.dirname(path.resolve(file));
const name = path.basename(file);
const PORT = 8137, CDP = 9333;

const server = http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(req.url.split("?")[0].split("#")[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": p.endsWith(".html") ? "text/html; charset=utf-8" : "application/javascript; charset=utf-8" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${CDP}`,
  "--enable-unsafe-webgpu", "--use-angle=metal",
  "--window-size=1600,900", "--no-first-run",
  `--user-data-dir=${path.join(process.env.TMPDIR || "/tmp", "zigmetalgate")}`,
  "about:blank",
], { stdio: "ignore" });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let list = null;
for (let i = 0; i < 40; i++) {
  try { list = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); break; } catch { await wait(500); }
}
if (!list) { console.error("Chrome debugger never came up."); chrome.kill(); process.exit(2); }

const { default: WS } = await import("ws");
const ws = new WS(list.find((t) => t.type === "page").webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r) => ws.on("open", r));

let id = 0; const pending = new Map(); const events = [];
ws.on("message", (m) => {
  const msg = JSON.parse(m);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method) events.push(msg);
});
const send = (method, params = {}) =>
  new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/${encodeURIComponent(name)}${hash}` });
await wait(11000);

const probe = await send("Runtime.evaluate", {
  expression: `(async () => {
    const g = window, S = g.SickleField, c = document.querySelector('canvas'), out = {};
    out.zigcore = g.ZigCore && g.ZigCore.VERSION;
    out.zigwebgpu = g.ZigWebGPU && g.ZigWebGPU.VERSION;
    out.zigmesh = g.ZigMesh && g.ZigMesh.VERSION;
    out.booted = !!(S && S.booted); out.stage = S && S.stage;
    out.agents = S && S.flock ? (S.flock.n || S.flock.count || null) : null;
    out.canvas = c ? [c.width, c.height] : null;
    try { const p = await g.ZigWebGPU.probe(); out.adapter = (p.desc || p.reason || '').slice(0, 90); out.gpuOk = !!p.ok; }
    catch (e) { out.adapter = 'probe threw: ' + e.message; out.gpuOk = false; }
    return JSON.stringify(out);
  })()`, awaitPromise: true, returnByValue: true,
});
const R = JSON.parse(probe.result?.result?.value || "{}");

const gpuErrs = events
  .filter((e) => e.method === "Log.entryAdded" && e.params.entry.level === "error")
  .map((e) => e.params.entry.text)
  .filter((t) => !/favicon|404/i.test(t));
const exceptions = events
  .filter((e) => e.method === "Runtime.exceptionThrown")
  .map((e) => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);

/* the cascade problem: one failed pipeline emits thousands of identical
   "invalid due to a previous error" lines. Only the first is diagnostic. */
const root = gpuErrs.filter((t) => !/due to a previous error/i.test(t));

console.log(`\nMETAL GATE · ${name}${hash ? "  " + hash : ""}`);
console.log(`  adapter    ${R.adapter || "unknown"}`);
console.log(`  versions   zigcore ${R.zigcore} · zigwebgpu ${R.zigwebgpu} · zigmesh ${R.zigmesh}`);
console.log(`  booted     ${R.booted}   stage: ${R.stage}`);
console.log(`  agents     ${R.agents}`);
console.log(`  canvas     ${R.canvas ? R.canvas.join(" x ") : "none"}`);
console.log(`  gpu errors ${gpuErrs.length} (${root.length} root, ${gpuErrs.length - root.length} echoes)`);

const pass = R.booted && R.gpuOk && R.agents > 0 && root.length === 0 && exceptions.length === 0;
if (pass) {
  console.log("\n  PASS — pipelines built on Metal. Safe to deliver.\n");
} else {
  console.log("\n  FAIL — first root cause(s), cascade suppressed:\n");
  root.slice(0, 4).forEach((t) => console.log("    " + t.slice(0, 700) + "\n"));
  exceptions.slice(0, 3).forEach((t) => console.log("    EXCEPTION " + t.slice(0, 400) + "\n"));
  if (!root.length && !exceptions.length) console.log("    (no GPU error — check booted/agents above)\n");
}

ws.close(); chrome.kill(); server.close();
process.exit(pass ? 0 : 1);

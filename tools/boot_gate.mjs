/* =============================================================================
   tools/boot_gate.mjs 2.0 — THE CONFORMANCE GATE
   (run: node tools/boot_gate.mjs <file.html> [#hash] [#hash] ...)

   WHY THIS WAS REWRITTEN (2026-08-19)
   ---------------------------------------------------------------------------
   Version 1 reported "LIVE at 60fps · 0 hard errors" for a configuration in
   which Bill's RTX rejected THIRTY-TWO THOUSAND draw calls and the screen was
   black. It asked one question — does the HUD still say "fps"? — and a page
   whose every command buffer is invalid answers yes, because the JavaScript
   loop keeps ticking regardless of what the driver thinks of it.

   That cost most of an evening. Six fixes were made, each correcting something
   genuinely broken, none of them the fault, because the instrument said green
   the whole way. A gate that cannot fail is not a gate. This is the fifth time
   this project has caught a probe measuring the wrong thing; it is the most
   expensive, and it was the one measuring the FRAME.

   WHAT IT NOW ASKS
     1  did the page boot and keep running                    (as before)
     2  did the DRIVER reject anything                        ← the new one
     3  were frames actually submitted, and how many
     4  what clear colour was each render pass handed
     5  which laws are active, and in what composition order

   Check 2 is the one that matters. The engine already logs every validation
   error it is told about ("[ZigWebGPU] …", set up at device init in
   zigwebgpu.js). Nothing was listening. Now a single one fails the run.

   PORTABILITY — the same numbers on every machine
   ---------------------------------------------------------------------------
   A gate with a hard-coded browser path is a gate that stops running the moment
   the machine changes, which has already happened twice in this repo
   (splice_anchors and byte_identity both shipped with dead sandbox paths). So
   the browser is DISCOVERED, in this order:

     ZIG_BROWSER=<path>                                  an override, always wins
     playwright-core / playwright with channel "chrome"  ← the real Chrome
     a bundled Chromium, if one happens to be installed

   Preferring the INSTALLED Chrome is deliberate, not merely lean. Yesterday's
   fault was a driver divergence: SwiftShader accepted WGSL that a real GPU
   refused. Validating against a bundled Chromium on a software rasteriser
   answers a question nobody asked. The gate should run the browser the piece is
   performed in, on the GPU it is performed on.

   WHAT IT STILL CANNOT DO
   ---------------------------------------------------------------------------
   It cannot see the canvas. The WebGPU surface does not composite into
   createImageBitmap under a software rasteriser, so pixel readback returns
   black for every configuration including known-good ones. Framing, colour and
   taste remain Bill's eye. This gate proves the frame was ACCEPTED, never that
   it was worth accepting.
   ========================================================================== */
import path from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const FILE = process.argv[2];
if (!FILE) {
  console.log("usage: node tools/boot_gate.mjs <file.html> [#hash ...]");
  console.log("       ZIG_BROWSER=<path to chrome> overrides browser discovery");
  process.exit(2);
}
const HASHES = process.argv.slice(3).length ? process.argv.slice(3) : [""];

/* ---- console noise that is not the engine's fault ----------------------- */
const BENIGN = [
  /valid external Instance reference no longer exists/i,
  /favicon/i,
  /Failed to load resource.*404/i,
  /powerPreference option is currently ignored/i,   // Chrome on Windows, informational
  /Unsafe attempt to load URL/i,                    // file:// origins, harmless for a local bundle
  /crbug\.com/i
];

/* ---- browser discovery -------------------------------------------------- */
async function openBrowser() {
  let pw = null;
  for (const mod of ["playwright-core", "playwright"]) {
    try { pw = await import(mod); break; } catch { /* keep looking */ }
  }
  if (!pw) {
    console.log("  NO DRIVER — install one of:");
    console.log("    npm install playwright-core   (a few MB; drives the Chrome you already have)");
    console.log("    npm install playwright        (bundles its own Chromium, ~150MB)");
    process.exit(2);
  }
  const args = ["--enable-unsafe-webgpu", "--enable-features=Vulkan",
                "--no-sandbox", "--disable-gpu-sandbox"];

  if (process.env.ZIG_BROWSER && existsSync(process.env.ZIG_BROWSER))
    return { b: await pw.chromium.launch({ executablePath: process.env.ZIG_BROWSER, args }),
             how: "ZIG_BROWSER" };

  try { return { b: await pw.chromium.launch({ channel: "chrome", args }), how: "system Chrome" }; }
  catch { /* not installed here */ }

  const SW = ["--use-angle=vulkan", "--use-vulkan=swiftshader"];
  try { return { b: await pw.chromium.launch({ args: args.concat(SW) }),
                 how: "bundled Chromium (SwiftShader)" }; }
  catch (e) {
    console.log("  NO BROWSER — " + String(e.message || e).split("\n")[0]);
    console.log("  set ZIG_BROWSER to a chrome.exe / Chrome binary and re-run");
    process.exit(2);
  }
}

const { b: browser, how } = await openBrowser();
console.log("\n  driver: " + how + "  \u00b7  " + path.basename(FILE));
console.log("  " + "-".repeat(94));

let failed = 0;
for (const hash of HASHES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const gpuErrs = [], otherErrs = [];

  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (BENIGN.some((r) => r.test(t))) return;
    (/\[ZigWebGPU\]/.test(t) ? gpuErrs : otherErrs).push(t);
  });
  page.on("pageerror", (e) => { if (!BENIGN.some((r) => r.test(String(e)))) otherErrs.push(String(e)); });

  /* count submits and capture clear colours — installed before any page script */
  await page.addInitScript(() => {
    window.__zsubmits = 0; window.__zclears = new Set();
    const wait = setInterval(() => {
      if (!window.GPUCommandEncoder || !window.GPUQueue) return;
      clearInterval(wait);
      const bp = GPUCommandEncoder.prototype.beginRenderPass;
      GPUCommandEncoder.prototype.beginRenderPass = function (d) {
        try {
          for (const a of (d.colorAttachments || []))
            if (a && a.clearValue) {
              const c = a.clearValue;
              window.__zclears.add([c.r, c.g, c.b].map((v) => (+v).toFixed(3)).join(","));
            }
        } catch { /* a descriptor we do not understand is not a failure */ }
        return bp.call(this, d);
      };
      const sub = GPUQueue.prototype.submit;
      GPUQueue.prototype.submit = function (...a) { window.__zsubmits++; return sub.apply(this, a); };
    }, 0);
  });

  await page.goto(pathToFileURL(path.resolve(FILE)).href + hash, { waitUntil: "load" });
  await page.waitForTimeout(6000);

  const probe = await page.evaluate(() => {
    const txt = document.body.innerText || "";
    const ZC = window.ZigCore;
    const lum = (s) => { const v = s.split(",").map(Number); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    return {
      fps: ((txt.match(/(\d+)\s*fps/i) || [])[1]) || "\u2014",
      live: /fps/i.test(txt),
      submits: window.__zsubmits || 0,
      clears: [...(window.__zclears || [])].map((s) => lum(s).toFixed(3)).join(" "),
      laws: ZC && ZC.Canon && ZC.Canon.stamp ? ZC.Canon.stamp() : "(no Canon)",
      order: ZC && ZC.Canon && ZC.Canon.Order
        ? ZC.Canon.Order.stamp("frame.light").replace("frame.light: ", "") : "\u2014",
      core: ZC ? String(ZC.VERSION).slice(0, 7) : "?"
    };
  });

  /* THE VERDICT. A driver error is fatal on its own — that is the whole point
     of this rewrite. Frames must also actually be submitted: a page that boots,
     reports fps and never submits a command buffer is not rendering. */
  const ok = probe.live && gpuErrs.length === 0 && otherErrs.length === 0 && probe.submits > 10;
  if (!ok) failed++;

  console.log("  " + (ok ? "PASS " : "FAIL ") + (hash || "(no hash)").padEnd(24) +
    "fps " + String(probe.fps).padStart(3) +
    " \u00b7 submits " + String(probe.submits).padStart(5) +
    " \u00b7 driver errors " + String(gpuErrs.length).padStart(6) +
    " \u00b7 clears " + (probe.clears || "\u2014"));
  console.log("         core " + probe.core + " \u00b7 laws: " + probe.laws +
              " \u00b7 frame.light: " + probe.order);
  for (const e of gpuErrs.slice(0, 2))
    console.log("         DRIVER  " + e.replace(/\s+/g, " ").slice(0, 150));
  if (gpuErrs.length > 2)
    console.log("         DRIVER  \u2026and " + (gpuErrs.length - 2) +
                " more (they cascade \u2014 only the first one is the fault)");
  for (const e of otherErrs.slice(0, 2))
    console.log("         PAGE    " + e.replace(/\s+/g, " ").slice(0, 150));
  if (!probe.live) console.log("         the page never reported a frame rate \u2014 it did not boot");
  else if (probe.submits <= 10)
    console.log("         the loop is running but almost nothing reached the GPU");

  await page.close();
}

await browser.close();
console.log("  " + "-".repeat(94));
console.log(failed === 0
  ? "  PASS \u2014 every configuration booted, submitted frames, and the driver accepted all of them.\n" +
    "         This does NOT mean the frame looks right. The canvas cannot be read here."
  : "  FAIL \u2014 " + failed + " configuration(s). A driver error means the GPU REJECTED the work:\n" +
    "         the loop keeps running and the screen goes black. Read the FIRST error, not the cascade.");
process.exit(failed === 0 ? 0 : 1);

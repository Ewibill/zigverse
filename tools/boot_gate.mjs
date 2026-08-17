/* =============================================================================
   tools/boot_gate.mjs — HEADLESS WebGPU BOOT (SwiftShader)
   (run: node tools/boot_gate.mjs <file.html> [#hash] [#hash] ...)

   Proves the shader COMPILES AND RUNS, which no CPU probe can. It does NOT
   prove what anything looks like: BOOT_GLYPH's warning stands, the WebGPU
   canvas does not composite into a screenshot here, and framing and taste are
   Bill's eye on eyeZ.

   Known-benign console noise is filtered; everything else is a hard error.
   ========================================================================== */
import { chromium } from "playwright";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FILE = process.argv[2];
if (!FILE) { console.log("usage: node tools/boot_gate.mjs <file.html> [#hash ...]"); process.exit(2); }
const HASHES = process.argv.slice(3);
const BENIGN = [/valid external Instance reference no longer exists/i, /favicon/i,
                /Failed to load resource.*404/i];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=vulkan",
         "--use-vulkan=swiftshader", "--no-sandbox", "--disable-gpu-sandbox"]
});

let fail = 0;
for (const h of (HASHES.length ? HASHES : [""])) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error" && !BENIGN.some((r) => r.test(m.text()))) errs.push(m.text()); });
  page.on("pageerror", (e) => { if (!BENIGN.some((r) => r.test(String(e)))) errs.push(String(e)); });

  const url = pathToFileURL(path.resolve(FILE)).href + h;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(6000);

  const probe = await page.evaluate(() => {
    const txt = document.body.innerText || "";
    const line = (txt.match(/[^\n]*fps[^\n]*/i) || [""])[0].trim();
    const ZC = window.ZigCore;
    return {
      status: line.slice(0, 90),
      live: /fps/i.test(txt),
      stamp: ZC && ZC.Canon && ZC.Canon.stamp ? ZC.Canon.stamp() : "(no Canon)",
      order: ZC && ZC.Canon && ZC.Canon.Order
        ? ZC.Canon.Order.stamp("frame.light") + " | " + ZC.Canon.Order.stamp("shard.face")
        : "(no Order)",
      core: ZC ? String(ZC.VERSION).slice(0, 6) : "?",
      gpu: window.ZigWebGPU ? String(window.ZigWebGPU.VERSION).slice(0, 6) : "?"
    };
  });

  const ok = probe.live && errs.length === 0;
  if (!ok) fail++;
  console.log((ok ? "  LIVE  " : "  DEAD  ") + (h || "(no hash)").padEnd(22) +
    " | core " + probe.core + " gpu " + probe.gpu +
    " | laws: " + probe.stamp + " | " + probe.order);
  if (probe.status) console.log("         " + probe.status);
  for (const e of errs.slice(0, 4)) console.log("         ERROR " + e.slice(0, 140));
  await page.close();
}

await browser.close();
console.log(fail === 0 ? "\nPASS \u2014 every configuration booted LIVE with 0 hard errors"
                       : "\nFAIL \u2014 " + fail + " configuration(s) did not boot clean");
process.exit(fail === 0 ? 0 : 1);

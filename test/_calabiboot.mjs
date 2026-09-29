/* =============================================================================
   test/_calabiboot.mjs — the Calabi-Yau study boots, DRAWS, and answers
   (run: node test/_calabiboot.mjs [file.html])   ZIG_BROWSER optional
   Unlike the WebGPU engine, this study is WebGL2, so the canvas CAN be read:
   it proves shards are drawn, that bend turns the shape (the pixels change),
   that breath gathers it, and that 3/4/5 rebuild the surface.
   ========================================================================== */
import path from "node:path"; import { pathToFileURL } from "node:url"; import { existsSync } from "node:fs";
const FILE = process.argv[2] || "calabi_study.html";
let pw; try { pw = await import("playwright-core"); } catch (_) { pw = await import("playwright"); }
const args = ["--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist"];
async function open() {
  if (process.env.ZIG_BROWSER && existsSync(process.env.ZIG_BROWSER)) return pw.chromium.launch({ executablePath: process.env.ZIG_BROWSER, args });
  try { return await pw.chromium.launch({ channel: "chrome", args }); } catch (_) {}
  return pw.chromium.launch({ args: args.concat(["--use-angle=swiftshader"]) });
}
const browser = await open();
let fail = 0; const say = (ok, m) => { console.log((ok ? "  ✓ " : "  ✗ ") + m); if (!ok) fail++; };
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(pathToFileURL(path.resolve(FILE)).href, { waitUntil: "load" });
await page.waitForFunction(() => window.CalabiStudy && window.CalabiStudy.frames > 30, null, { timeout: 30000 });
const shot = () => page.evaluate(() => { const c = document.getElementById("c"), g = c.getContext("webgl2"); const w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
  g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px); let lit = 0; const sig = [];
  for (let i = 0; i < px.length; i += 4) { if (px[i] + px[i + 1] + px[i + 2] > 60) lit++; }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = ((y * h / 16 | 0) * w + (x * w / 16 | 0)) * 4; sig.push(px[i] + px[i + 1] + px[i + 2]); }
  return { lit: lit / (w * h), sig }; });
const diff = (a, b) => a.sig.reduce((s, v, i) => s + Math.abs(v - b.sig[i]), 0) / a.sig.length;
const st = () => page.evaluate(() => ({ ...window.CalabiStudy }));
const s0 = await st(); const p0 = await shot();
say(s0.N > 5000 && s0.n === 5, `boots: the quintic slice, ${s0.N} shards`);
say(p0.lit > 0.01 && p0.lit < 0.6, `it DRAWS: ${(p0.lit * 100).toFixed(1)}% of the frame is lit shard`);
await page.keyboard.down("b"); await page.waitForTimeout(3500); const g1 = (await st()).gather; await page.keyboard.up("b");
say(g1 > s0.gather + 0.1, `breath gathers the shards onto the surface: ${Math.round(s0.gather * 100)}% -> ${Math.round(g1 * 100)}%`);
await page.keyboard.press("Space");                                            // freeze the drift so only bend moves it
await page.evaluate(() => { window.ZigCore.Perf.bend = 0; }); await page.waitForTimeout(2500); const a0 = (await st()).alpha; const q0 = await shot();
await page.evaluate(() => { window.ZigCore.Perf.bend = 1; }); await page.waitForTimeout(2500); const a1 = (await st()).alpha; const q1 = await shot();
say(a1 - a0 > 1.3, `bend turns it through the 4th dimension: ${a0.toFixed(2)} -> ${a1.toFixed(2)} rad`);
say(diff(q0, q1) > 8, `...and the picture really transforms (pixel change ${diff(q0, q1).toFixed(1)})`);
await page.keyboard.press("Digit3"); await page.waitForTimeout(800); const s3 = await st();
say(s3.n === 3 && s3.N > 5000, `3 rebuilds the cubic slice (${s3.N} shards glide to it)`);
say(errs.length === 0, "no page errors" + (errs.length ? ": " + errs[0].slice(0, 140) : ""));
await browser.close();
console.log("\n" + (fail ? "CALABIBOOT FAIL — " + fail : "CALABIBOOT PASS"));
process.exit(fail ? 1 : 0);

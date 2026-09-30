/* =============================================================================
   test/_calabiboot.mjs — the Calabi-Yau study boots, DRAWS, and answers
   (run: node test/_calabiboot.mjs [file.html])   ZIG_BROWSER optional
   Unlike the WebGPU engine, this study is WebGL2, so the canvas CAN be read:
   it proves shards are drawn, that bend turns the shape (the pixels change),
   that breath gathers it, and that 3/4/5 rebuild the surface.
   v0.2: the PHONE - a held finger gathers, a slide turns it, double-tap rebuilds.
   v0.3: LISTEN - no mic until tapped; then sound gathers it; tap again stops.
   v0.4: PLAYED - MIDI pitch turns it, attack scatters, a held note glows.
   ========================================================================== */
import path from "node:path"; import { pathToFileURL } from "node:url"; import { existsSync } from "node:fs";
const FILE = process.argv[2] || "calabi_study.html";
let pw; try { pw = await import("playwright-core"); } catch (_) { pw = await import("playwright"); }
const args = ["--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist",
  "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];      // LISTEN: Chrome's fake mic (a beep), auto-allowed
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
await page.evaluate(() => { window.ZigCore.Perf.bend = 1; }); await page.waitForTimeout(2500);
await page.waitForFunction((a) => window.CalabiStudy.alpha - a > 1.3, a0, { timeout: 12000 }).catch(() => {});   // a slow machine just takes longer
const a1 = (await st()).alpha; const q1 = await shot();
say(a1 - a0 > 1.3, `bend turns it through the 4th dimension: ${a0.toFixed(2)} -> ${a1.toFixed(2)} rad`);
say(diff(q0, q1) > 8, `...and the picture really transforms (pixel change ${diff(q0, q1).toFixed(1)})`);
await page.keyboard.press("Digit3"); await page.waitForTimeout(800); const s3 = await st();
say(s3.n === 3 && s3.N > 5000, `3 rebuilds the cubic slice (${s3.N} shards glide to it)`);
await page.close();                                                              // one page at a time: the desktop field would slow the phone clock
console.log("[PHONE - a finger is the breath]");
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const ph = await ctx.newPage(); ph.on("pageerror", (e) => errs.push(String(e)));
  await ph.goto(pathToFileURL(path.resolve(FILE)).href + "#count=1500", { waitUntil: "load" });
  await ph.waitForFunction(() => window.CalabiStudy && window.CalabiStudy.frames > 30, null, { timeout: 30000 });
  const pst = () => ph.evaluate(() => ({ ...window.CalabiStudy }));
  const P = (type, x, y) => ph.evaluate(([t, x, y]) => document.getElementById("c").dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: "touch", clientX: x, clientY: y, bubbles: true })), [type, x, y]);
  await ph.waitForTimeout(2500); const f0 = await pst();
  say(f0.phone === true && f0.touchB === 0, "a touch screen is recognised as a phone; untouched, the finger-breath is 0 (idle auto-breath ignored)");
  await P("pointerdown", 195, 500); await ph.waitForTimeout(3000); const f1 = await pst();
  say(f1.gather > f0.gather + 0.1, `holding a finger gathers the shape: ${Math.round(f0.gather * 100)}% -> ${Math.round(f1.gather * 100)}%`);
  for (let k = 1; k <= 20; k++) { await P("pointermove", 195 + k * 8, 500); await ph.waitForTimeout(30); }
  const f2 = await pst();
  say(f2.alpha - f1.alpha > 0.7, `sliding sideways turns it through the 4th dimension: ${f1.alpha.toFixed(2)} -> ${f2.alpha.toFixed(2)} rad`);
  await P("pointerup", 355, 500); await ph.waitForTimeout(4000); const f3 = await pst();
  say(f3.fingers === 0 && f3.touchB < f2.touchB - 0.3, `lifting the finger lets it go (finger-breath ${f2.touchB.toFixed(2)} -> ${f3.touchB.toFixed(2)})`);
  await ph.evaluate(() => { const c = document.getElementById("c"); const ev = (t) => c.dispatchEvent(new PointerEvent(t, { pointerId: 8, pointerType: "touch", clientX: 195, clientY: 500, bubbles: true }));
    ev("pointerdown"); ev("pointerup"); ev("pointerdown"); ev("pointerup"); });
  await ph.waitForTimeout(500); const f4 = await pst();
  say(f4.n === 3, `double-tap changes the shape (degree 5 -> ${f4.n})`);
  await ctx.close(); }
console.log("[PLAYED - the EWI is more than breath]");
{ const mp = await browser.newPage({ viewport: { width: 1000, height: 700 } }); mp.on("pageerror", (e) => errs.push(String(e)));
  await mp.goto(pathToFileURL(path.resolve(FILE)).href + "#count=1500", { waitUntil: "load" });
  await mp.waitForFunction(() => window.CalabiStudy && window.CalabiStudy.frames > 30, null, { timeout: 30000 });
  await mp.keyboard.press("Space");                                              // freeze the drift
  const midi = (bytes) => mp.evaluate((b) => ZigCore.Perf.onMsg({ data: new Uint8Array(b) }), bytes);
  const blow = async (ms) => { for (let k = 0; k < ms / 50; k++) { await midi([0xB0, 2, 110]); await mp.waitForTimeout(50); } };
  await midi([0x90, 60, 100]); await blow(1500);
  const m0 = await mp.evaluate(() => ({ a: CalabiStudy.alpha, nt: CalabiStudy.noteTurn, k: CalabiStudy.kick }));
  await midi([0x80, 60, 0]); await midi([0x90, 72, 100]); await blow(2500);
  const m1 = await mp.evaluate(() => ({ a: CalabiStudy.alpha, nt: CalabiStudy.noteTurn, sg: CalabiStudy.sustainG }));
  say(m1.nt - m0.nt > 0.7, `an octave up turns it through the 4th dimension: turn ${m0.nt.toFixed(2)} -> ${m1.nt.toFixed(2)} rad`);
  say(m1.sg > 0.4, `a held note glows: sustain ${m1.sg.toFixed(2)}`);
  await midi([0x80, 72, 0]); await midi([0x90, 67, 100]); await mp.waitForTimeout(150);
  const m2 = await mp.evaluate(() => CalabiStudy.kick);
  say(m2 > 0.2, `an attack scatters the shards for a moment: kick ${m2.toFixed(2)}`);
  await midi([0x80, 67, 0]); await mp.close(); }
console.log("[LISTEN - the engine's ears, opt-in]");
{ const lp = await browser.newPage({ viewport: { width: 1000, height: 700 } }); lp.on("pageerror", (e) => errs.push(String(e)));
  await lp.goto(pathToFileURL(path.resolve(FILE)).href + "#count=1500", { waitUntil: "load" });
  await lp.waitForFunction(() => window.CalabiStudy && window.CalabiStudy.frames > 30, null, { timeout: 30000 });
  await lp.waitForTimeout(2000);
  const l0 = await lp.evaluate(() => ({ on: CalabiStudy.listening, mic: ZigCore.Timbre.live, g: CalabiStudy.gather }));
  say(!l0.on && !l0.mic, "the mic is NOT opened until listen is tapped (a stranger never meets a prompt unasked)");
  await lp.click("#listen"); await lp.waitForTimeout(4000);
  const l1 = await lp.evaluate(() => ({ on: CalabiStudy.listening, mic: ZigCore.Timbre.live, auto: ZigCore.Timbre.auto, sb: CalabiStudy.soundB, g: CalabiStudy.gather, lbl: document.getElementById("listen").textContent }));
  say(l1.on && l1.mic && l1.auto && l1.lbl === "listening", `tapped: it listens through the engine's ears, auto-levelled (a non-MOTU mic)`);
  say(l1.sb > 0.3 && l1.g > l0.g + 0.1, `sound is breath: heard ${l1.sb.toFixed(2)}, gathered ${Math.round(l0.g * 100)}% -> ${Math.round(l1.g * 100)}%`);
  await lp.click("#listen"); await lp.waitForTimeout(2500);
  await lp.waitForFunction((v) => window.CalabiStudy.soundB < v * 0.2, l1.sb, { timeout: 12000 }).catch(() => {});
  const l2 = await lp.evaluate(() => ({ on: CalabiStudy.listening, sb: CalabiStudy.soundB, st: ZigCore.Timbre._ctx.state }));
  say(!l2.on && l2.st === "suspended" && l2.sb < l1.sb * 0.2, `tap again stops listening (audio ${l2.st}, sound fades to ${l2.sb.toFixed(2)})`);
  await lp.close(); }
say(errs.length === 0, "no page errors" + (errs.length ? ": " + errs[0].slice(0, 140) : ""));
await browser.close();
console.log("\n" + (fail ? "CALABIBOOT FAIL — " + fail : "CALABIBOOT PASS"));
process.exit(fail ? 1 : 0);

/* =============================================================================
   test/_chladniboot.mjs — the Chladni study boots, DRAWS, and answers
   (run: node test/_chladniboot.mjs [file.html])   ZIG_BROWSER optional
   WebGL2, so the canvas can be read. Proves: grains are drawn; bowing forms a
   figure; a note changes the figure; the EWI's note / bend / breath reach the
   plate; a finger plays it on a phone; double-tap shakes it clean; listen
   stays off until tapped, then hears. Every wait is "until it happens" (with a
   ceiling), so a slow machine is slower, not failed.
   ========================================================================== */
import path from "node:path"; import { pathToFileURL } from "node:url"; import { existsSync } from "node:fs";
const FILE = process.argv[2] || "chladni_study.html";
let pw; try { pw = await import("playwright-core"); } catch (_) { pw = await import("playwright"); }
const args = ["--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];
async function open() {
  if (process.env.ZIG_BROWSER && existsSync(process.env.ZIG_BROWSER)) return pw.chromium.launch({ executablePath: process.env.ZIG_BROWSER, args });
  try { return await pw.chromium.launch({ channel: "chrome", args }); } catch (_) {}
  return pw.chromium.launch({ args: args.concat(["--use-angle=swiftshader"]) });
}
const browser = await open();
let fail = 0; const say = (ok, m) => { console.log((ok ? "  ✓ " : "  ✗ ") + m); if (!ok) fail++; };
const errs = [];
const URL = (h) => pathToFileURL(path.resolve(FILE)).href + h;
const until = (pg, fn, arg, ms) => pg.waitForFunction(fn, arg, { timeout: ms || 20000 }).then(() => true).catch(() => false);

console.log("[DESKTOP - bow it, change the note]");
{ const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(URL("#count=4000"), { waitUntil: "load" });
  await until(page, () => window.ChladniStudy && window.ChladniStudy.frames > 10);
  const lit = await page.evaluate(() => { const c = document.getElementById("c"), g = c.getContext("webgl2"), w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
    g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px); let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 60) n++; return n / (w * h); });
  const s0 = await page.evaluate(() => ({ ...window.ChladniStudy }));
  say(s0.N === 4000 && lit > 0.01, `it DRAWS: ${s0.N} grains, ${(lit * 100).toFixed(1)}% of the frame lit`);
  say(s0.n === 4 && s0.m === 3, "it opens on E4, the (4,3) figure");
  const midiIn = await page.evaluate(() => ZigCore.Perf.inputs);
  console.log("    (MIDI inputs this browser sees: " + midiIn + (midiIn && midiIn !== "none" ? " - a live EWI can move the note during these checks" : "") + ")");
  await page.keyboard.down("b");
  const formed = await until(page, () => window.ChladniStudy.formed > 0.45);
  const s1 = await page.evaluate(() => ({ ...window.ChladniStudy }));
  say(formed, `bowing forms the figure: formed ${Math.round(s0.formed * 100)}% -> ${Math.round(s1.formed * 100)}% (the sand found the lines itself)`);
  const n0 = await page.evaluate(() => { window.ChladniStudy.keyLog.length = 0; return window.ChladniStudy.note; });
  for (let k = 0; k < 7; k++) await page.keyboard.press("ArrowUp");
  const s2 = await page.evaluate(() => ({ ...window.ChladniStudy, src: window.ChladniStudy.noteSrc, ups: window.ChladniStudy.keyLog.filter((c) => c.startsWith("ArrowUp")) }));
  say(s2.k > s1.k && s2.note === n0 + 7, `seven steps up (note ${n0} -> ${s2.note}) ask for a finer figure: (${s1.n},${s1.m}) k ${s1.k} -> (${s2.n},${s2.m}) k ${s2.k}` +
    (s2.note !== n0 + 7 ? `  [the page received ${s2.ups.length} ArrowUp: ${s2.ups.join(" ")} · last note from: ${s2.src}]` : ""));
  const reformed = await until(page, () => window.ChladniStudy.formed > 0.45);
  say(reformed, "...and the sand re-forms into it");
  await page.keyboard.up("b"); await page.keyboard.press("Space"); await page.waitForTimeout(600);
  const s3 = await page.evaluate(() => ({ ...window.ChladniStudy }));
  say(s3.formed < s2.formed || s3.formed < 0.4, `space shakes the plate clean (formed ${Math.round(s3.formed * 100)}%)`);
  await page.close(); }

console.log("[RICE - few long grains that line up]");
{ const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(URL("#medium=rice"), { waitUntil: "load" });
  await until(page, () => window.ChladniStudy && window.ChladniStudy.frames > 10);
  const r0 = await page.evaluate(() => ({ ...window.ChladniStudy, label: document.getElementById("medium").textContent }));
  say(r0.medium === "rice" && r0.N === 5000 && r0.label === "rice", `#medium=rice pours ${r0.N} grains of rice (the button says ${r0.label})`);
  await page.keyboard.down("b");
  const lined = await until(page, () => window.ChladniStudy.formed > 0.45 && window.ChladniStudy.aligned > 0.6, null, 30000);
  const r1 = await page.evaluate(() => ({ ...window.ChladniStudy }));
  say(lined, `bowed, the rice finds the lines AND turns along them: formed ${Math.round(r1.formed * 100)}%, aligned ${Math.round(r1.aligned * 100)}% (0 = random)`);
  await page.keyboard.up("b"); await page.keyboard.press("KeyG"); await page.waitForTimeout(300);
  const r2 = await page.evaluate(() => ({ ...window.ChladniStudy, kept: localStorage.getItem("zigverse.chladni.medium") }));
  say(r2.medium === "sand" && r2.N === 40000 && r2.kept === "sand", `G pours sand instead: ${r2.N} grains, remembered on the device`);
  await page.evaluate(() => localStorage.removeItem("zigverse.chladni.medium"));
  await page.close(); }

console.log("[EWI - note, bend and breath reach the plate]");
{ const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }); page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(URL("#count=3000"), { waitUntil: "load" });
  await until(page, () => window.ChladniStudy && window.ChladniStudy.frames > 10);
  const midi = (b) => page.evaluate((x) => ZigCore.Perf.onMsg({ data: new Uint8Array(x) }), b);
  await midi([0x90, 76, 100]); await midi([0xB0, 2, 120]);
  const got = await until(page, () => window.ChladniStudy.note === 76, null, 8000);
  const e1 = await page.evaluate(() => ({ ...window.ChladniStudy }));
  say(got && e1.k > 40, `an EWI E5 draws its figure: (${e1.n},${e1.m}) k ${e1.k}`);
  for (let k = 0; k < 20; k++) { await midi([0xB0, 2, 120]); await midi([0xE0, 0, 127]); await page.waitForTimeout(60); }
  const e2 = await page.evaluate(() => ({ ...window.ChladniStudy }));
  say(e2.E > 0.5, `EWI breath bows the plate (drive ${e2.E.toFixed(2)})`);
  say(e2.s > -0.6, `bend morphs the figure (s -1 -> ${e2.s.toFixed(2)})`);
  await midi([0x80, 76, 0]); await page.close(); }

console.log("[PHONE - the finger bows and chooses the note]");
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const ph = await ctx.newPage(); ph.on("pageerror", (e) => errs.push(String(e)));
  await ph.goto(URL("#count=3000"), { waitUntil: "load" });
  await until(ph, () => window.ChladniStudy && window.ChladniStudy.frames > 10);
  const P = (type, x, y, id) => ph.evaluate(([t, x, y, id]) => document.getElementById("c").dispatchEvent(new PointerEvent(t, { pointerId: id || 7, pointerType: "touch", clientX: x, clientY: y, bubbles: true })), [type, x, y, id]);
  const p0 = await ph.evaluate(() => ({ ...window.ChladniStudy }));
  say(p0.phone === true && p0.E < 0.1, `a touch screen is a phone; untouched, the plate barely hums (drive ${p0.E.toFixed(2)})`);
  await P("pointerdown", 195, 150);                                          // high on the screen = a high note
  const bowed = await until(ph, () => window.ChladniStudy.E > 0.5, null, 8000);
  const p1 = await ph.evaluate(() => ({ ...window.ChladniStudy }));
  say(bowed && p1.note > 70, `holding a finger bows the plate; high on the screen is a high note (${p1.note}, figure (${p1.n},${p1.m}))`);
  await P("pointermove", 195, 700);
  await until(ph, () => window.ChladniStudy.note < 60, null, 5000);
  const p2 = await ph.evaluate(() => ({ ...window.ChladniStudy, src: window.ChladniStudy.noteSrc, fingers: window.ChladniStudy.fingers, midi: ZigCore.Perf.inputs, live: ZigCore.Perf.live }));
  say(p2.note < 60, `sliding down plays lower: note ${p2.note}, figure (${p2.n},${p2.m})` + (p2.note < 60 ? "" : `  [note from: ${p2.src} · fingers ${p2.fingers} · MIDI ${p2.midi} · EWI live ${p2.live}]`));
  await P("pointerup", 195, 700); await ph.waitForTimeout(400);
  await ph.evaluate(() => { const c = document.getElementById("c"); const ev = (t) => c.dispatchEvent(new PointerEvent(t, { pointerId: 9, pointerType: "touch", clientX: 100, clientY: 400, bubbles: true }));
    ev("pointerdown"); ev("pointerup"); ev("pointerdown"); ev("pointerup"); });
  const spread = await ph.evaluate(() => { const P = ChladniStudy.plate(); let sx = 0; for (let i = 0; i < P.x.length; i++) sx += P.x[i] * P.x[i]; return sx / P.x.length; });
  say(Math.abs(spread - 1 / 3) < 0.05, `double-tap shakes the plate clean (grains spread evenly again: <x^2> ${spread.toFixed(3)} ~ 0.333)`);
  await ctx.close(); }

console.log("[LISTEN - opt-in, then it hears the note]");
{ const lp = await browser.newPage({ viewport: { width: 1000, height: 700 } }); lp.on("pageerror", (e) => errs.push(String(e)));
  await lp.goto(URL("#count=3000"), { waitUntil: "load" });
  await until(lp, () => window.ChladniStudy && window.ChladniStudy.frames > 10);
  const l0 = await lp.evaluate(() => ({ on: ChladniStudy.listening, mic: ZigCore.Timbre.live }));
  say(!l0.on && !l0.mic, "no microphone until listen is tapped");
  await lp.click("#listen");
  const heard = await until(lp, () => window.ChladniStudy.listening && window.ChladniStudy.sung && window.ChladniStudy.sung.hz > 0, null, 45000);   // the test mic only beeps briefly each second; a slow machine needs time to catch one
  const l1 = await lp.evaluate(() => ({ on: ChladniStudy.listening, sung: ChladniStudy.sung, note: ChladniStudy.note }));
  say(l1.on, "tapped: it listens (auto-levelled, a non-MOTU mic)");
  say(heard, heard ? `...and hears a NOTE: ${Math.round(l1.sung.hz)} Hz (clarity ${l1.sung.clarity.toFixed(2)}) -> figure for note ${l1.note}` : "...but heard no clear note from the test microphone");
  await lp.close(); }

say(errs.length === 0, "no page errors" + (errs.length ? ": " + errs[0].slice(0, 140) : ""));
await browser.close();
console.log("\n" + (fail ? "CHLADNIBOOT FAIL — " + fail : "CHLADNIBOOT PASS"));
process.exit(fail ? 1 : 0);

/* =============================================================================
   test/_touchboot.mjs — ZIGTOUCH IN THE ENGINE, driven by a real pointer
   (run: node test/_touchboot.mjs [file.html])   ZIG_BROWSER=<chrome> optional

   boot_gate proves the frame was ACCEPTED. This proves the hand is HEARD:
   it presses the glass of the running WebGPU organism and reads back numbers.
     PANEL   picking TOUCH=nucleus in the dropdown reloads into a page where
             ZigTouch owns the glass AND the Bee is armed (the GEM 2 lesson:
             a dropdown that changes a value nobody reads passes every CPU gate)
     OFF     touch=off keeps v5.3: a press is still a Perf.hold note
     HOLD    a still finger becomes the nucleus under the finger; the field's
             centroid moves toward the hand
     WAVE    a sweep let go moving throws her along the hand; the wind blows
             that way; then the body is let go and the wind falls silent
   It cannot see the canvas. Taste is Bill's eye; this is only the chain.
   ========================================================================== */
import path from "node:path";
import { pathToFileURL } from "node:url";

const FILE = process.argv[2] || "zigverse_engine.html";
let pw; try { pw = await import("playwright-core"); } catch (_) { pw = await import("playwright"); }
/* SAME LAUNCHER AS tools/boot_gate.mjs — the first cut forced SwiftShader on
   EVERY browser, which on eyeZ handed real Chrome no adapter at all: the page
   never booted and the probe timed out. SwiftShader is only the LAST resort. */
const args = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--no-sandbox", "--disable-gpu-sandbox"];
const SW = ["--use-angle=vulkan", "--use-vulkan=swiftshader"];
const { existsSync } = await import("node:fs");
async function openBrowser() {
  if (process.env.ZIG_BROWSER && existsSync(process.env.ZIG_BROWSER))
    return [await pw.chromium.launch({ executablePath: process.env.ZIG_BROWSER, args }), "ZIG_BROWSER"];
  try { return [await pw.chromium.launch({ channel: "chrome", args }), "system Chrome"]; } catch (_) {}
  return [await pw.chromium.launch({ args: args.concat(SW) }), "bundled Chromium (SwiftShader)"];
}
const [browser, how] = await openBrowser();
console.log("  driver: " + how + "  ·  " + path.basename(FILE));

let fail = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) fail++; };
const url = (h) => pathToFileURL(path.resolve(FILE)).href + h;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const boot = async (page) => page.waitForFunction(() => window.SickleField && window.SickleField.booted, null, { timeout: 60000 });
/* GPU readback (flock.measure → mapAsync) never resolves under SwiftShader —
   on a real GPU (eyeZ) it does, and the centroid lines print numbers.
   the same wall as pixel readback. On eyeZ it returns; here it times out and
   the body's motion is reported as NOT MEASURED rather than failed. */
const centroid = (page) => page.evaluate(() => new Promise((res) => {
  const f = window.SickleField.flock; setTimeout(() => res(null), 2500);
  try { if (!f.measure((m) => res(m), 3)) res(null); } catch (_) { res(null); } })).catch(() => null);

const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => errors.push(e.message));
if (process.env.NAVLOG) { const t0 = Date.now(); page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log("     nav +" + (Date.now() - t0) + "ms " + (f.url().split("#")[1] || "").slice(0, 60)); }); }

console.log("[OFF — v5.3 untouched]");
await page.goto(url("#touch=off"), { waitUntil: "load" }); await boot(page);
{
  const r = await page.evaluate(() => ({ zt: !!window.SickleField.touch, zlib: !!window.ZigTouch }));
  await page.mouse.move(640, 360); await page.mouse.down(); await sleep(400);
  const held = await page.evaluate(() => !!(ZigCore.Perf._touch && ZigCore.Perf.heldT.size));
  await page.mouse.up(); await sleep(100);
  const released = await page.evaluate(() => !ZigCore.Perf.heldT.size);
  say(r.zlib && !r.zt && held && released, "ZigTouch loaded but not armed · a press is still v5.3's Perf.hold note · lift releases it");
}

console.log("[PANEL — the dropdown actually arms it]");
{
  await Promise.all([page.waitForEvent("load"), page.selectOption("#touchpick", "nucleus")]);   // wait for the RELOAD, not the page we are on
  await boot(page);
  const r = await page.evaluate(() => ({ hash: location.hash, zt: !!window.SickleField.touch,
    pres: !!(window.SickleField.flock && window.SickleField.flock.presence),
    bee: document.getElementById("beepick").value, mood: document.getElementById("bmpick").value,
    tp: document.getElementById("touchpick").value }));
  say(/touch=nucleus/.test(r.hash) && r.zt && r.tp === "nucleus", "TOUCH=nucleus survives the reload and ZigTouch owns the glass");
  say(r.pres && r.bee === "curious" && r.mood === "cozy" && /bee=curious/.test(r.hash) && /beemode=cozy/.test(r.hash),
    "…and the Bee is armed (BEE curious · MOOD cozy) — in the panel AND in the hash, so no dial lies");
}

console.log("[HOLD — the finger becomes the nucleus]");
const W = 1280, H = 720, fx = 900, fy = 300;
{
  await sleep(1500);
  const c0 = await centroid(page);
  await page.mouse.move(fx, fy); await page.mouse.down();
  await sleep(600);
  const early = await page.evaluate(() => window.SickleField.touch.nucleus.w);
  await sleep(4200);
  const s = await page.evaluate(() => { const z = window.SickleField.touch;
    return { w: z.nucleus.w, x: z.nucleus.x, y: z.nucleus.y, at: z.at, av: z.avatar(), trust: z.touch.field.trust,
             breath: ZigCore.Perf.breathRaw, sim: ZigCore.Perf._sim, notes: ZigCore.Perf.heldT.size }; });
  const c1 = await centroid(page);
  const m = Math.min(W, H);
  say(early < 0.15 && s.w > 0.6, `earned, not granted: nucleus ${early.toFixed(2)} at 0.6s → ${s.w.toFixed(2)} at 4.8s (trust ${s.trust.toFixed(2)})`);
  say(Math.abs(s.x - fx / m) < 0.01 && Math.abs(s.y - fy / m) < 0.01, `the nucleus sits under the finger (${s.x.toFixed(3)}, ${s.y.toFixed(3)} u)`);
  const d = s.at ? Math.hypot(s.av[0] - s.at[0], s.av[1] - s.at[1], s.av[2] - s.at[2]) : 1e9;
  say(s.at && d < 3, `the Bee's target is the finger's point in the world (${s.at && s.at.map((v) => v.toFixed(1)).join(", ")} · off by ${d.toFixed(2)})`);
  say(s.av[3] > 3, `charisma rides trust: ${s.av[3].toFixed(2)} (BEE curious ceiling 6)`);
  say(s.sim > 0.6 && s.notes === 0, `the held hand breathes (Perf.sim ${s.sim.toFixed(2)}) without posting a note — TRUST, not dwell, is the hand's`);
  if (c0 && c1 && s.at) {
    const before = Math.hypot(c0.cx - s.at[0], c0.cy - s.at[1], c0.cz - s.at[2]);
    const after = Math.hypot(c1.cx - s.at[0], c1.cy - s.at[1], c1.cz - s.at[2]);
    console.log(`     centroid → finger point: ${before.toFixed(1)} → ${after.toFixed(1)} world units · spread r ${c0.r.toFixed(1)} → ${c1.r.toFixed(1)}`);
    say(after < before, "the field's centre of mass moved toward the hand");
  } else console.log("     centroid: NOT MEASURED here (GPU readback does not resolve under SwiftShader) — body motion is Bill's eye / eyeZ");

  console.log("[WAVE — sweep and let go while moving]");
  const pre = await page.evaluate(() => window.SickleField.touch.at.slice());
  for (let i = 1; i <= 8; i++) { await page.mouse.move(fx - i * 40, fy + i * 6); await sleep(12); }   // leftward sweep
  await page.mouse.up();
  await sleep(150);
  const a = await page.evaluate(() => { const z = window.SickleField.touch;
    return { thrown: z.nucleus.thrown, x: z.nucleus.x, at: z.at && z.at.slice(), wind: z.wind.slice(), w: z.nucleus.w,
             waves: 0, status: (document.getElementById("status") || {}).textContent || "" }; });
  const lift = (fx - 320) / m;
  say(a.thrown && a.x < lift - 0.05, `thrown along the hand: lift ${lift.toFixed(2)} u → landed ${a.x.toFixed(2)} u (leftward)`);
  const dirWorld = [a.at[0] - pre[0], a.at[1] - pre[1], a.at[2] - pre[2]];
  const dot = a.wind[0] * dirWorld[0] + a.wind[1] * dirWorld[1] + a.wind[2] * dirWorld[2];
  const wl = Math.hypot(...a.wind);
  say(wl > 0.5 && dot > 0, `the world's current blows the way the body was thrown (|wind| ${wl.toFixed(2)})`);
  const c2 = await centroid(page); await sleep(1800); const c3 = await centroid(page);
  if (c1 && c3) console.log(`     centroid x: held ${c1.cx.toFixed(1)} → +0.3s ${c2 ? c2.cx.toFixed(1) : "?"} → +2.1s ${c3.cx.toFixed(1)}`);
  else console.log("     centroid after the wave: NOT MEASURED here");
  await sleep(9000);
  const z = await page.evaluate(() => { const t = window.SickleField.touch; return { w: t.nucleus.w, wind: Math.hypot(...t.wind), sim: ZigCore.Perf._sim }; });
  say(z.w < 0.05 && z.wind < 0.05 && z.sim === 0, `then let go: nucleus ${z.w.toFixed(3)} · wind ${z.wind.toFixed(3)} · breath released`);
}

console.log("[FIELD — taps habituate]");
{
  await page.goto(url("#touch=field"), { waitUntil: "load" }); await boot(page); await sleep(800);
  const got = [];
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(640, 360); await page.mouse.down(); await sleep(60); await page.mouse.up(); await sleep(420);
    got.push(await page.evaluate(() => window.SickleField.touch.touch.field.lastStartle));
  }
  say(got[7] < got[0] * 0.6, `eight taps at 2Hz: startle ${got.map((v) => Math.round(v * 100)).join(" · ")}% — the organism gets used to you`);
  const hb = await page.evaluate(() => window.SickleField.touch.haptics && window.SickleField.touch.haptics.status());
  console.log("     haptics here: " + (hb ? hb.backend + " — " + hb.why + " · sent " + hb.sent : "none"));
}

say(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close();
console.log(fail ? `\nTOUCHBOOT FAIL (${fail})` : "\nTOUCHBOOT PASS");
process.exit(fail ? 1 : 0);

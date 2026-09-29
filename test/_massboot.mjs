/* =============================================================================
   test/_massboot.mjs — v5.7 on the GPU: MASS, SOLID, the Bee under SKY none,
   SENSITIVITY. (run: node test/_massboot.mjs [file.html])  ZIG_BROWSER optional

   boot_gate proves the frames were ACCEPTED. This reads the numbers back out of
   the running kernels (flock.peek / flock.measure) — it cannot see the canvas.
     MASS    stone settles LOWER than today in silence; breath lifts it back up
     SOLID   the shade actually reaches the GPU: agents carry a shade step in
             velocity.w, crowded ones more; with SOLID off every |w| <= 1.25
     BEE     SKY none keeps her ember (render2.y > 0); the god rays are gone
             from the shader instead
     SENSE   the SENSITIVITY dropdown is live, remembered, and reaches the ears
   ========================================================================== */
import path from "node:path"; import { pathToFileURL } from "node:url";
const FILE = process.argv[2] || "zigverse_engine.html";
let pw; try { pw = await import("playwright-core"); } catch (_) { pw = await import("playwright"); }
const args = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--no-sandbox", "--disable-gpu-sandbox",
  "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
page.on("crash", () => console.log("     PAGE CRASHED"));
if (process.env.ZIG_NAVLOG) page.on("framenavigated", (f) => { if (f === page.mainFrame()) console.log("     nav " + f.url().split("#")[1]); });
const fresh = async (hash) => { await page.goto("about:blank"); await page.goto(url(hash), { waitUntil: "load" });
  await page.waitForFunction(() => window.SickleField && window.SickleField.booted, null, { timeout: 60000 }); };
const wait = (ms) => page.waitForTimeout(ms);
/* GPU READBACK (measure / peek -> mapAsync) returns on a real GPU (eyeZ, the
   Air) but never resolves under the container's SwiftShader - there it can even
   take the page down. So every read has a 3 s timeout and a missing answer is
   reported as NOT MEASURED, never as a pass. On eyeZ these lines print numbers. */
const NM = "  - not measured here (GPU readback needs a real GPU - these lines run on eyeZ)";
let measured = 0;
const read1 = () => page.evaluate(() => new Promise((res) => { const f = SickleField.flock; setTimeout(() => res(null), 3000);
  const go = () => { try { if (!f.measure((m) => res(m.cy), 3)) setTimeout(go, 30); } catch (_) { res(null); } }; go(); })).catch(() => null);
const height = async (n) => { let s = 0; for (let k = 0; k < (n || 4); k++) { const y = await read1(); if (y == null) return null; s += y; await wait(250); } measured++; return s / (n || 4); };
const vel = () => page.evaluate(() => new Promise((res) => { setTimeout(() => res(null), 3000);
  try { SickleField.flock.peek((a) => res(a ? Array.from(a) : null), "vel", 6000); } catch (_) { res(null); } })).catch(() => null);

console.log("[MASS — weight settles in silence, breath lifts it]");
await fresh("#mass=off&touch=off"); await wait(12000); const yOff = await height();
await fresh("#mass=stone&touch=off"); await wait(12000); const yStone = yOff == null ? null : await height();
if (yOff == null || yStone == null) console.log(NM);
else {
  say(yStone < yOff - 3, `in silence stone rests lower than today: ${yOff.toFixed(1)} -> ${yStone.toFixed(1)} (${(yOff - yStone).toFixed(1)} units)`);
  await page.keyboard.down("b"); await wait(9000); const yLift = await height(); await page.keyboard.up("b");
  say(yLift != null && yLift > yStone + 3, `breath lifts it: ${yStone.toFixed(1)} -> ${yLift == null ? "?" : yLift.toFixed(1)} while B is held`);
  const vs = await vel();
  say(vs && vs.every((x) => isFinite(x)), "every stone agent is finite (no mass blow-up)");
}

console.log("[SOLID — the neighbours' shade reaches the GPU]");
await fresh("#solid=off&touch=off"); await wait(4000);
const v0 = await vel();
if (!v0) console.log(NM);
else {
  let maxW0 = 0; for (let i = 3; i < v0.length; i += 4) maxW0 = Math.max(maxW0, Math.abs(v0[i]));
  say(maxW0 <= 1.2501, `SOLID off: velocity.w is only the bank (max |w| ${maxW0.toFixed(3)} <= 1.25)`);
  await fresh("#solid=on&touch=off"); await wait(4000);
  const v1 = await vel(); const q = []; if (v1) for (let i = 3; i < v1.length; i += 4) q.push(Math.round(v1[i] / 4));
  const shaded = q.filter((x) => x > 0).length, hist = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => q.filter((x) => x === k).length);
  say(q.length > 0 && q.every((x) => x >= 0 && x <= 8), "every agent's shade step decodes to 0..8");
  say(shaded > q.length * 0.05 && shaded < q.length * 0.98, `some shards are shaded by neighbours, not all: ${shaded} of ${q.length}  [steps 0..8: ${hist.join(" ")}]`);
}
await fresh("#solid=on&mass=stone&mat=velvet&gem=aqua&gem2=emerald&touch=off"); await wait(3000);
say(true, "SOLID + MASS + material + dual gem boots together");

console.log("[NATURE — the physics holds together, and bodies slip]");
{
  const rad = () => page.evaluate(() => new Promise((res) => { const f = SickleField.flock; setTimeout(() => res(null), 3000);
    const go = () => { try { if (!f.measure((m) => res(m.r), 3)) setTimeout(go, 30); } catch (_) { res(null); } }; go(); })).catch(() => null);
  const peekR = (region) => page.evaluate((rg) => new Promise((res) => { setTimeout(() => res(null), 3000);
    try { SickleField.flock.peek((a) => res(a ? Array.from(a) : null), "vel", 3000, rg); } catch (_) { res(null); } }), region).catch(() => null);
  await fresh("#nature=classic&mass=wood&touch=off"); await wait(10000); const rC = await rad();
  await fresh("#nature=natural&mass=wood&touch=off"); await wait(10000); const rN = await rad();
  const vN = await peekR(0), hN = await peekR(1);
  if (rC == null || rN == null || !vN || !hN) console.log(NM);
  else {
    measured++;
    say(vN.every(isFinite) && hN.every(isFinite), "every natural body is finite (velocity and heading)");
    say(rN < rC * 2.2 && rN > rC * 0.3, `the field holds together: radius classic ${rC.toFixed(1)} vs natural ${rN.toFixed(1)}`);
    let slip = 0, n = 0; for (let i = 0; i < vN.length; i += 4) { const sp = Math.hypot(vN[i], vN[i + 1], vN[i + 2]), hl = Math.hypot(hN[i], hN[i + 1], hN[i + 2]);
      if (sp > 0.05 && hl > 0.5) { n++; if ((vN[i] * hN[i] + vN[i + 1] * hN[i + 1] + vN[i + 2] * hN[i + 2]) / (sp * hl) < 0.985) slip++; } }
    say(n > 100 && slip > n * 0.02 && slip < n * 0.9, `bodies are not their velocity: ${slip} of ${n} point >10 deg away from their motion`);
  }
}
console.log("[BEE — SKY none keeps her ember]");
await fresh("#sky=none&touch=nucleus&bee=magnetic&beemode=cozy"); await wait(3000);
const ember = await page.evaluate(() => SickleField.view[69]);
say(ember > 0.5, `render2.y (her ember) is ${ember.toFixed(2)} with SKY none (0 in v5.6.1)`);

console.log("[BEE v5.9 — her glow follows her attention]");
{
  await fresh("#bee=magnetic&beemode=cozy&touch=off&mass=stone&nature=natural"); await wait(2500);
  const rest = await page.evaluate(() => SickleField.view[69]);
  await page.evaluate(() => { ZigCore.Perf.heldT.set(72, performance.now()); });   // a long note, held
  await wait(3500);
  const held = await page.evaluate(() => SickleField.view[69]);
  await page.evaluate(() => { ZigCore.Perf.heldT.clear(); }); await wait(2500);
  const after = await page.evaluate(() => SickleField.view[69]);
  say(held > rest + 1.5, `a held note raises her glow: ${rest.toFixed(2)} -> ${held.toFixed(2)} (fixed at 3.00 before v5.9)`);
  say(after < held - 1.0, `and it falls back when the note ends: -> ${after.toFixed(2)}`);
}
console.log("[SWELL — breath is the wind]");
{
  await fresh("#swell=sets&touch=off"); await wait(3000);
  const e0 = await page.evaluate(() => SickleField.view[104]);
  await page.keyboard.down("b"); await wait(6000); const e1 = await page.evaluate(() => SickleField.view[104]); await page.keyboard.up("b");
  await wait(8000); const e2 = await page.evaluate(() => SickleField.view[104]);
  say(e0 > 0.1 && e0 < 0.35, `in ALIVE a gentle sea never quite stops: energy ${e0.toFixed(2)}`);
  say(e1 > e0 + 0.4, `breath builds the sea over seconds: ${e0.toFixed(2)} -> ${e1.toFixed(2)}`);
  say(e2 < e1 - 0.2, `silence lets it lie down, slower: -> ${e2.toFixed(2)}`);
}
console.log("[SENSITIVITY — live, remembered, reaches the ears]");
await fresh("#mic=listen&touch=off");
const opts = await page.evaluate(() => Array.from(document.getElementById("senspick").options).map((o) => o.value).join(","));
say(opts === "low,normal,high,max", "the dropdown offers low · normal · high · max");
await page.selectOption("#senspick", "max"); await wait(300);
const live = await page.evaluate(() => SickleField.getSens());
say(live === "max", "changing it is live (no reload): species hears " + live);
await fresh("#mic=listen&touch=off");
const kept = await page.evaluate(() => [document.getElementById("senspick").value, SickleField.getSens()].join("/"));
say(kept === "max/max", "remembered on the device after a reload (" + kept + ")");
await page.mouse.click(640, 400); await wait(2500);
const ears = await page.evaluate(() => ({ live: ZigCore.Timbre.live, iface: ZigCore.Timbre.iface, auto: ZigCore.Timbre.auto, trim: ZigCore.Timbre.trim, dev: ZigCore.Timbre.device }));
say(ears.live && !ears.iface && ears.auto && Math.abs(ears.trim - 1.8) < 1e-9,
  `a tap opens the mic (${ears.dev}): not the interface, so it is auto-levelled at max (trim ${ears.trim})`);
await page.selectOption("#senspick", "normal"); await wait(100);

say(errs.length === 0, "no page errors" + (errs.length ? ": " + errs[0].slice(0, 120) : ""));
await browser.close();
console.log("\n" + (fail ? "MASSBOOT FAIL — " + fail : "MASSBOOT PASS" + (measured ? "" : "  (GPU readback lines NOT MEASURED - run on eyeZ)")));
process.exit(fail ? 1 : 0);

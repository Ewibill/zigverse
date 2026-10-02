/* =============================================================================
   test/_chladniprobe.mjs — WHY does the real swarm not draw the figure?
   (run on eyeZ: node test/_chladniprobe.mjs [file.html])   ZIG_BROWSER optional

   v6.0 on eyeZ: plate motion under the shards 1.08 (silent) -> 1.04 (singing).
   The CPU stand-in flock drew the figure (1.12 -> 0.16); the real swarm did not.
   This runs several variants of the law on the REAL swarm and prints, for each:
     ratio     plate motion under the shards / an even spread (lower = on the lines)
     inPlane   mean speed ACROSS the plate  - the grip must slow this when singing;
               if it does not drop at all, the law is not acting (wiring), not weak
     depth     mean speed along the view (free by design)
     offset    the swarm's centre from the plate's centre, in plate half-sizes
     spread    the swarm's size on the plate (std of X, Y in plate units)
   Needs GPU read-back (a real GPU). In a headless container every line says so.
   ========================================================================== */
import path from "node:path"; import { pathToFileURL } from "node:url"; import { existsSync } from "node:fs";
const FILE = process.argv[2] || "zigverse_engine.html";
let pw; try { pw = await import("playwright-core"); } catch (_) { pw = await import("playwright"); }
const args = ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--no-sandbox", "--disable-gpu-sandbox"];
async function openBrowser() {
  if (process.env.ZIG_BROWSER && existsSync(process.env.ZIG_BROWSER)) return pw.chromium.launch({ executablePath: process.env.ZIG_BROWSER, args });
  try { return await pw.chromium.launch({ channel: "chrome", args }); } catch (_) {}
  return pw.chromium.launch({ args: args.concat(["--use-angle=vulkan", "--use-vulkan=swiftshader"]) });
}
const browser = await openBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
let lost = false; page.on("console", (m) => { if (/device lost|external Instance/i.test(m.text())) lost = true; });
const wait = (ms) => page.waitForTimeout(ms);
const VARIANTS = [                                  // round 4 (v6.1): the plate at any angle
  ["S firm, SIDE view", "#chladni=firm&touch=off&angle=side"],
  ["O firm, OVERHEAD view (the plate lies flat)", "#chladni=firm&touch=off&angle=overhead"],
  ["G gentle, OVERHEAD view", "#chladni=gentle&touch=off&angle=overhead"]
];
const read = () => page.evaluate(() => new Promise((res) => {
  setTimeout(() => res(null), 8000);
  const F = SickleField.flock, g = SickleField.chladni, C = window.ZigChladni;
  try {
    F.peek((pos) => { if (!pos) return res(null); F.peek((vel) => { if (!vel) return res(null);
      let acc = 0, n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, vin = 0, vdep = 0;
      const R = g.right, U = g.up, Nn = [R[1] * U[2] - R[2] * U[1], R[2] * U[0] - R[0] * U[2], R[0] * U[1] - R[1] * U[0]];   // the plate's axes; Nn = its normal (depth)
      const d3 = (a, b, o) => a[o] * b[0] + a[o + 1] * b[1] + a[o + 2] * b[2];
      for (let i = 4; i < pos.length; i += 4) {
        const dx = pos[i] - g.c[0], dy = pos[i + 1] - g.c[1], dz = pos[i + 2] - g.c[2];
        const X = (dx * R[0] + dy * R[1] + dz * R[2]) / g.L, Y = (dx * U[0] + dy * U[1] + dz * U[2]) / g.L;
        sx += X; sy += Y; sxx += X * X; syy += Y * Y;
        vin += Math.hypot(d3(vel, R, i), d3(vel, U, i));
        vdep += Math.abs(d3(vel, Nn, i));
        if (Math.abs(X) < 1 && Math.abs(Y) < 1) { acc += Math.abs(C.u(g.n, g.m, g.s, X, Y)); n++; }
      }
      const N = pos.length / 4 - 1, mx = sx / N, my = sy / N;
      res({ ratio: n ? acc / n / C.baseline(g.n, g.m, g.s) : NaN, onPlate: n / N, inPlane: vin / N, depth: vdep / N,
        offset: Math.hypot(mx, my), spread: Math.sqrt(Math.max(0, (sxx + syy) / N - mx * mx - my * my)), E: g.E, L: g.L, c: g.c.slice(), right: g.right.slice(), up: g.up.slice(), K: g.K, J: g.J, D: g.D, centre: g.centre });
    }, "vel", 6000); }, "pos", 6000);
  } catch (_) { res(null); }
})).catch(() => null);
let ref0 = null;
const drift = (r) => { if (!r || !ref0) return ""; const d = Math.hypot(r.c[0] - ref0.c[0], r.c[1] - ref0.c[1], r.c[2] - ref0.c[2]) / ref0.L;
  const a = Math.acos(Math.max(-1, Math.min(1, r.right[0] * ref0.right[0] + r.right[1] * ref0.right[1] + r.right[2] * ref0.right[2]))) * 57.3;
  return ` · plate moved ${d.toFixed(2)} L, turned ${a.toFixed(0)} deg, size x${(r.L / ref0.L).toFixed(2)}`; };
const fmt = (r) => r ? `ratio ${r.ratio.toFixed(2)} · inPlane ${r.inPlane.toFixed(2)} · depth ${r.depth.toFixed(2)} · offset ${r.offset.toFixed(2)} · spread ${r.spread.toFixed(2)} · on plate ${(r.onPlate * 100).toFixed(0)}% · drive ${r.E.toFixed(2)} · L ${r.L.toFixed(0)}` : "NOT MEASURED (no GPU read-back here)";
const midi = (b) => page.evaluate((x) => ZigCore.Perf.onMsg({ data: new Uint8Array(x) }), b);
console.log("  CHLADNI PROBE · " + path.basename(FILE));
for (const [label, hash] of VARIANTS) {
  await page.goto("about:blank"); await page.goto(pathToFileURL(path.resolve(FILE)).href + hash, { waitUntil: "load" });
  await page.waitForFunction(() => window.SickleField && SickleField.booted && SickleField.chladni, null, { timeout: 60000 });
  await wait(4000);
  const k = await page.evaluate(() => SickleField.chladni);
  console.log(`\n  [${label}]  K ${k.K} · J ${k.J} · D ${k.D} · random ${k.hash} · plate on ${k.centre} · angle ${k.angle} · sim clock ${k.simRate}x`);
  console.log("    silent      " + fmt(await read()));
  await midi([0x90, 64, 100]); await wait(100); ref0 = await read();
  for (let s = 1; s <= 4; s++) { for (let q = 0; q < 50; q++) { await midi([0xB0, 2, 118]); await wait(80); } const r = await read(); console.log(`    singing ${s * 4}s  ` + fmt(r) + drift(r)); }
  await midi([0x90, 76, 100]); await midi([0x80, 64, 0]); await wait(100); ref0 = await read();   // legato to E5: a new figure, the plate set again
  for (let s = 1; s <= 2; s++) { for (let q = 0; q < 50; q++) { await midi([0xB0, 2, 118]); await wait(80); } const r = await read(); console.log(`    E5 ${s * 4}s      ` + fmt(r) + drift(r)); }
  await midi([0x80, 76, 0]);
}
if (lost) console.log("\n  (the GPU device was lost on this machine - a headless software GPU; run this on eyeZ)");
console.log("\n  Send Glyph a screenshot of all of it. What it means:\n" +
  "    S falls well below 1 while singing (v6.0.3: 0.20)       -> the side view still draws, after the plate went fully 3-D\n" +
  "    O and G fall well below 1                              -> the flat plate draws from overhead (depth there = up and down)\n" +
  "    E5 lines fall again after the change                   -> a new note re-sets the plate and the figure re-forms\n");
await browser.close();

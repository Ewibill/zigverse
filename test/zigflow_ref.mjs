/* =============================================================================
   test/zigflow_ref.mjs — CPU reference proof for the ZigFlow wind law
   (run: node test/zigflow_ref.mjs) — no GPU; pure vector calculus truth.

   The ambient weather is the CURL of a sinusoidal vector potential. Curl
   fields are divergence-free by construction: wind swirls, but never drains
   away or piles up anywhere — no fake sinks, no fake sources. This mirror
   implements the WGSL curlN() term-for-term and checks:
     1. numeric divergence ≈ 0 at many points (the law holds)
     2. the wind is alive (nonzero, varied, time-evolving)
     3. the mirror matches the exact WGSL constants (drift guard)
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/* mirror of curlN in engine/zigwebgpu.js FLOW_WGSL — keep term-identical */
const S = 0.021;
function curlN(px, py, pz, t) {
  const ax = px * S, ay = py * S + t * 0.03, az = pz * S;
  const cx = Math.sin(ax * 1.4 + 2.3) * (-Math.sin(ay * 1.2)) * 1.2 - Math.cos(ax * 0.9) * Math.cos(az * 1.1 + 4.2) * 1.1;
  const cy = Math.sin(ay + 1.7) * (-Math.sin(az * 1.3)) * 1.3 - Math.cos(ay * 1.2) * Math.cos(ax * 1.4 + 2.3) * 1.4;
  const cz = Math.sin(az * 1.1 + 4.2) * (-Math.sin(ax * 0.9)) * 0.9 - Math.cos(ay + 1.7) * Math.cos(az * 1.3);
  return [cx, cy, cz];
}

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };

/* deterministic point set (no Math.random — same discipline as the engine) */
const pts = [];
let h = 12345;
const next = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return (h / 0x7fffffff) * 2 - 1; };
for (let i = 0; i < 300; i++) pts.push([next() * 130, (next() * 0.5 + 0.5) * 130, next() * 130, (next() * 0.5 + 0.5) * 20]);

console.log("[divergence-free — the wind never drains or piles]");
{
  const eps = 0.05;
  let worst = 0, meanMag = 0;
  for (const [x, y, z, t] of pts) {
    const dxp = curlN(x + eps, y, z, t)[0], dxm = curlN(x - eps, y, z, t)[0];
    const dyp = curlN(x, y + eps, z, t)[1], dym = curlN(x, y - eps, z, t)[1];
    const dzp = curlN(x, y, z + eps, t)[2], dzm = curlN(x, y, z - eps, t)[2];
    const div = (dxp - dxm + dyp - dym + dzp - dzm) / (2 * eps);
    const v = curlN(x, y, z, t);
    meanMag += Math.hypot(v[0], v[1], v[2]);
    worst = Math.max(worst, Math.abs(div));
  }
  meanMag /= pts.length;
  /* divergence carries a factor S from the chain rule; relative to typical
     wind magnitude per unit length it must be numerically ~0 */
  say(worst < 1e-3, "worst |∇·v| = " + worst.toExponential(2) + " (limit 1e-3)");
  say(meanMag > 0.4, "the wind is alive: mean |v| = " + meanMag.toFixed(2));
}

console.log("[time evolution — weather, not wallpaper]");
{
  const a = curlN(30, 60, -40, 0), b = curlN(30, 60, -40, 60);
  const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  say(d > 0.05, "same point, +60 s → wind turned (Δ = " + d.toFixed(3) + ")");
}

console.log("[mirror drift guard — WGSL and JS stay term-identical]");
{
  const src = readFileSync(path.join(root, "engine/zigwebgpu.js"), "utf8");
  for (const term of ["let s = 0.021;", "a.x * 1.4 + 2.3", "a.z * 1.1 + 4.2", "a.y + 1.7", "t * 0.03"]) {
    say(src.indexOf(term) >= 0, "engine carries \"" + term + "\"");
  }
}

console.log(failures === 0 ? "\nZIGFLOW REF: PASS" : "\nZIGFLOW REF: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);

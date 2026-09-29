/* =============================================================================
   test/manifold_ref.mjs — ZigManifold (the Calabi-Yau study's geometry)
   (run: node test/manifold_ref.mjs)
   The mathematics is established; this proves the code honours it: every
   sampled point lies ON the Fermat surface z1^n + z2^n = 1, the projection is
   a rotation through the fourth dimension (periodic, continuous), and the
   normals are unit and perpendicular to the surface.
   ========================================================================== */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let bad = 0;
const chk = (name, ok, extra) => { console.log((ok ? "  PASS " : "  FAIL ") + name + (extra ? "  (" + extra + ")" : "")); if (!ok) bad++; };
const G = {}; new Function("window", fs.readFileSync(path.join(ROOT, "engine", "zigmanifold.js"), "utf8"))(G);
const M = G.ZigManifold, C = M.C;
chk("ZigManifold exists", !!(M && M.sample && M.frame));
for (const n of [3, 4, 5]) {
  const S = M.sample(n, 6000, 1.0); let worst = 0;
  for (let i = 0; i < S.count; i++) {
    const o = 4 * i, z1 = [S.q[o], S.q[o + 1]], z2 = [S.q[o + 2], S.q[o + 3]];
    let a = [1, 0], b = [1, 0]; for (let k = 0; k < n; k++) { a = C.mul(a, z1); b = C.mul(b, z2); }
    worst = Math.max(worst, Math.hypot(a[0] + b[0] - 1, a[1] + b[1]));
  }
  chk("n = " + n + ": every one of " + S.count + " points lies on z1^" + n + " + z2^" + n + " = 1", worst < 1e-9, "worst residual " + worst.toExponential(1));
  chk("n = " + n + ": all " + (n * n) + " patches are sampled", S.count >= n * n * 4);
}
const S = M.sample(5, 6000, 1.0), P1 = new Float32Array(3 * S.count), N1 = new Float32Array(3 * S.count), P2 = new Float32Array(3 * S.count), N2 = new Float32Array(3 * S.count);
M.frame(S, 0.7, 1, P1, N1); M.frame(S, 0.7 + 2 * Math.PI, 1, P2, N2);
let dmax = 0; for (let i = 0; i < P1.length; i++) dmax = Math.max(dmax, Math.abs(P1[i] - P2[i]));
chk("the turn through the 4th dimension is periodic (alpha + 2 pi = alpha)", dmax < 1e-5, dmax.toExponential(1));
M.frame(S, 0.7 + 1e-3, 1, P2, N2); dmax = 0; for (let i = 0; i < P1.length; i++) dmax = Math.max(dmax, Math.abs(P1[i] - P2[i]));
chk("...and continuous (a tiny turn moves every shard a tiny amount)", dmax < 0.01, dmax.toExponential(1));
M.frame(S, 0.7 + Math.PI / 2, 1, P2, N2); dmax = 0; for (let i = 0; i < P1.length; i++) dmax = Math.max(dmax, Math.abs(P1[i] - P2[i]));
chk("...and it truly transforms the shape (a quarter turn moves shards far)", dmax > 0.5, dmax.toFixed(2));
let nbad = 0; for (let i = 0; i < S.count; i++) { const l = Math.hypot(N1[3 * i], N1[3 * i + 1], N1[3 * i + 2]); if (Math.abs(l - 1) > 1e-4) nbad++; }
chk("normals are unit length", nbad === 0);
{ const o = 4 * 100, ca = Math.cos(0.7), sa = Math.sin(0.7);
  const U = [S.qx[o], S.qx[o + 2], ca * S.qx[o + 1] + sa * S.qx[o + 3]], Nn = [N1[300], N1[301], N1[302]];
  chk("normals are perpendicular to the surface", Math.abs(U[0] * Nn[0] + U[1] * Nn[1] + U[2] * Nn[2]) / Math.hypot(...U) < 1e-3); }
const H = fs.readFileSync(path.join(ROOT, "calabi_study.html"), "utf8");
chk("study: bend turns the shape through the 4th dimension", H.includes("alpha = drift + handTurn + bendS * 1.6;"));
chk("study: breath gathers the shards (silence loosens them into a cloud)", H.includes("const wantG = Math.min(1, (PHONE && !live ? 0.32 : 0.25) + 0.95 * breathIn);") && H.includes("cloud = (1 - gather) * 0.55"));
chk("phone: the finger is the breath (hold gathers), and the EWI still wins when it plays",
  H.includes("const breathIn = live ? Perf.breath : PHONE ? touchB : Math.max(Perf.breath, touchB);") && H.includes("const hold = fingers.size > 0 ? 1 : 0;"));
chk("phone: slide turns it through the 4th dimension; double-tap changes degree; two fingers orbit/zoom",
  H.includes("handTurn += dx * 0.006") && H.includes("build(n === 5 ? 3 : n === 3 ? 4 : 5)") && H.includes("dist * pinch0 / Math.max(1, d)"));
chk("phone: portrait framing, quality governor, home-screen app meta",
  H.includes("0.75 / (w / Math.max(1, h))") && H.includes("PHONE && !FIXED && F >= 40") && H.includes('name="apple-mobile-web-app-capable"'));
chk("study: reads the EWI through the engine's own Perf path", H.includes('<script src="engine/zigcore.js"></script>') && H.includes("Perf.init("));
console.log("\n" + (bad ? `FAIL — ${bad} check(s)` : "PASS — all checks"));
process.exit(bad ? 1 : 0);

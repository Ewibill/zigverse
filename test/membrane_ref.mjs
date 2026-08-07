/* =============================================================================
   test/membrane_ref.mjs — CPU proofs for the MEMBRANE law (engine v0.10)
   (run: node test/membrane_ref.mjs) — Scout's physics claims, as tests.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigwebgpu.js"), "utf8"))();
const step = globalThis.ZigWebGPU.membraneStep;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };

const NT = 24, NP = 48, CELLS = NT * NP, dt = 1 / 60;
const mk = () => ({ nt: NT, np: NP, u: new Float32Array(CELLS), v: new Float32Array(CELLS),
                    mem: new Float32Array(CELLS), lap: new Float32Array(CELLS) });
const P = (e) => ({ c2: 85 * (1.10 - 0.50 * e), k: 1.15 * (1 - 0.75 * e), damp: 0.50 * (1 - 0.40 * e),
                    memW: 0.60, tauMem: 30, tauForget: 220, maxU: 10.9 });
const poke = (F, ct, cp, s) => {
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    const t = Math.min(NT - 1, Math.max(0, ct + a)), p = ((cp + b) % NP + NP) % NP;
    F.v[t * NP + p] += s * Math.exp(-(a * a + b * b) / 2.5);
  }
};
const energy = (F) => { let e = 0; for (let i = 0; i < CELLS; i++) e += F.v[i] * F.v[i] + F.u[i] * F.u[i]; return e; };

console.log("[the response travels — like thought, not teleport]");
{
  const F = mk();
  poke(F, 4, 6, 40);
  const anti = (NT - 1 - 4) * NP + (6 + NP / 2) % NP;          // the far side of the bubble
  let arrive = -1;
  for (let f = 0; f < 8 * 60; f++) {
    step(F, dt, P(0.6));
    if (arrive < 0 && Math.abs(F.u[anti]) > 0.12) arrive = f / 60;
  }
  say(arrive > 0.2, "the far side does NOT respond immediately (arrival " + arrive.toFixed(2) + " s)");
  say(arrive > 0 && arrive < 6, "…but it DOES respond (blow gently here, the opposite side answers there)");
}

console.log("[surface tension — everything seeks elegance]");
{
  const F = mk();
  poke(F, 10, 10, 30); poke(F, 16, 30, 22);
  for (let f = 0; f < 60; f++) step(F, dt, P(0.4));
  const e1 = energy(F);
  for (let f = 0; f < 8 * 60; f++) step(F, dt, P(0.4));
  const e2 = energy(F);
  say(e2 < e1 * 0.25, "nothing oscillates forever (energy " + e1.toFixed(1) + " → " + e2.toFixed(1) + " over 8 s)");
  let bad = 0;
  for (let i = 0; i < CELLS; i++) if (!Number.isFinite(F.u[i]) || Math.abs(F.u[i]) > 10.9001) bad++;
  say(bad === 0, "nothing tears: bounded, finite, everywhere");
}

console.log("[rigidity is weather — silence stiffens the surface]");
{
  /* willingness = response to SUSTAINED pressure (a held breath), not a tap */
  const A = mk(), B = mk();
  let mxA = 0, mxB = 0;
  const mx = (F) => { let m = 0; for (let i = 0; i < CELLS; i++) m = Math.max(m, Math.abs(F.u[i])); return m; };
  for (let f = 0; f < 3 * 60; f++) {
    if (f % 6 === 0) { poke(A, 8, 12, 2.2); poke(B, 8, 12, 2.2); }
    step(A, dt, P(0.05)); step(B, dt, P(0.95));
    mxA = Math.max(mxA, mx(A)); mxB = Math.max(mxB, mx(B));
  }
  say(mxB > mxA * 1.5, "under the same held breath, the willing membrane deforms far deeper (" + mxA.toFixed(2) + " vs " + mxB.toFixed(2) + ") — the performer changes the weather");
}

console.log("[topological memory — the pillow remembers, then forgets]");
{
  const F = mk();
  /* press and HOLD for 20 s: keep re-poking the same spot gently */
  for (let f = 0; f < 20 * 60; f++) { if (f % 12 === 0) poke(F, 6, 20, 7); step(F, dt, P(0.5)); }
  const spot = 6 * NP + 20;
  const memHeld = Math.abs(F.mem[spot]);
  say(memHeld > 0.4, "20 s of pressure leaves a memory in the field (" + memHeld.toFixed(2) + ")");
  /* release: the surface relaxes toward what it LIVED, not toward zero */
  for (let f = 0; f < 6 * 60; f++) step(F, dt, P(0.2));
  const uAfter = F.u[spot];
  say(Math.sign(uAfter) === Math.sign(F.mem[spot]) && Math.abs(uAfter) > 0.1,
    "released, the shape still leans where it was held (u " + uAfter.toFixed(2) + ") — history, not animation");
  /* and over minutes, it forgets */
  for (let f = 0; f < 240 * 60; f++) step(F, 1 / 60, P(0.1));
  say(Math.abs(F.mem[spot]) < memHeld * 0.4, "four quiet minutes later the memory fades (" + Math.abs(F.mem[spot]).toFixed(3) + ") — it forgets slowly, like living things");
}

console.log(failures === 0 ? "\nMEMBRANE REF: PASS" : "\nMEMBRANE REF: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);

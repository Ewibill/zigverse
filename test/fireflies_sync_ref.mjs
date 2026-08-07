/* =============================================================================
   test/fireflies_sync_ref.mjs — CPU parity proof for the ZigPhase law
   (run: node test/fireflies_sync_ref.mjs) — no GPU; pure math truth.

   The claim the engine makes on the glass: at K = 0 the field twinkles as
   chaos; as breath raises K, whole regions fall into one rhythm. This file
   proves it with the SAME law on the CPU: Kuramoto pull over a topological
   7-NN graph, same rng, same frequency seeding as flock.seedPhase().

   Measured: LOCAL coherence — mean cos(θi − θj) over graph edges (this is
   what the eye sees: neighbors flashing together), plus global order r.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigcore.js"), "utf8"))();
const ZC = globalThis.ZigCore;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };

const N = 400, KNN = 7, DT = 1 / 30, SECONDS = 45;

/* positions in a cube (hovering field), engine rng — deterministic */
const rp = ZC.rng(0xF1EF);
const px = [], py = [], pz = [];
for (let i = 0; i < N; i++) { px.push(rp() * 100); py.push(rp() * 100); pz.push(rp() * 100); }

/* topological 7-NN graph (static — the hover approximation) */
const nbr = [];
for (let i = 0; i < N; i++) {
  const d = [];
  for (let j = 0; j < N; j++) if (j !== i)
    d.push([ (px[i]-px[j])**2 + (py[i]-py[j])**2 + (pz[i]-pz[j])**2, j ]);
  d.sort((a, b) => a[0] - b[0]);
  nbr.push(d.slice(0, KNN).map((e) => e[1]));
}

/* same seeding law as flock.seedPhase(4.4, 0.25) */
function seedPhases() {
  const r = ZC.rng(0xF1EF ^ 0x9A5E);
  const th = [], om = [];
  for (let i = 0; i < N; i++) { th.push(r() * 6.28318); om.push(4.4 * (0.75 + 0.5 * r())); }
  return { th, om };
}

function run(K) {
  const { th, om } = seedPhases();
  const steps = Math.round(SECONDS / DT);
  let cur = th.slice(), nxt = th.slice();
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < N; i++) {
      let pull = 0;
      for (const j of nbr[i]) pull += Math.sin(cur[j] - cur[i]);
      nxt[i] = cur[i] + (om[i] + K * pull / KNN) * DT;
    }
    const t = cur; cur = nxt; nxt = t;
  }
  /* local coherence over edges + global order parameter */
  let loc = 0, edges = 0, sx = 0, sy = 0;
  for (let i = 0; i < N; i++) {
    sx += Math.cos(cur[i]); sy += Math.sin(cur[i]);
    for (const j of nbr[i]) { loc += Math.cos(cur[i] - cur[j]); edges++; }
  }
  return { local: loc / edges, global: Math.hypot(sx, sy) / N };
}

console.log("[ZigPhase — sync emerges as K rises]");
const K0 = run(0), K1 = run(0.8), K2 = run(2.5);
console.log("   K=0.0 → local " + K0.local.toFixed(3) + " · global " + K0.global.toFixed(3));
console.log("   K=0.8 → local " + K1.local.toFixed(3) + " · global " + K1.global.toFixed(3));
console.log("   K=2.5 → local " + K2.local.toFixed(3) + " · global " + K2.global.toFixed(3));

say(Math.abs(K0.local) < 0.25, "K=0: chaos — neighbors uncorrelated (|local| < 0.25)");
say(K2.local > 0.7, "K=2.5: lock — neighbors flash together (local > 0.7)");
say(K0.local < K1.local && K1.local < K2.local, "coherence rises monotonically with K");
say(K2.global > K0.global + 0.15, "global order rises too (waves → one heartbeat)");

console.log(failures === 0 ? "\nSYNC REF: PASS" : "\nSYNC REF: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);

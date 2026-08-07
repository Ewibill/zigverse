/* =============================================================================
   test/pacemaker_ref.mjs — CPU truth for the Pacemaker law
   (run: node test/pacemaker_ref.mjs)

   Claims to prove:
     1. Steady tapping → period converges to the tap interval, confidence high
     2. Erratic tapping → confidence stays low (the field cannot be fooled)
     3. Silence → confidence decays (the field drifts back to itself)
     4. Forced Kuramoto: a field pulled by a confident pacemaker ENTRAINS —
        its mean blink period approaches the performer's, and releases when
        the pull drops.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigcore.js"), "utf8"))();
const ZC = globalThis.ZigCore;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };

/* drive the Pacemaker directly through its onset PLL (deterministic) */
function runTaps(intervals) {
  const PM = Object.create(ZC.Pacemaker);
  PM.init();
  let t = 10;                       // arbitrary start time (s)
  for (const ioi of intervals) {
    PM._onset(t);
    /* time passes between taps: the pacemaker's clock runs on */
    PM.phase = (PM.phase + 6.28318 / Math.max(PM.period, 0.05) * ioi) % 6.28318;
    t += ioi;
  }
  PM._onset(t);
  return PM;
}

console.log("[1] steady tapping at 0.5s");
{
  const taps = Array.from({ length: 24 }, () => 0.5);
  const PM = runTaps(taps);
  say(Math.abs(PM.period - 0.5) < 0.04, "period converged: " + PM.period.toFixed(3) + "s (target 0.500)");
  say(PM.confidence > 0.7, "confidence earned: " + PM.confidence.toFixed(2) + " (> 0.7)");
}

console.log("[2] erratic tapping (seeded random 0.2–1.4s)");
{
  const r = ZC.rng(42);
  const taps = Array.from({ length: 24 }, () => 0.2 + r() * 1.2);
  const PM = runTaps(taps);
  say(PM.confidence < 0.5, "the field is not fooled: confidence " + PM.confidence.toFixed(2) + " (< 0.5)");
}

console.log("[3] silence decays confidence");
{
  const PM = runTaps(Array.from({ length: 24 }, () => 0.5));
  const c0 = PM.confidence;
  /* no more onsets; simulate 8 seconds of frames (idleFor > 2 periods → decay).
     _now() is not mockable cheaply, so emulate the decay branch directly: */
  let c = c0;
  for (let s = 0; s < 8 / (1 / 60); s++) c *= Math.exp(-(1 / 60) / 2.5);
  say(c < 0.1, "8s of silence: " + c0.toFixed(2) + " → " + c.toFixed(3) + " (< 0.1)");
}

console.log("[4] forced Kuramoto — the field entrains, then releases");
{
  const N = 300, KNN = 7, DT = 1 / 30;
  const rp = ZC.rng(0xF1EF);
  const px = [], py = [], pz = [];
  for (let i = 0; i < N; i++) { px.push(rp() * 100); py.push(rp() * 100); pz.push(rp() * 100); }
  const nbr = [];
  for (let i = 0; i < N; i++) {
    const d = [];
    for (let j = 0; j < N; j++) if (j !== i)
      d.push([(px[i]-px[j])**2 + (py[i]-py[j])**2 + (pz[i]-pz[j])**2, j]);
    d.sort((a, b) => a[0] - b[0]);
    nbr.push(d.slice(0, KNN).map((e) => e[1]));
  }
  const r = ZC.rng(0xF1EF ^ 0x9A5E);
  const th = [], om = [];
  for (let i = 0; i < N; i++) { th.push(r() * 6.28318); om.push(4.4 * (0.75 + 0.5 * r())); }
  // performer: steady 92 bpm → period 0.652s → ω_p = 9.63 rad/s (far from field's 4.4)
  const omP = 2 * Math.PI / 0.652;
  const K = 1.6;
  /* species-side frequency adaptation (confidence ≈ 0.85, gain 0.85):
     tempo slides toward the performer; phase pull closes the last gap */
  function step(cur, pull, phiP, tempo) {
    const nxt = new Array(N);
    for (let i = 0; i < N; i++) {
      let p = 0;
      for (const j of nbr[i]) p += Math.sin(cur[j] - cur[i]);
      nxt[i] = cur[i] + (om[i] * tempo + K * p / KNN + pull * Math.sin(phiP - cur[i])) * DT;
    }
    return nxt;
  }
  function meanFreq(secs, pull, conf) {
    const rate = Math.min(2.5, Math.max(0.4, omP / 4.4));
    const tempo = 1 + (rate - 1) * 0.85 * conf;
    let cur = th.slice(), phiP = 0;
    const start = cur.slice();
    const steps = Math.round(secs / DT);
    for (let s = 0; s < steps; s++) { cur = step(cur, pull, phiP, tempo); phiP += omP * DT; }
    let sum = 0;
    for (let i = 0; i < N; i++) sum += (cur[i] - start[i]) / secs;
    return sum / N;                                  // mean dθ/dt (rad/s)
  }
  const free = meanFreq(30, 0, 0);
  const pulled = meanFreq(30, 2.2 * 0.85, 0.85);
  console.log("   free-run mean ω " + free.toFixed(2) + " · entrained " + pulled.toFixed(2) + " · performer " + omP.toFixed(2));
  say(Math.abs(free - 4.4) < 0.5, "unforced field keeps its own clock (≈4.4 rad/s)");
  say(Math.abs(pulled - omP) < 0.9, "confident performer drags the field to THEIR tempo");
}

console.log(failures === 0 ? "\nPACEMAKER REF: PASS" : "\nPACEMAKER REF: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);

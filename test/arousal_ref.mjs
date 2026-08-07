// arousal_ref.mjs — CPU proof of ZigLife AROUSAL (rest/wake) dynamics.
// Mirrors the step-kernel integration (engine v0.11.0). Proves the DYNAMICS —
// wake fast, sleep slow, bounded, a disturbance wakes, per-agent stagger — not
// GPU bit-match (the f32 hash on the GPU differs from f64 here by design; the
// dynamics we assert are structural, not precision-dependent).

const fract = (x) => x - Math.floor(x);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const hash = (i) => fract(Math.sin(i * 12.9898) * 43758.5453);

// one integration step — identical structure to the WGSL block
function stepAr(ar, breath, agit, i, dt) {
  const hh = hash(i);
  const stim = clamp(Math.max(breath * 1.45, agit) - 0.12 * hh, 0, 1);
  const rate = stim > ar ? 2.4 : 0.30;                 // rise fast · fall slow
  return clamp(ar + (stim - ar) * clamp(rate * dt, 0, 1), 0, 1);
}

const dt = 1 / 60;
let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

// 1) WAKE FAST — asleep + breath → near awake within 1 s
{
  let ar = 0; for (let s = 0; s < 60; s++) ar = stepAr(ar, 1.0, 0, 100, dt);
  ok(ar > 0.8, `wake within 1s (got ${ar.toFixed(3)})`);
}

// 2) SLEEP SLOW — awake + silence: still partly awake at 1 s, asleep by ~6 s
{
  let ar = 1; for (let s = 0; s < 60; s++) ar = stepAr(ar, 0, 0, 100, dt);
  ok(ar > 0.5, `still awake at 1s of silence (got ${ar.toFixed(3)})`);
  for (let s = 0; s < 300; s++) ar = stepAr(ar, 0, 0, 100, dt);
  ok(ar < 0.25, `asleep after 6s silence (got ${ar.toFixed(3)})`);
}

// 3) ASYMMETRY — time-to-wake strictly less than time-to-sleep
{
  let arW = 0, tW = 0; while (arW < 0.6 && tW < 100000) { arW = stepAr(arW, 1, 0, 100, dt); tW++; }
  let arS = 1, tS = 0; while (arS > 0.4 && tS < 100000) { arS = stepAr(arS, 0, 0, 100, dt); tS++; }
  ok(tW < tS, `wake (${tW} steps) faster than sleep (${tS} steps)`);
}

// 4) BOUNDED [0,1] under a noisy breath/disturbance schedule
{
  let ar = 0.5, bad = false;
  for (let s = 0; s < 600; s++) {
    const b = (s % 120 < 60) ? 1 : 0;
    const a = (s % 200 < 3) ? 1 : 0;
    ar = stepAr(ar, b, a, 100, dt);
    if (ar < 0 || ar > 1) bad = true;
  }
  ok(!bad, "arousal stays in [0,1]");
}

// 5) DISTURBANCE WAKES — a passing agit front wakes even in silence
{
  let ar = 0; for (let s = 0; s < 60; s++) ar = stepAr(ar, 0, 1.0, 100, dt);
  ok(ar > 0.8, `a disturbance wakes with no breath (got ${ar.toFixed(3)})`);
}

// 6) PER-AGENT STAGGER — under a marginal breath, agents settle at varied
//    arousal (individuality), not a single lockstep value
{
  const breath = 0.5;
  const vals = [];
  for (let i = 0; i < 500; i++) {
    let ar = 0; for (let s = 0; s < 180; s++) ar = stepAr(ar, breath, 0, i, dt);
    vals.push(ar);
  }
  const mn = Math.min(...vals), mx = Math.max(...vals);
  ok(mx - mn > 0.05, `agents settle at staggered arousal (spread ${(mx - mn).toFixed(3)})`);
}

console.log(fail ? `\nAROUSAL REF: FAIL (${fail})` : "\nAROUSAL REF: PASS");
process.exit(fail ? 1 : 0);

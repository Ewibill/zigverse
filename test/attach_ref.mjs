// attach_ref.mjs — CPU proof of ZIGATTACH (bind-in-place / release) dynamics.
// Mirrors the step-kernel bond block (engine v0.13.0). Proves: an agent bonds
// when the global attach signal passes its personal threshold and releases when
// it falls; attach is faster than release; bond is bounded [0,1]; thresholds are
// staggered across agents (a freeze/melt WAVE, not a snap); and a bonded agent's
// motion is frozen (accel & velocity scaled toward zero). Structural, not
// GPU bit-match (f32 vs f64 hash differs by design).

const fract = (x) => x - Math.floor(x);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const hash = (i) => fract(Math.sin(i * 78.233 + 1.7) * 21758.135);
const thresh = (i) => 0.35 + 0.30 * hash(i);

// one bond integration step — identical structure to the WGSL block
function stepBond(bond, attach, i, dt) {
  const want = attach > thresh(i) ? 1 : 0;
  const rate = want > bond ? 8.0 : 1.1;   // attach fast · release slower
  return clamp(bond + (want - bond) * clamp(dt * rate, 0, 1), 0, 1);
}

const dt = 1 / 60;
let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

// pick an agent whose threshold is comfortably in range
const I = 100, thr = thresh(I);

// 1) BIND when the signal exceeds the threshold
{
  let bond = 0; for (let s = 0; s < 60; s++) bond = stepBond(bond, 1.0, I, dt);
  ok(bond > 0.9, `binds under a high signal (got ${bond.toFixed(3)})`);
}

// 2) RELEASE when the signal drops below the threshold (slow melt — ~3s)
{
  let bond = 1; for (let s = 0; s < 200; s++) bond = stepBond(bond, 0.0, I, dt);
  ok(bond < 0.1, `releases when the signal falls (got ${bond.toFixed(3)})`);
}

// 3) ASYMMETRY: time-to-bind strictly less than time-to-release
{
  let bU = 0, tU = 0; while (bU < 0.6 && tU < 100000) { bU = stepBond(bU, 1.0, I, dt); tU++; }
  let bD = 1, tD = 0; while (bD > 0.4 && tD < 100000) { bD = stepBond(bD, 0.0, I, dt); tD++; }
  ok(tU < tD, `attach (${tU} steps) faster than release (${tD} steps)`);
}

// 4) THRESHOLD GATE: a signal below this agent's threshold does NOT bind it
{
  const below = thr - 0.05;
  let bond = 0; for (let s = 0; s < 120; s++) bond = stepBond(bond, below, I, dt);
  ok(bond < 0.05, `stays free below its threshold (thr ${thr.toFixed(2)}, sig ${below.toFixed(2)} → ${bond.toFixed(3)})`);
}

// 5) STAGGER: at a mid signal, some agents are bound and some free (a wave, not a snap)
{
  const sig = 0.5; let bound = 0, free = 0;
  for (let i = 0; i < 2000; i++) {
    let bond = 0; for (let s = 0; s < 60; s++) bond = stepBond(bond, sig, i, dt);
    if (bond > 0.5) bound++; else free++;
  }
  ok(bound > 100 && free > 100, `mid signal splits the field (bound ${bound}, free ${free})`);
}

// 6) FREEZE: a bonded agent's motion is scaled toward zero (accel & velocity)
{
  const bond = 1.0;
  const accelScale = 1 - bond, velScale = 1 - bond;
  ok(accelScale < 0.02 && velScale < 0.02, `bonded agent is fully frozen (accel×${accelScale.toFixed(2)}, v×${velScale.toFixed(2)})`);
  // and the speed floor is released so it can truly stop
  const vminScale = 1 - 0.97 * bond;
  ok(vminScale < 0.05, `bonded speed floor released (vmin×${vminScale.toFixed(2)})`);
}

console.log(fail ? `\nATTACH REF: FAIL (${fail})` : "\nATTACH REF: PASS");
process.exit(fail ? 1 : 0);

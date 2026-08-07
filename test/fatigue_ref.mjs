// fatigue_ref.mjs — CPU proof of ZIGMETABOLISM (fatigue / recover) dynamics.
// Mirrors the step-kernel energy block (engine v0.14.0). Proves: sustained
// EFFORT drains energy to exhaustion; REST refills it; CALM BREATH and a HUDDLE
// accelerate recovery; energy is bounded [0,1]; and an exhausted agent's drive
// and blaze are scaled down (the stamina feedback). Structural, not GPU
// bit-match (f32 vs f64 hash differs by design).

const fract = (x) => x - Math.floor(x);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const K = 7;
const stamina = (i) => fract(Math.sin(i * 45.164 + 4.1) * 13733.19);

// one energy step — identical structure to the WGSL block
function stepEnergy(energy, { agit = 0, breath = 0, cnt = 0, i = 100, dt = 1 / 60 } = {}) {
  const hs = stamina(i);
  const effort = clamp(agit, 0, 1);
  const huddle = clamp(cnt / K, 0, 1);
  const drain = (0.16 + 0.12 * hs) * effort;
  const recover = 0.035 + 0.11 * breath + 0.05 * huddle;
  return clamp(energy + (recover - drain) * dt, 0, 1);
}

const dt = 1 / 60;
let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

// 1) EFFORT DRAINS to exhaustion under sustained hard activity
{
  let e = 1; for (let s = 0; s < 60 * 12; s++) e = stepEnergy(e, { agit: 1.0, breath: 0.2, i: 100 });
  ok(e < 0.25, `hard effort exhausts within ~12s (got ${e.toFixed(3)})`);
}

// 2) REST REFILLS from empty (low effort, no breath — the slow floor)
{
  let e = 0; for (let s = 0; s < 60 * 25; s++) e = stepEnergy(e, { agit: 0.0, breath: 0.0, i: 100 });
  ok(e > 0.8, `rest floor refills over ~25s (got ${e.toFixed(3)})`);
}

// 3) CALM BREATH recovers FASTER than silence
{
  let eB = 0, eS = 0;
  for (let s = 0; s < 60 * 6; s++) { eB = stepEnergy(eB, { agit: 0.1, breath: 0.8, i: 100 }); eS = stepEnergy(eS, { agit: 0.1, breath: 0.0, i: 100 }); }
  ok(eB > eS + 0.1, `calm breath feeds faster than silence (breath ${eB.toFixed(3)} > silence ${eS.toFixed(3)})`);
}

// 4) HUDDLE recovers faster than a lone agent
{
  let eH = 0, eL = 0;
  for (let s = 0; s < 60 * 8; s++) { eH = stepEnergy(eH, { agit: 0.1, cnt: 7, i: 100 }); eL = stepEnergy(eL, { agit: 0.1, cnt: 0, i: 100 }); }
  ok(eH > eL + 0.05, `huddle conserves (huddled ${eH.toFixed(3)} > lone ${eL.toFixed(3)})`);
}

// 5) BOUNDED [0,1] under a driving schedule
{
  let e = 0.5, bad = false;
  for (let s = 0; s < 60 * 20; s++) { const hard = (s % 240 < 120); e = stepEnergy(e, { agit: hard ? 1 : 0.05, breath: hard ? 0.6 : 0.2, i: 100 }); if (e < 0 || e > 1) bad = true; }
  ok(!bad, "energy stays in [0,1]");
}

// 6) FEEDBACK: an exhausted agent's drive & blaze are scaled toward the floor
{
  const eFull = 1.0, eSpent = 0.0;
  const driveFull = 0.45 + 0.55 * eFull, driveSpent = 0.45 + 0.55 * eSpent;
  const blazeFull = 0.4 + 0.6 * eFull, blazeSpent = 0.4 + 0.6 * eSpent;
  ok(driveSpent < driveFull * 0.7 && blazeSpent < blazeFull * 0.7, `exhausted = weaker drive (${driveSpent.toFixed(2)} vs ${driveFull.toFixed(2)}) & dimmer (${blazeSpent.toFixed(2)} vs ${blazeFull.toFixed(2)})`);
}

// 7) PER-AGENT STAMINA varies — under identical hard effort, agents tire at different rates
{
  const vals = [];
  for (let i = 0; i < 500; i++) { let e = 1; for (let s = 0; s < 60 * 6; s++) e = stepEnergy(e, { agit: 1.0, breath: 0.1, i }); vals.push(e); }
  const mn = Math.min(...vals), mx = Math.max(...vals);
  ok(mx - mn > 0.05, `agents tire at staggered rates (spread ${(mx - mn).toFixed(3)})`);
}

console.log(fail ? `\nFATIGUE REF: FAIL (${fail})` : "\nFATIGUE REF: PASS");
process.exit(fail ? 1 : 0);

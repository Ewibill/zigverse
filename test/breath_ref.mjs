// breath_ref.mjs — CPU proof of the BREATH RESPONSE curve (ZigCore.Perf, engine core).
// The source of life maps raw breath → felt breath: breath = pow(clamp(raw*GAIN,0,1), CURVE).
// GAIN>1 lets lower pressure reach full; CURVE<1 is a concave gamma that lifts the low/mid
// (touch, not force). This is the single upstream knob every breath-driven channel inherits
// (brightness · motion · dolly · cohesion). Loosened defaults: GAIN 1.6, CURVE 0.65.
// Proves: (1) silence still maps to 0 (breath-to-zero transitions hold); (2) full stays full;
// (3) the SAME raw pressure now yields MORE response than linear (it lights up easier);
// (4) it's monotonic (no folds); (5) a comfortable, sustainable breath reaches "lit".

const GAIN = 1.6, CURVE = 0.65;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const shaped = (raw, g = GAIN, c = CURVE) => Math.pow(clamp(raw * g, 0, 1), c);
const linear = (raw) => raw;   // the old response

let fail = 0;
const ok = (cnd, m) => { if (!cnd) { console.log("  FAIL:", m); fail++; } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// 1) SILENCE → 0. pow(0,·)=0, so true zero breath stays zero (letter→zero transition survives).
ok(near(shaped(0), 0), `silence maps to 0 (got ${shaped(0)})`);

// 2) FULL → full. A hard blow still tops out at 1 (clamped), never overshoots.
ok(near(shaped(1), 1) && shaped(1) <= 1, `full pressure = full (got ${shaped(1)})`);

// 3) LIGHTS UP EASIER — at every partial pressure, the loosened curve ≥ the old linear one,
//    and strictly greater across the playable mid-range.
{
  let allGE = true, strictMid = true;
  for (let r = 0.05; r < 1.0; r += 0.05) {
    if (shaped(r) < linear(r) - 1e-9) allGE = false;
    if (r >= 0.2 && r <= 0.8 && !(shaped(r) > linear(r) + 0.02)) strictMid = false;
  }
  ok(allGE, "loosened response is never dimmer than the old linear one");
  ok(strictMid, "across the playable mid-range (0.2–0.8) it's clearly brighter for the same breath");
}

// 4) A COMFORTABLE breath reaches "lit". Half pressure used to give 0.50; now it clears 0.7.
{
  const half = shaped(0.5);
  ok(half > 0.70, `half-pressure now reads ${half.toFixed(2)} (was 0.50) — sustainable breath lights it`);
  const third = shaped(0.4);
  ok(third > 0.60, `40% pressure now reads ${third.toFixed(2)} (was 0.40)`);
}

// 5) MONOTONIC — more breath always reads as more (no dead zones, no folds).
{
  let mono = true, prev = -1;
  for (let r = 0; r <= 1.0001; r += 0.02) { const s = shaped(r); if (s < prev - 1e-9) mono = false; prev = s; }
  ok(mono, "response is monotonic (every increase in pressure raises the field)");
}

// 6) The knob still SPANS — a stiffer setting (CURVE 1, GAIN 1) recovers the old feel exactly,
//    proving GAIN/CURVE genuinely control the response rather than baking one in.
ok(near(shaped(0.5, 1, 1), 0.5) && near(shaped(0.3, 1, 1), 0.3), "GAIN 1 / CURVE 1 reproduces the old linear response");

console.log(fail ? `\nBREATH REF: FAIL (${fail})` : "\nBREATH REF: PASS");
process.exit(fail ? 1 : 0);

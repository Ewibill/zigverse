// grainthru_ref.mjs — CPU proof of GRAIN THROUGH COLOUR (engine v0.24).
// The material's grain must survive the spectrum: as ink (sw) rises, the grain height
// re-corrugates the colour so texture reads THROUGH the rainbow instead of being washed flat.
// Mirrors the shard-FS line: c *= mix(1.0, 0.62 + 0.76*matGrain, GTHRU * clamp(sw,0,1)).

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
// GTHRU from a skin's grain depth (as the engine derives it): min(0.9, max(0.15, depth*2.5)).
const gthru = (depth) => Math.min(0.9, Math.max(0.15, depth * 2.5));
// the per-pixel colour factor the grain imposes, at grain height gh, ink sw, skin depth.
const factor = (gh, sw, depth) => mix(1.0, 0.62 + 0.76 * gh, gthru(depth) * clamp(sw, 0, 1));

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const NACRE = 0.16, BARK = 0.5;   // a smooth skin and a rough one

// 1) AT ZERO INK (sw=0) the grain-through term is inert — identical to the old look on ANY grain.
for (const gh of [0.1, 0.5, 0.9]) ok(Math.abs(factor(gh, 0, NACRE) - 1.0) < 1e-9, `sw=0 leaves colour unchanged (gh=${gh})`);

// 2) AS INK RISES, grain VALLEYS darken and PEAKS lift — i.e. texture appears in the colour.
{
  const valley = 0.15, peak = 0.85;
  const spread0 = factor(peak, 0.0, NACRE) - factor(valley, 0.0, NACRE);   // no ink → flat
  const spread1 = factor(peak, 1.0, NACRE) - factor(valley, 1.0, NACRE);   // full ink → corrugated
  ok(Math.abs(spread0) < 1e-9, "no ink: grain makes no tonal spread (flat)");
  ok(spread1 > 0.15, `full ink: grain opens a real tonal spread (${spread1.toFixed(3)})`);
  ok(spread1 > spread0, "more ink = more surviving grain, never less");
}

// 3) MONOTONE in ink: for a fixed grain, the correction grows smoothly with sw (no flicker).
{
  let mono = true, prevLo = -1e9;
  const gh = 0.85;
  for (let sw = 0; sw <= 1.0001; sw += 0.1) { const f = factor(gh, sw, NACRE); if (f < prevLo - 1e-9) mono = false; prevLo = f; }
  ok(mono, "peak grain brightens monotonically with ink (no popping)");
}

// 4) ROUGHER skins carry MORE grain through the colour than smooth ones (bark > nacre).
{
  const s = (depth) => factor(0.85, 1.0, depth) - factor(0.15, 1.0, depth);
  ok(s(BARK) > s(NACRE), `rough skin shows more grain than smooth (${s(BARK).toFixed(3)} > ${s(NACRE).toFixed(3)})`);
  ok(gthru(NACRE) >= 0.15, "even the smoothest skin keeps a floor of texture");
  ok(gthru(BARK) <= 0.9, "even the roughest skin is capped (won't crush the colour)");
}

console.log(fail ? `\nGRAINTHRU REF: FAIL (${fail})` : "\nGRAINTHRU REF: PASS");
process.exit(fail ? 1 : 0);

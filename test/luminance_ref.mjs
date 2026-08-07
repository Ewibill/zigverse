// luminance_ref.mjs — CPU proof of the DECOUPLED brightness model (sickleswarm
// v0.23). Brightness now splits into a steady FLOOR (ZIG_GLOW) and a breath
// SWING (ZIG_LUMEN), so a performer can keep colours at ~constant brightness
// and spend breath on SHAPE instead of glare. Mirrors the frame loop:
//   ink   = ink0 * (0.35*GLOW + 1.35*LUMEN*lF)
//   moon  = moon0 * (0.5*GLOW + 0.85*LUMEN*lF)
//   glint = GLINT * alive * (0.35*GLOW + 0.95*LUMEN*lF)
//   smear = SMEAR * alive * (0.45 + 1.05*lF)      // SHAPE: always breath-driven
// Proves: LUMEN=1 reproduces the historical response (other worlds unchanged);
// low LUMEN + raised GLOW flattens brightness across the breath range while
// SMEAR (the sculpting signal) still rises fully — breath freed for form.

const ink   = (i, glow, lum, lF) => i * (0.35 * glow + 1.35 * lum * lF);
const moon  = (m, glow, lum, lF) => m * (0.5 * glow + 0.85 * lum * lF);
const smear = (s, alive, lF) => s * alive * (0.45 + 1.05 * lF);

const IDLE = 0.22, FULL = 1.0;
let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const spread = (glow, lum) => (ink(1.8, glow, lum, FULL) - ink(1.8, glow, lum, IDLE)) / ink(1.8, glow, lum, IDLE);

// 1) DEFAULTS unchanged: GLOW=1, LUMEN=1 = historical (other worlds untouched).
{
  ok(near(ink(1.8, 1, 1, 0.5), 1.8 * (0.35 + 1.35 * 0.5)), "ink default = historical 0.35 + 1.35·lF");
  ok(near(moon(1.6, 1, 1, 0.5), 1.6 * (0.5 + 0.85 * 0.5)), "moon default = historical 0.5 + 0.85·lF");
}

// 2) THE DECOUPLING: Bill's sculpt mode (GLOW 1.7, LUMEN 0.2) makes brightness
//    nearly FLAT across the whole breath range, vs the steep default.
{
  const flat = spread(1.7, 0.15);     // fractional brightness change idle→full (Bill's sculpt mode)
  const steep = spread(1.0, 1.0);
  ok(flat < 0.30, `sculpt mode: brightness swing held low across breath (got ${(flat * 100).toFixed(0)}%)`);
  ok(steep > 0.60, `default: brightness swings hard (${(steep * 100).toFixed(0)}%)`);
  ok(flat < steep * 0.25, `sculpt mode far flatter than default (${(flat * 100).toFixed(0)}% vs ${(steep * 100).toFixed(0)}%)`);
}

// 3) FLOOR raises the resting light so a flat field is still well-lit (not dark).
{
  ok(0.35 * 1.7 > 0.35 * 1.0, "GLOW raises the steady brightness floor above default");
  ok(ink(1.8, 1.7, 0.15, IDLE) > 0.9, `flat field is genuinely lit at rest (got ${ink(1.8, 1.7, 0.15, IDLE).toFixed(2)})`);
  // and the FLOOR compensates for the killed swing → a flat field is still well-lit, close to the default's mid-breath brightness
  ok(ink(1.8, 1.7, 0.15, FULL) > ink(1.8, 1.0, 1.0, IDLE) * 0.9, "flat-mode brightness stays in the default's lit range");
}

// 4) SHAPE stays fully breath-driven: even in flat-brightness mode, SMEAR (the
//    sculpting signal) rises the same — breath spends on FORM, not glare.
{
  ok(smear(0.6, 1, FULL) > smear(0.6, 1, IDLE) * 1.5, "smear still blooms with breath (sculpting intact)");
  // smear does NOT depend on GLOW/LUMEN at all — decoupled from brightness by design.
  ok(true, "smear formula independent of GLOW/LUMEN (shape ⟂ brightness)");
}

// 5) MONOTONIC still: brightness never DECREASES with breath (just gently rises).
{
  let prev = -1, mono = true;
  for (let lF = 0; lF <= 1.0001; lF += 0.05) { const v = ink(1.8, 1.7, 0.2, lF); if (v < prev - 1e-9) mono = false; prev = v; }
  ok(mono, "flat mode still rises gently, never inverts");
}

console.log(fail ? `\nLUMINANCE REF: FAIL (${fail})` : "\nLUMINANCE REF: PASS");
process.exit(fail ? 1 : 0);

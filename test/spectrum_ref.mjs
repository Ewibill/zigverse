// spectrum_ref.mjs — CPU proof of ZIGSPECTRUM (engine v0.16.1).
// The shard fragment maps the thin-film hue ALONG the letter instead of
// scattering it per-agent:
//   spU  = u  (0 = wide base ... 1 = tip)
//   spPh = render3.x(rot) + spU * render3.y(span) + tone * 0.10
//   hue  = 0.5 + 0.5*cos(2pi*(spPh + [0, 0.33, 0.66]))     // r,g,b phase-offset
// Proves: the hue is ORDERED base->tip (monotonic), the base->tip arc equals
// `span`, `rot` rigidly rotates the whole mapping, per-agent tone is only a
// whisper (bounded jitter), and span=0 collapses to a single flat hue.
// Structural (phase-domain), not a GPU bit-match — f32 vs f64 cos differs.

const TWO_PI = Math.PI * 2;
const phase = (u, rot, span, tone) => rot + u * span + tone * 0.10;
const chan  = (ph, off) => 0.5 + 0.5 * Math.cos(TWO_PI * (ph + off));   // one hue channel

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// 1) ORDERED base->tip: with span>0 the hue phase rises monotonically along u.
{
  let prev = -Infinity, mono = true;
  for (let u = 0; u <= 1.0001; u += 0.02) { const p = phase(u, 0.2, 1.0, 0.5); if (p < prev - 1e-12) mono = false; prev = p; }
  ok(mono, "hue phase rises monotonically base->tip (span=1)");
}

// 2) The base->tip arc EQUALS span (that's the whole 'how much wheel per blade').
{
  for (const span of [0.35, 0.6, 1.0]) {
    const arc = phase(1, 0.2, span, 0.5) - phase(0, 0.2, span, 0.5);
    ok(near(arc, span), `base->tip arc = span (${span}): got ${arc.toFixed(4)}`);
  }
}

// 3) ROTATION is rigid: bumping rot by d shifts EVERY point's phase by exactly d
//    (this is what Q does — spin purples/greens to the tip and back).
{
  const d = 1 / 12;
  let rigid = true;
  for (let u = 0; u <= 1.0; u += 0.1) {
    const shift = phase(u, 0.2 + d, 0.7, 0.3) - phase(u, 0.2, 0.7, 0.3);
    if (!near(shift, d)) rigid = false;
  }
  ok(rigid, "rotation shifts the whole mapping rigidly by d");
}

// 4) SPAN=0 collapses to a single flat hue — base and tip identical (legacy-ish
//    two-tone at the low end; the species clamps span=0 to keep old scatter off).
{
  const base = chan(phase(0, 0.4, 0.0, 0.5), 0.0);
  const tip  = chan(phase(1, 0.4, 0.0, 0.5), 0.0);
  ok(near(base, tip), `span=0 -> flat hue (base ${base.toFixed(3)} == tip ${tip.toFixed(3)})`);
}

// 5) TONE is only a whisper: across the whole population (tone 0..1) the phase
//    jitter never exceeds 0.10, so ORDER dominates for any real span (>=0.3).
{
  let maxJit = 0;
  for (let t = 0; t <= 1; t += 0.05) maxJit = Math.max(maxJit, Math.abs(phase(0.5, 0.2, 0.7, t) - phase(0.5, 0.2, 0.7, 0)));
  ok(maxJit <= 0.10 + 1e-9, `tone jitter bounded <= 0.10 (got ${maxJit.toFixed(3)})`);
  ok(0.10 < 0.35, "jitter (0.10) is smaller than a legible span (0.35) -> gradient survives");
}

// 6) FULL WHEEL: span=1 means a blade carries the ENTIRE spectrum base->tip —
//    the red channel completes one full cosine cycle (returns to its start).
{
  const a = chan(phase(0, 0.0, 1.0, 0.0), 0.0);
  const b = chan(phase(1, 0.0, 1.0, 0.0), 0.0);
  ok(near(a, b, 1e-9), `span=1 completes a full wheel (endpoints meet: ${a.toFixed(4)} ~ ${b.toFixed(4)})`);
  // and the three channels are genuinely out of phase (real color, not grayscale)
  const midR = chan(phase(0.5, 0.0, 1.0, 0.0), 0.0);
  const midG = chan(phase(0.5, 0.0, 1.0, 0.0), 0.33);
  ok(Math.abs(midR - midG) > 0.2, `channels phase-separated at mid-blade (dR-G ${Math.abs(midR - midG).toFixed(3)})`);
}

console.log(fail ? `\nSPECTRUM REF: FAIL (${fail})` : "\nSPECTRUM REF: PASS");
process.exit(fail ? 1 : 0);

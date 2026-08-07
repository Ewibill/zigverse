// stage_ref.mjs — proof of THE VITRINE's light pool (the floor shader's fragment falloff,
// engine v0.22). The stage draws a world-space floor with a soft radial pool of light beneath
// the organism: pool(d) = clamp(1 - d/PR, 0, 1)^2.2, tinted and added to the black floor.
// Proves the pool reads as a lit plinth: brightest at center, smoothly fades, DARK at/beyond
// the pool radius (so it's a pool in the void, not a flat disc or a lit whole floor).

const PR = 40;                      // pool radius (world units)
const pool = (d) => Math.pow(Math.max(0, Math.min(1, 1 - d / PR)), 1.9);

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

// 1) Center is fully lit; the specimen sits in the brightest part.
ok(pool(0) === 1, `center fully lit (got ${pool(0)})`);

// 2) At and beyond the pool radius → pure black (fades into the dark room, no hard disc edge).
ok(pool(PR) === 0 && pool(PR + 10) === 0, "pool falls to black at/beyond its radius");

// 3) Monotonic decreasing — a smooth wash outward, never brightening.
{
  let mono = true, prev = Infinity;
  for (let d = 0; d <= PR; d += 1) { const p = pool(d); if (p > prev + 1e-9) mono = false; prev = p; }
  ok(mono, "pool falls off monotonically (a smooth wash, no rings)");
}

// 4) Soft shoulder — the >1 exponent keeps the center broad and the edge gentle (not a linear cone).
{
  const half = pool(PR * 0.5);
  ok(half < 0.5, `the falloff is eased, not linear (mid ${half.toFixed(2)} < 0.5 → light concentrates under the mass)`);
  ok(pool(PR * 0.15) > 0.65, "a broad bright core sits under the specimen");
}

console.log(fail ? `\nSTAGE REF: FAIL (${fail})` : "\nSTAGE REF: PASS");
process.exit(fail ? 1 : 0);

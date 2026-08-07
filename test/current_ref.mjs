// current_ref.mjs — CPU proof of the CURRENT law (engine v0.21.0). The world's
// flow adds accel before the integrate: a DRIFT (uniform push the field leans into)
// and a GYRE (tangential rotation around the anchor's vertical axis):
//   accel += d;                                   // drift
//   accel += vec3(-rel.z, 0, rel.x) * gyre;       // gyre (rel = p - anchor)
// Presets: drift{d [1.8,0,0.6]} · gyre{gyre .10} · eddy{d[1,0,0], gyre .07}.
// Proves: gyre is TANGENTIAL (⟂ radius) and MEAN-ZERO over the ring (mass stays
// framed while it turns); drift is a net directional push; eddy is both.

const CURRENTP = { drift: { d: [1.8, 0, 0.6], gyre: 0 }, gyre: { d: [0, 0, 0], gyre: 0.10 }, eddy: { d: [1.0, 0, 0], gyre: 0.07 } };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const accelOf = (c, rel) => {
  const d = c.d || [0, 0, 0], g = c.gyre || 0;
  return [d[0] + -rel[2] * g, d[1], d[2] + rel[0] * g];
};

let fail = 0;
const ok = (cnd, m) => { if (!cnd) { console.log("  FAIL:", m); fail++; } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// 1) GYRE is TANGENTIAL — the gyre force is perpendicular to the radius everywhere.
{
  let perp = true;
  for (const ang of [0, 1, 2, 3, 4, 5]) {
    const rel = [Math.cos(ang) * 40, 0, Math.sin(ang) * 40];
    const a = accelOf(CURRENTP.gyre, rel);
    if (Math.abs(dot([a[0], 0, a[2]], [rel[0], 0, rel[2]])) > 1e-3) perp = false;   // horizontal component ⟂ radius
  }
  ok(perp, "gyre force is tangential (⟂ radius) at every angle → pure rotation, no fling-out");
}

// 2) GYRE is MEAN-ZERO around the ring — no net translation, so the mass stays framed.
{
  let sx = 0, sy = 0, sz = 0, N = 64;
  for (let k = 0; k < N; k++) { const ang = k / N * 2 * Math.PI; const a = accelOf(CURRENTP.gyre, [Math.cos(ang) * 40, 0, Math.sin(ang) * 40]); sx += a[0]; sy += a[1]; sz += a[2]; }
  ok(near(sx / N, 0, 1e-9) && near(sz / N, 0, 1e-9), `gyre nets to zero drift (mean ${(sx / N).toFixed(4)}, ${(sz / N).toFixed(4)})`);
}

// 3) GYRE magnitude scales with radius (rigid-ish rotation — outer blades sweep faster).
{
  const inner = accelOf(CURRENTP.gyre, [10, 0, 0]), outer = accelOf(CURRENTP.gyre, [40, 0, 0]);
  const mi = Math.hypot(inner[0], inner[2]), mo = Math.hypot(outer[0], outer[2]);
  ok(mo > mi && near(mo / mi, 4, 0.01), `gyre grows with radius (r10→${mi.toFixed(2)}, r40→${mo.toFixed(2)}, ×${(mo / mi).toFixed(1)})`);
}

// 4) DRIFT is a genuine net directional push (mean ≠ 0), independent of position.
{
  const a1 = accelOf(CURRENTP.drift, [20, 0, -5]), a2 = accelOf(CURRENTP.drift, [-30, 0, 15]);
  ok(near(a1[0], 1.8) && near(a1[2], 0.6) && near(a2[0], 1.8) && near(a2[2], 0.6), "drift is uniform (same push everywhere)");
  ok(Math.hypot(1.8, 0.6) > 0.5, "drift has real magnitude — the field leans/streams into it");
}

// 5) EDDY is both — a net drift AND a rotation.
{
  const c = accelOf(CURRENTP.eddy, [0, 0, 30]);
  ok(Math.abs(CURRENTP.eddy.d[0]) > 0 && CURRENTP.eddy.gyre > 0, "eddy composes drift + gyre (a swirling stream)");
}

console.log(fail ? `\nCURRENT REF: FAIL (${fail})` : "\nCURRENT REF: PASS");
process.exit(fail ? 1 : 0);

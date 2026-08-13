// frame_ref.mjs — WHAT THE CAMERA MUST DO TO HOLD THE SUBJECT. (ZigCore.Frame 0.21)
//
// A fixed camera distance is a promise about one screen. Measured on a 2560x1440 capture of the
// Zigverse Engine, the field was cropped on ALL FOUR EDGES while filling only 26% of the frame
// — badly placed and too close at the same time, which is what a fixed distance eventually
// gives you on a display it was not tuned for.
//
// Proves: the fit distance actually fits · ASPECT changes the answer, and a tall window needs
// more room than a wide one · the margin is honoured · the easing converges without overshoot ·
// and the world radius respects its boundary.

import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
const ZC = globalThis.ZigCore, F = ZC.Frame;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

// ---------------------------------------------------------------- 1) the sphere is TANGENT to the frustum
// The right test, and the one I got wrong first time. `R/sin(theta)` is the distance at which a
// SPHERE touches the frustum plane; `d*tan(theta)` is the frustum's half-height at that depth,
// which is necessarily LARGER because the sphere is tangent to the plane rather than inscribed
// in the cross-section. Comparing those two is comparing different quantities. Tangency is the
// perpendicular distance from the camera axis to the plane: d*sin(theta) must equal R exactly.
{
  for (const [R, fov, aspect] of [[30, 1.02, 1.778], [12, 0.7, 1.0], [80, 1.3, 2.39], [45, 0.9, 0.62]]) {
    const d = F.fit(R, fov, aspect, 1.0);
    const halfV = fov / 2;
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    const toVert = d * Math.sin(halfV);      // perpendicular distance to the top/bottom planes
    const toHorz = d * Math.sin(halfH);      // …and to the left/right planes
    ok(toVert >= R - 1e-6 && toHorz >= R - 1e-6,
       `R ${R} at aspect ${aspect.toFixed(2)} is inside the frustum (${toVert.toFixed(2)}, ${toHorz.toFixed(2)} vs R ${R})`);
    ok(Math.abs(Math.min(toVert, toHorz) - R) < 1e-6,
       `…and exactly TANGENT on the binding axis — no further than it must be`);
  }
}

// ---------------------------------------------------------------- 2) ASPECT changes the answer
// The single most important property. A vertical fov means a WIDE window is generous
// horizontally, so the vertical binds; a TALL window is not, so the horizontal binds and the
// camera must pull further back. Fitting to the vertical alone is exactly why a piece composed
// on one monitor is cropped on the next.
{
  const wide = F.fit(30, 1.02, 1.778, 1.0);
  const square = F.fit(30, 1.02, 1.0, 1.0);
  const tall = F.fit(30, 1.02, 0.55, 1.0);
  ok(Math.abs(wide - square) < 1e-9, "for any aspect >= 1 the VERTICAL binds, so wide and square agree");
  ok(tall > wide * 1.3, `a TALL window needs materially more room (${tall.toFixed(0)} vs ${wide.toFixed(0)})`);
  const ultra = F.fit(30, 1.02, 2.39, 1.0);
  ok(Math.abs(ultra - wide) < 1e-9, "and an ultrawide needs no more than a 16:9 — the height is the constraint");
}

// ---------------------------------------------------------------- 3) margin, and monotonicity
{
  const a = F.fit(30, 1.02, 1.778, 1.0), b = F.fit(30, 1.02, 1.778, 1.25);
  ok(Math.abs(b / a - 1.25) < 1e-9, "the margin scales the distance exactly");
  let prev = 0, mono = true;
  for (const R of [5, 10, 20, 40, 80]) { const d = F.fit(R, 1.02, 1.778, 1.1); if (d <= prev) mono = false; prev = d; }
  ok(mono, "a bigger subject always wants a further camera");
  let prev2 = 1e9, mono2 = true;
  for (const fov of [0.5, 0.8, 1.1, 1.4]) { const d = F.fit(30, fov, 1.778, 1.1); if (d >= prev2) mono2 = false; prev2 = d; }
  ok(mono2, "a wider lens always wants a nearer camera");
}

// ---------------------------------------------------------------- 4) the easing settles
// A camera that SNAPS reads as a cut. It must converge, and it must not overshoot.
{
  let c = 48;
  const target = 120;
  let over = false, last = c;
  for (let s = 0; s < 600; s++) {
    c = F.ease(c, target, 1/60, 0.9);
    if (c > target + 1e-6) over = true;
    last = c;
  }
  ok(!over, "the easing never overshoots");
  ok(Math.abs(last - target) < 0.5, `and it arrives (${last.toFixed(2)} of ${target})`);
  let c2 = 48, steps = 0;
  while (Math.abs(c2 - target) > 5 && steps < 6000) { c2 = F.ease(c2, target, 1/60, 0.9); steps++; }
  const secs = steps / 60;
  ok(secs > 0.4 && secs < 6, `it takes ${secs.toFixed(2)}s to cover a large move — a glide, not a cut and not a crawl`);
}

// ---------------------------------------------------------------- 5) the world radius respects its boundary
{
  ok(F.radius(130, null) === 130, "with no boundary the extent stands");
  ok(F.radius(130, { r: 40 }) === 40, "a spherical boundary caps it");
  const lens = ZC.Env.boundary("lens", 20);
  const r = F.radius(130, lens);
  ok(r < 130, `an ellipsoid boundary caps it too (${r.toFixed(1)} from an extent of 130)`);
}

console.log(fail ? `frame_ref: ${fail} FAIL` : "frame_ref: PASS");
process.exit(fail ? 1 : 0);

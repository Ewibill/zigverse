// boundary_ref.mjs — CPU proof of the BOUNDARY law (the world's SHAPE, engine v0.22 / ZigCore 0.10).
// A soft surface adds a restoring accel BEFORE the integrate when an agent leaves the volume —
// where forces PULL and currents PUSH, a boundary CONTAINS. Shapes: cylinder (radial wall ± floor/
// ceiling → bowl/chimney) and sphere (vessel). Sizes are fractions of the species' frame.
//   cylinder: if hypot(dx,dz) > r → push in; if dy < lo → push up; if dy > hi → push down
//   sphere:   if |rel| > r → push toward center      (rel = p - anchor)
// Proves: inside → NO force (free interior); outside → pushed back IN (radial for cylinder,
// all-axis for sphere); floor catches a basin; size tracks the frame; and — the payoff for the
// tidepool wander-off — a boundary CONTAINS a mass that a steady current would otherwise walk
// out of frame over a long run.

import { readFileSync } from "fs";
const code = readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8");
(0, eval)(code);
const ZC = globalThis.ZigCore;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

// the law, in plain JS (the engine's WGSL mirrors this exactly)
const AX = { x: 0, y: 1, z: 2 };
function bAccel(b, rel) {
  const a = [0, 0, 0];
  if (b.shape === "cylinder") {
    // the cylinder holds around a free AXIS (cap); the other two components are the radial wall
    const cap = AX[b.axis || "y"], r1 = (b.axis === "x" ? AX.y : AX.x), r2 = (b.axis === "z" ? AX.y : AX.z);
    const rad = Math.hypot(rel[r1], rel[r2]);
    if (rad > b.r) { const s = (rad - b.r) * b.k; a[r1] -= rel[r1] / rad * s; a[r2] -= rel[r2] / rad * s; }
    if (b.lo !== undefined && rel[cap] < b.lo) a[cap] += (b.lo - rel[cap]) * b.k;
    if (b.hi !== undefined && rel[cap] > b.hi) a[cap] += (b.hi - rel[cap]) * b.k;
  } else if (b.shape === "sphere") {
    const d = Math.hypot(rel[0], rel[1], rel[2]);
    if (d > b.r) { const s = (d - b.r) * b.k; a[0] -= rel[0] / d * s; a[1] -= rel[1] / d * s; a[2] -= rel[2] / d * s; }
  } else if (b.shape === "ellipsoid") {
    const R = [b.rx, b.ry, b.rz], s = [rel[0] / R[0], rel[1] / R[1], rel[2] / R[2]];
    const bd = Math.hypot(...s);
    if (bd > 1) { const g = [s[0] / R[0], s[1] / R[1], s[2] / R[2]], gn = Math.hypot(...g);
      const kEff = b.k * (R[0] + R[1] + R[2]) / 3;
      for (let k = 0; k < 3; k++) a[k] -= g[k] / gn * (bd - 1) * kEff; }
  }
  return a;
}

const H = 20;
const basin = ZC.Env.boundary("basin", H), column = ZC.Env.boundary("column", H), vessel = ZC.Env.boundary("vessel", H);

// 0) resolvers produce frame-scaled shapes
ok(basin.shape === "cylinder" && basin.r === 2.2 * H && basin.lo === -1.05 * H, `basin resolves (r ${basin.r}, floor ${basin.lo})`);
ok(column.shape === "cylinder" && column.lo === undefined, "column is a tube — no floor (free to rise)");
ok(vessel.shape === "sphere" && vessel.r === 2.3 * H, "vessel is a sphere");
ok(ZC.Env.boundary("none") === null && ZC.Env.boundary(undefined) === null, "none/absent → null (open world, no walls)");

// 1) INSIDE → no force. A point well within the volume is free.
{
  const inside = [5, 0, -4];
  ok(bAccel(basin, inside).every((x) => x === 0), "basin: interior is force-free");
  ok(bAccel(vessel, [3, 3, 3]).every((x) => x === 0), "vessel: interior is force-free");
}

// 2) OUTSIDE the wall → pushed radially back IN (cylinder), no vertical component for a plain wall.
{
  const out = [basin.r + 30, 2, 0];            // far out along +x, inside the floor
  const a = bAccel(basin, out);
  ok(a[0] < 0, "basin: a mass past the rim is pushed inward (−x)");
  ok(Math.abs(a[1]) < 1e-9, "basin: a side-wall push is purely horizontal");
}

// 3) BASIN FLOOR catches a sinking mass (below lo → pushed up).
{
  const low = [0, basin.lo - 10, 0];
  ok(bAccel(basin, low)[1] > 0, "basin: below the floor → pushed up (it pools, doesn't fall through)");
}

// 4) SPHERE pushes back along the radius from ANY direction (a true vessel).
{
  for (const dir of [[1, 0, 0], [0, 1, 0], [0, 0, -1], [1, 1, 1]]) {
    const n = Math.hypot(...dir), p = dir.map((c) => c / n * (vessel.r + 25));
    const a = bAccel(vessel, p), dot = a[0] * p[0] + a[1] * p[1] + a[2] * p[2];
    ok(dot < 0, `vessel: pushed back toward center from [${dir}]`);
  }
}

// 5) SIZE tracks the frame — a tighter view gets a proportionally tighter world.
{
  const tight = ZC.Env.boundary("basin", 12), wide = ZC.Env.boundary("basin", 30);
  ok(tight.r === 2.2 * 12 && wide.r === 2.2 * 30, "basin radius fills whatever frame it's viewed in");
}

// 6) THE PAYOFF — CONTAINMENT. A steady current (the eddy drift that walked the tidepool out of
// frame) is applied with medium drag; WITHOUT a boundary the mass escapes far past the frame,
// WITH a basin it stays held inside the rim over a long run.
function runFor(seconds, withBoundary) {
  const dt = 1 / 60, drift = [1.0, 0, 0], drag = 1.10;   // eddy-like drift in water
  let p = [0, 0, 0], v = [0, 0, 0];
  for (let t = 0; t < seconds; t += dt) {
    let a = [drift[0], drift[1], drift[2]];
    if (withBoundary) { const b = bAccel(basin, p); a = [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
    for (let k = 0; k < 3; k++) { v[k] += a[k] * dt; v[k] *= (1 - dt * drag); p[k] += v[k] * dt; }
  }
  return Math.hypot(p[0], p[2]);   // horizontal distance from center
}
{
  const free = runFor(600, false), held = runFor(600, true);   // 10 minutes of steady drift
  ok(free > basin.r * 3, `without a boundary the mass walks far out of frame (${free.toFixed(0)} ≫ rim ${basin.r})`);
  ok(held <= basin.r + 2, `with a basin it stays held inside the rim (${held.toFixed(1)} ≤ ${basin.r}) — the wander-off, cured`);
}

// 7) AXIS — the SAME cylinder law rotated. column (axis y) is free UP; capsule (axis x) is free
// WIDE — the horizontal cigar. Each squeezes its two radial components and lets its long axis run.
{
  const cap = ZC.Env.boundary("capsule", H), col = ZC.Env.boundary("column", H);
  ok(col.axis === "y" && cap.axis === "x", `column runs along Y, capsule along X (col ${col.axis}, cap ${cap.axis})`);
  // capsule: free to run WIDE along X — a point far out along +x is NOT pushed back (it's the long axis)
  ok(Math.abs(bAccel(cap, [cap.r + 40, 0, 0])[0]) < 1e-9, "capsule: matter runs free along the wide axis (X) — no push");
  // capsule: squeezed on Y and Z — a point above the tube is pushed back DOWN, one behind pushed IN
  ok(bAccel(cap, [0, cap.r + 20, 0])[1] < 0, "capsule: a point above the tube is squeezed back down (Y is a wall)");
  ok(bAccel(cap, [0, 0, cap.r + 20])[2] < 0, "capsule: a point past the depth is squeezed back in (Z is a wall)");
  // and the mirror image: column is free along Y, walled on X — the exact opposite of capsule
  ok(Math.abs(bAccel(col, [0, col.r + 40, 0])[1]) < 1e-9 && bAccel(col, [col.r + 20, 0, 0])[0] < 0,
     "column: free along Y, walled on X — capsule's law stood upright");
}

// 8) ELLIPSOID (lens) — a squashed sphere: contains on every axis, but the short axis (Y) walls
// in sooner than the wide axes (X, Z), so the held shape is a wide disc — the squashed circle.
{
  const lens = ZC.Env.boundary("lens", H);
  ok(lens.shape === "ellipsoid" && lens.rx === 1.55 * H && lens.ry === 0.42 * H && lens.rz === 1.55 * H, `lens resolves anisotropic (rx ${lens.rx}, ry ${lens.ry}, rz ${lens.rz})`);
  ok(lens.ry < lens.rx && lens.rx === lens.rz, "lens is short in Y, equally generous in X & Z (a horizontal disc)");
  ok(bAccel(lens, [0, 0, 0]).every((x) => x === 0) && bAccel(lens, [lens.rx * 0.5, 0, 0]).every((x) => x === 0), "lens: interior is force-free");
  // a point just past the SHORT axis is pushed back; the same distance along the WIDE axis is still inside
  ok(bAccel(lens, [0, lens.ry + 5, 0])[1] < 0, "lens: past the short Y wall → pushed back down (flattens the disc)");
  ok(bAccel(lens, [lens.ry + 5, 0, 0]).every((x) => x === 0), "lens: that same height along X is still INSIDE — the disc runs wider than it is tall");
  // contains on the wide axis too (far enough out)
  ok(bAccel(lens, [lens.rx + 10, 0, 0])[0] < 0 && bAccel(lens, [0, 0, lens.rz + 10])[2] < 0, "lens: still a closed vessel — contains on the wide axes too");
}

console.log(fail ? `\nBOUNDARY REF: FAIL (${fail})` : "\nBOUNDARY REF: PASS");
process.exit(fail ? 1 : 0);

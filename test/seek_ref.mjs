// seek_ref.mjs — CPU proof of ZIGSEEK (attractor / repulsor) force.
// Mirrors the step-kernel steering (engine v0.12.0). Proves: the force points
// toward an attractor and away from a repulsor, falls off with distance (a
// regional pull, not infinite), is zero when strength is zero, and that an
// agent integrated under seek converges to the target while one under avoid
// recedes. Structural — not GPU bit-match.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];

// one steering evaluation — identical structure to the WGSL block
function seekForce(p, seek, avoid, reach) {
  let a = [0, 0, 0];
  if (seek[3] > 0.001) {
    const to = sub(seek, p), d = len(to) + 1e-3;
    const f = seek[3] / (1 + (d / reach[0]) * (d / reach[0]));
    a = add(a, scale(to, f / d));
  }
  if (avoid[3] > 0.001) {
    const aw = sub(p, avoid), d = len(aw) + 1e-3;
    const f = avoid[3] / (1 + (d / reach[1]) * (d / reach[1]));
    a = add(a, scale(aw, f / d));
  }
  return a;
}

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const reach = [40, 40];

// 1) SEEK points TOWARD the attractor
{
  const p = [-10, 0, 0], seek = [0, 0, 0, 10];
  const a = seekForce(p, seek, [0, 0, 0, 0], reach);
  ok(a[0] > 0 && Math.abs(a[1]) < 1e-6 && Math.abs(a[2]) < 1e-6, `seek pulls toward target (ax=${a[0].toFixed(3)})`);
}

// 2) AVOID points AWAY from the repulsor
{
  const p = [-10, 0, 0], avoid = [0, 0, 0, 10];
  const a = seekForce(p, [0, 0, 0, 0], avoid, reach);
  ok(a[0] < 0, `avoid pushes away (ax=${a[0].toFixed(3)})`);
}

// 3) FALLOFF: force strictly decreases with distance (regional, not infinite)
{
  const near = len(seekForce([-5, 0, 0], [0, 0, 0, 10], [0, 0, 0, 0], reach));
  const mid = len(seekForce([-40, 0, 0], [0, 0, 0, 10], [0, 0, 0, 0], reach));
  const far = len(seekForce([-120, 0, 0], [0, 0, 0, 10], [0, 0, 0, 0], reach));
  ok(near > mid && mid > far, `falloff near>${mid.toFixed(3)}? ${near.toFixed(3)}>${mid.toFixed(3)}>${far.toFixed(3)}`);
}

// 4) OFF: zero strength → zero force
{
  const a = seekForce([10, 3, -4], [0, 0, 0, 0], [0, 0, 0, 0], reach);
  ok(len(a) === 0, "no target → no force");
}

// 5) CONVERGENCE: an agent WITHIN the attractor's region moves toward it and
//    ends up substantially closer (reach = 40, so start inside it).
{
  let p = [-35, 0, 0], v = [0, 0, 0]; const seek = [0, 0, 0, 12], dt = 1 / 60;
  const d0 = len(sub(seek, p));
  for (let s = 0; s < 360; s++) {
    const a = seekForce(p, seek, [0, 0, 0, 0], reach);
    v = scale(add(v, scale(a, dt)), 0.99);   // light drag, like the air kernel
    p = add(p, scale(v, dt));
  }
  ok(len(sub(seek, p)) < d0 * 0.5, `seeker approaches (d ${d0.toFixed(1)} → ${len(sub(seek, p)).toFixed(1)})`);
}

// 5b) REGIONAL REACH: an agent well OUTSIDE reach still drifts closer, but only
//     weakly — proving the pull is a region of interest, not an infinite well.
{
  let p = [-120, 0, 0], v = [0, 0, 0]; const seek = [0, 0, 0, 12], dt = 1 / 60;
  const d0 = len(sub(seek, p));
  for (let s = 0; s < 240; s++) {
    const a = seekForce(p, seek, [0, 0, 0, 0], reach);
    v = scale(add(v, scale(a, dt)), 0.99);
    p = add(p, scale(v, dt));
  }
  const d1 = len(sub(seek, p));
  ok(d1 < d0 && d1 > d0 * 0.6, `distant agent drifts in weakly (d ${d0.toFixed(1)} → ${d1.toFixed(1)})`);
}

// 6) RECEDE: an agent near a repulsor moves away
{
  let p = [3, 0, 0], v = [0, 0, 0]; const avoid = [0, 0, 0, 12], dt = 1 / 60;
  const d0 = len(sub(p, avoid));
  for (let s = 0; s < 240; s++) {
    const a = seekForce(p, [0, 0, 0, 0], avoid, reach);
    v = scale(add(v, scale(a, dt)), 0.99);
    p = add(p, scale(v, dt));
  }
  ok(len(sub(p, avoid)) > d0 + 5, `avoider recedes (d ${d0.toFixed(1)} → ${len(sub(p, avoid)).toFixed(1)})`);
}

console.log(fail ? `\nSEEK REF: FAIL (${fail})` : "\nSEEK REF: PASS");
process.exit(fail ? 1 : 0);

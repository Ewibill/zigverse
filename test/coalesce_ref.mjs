// coalesce_ref.mjs — WHEN TWO TOUCH, THEY BECOME ONE. (ZigCore.Coalesce 0.19)
//
// The counterpart to Contact: same broadphase, same pair test, opposite resolution. The
// invariant is VOLUME — r = cbrt(r1^3 + r2^3) — and everything characteristic of the piece
// falls out of that one choice. Buoyancy scales with volume and drag with area, so a merged
// bubble rises FASTER than either parent; meanwhile each merge halves the population, so the
// EVENT RATE collapses. Motion accelerating while events decelerate.
//
// Proves: volume is conserved EXACTLY over a full collapse · momentum is conserved per merge ·
// the population falls monotonically to one · absorbed agents are parked, not deleted ·
// bigger bubbles really do rise faster · the run is DETERMINISTIC (a self-running piece needs
// the same seed to give the same collapse) · a lone bubble never merges with itself.

import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
const ZC = globalThis.ZigCore, CO = ZC.Coalesce;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

function world(N, seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pos = new Float64Array(N * 3), vel = new Float64Array(N * 3), r = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    pos[i*3] = (rnd() * 2 - 1) * 30;
    pos[i*3+1] = (rnd() * 2 - 1) * 40;
    vel[i*3] = (rnd() * 2 - 1) * 0.4;
    vel[i*3+1] = rnd() * 0.6;
    r[i] = 0.35 + rnd() * 0.25;
  }
  return { pos, vel, r, N };
}

// ---------------------------------------------------------------- 1) VOLUME IS CONSERVED
// The one invariant. A collapse that loses volume is a broken law, and it would show as
// bubbles quietly shrinking away instead of accumulating.
{
  const w = world(600, 20260810);
  const v0 = CO.volume(w.r, w.N);
  let merges = 0;
  for (let step = 0; step < 400; step++) {
    merges += CO.step(w.pos, w.vel, w.r, w.N, { touch: 1 });
    for (let i = 0; i < w.N; i++) {                       // let them drift so new pairs meet
      if (w.r[i] <= 0) continue;
      w.pos[i*3]   += w.vel[i*3] * 0.5;
      w.pos[i*3+1] += w.vel[i*3+1] * 0.5;
    }
  }
  const v1 = CO.volume(w.r, w.N);
  ok(Math.abs(v1 - v0) / v0 < 1e-12,
     `volume conserved across ${merges} merges (${v0.toFixed(4)} → ${v1.toFixed(4)})`);
  ok(merges > 100, `the collapse actually happened (${merges} merges)`);
}

// ---------------------------------------------------------------- 2) MOMENTUM IS CONSERVED
// Volume is mass, so a big slow bubble absorbing a small fast one barely changes course —
// which is what makes a survivor feel HEAVY rather than merely large.
{
  const pos = new Float64Array(6), vel = new Float64Array(6), r = new Float64Array(2);
  pos.set([0, 0, 0, 1.2, 0, 0]);
  vel.set([0.1, 0, 0, -2.5, 0.4, 0]);
  r.set([1.0, 0.4]);
  const p0 = [0, 0, 0];
  for (let i = 0; i < 2; i++) { const m = r[i]**3;
    for (let k = 0; k < 3; k++) p0[k] += vel[i*3+k] * m; }
  const n = CO.step(pos, vel, r, 2, { touch: 1 });
  ok(n === 1, "two overlapping bubbles merge exactly once");
  const m1 = r[0]**3;
  const p1 = [vel[0]*m1, vel[1]*m1, vel[2]*m1];
  ok(Math.hypot(p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]) < 1e-12,
     "momentum is conserved, with volume as mass");
  ok(Math.abs(r[0] - Math.cbrt(1.0 + 0.4**3)) < 1e-12,
     `the survivor's radius is cbrt of the summed volumes (${r[0].toFixed(4)})`);
  ok(r[1] === 0, "the absorbed bubble is PARKED at radius 0, not deleted");
}

// ---------------------------------------------------------------- 3) IT COLLAPSES TO ONE
// and the population never goes up. The piece depends on reaching exactly one.
{
  const w = world(400, 7);
  let prev = CO.alive(w.r, w.N), rose = 0;
  for (let step = 0; step < 3000 && prev > 1; step++) {
    CO.step(w.pos, w.vel, w.r, w.N, { touch: 1 });
    /* pull everything together AND damp it — a pure central force makes them
       orbit the centre forever instead of meeting, which is a property of the
       harness, not of the law. */
    for (let i = 0; i < w.N; i++) {
      if (w.r[i] <= 0) continue;
      w.vel[i*3]   -= w.pos[i*3]   * 0.004;
      w.vel[i*3+1] -= w.pos[i*3+1] * 0.004;
      w.vel[i*3]   *= 0.97;
      w.vel[i*3+1] *= 0.97;
      w.pos[i*3]   += w.vel[i*3] * 0.5;
      w.pos[i*3+1] += w.vel[i*3+1] * 0.5;
    }
    const now = CO.alive(w.r, w.N);
    if (now > prev) rose++;
    prev = now;
  }
  ok(rose === 0, "the population never increases");
  ok(prev === 1, `it collapses all the way to ONE bubble (${prev})`);
}

// ---------------------------------------------------------------- 4) BIGGER RISES FASTER
// Buoyancy goes as volume, drag as area, so terminal speed goes as radius. This is why the
// piece accelerates as it thins out — nothing had to be told to do it.
{
  const term = (radius) => {
    let v = 0;
    for (let s = 0; s < 4000; s++) {
      const buoy = radius ** 3 * 9.0;                    // volume
      const drag = radius ** 2 * v * Math.abs(v) * 2.4;  // area
      v += (buoy - drag) / (radius ** 3) * 0.002;
    }
    return v;
  };
  const small = term(0.5), big = term(2.0);
  ok(big > small * 1.5, `a bubble 4x the radius rises faster (${small.toFixed(2)} → ${big.toFixed(2)})`);
}

// ---------------------------------------------------------------- 5) DETERMINISTIC
// A piece that runs unattended must give the same collapse from the same seed — otherwise no
// two performances can be compared and no failure can be reproduced.
{
  const run = () => {
    const w = world(300, 424242);
    let merges = 0;
    for (let step = 0; step < 200; step++) {
      merges += CO.step(w.pos, w.vel, w.r, w.N, { touch: 1 });
      for (let i = 0; i < w.N; i++) { if (w.r[i] <= 0) continue;
        w.pos[i*3] += w.vel[i*3] * 0.5; w.pos[i*3+1] += w.vel[i*3+1] * 0.5; }
    }
    return { merges, alive: CO.alive(w.r, w.N), vol: CO.volume(w.r, w.N) };
  };
  const a = run(), b = run();
  ok(a.merges === b.merges && a.alive === b.alive && Math.abs(a.vol - b.vol) < 1e-15,
     `the same seed gives the same collapse (${a.merges} merges, ${a.alive} alive)`);
}

// ---------------------------------------------------------------- 6) edge cases
{
  const pos = new Float64Array(3), vel = new Float64Array(3), r = new Float64Array([1]);
  ok(CO.step(pos, vel, r, 1, { touch: 1 }) === 0, "a lone bubble never merges with itself");
  const rz = new Float64Array([0, 0]);
  ok(CO.step(new Float64Array(6), new Float64Array(6), rz, 2, { touch: 1 }) === 0,
     "parked bubbles are skipped entirely");
  const far = new Float64Array([0,0,0, 50,0,0]);
  const rf = new Float64Array([1, 1]);
  ok(CO.step(far, new Float64Array(6), rf, 2, { touch: 1 }) === 0, "bubbles that are not touching do not merge");
}


// ---------------------------------------------------------------- 7) CARGO IS CONSERVED TOO
// Volume is conserved by construction; cargo is whatever a body CARRIES. A bubble accreting
// material from the water grows heavier with age, and one that has absorbed a hundred others
// carries all their cargo. Weight becomes the sum of many HISTORIES while size is only the sum
// of many volumes — which is what lets a large old body hang in equilibrium while a large
// young one still rises.
{
  const N = 300;
  let s = 31337;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pos = new Float64Array(N*3), vel = new Float64Array(N*3), r = new Float64Array(N), cargo = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    pos[i*3] = (rnd()*2-1)*20; pos[i*3+1] = (rnd()*2-1)*25;
    r[i] = 0.4 + rnd()*0.3;
    cargo[i] = rnd() * 2;                                  // each carries something different
  }
  const c0 = cargo.reduce((a, b) => a + b, 0);
  const v0 = CO.volume(r, N);
  let merges = 0;
  for (let step = 0; step < 300; step++) {
    merges += CO.step(pos, vel, r, N, { touch: 1, cargo });
    for (let i = 0; i < N; i++) { if (r[i] <= 0) continue;
      pos[i*3] += (rnd()*2-1)*0.35; pos[i*3+1] += (rnd()*2-1)*0.35; }
  }
  const c1 = cargo.reduce((a, b) => a + b, 0);
  ok(merges > 40, `cargo test actually merged (${merges})`);
  ok(Math.abs(c1 - c0) / c0 < 1e-12, `cargo conserved across ${merges} merges (${c0.toFixed(4)} → ${c1.toFixed(4)})`);
  ok(Math.abs(CO.volume(r, N) - v0) / v0 < 1e-12, "…and volume is still conserved alongside it");

  // a body that has eaten many carries more than one that has eaten few
  let biggest = 0;
  for (let i = 0; i < N; i++) if (r[i] > r[biggest]) biggest = i;
  let smallestAlive = -1;
  for (let i = 0; i < N; i++) if (r[i] > 0 && (smallestAlive < 0 || r[i] < r[smallestAlive])) smallestAlive = i;
  ok(cargo[biggest] > cargo[smallestAlive],
     `the largest survivor carries more than the smallest (${cargo[biggest].toFixed(2)} vs ${cargo[smallestAlive].toFixed(2)})`);
}


// ---------------------------------------------------------------- 8) COLOUR AS CONSERVED CARGO
// Several cargo channels at once, which is what colour needs. Storing channel x VOLUME and
// dividing by volume on read gives a mix weighted exactly by what each body brought — a bubble
// made of one large blue and one small red is mostly blue, in the right proportion, with no
// blending rule written anywhere. The law already does it.
{
  const N = 2;
  const pos = new Float64Array(N*3), vel = new Float64Array(N*3), r = new Float64Array([2.0, 1.0]);
  pos.set([0,0,0, 2.5,0,0]);
  const R = new Float64Array(N), G = new Float64Array(N), B = new Float64Array(N);
  const vA = 2.0**3, vB = 1.0**3;
  R[0] = 0.1*vA; G[0] = 0.2*vA; B[0] = 0.9*vA;      // a large BLUE
  R[1] = 1.0*vB; G[1] = 0.1*vB; B[1] = 0.1*vB;      // a small RED
  ok(CO.step(pos, vel, r, N, { touch: 1, cargo: [R, G, B] }) === 1, "multi-channel cargo still merges");
  const v = r[0]**3;
  const mix = [R[0]/v, G[0]/v, B[0]/v];
  const want = [(0.1*vA + 1.0*vB)/(vA+vB), (0.2*vA + 0.1*vB)/(vA+vB), (0.9*vA + 0.1*vB)/(vA+vB)];
  ok(Math.abs(mix[0]-want[0]) < 1e-12 && Math.abs(mix[1]-want[1]) < 1e-12 && Math.abs(mix[2]-want[2]) < 1e-12,
     `colour mixes by VOLUME (${mix.map((x) => x.toFixed(3)).join(", ")})`);
  ok(mix[2] > mix[0], "eight parts blue to one part red stays mostly blue");
}


// ---------------------------------------------------------------- 9) FILM DRAINAGE
// Two bubbles that touch do not merge at once — the film between them must thin and break,
// which is why real bubbles visibly PRESS against each other and hesitate. `delay` holds the
// merge for that dwell; paired with Contact they lean on one another for the duration instead
// of vanishing into each other on the frame they meet.
{
  const mk2 = () => {
    const pos = new Float64Array(6), vel = new Float64Array(6), r = new Float64Array([1.5, 1.2]);
    pos.set([0,0,0, 2.4,0,0]);                       // overlapping from the start
    return { pos, vel, r, dwell: new Float64Array(2) };
  };
  // with no delay, they merge on the first step
  const a = mk2();
  ok(CO.step(a.pos, a.vel, a.r, 2, { touch: 1 }) === 1, "delay 0 merges immediately (unchanged)");

  // with a delay, they press and wait
  const b = mk2();
  const DT = 1/60, DELAY = 0.6;
  let merged = -1;
  for (let step = 0; step < 200; step++) {
    const n = CO.step(b.pos, b.vel, b.r, 2, { touch: 1, delay: DELAY, dwell: b.dwell, dt: DT });
    if (n) { merged = step * DT; break; }
  }
  ok(merged > 0, "a delay holds the merge off");
  ok(Math.abs(merged - DELAY) < 0.05, `they merge after the film drains (${merged.toFixed(2)}s, wanted ${DELAY})`);

  // parted before the film drains, the dwell resets — a brush is not a merge
  const c = mk2();
  for (let step = 0; step < 12; step++) CO.step(c.pos, c.vel, c.r, 2, { touch: 1, delay: DELAY, dwell: c.dwell, dt: DT });
  ok(c.r[1] > 0, "still two after a brief touch");
  c.pos[3] = 40;                                      // pulled apart
  CO.step(c.pos, c.vel, c.r, 2, { touch: 1, delay: DELAY, dwell: c.dwell, dt: DT });
  ok(c.dwell[0] === 0 && c.dwell[1] === 0, "parting resets the dwell — a brush is not a merge");
}


// ---------------------------------------------------------------- 10) onMerge reports the parents
// A world that wants to ANIMATE a merge needs both parents' positions and radii at the moment
// it happens — by the time the caller sees the survivor, its position is already the
// volume-weighted centroid and the other body is parked at the origin. So the law reports.
{
  const pos = new Float64Array(6), vel = new Float64Array(6), r = new Float64Array([2.0, 1.2]);
  pos.set([0,0,0, 2.8,0,0]);
  const seen = [];
  CO.step(pos, vel, r, 2, { touch: 1, onMerge: (A,B,ax,ay,az,ar,bx,by,bz,br) => seen.push({A,B,ax,ar,bx,br}) });
  ok(seen.length === 1, "onMerge fires once per merge");
  ok(seen[0].A === 0 && seen[0].B === 1, "it names survivor and absorbed");
  ok(Math.abs(seen[0].ax - 0) < 1e-12 && Math.abs(seen[0].bx - 2.8) < 1e-12,
     "both parents' positions are reported BEFORE the centroid is applied");
  ok(Math.abs(seen[0].ar - 2.0) < 1e-12 && Math.abs(seen[0].br - 1.2) < 1e-12,
     "…and both radii before the volumes are summed");
  ok(Math.abs(r[0] - Math.cbrt(8 + 1.728)) < 1e-12, "the merge itself still happens correctly");
}


// ---------------------------------------------------------------- 11) SEVERAL PROTECTED BODIES
// A world with six nozzles has six bubbles that must each survive every merge they take part
// in. Protecting only one leaves the other five to be absorbed by their own arrivals — which
// is exactly what stopped five of six towers ever releasing anything.
{
  const N = 6;
  const pos = new Float64Array(N*3), vel = new Float64Array(N*3), r = new Float64Array(N);
  // three pairs, far apart from each other; in each pair the HIGHER index is protected
  for (let k = 0; k < 3; k++) {
    pos[(k*2)*3]   = k * 100;      r[k*2]   = 1.0;
    pos[(k*2+1)*3] = k * 100 + 1.2; r[k*2+1] = 1.4;
  }
  const keep = [1, 3, 5];
  const n = CO.step(pos, vel, r, N, { touch: 1, keep });
  ok(n === 3, `all three pairs merged (${n})`);
  ok(r[1] > 0 && r[3] > 0 && r[5] > 0, "every protected body survived");
  ok(r[0] === 0 && r[2] === 0 && r[4] === 0, "…and every unprotected partner was absorbed");
  const want = Math.cbrt(1.0**3 + 1.4**3);
  ok(Math.abs(r[1] - want) < 1e-12, "the protected body carries the summed volume");
}

console.log(fail ? `coalesce_ref: ${fail} FAIL` : "coalesce_ref: PASS");
process.exit(fail ? 1 : 0);

// wake_ref.mjs — RECIPROCITY: the medium remembers being moved. (ZigCore.Wake 0.18)
//
// Every medium law before this was ONE-WAY: zigflow pushes agents, medium drags them, slip
// decides along from across — and in every case the creature leaves no mark. That asymmetry
// is the deepest tell that a world is a simulation rather than a place.
//
// Proves: an agent's push shows up in the field · momentum is CONSERVED between body and
// medium (so nothing here is a hidden thruster) · a wake FADES · it SPREADS · one body's
// passage measurably changes the water another is in, and the effect falls off laterally ·
// INDUCED DRAG emerges (shedding momentum costs speed) · recentering is lossless.
//
// And it proves what this is NOT: there is no drafting. A diffusive field has no vortices,
// so a follower directly behind is pushed BACKWARD, not carried. Recorded deliberately —
// the obvious guess is wrong and should stay disproven in the suite.

import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
const ZC = globalThis.ZigCore, W = ZC.Wake;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

const mkGrid = () => W.create(48, 1.0, -24, -24);      // 48x48 cells of 1 unit, centred on origin

// ---------------------------------------------------------------- 1) opt-in / empty
{
  const g = mkGrid();
  const pos = new Float64Array([0,0,0]), vel = new Float64Array(3), acc = new Float64Array(3);
  W.carry(g, pos, vel, 1, 0, acc);
  ok(acc.every((v) => v === 0), "an undisturbed medium pushes on nothing");
  ok(W.energy(g) === 0, "and holds no energy");
}

// ---------------------------------------------------------------- 2) a push shows up in the field
{
  const g = mkGrid();
  const pos = new Float64Array([0.5, 0.5, 0]);
  const push = new Float64Array([3, 0, 0]);            // the body shoves +x against the water
  W.stir(g, pos, null, 1, 0, push, 1, 1);
  const [mx, my] = W.total(g);
  ok(Math.abs(mx + 3) < 1e-9 && Math.abs(my) < 1e-9,
     `the medium receives exactly the opposite of the push (${mx.toFixed(3)}, ${my.toFixed(3)})`);
}

// ---------------------------------------------------------------- 3) MOMENTUM IS CONSERVED
// What the body gives up must appear in the water, and what the water holds must come back.
// If this fails, the law is a thruster wearing a disguise.
{
  const g = mkGrid();
  const N = 20;
  const pos = new Float64Array(N*3), vel = new Float64Array(N*3), push = new Float64Array(N*3);
  for (let i = 0; i < N; i++) { pos[i*3] = -6 + i*0.6; pos[i*3+1] = (i%5)*0.4 - 0.8; push[i*3] = 1.3; push[i*3+1] = (i%3)-1; }
  let bodyGave = [0,0];
  for (let i = 0; i < N; i++) { bodyGave[0] += push[i*3]; bodyGave[1] += push[i*3+1]; }
  W.stir(g, pos, null, N, 0, push, 1, 1);
  const held = W.total(g);
  ok(Math.hypot(held[0] + bodyGave[0], held[1] + bodyGave[1]) < 1e-9,
     `the medium holds exactly what the body gave up (${held[0].toFixed(3)},${held[1].toFixed(3)} vs ${(-bodyGave[0]).toFixed(3)},${(-bodyGave[1]).toFixed(3)})`);

  // and it pushes back: agents standing in a stirred field feel it
  const acc = new Float64Array(N*3);
  W.carry(g, pos, vel, N, 0, acc, 1);
  let back = 0; for (let i = 0; i < N; i++) back += Math.hypot(acc[i*3], acc[i*3+1]);
  ok(back > 1, `…and the field pushes back on what stands in it (${back.toFixed(2)})`);
}

// ---------------------------------------------------------------- 4) a wake FADES
{
  const g = mkGrid();
  const pos = new Float64Array([0.5,0.5,0]), push = new Float64Array([5,0,0]);
  W.stir(g, pos, null, 1, 0, push, 1, 1);
  const e0 = W.energy(g);
  for (let q = 0; q < 60; q++) W.relax(g, 1/60, { spread: 0.12, life: 2.2 });
  const e1 = W.energy(g);
  for (let q = 0; q < 300; q++) W.relax(g, 1/60, { spread: 0.12, life: 2.2 });
  const e2 = W.energy(g);
  ok(e1 < e0 && e2 < e1 * 0.2, `the wake fades (${e0.toFixed(2)} → ${e1.toFixed(2)} → ${e2.toFixed(3)}) — water has memory, not forever`);
}

// ---------------------------------------------------------------- 5) a wake SPREADS
{
  const g = mkGrid();
  const pos = new Float64Array([0.5,0.5,0]), push = new Float64Array([5,0,0]);
  W.stir(g, pos, null, 1, 0, push, 1, 1);
  const spanOf = () => { let c = 0; for (let i = 0; i < g.vx.length; i++) if (Math.abs(g.vx[i]) > 1e-4) c++; return c; };
  const s0 = spanOf();
  for (let q = 0; q < 120; q++) W.relax(g, 1/60, { spread: 0.2, life: 30 });
  ok(spanOf() > s0 * 3, `and it spreads (${s0} cells → ${spanOf()})`);
}

// ---------------------------------------------------------------- 6) one body changes the water another is in
// — and it is BACKWASH, not drafting. A diffusive field has no vortices to sit between, so a
// follower directly behind a swimmer is pushed BACK. The obvious guess is wrong; keep it
// disproven. (It is also why real fish school OFFSET rather than in line.)
{
  const run = (offY, wakeOn) => {
    const g = W.create(64, 1.0, -32, -32);
    const pos = new Float64Array(6), vel = new Float64Array(6), acc = new Float64Array(6), push = new Float64Array(6);
    pos[0] = -8; pos[1] = 0; pos[3] = -12; pos[4] = offY;
    const dt = 1/120;
    for (let q = 0; q < 1200; q++) {
      acc.fill(0); push.fill(0); push[0] = 9; acc[0] += push[0];      // ONLY the leader swims
      if (wakeOn) {
        W.stir(g, pos, vel, 2, 0, push, dt, 25);
        W.relax(g, dt, { spread: 0.16, life: 2.5 });
        W.carry(g, pos, vel, 2, 0, acc, 1.5);
      } else for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) acc[i*3+k] -= vel[i*3+k] * 1.5;
      for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) { vel[i*3+k] += acc[i*3+k]*dt; pos[i*3+k] += vel[i*3+k]*dt; }
      W.recenter(g, pos[0], pos[1]);
    }
    return { L: pos[0], f: pos[3] };
  };
  const off = run(0, false), near = run(0, true), aside = run(10, true);
  ok(Math.abs(off.f + 12) < 1e-9, "with no wake a follower with no propulsion never moves");
  ok(near.f < off.f - 1,
     `a leader's wake MOVES the follower (${off.f.toFixed(2)} → ${near.f.toFixed(2)}) — backward, because it is backwash`);
  ok(aside.f > near.f,
     `and the effect falls off laterally (${near.f.toFixed(2)} directly behind vs ${aside.f.toFixed(2)} aside)`);

  // INDUCED DRAG — the thing nobody asked for. A swimmer that sheds momentum pays for it.
  const noWake = run(0, false).L, withWake = run(0, true).L;
  ok(withWake < noWake,
     `INDUCED DRAG: shedding a wake costs the swimmer speed (${noWake.toFixed(2)} → ${withWake.toFixed(2)}) — nothing in the code asks for this`);
}

// ---------------------------------------------------------------- 7) recentering is lossless
{
  const g = mkGrid();
  const pos = new Float64Array([0.5,0.5,0]), push = new Float64Array([4,-2,0]);
  W.stir(g, pos, null, 1, 0, push, 1, 1);
  const before = W.total(g);
  const moved = W.recenter(g, 6.0, -3.0);
  const after = W.total(g);
  ok(moved, "recentering by whole cells happens when the body has travelled");
  ok(Math.hypot(after[0]-before[0], after[1]-before[1]) < 1e-9,
     "…and carries the wake losslessly — whole cells, never resampled");
}

console.log(fail ? `wake_ref: ${fail} FAIL` : "wake_ref: PASS");
process.exit(fail ? 1 : 0);

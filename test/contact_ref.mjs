// contact_ref.mjs — CPU proof of the CONTACT law (matter that occupies space, ZigCore 0.16).
// Nothing in the Canon had ever given an agent VOLUME: flocking's separation is a force
// between strangers, a preference that can be overpowered, so a coil passed through its own
// length and a world contained nothing a creature had to go AROUND. This is the STATIC half —
// a stone, a pillar, a post. The general case (a body against itself) is the same mathematics
// with both sides moving.
//
// Proves: an agent outside is untouched · a penetrating agent is pushed OUT along the normal ·
// a body driven at a pillar does not pass through it · it WRAPS rather than pancaking ·
// the response settles instead of bouncing forever · no shapes means byte-identical (opt-in).

import { readFileSync } from "fs";
const code = readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8");
(0, eval)(code);
const ZC = globalThis.ZigCore, S = ZC.Structure, C = ZC.Contact;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const H = 20;
const bond = S.refine(ZC.Env.bond("spine", H), 2);
const SKIN = bond.rest * 0.5;

const mk = (n, cap) => ({ n, head: 0, pos: new Float64Array((cap||n)*3), vel: new Float64Array((cap||n)*3), par: new Int32Array(cap||n).fill(-1) });

// ---------------------------------------------------------------- 1) opt-in
{
  const st = mk(6); st.par = S.chain(6);
  for (let i = 0; i < 6; i++) st.pos[i*3] = i * bond.rest;
  const acc = new Float64Array(18);
  C.exclude(st.pos, st.vel, 6, 0, acc, null, { skin: SKIN });
  C.exclude(st.pos, st.vel, 6, 0, acc, [], { skin: SKIN });
  ok(acc.every((v) => v === 0), "no shapes, no work — the law is opt-in");
}

// ---------------------------------------------------------------- 2) outside is untouched
{
  const st = mk(1); st.pos.set([30, 0, 0]);
  const acc = new Float64Array(3);
  C.exclude(st.pos, st.vel, 1, 0, acc, [{ x: 0, y: 0, r: 5 }], { skin: SKIN });
  ok(acc[0] === 0 && acc[1] === 0, "an agent well outside feels nothing");
}

// ---------------------------------------------------------------- 3) inside is pushed OUT along the normal
{
  const st = mk(1); st.pos.set([2, 0, 0]);                    // deep inside r=5
  const acc = new Float64Array(3);
  C.exclude(st.pos, st.vel, 1, 0, acc, [{ x: 0, y: 0, r: 5 }], { skin: 0 });
  ok(acc[0] > 0 && Math.abs(acc[1]) < 1e-12, `pushed straight out along the normal (${acc[0].toFixed(0)}, ${acc[1].toFixed(0)})`);
  const shallow = new Float64Array(3);
  st.pos[0] = 4.5;
  C.exclude(st.pos, st.vel, 1, 0, shallow, [{ x: 0, y: 0, r: 5 }], { skin: 0 });
  ok(shallow[0] < acc[0], "deeper penetration pushes harder — the response tracks depth");
}

// ---------------------------------------------------------------- 4) a body cannot pass through a pillar
function drive(shapes, steps, push, release) {
  const N = 40, st = mk(N, N); st.par = S.chain(N);
  for (let i = 0; i < N; i++) { st.pos[i*3] = -70 + i * bond.rest; st.pos[i*3+1] = 0.35; }   // starts clear of every obstacle
  const acc = new Float64Array(N*3);
  const sub = 4 * (bond.substeps || 1), dt = 1/60/sub;
  let worst = 0;
  for (let q = 0; q < steps*sub; q++) {
    acc.fill(0);
    S.accel(bond, st.pos, st.vel, st.par, N, acc);
    const on = release ? (q < steps*sub*0.6) : true;           // optionally stop pushing partway
    if (on) for (let i = 0; i < N; i++) acc[i*3] += push;      // drive it at the pillar
    C.exclude(st.pos, st.vel, N, 0, acc, shapes, { skin: SKIN, k: 900, damp: 18 });
    S.slip(st.pos, st.vel, st.par, N, 0, acc, { along: 0.4, across: 3.0 });
    for (let i = 0; i < N; i++) for (let k = 0; k < 2; k++) { st.vel[i*3+k] += acc[i*3+k]*dt; st.pos[i*3+k] += st.vel[i*3+k]*dt; }
    const d = C.deepest(st.pos, N, 0, shapes, SKIN);
    if (d > worst) worst = d;
  }
  let fin = true; for (let i = 0; i < N*3; i++) if (!Number.isFinite(st.pos[i])) fin = false;
  return { st, worst, fin, N };
}
{
  const pillar = [{ x: 0, y: 0, r: 6 }];
  const r = drive(pillar, 900, 3.0);
  ok(r.fin, "a body driven at a pillar stays finite");
  ok(r.worst < SKIN * 0.6, `it never gets inside (deepest ${r.worst.toFixed(3)} vs skin ${SKIN.toFixed(2)})`);

  // and it WRAPS: some of the body ends up on either side of the pillar's centre line
  let above = 0, below = 0;
  for (let i = 0; i < r.N; i++) {
    const x = r.st.pos[i*3], y = r.st.pos[i*3+1];
    if (Math.hypot(x, y) < 6 * 2.2) { if (y > 0.4) above++; else if (y < -0.4) below++; }
  }
  ok(above + below > 4, `the body deflects around the obstacle rather than piling on it (${above} above, ${below} below)`);
}

// ---------------------------------------------------------------- 5) it settles rather than chattering
// A body still being pushed will keep SLIDING around an obstacle, and should — that is not
// chatter. Chatter is a body that never stops trading energy with the surface. So: drive it
// in, release, and check it comes to rest instead of ringing against the pillar forever.
{
  const pillar = [{ x: 0, y: 0, r: 6 }];
  const r = drive(pillar, 2000, 2.0, true);
  let ke = 0; for (let i = 0; i < r.N*3; i++) ke += r.st.vel[i]*r.st.vel[i];
  ok(ke < 5, `released against a pillar, the body comes to REST (KE ${ke.toFixed(2)}) — no chatter`);
  ok(r.worst < SKIN * 0.6, `and it never breached during the whole approach (deepest ${r.worst.toFixed(3)})`);
}

// ---------------------------------------------------------------- 6) several obstacles at once
{
  const reef = [{ x: -6, y: 8, r: 4 }, { x: 4, y: -6, r: 5 }, { x: 14, y: 4, r: 3 }];
  const r = drive(reef, 1200, 3.0);
  ok(r.fin, "a reef of several obstacles stays finite");
  ok(r.worst < SKIN * 0.6, `nothing gets inside any of them (deepest ${r.worst.toFixed(3)})`);
}

console.log(fail ? `contact_ref: ${fail} FAIL` : "contact_ref: PASS");
process.exit(fail ? 1 : 0);

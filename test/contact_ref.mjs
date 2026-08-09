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


// ---------------------------------------------------------------- 7) SELF-CONTACT — a body that cannot pass through ITSELF
// The hard half. Every segment against every other, changing every frame, so it buckets into a
// uniform grid and tests only the nine cells around each segment. Two things must be skipped or
// the law tears the body apart instead of protecting it: bonded near-neighbours (touching BY
// CONSTRUCTION — a contradiction the two laws would fight over forever) and every pair twice.
{
  const R = bond.rest * 0.55, SKIP = 4;

  // a body forced into a tight coil, which is exactly where a line crosses itself
  const coil = (selfOn, turns) => {
    const N = 160, st = mk(N, N); st.par = S.chain(N);
    let a = 0, rad = bond.rest * 5;
    for (let i = 0; i < N; i++) { st.pos[i*3] = Math.cos(a)*rad; st.pos[i*3+1] = Math.sin(a)*rad; a += (turns*6.283185307)/N; }
    const acc = new Float64Array(N*3);
    const sub = 8*(bond.substeps||1), dt = 1/60/sub;
    for (let q = 0; q < 700*sub; q++) {
      acc.fill(0);
      S.accel(bond, st.pos, st.vel, st.par, N, acc);
      for (let i = 0; i < N; i++) { acc[i*3] -= st.vel[i*3]*1.2; acc[i*3+1] -= st.vel[i*3+1]*1.2; }
      if (selfOn) C.self(st.pos, st.vel, st.par, N, 0, acc, { r: R, skip: SKIP });
      for (let i = 0; i < N; i++) for (let k = 0; k < 2; k++) { st.vel[i*3+k] += acc[i*3+k]*dt; st.pos[i*3+k] += st.vel[i*3+k]*dt; }
    }
    let fin = true; for (let i = 0; i < N*3; i++) if (!Number.isFinite(st.pos[i])) fin = false;
    let contour = 0; for (let i = 1; i < N; i++) contour += Math.hypot(st.pos[i*3]-st.pos[(i-1)*3], st.pos[i*3+1]-st.pos[(i-1)*3+1]);
    return { st, N, fin, worst: C.worstSelf(st.pos, N, 0, R, SKIP), stretch: contour/(bond.rest*(N-1)) };
  };

  const off = coil(false, 3), on = coil(true, 3);
  ok(on.fin, "a self-avoiding body stays finite");
  ok(off.worst > R * 0.8, `WITHOUT the law a tight coil runs through itself (overlap ${off.worst.toFixed(2)} vs radius ${R.toFixed(2)})`);
  ok(on.worst < off.worst * 0.12, `WITH it the overlap all but vanishes (${on.worst.toFixed(3)} vs ${off.worst.toFixed(2)}) — it KEEPS MATTER OUT, it does not merely push back`);
  ok(on.stretch < 1.2, `and the body is not torn doing it (stretch ${on.stretch.toFixed(2)})`);

  // MOMENTUM: a body may not push itself
  {
    const N = 60, st = mk(N, N); st.par = S.chain(N);
    let a = 0; for (let i = 0; i < N; i++) { st.pos[i*3] = Math.cos(a)*bond.rest*3; st.pos[i*3+1] = Math.sin(a)*bond.rest*3; a += (2*6.283185307)/N; }
    const acc = new Float64Array(N*3);
    C.self(st.pos, st.vel, st.par, N, 0, acc, { r: R, skip: SKIP });
    let fx = 0, fy = 0; for (let i = 0; i < N; i++) { fx += acc[i*3]; fy += acc[i*3+1]; }
    ok(Math.hypot(fx, fy) < 1e-9, `self-contact has zero net force (${Math.hypot(fx,fy).toExponential(1)}) — a body cannot push itself`);
  }

  // BONDED NEIGHBOURS ARE LEFT ALONE — a straight body must feel nothing
  {
    const N = 40, st = mk(N, N); st.par = S.chain(N);
    for (let i = 0; i < N; i++) st.pos[i*3] = i * bond.rest;   // rest < 2R, so neighbours DO overlap
    const acc = new Float64Array(N*3);
    C.self(st.pos, st.vel, st.par, N, 0, acc, { r: R, skip: SKIP });
    ok(acc.every((v) => v === 0), "a straight body feels NOTHING — bonded neighbours are exempt, not fought");
  }

  // opt-in and cheap
  {
    const N = 240, st = mk(N, N); st.par = S.chain(N);
    let a = 0; for (let i = 0; i < N; i++) { st.pos[i*3] = Math.cos(a)*bond.rest*8; st.pos[i*3+1] = Math.sin(a)*bond.rest*8; a += (5*6.283185307)/N; }
    const acc = new Float64Array(N*3);
    const t0 = process.hrtime.bigint();
    for (let q = 0; q < 500; q++) { acc.fill(0); C.self(st.pos, st.vel, st.par, N, 0, acc, { r: R, skip: SKIP }); }
    const ms = Number(process.hrtime.bigint()-t0)/1e6/500;
    ok(ms < 1.2, `240 segments cost ${ms.toFixed(3)} ms/call — the grid keeps it affordable`);
    const z = new Float64Array(N*3);
    C.self(st.pos, st.vel, st.par, N, 0, z, { r: 0 });
    ok(z.every((v) => v === 0), "radius 0 does nothing — the law is opt-in");
  }
}


// ---------------------------------------------------------------- 8) THE PER-PAIR CEILING
// A deep overlap produces an unbounded force, and an unbounded force fires ONE agent out of the
// mass while the rest sit — which reads as popping rather than as a body (Bill's "popcorn",
// 2026-08-08). The ceiling must go on the PAIR, not the agent: clamping an agent's total makes
// the two sides clamp by different amounts, forces stop being equal and opposite, and the clump
// pushes itself. Measured on a 96-agent clump: per-agent clamping gave net force 174; per-pair
// gives 2e-13.
{
  const N = 96, RR = 1.0;
  let seed = 20260808;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pos = new Float64Array(N*3), vel = new Float64Array(N*3);
  for (let i = 0; i < N; i++) {
    let x, y, z, d;
    do { x = rnd()*2-1; y = rnd()*2-1; z = rnd()*2-1; d = x*x+y*y+z*z; } while (d > 1);
    pos[i*3] = x*2.6; pos[i*3+1] = y*2.6; pos[i*3+2] = z*2.6;
    vel[i*3] = (rnd()*2-1)*1.4; vel[i*3+1] = (rnd()*2-1)*1.4; vel[i*3+2] = (rnd()*2-1)*1.4;
  }
  const par = new Int32Array(N).fill(-1);
  const run = (max) => {
    const acc = new Float64Array(N*3);
    C.self(pos, vel, par, N, 0, acc, { r: RR, k: 45, damp: 4, skip: -1, max });
    let worst = 0, nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < N; i++) {
      worst = Math.max(worst, Math.hypot(acc[i*3], acc[i*3+1], acc[i*3+2]));
      nx += acc[i*3]; ny += acc[i*3+1]; nz += acc[i*3+2];
    }
    return { worst, net: Math.hypot(nx, ny, nz) };
  };
  const free = run(0), capped = run(12);
  ok(free.net < 1e-9, `uncapped, the clump conserves momentum (${free.net.toExponential(1)})`);
  ok(capped.worst < free.worst * 0.5,
     `the ceiling tames the worst agent (${free.worst.toFixed(0)} → ${capped.worst.toFixed(0)}) — no single collision fires a shard`);
  ok(capped.net < 1e-9,
     `and momentum SURVIVES the ceiling (${capped.net.toExponential(1)}) — because the PAIR is clamped, not the agent`);
  ok(run(0).worst === free.worst, "max 0 means no ceiling — historical behaviour is opt-out");
}


// ---------------------------------------------------------------- 8) THE CELL KEY MUST BE INJECTIVE
// The broadphase key has to be one-to-one over the neighbourhoods actually walked, or a bucket
// gets visited twice and every pair inside it is counted TWICE. The obvious `a*P1 ^ b*P2` is
// not: xor collapses whenever a term is zero, so cell (0,0)'s nine-cell neighbourhood yielded
// only SEVEN distinct keys — and a clump centred on the origin lands squarely in it. Caught by
// parity_contact.html on 2026-08-08, which put the CPU law 3.7e+1 from the GPU kernel while
// both were individually correct. The consequence is silent and position-dependent, which is
// the worst kind, so it is guarded here rather than trusted.
{
  // a) the fix, structurally: every 3x3 neighbourhood yields nine distinct keys
  const key = (a, b) => a * 4194304 + b;
  let bad = 0;
  for (let cx = -600; cx <= 600; cx += 13) for (let cy = -600; cy <= 600; cy += 13) {
    const ks = new Set();
    for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) ks.add(key(cx + gx, cy + gy));
    if (ks.size !== 9) bad++;
  }
  ok(bad === 0, `the cell key is injective over every neighbourhood tested (${bad} collisions)`);

  // b) the fix, behaviourally: a clump ON THE ORIGIN must match brute force exactly.
  //    This is the case the old key got wrong, so it is the case worth pinning.
  const N = 96, r = 1.0, k = 45, damp = 4, maxF = 12, DD = r * 2;
  let seed = 20260808;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const P = new Float64Array(N * 3), V = new Float64Array(N * 3);
  for (let i = 0; i < N; i++) {
    let x, y, z, q;
    do { x = rnd()*2-1; y = rnd()*2-1; z = rnd()*2-1; q = x*x+y*y+z*z; } while (q > 1);
    P[i*3] = x*2.6; P[i*3+1] = y*2.6; P[i*3+2] = z*2.6;
    V[i*3] = (rnd()*2-1)*1.4; V[i*3+1] = (rnd()*2-1)*1.4; V[i*3+2] = (rnd()*2-1)*1.4;
  }
  const par = new Int32Array(N).fill(-1);
  const viaGrid = new Float64Array(N * 3);
  C.self(P, V, par, N, 0, viaGrid, { r, k, damp, skip: -1, max: maxF });

  const brute = new Float64Array(N * 3);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (j === i) continue;
    const dx = P[i*3]-P[j*3], dy = P[i*3+1]-P[j*3+1], dz = P[i*3+2]-P[j*3+2];
    const d2 = dx*dx + dy*dy + dz*dz;
    if (d2 >= DD*DD || d2 < 1e-12) continue;
    const d = Math.sqrt(d2), nx = dx/d, ny = dy/d, nz = dz/d;
    let f = (DD - d) * k;
    const vn = (V[i*3]-V[j*3])*nx + (V[i*3+1]-V[j*3+1])*ny + (V[i*3+2]-V[j*3+2])*nz;
    if (vn < 0) f -= vn * damp;
    if (f > maxF) f = maxF;
    brute[i*3] += nx*f*0.5; brute[i*3+1] += ny*f*0.5; brute[i*3+2] += nz*f*0.5;
  }
  let worst = 0;
  for (let i = 0; i < N; i++) worst = Math.max(worst, Math.hypot(
    viaGrid[i*3]-brute[i*3], viaGrid[i*3+1]-brute[i*3+1], viaGrid[i*3+2]-brute[i*3+2]));
  ok(worst < 1e-9, `a 96-agent clump ON THE ORIGIN matches brute force (worst ${worst.toExponential(2)}, was 3.7e+1)`);

  let net = [0, 0, 0];
  for (let i = 0; i < N; i++) { net[0] += viaGrid[i*3]; net[1] += viaGrid[i*3+1]; net[2] += viaGrid[i*3+2]; }
  ok(Math.hypot(net[0], net[1], net[2]) < 1e-9, "…and it still cannot push itself");
}

console.log(fail ? `contact_ref: ${fail} FAIL` : "contact_ref: PASS");
process.exit(fail ? 1 : 0);

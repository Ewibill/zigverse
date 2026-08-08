// volume_ref.mjs — the 3D claim, tested. (ZigCore 0.17)
//
// Every proof written on 2026-08-07 ran in a PLANE, while the laws claim to be three-
// dimensional: `axis` parameters, three-vectors throughout, Rodrigues rotation in the bend
// target. That is an untested assertion sitting in shipped code, and it would surface the
// moment a species goes volumetric. This file tests it before the WGSL splice, not after.
//
// Proves in FULL 3D: bonds hold on an arbitrary axis · bend still adds no radial force ·
// force AND torque conserve as 3-vectors on a non-planar (helical) body · refinement stays
// invariant out of plane · undulation obeys an arbitrary wave-plane axis · slip resolves
// along/across in 3D · contact excludes in 3D · self-contact's 2D broadphase is still
// CORRECT in 3D (and how much it costs).

import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
const ZC = globalThis.ZigCore, S = ZC.Structure, C = ZC.Contact;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const H = 20;
const spine = ZC.Env.bond("spine", H);
const mk = (n, cap) => ({ n, head: 0, pos: new Float64Array((cap||n)*3), vel: new Float64Array((cap||n)*3), par: new Int32Array(cap||n).fill(-1) });
const dist = (p,a,b) => Math.hypot(p[a*3]-p[b*3], p[a*3+1]-p[b*3+1], p[a*3+2]-p[b*3+2]);
const norm = (v) => { const L = Math.hypot(v[0],v[1],v[2]); return [v[0]/L, v[1]/L, v[2]/L]; };

function sim(bond, st, steps, dt, kappa) {
  const acc = new Float64Array(st.pos.length);
  for (let q = 0; q < steps; q++) {
    acc.fill(0);
    S.accel(bond, st.pos, st.vel, st.par, st.n, acc, kappa);
    for (let i = 0; i < st.n; i++) for (let k = 0; k < 3; k++) {
      st.vel[i*3+k] += acc[i*3+k]*dt; st.pos[i*3+k] += st.vel[i*3+k]*dt;
    }
  }
}

// ---------------------------------------------------------------- 1) a bond on an arbitrary axis
{
  const u = norm([0.37, -0.62, 0.69]);                      // nothing special about this direction
  const st = mk(2); st.par = S.chain(2);
  for (let k = 0; k < 3; k++) st.pos[3+k] = u[k] * spine.rest * 2.6;
  sim(spine, st, 6000, 0.001);
  ok(Math.abs(dist(st.pos,0,1) - spine.rest) < spine.rest*0.05,
     `a stretched bond returns to rest off-axis (${dist(st.pos,0,1).toFixed(3)} vs ${spine.rest})`);
}

// ---------------------------------------------------------------- 2) bend adds no radial force in 3D
{
  const st = mk(3); st.par = S.chain(3);
  const r = spine.rest;
  st.pos.set([0,0,0,  r*0.6, r*0.5, r*0.62,  r*0.6, r*0.5+r*0.7, r*0.62-r*0.71]);  // a corner out of plane
  const acc = new Float64Array(9);
  S.accel(spine, st.pos, st.vel, st.par, 3, acc);
  const u = norm([st.pos[6]-st.pos[3], st.pos[7]-st.pos[4], st.pos[8]-st.pos[5]]);
  const radial = acc[6]*u[0] + acc[7]*u[1] + acc[8]*u[2];
  const spring = -(dist(st.pos,2,1) - r) * spine.k;
  ok(Math.abs(radial - spring) < 1e-9,
     `bend is purely lateral in 3D too (radial ${radial.toFixed(6)} = spring ${spring.toFixed(6)})`);
  const lat = Math.hypot(acc[6]-u[0]*radial, acc[7]-u[1]*radial, acc[8]-u[2]*radial);
  ok(lat > 1e-6, "…and it does act laterally out of plane");
}

// ---------------------------------------------------------------- 3) force AND torque conserve as 3-VECTORS on a helix
// The planar proof only ever checked the z component of torque. A helix is genuinely
// non-planar, so all three components have to vanish.
{
  const N = 14, st = mk(N); st.par = S.chain(N);
  const r = spine.rest;
  for (let i = 0; i < N; i++) {
    const a = i * 0.55;
    st.pos[i*3] = Math.cos(a)*r*2.2; st.pos[i*3+1] = Math.sin(a)*r*2.2; st.pos[i*3+2] = i*r*0.45;
  }
  const acc = new Float64Array(N*3);
  S.accel(spine, st.pos, st.vel, st.par, N, acc);
  let f = [0,0,0], t = [0,0,0];
  for (let i = 0; i < N; i++) {
    const x=st.pos[i*3], y=st.pos[i*3+1], z=st.pos[i*3+2];
    const ax=acc[i*3], ay=acc[i*3+1], az=acc[i*3+2];
    f[0]+=ax; f[1]+=ay; f[2]+=az;
    t[0] += y*az - z*ay; t[1] += z*ax - x*az; t[2] += x*ay - y*ax;
  }
  ok(Math.hypot(f[0],f[1],f[2]) < 1e-9, `a helix has zero net FORCE in 3D (${Math.hypot(f[0],f[1],f[2]).toExponential(1)})`);
  ok(Math.hypot(t[0],t[1],t[2]) < 1e-9,
     `a helix has zero net TORQUE on ALL THREE AXES (${Math.hypot(t[0],t[1],t[2]).toExponential(1)}) — the planar proof only ever checked z`);
}

// ---------------------------------------------------------------- 4) refinement is invariant out of plane
{
  const u = norm([0.5, 0.3, 0.81]), g = norm([-0.2, 0.9, -0.38]);
  const LEN = spine.rest * 20;
  const cantilever = (N, bond, sub) => {
    const st = mk(N+1, N+1); st.par = S.chain(N+1);
    for (let i = 0; i <= N; i++) for (let k = 0; k < 3; k++) st.pos[i*3+k] = u[k]*i*bond.rest;
    const acc = new Float64Array((N+1)*3), dt = 1/60/sub;
    for (let q = 0; q < 6000*sub; q++) {
      acc.fill(0); S.accel(bond, st.pos, st.vel, st.par, st.n, acc);
      for (let i = 0; i < st.n; i++) for (let k = 0; k < 3; k++) { acc[i*3+k] += g[k]*2.0; acc[i*3+k] -= st.vel[i*3+k]*0.9; }
      for (let i = 0; i < st.n; i++) { if (st.par[i] < 0) { st.vel[i*3]=st.vel[i*3+1]=st.vel[i*3+2]=0; continue; }
        for (let k = 0; k < 3; k++) { st.vel[i*3+k] += acc[i*3+k]*dt; st.pos[i*3+k] += st.vel[i*3+k]*dt; } }
    }
    let contour = 0; for (let i = 1; i <= N; i++) contour += dist(st.pos, i, i-1);
    return contour / LEN;
  };
  const base = { ...spine, rest: LEN/20, anchor: true };
  const r1 = cantilever(20, base, 1);
  for (const factor of [2, 4]) {
    const rb = S.refine(base, factor);
    const rr = cantilever(20*factor, rb, rb.substeps);
    ok(Math.abs(rr - r1) < 0.03, `factor ${factor} invariant on an off-axis body (${rr.toFixed(3)} vs ${r1.toFixed(3)})`);
  }
}

// ---------------------------------------------------------------- 5) undulation obeys an arbitrary wave plane
{
  const N = 40, bond = { ...S.refine(spine, 2), axis: norm([0.3, 0.5, 0.81]) };
  const st = mk(N); st.par = S.chain(N);
  const along = norm([0.9, -0.35, -0.11]);
  for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) st.pos[i*3+k] = along[k]*i*bond.rest;
  const kap = new Float64Array(N);
  S.undulate(st.par, N, 0, kap, { amp: 0.9, waves: 2, taper: 0.6, phase: 0.7 });
  ok(kap.some((v) => Math.abs(v) > 0.1), "the wave writes non-zero curvature");
  sim(bond, st, 4000, 0.0005, kap);
  let contour = 0; for (let i = 1; i < N; i++) contour += dist(st.pos, i, i-1);
  ok(contour/(bond.rest*(N-1)) < 1.25, `an off-axis body is not torn by the wave (stretch ${(contour/(bond.rest*(N-1))).toFixed(3)})`);
  // the body must bend AROUND the declared axis, i.e. stay in the plane normal to it
  let outOfPlane = 0;
  for (let i = 0; i < N; i++) {
    const d = [st.pos[i*3]-st.pos[0], st.pos[i*3+1]-st.pos[1], st.pos[i*3+2]-st.pos[2]];
    outOfPlane = Math.max(outOfPlane, Math.abs(d[0]*bond.axis[0] + d[1]*bond.axis[1] + d[2]*bond.axis[2]));
  }
  ok(outOfPlane < bond.rest * 1.5, `the wave stays in the plane normal to its axis (drift ${outOfPlane.toFixed(3)})`);
}

// ---------------------------------------------------------------- 6) slip resolves along/across in 3D
{
  const st = mk(2); st.par = S.chain(2);
  const u = norm([0.4, 0.5, 0.77]);
  for (let k = 0; k < 3; k++) st.pos[3+k] = u[k]*spine.rest;
  const lat = norm([u[1]*1 - u[2]*0, u[2]*0 - u[0]*1, u[0]*0 - u[1]*0]);
  for (let k = 0; k < 3; k++) { st.vel[3+k] = u[k]*2.0; }        // pure ALONG
  const a1 = new Float64Array(6); S.slip(st.pos, st.vel, st.par, 2, 0, a1, { along: 0.2, across: 6.0 });
  const dragAlong = Math.hypot(a1[3],a1[4],a1[5]);
  for (let k = 0; k < 3; k++) { st.vel[3+k] = lat[k]*2.0; }      // pure ACROSS
  const a2 = new Float64Array(6); S.slip(st.pos, st.vel, st.par, 2, 0, a2, { along: 0.2, across: 6.0 });
  const dragAcross = Math.hypot(a2[3],a2[4],a2[5]);
  ok(dragAcross > dragAlong * 20, `slip is anisotropic in 3D (across ${dragAcross.toFixed(2)} vs along ${dragAlong.toFixed(2)})`);
}

// ---------------------------------------------------------------- 7) contact excludes in 3D
{
  const st = mk(1); st.pos.set([1.2, -0.8, 0.9]);
  const acc = new Float64Array(3);
  C.exclude(st.pos, st.vel, 1, 0, acc, [{ x: 0, y: 0, z: 0, r: 4 }], { skin: 0 });
  const d = Math.hypot(1.2, -0.8, 0.9);
  const u = [1.2/d, -0.8/d, 0.9/d];
  const proj = acc[0]*u[0] + acc[1]*u[1] + acc[2]*u[2];
  ok(proj > 0 && Math.abs(Math.hypot(acc[0],acc[1],acc[2]) - proj) < 1e-9,
     "a 3D sphere pushes straight out along the 3D normal");
}

// ---------------------------------------------------------------- 8) self-contact: is the 2D broadphase still CORRECT in 3D?
// The grid buckets on x,y only. That is still correct — if two segments are within D in 3D
// then they are within D in x and in y, so they land in adjacent cells — but a body that is
// tall in z crowds many segments into the same column, and the cost of that is worth knowing.
{
  const R = spine.rest * 0.55, SKIP = 4, N = 200;
  const helix = mk(N); helix.par = S.chain(N);
  for (let i = 0; i < N; i++) {
    const a = i*0.31;
    helix.pos[i*3] = Math.cos(a)*spine.rest*2.0; helix.pos[i*3+1] = Math.sin(a)*spine.rest*2.0; helix.pos[i*3+2] = i*spine.rest*0.30;
  }
  const acc = new Float64Array(N*3);
  C.self(helix.pos, helix.vel, helix.par, N, 0, acc, { r: R, skip: SKIP });
  // brute force the same thing and compare
  const ref = new Float64Array(N*3);
  const D = R*2, k = 6000;
  for (let i = 0; i < N; i++) for (let j = i+SKIP+1; j < N; j++) {
    const dx=helix.pos[i*3]-helix.pos[j*3], dy=helix.pos[i*3+1]-helix.pos[j*3+1], dz=helix.pos[i*3+2]-helix.pos[j*3+2];
    const d2=dx*dx+dy*dy+dz*dz; if (d2 >= D*D) continue;
    const d=Math.sqrt(d2)||1e-6, f=(D-d)*k*0.5;
    ref[i*3]+=dx/d*f; ref[i*3+1]+=dy/d*f; ref[i*3+2]+=dz/d*f;
    ref[j*3]-=dx/d*f; ref[j*3+1]-=dy/d*f; ref[j*3+2]-=dz/d*f;
  }
  let worst = 0; for (let i = 0; i < N*3; i++) worst = Math.max(worst, Math.abs(acc[i]-ref[i]));
  ok(worst < 1e-9, `the grid finds EXACTLY what brute force finds on a helix (max diff ${worst.toExponential(1)})`);

  let f3 = [0,0,0]; for (let i = 0; i < N; i++) { f3[0]+=acc[i*3]; f3[1]+=acc[i*3+1]; f3[2]+=acc[i*3+2]; }
  ok(Math.hypot(f3[0],f3[1],f3[2]) < 1e-9, "self-contact conserves momentum in 3D");

  const t0 = process.hrtime.bigint();
  for (let q = 0; q < 300; q++) { acc.fill(0); C.self(helix.pos, helix.vel, helix.par, N, 0, acc, { r: R, skip: SKIP }); }
  const ms = Number(process.hrtime.bigint()-t0)/1e6/300;
  ok(ms < 3, `a 200-segment helix costs ${ms.toFixed(3)} ms/call — the xy-only grid is affordable in 3D`);
}

console.log(fail ? `volume_ref: ${fail} FAIL` : "volume_ref: PASS");
process.exit(fail ? 1 : 0);

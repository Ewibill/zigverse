// structure_ref.mjs — CPU proof of the STRUCTURE law (matter that is JOINED, ZigCore 0.13).
// Where a boundary contains a mass from OUTSIDE, a bond holds it together from INSIDE: the
// difference between a cloud of agents that happen to fly near each other and a BODY that
// cannot come apart. Topology is a parent index (par[i] = parent, -1 = root), which expresses
// chain / tree / anchored-stalk / free-swimmer without new machinery — and lets a body GROW by
// appending, so a performed stream builds the organism note by note.
//
// Proves: archetypes resolve frame-scaled · a stretched link pulls back to rest · a compressed
// link pushes out · damping settles a ringing body (and does NOT kill lateral swing) · bend
// spans rope→spine (a spine straightens, a rope does not) · Newton's third holds so a free body
// conserves momentum · an anchored root stays home while the body sways · growth appends along
// the body's own heading · age() reads position-along-body as normalized time.

import { readFileSync } from "fs";
const code = readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8");
(0, eval)(code);
const ZC = globalThis.ZigCore;
const S = ZC.Structure;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const H = 20;

/* a minimal integrator — the engine's compute pass does exactly this order */
function sim(bond, st, steps, dt, extra) {
  const n0 = st.n, acc = new Float64Array(st.pos.length);
  for (let s = 0; s < steps; s++) {
    acc.fill(0);
    S.accel(bond, st.pos, st.vel, st.par, st.n, acc);
    if (extra) extra(st, acc, s);
    for (let i = 0; i < st.n; i++) {
      if (bond.anchor && st.par[i] < 0) { st.vel[i * 3] = st.vel[i * 3 + 1] = st.vel[i * 3 + 2] = 0; continue; }
      for (let k = 0; k < 3; k++) {
        st.vel[i * 3 + k] += acc[i * 3 + k] * dt;
        st.pos[i * 3 + k] += st.vel[i * 3 + k] * dt;
      }
    }
  }
  return n0;
}
const mk = (n, cap) => ({ n, pos: new Float64Array((cap || n) * 3), vel: new Float64Array((cap || n) * 3), par: new Int32Array(cap || n).fill(-1) });
const dist = (p, a, b) => Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);

// ---------------------------------------------------------------- 0) archetypes
const chain = ZC.Env.bond("chain", H), spine = ZC.Env.bond("spine", H);
const stalk = ZC.Env.bond("stalk", H), tether = ZC.Env.bond("tether", H);
ok(ZC.Env.bond("none", H) === null, "none resolves to null — the law is opt-in");
ok(chain.rest === 0.11 * H, `chain rest is frame-scaled (${chain.rest})`);
ok(tether.rest > chain.rest, "tether is the long leash");
ok(spine.bend > chain.bend && chain.bend === 0, "bend spans rope(0) → spine(>0)");
ok(stalk.anchor === true && chain.anchor === false, "only the stalk is rooted");

// ---------------------------------------------------------------- 1) topology
const p5 = S.chain(5);
ok(p5[0] === -1, "chain root has no parent");
ok(p5[1] === 0 && p5[4] === 3, "chain links each agent to the one before");

// ---------------------------------------------------------------- 2) spring restores rest length
{
  const st = mk(2); st.par = S.chain(2);
  st.pos[3] = chain.rest * 2.5;                       // stretched well past rest
  sim(chain, st, 4000, 0.002);
  ok(Math.abs(dist(st.pos, 0, 1) - chain.rest) < chain.rest * 0.05,
     `stretched link returns to rest (${dist(st.pos, 0, 1).toFixed(3)} vs ${chain.rest})`);
}
{
  const st = mk(2); st.par = S.chain(2);
  st.pos[3] = chain.rest * 0.2;                       // compressed
  const d0 = dist(st.pos, 0, 1);
  sim(chain, st, 200, 0.002);
  ok(dist(st.pos, 0, 1) > d0, "compressed link pushes back out");
}

// ---------------------------------------------------------------- 3) damping settles the ring
{
  const und = { ...chain, damp: 0 }, st = mk(2), su = mk(2);
  st.par = S.chain(2); su.par = S.chain(2);
  st.pos[3] = chain.rest * 2.0; su.pos[3] = chain.rest * 2.0;
  sim(chain, st, 3000, 0.002); sim(und, su, 3000, 0.002);
  const eD = Math.abs(dist(st.pos, 0, 1) - chain.rest), eU = Math.abs(dist(su.pos, 0, 1) - chain.rest);
  ok(eD < eU, `damping settles the body (err ${eD.toFixed(4)} < undamped ${eU.toFixed(4)})`);
}
{
  // damping is ALONG the link only — a body must still be free to swing sideways
  const st = mk(2); st.par = S.chain(2);
  st.pos[3] = chain.rest; st.vel[4] = 3.0;            // lateral velocity, link already at rest
  const acc = new Float64Array(6);
  S.accel(chain, st.pos, st.vel, st.par, 2, acc);
  ok(Math.hypot(acc[3], acc[4], acc[5]) < 1e-6, "pure lateral motion is NOT damped — a chain still swings");
}

// ---------------------------------------------------------------- 4) bend: rope vs spine
{
  // start a 4-link body folded into a right angle; a spine should straighten, a rope should not
  const fold = (b) => {
    const st = mk(4); st.par = S.chain(4);
    const r = b.rest;
    st.pos.set([0, 0, 0,  r, 0, 0,  2 * r, 0, 0,  2 * r, r, 0]);   // last segment kinks 90°
    sim(b, st, 3000, 0.001);
    // straightness = |p3 - p0| / (3 * rest);  1.0 is perfectly straight
    return Math.hypot(st.pos[9] - st.pos[0], st.pos[10] - st.pos[1], st.pos[11] - st.pos[2]) / (3 * r);
  };
  const sSpine = fold(spine), sRope = fold(chain);
  ok(sSpine > sRope, `a spine straightens more than a rope (${sSpine.toFixed(3)} > ${sRope.toFixed(3)})`);
  ok(sSpine > 0.9, `a spine holds its line (${sSpine.toFixed(3)})`);
  ok(sRope < 0.98, `a rope keeps the kink (${sRope.toFixed(3)})`);
}

// ---------------------------------------------------------------- 5) Newton's third — a free body conserves momentum
{
  const st = mk(6); st.par = S.chain(6);
  for (let i = 0; i < 6; i++) { st.pos[i * 3] = i * chain.rest * 1.4; st.vel[i * 3 + 1] = (i % 2 ? 0.6 : -0.6); }
  const mom = () => { let m = [0, 0, 0]; for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) m[k] += st.vel[i * 3 + k]; return m; };
  const m0 = mom();
  sim(chain, st, 2000, 0.001);
  const m1 = mom();
  ok(Math.hypot(m1[0] - m0[0], m1[1] - m0[1], m1[2] - m0[2]) < 1e-6,
     "free body conserves total momentum — it swims, it does not haul itself");
}

// ---------------------------------------------------------------- 6) an anchored stalk stays home
{
  const st = mk(6); st.par = S.chain(6);
  for (let i = 0; i < 6; i++) st.pos[i * 3 + 1] = i * stalk.rest;
  // a steady sideways current on every segment — kelp in a stream
  sim(stalk, st, 2500, 0.001, (s, acc) => { for (let i = 0; i < s.n; i++) acc[i * 3] += 2.0; });
  ok(Math.hypot(st.pos[0], st.pos[1], st.pos[2]) < 1e-9, "the holdfast never moves");
  ok(st.pos[15] > stalk.rest * 0.5, `the tip sways downstream (x ${st.pos[15].toFixed(2)})`);
  const span = Math.hypot(st.pos[15] - st.pos[0], st.pos[16] - st.pos[1], st.pos[17] - st.pos[2]);
  ok(span < 5 * stalk.rest * 1.15, `the body BENDS rather than stretching apart (${(span / (5 * stalk.rest)).toFixed(3)}x contour)`);
}
{
  // it is a real spring, not a rigid cheat: stretch scales with load, monotonically.
  // (A body that must not stretch at all is a different technique — position-based
  //  constraints — and a later law if a species ever needs one.)
  const link = (cur) => {
    const st = mk(6); st.par = S.chain(6);
    for (let i = 0; i < 6; i++) st.pos[i * 3 + 1] = i * stalk.rest;
    sim(stalk, st, 2500, 0.001, (s, acc) => { for (let i = 0; i < s.n; i++) acc[i * 3] += cur; });
    return dist(st.pos, 0, 1) / stalk.rest;
  };
  const l1 = link(1), l3 = link(3), l9 = link(9);
  ok(l1 < l3 && l3 < l9, `stretch scales with load (${l1.toFixed(2)}x < ${l3.toFixed(2)}x < ${l9.toFixed(2)}x rest)`);
  ok(l1 < 1.1, `a light current barely stretches the holdfast link (${l1.toFixed(3)}x)`);
}

// ---------------------------------------------------------------- 7) GROWTH — the performed body
{
  const st = mk(1, 64);
  st.pos.set([0, 0, 0]);
  const i1 = S.grow(st, spine, [0, 1, 0]);            // seed heading
  ok(i1 === 1 && st.n === 2, "grow appends an agent");
  ok(Math.abs(dist(st.pos, 0, 1) - spine.rest) < 1e-9, "the new segment is placed one rest-length out");
  ok(st.par[1] === 0, "the new segment is bonded to the tail");

  for (let i = 0; i < 10; i++) S.grow(st, spine);      // grow along the body's own heading
  ok(st.n === 12, "a stream of notes grows a 12-segment body");
  const straight = Math.hypot(st.pos[33] - st.pos[0], st.pos[34] - st.pos[1], st.pos[35] - st.pos[2]) / (11 * spine.rest);
  ok(straight > 0.999, "growth continues the body's own line");

  // the payoff: position along the body IS time-since-played
  ok(S.age(st.par, 0, 11) === 0, "the root is the oldest — age 0");
  ok(Math.abs(S.age(st.par, 11, 11) - 1) < 1e-9, "the tail is the newest — age 1");
  ok(Math.abs(S.age(st.par, 5, 11) - 5 / 11) < 1e-9, "age reads monotonically along the body");

  // a grown body is a real body: it holds together when shaken
  for (let i = 0; i < st.n; i++) st.vel[i * 3 + 2] = (i % 3) - 1;
  const before = dist(st.pos, 10, 11);
  sim(spine, st, 8000, 0.001);
  ok(Math.abs(dist(st.pos, 10, 11) - spine.rest) < spine.rest * 0.12,
     `a grown body survives being shaken (${before.toFixed(3)} → ${dist(st.pos, 10, 11).toFixed(3)})`);
}

// ---------------------------------------------------------------- 7b) BEND IS PURELY LATERAL
// A bending moment rotates a joint; it must never lengthen or shorten the bond.
// (Before this was enforced, bend fought the spring and a curved body visibly
//  stretched — caught by growth_bench, 2026-08-07.)
{
  const st = mk(3); st.par = S.chain(3);
  const r = spine.rest;
  st.pos.set([0, 0, 0,  r, 0, 0,  r, r, 0]);          // a 90° corner: bend is maximally unhappy
  const acc = new Float64Array(9);
  S.accel(spine, st.pos, st.vel, st.par, 3, acc);
  // the link 1→2 points +y; a radial (stretching) bend component would show up here
  const spring = -(dist(st.pos, 2, 1) - r) * spine.k;  // what the spring alone asks for
  ok(Math.abs(acc[7] - spring) < 1e-9,
     `bend adds NO force along the link (radial ${acc[7].toFixed(6)} = spring ${spring.toFixed(6)})`);
  ok(Math.abs(acc[6]) > 1e-6, "bend does act laterally — the joint is pushed toward straight");

  // and the consequence: a curved body at rest keeps its bonds at rest length
  const cu = mk(9); cu.par = S.chain(9);
  for (let i = 0; i < 9; i++) { const a = i * 0.35; cu.pos[i * 3] = Math.sin(a) * r * 3; cu.pos[i * 3 + 1] = -Math.cos(a) * r * 3; }
  const ke = (s) => { let e = 0; for (let i = 0; i < s.n * 3; i++) e += s.vel[i] * s.vel[i]; return e; };
  sim(spine, cu, 6000, 0.001);
  const keEarly = ke(cu);
  sim(spine, cu, 19000, 0.001);
  let worst = 0; for (let i = 1; i < 9; i++) worst = Math.max(worst, Math.abs(dist(cu.pos, i, cu.par[i]) - r));
  ok(worst < r * 0.1, `a curved body holds rest length everywhere (worst error ${(worst / r).toFixed(3)}x)`);
  ok(ke(cu) < keEarly, `bending motion LOSES energy (${keEarly.toFixed(1)} → ${ke(cu).toFixed(1)}) — a flexing body settles, it does not ring forever`);
}

// ---------------------------------------------------------------- 8) opt-in / byte-identical when off
{
  const st = mk(4); st.par = new Int32Array(4).fill(-1);   // no bonds declared
  const acc = new Float64Array(12);
  S.accel(chain, st.pos, st.vel, st.par, 4, acc);
  ok(acc.every((v) => v === 0), "an unbonded field is untouched — the law is opt-in");
}


// ---------------------------------------------------------------- 9) THE TRAVELLING BODY (turnover on a chain)
// Unbounded growth turns a creature into a thread: the camera must pull back to hold a
// longer body, so every segment shrinks toward a dot. A bounded body stays legible and,
// because it sheds its tail as fast as it grows its head, it TRAVELS. This is the Canon's
// `turnover` law (life, 0.2.1) applied to a BODY instead of a field of strangers — a Zigpede.
{
  const st = mk(1, 4000); st.head = 0;
  let hd = [0, 1, 0];
  const turn = (semis) => { const t = semis * 0.13, c = Math.cos(t), s = Math.sin(t);
    const x = hd[0]*c - hd[1]*s, y = hd[0]*s + hd[1]*c, L = Math.hypot(x, y) || 1; hd = [x/L, y/L, 0]; };
  for (let q = 0; q < 400; q++) { turn(2); S.live(st, spine, 24, hd); }

  ok(S.length(st) === 24, `400 notes, span 24 → body holds ${S.length(st)} segments`);
  ok(st.n < 200, `the buffer stays bounded — compaction works (n=${st.n} after 400 notes)`);

  // the live body is one intact chain ending at head
  let walk = 0, k = st.n - 1;
  while (st.par[k] >= 0 && walk < 500) { k = st.par[k]; walk++; }
  ok(walk === 23, `the living body is one intact chain (${walk + 1} segments)`);
  ok(k === st.head, "…whose root is exactly the head — the retired past is detached");

  // age still spans the window: time-since-played within LIVING MEMORY
  const d = S.length(st) - 1;
  ok(S.age(st.par, st.head, d) === 0 && Math.abs(S.age(st.par, st.n - 1, d) - 1) < 1e-9,
     "age still spans 0→1 — over a moving window instead of the whole session");

  // and it TRAVELS: the body's centre moves far from where it began
  let cx = 0, cy = 0;
  for (let i = st.head; i < st.n; i++) { cx += st.pos[i*3]; cy += st.pos[i*3+1]; }
  cx /= S.length(st); cy /= S.length(st);
  ok(Math.hypot(cx, cy) > spine.rest * 3, `the body has TRAVELLED from its origin (${Math.hypot(cx,cy).toFixed(1)} units)`);

  // a travelling body is still a real body under the law
  const acc9 = new Float64Array(st.pos.length);
  S.accel(spine, st.pos, st.vel, st.par, st.n, acc9);
  let fin = true; for (let i = st.head*3; i < st.n*3; i++) if (!Number.isFinite(acc9[i])) fin = false;
  ok(fin, "the law runs cleanly across a compacted, travelling body");
}

// ---------------------------------------------------------------- 10) turnover is OPT-IN
{
  const st = mk(1, 200); st.head = 0;
  for (let q = 0; q < 30; q++) S.grow(st, spine);      // grow() alone never retires
  ok(st.n === 31 && (st.head || 0) === 0, "grow() alone accumulates — turnover is opt-in via live()");
}


// ---------------------------------------------------------------- 11) REFINE — resolution without cost
// The same body made of more, shorter segments must behave IDENTICALLY, or "more detail"
// silently means "a different creature". Stiffness must scale as factor² (N segments in
// series carry N× the load at 1/N the rest length), damping linearly, bend not at all.
{
  const base = ZC.Env.bond("stalk", H), LEN = base.rest * 20;
  const cantilever = (N, bond, sub) => {
    const st = mk(N + 1, N + 1); st.par = S.chain(N + 1);
    for (let i = 0; i <= N; i++) st.pos[i * 3] = i * bond.rest;
    const acc = new Float64Array((N + 1) * 3), dt = 1 / 60 / sub;
    for (let q = 0; q < 6000 * sub; q++) {
      acc.fill(0); S.accel(bond, st.pos, st.vel, st.par, st.n, acc);
      for (let i = 0; i < st.n; i++) { acc[i*3+1] -= 2.0; acc[i*3] -= st.vel[i*3]*0.9; acc[i*3+1] -= st.vel[i*3+1]*0.9; }
      for (let i = 0; i < st.n; i++) { if (st.par[i] < 0) { st.vel[i*3] = st.vel[i*3+1] = 0; continue; }
        for (let k = 0; k < 2; k++) { st.vel[i*3+k] += acc[i*3+k]*dt; st.pos[i*3+k] += st.vel[i*3+k]*dt; } }
    }
    let contour = 0, fin = true;
    for (let i = 0; i < st.n * 3; i++) if (!Number.isFinite(st.pos[i])) fin = false;
    for (let i = 1; i < st.n; i++) contour += Math.hypot(st.pos[i*3]-st.pos[(i-1)*3], st.pos[i*3+1]-st.pos[(i-1)*3+1]);
    return { fin, contour: contour / LEN, tipY: st.pos[N*3+1] };
  };

  const r1 = cantilever(20, { ...base, rest: LEN / 20 }, 1);
  for (const f of [2, 4, 8]) {
    const rb = S.refine({ ...base, rest: LEN / 20 }, f);
    const r = cantilever(20 * f, rb, rb.substeps);
    ok(r.fin, `factor ${f} stays finite at its own substeps (${rb.substeps})`);
    ok(Math.abs(r.contour - r1.contour) < 0.02,
       `factor ${f}: same body length (${r.contour.toFixed(3)} vs ${r1.contour.toFixed(3)})`);
    ok(Math.abs(r.tipY - r1.tipY) / Math.abs(r1.tipY) < 0.03,
       `factor ${f}: same tip deflection (${r.tipY.toFixed(1)} vs ${r1.tipY.toFixed(1)})`);
  }

  // the scaling is forced, not decorative — naive refinement makes a DIFFERENT creature
  const naive = cantilever(160, { ...base, rest: LEN / 160 }, 1);
  ok(naive.contour > r1.contour * 1.5,
     `unscaled refinement sags into a longer body (${naive.contour.toFixed(2)}x vs ${r1.contour.toFixed(2)}x) — k must go as factor²`);

  // and substeps are load-bearing, not advice
  const rb8 = S.refine({ ...base, rest: LEN / 20 }, 8);
  ok(!cantilever(160, rb8, 1).fin, "factor 8 at ONE substep goes non-finite — substeps are required");
  ok(rb8.substeps > 1, `refine reports the substeps it needs (${rb8.substeps})`);
  ok(rb8.bend === base.bend, "bend is NOT scaled — bend·k on a 1/factor error stays in proportion");
}


// ---------------------------------------------------------------- 12) THE BEND MOMENT IS HONEST
// A bending moment is a THREE-body force. Applied as an i/p pair it conserves linear
// momentum but leaves a free COUPLE — the body spins for nothing, and under anisotropic
// drag that phantom spin rectifies into phantom locomotion (measured: a "swimmer" that
// travelled 22 body-units with NO travelling wave at all). Both must be zero.
{
  const N = 8, st = mk(N); st.par = S.chain(N);
  const r = spine.rest;
  for (let i = 0; i < N; i++) { const a = i * 0.4; st.pos[i*3] = Math.sin(a)*r*3; st.pos[i*3+1] = -Math.cos(a)*r*3; }
  const acc = new Float64Array(N * 3);
  S.accel(spine, st.pos, st.vel, st.par, N, acc);
  let fx = 0, fy = 0, tz = 0;
  for (let i = 0; i < N; i++) { fx += acc[i*3]; fy += acc[i*3+1]; tz += st.pos[i*3]*acc[i*3+1] - st.pos[i*3+1]*acc[i*3]; }
  ok(Math.hypot(fx, fy) < 1e-9, `a curved spine has zero net FORCE (${Math.hypot(fx,fy).toExponential(1)})`);
  ok(Math.abs(tz) < 1e-9, `a curved spine has zero net TORQUE (${Math.abs(tz).toExponential(1)}) — no free spin`);
}

// ---------------------------------------------------------------- 13) UNDULATION as REST CURVATURE
// `age()` as a phase offset makes a bonded body carry a travelling wave — zigphase's clock
// read through structure's geometry, no new rhythm law. The wave writes ANGLES, not forces:
// the first version pushed sideways and, driven hard enough to move the animal, tore it open
// to 2.9x its own length. Muscle changes what the body considers REST; the structure follows.
{
  const N = 120, bond = S.refine(ZC.Env.bond("spine", H), 4), BL = bond.rest * (N - 1);
  const swim = (uOpts, sOpts, omega) => {
    const st = mk(N, N); st.par = S.chain(N); st.head = 0;
    for (let i = 0; i < N; i++) st.pos[i*3] = i * bond.rest;
    const acc = new Float64Array(N*3), kap = new Float64Array(N);
    const com = () => { let x=0,y=0; for (let i=0;i<N;i++){x+=st.pos[i*3];y+=st.pos[i*3+1];} return [x/N,y/N]; };
    const contour = () => { let c=0; for (let i=1;i<N;i++) c+=Math.hypot(st.pos[i*3]-st.pos[(i-1)*3], st.pos[i*3+1]-st.pos[(i-1)*3+1]); return c; };
    const c0 = com(), sub = 4*(bond.substeps||1), dt = 1/60/sub;
    let ph = 0;
    for (let q = 0; q < 600*sub; q++) {
      ph += omega*dt;
      S.undulate(st.par, N, 0, kap, { ...uOpts, phase: ph });
      acc.fill(0); S.accel(bond, st.pos, st.vel, st.par, N, acc, kap);
      S.slip(st.pos, st.vel, st.par, N, 0, acc, sOpts);
      for (let i=0;i<N;i++) for (let k=0;k<2;k++){ st.vel[i*3+k]+=acc[i*3+k]*dt; st.pos[i*3+k]+=st.vel[i*3+k]*dt; }
    }
    const c1 = com(); let fin = true;
    for (let i=0;i<N*3;i++) if (!Number.isFinite(st.pos[i])) fin = false;
    return { d: Math.hypot(c1[0]-c0[0], c1[1]-c0[1])/BL, stretch: contour()/BL, fin };
  };
  const aniso = { along: 0.1, across: 8.0 };
  const wave = { amp: 1.1, waves: 2.0, taper: 0.6 };

  const sw = swim(wave, aniso, 6);
  ok(sw.fin, "the swimmer stays finite");
  ok(sw.d > 0.1, `a rest-curvature wave TRAVELS (${sw.d.toFixed(2)} body lengths)`);

  // THE POINT OF THE REDESIGN: no drive level can tear the body open.
  for (const amp of [0.5, 1.2, 2.5, 5.0]) {
    const r = swim({ ...wave, amp }, aniso, 6);
    ok(r.fin && r.stretch < 1.25,
       `amp ${amp} rad keeps the body INTACT (stretch ${r.stretch.toFixed(2)}) — an angle cannot stretch a bond`);
  }

  const still = swim({ ...wave, amp: 0 }, aniso, 6);
  ok(still.d < 1e-9, `no wave, no motion (${still.d.toExponential(1)})`);
}

// ---------------------------------------------------------------- 14) ALLOMETRY + SHELL
// Per-segment rest length lets one body have segments of different sizes. Turn at a constant
// rate while growing at a constant RATIO and the body traces a logarithmic spiral — nautilus,
// ammonite, ram's horn, fern crozier. Found by accident when over-driven undulation tore a
// body into a spiral and Bill saw a shell where Glyph saw only broken physics.
{
  const CAP = 400, bond = ZC.Env.bond("spine", H);
  const st = mk(1, CAP); st.head = 0; st.rest = new Float64Array(CAP); st.rest[0] = bond.rest;
  for (let q = 0; q < 120; q++) S.shell(st, bond, 0.25, 1.03);
  ok(st.n === 121, `120 turns of growth → ${st.n} segments`);
  ok(st.rest[120] > st.rest[1] * 5, `segments grow geometrically (${st.rest[1].toFixed(2)} → ${st.rest[120].toFixed(2)})`);

  // a log spiral: the radius from the centre grows by a constant factor per whorl
  const r = (i) => Math.hypot(st.pos[i*3] - st.pos[0], st.pos[i*3+1] - st.pos[1]);
  ok(r(120) > r(60) && r(60) > r(30), "the whorl opens outward monotonically");

  // ratio 1.0 must close into a circle instead
  const c = mk(1, CAP); c.head = 0; c.rest = new Float64Array(CAP); c.rest[0] = bond.rest;
  const perTurn = Math.round(6.283185307 / 0.25);
  for (let q = 0; q < perTurn; q++) S.shell(c, bond, 0.25, 1.0);
  const gap = Math.hypot(c.pos[c.n*3-3] - c.pos[0], c.pos[c.n*3-2] - c.pos[1]);
  ok(gap < bond.rest * 1.5, `ratio 1.0 closes into a CIRCLE (gap ${gap.toFixed(2)} vs rest ${bond.rest})`);

  // and the law holds it: a shell is a real body, not a drawing
  const acc = new Float64Array(CAP*3);
  S.accel(bond, st.pos, st.vel, st.par, st.n, acc, null, st.rest);
  let fin = true; for (let i = 0; i < st.n*3; i++) if (!Number.isFinite(acc[i])) fin = false;
  ok(fin, "the structure law runs clean across an allometric body");
  let fx = 0, fy = 0, tz = 0;
  for (let i = 0; i < st.n; i++) { fx += acc[i*3]; fy += acc[i*3+1]; tz += st.pos[i*3]*acc[i*3+1] - st.pos[i*3+1]*acc[i*3]; }
  ok(Math.hypot(fx, fy) < 1e-6 && Math.abs(tz) < 1e-6, "a shell has zero net force and torque too");
}

console.log(fail ? `structure_ref: ${fail} FAIL` : "structure_ref: PASS");
process.exit(fail ? 1 : 0);

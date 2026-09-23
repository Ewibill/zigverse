/* =============================================================================
   test/zigtouch_ref.mjs — CPU proof of ZIGTOUCH 0.1.2 (engine/zigtouch.js)
   (run: node test/zigtouch_ref.mjs)
   Proves the calming mechanism is a LAW, not a feel: taps habituate and never
   escalate, trust is earned slowly and outlives the hand, the world settles
   after contact, and the same gestures give the same field at any frame rate.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigtouch.js"), "utf8"))();
const ZT = globalThis.ZigTouch;

let fail = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) fail++; };

/* a scripted hand: returns the touch, the event log, and a clock */
function rig(opts) {
  const t = ZT.create(opts), log = [];
  t.on((e) => log.push(e));
  let now = 0;
  const run = (ms, fps = 60) => { const end = now + ms; while (now < end) { now = Math.min(end, now + 1000 / fps); t.update(now); } };
  const tap = (x = 0.5, y = 0.5, dur = 90) => { t.down(1, x, y, now); run(dur); t.up(1, x, y, now); run(1); };
  t.update(0);
  return { t, log, run, tap, get now() { return now; }, set now(v) { now = v; } };
}
const of = (log, type) => log.filter((e) => e.type === type);

console.log("[three gestures, one organism]");
{
  const r = rig(); r.tap(); r.run(500);
  say(of(r.log, "startle").length === 1 && of(r.log, "pulse").length === 0, "tap → one startle, no heartbeat");
}
{
  const r = rig(); r.t.down(1, 0.5, 0.5, r.now); r.run(4000); r.t.up(1, 0.5, 0.5, r.now); r.run(10);
  say(of(r.log, "startle").length === 0 && of(r.log, "pulse").length >= 2 && of(r.log, "trust").length === 1,
    `hold → no startle, ${of(r.log, "pulse").length} heartbeats, one trust`);
}
{
  const r = rig(); let x = 0.2;
  r.t.down(1, x, 0.5, r.now);
  for (let i = 0; i < 30; i++) { r.run(16); x += 0.02; r.t.move(1, x, 0.5, r.now); }
  r.run(16);
  const s = r.t.field.current.s;
  r.t.up(1, x, 0.5, r.now); r.run(10);
  say(of(r.log, "current").length >= 5 && s > 0.3 && of(r.log, "startle").length === 0,
    `stroke → ${of(r.log, "current").length} grain events, current ${s.toFixed(2)}, no startle`);
  const s0 = r.t.field.current.s; r.run(3000);
  say(r.t.field.current.s < s0 * 0.25, `the current outlives the stroke, then fades (${s0.toFixed(2)} → ${r.t.field.current.s.toFixed(2)})`);
}

console.log("[the wave — what a hold gathers, a wave lets go]");
{
  const swipe = (r, fromHold, stopFirst) => {
    let x = 0.4; r.t.down(1, x, 0.5, r.now);
    if (fromHold) r.run(3500);
    for (let i = 0; i < 12; i++) { r.run(16); x += 0.035; r.t.move(1, x, 0.5, r.now); }     // ~2.2 u/s to the right
    if (stopFirst) r.run(400);
    r.t.up(1, x, 0.5, r.now); r.run(10);
  };
  const nuc = rig(), cold = rig(), stop = rig();
  swipe(nuc, true, false); swipe(cold, false, false); swipe(stop, true, true);
  const wn = of(nuc.log, "wave"), wc = of(cold.log, "wave");
  say(wn.length === 1 && wn[0].vx > 0 && Math.abs(wn[0].vy) < 0.2 * wn[0].vx,
    `hold, then a swipe let go while moving → one wave, heading the way the hand went (vx ${wn.length ? wn[0].vx.toFixed(2) : "—"})`);
  say(wn.length === 1 && wc.length === 1 && wn[0].strength > wc[0].strength * 1.3,
    `a wave from a nucleus carries more than one from an open hand (${wn.length ? wn[0].strength.toFixed(2) : "—"} vs ${wc.length ? wc[0].strength.toFixed(2) : "—"})`);
  say(of(stop.log, "wave").length === 0 && of(stop.log, "release").length === 1,
    "stop, then lift → a release, not a wave");
  say(of(nuc.log, "startle").length === 0, "a wave is never a startle");
}

console.log("[habituation — the calm is a law]");
{
  const r = rig(); const got = [];
  for (let i = 0; i < 10; i++) { r.tap(); got.push(r.t.field.lastStartle); r.run(410); }
  let mono = true; for (let i = 1; i < got.length; i++) if (got[i] > got[i - 1] + 1e-9) mono = false;
  say(mono, "ten taps at 2Hz: every response ≤ the one before (" + got.map((v) => v.toFixed(2)).join(" ") + ")");
  say(got[9] < 0.35 * got[0], `the tenth tap earns < 35% of the first (${(100 * got[9] / got[0]).toFixed(0)}%)`);
  r.run(12000); r.tap();
  say(r.t.field.lastStartle > 0.8 * got[0], `12s of quiet restores it (${(100 * r.t.field.lastStartle / got[0]).toFixed(0)}%)`);
}
{
  const a = rig(), b = rig();
  for (let i = 0; i < 6; i++) { a.tap(0.5, 0.5); a.run(400); b.tap(0.5, 0.5); b.run(400); }
  a.tap(0.5, 0.5); b.tap(1.1, 0.2);
  say(b.t.field.lastStartle > a.t.field.lastStartle * 1.3,
    `a tap somewhere new partly dishabituates (${a.t.field.lastStartle.toFixed(2)} same spot vs ${b.t.field.lastStartle.toFixed(2)} new)`);
}
{
  const r = rig(); let first = null, worst = 0, badA = false, x = 0;
  for (let i = 0; i < 200; i++) {
    x = (x * 9301 + 49297) % 233280; const rnd = x / 233280;
    r.tap(rnd, 1 - rnd, 40 + 200 * rnd); r.run(30 + 600 * rnd);
    if (first === null) first = r.t.field.lastStartle;
    worst = Math.max(worst, r.t.field.lastStartle);
    if (r.t.field.arousal < 0 || r.t.field.arousal > 1) badA = true;
  }
  say(worst <= first + 1e-9 && !badA, `200 random taps: no response ever exceeds the first (max ${worst.toFixed(3)} ≤ ${first.toFixed(3)}), arousal in [0,1]`);
}

console.log("[trust — slowly earned, slow to leave]");
{
  const r = rig(); r.t.down(1, 0.5, 0.5, r.now);
  r.run(500); const at05 = r.t.field.trust;
  let mono = true, prev = at05;
  for (let i = 0; i < 35; i++) { r.run(100); if (r.t.field.trust < prev - 1e-9) mono = false; prev = r.t.field.trust; }
  const at4 = r.t.field.trust;
  say(at05 < 0.2 && at4 > 0.75 && mono, `still hand: trust ${at05.toFixed(2)} at 0.5s → ${at4.toFixed(2)} at 4s, never dipping`);
  const beats = of(r.log, "pulse").map((e) => e.t);
  const gaps = beats.slice(1).map((v, i) => v - beats[i]);
  say(gaps.length >= 2 && gaps[gaps.length - 1] > gaps[0] + 0.25, `the heartbeat slows as trust rises (${gaps.map((g) => g.toFixed(2)).join("s, ")}s)`);
  r.t.up(1, 0.5, 0.5, r.now); r.run(3000);
  say(r.t.field.trust > 0.4, `3s after the hand leaves, trust remains (${r.t.field.trust.toFixed(2)})`);
  r.tap();
  say(r.t.field.lastStartle < 0.8, `a tap into earned trust startles less than a fresh one (1.00) (${r.t.field.lastStartle.toFixed(2)})`);
}
{
  const still = rig(), fidget = rig();
  still.t.down(1, 0.5, 0.5, still.now); fidget.t.down(1, 0.5, 0.5, fidget.now);
  for (let i = 0; i < 120; i++) {
    still.run(16);
    fidget.run(16); fidget.t.move(1, 0.5 + 0.012 * Math.sin(i * 1.3), 0.5 + 0.012 * Math.cos(i * 1.1), fidget.now);
  }
  say(still.t.field.trust > fidget.t.field.trust + 0.08,
    `a fidgeting hand earns trust slower (${still.t.field.trust.toFixed(2)} still vs ${fidget.t.field.trust.toFixed(2)} fidget)`);
}
{
  const slow = rig(), fast = rig();
  const stroke = (r, speed) => { let x = 0.1; r.t.down(1, x, 0.5, r.now);
    for (let i = 0; i < 90; i++) { r.run(16); x += speed * 0.016; r.t.move(1, x, 0.5, r.now); } r.t.up(1, x, 0.5, r.now); };
  stroke(slow, 0.5); stroke(fast, 4.0);
  say(slow.t.field.trust > fast.t.field.trust && fast.t.field.arousal > slow.t.field.arousal,
    `slow stroke soothes (trust ${slow.t.field.trust.toFixed(2)}), fast stroke stirs (arousal ${fast.t.field.arousal.toFixed(2)})`);
}

console.log("[settle — after contact, rest]");
{
  const r = rig(); r.tap(); const a0 = r.t.field.arousal;
  r.run(1000);
  say(of(r.log, "settle").length === 0, "no settle while still aroused");
  r.run(8000);
  say(of(r.log, "settle").length === 1 && r.t.field.arousal < 0.05 && r.t.field.settle > 0.8,
    `one settle event; arousal ${a0.toFixed(2)} → ${r.t.field.arousal.toFixed(3)}, settle ${r.t.field.settle.toFixed(2)}`);
  r.t.down(1, 0.5, 0.5, r.now); r.run(5000);
  say(of(r.log, "settle").length === 1 && r.t.field.settle < 0.05, "no settling while a hand rests on the glass");
}

console.log("[fixed timestep — the same hand, any frame rate]");
{
  const script = (r, fps) => {
    const step = (ms) => r.run(ms, fps);
    r.t.down(1, 0.3, 0.4, r.now); step(90); r.t.up(1, 0.3, 0.4, r.now); step(300);
    r.t.down(2, 0.6, 0.5, r.now); step(2600); r.t.up(2, 0.6, 0.5, r.now); step(200);
    let x = 0.2; r.t.down(3, x, 0.6, r.now); for (let i = 0; i < 20; i++) { step(25); x += 0.03; r.t.move(3, x, 0.6, r.now); }
    r.t.up(3, x, 0.6, r.now); step(4000);
    return JSON.stringify({ f: r.t.field, e: r.log.map((e) => [e.type, e.strength, e.t]) });
  };
  const results = [30, 60, 120, 144].map((fps) => {
    const r = rig();
    /* re-stamp each input to a fixed-grid time so frame cadence cannot leak in */
    const wrap = (fn) => (id, x, y, now) => fn(id, x, y, Math.round(now / 5) * 5);
    r.t.down = wrap(r.t.down); r.t.move = wrap(r.t.move); r.t.up = wrap(r.t.up);
    return script(r, fps);
  });
  /* the script's own clock advances by frame, so inputs land at slightly
     different ms per fps; quantising to 5ms puts them on the SAME step */
  const irregular = (() => {
    const r = rig(); let k = 0;
    r.run = (ms) => { const end = r.now + ms; while (r.now < end) { r.now = Math.min(end, r.now + [7, 16.7, 33, 4, 21][k++ % 5]); r.t.update(r.now); } };
    const wrap = (fn) => (id, x, y, now) => fn(id, x, y, Math.round(now / 5) * 5);
    r.t.down = wrap(r.t.down); r.t.move = wrap(r.t.move); r.t.up = wrap(r.t.up);
    return script(r, 0);
  })();
  const same = results.every((s) => s === results[0]) && irregular === results[0];
  say(same, same ? "30 · 60 · 120 · 144 fps and an irregular cadence: identical field and identical feelings, byte for byte"
                 : "frame rate leaked into behavior");
}

console.log("[memory layers]");
{
  const fresh = rig(), known = rig();
  for (let i = 0; i < 12; i++) { known.t.down(1, 0.5, 0.5, known.now); known.run(15000); known.t.up(1, 0.5, 0.5, known.now); known.run(2000); }
  known.run(20000);
  say(known.t.field.familiarity > 0.6, `session: three minutes of gentle holding builds familiarity (${known.t.field.familiarity.toFixed(2)})`);
  fresh.tap(); known.tap();
  say(known.t.field.lastStartle < fresh.t.field.lastStartle * 0.85,
    `a familiar organism flinches less (${known.t.field.lastStartle.toFixed(2)} vs ${fresh.t.field.lastStartle.toFixed(2)})`);
  const tr = (r) => { r.run(30000); r.t.down(1, 0.5, 0.5, r.now); r.run(1500); const v = r.t.field.trust; r.t.up(1, 0.5, 0.5, r.now); return v; };
  const tf = tr(fresh), tk = tr(known);
  say(tk > tf + 0.05, `…and trusts faster (${tk.toFixed(2)} vs ${tf.toFixed(2)} after 1.5s)`);
  say(known.t.field.mood.ease > fresh.t.field.mood.ease, `minutes: mood.ease remembers the holding (${known.t.field.mood.ease.toFixed(2)} vs ${fresh.t.field.mood.ease.toFixed(2)})`);

  const before = known.t.exportMemory().trait;
  const after = known.t.commitSession().trait;
  const dB = Math.abs(after.boldness - before.boldness), dS = Math.abs(after.sociability - before.sociability);
  say(dB <= 0.03 + 1e-9 && dS <= 0.03 + 1e-9 && (dB > 0 || dS > 0), `persistent: traits drift, lightly (Δbold ${dB.toFixed(3)} · Δsocial ${dS.toFixed(3)} ≤ 0.03)`);
  const next = ZT.create(); next.importMemory(JSON.parse(JSON.stringify(known.t.exportMemory())));
  say(JSON.stringify(next.field.trait) === JSON.stringify(known.t.field.trait), "persistent: memory survives a JSON round trip");
  say(next.importMemory({ v: 9 }) === false && next.importMemory(null) === false, "persistent: foreign or empty memory is refused, not guessed at");
}


console.log("[0.1.2 legacyBridge — every road out of a hold lets the note go]");
{
  const perf = { down: false, hold(on) { this.down = !!on; } };
  const r = rig(); const frame = ZT.legacyBridge(r.t, perf, null);
  const run = (ms) => { const end = r.now + ms; while (r.now < end) { r.now = Math.min(end, r.now + 1000 / 60); r.t.update(r.now); frame(); } };
  r.t.down(1, 0.5, 0.5, r.now); run(2000);
  const heldDuring = perf.down;
  let x = 0.5; for (let i = 0; i < 12; i++) { run(16); x += 0.04; r.t.move(1, x, 0.5, r.now); }
  r.t.up(1, x, 0.5, r.now); run(20);
  say(heldDuring && of(r.log, "wave").length === 1 && !perf.down,
    "hold → stroke → WAVE releases Perf.hold (0.1.1 left the note down forever)");
}

console.log("[0.1.2 THE NUCLEUS — earned, lingering, thrown]");
const nrig = (opts) => { const r = rig(); const n = ZT.nucleus(r.t, Object.assign({ bounds: () => ({ w: 1, h: 2.1 }) }, opts)); return { r, n: n.out }; };
{
  const { r, n } = nrig(); r.tap(0.5, 0.5); r.run(300);
  say(n.w < 0.02, `a stab is ignored — nucleus ${n.w.toFixed(3)}`);
}
let heldW = 0;
{
  const { r, n } = nrig();
  r.t.down(1, 0.3, 0.8, r.now); r.run(500); const early = n.w; r.run(3500); heldW = n.w;
  say(early < 0.12 && heldW > 0.7, `a still hand BECOMES the nucleus over seconds (0.5s ${early.toFixed(2)} → 4s ${heldW.toFixed(2)})`);
  say(Math.abs(n.x - 0.3) < 1e-9 && Math.abs(n.y - 0.8) < 1e-9, "…and the nucleus sits under the finger");
  say(n.breath > 0.7, `…and the held hand breathes (${n.breath.toFixed(2)})`);
  r.t.up(1, 0.3, 0.8, r.now); r.run(1000);
  say(n.w > 0.3 && n.w < heldW && Math.abs(n.x - 0.3) < 1e-9 && n.breath === 0, `plain release LINGERS where the hand was (1s after: ${n.w.toFixed(2)})`);
  r.run(12000);
  say(n.w < 0.05, `…then the organism takes its body back (${n.w.toFixed(3)} at 13s)`);
}
const waveFrom = (holdMs) => {
  const { r, n } = nrig();
  r.t.down(1, 0.5, 1.0, r.now); r.run(holdMs);
  let x = 0.5; for (let i = 0; i < 10; i++) { r.run(16); x += 0.035; r.t.move(1, x, 1.0, r.now); }
  r.t.up(1, x, 1.0, r.now); r.run(20);
  const at = { x: n.x, w: n.w, thrown: n.thrown, g: n.gathered }; r.run(1200); const mid = n.w; r.run(9000);
  return { r, n, lift: x, at, mid, end: n.w };
};
{
  const W = waveFrom(4000);
  say(W.at.thrown && W.at.x > W.lift + 0.05 && W.at.x <= 1 - 0.08 + 1e-9,
    `a WAVE sends the body along the hand (lift at ${W.lift.toFixed(2)} → landed ${W.at.x.toFixed(2)}, inside the glass)`);
  say(W.mid > 0.2 && W.end < 0.02, `…carries it, then lets go entirely (1.2s ${W.mid.toFixed(2)} → 10s ${W.end.toFixed(3)})`);
  say(!W.n.thrown === false && Math.abs(W.n.x - W.lift) > 0.05, "…and it does NOT come back to the finger");
  const O = waveFrom(100);
  say(W.at.w > O.at.w * 1.5, `a wave from a nucleus carries more than one from an open hand (${W.at.w.toFixed(2)} vs ${O.at.w.toFixed(2)})`);
}
{
  const { r, n } = nrig({ bounds: () => ({ w: 1, h: 2.1 }), throw: 2 });
  r.t.down(1, 0.8, 1.0, r.now); r.run(3000);
  let x = 0.8; for (let i = 0; i < 6; i++) { r.run(10); x += 0.03; r.t.move(1, x, 1.0, r.now); }
  r.t.up(1, x, 1.0, r.now); r.run(20);
  say(n.x <= 0.92 + 1e-9, `a flick at the edge lands inside the world, never off it (x ${n.x.toFixed(3)} ≤ 0.92)`);
}
{
  const { r, n } = nrig(); r.t.down(1, 0.5, 0.5, r.now); r.run(3000); r.t.up(1, 0.5, 0.5, r.now);
  r.t.down(2, 0.2, 0.5, r.now); r.run(10);
  say(!n.thrown && Math.abs(n.x - 0.2) < 0.01, "a new contact takes the nucleus back to the new finger");
}
{
  const script = (fps) => {
    const { r, n } = nrig(); const trace = [];
    const wrap = (fn) => (id, x, y, now) => fn(id, x, y, Math.round(now / 5) * 5);
    r.t.down = wrap(r.t.down); r.t.move = wrap(r.t.move); r.t.up = wrap(r.t.up);
    const step = (ms) => { r.run(ms, fps); trace.push(JSON.stringify(n)); };
    r.t.down(1, 0.4, 0.9, r.now); step(3000);
    let x = 0.4; for (let i = 0; i < 12; i++) { r.run(25, fps); x += 0.04; r.t.move(1, x, 0.9, r.now); }
    r.t.up(1, x, 0.9, r.now); step(500); step(3000);
    return trace.join("|");
  };
  const res = [30, 60, 120, 144].map(script);
  say(res.every((v) => v === res[0]), "nucleus rides the fixed clock: 30 · 60 · 120 · 144 fps give the same body directive, byte for byte");
}

console.log("[0.1.2 SURFACE → WORLD]");
{
  /* the same matrices ZigWebGPU.mat builds (column-major, clip z 0..1) */
  const persp = (fovY, a, n, f) => { const k = 1 / Math.tan(fovY / 2), o = new Float64Array(16); o[0] = k / a; o[5] = k; o[10] = f / (n - f); o[11] = -1; o[14] = n * f / (n - f); return o; };
  const lookAt = (e, c, up) => {
    const zl = Math.hypot(e[0]-c[0], e[1]-c[1], e[2]-c[2]); const Z = [(e[0]-c[0])/zl, (e[1]-c[1])/zl, (e[2]-c[2])/zl];
    let X = [up[1]*Z[2]-up[2]*Z[1], up[2]*Z[0]-up[0]*Z[2], up[0]*Z[1]-up[1]*Z[0]]; const xl = Math.hypot(...X); X = X.map((v) => v / xl);
    const Y = [Z[1]*X[2]-Z[2]*X[1], Z[2]*X[0]-Z[0]*X[2], Z[0]*X[1]-Z[1]*X[0]]; const o = new Float64Array(16);
    o[0]=X[0];o[1]=Y[0];o[2]=Z[0];o[4]=X[1];o[5]=Y[1];o[6]=Z[1];o[8]=X[2];o[9]=Y[2];o[10]=Z[2];
    o[12]=-(X[0]*e[0]+X[1]*e[1]+X[2]*e[2]);o[13]=-(Y[0]*e[0]+Y[1]*e[1]+Y[2]*e[2]);o[14]=-(Z[0]*e[0]+Z[1]*e[1]+Z[2]*e[2]);o[15]=1; return o; };
  const mul = (a, b) => { const o = new Float64Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k]; o[c*4+r] = s; } return o; };
  const eye = [140, 70, 40], ctr = [0, 62, 0], W = 390, H = 844;
  const vp = Float32Array.from(mul(persp(0.9, W / H, 0.5, 1200), lookAt(eye, ctr, [0, 1, 0])));
  const fwd = [ctr[0]-eye[0], ctr[1]-eye[1], ctr[2]-eye[2]]; const fl = Math.hypot(...fwd); const N = fwd.map((v) => v / fl);
  let worst = 0;
  for (const P of [[0, 62, 0], [20, 80, -10], [-35, 40, 25]]) {
    const q = [0, 1, 2, 3].map((r) => vp[r] * P[0] + vp[4 + r] * P[1] + vp[8 + r] * P[2] + vp[12 + r]);
    const ndc = [q[0] / q[3], q[1] / q[3]];
    const got = ZT.toWorld(vp, ndc[0], ndc[1], P, N);
    worst = Math.max(worst, Math.hypot(got[0] - P[0], got[1] - P[1], got[2] - P[2]));
  }
  say(worst < 1e-2, `a projected point unprojects to itself on the view plane (worst ${worst.toExponential(1)} world units)`);
  const m = ZT.surfaceToNdc(W / Math.min(W, H) / 2, H / Math.min(W, H) / 2, W, H);
  const tl = ZT.surfaceToNdc(0, 0, W, H);
  say(Math.abs(m[0]) < 1e-12 && Math.abs(m[1]) < 1e-12 && tl[0] === -1 && tl[1] === 1, "surface centre → NDC 0,0 · top-left → -1,+1 (y up)");
  const up = ZT.toWorld(vp, 0, 0.5, ctr, N), dn = ZT.toWorld(vp, 0, -0.5, ctr, N);
  say(up[1] > dn[1], "higher on the glass is higher in the world");
}

console.log(fail ? `\nZIGTOUCH_REF FAIL (${fail})` : "\nZIGTOUCH_REF PASS");
process.exit(fail ? 1 : 0);

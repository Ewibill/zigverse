/* =============================================================================
   test/zigtouch_ref.mjs — CPU proof of ZIGTOUCH 0.1.0 (engine/zigtouch.js)
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

console.log(fail ? `\nZIGTOUCH_REF FAIL (${fail})` : "\nZIGTOUCH_REF PASS");
process.exit(fail ? 1 : 0);

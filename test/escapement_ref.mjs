// escapement_ref.mjs — FILL UNTIL IT IS ENOUGH, THEN ALL AT ONCE. (ZigCore.Escapement 0.20)
//
// A store, a threshold, a release, a reset. The pattern behind a tipping-bucket rain gauge, a
// geyser, a seed pod, a heart, a neuron reaching action potential, and the escapement in a
// clock. What makes it a CLOCK rather than a valve is that it turns a continuous supply into a
// countable event: period = threshold / rate, so stages with different thresholds gear down
// from one supply.
//
// Proves: it fires only when full · the period is threshold/rate and it is STEADY · hysteresis
// stops it chattering · the tip takes time and can be drawn mid-way · a chain gears down by
// exactly the ratio of its thresholds · and it keeps time under a NOISY supply, which a real
// bubble column is.

import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
const ZC = globalThis.ZigCore, ES = ZC.Escapement;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const DT = 1/120;

// ---------------------------------------------------------------- 1) it fires only when full
{
  const e = ES.create({ full: 10, reset: 1, spill: 0.2 });
  let fired = 0;
  for (let s = 0; s < 200; s++) { ES.fill(e, 0.02); if (ES.step(e, DT)) fired++; }   // never reaches 10
  ok(fired === 0, "an under-filled store never fires");
  ok(e.level > 3, `…but it does keep filling (${e.level.toFixed(2)})`);
  for (let s = 0; s < 2000; s++) { ES.fill(e, 0.05); if (ES.step(e, DT)) { fired++; break; } }
  ok(fired === 1, "and it fires once it reaches the threshold");
}

// ---------------------------------------------------------------- 2) THE PERIOD IS THRESHOLD / RATE
// The whole claim to being a clock. A steady supply must give a steady beat.
{
  const RATE = 4.0, FULL = 10;                       // units per second
  const e = ES.create({ full: FULL, reset: 0.5, spill: 0.25 });
  const times = [];
  let t = 0;
  for (let s = 0; s < 120 * 60; s++) {
    ES.fill(e, RATE * DT);
    if (ES.step(e, DT)) times.push(t);
    t += DT;
  }
  ok(times.length > 8, `it ticked ${times.length} times in 60s`);
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i-1]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const spread = Math.max(...gaps) - Math.min(...gaps);
  /* the period is fill time plus the spill, since the store cannot fill mid-tip */
  const want = FULL / RATE + e.spill;
  ok(Math.abs(mean - want) < 0.05, `the period is threshold/rate + spill (${mean.toFixed(3)}s, wanted ${want.toFixed(3)})`);
  ok(spread < 0.02, `and it is STEADY — every gap within ${spread.toFixed(4)}s`);
}

// ---------------------------------------------------------------- 3) HYSTERESIS stops the chatter
// Without a reset level a full store fires every frame. This is the law, not a detail.
{
  const e = ES.create({ full: 5, reset: 4.9, spill: 0.01 });
  let fired = 0;
  for (let s = 0; s < 600; s++) { ES.fill(e, 5); if (ES.step(e, DT)) fired++; }   // hugely over-supplied
  /* 600 frames of massive over-supply. The point is that it TICKS rather than
     streaming: a store without hysteresis fires on every single frame. */
  ok(fired < 600, `a flooded store still ticks discretely (${fired} in 600 frames), not once per frame`);
  ok(fired <= 5 / e.spill + 1, `and never faster than the tip itself allows (${fired} <= ${(5/e.spill)|0})`);

  const e2 = ES.create({ full: 5, reset: 0.1, spill: 0.3 });
  let f2 = 0;
  for (let s = 0; s < 600; s++) { ES.fill(e2, 5); if (ES.step(e2, DT)) f2++; }
  ok(f2 < fired, `a deeper reset ticks more slowly still (${f2} vs ${fired}) — the reset sets the floor of the beat`);
}

// ---------------------------------------------------------------- 4) the tip takes time
// So a lid can be DRAWN halfway over, which is the most legible moment in the cycle.
{
  const e = ES.create({ full: 1, reset: 0.1, spill: 0.5 });
  ES.fill(e, 1.2); ES.step(e, DT);
  ok(e.tipping, "it enters a tipping state rather than resolving instantly");
  const seen = [];
  for (let s = 0; s < 120 && e.tipping; s++) { ES.step(e, DT); seen.push(e.phase); }
  ok(seen.length > 40, `the tip lasts ~${(seen.length * DT).toFixed(2)}s, so it can be animated`);
  ok(seen.some((p) => p > 0.3 && p < 0.7), "and there are frames with the lid genuinely half over");
  ok(!e.tipping && e.level === 0, "afterwards it is empty and upright again");
}

// ---------------------------------------------------------------- 5) A CHAIN GEARS DOWN
// One supply, three stages, each fed by the tick of the one before: seconds, minutes, hours.
{
  const fast = ES.create({ full: 4, reset: 0.2, spill: 0.05 });
  const mid  = ES.create({ full: 6, reset: 0.2, spill: 0.05 });
  const slow = ES.create({ full: 5, reset: 0.2, spill: 0.05 });
  let a = 0, b = 0, c = 0;
  for (let s = 0; s < 120 * 300; s++) {
    ES.fill(fast, 4 * DT);
    if (ES.step(fast, DT)) { a++; ES.fill(mid, 1); }
    if (ES.step(mid, DT)) { b++; ES.fill(slow, 1); }
    ES.step(slow, DT);
  }
  c = slow.ticks;
  ok(a > 200, `the fast stage ran (${a} ticks)`);
  ok(Math.abs(b - a / 6) < 3, `the middle stage geared down by its threshold of 6 (${b}, expected ~${(a/6).toFixed(1)})`);
  ok(Math.abs(c - b / 5) < 3, `and the slow stage by 5 (${c}, expected ~${(b/5).toFixed(1)})`);
  ok(a > b && b > c, "seconds, minutes, hours — from one supply");
}

// ---------------------------------------------------------------- 6) IT KEEPS TIME ON A NOISY SUPPLY
// A bubble column does not deliver smoothly: bubbles arrive in clumps. An escapement is
// tolerant of that in a way a direct readout is not, because it INTEGRATES — which is the
// real reason clocks are built this way.
{
  let s2 = 99;
  const rnd = () => { s2 = (s2 * 1664525 + 1013904223) >>> 0; return s2 / 4294967296; };
  const e = ES.create({ full: 20, reset: 1, spill: 0.2 });
  const times = []; let t = 0;
  for (let s = 0; s < 120 * 240; s++) {
    /* wildly lumpy: nothing most frames, a big slug occasionally. Same MEAN rate of 4/s. */
    if (rnd() < 0.05) ES.fill(e, 4 * DT * 20);
    if (ES.step(e, DT)) times.push(t);
    t += DT;
  }
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i-1]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const dev = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
  ok(times.length > 30, `it ticked ${times.length} times on a lumpy supply`);
  ok(Math.abs(mean - 5.2) < 0.6, `the mean period survives the noise (${mean.toFixed(2)}s)`);
  ok(dev / mean < 0.20, `and the jitter stays modest (${(100*dev/mean).toFixed(1)}%) — the store INTEGRATES the lumps`);

  /* AND A BIGGER STORE INTEGRATES BETTER, which is the real design lever: a
     clock that wants to be steadier on a lumpy supply is built with a deeper
     bucket, not a smoother supply. */
  const jitterFor = (FULL) => {
    let q = 99; const rq = () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; };
    const e2 = ES.create({ full: FULL, reset: 1, spill: 0.2 });
    const ts = []; let tt = 0;
    for (let s = 0; s < 120 * 600; s++) {
      if (rq() < 0.05) ES.fill(e2, 4 * DT * 20);
      if (ES.step(e2, DT)) ts.push(tt);
      tt += DT;
    }
    const gg = []; for (let i = 1; i < ts.length; i++) gg.push(ts[i] - ts[i-1]);
    const m = gg.reduce((a, b) => a + b, 0) / gg.length;
    return Math.sqrt(gg.reduce((a, g) => a + (g - m) ** 2, 0) / gg.length) / m;
  };
  const shallow = jitterFor(10), deep = jitterFor(80);
  ok(deep < shallow * 0.7,
     `a deeper store is steadier on the same noise (${(100*deep).toFixed(1)}% vs ${(100*shallow).toFixed(1)}%)`);
}

console.log(fail ? `escapement_ref: ${fail} FAIL` : "escapement_ref: PASS");
process.exit(fail ? 1 : 0);

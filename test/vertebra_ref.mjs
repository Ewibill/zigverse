// vertebra_ref.mjs — WHAT HAPPENS HERE HAPPENS THERE, LATER. (ZigCore.Relay 0.22)
//
// Escapement already chains: escapement_ref proves three stages gear down by the ratio of
// their thresholds. But that chain fires on ONE FRAME — gearing with no geography. A body has
// an order, and an event entering the head arrives at the tail LATE. This proves the lateness
// is real, that it is a knob, that causation runs one way, and that silence decompresses.
//
// Proves: nothing fires without supply · one head event travels the body in order and arrives
// at transit() time · the lag is a knob (double it, double the delay) · a body FOLLOWS THROUGH
// after the performer stops and then decompresses to rest · gearing survives the geography
// (and bleed is the lever that trades gearing for breathing) · hysteresis is inherited whole,
// so a flooded head still ticks · and a run is deterministic.

import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
const ZC = globalThis.ZigCore, RL = ZC.Relay;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const DT = 1 / 120;

ok(!!RL, "ZigCore.Relay exists");
ok(RL.VERSION === "0.27.0", `version stamp is 0.27.0 (${RL && RL.VERSION})`);

// ---------------------------------------------------------------- 1) CAUSATION HAS A FLOOR
// A tail segment may move only because a head segment did. With no supply, nothing anywhere.
{
  const r = RL.create({ n: 5, full: 1, lag: 0.1 });
  for (let s = 0; s < 120 * 20; s++) RL.step(r, DT);
  ok(r.ticks === 0, `20s of silence produces no motion anywhere (${r.ticks} ticks)`);
  ok(r.pose.every((p) => p === 0), "and no segment holds a pose it was never given");
}

// ---------------------------------------------------------------- 2) ONE EVENT TRAVELS, IN ORDER
// The whole point. Fill the head once; the body answers head to tail, late, one at a time.
{
  const LAG = 0.1, N = 5;
  const r = RL.create({ n: N, full: 1, lag: LAG, spill: 0.05, bleed: 0.2 });
  RL.fill(r, 1.2);
  for (let s = 0; s < 120 * 6; s++) RL.step(r, DT);

  ok(r.first.every((t) => t >= 0), "every segment fired");
  let ordered = true;
  for (let i = 1; i < N; i++) if (!(r.first[i] > r.first[i - 1])) ordered = false;
  ok(ordered, `the body answers in order, never backwards (${r.first.map((t) => t.toFixed(2)).join(" -> ")})`);

  const crossing = r.first[N - 1] - r.first[0];
  ok(Math.abs(crossing - RL.transit(r)) < 0.05,
     `head to tail takes transit() = ${RL.transit(r).toFixed(2)}s (measured ${crossing.toFixed(3)}s)`);

  /* SIMULTANEITY READS AS A MECHANISM, DELAY READS AS CAUSE. This is the number
     that separates this law from chaining escapements directly. */
  ok(crossing > 8 * DT, `and the tail is visibly late, not same-frame (${(crossing / DT).toFixed(0)} frames behind)`);

  /* …where a RAW escapement chain — the one escapement_ref builds, each tick filling the next
     stage directly — fires the entire body on a single frame. Same gearing, no body. */
  const ES = ZC.Escapement;
  const raw = [0, 1, 2, 3, 4].map(() => ES.create({ full: 1, reset: 0.12, spill: 0.05 }));
  ES.fill(raw[0], 1.2);
  const rawFrame = raw.map(() => -1);
  for (let s = 0; s < 120 * 6; s++) {
    for (let i = 0; i < raw.length; i++) {
      if (ES.step(raw[i], DT)) {
        if (rawFrame[i] < 0) rawFrame[i] = s;
        if (i + 1 < raw.length) ES.fill(raw[i + 1], 1);
      }
    }
  }
  ok(rawFrame.every((f) => f === rawFrame[0]),
     `a raw escapement chain fires the whole body on ONE frame (${rawFrame.join(",")}) — gearing with no geography`);

  /* And the floor of this law, stated so nobody rediscovers it: a delivery is consumed on the
     frame AFTER it is scheduled, so a relay hop costs one frame even at lag 0. */
  const flat = RL.create({ n: N, full: 1, lag: 0, spill: 0.05, bleed: 0.2 });
  RL.fill(flat, 1.2);
  for (let s = 0; s < 120 * 6; s++) RL.step(flat, DT);
  const floorFrames = (flat.first[N - 1] - flat.first[0]) / DT;
  ok(Math.abs(floorFrames - (N - 1)) < 1.5,
     `at lag 0 a relay still costs one frame per hop (${floorFrames.toFixed(0)} frames across ${N - 1} hops)`);
}

// ---------------------------------------------------------------- 3) THE LAG IS A KNOB
// A slow body and a fast body are the same law. The wave has a speed you can set.
{
  const cross = (lag) => {
    const r = RL.create({ n: 4, full: 1, lag, spill: 0.05, bleed: 0.2 });
    RL.fill(r, 1.2);
    for (let s = 0; s < 120 * 12; s++) RL.step(r, DT);
    return r.first[3] - r.first[0];
  };
  const slow = cross(0.2), fast = cross(0.1);
  ok(Math.abs(slow / fast - 2) < 0.15, `doubling the lag doubles the crossing (${slow.toFixed(2)}s vs ${fast.toFixed(2)}s)`);
}

// ---------------------------------------------------------------- 4) IT FOLLOWS THROUGH, THEN RESTS
// The performer stops. A body that stops with them is a switch. A body that finishes the
// gesture and then decompresses is alive. Both halves are asserted.
{
  const r = RL.create({ n: 5, full: 1, lag: 0.12, spill: 0.08, bleed: 0.35 });
  let t = 0, lastSupply = 0;
  for (let s = 0; s < 120 * 3; s++) { RL.fill(r, 1.5 * DT); RL.step(r, DT); t += DT; }
  lastSupply = t;
  const headAtStop = r.head, ticksAtStop = r.ticks;
  ok(headAtStop > 0, `the head was driven while breath was flowing (${headAtStop} head events)`);
  ok(RL.inflight(r) > 0 || r.ticks > headAtStop, "and the wave had entered the body");

  /* FOLLOW-THROUGH: motion continues after the supply stops */
  let firedAfter = 0;
  for (let s = 0; s < 120 * 1; s++) firedAfter += RL.step(r, DT).length;
  ok(firedAfter > 0, `the body keeps moving after breath stops (${firedAfter} segment events in the first second of silence)`);

  /* THEN REST: not frozen mid-pose */
  for (let s = 0; s < 120 * 20; s++) RL.step(r, DT);
  ok(RL.inflight(r) === 0, "nothing is left travelling");
  ok(r.pose.every((p) => p < 0.02), `every segment has decompressed to rest (max pose ${Math.max(...r.pose).toExponential(1)})`);
  ok(r.st.slice(1).every((e) => e.level < 1e-6), "no downstream store is holding charge it will never spend");
  ok(r.ticks > ticksAtStop, "the gesture completed rather than being cut off");
}

// ---------------------------------------------------------------- 5) GEARING SURVIVES GEOGRAPHY
// Escapement's gearing still works down a body — the far end answers less often than the near
// end. `gain` is that ratio, in units of the downstream threshold.
{
  const r = RL.create({ n: 3, full: 1, lag: 0.08, spill: 0.05, gain: 0.5, bleed: 0 });
  for (let s = 0; s < 120 * 120; s++) { RL.fill(r, 2 * DT); RL.step(r, DT); }
  const a = r.st[0].ticks, b = r.st[1].ticks, c = r.st[2].ticks;
  ok(a > 40, `the head ran (${a} ticks)`);
  ok(Math.abs(b - a / 2) < 3, `the middle answers every second head event (${b}, expected ~${(a / 2).toFixed(1)})`);
  ok(Math.abs(c - b / 2) < 3, `and the tail every fourth (${c}, expected ~${(b / 2).toFixed(1)})`);
  ok(a > b && b > c, "near end busy, far end deliberate — depth rather than reflexes");

  /* THE LEVER, NAMED: a store that leaks cannot also count. Gearing needs the charge to
     survive the gap between deliveries; bleed is what makes silence work. A body is one or
     the other per stage, and this is the number that decides it. */
  const leaky = RL.create({ n: 3, full: 1, lag: 0.08, spill: 0.05, gain: 0.5, bleed: 0.35 });
  for (let s = 0; s < 120 * 120; s++) { RL.fill(leaky, 2 * DT); RL.step(leaky, DT); }
  ok(leaky.st[2].ticks < c,
     `with bleed at 0.35 the partial charge drains between deliveries and the far end goes quiet (${leaky.st[2].ticks} vs ${c}) — gearing and breathing trade off, per stage`);
}

// ---------------------------------------------------------------- 6) HYSTERESIS IS INHERITED WHOLE
// A flooded head must still TICK. If the chain streamed, the body would blur into vibration.
{
  const r = RL.create({ n: 4, full: 1, reset: 0.1, lag: 0.05, spill: 0.1, bleed: 0.2 });
  const F = 120 * 5;
  let tailFrames = 0;
  for (let s = 0; s < F; s++) { RL.fill(r, 20); const f = RL.step(r, DT); if (f.includes(3)) tailFrames++; }
  ok(r.st[3].ticks > 0, "a flooded body does reach the tail");
  ok(tailFrames < F / 4, `and the tail ticks discretely (${tailFrames} of ${F} frames), never once per frame`);
}

// ---------------------------------------------------------------- 7) DETERMINISM
// A piece that runs unattended, and a build that must be diffed, both need this.
{
  const run = () => {
    const r = RL.create({ n: 5, full: 1, lag: 0.11, spill: 0.07, bleed: 0.3 });
    const log = [];
    for (let s = 0; s < 120 * 30; s++) {
      RL.fill(r, (s % 240 < 160 ? 1.4 : 0) * DT);
      const f = RL.step(r, DT);
      if (f.length) log.push(s + ":" + f.join(","));
    }
    return log.join("|");
  };
  const a = run(), b = run();
  ok(a.length > 40, `the run produced events (${a.split("|").length})`);
  ok(a === b, "two runs of the same supply are identical event for event");
}

// ---------------------------------------------------------------- 8) THE LAG IS DRIVEN BY NOTE CHANGES
// Not breath, not attack: the time from one note to the next. At ratio 1 the body asks for one
// hop per note, so it holds roughly the last n notes — bounded by the span (section 9).
{
  const r = RL.create({ n: 6, full: 1, lag: 0.12, spill: 0.05, spanMin: 0.2, spanMax: 4 });
  let t = 0;
  for (const gap of [0.17, 0.17, 0.17]) { t += gap; RL.note(r, t); }
  ok(Math.abs(r.base - 0.17) < 1e-9, `three notes 0.17s apart set the hop to 0.17 (${r.base.toFixed(4)})`);
  ok(Math.abs(RL.span(r) - 5 * 0.17) < 1e-9, `and the body is five hops long (${RL.span(r).toFixed(3)}s)`);

  /* Bill judged 0.17 by eye on 2026-09-08. At ratio 1 that is simply the note rate it
     corresponds to — his number is a tempo, not a magic constant. */
  t += 0.42; RL.note(r, t);
  ok(Math.abs(r.base - 0.42) < 1e-9, `slowing to 0.42s notes lengthens the body's conduction (${r.base.toFixed(3)})`);
}

// ---------------------------------------------------------------- 9) THE CLAMP IS ON THE BODY
// The 0.24 clamps were on the HOP, which let the body's length in time swing 9x inside one take
// (0.46s..4.36s at 14 segments) — so the number of waves coexisting in it swung too, and the
// creature Bill wanted existed only in the middle of his range. Bounding the SPAN fixes that,
// and unlike lagMin/lagMax it scales with segment count for free.
{
  const N = 14, MIN = 0.9, MAX = 1.8;
  const spanAt = (iv) => {
    const r = RL.create({ n: N, lag: 0.17, spanMin: MIN, spanMax: MAX });
    RL.setInterval(r, iv);
    return RL.span(r);
  };
  ok(Math.abs(spanAt(0.04) - MIN) < 1e-9, `a trill cannot shrink the body below spanMin (${spanAt(0.04).toFixed(2)}s)`);
  ok(Math.abs(spanAt(0.34) - MAX) < 1e-9, `a slow passage cannot stretch it past spanMax (${spanAt(0.34).toFixed(2)}s)`);
  ok(Math.abs(spanAt(0.10) - 13 * 0.10) < 1e-9, "and between the two the notes are obeyed exactly");

  /* the swing that made this necessary, stated as a ratio */
  const oldSwing = (13 * 0.34) / (13 * 0.04), newSwing = MAX / MIN;
  ok(newSwing < oldSwing / 3,
     `the body's length now swings ${newSwing.toFixed(1)}x across the same playing, not ${oldSwing.toFixed(1)}x`);

  /* SPAN SCALES WITH SEGMENT COUNT. lagMin/lagMax never did: at a fixed hop clamp, a 14-segment
     body was four times longer in time than a 4-segment one for the same playing. */
  const sameSpan = [4, 8, 14].map((n) => {
    const r = RL.create({ n, lag: 0.17, spanMin: MIN, spanMax: MAX });
    RL.setInterval(r, 0.02);                 // fast enough that every length clamps to spanMin
    return RL.span(r);
  });
  ok(sameSpan.every((v) => Math.abs(v - MIN) < 1e-9),
     `4, 8 and 14 segments give the same body length (${sameSpan.map((v) => v.toFixed(2)).join(", ")}s)`);

  /* A HELD NOTE makes no call at all — the body keeps the tempo of the last transition. */
  const r = RL.create({ n: 6, lag: 0.12, spanMin: MIN, spanMax: MAX });
  let t = 0; t += 0.2; RL.note(r, t); t += 0.2; RL.note(r, t);
  const held = r.base;
  for (let s2 = 0; s2 < 600; s2++) RL.step(r, DT);
  ok(r.base === held, "holding a note leaves the hop exactly where the last change put it");
}

// ---------------------------------------------------------------- 10) THE PER-STAGE SHAPE SURVIVES
// A stiff neck and a loose tail must stay a stiff neck and a loose tail when the tempo changes,
// not flatten to uniform.
{
  const r = RL.create({ n: 3, lag: [0.2, 0.1, 0.05], spanMin: 0.05, spanMax: 5 });
  const before = r.lag.map((L) => L / r.lag[0]);
  let t = 0; t += 0.2; RL.note(r, t); t += 0.2; RL.note(r, t);
  const after = r.lag.map((L) => L / r.lag[0]);
  ok(after.every((v, i) => Math.abs(v - before[i]) < 1e-9),
     `the 4:2:1 taper is preserved through a tempo change (${after.map((v) => v.toFixed(2)).join(":")})`);
  ok(Math.abs(RL.span(r) - 2 * 0.2) < 1e-9, `and the body is two hops of the new interval long (${RL.span(r).toFixed(3)}s)`);
}

// ---------------------------------------------------------------- 11) SNAP BLENDS TOWARD FLOW
// Pacemaker's `period` is unusable as a driver for this performer: its PLL accepts only onsets
// preceded by a gap, and a continuous ribbon never supplies one. Measured from a take on
// 2026-09-09: `confidence` 0.00 for 21 unbroken seconds, `period` never off its default, while
// `flow` ranged 0.23..0.98. So `snap` blends toward DENSITY, which is alive in this style.
{
  const MIN = 0.9, MAX = 1.8, IV = 0.10;
  const at = (snap, flow) => {
    const r = RL.create({ n: 14, lag: 0.17, snap: snap, spanMin: MIN, spanMax: MAX });
    RL.setInterval(r, IV, flow);
    return RL.span(r);
  };
  ok(Math.abs(at(0, 0.9) - 13 * IV) < 1e-9, `snap 0 follows the raw note change, flow ignored (${at(0, 0.9).toFixed(2)}s)`);
  ok(Math.abs(at(1, 1) - MIN) < 1e-9, `snap 1 at full density gives the short body (${at(1, 1).toFixed(2)}s)`);
  ok(Math.abs(at(1, 0) - MAX) < 1e-9, `snap 1 at no density gives the long one (${at(1, 0).toFixed(2)}s)`);
  ok(at(1, 0.2) > at(1, 0.8), "denser playing asks for a shorter body — same direction as the raw interval");
  const mid = at(0.5, 0.5);
  ok(mid > Math.min(13 * IV, 1.35) - 1e-9 && mid < Math.max(13 * IV, 1.35) + 1e-9,
     `snap 0.5 sits between the two readings (${mid.toFixed(2)}s)`);

  /* and with NO flow supplied at all, the law falls back to the notes rather than to a default */
  const r = RL.create({ n: 14, lag: 0.17, snap: 1, spanMin: MIN, spanMax: MAX });
  RL.setInterval(r, IV);
  ok(Math.abs(RL.span(r) - 13 * IV) < 1e-9, "no flow supplied — the notes still drive it, not a stale estimate");
}

// ---------------------------------------------------------------- 12) THE CATCH-UP
// The payoff, and nobody wrote it. A delivery already travelling keeps the lag it launched with,
// so a fast wave launched behind a slow one CLOSES THE GAP by the time both reach the tail.
{
  const arrivals = (secondInterval) => {
    const r = RL.create({ n: 6, full: 1, lag: 0.25, spill: 0.03, bleed: 0, spanMin: 0.05, spanMax: 6 });
    let t = 0; const tailAt = [];
    const launch = () => RL.fill(r, 1.2);
    launch();                                   // wave A at the slow lag it was created with
    for (let s2 = 0; s2 < 120 * 12; s2++) {
      t += DT;
      if (Math.abs(t - 0.5) < DT / 2) {         // half a second later: a note change, then wave B
        RL.setInterval(r, secondInterval);
        launch();
      }
      const f = RL.step(r, DT);
      if (f.includes(r.n - 1)) tailAt.push(t);
    }
    return tailAt;
  };

  const fast = arrivals(0.08);                  // B launched into a much faster body
  const same = arrivals(0.25);                  // B launched at the same speed

  ok(fast.length >= 2, `both waves reached the tail (${fast.length} arrivals)`);
  ok(same.length >= 2, `and in the control too (${same.length})`);
  const gapFast = fast[1] - fast[0], gapSame = same[1] - same[0];
  ok(gapFast < gapSame * 0.6,
     `accelerating COMPRESSES the body — arrivals ${gapFast.toFixed(2)}s apart vs ${gapSame.toFixed(2)}s at constant tempo`);
  ok(gapFast < 0.5,
     `the second wave closed on the first: launched 0.50s behind, arrived ${gapFast.toFixed(2)}s behind`);

  const slow = arrivals(0.45);                  // and the reverse
  const gapSlow = slow[1] - slow[0];
  ok(gapSlow > gapSame, `decelerating SPREADS them (${gapSlow.toFixed(2)}s vs ${gapSame.toFixed(2)}s)`);
}


// ---------------------------------------------------------------- 13) NO DEAD ZONE ON BREATH
// Found by Bill playing the EWI, 2026-09-09: he had to reach a minimum breath before anything
// happened at all. The cause was arithmetic, not taste — a constant leak on the SUPPLY POINT.
// With fill rate g and head leak b, anything softer than b/g can never reach threshold however
// long it is held. Not slow: impossible. So the head is an integrator and every breath speaks.
{
  const G = 1.6, LEAK = 0.35;                 // the numbers the scope was using
  const firstEvent = (breath, headBleed) => {
    const r = RL.create({ n: 6, full: 1, reset: 0.12, spill: 0.14, lag: 0.17,
                          bleed: LEAK, headBleed: headBleed });
    let t = 0;
    for (let s = 0; s < 120 * 30; s++) {
      t += DT; RL.fill(r, G * breath * DT);
      if (RL.step(r, DT).includes(0)) return t;
    }
    return -1;                                 // never spoke
  };

  /* the fault, preserved so it cannot come back unnoticed */
  ok(firstEvent(0.15, LEAK) < 0, `with a leaking head, breath 0.15 NEVER speaks (wall at ${(LEAK / G).toFixed(3)})`);
  ok(firstEvent(0.20, LEAK) < 0, "nor 0.20 — the whole soft range was mathematically dead");

  /* the fix */
  const soft = firstEvent(0.15, 0), fainter = firstEvent(0.05, 0), full = firstEvent(1.0, 0);
  ok(soft > 0,    `with an integrating head, breath 0.15 speaks (${soft.toFixed(2)}s)`);
  ok(fainter > 0, `and so does 0.05 — there is no floor, only patience (${fainter.toFixed(2)}s)`);
  ok(full > 0 && full < soft,
     `while hard breath still speaks sooner — the ORDER is preserved (${full.toFixed(2)}s vs ${soft.toFixed(2)}s)`);

  /* and the head still spends what it takes in: it is an integrator, not a hoard */
  const r = RL.create({ n: 4, full: 1, spill: 0.1, bleed: 0.35, headBleed: 0 });
  for (let s = 0; s < 120 * 4; s++) RL.fill(r, G * 0.5 * DT), RL.step(r, DT);
  const banked = r.st[0].level;
  ok(banked < 1.0, `the head never holds more than one threshold (${banked.toFixed(3)})`);
}


console.log(fail ? `vertebra_ref: ${fail} FAIL` : "vertebra_ref: PASS");
process.exit(fail ? 1 : 0);

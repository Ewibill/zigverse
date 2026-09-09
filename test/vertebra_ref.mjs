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
ok(RL.VERSION === "0.22.0", `version stamp is 0.22.0 (${RL && RL.VERSION})`);

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
  ok(r.st.every((e) => e.level < 1e-6), "and no store is holding charge it will never spend");
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

console.log(fail ? `vertebra_ref: ${fail} FAIL` : "vertebra_ref: PASS");
process.exit(fail ? 1 : 0);

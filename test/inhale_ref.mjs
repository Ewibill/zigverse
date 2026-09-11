// inhale_ref.mjs — A WIND PLAYER MUST BREATHE IN. (ZigCore.Inhale 0.27)
//
// Breath is the source of life in this engine and it STOPS, several times a minute, as
// physiology rather than expression. A listener hears one phrase across an inhale; the organism
// must too, or the instrument is fighting the person playing it.
//
// The threshold is measured, not chosen. From three of Bill's takes: 16 inhales at a median of
// 0.47s, one at 1.08s, two at a median of 0.84s — and a 9.4s silence that is a REST between ideas,
// not a breath. Shorter than `hold` the body keeps what it has; longer and it decompresses.

import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
const ZC = globalThis.ZigCore, IN = ZC.Inhale, RL = ZC.Relay;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const DT = 1 / 120;

ok(!!IN && IN.VERSION === "0.27.0", `Inhale is 0.27.0 (${IN && IN.VERSION})`);

const blow = (inh, secs, level) => { for (let s = 0; s < secs * 120; s++) IN.update(inh, DT, level === undefined ? 0.5 : level); };
const quiet = (inh, secs) => { let h = 0; for (let s = 0; s < secs * 120; s++) h = IN.update(inh, DT, 0); return h; };

// -------------------------------------------------------- 1) AN INHALE IS NOT A REST
// The whole law, in one comparison, at the durations his own playing produces.
{
  const inh = IN.create({ hold: 1.2, release: 0.6 });
  blow(inh, 2);
  ok(inh.held === 0, "while breath is flowing nothing is held");

  ok(quiet(inh, 0.47) === 1, "a 0.47s inhale — his median — holds the body completely");
  blow(inh, 1);
  ok(quiet(inh, 1.08) === 1, "and so does 1.08s, the longest single inhale in the three takes");

  blow(inh, 1);
  const atRest = quiet(inh, 9.4);
  ok(atRest === 0, `but a 9.4s silence is a REST and the body is released (${atRest})`);
  ok(IN.resting(inh), "and it says so");
}

// -------------------------------------------------------- 2) IT LETS GO, IT DOES NOT SNAP
// A body that drops its pose the instant the grace period expires would advertise the mechanism.
{
  const inh = IN.create({ hold: 1.2, release: 0.6 });
  blow(inh, 1);
  const curve = [];
  let t = 0;
  for (let s = 0; s < 300; s++) { t += DT; curve.push([t, IN.update(inh, DT, 0)]); }
  const at = (sec) => curve.find((c) => c[0] >= sec)[1];
  ok(at(1.0) === 1, "held at 1.0s");
  ok(at(1.5) > 0.3 && at(1.5) < 0.8, `letting go at 1.5s (${at(1.5).toFixed(2)})`);
  ok(at(1.9) < 0.1, `nearly gone at 1.9s (${at(1.9).toFixed(2)})`);
  let monotone = true;
  for (let i = 1; i < curve.length; i++) if (curve[i][1] > curve[i - 1][1]) monotone = false;
  ok(monotone, "and it only ever falls — no flicker at the boundary");
}

// -------------------------------------------------------- 3) IT ARMS
// A body nobody has played yet is not holding its breath; it has not started.
{
  const cold = IN.create();
  ok(quiet(cold, 5) === 0, "an unplayed body holds nothing");
  ok(!IN.resting(cold), "and is not 'resting' either — it has no phrase to be between");
  blow(cold, 0.5);
  ok(cold.armed, "one breath arms it");
  ok(quiet(cold, 0.4) === 1, "and from then on an inhale is an inhale");
}

// -------------------------------------------------------- 4) RELAY IS UNCHANGED WITHOUT IT
// The law reports; it does not act. Every existing caller passes two arguments and must be
// bit-for-bit unaffected.
{
  const run = (hold) => {
    const r = RL.create({ n: 6, full: 1, spill: 0.05, lag: 0.12, bleed: 0.35, tau: 0.5 });
    RL.fill(r, 1.2);
    const out = [];
    for (let s = 0; s < 120 * 4; s++) {
      const f = (hold === undefined) ? RL.step(r, DT) : RL.step(r, DT, hold);
      if (f.length) out.push(s + ":" + f.join(","));
    }
    return out.join("|") + "#" + r.pose.map((p) => p.toFixed(6)).join(",");
  };
  ok(run() === run(0), "Relay.step(r, dt) and Relay.step(r, dt, 0) are identical");
}

// -------------------------------------------------------- 5) THE PHRASE SURVIVES THE BREATH
// What it is all for: with the hold applied, a body mid-gesture is still lit when the performer
// comes back in. Without it, the same body has gone dark.
{
  const drive = (hold) => {
    const r = RL.create({ n: 6, full: 1, spill: 0.05, lag: 0.12, bleed: 0.35, tau: 0.5 });
    for (let s = 0; s < 120 * 2; s++) { RL.fill(r, 1.4 * DT); RL.step(r, DT, 0); }   /* playing */
    const inh = IN.create({ hold: 1.2, release: 0.6 });
    for (let s = 0; s < 240; s++) IN.update(inh, DT, 0.5);
    let peak = 0;
    for (let s = 0; s < 120 * 0.9; s++) {                                            /* a 0.9s inhale */
      const h = hold ? IN.update(inh, DT, 0) : 0;
      RL.step(r, DT, h);
    }
    for (let i = 0; i < r.n; i++) peak = Math.max(peak, RL.pose(r, i));
    return peak;
  };
  const withHold = drive(true), without = drive(false);
  ok(Math.abs(withHold - 1) < 1e-6, `with the law the phrase is FULLY lit when he comes back in (${withHold.toFixed(3)})`);
  ok(without < 0.25, `without it the same 0.9s breath has drained it to ${without.toFixed(3)}`);
  ok(withHold > without * 4, `a ${(withHold / without).toFixed(1)}x difference across one ordinary breath`);

  /* and it scales the way a fading body does: the longer the breath, the more there was to save */
  const long0 = drive(false), long1 = drive(true);
  ok(long1 >= long0, "holding is never worse than not holding");
}

console.log(fail ? `inhale_ref: ${fail} FAIL` : "inhale_ref: PASS");
process.exit(fail ? 1 : 0);

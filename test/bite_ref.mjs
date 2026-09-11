// bite_ref.mjs — WHICH NOTES REACH THE BODY, and A RHYTHM THAT IS INEVITABLE.
//                (ZigCore.Bite 0.26 · ZigCore.Bounce 0.26)
//
// Bite exists because breath cannot articulate for this performer — measured across four takes,
// breath at note onset sits at a median of 46 with one zero crossing in 22 seconds. Notes
// articulate; breath is an envelope. And because his density swings 8.8 to 1.6 notes/s, a fixed
// gate is right for one mode and wrong for the other, so the law holds a TARGET RATE and lets
// the threshold move instead.
//
// Bounce exists because a rhythm can be irregular without being arbitrary. Energy only leaves,
// so every impact is heard as caused by the last, and a throw ACCELERATES INTO STILLNESS.

import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
const ZC = globalThis.ZigCore, BT = ZC.Bite, BO = ZC.Bounce;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

ok(!!BT && BT.VERSION === "0.26.0", `Bite is 0.26.0 (${BT && BT.VERSION})`);
ok(!!BO && BO.VERSION === "0.26.0", `Bounce is 0.26.0 (${BO && BO.VERSION})`);

/* a plain zig-zag line at a chosen rate, so density is the only variable */
function stream(b, rate, secs, breath) {
  let hits = 0, t = 0, k = 0;
  const dt = 1 / rate;
  const shape = [0, 2, 4, 2, 0, -3, 1, 5, 2, -1];
  while (t < secs) {
    t += dt;
    if (BT.note(b, t, 60 + shape[k % shape.length], breath === undefined ? 60 : breath)) hits++;
    k++;
  }
  return hits / secs;
}

// ------------------------------------------------------- 1) THE RATE IS THE TARGET, NOT THE RULE
// The reason this law exists. A fixed gate tuned to ribbon playing nearly stops the body when the
// performer opens up: his turning points run 2.6/s at 8.8 notes/s and 0.6/s at 1.6 notes/s.
{
  const dense  = stream(BT.create({ target: 2 }), 9,   40);
  const middle = stream(BT.create({ target: 2 }), 4,   40);
  const sparse = stream(BT.create({ target: 2 }), 1.6, 40);

  ok(dense  < 9 * 0.7,  `at 9 notes/s the law is choosy (${dense.toFixed(2)}/s of 9)`);
  ok(sparse > 1.6 * 0.5, `at 1.6 notes/s it lets most through (${sparse.toFixed(2)}/s of 1.6)`);

  /* the swing that matters: input 5.6x, output far less */
  const swing = dense / sparse;
  ok(swing < 3, `a 5.6x swing in playing density becomes ${swing.toFixed(1)}x at the body`);
  ok(middle > sparse * 0.8 && middle < dense * 1.3, "and the middle sits between the two");
}

// ------------------------------------------------------- 2) BREATH IS AUTO-RANGED
// Breath is not a plateau — it was flattened by speed. Ribbon playing spans 38..75 of 127;
// open playing spans 18..114. Read against the MIDI range both look like nothing. Read against
// the performer's OWN running range, both are expressive.
{
  const b = BT.create({ target: 6 });
  const seen = [];
  let t = 0;
  for (let i = 0; i < 300; i++) {
    t += 0.12;
    /* a narrow band, exactly the case that looked flat: 40..70 out of 127 */
    const breath = 55 + 15 * Math.sin(i / 9);
    const hit = BT.note(b, t, 60 + (i % 7), breath);
    if (hit) seen.push(hit.level);
  }
  ok(seen.length > 20, `the line produced events (${seen.length})`);
  const lo = Math.min(...seen), hi = Math.max(...seen);
  ok(lo < 0.15 && hi > 0.85,
     `a 40..70 breath band still reaches both ends of the scale (${lo.toFixed(2)}..${hi.toFixed(2)})`);
  ok(b.bMax - b.bMin < 60, "because the range tracks the performer, not the protocol");
}

// ------------------------------------------------------- 3) A REPEATED CELL IS FOUND, AND TIMED
// His runs are built from 2-8 note cells that repeat — 22% of notes in ribbon playing — and the
// cells GROW: 4 notes, then 5, then 6, same tail. The cell's DURATION is what a body can take
// its length from, so it is reported, not just the fact of it.
{
  const b = BT.create({ target: 99 });                   /* let everything through */
  const cellPitches = [72, 69, 67, 65];
  let t = 0, found = null;
  for (let rep = 0; rep < 3; rep++)
    for (const p of cellPitches) { t += 0.125; const h = BT.note(b, t, p, 60); if (h && h.cell) found = h; }

  ok(found && found.cell === 4, `a four-note cell repeating is detected as length 4 (${found && found.cell})`);
  ok(found && Math.abs(found.cellSecs - 0.5) < 1e-6,
     `and its duration is measured (${found && found.cellSecs.toFixed(3)}s for 4 notes at 0.125s)`);
  ok(found.why === "cell", "and it is reported as a cell rather than as an ordinary note");

  /* THE DETECTION LAGS BY ONE CYCLE, and must: you cannot know a figure repeated until it has.
     Recognising the performer on the second pass is a better behaviour than guessing on the first. */
  const b2 = BT.create({ target: 99 });
  let t2 = 0, firstPass = false;
  for (const p of cellPitches) { t2 += 0.125; const h = BT.note(b2, t2, p, 60); if (h && h.cell) firstPass = true; }
  ok(!firstPass, "the FIRST statement of a cell is not claimed as a repeat");
}

// ------------------------------------------------------- 4) THE STRUCTURAL THREE ALWAYS PASS
// Rare and meaningful events must not be starved out by a threshold that has risen during a
// dense passage — otherwise the loudest playing hides exactly the moments that matter.
{
  const b = BT.create({ target: 0.2 });                  /* drive the threshold to its ceiling */
  let t = 0;
  for (let i = 0; i < 400; i++) { t += 0.05; BT.note(b, t, 60 + (i % 5), 60); }
  ok(b.thr > 1.0, `a dense passage raises the threshold to its ceiling (${b.thr.toFixed(2)})`);

  t += 0.05;
  const leap = BT.note(b, t, 60 + 12, 60);
  ok(leap && leap.why === "leap", "a big leap still reaches the body");

  /* a STEP, not a leap, so only the breath can be carrying it */
  t += 0.05;
  const swell = BT.note(b, t, 73, 118);
  ok(swell && swell.why === "swell", `and so does a breath swell on an ordinary step (${swell && swell.why})`);
}

// ------------------------------------------------------- 5) THE BALL ACCELERATES INTO STILLNESS
// Not a randomiser. Energy only leaves, so each impact descends from the last — irregular and
// inevitable at once, which is the only kind of irregular that reads as alive.
{
  const b = BO.create({ surfaces: [{ rest: 0.52, k: 0.42 }], floor: 0.06 });
  BO.throw_(b, 1);
  const DT = 1 / 120; let t = 0; const at = [];
  for (let i = 0; i < 2400; i++) { t += DT; for (const h of BO.step(b, DT)) at.push(t); }

  ok(at.length >= 4 && at.length <= 12, `one throw gives a handful of impacts (${at.length})`);
  const gaps = at.map((x, i) => i ? x - at[i - 1] : x);
  let shrinking = true;
  for (let i = 1; i < gaps.length; i++) if (gaps[i] >= gaps[i - 1]) shrinking = false;
  ok(shrinking, `every gap is shorter than the one before (${gaps.map((g) => g.toFixed(3)).join(" ")})`);
  ok(BO.settled(b), "and it SETTLES — without a floor the intervals shrink forever and a throw never ends");
  ok(at[at.length - 1] < 3, `the whole gesture is over inside ${at[at.length - 1].toFixed(2)}s`);

  /* restitution is the character: lively skitters, dry knocks twice and quits */
  const count = (rest) => {
    const q = BO.create({ surfaces: [{ rest: rest, k: 0.42 }], floor: 0.06 });
    BO.throw_(q, 1); let c = 0;
    for (let i = 0; i < 2400; i++) c += BO.step(q, DT).length;
    return c;
  };
  ok(count(0.75) > count(0.52) && count(0.52) > count(0.35),
     `restitution sets how long it lives (${count(0.75)} / ${count(0.52)} / ${count(0.35)} impacts)`);
}

// ------------------------------------------------------- 6) TWO SURFACES INTERLEAVE
// The dream: a ball off a floor AND a wall, gaps clustering tight then opening out, all of it
// one stream. Also the reason density is the whole tuning — two lively surfaces are far too busy
// for a body that wants about two events a second.
{
  const two = BO.create({ surfaces: [{ rest: 0.62, k: 0.45 }, { rest: 0.78, k: 0.30 }], floor: 0.035 });
  const one = BO.create({ surfaces: [{ rest: 0.52, k: 0.42 }], floor: 0.06 });
  BO.throw_(two, 1); BO.throw_(one, 1);
  const DT = 1 / 120; let a = 0, b = 0;
  for (let i = 0; i < 2400; i++) { a += BO.step(two, DT).length; b += BO.step(one, DT).length; }
  ok(a > 2 * b, `two lively surfaces are far busier than one dry (${a} vs ${b} impacts per throw)`);
  ok(a > 15, "which is the dream as dreamt — and too dense for the body without tuning");
}

// ------------------------------------------------------- 7) DETERMINISM
{
  const run = () => {
    const b = BO.create({ surfaces: [{ rest: 0.52, k: 0.42 }], floor: 0.06 });
    BO.throw_(b, 0.8); const out = []; let t = 0;
    for (let i = 0; i < 1200; i++) { t += 1 / 120; for (const h of BO.step(b, 1 / 120)) out.push(t.toFixed(4) + ":" + h.toFixed(3)); }
    return out.join("|");
  };
  ok(run() === run(), "two throws of the same energy are identical impact for impact");
}

console.log(fail ? `bite_ref: ${fail} FAIL` : "bite_ref: PASS");
process.exit(fail ? 1 : 0);

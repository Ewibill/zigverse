/* =============================================================================
   test/law_ground_ref.mjs — GROUND 0.1.0, proved
   (run: node test/law_ground_ref.mjs)

   "A law with no numeric test is an opinion."

   GROUND says a world has a floor it never falls below, and a direction its
   light travels from. It exists because of a collision measured in
   tools/ground_gap.mjs and named nowhere before 2026-08-18:

     THE AFTERIMAGE ASSUMES A DARK WORLD, IN ITS ARITHMETIC.

   It composites with max(), which is right when light climbs upward out of
   black. Invert the world — a dark organism on a bright ground, which is what
   `radiance=white` is FOR — and the sky's own memory outranks the body:
   max(0.25, 0.8359) returns the sky. The creature is erased by its own
   afterimage, in a shader that reports no error.

   What this probe proves:
     1  identity    — `void` is today's world exactly; every arithmetic path
                      reduces to what already ships
     2  the erasure — reproduced from the law's own compose(), not asserted
     3  the rescue  — `signed` returns the body, and by how much
     4  the gate    — a luminance floor remembers the empty sky; distance-from-
                      ground remembers the organism
     5  refusals    — the three combinations that render fine and destroy the
                      piece, including the one Bill saw on 8/17
     6  grounds     — the table is ordered, paired, and internally consistent
     7  registration— the Canon carries it, and it does NOT ride a rail

   Nothing here runs a shader. eyeZ is the real gate.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigcore.js"), "utf8"))();
const ZC = globalThis.ZigCore;
const G = ZC.Ground;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  \u2713 " : "  \u2717 ") + msg); if (!ok) failures++; };
const f4 = (x) => x.toFixed(4);

console.log("\nGROUND " + G.VERSION + " \u2014 a world has a ground of being\n");

/* ---- 1 · identity ------------------------------------------------------- */
console.log("1 \u00b7 IDENTITY \u2014 `void` is today, unchanged");
{
  const v = G.grounds.void;
  say(v.lift === 0 && v.compose === "rise" && v.room === null,
    "void is lift 0, rise compositing, no tone curve \u2014 the black-box theatre");
  say(G.resolve("void") === v && G.resolve("nonsense") === v,
    "an unknown ground resolves to void \u2014 a typo cannot silently light the world");
  /* every compose path must agree with plain max() when the ground is at zero */
  let same = true;
  for (let s = 0; s <= 1.0001; s += 0.05) for (let t = 0; t <= 1.0001; t += 0.05)
    if (Math.abs(G.compose("signed", s, t, 0) - Math.max(s, t)) > 1e-12) same = false;
  say(same, "at lift 0, `signed` and `rise` are arithmetically IDENTICAL across the whole square");
  let gatedSame = true;
  for (let v = 0; v <= 1.0001; v += 0.02)
    if (Math.abs(G.gated("signed", v, 0, 0.45) - G.gated("rise", v, 0, 0.45)) > 1e-12) gatedSame = false;
  say(gatedSame, "\u2026 and so is the GATED SCENE \u2014 falling back to a ground at zero is contributing nothing");
  /* The decay differs in one place only: below zero. `rise` lets a spent trail
     drift negative; `signed` stops it at the ground. max(scene, trail) can
     never return a negative against a non-negative scene, so that difference
     never reaches the glass \u2014 the identity to prove is of the OBSERVABLE
     result, not of an internal scratch value. Asserting the intermediate would
     be measuring the wrong thing, which this project has done often enough to
     recognise on sight. */
  let observedSame = true, worst = 0;
  for (let sc = 0; sc <= 1.0001; sc += 0.05) for (let tr = 0; tr <= 1.0001; tr += 0.05) {
    const r = G.compose("rise",   G.gated("rise",   sc, 0, 0.45), G.decay("rise",   tr, 0, 0.98, 0.0024), 0);
    const g = G.compose("signed", G.gated("signed", sc, 0, 0.45), G.decay("signed", tr, 0, 0.98, 0.0024), 0);
    worst = Math.max(worst, Math.abs(r - g));
    if (Math.abs(r - g) > 1e-12) observedSame = false;
  }
  say(observedSame, "\u2026 and at lift 0 the COMPOSED RESULT is identical across the whole square (max delta " + worst.toExponential(1) + ")");
  say(G.decay("rise", 0, 0, 0.98, 0.0024) < 0 && G.decay("signed", 0, 0, 0.98, 0.0024) === 0,
    "the only divergence is a spent trail drifting below zero, which max() can never return");
  say(ZC.Canon.registry.ground.defaults.lift === 0,
    "\u2026 and the law's defaults ARE void, so it ships OFF like every law before it");
}

/* ---- 2 · the erasure, reproduced --------------------------------------- */
console.log("\n2 \u00b7 THE ERASURE \u2014 reproduced, not asserted");
{
  const EPS = 0.6 / 255, DECAY = Math.exp(-(1 / 60) / 1.2), GATE = 0.45;
  /* a pixel in an engine that has been RUNNING: the trail is warm before the
     body arrives. Measuring one frame from an empty buffer misses this
     entirely \u2014 which is exactly how the first version of ground_gap got it
     wrong, and why it refused its own author's claim. */
  const arrive = (bg, body, mode, lift, at) => {
    let trail = (mode === "signed") ? lift : 0;      // a world starts AT its ground
    for (let i = 0; i < 120; i++)
      trail = G.compose(mode, G.gated(mode, bg, lift, at), G.decay(mode, trail, lift, DECAY, EPS), lift);
    const before = trail;
    trail = G.compose(mode, G.gated(mode, body, lift, at), G.decay(mode, trail, lift, DECAY, EPS), lift);
    return { before, glass: G.compose(mode, body, trail, lift) };
  };

  const darkOk = arrive(0.007, 0.60, "rise", 0, GATE);
  console.log("    DARK  (void)          body 0.6000 \u2192 glass " + f4(darkOk.glass));
  say(Math.abs(darkOk.glass - 0.60) < 0.01,
    "on a dark ground the body reaches the glass unharmed \u2014 max() is CORRECT there");

  const litBad = arrive(0.850, 0.25, "rise", 0.62, GATE);
  console.log("    LIT + rise (the bug)  body 0.2500 \u2192 glass " + f4(litBad.glass) +
              "   trail already there " + f4(litBad.before));
  say(litBad.glass > 0.80,
    "on a lit ground with rise compositing the body is ERASED by the sky's memory");
  say(Math.abs(litBad.glass - 0.25) > 0.5,
    "\u2026 and not marginally: the glass is " + f4(litBad.glass - 0.25) + " away from what was drawn");

  /* ---- 3 · the rescue ------------------------------------------------- */
  console.log("\n3 \u00b7 THE RESCUE \u2014 `signed` measures departure, not brightness");
  const litOk = arrive(0.850, 0.25, "signed", 0.62, G.grounds.mist.gateAt);
  console.log("    LIT + signed          body 0.2500 \u2192 glass " + f4(litOk.glass));
  say(Math.abs(litOk.glass - 0.25) < 0.01,
    "the same body on the same ground REACHES THE GLASS under signed compositing");
  say(litOk.glass < litBad.glass - 0.5,
    "the rescue is worth " + f4(litBad.glass - litOk.glass) + " of luminance at that pixel");
  say(Math.abs(0.25 - 0.62) > Math.abs(0.85 - 0.62),
    "because on a bright ground the DARK body is the greater departure (0.37 vs 0.23)");

  /* the error the probe caught: memory must fade to the GROUND, not past it */
  let m = 0.25, floorBreak = false;
  for (let i = 0; i < 600; i++) { m = G.decay("signed", m, 0.62, DECAY, EPS); if (m < -1e-9) floorBreak = true; }
  console.log("    a dark memory left to fade on a pale ground settles at " + f4(m));
  say(!floorBreak && Math.abs(m - 0.62) < 1e-6,
    "memory fades TO the ground and stops \u2014 it never slides past it into negative luminance");
}

/* ---- 4 · the gate ------------------------------------------------------ */
console.log("\n4 \u00b7 THE GATE \u2014 what a world bothers to remember");
{
  const bg = 0.85, body = 0.25, lift = 0.62, at = 0.45;
  const riseBg = G.gate("rise", bg, lift, at), riseBody = G.gate("rise", body, lift, at);
  console.log("    luminance floor   sky keeps " + f4(riseBg) + " \u00b7 body keeps " + f4(riseBody));
  say(riseBg > 0.99 && riseBody < 0.01,
    "a luminance FLOOR remembers the empty sky and forgets the organism \u2014 exactly inverted");
  const sgBg = G.gate("signed", bg, lift, 0.15), sgBody = G.gate("signed", body, lift, 0.15);
  console.log("    distance-from-gnd sky keeps " + f4(sgBg) + " \u00b7 body keeps " + f4(sgBody));
  say(sgBody > sgBg, "distance-from-ground remembers the BODY more than the sky it crosses");
  say(G.gate("rise", 0.6, 0, 0.45) === G.gate("signed", 0.6, 0, 0.45),
    "and at lift 0 the two gates are the same function \u2014 identity holds here too");
}

/* ---- 5 · the refusals -------------------------------------------------- */
console.log("\n5 \u00b7 THE REFUSALS \u2014 combinations that render fine and destroy the piece");
{
  const R = ZC.Canon.registry.ground.refuses;
  const check = (g) => R.filter((r) => {
    const { lift, compose, room } = g;
    try { return Function("lift", "compose", "room", "return (" + r.when + ")")(lift, compose, room); }
    catch { return false; }
  });
  say(R.length === 3, "three refusals are declared on the law itself, not buried in a tool");

  const seen817 = { lift: 0.62, compose: "rise", room: null };
  const hits = check(seen817);
  console.log("    the 8/17 composition (lit ground, rise, no room) trips " + hits.length + " refusal(s):");
  for (const h of hits) console.log("      \u00b7 " + h.says.slice(0, 96));
  say(hits.length === 2,
    "what Bill saw on 2026-08-17 is now TWO build-time faults, not a surprise on screen");

  say(check(G.grounds.void).length === 0, "void trips nothing \u2014 today's world is legal");
  say(check(G.grounds.dusk).length === 0, "dusk trips nothing \u2014 lift 0.055 is below the inversion threshold");
  say(check(G.grounds.mist).length === 0 && check(G.grounds.paper).length === 0,
    "mist and paper trip nothing \u2014 both pair signed compositing with the white room");
  say(check({ lift: 0, compose: "signed", room: null }).length === 1,
    "signed on a dark ground is refused as pointless \u2014 legal arithmetic, no reason to ask for it");
}

/* ---- 6 · the grounds table --------------------------------------------- */
console.log("\n6 \u00b7 THE GROUNDS");
{
  const names = Object.keys(G.grounds);
  console.log("    " + names.map((n) => n + " " + f4(G.grounds[n].lift)).join("  \u00b7  "));
  const lifts = names.map((n) => G.grounds[n].lift);
  say(lifts.every((v, i) => i === 0 || v > lifts[i - 1]),
    "the table is ordered by lift \u2014 void \u2192 dusk \u2192 mist \u2192 paper, dark to light");
  say(names.every((n) => {
    const g = G.grounds[n];
    return (g.lift > 0.3) === (g.compose === "signed") && (g.lift > 0.3) === (g.room !== null);
  }), "every lit ground pairs signed compositing AND an inverted room \u2014 no half-declarations");
  say(names.every((n) => {
    const s = G.grounds[n].sky, L = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L(s.top) <= L(s.mid) && L(s.mid) <= L(s.hor);
  }), "every sky brightens top \u2192 mid \u2192 horizon, so the gradient never inverts");
  say(names.every((n) => !!G.grounds[n].says), "every ground says what it IS, in words, not just numbers");
}

/* ---- 7 · registration --------------------------------------------------- */
console.log("\n7 \u00b7 IN THE CANON");
{
  const L = ZC.Canon.registry.ground;
  say(!!L && L.pillar === "habitat", "registered under habitat, alongside radiance");
  say(L.splice.rail === null,
    "Ground rides NO rail \u2014 it is the starting condition of the light's journey, not a station on it");
  say(L.presetKey === "ground", "a host names a ground: ZIG_LAWS = { ground: { ground: \"mist\" } }");
  const stamp = ZC.Canon.stamp();
  say(typeof stamp === "string", "and the build can state which laws are active: \"" + stamp + "\"");
}

console.log(failures === 0
  ? "\nPASS \u2014 GROUND " + G.VERSION + ": the world can be lit from outside, and the four\n" +
    "capabilities that must agree about it can no longer disagree silently."
  : "\nFAIL \u2014 " + failures + " check(s) failed");
process.exit(failures === 0 ? 0 : 1);

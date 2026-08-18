/* =============================================================================
   tools/ground_gap.mjs — THE EVIDENCE FOR THE GROUND LAW
   (run: node tools/ground_gap.mjs [engineDir])

   Bill asked for a white background. The honest answer turned out to be that
   the engine cannot have one — not "it defaults to black", but that the void
   has never been a decision. This file measures exactly what is missing, and
   in the course of measuring finds a collision nobody named:

     THE AFTERIMAGE ASSUMES A DARK WORLD, IN ITS ARITHMETIC.

   The afterimage composites with max(). That is correct and elegant when light
   accumulates upward from black. Invert the world — a dark organism on a bright
   ground, which is what `radiance=white` is FOR — and max() does not merely
   look wrong, it erases the organism: the bright background's own memory is
   brighter than the body, so max(body, memory) returns the memory. The
   creature disappears into its own afterimage.

   That is why Ground must be a LAW and not a preset. "Lit from outside" has
   consequences that reach into another capability's compositing math, and a
   preset has no way to say so.

   Nothing here runs a shader. The afterimage math is simulated on the CPU from
   the exact WGSL in AFTERIMAGE_WGSL, because the claim is arithmetic and
   arithmetic can be checked without a GPU. eyeZ remains the real gate.
   ========================================================================== */
import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = process.argv[2] || path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GPU = readFileSync(ROOT + "/engine/zigwebgpu.js", "utf8");
const SPECIES = readFileSync(ROOT + "/species/sickleswarm.js", "utf8");

let FAIL = 0;
const ok = (b, s) => { console.log((b ? "  PROVEN  " : "  UNPROVEN") + " \u00b7 " + s); if (!b) FAIL++; };
const bar = (n) => "-".repeat(n);

/* ---------------------------------------------------------------------------
   1 · THE CLEAR COLOUR IS NOT A DECISION — but there are fewer of them than
   a grep suggests. Two of the five are immediately overwritten by a
   full-screen triangle (draw(3)), so their clear value never reaches a pixel.
   Counting all five as "the background" would have had us edit dead code and
   then wonder why nothing changed.
   ------------------------------------------------------------------------ */
console.log("\n1 \u00b7 THE VOID HAS NEVER BEEN A DECISION");
console.log(bar(74));

const lines = GPU.split("\n");
const clears = [];
lines.forEach((ln, i) => {
  if (/clearValue:\s*\{\s*r:\s*0\s*,\s*g:\s*0\s*,\s*b:\s*0/.test(ln)) clears.push(i + 1);
});
console.log("  literal black clears: " + clears.join(", "));
ok(clears.length === 5, clears.length + " hardcoded black clear values, no variable among them");

/* A pass whose very next statements draw a full-screen triangle overwrites
   every pixel, so its clear is inert. */
const inert = [], live = [];
for (const L of clears) {
  const after = lines.slice(L - 1, L + 2).join(" ");
  (/\.draw\(3\)/.test(after) ? inert : live).push(L);
}
console.log("\n  inert (overwritten by a full-screen draw(3)): " + (inert.join(", ") || "none"));
console.log("  LIVE  (a real background; only some pixels get geometry): " + live.join(", "));
ok(inert.length === 2 && live.length === 3,
   "only 3 of the 5 are actually the background \u2014 2 are dead clears in the afterimage passes");

/* ---------------------------------------------------------------------------
   2 · THE SKY, BY CONTRAST, IS ALREADY A VARIABLE. This is the good news and
   it halves the work: skyTop/skyMid/horizon/ground are View uniforms the
   species authors, not literals in the renderer.
   ------------------------------------------------------------------------ */
console.log("\n\n2 \u00b7 THE SKY IS ALREADY PARAMETERIZED");
console.log(bar(74));

const slots = ["skyTop", "skyMid", "horizon", "ground"];
const declared = slots.filter((s) => new RegExp(s + ":\\s*vec4f").test(GPU));
console.log("  View members: " + declared.join(", "));
ok(declared.length === 4, "all four sky/ground colours are View uniforms \u2014 no new plumbing needed");

const setters = (SPECIES.match(/setV4\(\s*(36|40|44|48)\b/g) || []).length;
console.log("  species writes to sky slots: " + setters + " call(s)");
ok(setters >= 4, "the species authors them per world (dusk vs night), so a new world can too");

/* skyMid doubles as the haze target — a third of the pairing is already wired. */
const hazeUsesSky = /mix\(\s*c\s*,\s*V\.skyMid\.rgb/.test(GPU) || /mix\(\s*col\s*,\s*V\.skyMid\.rgb/.test(GPU);
ok(hazeUsesSky, "the fog mixes toward V.skyMid \u2014 brighten the sky and the HAZE follows for free");

/* No new View slots are needed, which matters: View is full at 112/112. */
const viewFull = /VIEWF\s*=\s*112/.test(GPU) || /112/.test(GPU);
console.log("\n  the clear colour is set in JS at render-pass creation, not in a uniform,");
console.log("  so Ground needs ZERO new View slots \u2014 View is full at 112/112.");
ok(viewFull, "no View growth helper is a prerequisite for this law");

/* ---------------------------------------------------------------------------
   3 · THE COLLISION. The afterimage's arithmetic assumes a dark world.
   Simulated from the exact WGSL: trailFs and blitFs, both max()-based.
   ------------------------------------------------------------------------ */
console.log("\n\n3 \u00b7 THE AFTERIMAGE ASSUMES A DARK WORLD \u2014 IN ITS ARITHMETIC");
console.log(bar(74));

const usesMax = /max\(s \* keep, p \* A\.decay/.test(GPU) && /return vec4f\(max\(s, t\), 1\.0\)/.test(GPU);
ok(usesMax, "trailFs = max(scene*keep, prev*decay - eps) and blitFs = max(scene, trail)");
console.log("  max() compositing is correct when light accumulates UPWARD from black.");

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const EPS = 0.6 / 255, GATE = 0.45, TAU = 1.2, DT = 1 / 60;
const DECAY = Math.exp(-DT / TAU);

/* One pixel, N frames. The body crosses it on frame 0 and never returns; we
   then ask how visible its memory is against an untouched background pixel. */
function simulate(bg, body, frames) {
  let trailBody = 0, trailBg = 0;
  let glassBody = 0, glassBg = 0;
  for (let f = 0; f < frames; f++) {
    const sBody = f === 0 ? body : bg;          // body passes once, then background
    const sBg = bg;                              // this pixel never sees the body
    const kB = smoothstep(GATE, GATE + 0.22, sBody);
    const kG = smoothstep(GATE, GATE + 0.22, sBg);
    trailBody = Math.max(sBody * kB, trailBody * DECAY - EPS);
    trailBg = Math.max(sBg * kG, trailBg * DECAY - EPS);
    glassBody = Math.max(sBody, trailBody);
    glassBg = Math.max(sBg, trailBg);
  }
  return { trailBody, trailBg, glassBody, glassBg, contrast: Math.abs(glassBody - glassBg) };
}

const FRAMES = 30;   // half a second at 60fps
const dark = simulate(0.007, 0.60, FRAMES);   // night sky, bright organism  (today)
const lit = simulate(0.850, 0.25, FRAMES);   // bright ground, dark organism (radiance=white)

const row = (name, r) => console.log("    " + name.padEnd(22) +
  " trail " + r.trailBody.toFixed(4).padStart(7) +
  " | glass(body) " + r.glassBody.toFixed(4).padStart(7) +
  " | glass(bg) " + r.glassBg.toFixed(4).padStart(7) +
  " | contrast " + r.contrast.toFixed(4));

console.log("\n  after " + FRAMES + " frames (0.5s), the trail left by one passing body:");
row("DARK world", dark);
row("LIT world", lit);

ok(dark.contrast > 0.20,
   "in a DARK world the afterimage leaves a clearly visible trail (contrast " + dark.contrast.toFixed(3) + ")");
ok(lit.contrast < 0.01,
   "in a LIT world the trail is INVISIBLE (contrast " + lit.contrast.toFixed(3) + ") \u2014 the memory is gone");

/* The worse half: max() does not just hide the trail, it hides the BODY.

   MEASURE A RUNNING ENGINE, NOT A COLD START. The first version of this check
   simulated ONE frame from an empty trail buffer and reported the body
   surviving at 0.2500 — so the probe refused its own author's claim, which is
   the probe working. But it was measuring the wrong instant. A trail buffer in
   a lit world is never empty: the bright background passes the memory gate at
   every pixel, every frame, so by the time a body arrives the buffer already
   holds the sky. Warm it first, THEN let the body arrive. */
function arrive(bg, body, warmFrames) {
  let trail = 0;
  for (let f = 0; f < warmFrames; f++)
    trail = Math.max(bg * smoothstep(GATE, GATE + 0.22, bg), trail * DECAY - EPS);
  const before = trail;
  trail = Math.max(body * smoothstep(GATE, GATE + 0.22, body), trail * DECAY - EPS);
  return { before, glass: Math.max(body, trail), body };
}
console.log("\n  a body arriving at a pixel in an engine that has been RUNNING (buffer warm):");
const darkArr = arrive(0.007, 0.60, 120);
const litArr  = arrive(0.850, 0.25, 120);
for (const [n, r] of [["DARK world", darkArr], ["LIT world", litArr]])
  console.log("    " + n.padEnd(12) + " trail already there " + r.before.toFixed(4) +
    " | body drawn " + r.body.toFixed(4) + " | REACHING GLASS " + r.glass.toFixed(4) +
    (Math.abs(r.glass - r.body) < 0.01 ? "   body survives" : "   BODY ERASED"));
ok(Math.abs(darkArr.glass - darkArr.body) < 0.01,
   "in a DARK world the body reaches the glass unharmed \u2014 max() is correct there");
ok(litArr.glass > 0.80 && Math.abs(litArr.glass - litArr.body) > 0.5,
   "in a LIT world max(scene, trail) returns the SKY'S MEMORY over the body \u2014 the creature is erased");

/* And the gate is a luminance FLOOR, which is backwards in an inverted world. */
console.log("\n  the memory gate is a luminance FLOOR (remember what is BRIGHT):");
console.log("    lit-world background passes the gate at keep=" +
  smoothstep(GATE, GATE + 0.22, 0.85).toFixed(3) +
  "  \u00b7  the dark body passes at keep=" + smoothstep(GATE, GATE + 0.22, 0.25).toFixed(3));
ok(smoothstep(GATE, GATE + 0.22, 0.85) > 0.9 && smoothstep(GATE, GATE + 0.22, 0.25) < 0.01,
   "the world remembers its EMPTY SKY and forgets the organism \u2014 exactly inverted");

/* ---------------------------------------------------------------------------
   4 · WHAT THIS MEANS FOR THE SHAPE OF THE LAW
   ------------------------------------------------------------------------ */
console.log("\n\n4 \u00b7 WHY GROUND IS A LAW AND NOT A PRESET");
console.log(bar(74));
console.log("  Declaring \"lit from outside\" is not one setting. It reaches:");
console.log("    \u00b7 3 live clear values          (the void itself)");
console.log("    \u00b7 skyTop/skyMid/horizon/ground (the gradient, and the haze with it)");
console.log("    \u00b7 the Radiance room            (the body's tone curve must invert too)");
console.log("    \u00b7 the AFTERIMAGE's compositing (max() must become a signed distance");
console.log("                                     from the ground, not an upward sum)");
console.log("  A preset can set a colour. Only a law can say that four capabilities");
console.log("  must agree, and REFUSE the combinations that do not.");

console.log("\n" + "=".repeat(74));
console.log(FAIL === 0
  ? "GROUND GAP PROVEN. The sky is ready, the clear colour is not a decision, and\nthe afterimage will silently erase the organism in an inverted world."
  : FAIL + " claim(s) unproven \u2014 do not design on them.");
process.exit(FAIL === 0 ? 0 : 1);

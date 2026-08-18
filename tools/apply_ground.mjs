/* =============================================================================
   tools/apply_ground.mjs — INSTALL GROUND 0.1.0 INTO engine/zigcore.js
   (run from the repo root:  node tools/apply_ground.mjs)

   A transfer tool, not a build tool. `.js` files would not download to eyeZ on
   2026-08-18 (twice — `.mjs` came through fine both times), so the law travels
   as a patch that edits zigcore.js in place instead of as a replacement file.

   It is deliberately fussy, because a patch that half-applies is worse than one
   that refuses:
     · refuses unless the file is at 0.14.0 and has no Ground already
     · refuses if either anchor is missing or ambiguous
     · idempotent — running it twice is a no-op, not a double insert
     · writes with the file's OWN line endings, so a CRLF checkout stays CRLF
     · verifies by EVALUATING the result and reading ZigCore.Ground back out,
       rather than trusting that the text landed

   The reference gate is still the real proof: expect 42/42 after this runs.
   ========================================================================== */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = process.argv[2] || path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, "engine", "zigcore.js");

const BLOCK = "  /* ==========================================================================\n     GROUND 0.1.0 \u2014 the SECOND Canon law. \"A world has a ground of being.\"\n     ---------------------------------------------------------------------------\n     Every world so far has been black, and black was never a decision. It was\n     the value the sky triple happened to be authored at, plus a clear colour\n     nobody has ever seen. `tools/ground_gap.mjs` measures all of it:\n\n       \u00b7 the sky is a FULLSCREEN triangle, depth writes off, depthCompare\n         \"always\" \u2014 it paints over every pixel before an agent draws, so the\n         clear colour is invisible in every build ever shipped. It is the\n         background only when `sky:false`.\n       \u00b7 skyTop / skyMid / horizon / ground are already View UNIFORMS. There is\n         no plumbing to lay. The engine has always been able to paint a lit\n         world; nobody has ever asked it to.\n       \u00b7 skyMid is ALSO the haze the fragment fogs toward, so lifting the sky\n         lifts the medium for free. Two thirds of the pairing is already wired.\n\n     So why a LAW and not a preset? Because of the third finding, which nobody\n     had named:\n\n       THE AFTERIMAGE ASSUMES A DARK WORLD, IN ITS ARITHMETIC.\n\n     It composites with max() \u2014 correct when light accumulates upward from\n     black. Invert the world and the sky's own memory sits at 0.85 while a dark\n     body draws at 0.25, so max(scene, trail) returns 0.8359 and THE CREATURE IS\n     ERASED BY ITS OWN AFTERIMAGE. The same body in a dark world reaches the\n     glass untouched. The memory gate is a luminance FLOOR, too, so an inverted\n     world remembers its empty sky and forgets the organism.\n\n     A preset can set a colour. Only a law can say that four capabilities must\n     agree \u2014 sky, haze, tone curve and compositing \u2014 and REFUSE the ones that\n     do not. On 2026-08-17 Bill set `radiance=white` and watched the organism\n     sink into a dark floor. That was four settings disagreeing with nothing to\n     stop them. Under this law it is a build-time fault.\n\n     GROUNDS are named, and `void` is the identity: today's near-black sky,\n     max() compositing, no tone curve. Every build that exists keeps rendering\n     byte-for-byte what it renders now.\n     ======================================================================= */\n  ZigCore.Ground = {\n    VERSION: \"0.1.0\",\n\n    /* Named GROUNDS. `lift` is the ground's own luminance \u2014 the floor the world\n       never falls below. `sky` is the triple (top, mid, horizon); `mid` doubles\n       as the haze target, which is why it is not a free parameter. `compose`\n       says how memory stacks against this ground, and `room` is the Radiance\n       curve that belongs with it: a lit ground REQUIRES an inverted body or the\n       organism has nothing to be dark against. */\n    grounds: {\n      /* IDENTITY \u2014 the black-box theatre. What every build has always been. */\n      void:   { lift: 0.000, compose: \"rise\",  room: null, gateAt: 0.45,\n                sky: { top: [0.003, 0.005, 0.014], mid: [0.007, 0.011, 0.024], hor: [0.010, 0.014, 0.030] },\n                says: \"no ground at all \u2014 light accumulates upward out of nothing\" },\n      /* Pre-dawn: a sky that is no longer black and not yet day. The balloon\n         glow ground, and the gentlest test of the inversion. */\n      dusk:   { lift: 0.055, compose: \"rise\",  room: null, gateAt: 0.45,\n                sky: { top: [0.028, 0.026, 0.040], mid: [0.075, 0.050, 0.044], hor: [0.130, 0.085, 0.060] },\n                says: \"the hour before the sun \u2014 the floor has lifted but light still rises\" },\n      /* The inversion proper: a bright ground, a dark organism. Projection,\n         the spa, a lobby, any room that is not a black box. */\n      mist:   { lift: 0.620, compose: \"signed\", room: \"white\", gateAt: 0.15,\n                sky: { top: [0.560, 0.600, 0.660], mid: [0.660, 0.700, 0.750], hor: [0.740, 0.770, 0.800] },\n                says: \"a pale fog with no horizon \u2014 the medium IS the ground\" },\n      paper:  { lift: 0.880, compose: \"signed\", room: \"white\", gateAt: 0.15,\n                sky: { top: [0.870, 0.870, 0.865], mid: [0.900, 0.898, 0.890], hor: [0.920, 0.918, 0.910] },\n                says: \"a white field \u2014 print, projection onto a pale wall, a gallery\" }\n    },\n\n    /* THE COMPOSITING MODES. This is the half a preset could never reach.\n\n       \"rise\"   \u2014 memory = max(scene, trail). Light accumulates upward from a\n                  dark ground. Correct, and the only mode that has ever existed.\n       \"signed\" \u2014 memory is the FURTHEST-FROM-GROUND value, not the brightest.\n                  On a bright ground a dark body is the departure, so the trail\n                  must remember darkness. Same operation, measured as a signed\n                  distance from `lift` rather than an unsigned climb from zero.\n\n       Both reduce to identical arithmetic when lift = 0, which is what keeps\n       `void` byte-identical. */\n    compose(mode, scene, trail, lift) {\n      if (mode !== \"signed\") return Math.max(scene, trail);\n      return (Math.abs(scene - lift) >= Math.abs(trail - lift)) ? scene : trail;\n    },\n\n    /* THE DECAY. Memory fades TOWARD THE GROUND, not toward black.\n\n       This is the half the first draft of this law got wrong, and the probe\n       caught it: `trail * decay - eps` fades every memory to zero, which is\n       correct only when zero IS the ground. On a bright ground a decayed trail\n       kept sliding past the floor into negative luminance, and under signed\n       compositing a value further from the ground WINS \u2014 so a fading memory\n       eventually outranked everything and the glass returned -0.1388.\n\n       A memory of a dark body on a pale field should fade back to the pale\n       field. The operation is the same one, measured from `lift`. */\n    decay(mode, trail, lift, k, eps) {\n      if (mode !== \"signed\") return trail * k - eps;\n      const d = trail - lift;\n      const mag = Math.abs(d) * k - eps;\n      return lift + (mag <= 0 ? 0 : (d < 0 ? -mag : mag));\n    },\n\n    /* The memory gate: which pixels are worth remembering. A luminance FLOOR\n       (\"remember what is bright\") is correct only on a dark ground. On a lit\n       one the test is DISTANCE from the ground, or the world remembers its own\n       empty sky and forgets the organism crossing it. */\n    gate(mode, L, lift, at, width) {\n      const x = (mode === \"signed\") ? Math.abs(L - lift) : L;\n      const t = Math.min(1, Math.max(0, (x - at) / (width || 0.22)));\n      return t * t * (3 - 2 * t);\n    },\n\n    /* THE GATED SCENE \u2014 what a pixel contributes to memory once the gate has\n       spoken. `scene * keep` is right only when zero is the ground: it means\n       \"not worth remembering, so contribute nothing\", and nothing IS the floor.\n       On a pale ground, contributing zero is contributing pure black, which\n       under signed compositing is the furthest thing from the ground there is \u2014\n       so an ungated pixel would win everything and the memory would fill with\n       darkness that was never drawn.\n\n       An ungated pixel must fall back TO THE GROUND. Same operation, measured\n       from `lift`, and identical to `scene * keep` when lift is zero. */\n    gated(mode, scene, lift, at, width) {\n      const keep = this.gate(mode, scene, lift, at, width);\n      return (mode !== \"signed\") ? scene * keep : lift + (scene - lift) * keep;\n    },\n\n    resolve(name) { return this.grounds[name] || this.grounds.void; }\n  };\n\n  ZigCore.Canon.register({\n    id: \"ground\",\n    version: ZigCore.Ground.VERSION,\n    pillar: \"habitat\",\n    says: \"a world has a ground of being \u2014 a floor it never falls below, and a direction its light travels from\",\n    defaults: { lift: 0.0, compose: \"rise\", room: null },          // IDENTITY = void\n    presets: ZigCore.Ground.grounds,\n    presetKey: \"ground\",                                            // window.ZIG_LAWS = { ground: { ground: \"mist\" } }\n    cpu: null,\n    /* ORDERING (Canon.Order 1.0.0): Ground does not ride the frame.light rail.\n       It is not a step in the light's journey \u2014 it is the STARTING CONDITION of\n       that journey, and it also reaches sideways into the afterimage's\n       compositing, which is a different pass entirely. A law that changes the\n       arithmetic other capabilities compose WITH cannot be a station on their\n       rail; it is what the rail runs over. */\n    splice: { stage: \"scene\", owner: \"zigwebgpu:createScene+AFTERIMAGE\",\n              rail: null, station: null, mode: \"world\", face: \"both\" },\n    /* THE PAIRING REFUSALS \u2014 the reason this is a law. Each names a combination\n       that renders without error and destroys the piece. */\n    refuses: [\n      { when: \"lift > 0.3 && compose === 'rise'\",\n        says: \"a lit ground with rise compositing: the sky's own memory outranks a dark body, and max() erases the organism (measured: body 0.2500 reaches the glass at 0.8359)\" },\n      { when: \"lift > 0.3 && room === null\",\n        says: \"a lit ground with no inverted tone curve: the body stays bright against a bright floor and sinks \u2014 this is what was seen on 2026-08-17\" },\n      { when: \"lift === 0 && compose === 'signed'\",\n        says: \"signed compositing on a dark ground: legal but pointless \u2014 it reduces to max() and only costs clarity\" }\n    ],\n    probe: \"test/law_ground_ref.mjs\",\n    doc: \"briefs/law_ground.md\"\n  });\n\n";
const VLINE = "  ZigCore.VERSION = \"0.15.0\";   // 0.15: GROUND 0.1.0 \u2014 the SECOND Canon law. \"A world has a ground of being.\" Declared, NOT yet consulted by the engine. Four grounds (void=identity, dusk, mist, paper); one word sets sky, haze, Radiance room and the afterimage's compositing together. Exists because the afterimage assumes a dark world IN ITS ARITHMETIC: max() compositing erases a dark body on a bright ground (0.2500 reaches the glass at 0.8359). Three refusals; the 8/17 sinking organism now trips two of them at build time \u00b7 0.14: THE ORDERING CONTRACT (Canon.Order \u2014 composition order is DECLARED, not inherited from build history. Two rails, \"shard.face\" and \"frame.light\", whose stations are ordered because the physics is; a law files a CLAIM at a station instead of splicing itself, and the rail emits every claim once, in order. Kills the append inversion structurally \u2014 there is no idiom left to get backwards \u2014 and refuses four faults at build time: unknown station, AMBIGUOUS (two claims, one station, no `after`), CONTESTED (two REPLACE skins on one face), DEAD (a write a later REPLACE discards). Byte-identical: the rail emits exactly the shader the hand splice did) \u00b7 0.13: THE CANON RUNTIME (Canon.register/resolve/activate/stamp \u2014 laws ship OFF and a host names them via window.ZIG_LAWS or #law=preset; absent = byte-identical) + RADIANCE 0.1.0, the first law: the room is a light source with no falloff, and the response is a hue-preserving luminance remap (black-point \u00b7 gain \u00b7 shadow gamma \u00b7 soft knee). Identity at defaults \u00b7 0.11: BOUNDARY AXIS \u00b7 0.11.1: GYRE AXIS \u00b7 0.12: ELLIPSOID boundary (lens = a squashed sphere; per-axis radii \u2192 the wide breathing disc); byte-identical for sphere/cylinder";

const ENV_ANCHOR = "  /* ==========================================================================\n     ZigCore.Env \u2014 THE ENVIRONMENT LIBRARY";

let src;
try { src = readFileSync(FILE, "utf8"); }
catch { console.log("  CANNOT READ " + FILE + "\n  run this from the repo root: node tools/apply_ground.mjs"); process.exit(2); }

/* line endings: keep whatever this checkout uses */
const CRLF = /\r\n/.test(src);
const flat = CRLF ? src.replace(/\r\n/g, "\n") : src;
console.log("  engine/zigcore.js · " + src.length + " bytes · " + (CRLF ? "CRLF" : "LF"));

if (/ZigCore\.Ground\s*=/.test(flat)) {
  console.log("  ALREADY APPLIED — ZigCore.Ground is present. Nothing to do.");
  process.exit(0);
}
const vNow = (flat.match(/ZigCore\.VERSION = "(0\.\d+\.\d+)";\s*\/\/ 0\.1[45]/) || [])[1];
if (vNow !== "0.14.0") {
  console.log("  REFUSED — expected ZigCore 0.14.0 (the ordering contract, commit ab709c1);");
  console.log("            found " + (vNow || "no versioned banner") + ". This patch is written against 0.14.0 only.");
  process.exit(2);
}
const oldV = flat.split("\n").find((l) => l.trim().startsWith('ZigCore.VERSION = "0.14.0"'));
if (!oldV) { console.log("  REFUSED — the 0.14.0 version line was not found"); process.exit(2); }
if (flat.split(ENV_ANCHOR).length !== 2) {
  console.log("  REFUSED — the Env banner anchor is missing or appears more than once");
  process.exit(2);
}

let out = flat.replace(oldV, VLINE).replace(ENV_ANCHOR, BLOCK + ENV_ANCHOR);
if (CRLF) out = out.replace(/\n/g, "\r\n");
writeFileSync(FILE, out);
console.log("  wrote " + out.length + " bytes  (+" + (out.length - src.length) + ")");

/* PROVE it, do not assume it: evaluate the patched file and read the law back */
try {
  new Function(readFileSync(FILE, "utf8"))();
  const G = globalThis.ZigCore && globalThis.ZigCore.Ground;
  const reg = globalThis.ZigCore && globalThis.ZigCore.Canon.registry.ground;
  const core = String(globalThis.ZigCore.VERSION).slice(0, 7);
  if (!G || !reg) throw new Error("Ground did not register");
  console.log("  ZigCore " + core + " · Ground " + G.VERSION +
    " · grounds: " + Object.keys(G.grounds).join(" ") +
    " · refusals: " + reg.refuses.length);
  const erased = G.compose("rise", 0.25, 0.85, 0.62);
  const saved  = G.compose("signed", 0.25, 0.85, 0.62);
  console.log("  the collision, live: rise → " + erased.toFixed(4) +
    " (body erased) · signed → " + saved.toFixed(4) + " (body survives)");
  console.log("\n  APPLIED. Now run the reference gate — expect 42/42.");
} catch (e) {
  console.log("  WROTE BUT FAILED TO EVALUATE: " + e.message);
  console.log("  restore with:  git checkout -- engine/zigcore.js");
  process.exit(1);
}

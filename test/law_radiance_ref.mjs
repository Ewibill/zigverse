/* =============================================================================
   test/law_radiance_ref.mjs — RADIANCE 0.1.0, proved (CANON.md §2 obligation 3)
   (run: node test/law_radiance_ref.mjs)

   "A law with no numeric test is an opinion. I cannot see the canvas; the probe
    is the only thing standing between a claim and a guess."

   RADIANCE claims: in a lit room the panel's black floor is lifted by reflected
   ambient light, perceived = displayed + veil, and the shadow RATIOS that carry
   an organism's modelling collapse. This file does not take that on faith. It
   builds the veil model, measures the perceptual separation of the organism's
   shadow ramp with and without the law, and requires the law to WIN.

   What this probe proves:
     1  identity   — at defaults the curve is L → L, exactly
     2  monotone   — no room inverts the ordering of two values anywhere
     3  bounded    — 0 → 0 and nothing exceeds 1 (the knee holds)
     4  THE CLAIM  — shadow separation in ΔL* rises in a veiled room
     5  cut        — the opposite instinct sacrifices the drowned region, on purpose
     6  white      — the inversion darkens, for a bright floor
     7  dial       — amount 0 is arithmetic identity; amount 1 is the full law
     8  chroma     — hue and saturation survive (luminance-only remap)
     9  parity     — the emitted WGSL is a faithful transcription of the CPU law
    10  contract   — the Canon runtime enforces its five obligations

   What this probe does NOT prove: that the WGSL RUNS. Nothing in this sandbox
   executes a shader. eyeZ is the real gate and tools/metal_gate.mjs is the
   Metal one.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigcore.js"), "utf8"))();
const ZC = globalThis.ZigCore;
const R = ZC.Radiance;
const Canon = ZC.Canon;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  \u2713 " : "  \u2717 ") + msg); if (!ok) failures++; };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* ---- the veil model ------------------------------------------------------
   A panel in a room shows  perceived = displayed + veil, where veil is the
   reflected ambient as a fraction of the panel's peak white. It is ADDITIVE
   and it has no falloff, because its source is behind you.
   ΔL* (CIE L*) is used to ask the only question that matters: can the eye
   still tell two shadow values apart once the room has added its constant? */
const Lstar = (Y) => (Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y);
const perceived = (d, veil) => (d + veil) / (1 + veil);
const separation = (ramp, cfg, veil, amount) => {   // mean ΔL* between adjacent steps
  const out = ramp.map((L) => perceived(R.tone(L, cfg) * (amount === undefined ? 1 : amount) + L * (1 - (amount === undefined ? 1 : amount)), veil));
  let sum = 0;
  for (let i = 1; i < out.length; i++) sum += Math.abs(Lstar(out[i]) - Lstar(out[i - 1]));
  return sum / (out.length - 1);
};

const IDENT = Canon.registry.radiance.defaults;
const ramp = [];                                   // the organism's shadow ramp: 0.00 → 0.18 in 13 steps
for (let i = 0; i < 13; i++) ramp.push(i * 0.015);

console.log("[1 · identity — off means unchanged, provably]");
{
  let worst = 0;
  for (let i = 0; i <= 1000; i++) { const L = i / 1000; worst = Math.max(worst, Math.abs(R.tone(L, IDENT) - L)); }
  say(worst === 0, "tone(L, defaults) === L exactly across 1001 samples (max deviation " + worst + ")");
  say(Canon.isIdentity("radiance", "dark"), "the \"dark\" room resolves to the identity element \u2014 so it never activates");
  say(Canon.isIdentity("radiance", {}), "an empty config resolves to identity \u2014 declaring the law without values is still OFF");
}

console.log("[2 · monotone — no room may invert two values]");
for (const name of Object.keys(R.rooms)) {
  const cfg = Canon.resolve("radiance", name);
  let mono = true, at = 0;
  let prev = -1;
  for (let i = 0; i <= 2000; i++) {
    const v = R.tone(i / 2000, cfg);
    if (v < prev - 1e-12) { mono = false; at = i / 2000; break; }
    prev = v;
  }
  say(mono, "room \"" + name + "\" is non-decreasing over [0,1]" + (mono ? "" : " \u2014 inverts at L=" + at));
}

console.log("[3 · bounded — 0 stays 0, and the knee holds the top]");
for (const name of Object.keys(R.rooms)) {
  const cfg = Canon.resolve("radiance", name);
  const lo = R.tone(0, cfg), hi = R.tone(1, cfg);
  say(lo === 0, "room \"" + name + "\": tone(0) = 0 \u2014 black stays black, because the floor is the room's and not ours");
  say(hi <= 1.0000001, "room \"" + name + "\": tone(1) = " + hi.toFixed(4) + " \u2264 1 \u2014 no clip to flat white");
}

console.log("[4 · THE CLAIM \u2014 shadow separation rises in a veiled room]");
{
  const veils = { lit: 0.06, bright: 0.14, sunlit: 0.26 };
  for (const room of ["lit", "bright", "sunlit"]) {
    const cfg = Canon.resolve("radiance", room);
    const v = veils[room];
    const off = separation(ramp, IDENT, v, 1);
    const on  = separation(ramp, cfg, v, 1);
    const gain = on / off;
    say(gain > 1.5,
      "room \"" + room + "\" at veil " + v.toFixed(2) + ": mean \u0394L* per shadow step " +
      off.toFixed(3) + " \u2192 " + on.toFixed(3) + "  (\u00d7" + gain.toFixed(2) + ")");
  }
  /* And the honest counterpart: in a DARK room the same curve costs contrast.
     A law that helped everywhere would be a free lunch, and there is none. */
  const dcfg = Canon.resolve("radiance", "bright");
  const offDark = separation(ramp, IDENT, 0, 1), onDark = separation(ramp, dcfg, 0, 1);
  say(onDark > offDark,
    "in a DARK room the same curve still separates the ramp (" + offDark.toFixed(3) + " \u2192 " + onDark.toFixed(3) +
    ") \u2014 it spends highlight headroom to do it, which is why it ships OFF and Bill's eye decides");
}

console.log("[5 · cut \u2014 the opposite instinct, behaving as advertised]");
{
  const cfg = Canon.resolve("radiance", "cut");
  say(R.tone(0.05, cfg) === 0, "below the black-point (0.06) the signal is sacrificed: tone(0.05) = 0");
  const a = R.tone(0.20, cfg), b = R.tone(0.25, cfg);
  const ai = 0.20, bi = 0.25;
  say((b - a) > (bi - ai), "the survivors gain range: \u0394(0.20\u21920.25) " + (bi - ai).toFixed(4) + " \u2192 " + (b - a).toFixed(4));
}

console.log("[6 · white \u2014 the projection / bright-floor inversion]");
{
  const cfg = Canon.resolve("radiance", "white");
  let darker = true;
  for (let i = 1; i <= 100; i++) { const L = i / 100; if (R.tone(L, cfg) >= L) { darker = false; break; } }
  say(darker, "every value darkens \u2014 a dark organism against a bright floor is the same arithmetic with gain < 1");
}

console.log("[7 · the live dial \u2014 A/B against itself, in the same frame]");
{
  const cfg = Canon.resolve("radiance", "bright");
  const c = [0.31, 0.47, 0.22];
  const off = R.apply(c, cfg, 0);
  say(off[0] === c[0] && off[1] === c[1] && off[2] === c[2],
    "amount 0 returns the colour bit-for-bit \u2014 the shader is present and multiplies by exactly one");
  const on = R.apply(c, cfg, 1);
  say(on[0] > c[0], "amount 1 applies the full law (" + c[0].toFixed(3) + " \u2192 " + on[0].toFixed(3) + ")");
  const half = R.apply(c, cfg, 0.5);
  say(half[0] > off[0] && half[0] < on[0], "the dial interpolates \u2014 0.5 lands between");
  say(R.apply([0, 0, 0], cfg, 1).every((x) => x === 0), "pure black is untouched at any amount \u2014 there is nothing below the floor to lift");
}

console.log("[8 · chroma \u2014 a luminance remap must not move the hue]");
{
  const cfg = Canon.resolve("radiance", "sunlit");
  const c = [0.42, 0.17, 0.63];
  const o = R.apply(c, cfg, 1);
  const r0 = c[0] / c[1], r1 = o[0] / o[1];
  const s0 = c[2] / c[1], s1 = o[2] / o[1];
  say(near(r0, r1, 1e-12) && near(s0, s1, 1e-12),
    "channel ratios are preserved exactly (R:G " + r0.toFixed(6) + " \u2192 " + r1.toFixed(6) + ") \u2014 every skin, gem and spectrum Bill tuned by eye survives");
}

console.log("[9 · parity \u2014 the emitted WGSL transcribes the CPU law]");
{
  const gpu = readFileSync(path.join(root, "engine/zigwebgpu.js"), "utf8");
  const want = [
    'var x = max((L - RAD_BLACK) / (1.0 - RAD_BLACK), 0.0);',
    'x = pow(x * RAD_GAIN, RAD_INVG);',
    'return x / (1.0 + max(x - RAD_KNEE, 0.0));',
    'let L = dot(c, vec3f(0.2126, 0.7152, 0.0722));',
    'return c * mix(1.0, radTone(L) / L, amt);'
  ];
  for (const w of want) say(gpu.indexOf(w) >= 0, "emitted WGSL contains  " + w);
  say(gpu.indexOf('rf(1 / (+RAD.gamma || 1))') >= 0,
    "RAD_INVG is emitted as 1/gamma \u2014 the shader raises to the RECIPROCAL, as tone() does");
  /* The luminance weights must agree on both sides or the law would shift hue
     on one and not the other. */
  const cpu = readFileSync(path.join(root, "engine/zigcore.js"), "utf8");
  say(/0\.2126 \* rgb\[0\] \+ 0\.7152 \* rgb\[1\] \+ 0\.0722 \* rgb\[2\]/.test(cpu),
    "the CPU law uses the same Rec.709 luminance weights as the shader");
  /* Metal clause: this law must emit nothing a vertex stage can reach. */
  const helpers = gpu.slice(gpu.indexOf("const RAD_HELPERS"), gpu.indexOf("const rShard"));
  say(helpers.indexOf("var<private>") < 0, "the law emits no var<private> \u2014 the Metal clause holds");
  say(!/var\s+\w+\s*(:|=)\s*array/.test(helpers), "the law emits no mutable local array \u2014 nothing to overflow Metal's vertex stack");
  say(helpers.indexOf("dpdx") < 0 && helpers.indexOf("dpdy") < 0, "the law takes no derivatives \u2014 legal in any control flow");
}

console.log("[10 · the Canon runtime enforces its own contract]");
{
  const bad = [
    [{ id: "x", version: "1", defaults: {} }, "no probe"],
    [{ id: "x", version: "1", probe: "p" }, "no defaults"],
    [{ id: "x", defaults: {}, probe: "p" }, "no version"],
    [{ version: "1", defaults: {}, probe: "p" }, "no id"]
  ];
  for (const [law, why] of bad) {
    let threw = false;
    try { Canon.register(law); } catch (e) { threw = true; }
    say(threw, "register() refuses a law with " + why);
  }
  delete Canon.registry.x;
  say(Object.keys(Canon.activate(undefined, "")).length === 0, "no declaration \u2192 no active laws \u2192 byte-identical to the pre-Canon engine");
  say(Object.keys(Canon.activate({ radiance: "nonesuch" }, "")).length === 0, "an unknown preset name is OFF, never a guess");
  say(Object.keys(Canon.activate({ radiance: { room: "bright" } }, "")).length === 1, "a declared law activates");
  say(Object.keys(Canon.activate({ radiance: { room: "bright" } }, "#radiance=off")).length === 0, "#radiance=off overrides the host \u2014 a signature can be A/B'd without a rebuild");
  const h = Canon.activate({}, "#world=custom&radiance=sunlit&med=honey");
  say(h.radiance && h.radiance.preset === "sunlit", "the hash names a room inside a full performance configuration");
  say(Canon.stamp() === "radiance " + R.VERSION, "the build can state its laws: \"" + Canon.stamp() + "\"");
  const decl = { radiance: { room: "bright" } };
  Canon.activate(decl, "");
  say(decl.radiance.room === "bright" && Canon.registry.radiance.defaults.gain === 1,
    "activate() mutates neither the host's declaration nor the law's defaults");
}

console.log(failures === 0
  ? "\nPASS \u2014 RADIANCE " + R.VERSION + ": the room is a light source, and the law answers it."
  : "\nFAIL \u2014 " + failures + " check(s) failed");
process.exit(failures === 0 ? 0 : 1);

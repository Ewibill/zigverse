// env_ref.mjs — proves ZigCore.Env (the centralized environment library, v0.8) hands
// species EXACTLY the values the law-proofs already trust. This is the guard for
// Tweak #1 (presets moved out of sickleswarm into ZigCore): if these lock, every
// species that inherits by name gets byte-identical physics to the old in-species tables.

import { readFileSync } from "fs";
const code = readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8");
(0, eval)(code);                       // indirect eval → the IIFE attaches ZigCore to globalThis
const ZC = globalThis.ZigCore;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 0) It exists and is versioned.
ok(!!ZC && !!ZC.Env, "ZigCore.Env is present");
{ const v = (ZC.VERSION || "0").split(".").map(Number); ok(v[0] > 0 || v[1] >= 8, `ZigCore version ≥ 0.8 (Env-bearing) (got ${ZC && ZC.VERSION})`); }

// 1) MEDIUM — the same {drag,vmax} the medium_ref proves (air coasts, honey settles).
ok(eq(ZC.Env.medium("air"),   { drag: 0.25, vmax: 1.20 }), "air preset intact");
ok(eq(ZC.Env.medium("water"), { drag: 1.10, vmax: 0.72 }), "water preset intact");
ok(eq(ZC.Env.medium("honey"), { drag: 3.40, vmax: 0.38 }), "honey preset intact");
ok(ZC.Env.medium("neutral") === null && ZC.Env.medium(undefined) === null, "unknown/absent medium → null (no forcing)");

// 2) CURRENT — the same {d,gyre} current_ref proves (drift stream, gyre whirlpool, eddy both).
ok(eq(ZC.Env.current("drift"), { d: [1.8, 0, 0.6], gyre: 0 }), "drift preset intact");
ok(eq(ZC.Env.current("gyre"),  { d: [0, 0, 0], gyre: 0.10 }), "gyre preset intact");
ok(eq(ZC.Env.current("eddy"),  { d: [1.0, 0, 0], gyre: 0.07 }), "eddy preset intact");
ok(ZC.Env.current("neutral") === null, "neutral current → null");

// 3) FORCES — archetype resolves against a species' frame half-extent to the SAME concrete
//    {g, floor|ceil, damp} the old in-species FORCEP produced. Test at FRAME_H = 20 (CAMR 58).
{
  const H = 20;
  ok(eq(ZC.Env.force("sink",  H), { g: -7.0, damp: 0.9, floor: -20 }), "sink resolves floor = -FRAME_H");
  ok(eq(ZC.Env.force("float", H), { g:  5.0, damp: 0.8, ceil:   20 }), "float resolves ceil = +FRAME_H");
  ok(eq(ZC.Env.force("suspend", H), { g: 0.0, damp: 2.4 }), "suspend has no floor/ceil (hangs)");
  ok(ZC.Env.force("neutral", H) === null, "neutral force → null");
}

// 4) THE POINT of fractional floors: the SAME archetype fills a DIFFERENT frame — a species
//    with a tighter frame gets a proportionally tighter floor, no table edit needed.
{
  const tight = ZC.Env.force("sink", 12), wide = ZC.Env.force("sink", 30);
  ok(tight.floor === -12 && wide.floor === -30, "sink floor tracks each species' frame (−12 vs −30)");
  ok(tight.g === wide.g && tight.damp === wide.damp, "…while the archetype's g/damp stay view-independent");
}

console.log(fail ? `\nENV REF: FAIL (${fail})` : "\nENV REF: PASS");
process.exit(fail ? 1 : 0);

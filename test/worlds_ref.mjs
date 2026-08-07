// worlds_ref.mjs — proves ZigCore.Worlds (Formative Worlds, v0.9) composes the three
// elemental laws into coherent named PLACES. A world resolves to the EXACT {medium, forces,
// current} the engine expects — nothing new is invented, the place is just an agreement
// between the laws we already proved (medium_ref · forces_ref · current_ref · env_ref).

import { readFileSync } from "fs";
const code = readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8");
(0, eval)(code);
const ZC = globalThis.ZigCore;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok(!!ZC.Worlds, "ZigCore.Worlds present");
{ const v = (ZC.VERSION || "0").split(".").map(Number); ok(v[0] > 0 || v[1] >= 9, `ZigCore version ≥ 0.9 (Worlds-bearing) (got ${ZC.VERSION})`); }

const H = 20;   // a species frame half-extent

// 1) Every named place resolves to a fully-composed environment (all three laws present or null),
//    and its parts equal the SAME elemental presets a species would pull by hand.
for (const name of ZC.Worlds.names()) {
  const w = ZC.Worlds.get(name, H), spec = ZC.Worlds.places[name];
  ok(!!w, `${name} resolves`);
  ok(eq(w.medium,  ZC.Env.medium(spec.medium)),      `${name}: medium = Env.medium(${spec.medium})`);
  ok(eq(w.forces,  ZC.Env.force(spec.force, H)),     `${name}: forces = Env.force(${spec.force}, H)`);
  ok(eq(w.current, ZC.Env.current(spec.current)),    `${name}: current = Env.current(${spec.current})`);
  ok(!!spec.skin && !!ZC.Materials[spec.skin],       `${name}: native skin "${spec.skin}" is a real material`);
  ok(spec.bound !== undefined && (spec.bound === "none" || !!ZC.Env.boundaries[spec.bound]), `${name}: native shape "${spec.bound}" is a real boundary`);
  ok(eq(w.boundary, ZC.Env.boundary(spec.bound, H)), `${name}: boundary = Env.boundary(${spec.bound}, H)`);
}

// 2) Spot-check the *character* of a few places — the combinations that make them believable.
{
  const amber = ZC.Worlds.get("amber", H);       // honey + sink + still → fossil settling
  ok(amber.medium.drag === 3.40 && amber.forces.floor === -H && amber.current === null,
     "amber = thick honey, sinks to the floor, no flow (fossil-slow)");

  const thermal = ZC.Worlds.get("thermal", H);   // air + float + gyre → a rising, turning column
  ok(thermal.medium.drag === 0.25 && thermal.forces.ceil === H && thermal.current.gyre > 0,
     "thermal = thin air, floats to a ceiling, turning (an updraft)");

  const whirlpool = ZC.Worlds.get("whirlpool", H);  // water + sink + gyre → the coupling: drains while spinning
  ok(whirlpool.forces.floor === -H && whirlpool.current.gyre > 0,
     "whirlpool = pulled down AND spinning (the proven sink+gyre coupling)");
}

// 3) An unknown / absent world → null, so the species cleanly falls back to its individual dials.
ok(ZC.Worlds.get("atlantis", H) === null && ZC.Worlds.get(undefined, H) === null,
   "unknown/absent world → null (fall back to dials, no forcing)");

// 4) A world's forces track the species' frame (fractional floors flow through the composition).
{
  const tight = ZC.Worlds.get("amber", 12), wide = ZC.Worlds.get("amber", 30);
  ok(tight.forces.floor === -12 && wide.forces.floor === -30,
     "a world's floor still fills whatever frame the species is viewed in");
}

console.log(fail ? `\nWORLDS REF: FAIL (${fail})` : "\nWORLDS REF: PASS");
process.exit(fail ? 1 : 0);

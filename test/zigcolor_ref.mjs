/* =============================================================================
   test/zigcolor_ref.mjs — CPU proofs for the Color Ecology (ZigCore v0.6)
   (run: node test/zigcolor_ref.mjs) — Scout's laws, as passing tests.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigcore.js"), "utf8"))();
const ZC = globalThis.ZigCore;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };
const dt = 1 / 60;
const run = (sec, fn) => { for (let i = 0; i < sec * 60; i++) { if (fn) fn(i * dt); ZC.Mood.update(dt); } };
const setLife = (breath, energy, flow) => { ZC.Perf.breath = breath; ZC.Drive.energy = energy; ZC.Pacemaker.flow = flow; };

console.log("[materials — substances, not hues]");
{
  const M = ZC.Materials;
  say(Object.keys(M).length >= 8, Object.keys(M).length + " materials in the cabinet");
  let ok = true;
  for (const [n, m] of Object.entries(M)) {
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    if (!(lum(m.light) > lum(m.dark))) ok = false;                 // the flip stays legible
    if (!(m.iriBurst > m.iriBase)) ok = false;                     // every material can be surprised
  }
  say(ok, "every material: hollow brighter than dome · burst above base (the rainbow can always whisper OR explode)");
  say(M.pearl.iriBase <= 0.12 && M.pearl.iriBurst >= 2.4, "pearl: rainbow whispers at rest (" + M.pearl.iriBase + "), hummingbird ceiling " + M.pearl.iriBurst);
}

console.log("[the material law — composed, not painted]");
{
  const M = ZC.Materials;
  say(Object.keys(M).length >= 18, Object.keys(M).length + " materials in the cabinet (families: volcanic → tissue)");
  let ok = true, bad = "";
  for (const [n, m] of Object.entries(M)) {
    const t = m.tex;
    if (!t || t.length !== 8) { ok = false; bad = n + " missing tex"; break; }
    const [g, gs, gd, sp, sg, fb, ss, we] = t;
    if (!(g >= 0 && g <= 3 && gs >= 0 && gs <= 64 && gd >= 0 && gd <= 1 &&
          sp >= 1 && sp <= 200 && sg >= 0 && sg <= 2 && fb >= 0 && fb <= 1 &&
          ss >= 0 && ss <= 1 && we >= 0 && we <= 1)) { ok = false; bad = n + " profile out of bounds"; break; }
  }
  say(ok, ok ? "every material carries a full composition profile, in bounds" : bad);
  const t = (n) => M[n].tex;
  say(t("glass")[3] > t("wood")[3] * 10, "glass is sharper than wood (spec " + t("glass")[3] + " vs " + t("wood")[3] + ") — velvet to razor");
  say(t("tissue")[6] > 0.7 && t("mineral")[6] === 0, "light passes THROUGH tissue (sss " + t("tissue")[6] + "), never through stone");
  say(t("crystal")[7] === 0 && t("volcanic")[7] > 0.4, "crystal is pristine; volcanic carries age (weather " + t("volcanic")[7] + ")");
  say(t("wood")[0] === 2 && t("coral")[0] === 3 && t("crystal")[0] === 1, "grain families: wood=fiber · coral=pore · crystal=facet");
}

console.log("[mood — the emotional metabolism]");
{
  setLife(0, 0, 0); run(10);
  say(ZC.Mood.calm > 0.8, "stillness → calm dominates (" + ZC.Mood.calm.toFixed(2) + ")");
  setLife(0.85, 0.9, 0.8); run(12);
  say(ZC.Mood.excited > 0.7, "sustained intensity → excitement (" + ZC.Mood.excited.toFixed(2) + ")");
  const exBefore = ZC.Mood.excited;
  setLife(0, 0, 0); run(0.8);
  say(ZC.Mood.fear > 0.3, "intensity COLLAPSES → fear spikes (" + ZC.Mood.fear.toFixed(2) + ")");
  run(14);
  say(ZC.Mood.fear < 0.1, "…and drains: everything becomes bone, then recovers (" + ZC.Mood.fear.toFixed(3) + ")");
  setLife(0.16, 0.1, 0.02); run(14);
  say(ZC.Mood.curious > 0.25 && ZC.Mood.excited < 0.2, "gentle touch from quiet → curiosity, not excitement (" + ZC.Mood.curious.toFixed(2) + ")");
}

console.log("[reserve — the color treasury]");
{
  const R = ZC.Reserve; R.level = 1; R.burst = 0; R._cool = 0;
  const spend = R.event("strike", 1.0);
  say(spend > 0.25 && spend <= 0.30, "one true event spends ~30% (" + spend.toFixed(2) + ")");
  say(R.burst > 0.9, "…and the flash fires (burst " + R.burst.toFixed(2) + ")");
  say(ZC.Mood.wonder > 0.4, "…and the organism remembers: wonder " + ZC.Mood.wonder.toFixed(2));
  for (let i = 0; i < 4 * 60; i++) R.update(dt, false);
  say(R.burst < 0.05, "the flash is RARE: below 5% within 4 s (" + R.burst.toFixed(3) + ") — back to silver");
  /* machine-gun attack: 20 events in 10 s cannot drain the treasury flat */
  R.level = 1; R.burst = 0; R._cool = 0;
  let spends = 0;
  for (let i = 0; i < 10 * 60; i++) {
    if (i % 30 === 0 && R.event("spam", 1.0) > 0) spends++;
    R.update(dt, false);
  }
  say(spends <= 5, "cooldown defeats the machine-gun: " + spends + " spends in 10 s of spam (≤5)");
  say(R.level > 0.05, "the treasury never goes flat (" + R.level.toFixed(2) + " remains)");
  /* silence restores */
  const before = R.level;
  for (let i = 0; i < 60 * 60; i++) R.update(dt, true);
  say(R.level - before > 0.55, "a minute of silence restores the treasury (+" + (R.level - before).toFixed(2) + ")");
}

console.log(failures === 0 ? "\nZIGCOLOR REF: PASS" : "\nZIGCOLOR REF: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);

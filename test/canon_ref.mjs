/* =============================================================================
   test/canon_ref.mjs — the Zigverse Canon, enforced (ZigCore v0.7)
   (run: node test/canon_ref.mjs) — the development philosophy, as a test.
   The Canon is the measure of progress; this proves it stays coherent.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigcore.js"), "utf8"))();
const C = globalThis.ZigCore.Canon;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };

console.log("[the prime law]");
say(/inevitab/i.test(C.primeLaw), "Inevitability is the prime law — nothing exists merely because it looks good");

console.log("[the four pillars, flowing downward]");
say(JSON.stringify(C.flow) === JSON.stringify(["physics", "habitat", "life", "experience"]),
  "the flow is physics → habitat → life → experience");

console.log("[every law has a home]");
let wellFormed = true, orphan = "";
const ids = new Set();
for (const l of C.laws) {
  if (!l.id || !l.pillar || !l.enables || !l.since) { wellFormed = false; orphan = JSON.stringify(l); break; }
  if (!C.flow.includes(l.pillar)) { wellFormed = false; orphan = l.id + " → unknown pillar '" + l.pillar + "'"; break; }
  if (ids.has(l.id)) { wellFormed = false; orphan = "duplicate id '" + l.id + "'"; break; }
  ids.add(l.id);
}
say(wellFormed, wellFormed ? C.count() + " laws, each with pillar · enables · since · no duplicates" : "malformed: " + orphan);

console.log("[no empty pillar — a universe needs all four]");
for (const p of C.flow) {
  const n = C.byPillar(p).length;
  say(n >= 1, "  " + p + ": " + n + " law" + (n === 1 ? "" : "s"));
}

console.log("[the newest law is enshrined]");
const load = C.laws.find((l) => l.id === "load");
say(!!load && load.pillar === "physics", "LOAD lives in Physics — proximity to criticality (Bill, 2026-07-23)");
say(/criticalit|sweet spot|alive/i.test(load ? load.enables : ""), "…and it means what Bill discovered: the sweet spot where a mass is most alive");

console.log("[the honest frontier]");
const habitat = C.byPillar("habitat").length, life = C.byPillar("life").length + C.byPillar("experience").length;
say(habitat < life, "Habitat (" + habitat + ") is thinner than Life+Experience (" + life + ") — the framework points where to expedition next");

console.log(failures === 0 ? "\nCANON REF: PASS" : "\nCANON REF: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);

#!/usr/bin/env node
/* apply_gems.mjs — GEM COLOUR ACCURACY (2026-09-20)
 *
 * Patches four entries in ZigCore.Gems so the stones read as themselves:
 *   ruby     deeper pigeon-blood + fluorescence (spark 0.70 -> 0.82)
 *   emerald  yellowish green -> BLUISH green; facet 0.60 -> 0.52 (included stones never flash clean)
 *   topaz    gold -> IMPERIAL peach (it was sitting on citrine's colour; the two were one stone)
 *   garnet   value 0.74 -> 0.46, spark 0.68 -> 0.52 (almandine is DARKER, browner, and does not fluoresce)
 *
 * Untouched because they were already accurate: diamond, sapphire, amethyst, aquamarine, citrine, peridot.
 *
 * SAFETY. Every anchor must match EXACTLY ONCE or nothing is written and the
 * script exits non-zero. A .bak is written before any change. Re-running after
 * a successful apply is a no-op (it reports ALREADY APPLIED, exit 0).
 *
 *   node tools/apply_gems.mjs --dry-run     # report only, write nothing
 *   node tools/apply_gems.mjs               # apply
 *
 * Run from the repo root (C:\Users\billy\Zigverse). After applying:
 *   node --check engine/zigcore.js
 *   node test/<your reference gate>          # the gate is the contract
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DRY = process.argv.includes("--dry-run");
const TARGET = process.argv.find(a => a.startsWith("--file="))?.slice(7)
            || path.join("engine", "zigcore.js");

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const ok = (m) => console.log("  OK    " + m);
const bad = (m) => console.log("  FAIL  " + m);

/* [label, exact old line, new line] — old lines are the v5.1 values, verbatim. */
const EDITS = [
  ["ruby",
   "    ruby:       { col: [0.86, 0.08, 0.17], ior: 1.77, disp: 0.016, facet: 0.85, spark: 0.70 },",
   "    ruby:       { col: [0.78, 0.06, 0.15], ior: 1.77, disp: 0.016, facet: 0.85, spark: 0.82 },   // Cr3+ red w/ faint blue secondary; FLUORESCES - spark up so lit faces intensify, not wash"],
  ["emerald",
   "    emerald:    { col: [0.10, 0.80, 0.42], ior: 1.58, disp: 0.014, facet: 0.60, spark: 0.42 },",
   "    emerald:    { col: [0.05, 0.70, 0.50], ior: 1.58, disp: 0.014, facet: 0.52, spark: 0.42 },   // BLUISH green (was yellowish); included 'jardin' so facets never flash clean"],
  ["topaz",
   "    topaz:      { col: [1.00, 0.72, 0.22], ior: 1.62, disp: 0.015, facet: 0.80, spark: 0.70 },",
   "    topaz:      { col: [1.00, 0.60, 0.30], ior: 1.63, disp: 0.015, facet: 0.80, spark: 0.70 },   // IMPERIAL topaz - peach/orange; was sitting on citrine's gold and the two were one stone"],
  ["garnet",
   "    garnet:     { col: [0.74, 0.10, 0.09], ior: 1.79, disp: 0.024, facet: 0.80, spark: 0.68 },",
   "    garnet:     { col: [0.46, 0.07, 0.09], ior: 1.79, disp: 0.024, facet: 0.80, spark: 0.52 },   // almandine - DARKER and browner than ruby, and does NOT fluoresce; value is the separator"],
];

console.log("apply_gems.mjs — GEM COLOUR ACCURACY\n");

if (!fs.existsSync(TARGET)) {
  bad(`target not found: ${TARGET}`);
  console.log("\n  Run this from the repo root, or pass --file=<path to zigcore.js>.");
  process.exit(1);
}

let src = fs.readFileSync(TARGET, "utf8");
const before = sha(src);
console.log(`  target  ${TARGET}`);
console.log(`  sha256  ${before.slice(0, 16)}...`);
console.log(`  bytes   ${src.length}\n`);

/* --- idempotency: already applied? ------------------------------------- */
const appliedCount = EDITS.filter(([, , nw]) => src.includes(nw.split("   //")[0].trimEnd())).length;
if (appliedCount === EDITS.length) {
  console.log("  ALREADY APPLIED — all four stones carry the corrected values. Nothing to do.");
  process.exit(0);
}
if (appliedCount > 0) {
  bad(`partially applied (${appliedCount}/${EDITS.length}). Refusing to touch a half-patched file.`);
  console.log("  Restore from git (git checkout -- " + TARGET + ") and re-run.");
  process.exit(1);
}

/* --- gate 1: every anchor matches exactly once -------------------------- */
console.log("  GATE 1 — anchor uniqueness");
let fail = false;
for (const [label, old] of EDITS) {
  const n = src.split(old).length - 1;
  if (n === 1) ok(`${label.padEnd(9)} 1 match`);
  else { bad(`${label.padEnd(9)} ${n} matches (need exactly 1)`); fail = true; }
}
if (fail) {
  console.log("\n  Nothing written. The file has drifted from the v5.1 values this installer expects.");
  console.log("  Send me the current ZigCore.Gems block and I will rebuild the anchors.");
  process.exit(1);
}

/* --- apply -------------------------------------------------------------- */
let out = src;
for (const [, old, nw] of EDITS) out = out.replace(old, nw);

/* --- gate 2: the change is exactly four lines --------------------------- */
console.log("\n  GATE 2 — blast radius");
const a = src.split("\n"), b = out.split("\n");
if (a.length !== b.length) { bad(`line count changed ${a.length} -> ${b.length}`); process.exit(1); }
const changed = a.map((l, i) => (l === b[i] ? null : i + 1)).filter(Boolean);
if (changed.length !== EDITS.length) {
  bad(`${changed.length} lines differ, expected ${EDITS.length}`);
  process.exit(1);
}
ok(`${changed.length} lines changed (${changed.join(", ")}), line count unchanged`);

/* --- gate 3: the emitted table parses and separates --------------------- */
console.log("\n  GATE 3 — table parses, collisions resolved");
const m = out.match(/ZigCore\.Gems = \{([\s\S]*?)\n\s*\};/);
if (!m) { bad("could not locate ZigCore.Gems after patch"); process.exit(1); }
let Gems;
try { Gems = eval("({" + m[1] + "})"); }
catch (e) { bad("patched table does not parse: " + e.message); process.exit(1); }

const hsv = (c) => {
  const [r, g, bl] = c, mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? 60 * (((g - bl) / d) % 6) : mx === g ? 60 * ((bl - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s: mx ? d / mx : 0, v: mx };
};
const names = ["diamond","ruby","sapphire","emerald","amethyst","topaz","aquamarine","garnet","citrine","peridot"];
for (const n of names) if (!Gems[n]) { bad(`missing stone: ${n}`); process.exit(1); }
ok("all ten stones present and parse");

const dh = (x, y) => { let d = Math.abs(hsv(Gems[x].col).h - hsv(Gems[y].col).h); return d > 180 ? 360 - d : d; };
const dv = (x, y) => Math.abs(hsv(Gems[x].col).v - hsv(Gems[y].col).v);

// ruby/garnet must separate on VALUE (they share a hue in nature, correctly)
if (dv("ruby", "garnet") >= 0.25) ok(`ruby vs garnet  value gap ${dv("ruby","garnet").toFixed(2)} (>= 0.25)`);
else { bad(`ruby vs garnet value gap ${dv("ruby","garnet").toFixed(2)} — too close`); fail = true; }
// topaz/citrine must separate on HUE
if (dh("topaz", "citrine") >= 15) ok(`topaz vs citrine hue gap ${dh("topaz","citrine").toFixed(0)}deg (>= 15)`);
else { bad(`topaz vs citrine hue gap ${dh("topaz","citrine").toFixed(0)}deg — too close`); fail = true; }
// emerald must be BLUISH green
const eh = hsv(Gems.emerald.col).h;
if (eh >= 155 && eh <= 175) ok(`emerald hue ${eh.toFixed(0)}deg (bluish green, 155-175)`);
else { bad(`emerald hue ${eh.toFixed(0)}deg — outside bluish-green band`); fail = true; }
// ruby must fluoresce harder than garnet
if (Gems.ruby.spark > Gems.garnet.spark) ok(`ruby spark ${Gems.ruby.spark} > garnet spark ${Gems.garnet.spark}`);
else { bad("ruby must out-spark garnet (fluorescence)"); fail = true; }

if (fail) { console.log("\n  Nothing written."); process.exit(1); }

/* --- write -------------------------------------------------------------- */
if (DRY) {
  console.log("\n  DRY RUN — all gates pass, nothing written. Re-run without --dry-run to apply.");
  process.exit(0);
}
fs.writeFileSync(TARGET + ".bak", src, "utf8");
fs.writeFileSync(TARGET, out, "utf8");
const after = sha(fs.readFileSync(TARGET, "utf8"));
console.log("\n  WRITTEN");
console.log(`  backup  ${TARGET}.bak`);
console.log(`  sha256  ${before.slice(0, 16)}... -> ${after.slice(0, 16)}...`);
console.log("\n  NEXT (do not skip):");
console.log("    node --check " + TARGET);
console.log("    run your reference gate — the gate is the contract");
console.log("    git add -A && git commit -m \"gems: accurate ruby/emerald/topaz/garnet (4 lines)\"");

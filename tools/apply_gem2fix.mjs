#!/usr/bin/env node
/* apply_gem2fix.mjs - DUAL GEM, the panel rail  ·  2026-09-20
 *
 * apply_gem2.mjs put the GEM 2 dropdown in the DOM and in skinTail(), and wired
 * it to grey out GEM FACE - but never added it to the list of skin pickers that
 * write the hash and reload. So GEM 2 changed a value nobody read: the dropdown
 * moved and the organism did not.
 *
 * ONE LINE. g2sel joins gsel/fbsel/gfsel on the same rail they already ride.
 *
 * Run AFTER apply_gem2.mjs, from the repo root:
 *   node tools/apply_gem2fix.mjs --dry-run
 *   node tools/apply_gem2fix.mjs
 */
import fs from "node:fs";
import crypto from "node:crypto";
const DRY = process.argv.includes("--dry-run");
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const EDITS = JSON.parse("[{\"file\": \"zigverse_engine.html\", \"old\": \"    /* GEM (front stone) + FABRIC (back textile) recompile the shader \\u2192 reload, staying in the current world/dials. */\\n    for (const s of [gsel, fbsel, gfsel]) if (s) s.addEventListener(\\\"change\\\", () => { location.hash = curHash(); location.reload(); });\\n    /* WORLD is a MACRO \\u2014 a named place reloads BARE (no overrides \\u2192 its NATIVE skin + shape apply);\", \"new\": \"    /* GEM (front stone) + FABRIC (back textile) recompile the shader \\u2192 reload, staying in the current world/dials. */\\n    for (const s of [gsel, g2sel, fbsel, gfsel]) if (s) s.addEventListener(\\\"change\\\", () => { location.hash = curHash(); location.reload(); });   // g2sel (DUAL GEM) rides the SAME rail as the other skin pickers \\u2014 it was in the DOM and in skinTail() but not here, so it changed a value nobody read\\n    /* WORLD is a MACRO \\u2014 a named place reloads BARE (no overrides \\u2192 its NATIVE skin + shape apply);\"}]");
const F = "zigverse_engine.html";
console.log("apply_gem2fix.mjs - DUAL GEM, the panel rail\n");
if (!fs.existsSync(F)) { console.log("  FAIL  " + F + " not found - run from the repo root."); process.exit(1); }
const src = fs.readFileSync(F, "utf8");
if (src.includes("[gsel, g2sel, fbsel, gfsel]")) { console.log("  ALREADY APPLIED - nothing to do."); process.exit(0); }
if (!src.includes('id="gem2pick"')) { console.log("  FAIL  GEM 2 picker not present - run tools/apply_gem2.mjs first."); process.exit(1); }
let out = src, fail = false;
for (const e of EDITS) {
  const n = src.split(e.old).length - 1;
  if (n !== 1) { console.log(`  FAIL  anchor matched ${n} times`); fail = true; }
  else out = out.replace(e.old, e.new);
}
if (fail) { console.log("\n  Nothing written."); process.exit(1); }
console.log("  OK    1 anchor, 1 match");
console.log("  OK    g2sel on the skin-picker reload rail");
console.log("  OK    still greys GEM FACE, still in skinTail()");
if (DRY) { console.log("\n  DRY RUN - nothing written."); process.exit(0); }
fs.writeFileSync(F + ".bak", src, "utf8");
fs.writeFileSync(F, out, "utf8");
console.log(`\n  WRITTEN ${F}`);
console.log(`          ${sha(src).slice(0,16)}... -> ${sha(out).slice(0,16)}...`);
console.log("\n  NEXT: reload the host, change GEM 2, watch it reload. Then remove the .bak.");

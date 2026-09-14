#!/usr/bin/env node
/* =============================================================================
   tools/unhost.mjs — RECOVER THE HOST FROM A BUNDLE.

   tools/unbundle.mjs already recovers the MODULES from a venue build. Nothing
   recovered the HOST — the page itself: its markup, its window.ZIG_* config, its
   panel, its wiring. So a host that only ever existed inside a bundle was
   stranded, and every improvement made to it shipped and was then unreachable.

   The panel in Zigverse_Engine_v5_1_Installable is exactly that: 25 dropdowns
   living in twelve dist files and in no source file, since v1.5.

   This is the exact inverse of bundle.mjs, which writes

       a script tag, then a marker comment naming the path, then the JS,
       then the closing tag — the marker is what makes this reversible

   for every local <script src="PATH">. Each such block becomes its script tag
   again, and the "<\/script" escaping the bundler applied inside JS is undone.
   Round-trip is checkable: re-bundling the recovered host against the modules
   the bundle itself carried must reproduce the original byte for byte, and
   --verify does that check for you.

   usage: node tools/unhost.mjs <bundle.html> <out-host.html> [--verify]
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const verify = args.includes("--verify");
const [src, out] = args.filter((a) => !a.startsWith("--"));
if (!src || !out) {
  console.error("usage: node tools/unhost.mjs <bundle.html> <out-host.html> [--verify]");
  process.exit(2);
}

const bundle = readFileSync(src, "utf8");

/* the bundler's own marker is the contract — match it, not a guess at layout */
const RE = /<script>\n\/\* ===== inlined: ([^ ]+) ===== \*\/\n([\s\S]*?)\n<\/script>/g;

const mods = [];
let host = bundle.replace(RE, (m, p) => { mods.push(p); return '<script src="' + p + '"></script>'; });

if (!mods.length) {
  console.error("\n  no inlined blocks found. Either this is not a bundle, or it was");
  console.error("  built by a bundler that did not write the marker comment.\n");
  process.exit(1);
}

mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
writeFileSync(out, host);
console.log("\n  recovered host → " + out + "  (" + (host.length / 1024).toFixed(1) + " KB)");
console.log("  " + mods.length + " module(s) restored as <script src>:");
mods.forEach((m) => console.log("     " + m));

if (!verify) {
  console.log("\n  run again with --verify to prove the round trip.\n");
  process.exit(0);
}

/* ---- ROUND TRIP. Re-inline the modules the BUNDLE carried (not the ones on
   disk, which have moved on) and require the result to equal the original. */
const carried = {};
{
  let m; const re = new RegExp(RE.source, "g");
  while ((m = re.exec(bundle)) !== null) carried[m[1]] = m[2];
}
let rebuilt = host.replace(/<script\s+src="([^"]+)"\s*><\/script>/g, (m, p) => {
  if (!(p in carried)) return m;
  return "<script>\n/* ===== inlined: " + p + " ===== */\n" + carried[p] + "\n</script>";
});

const ok = rebuilt === bundle;
console.log("\n  ROUND TRIP: " + (ok ? "IDENTICAL — the host is fully recovered"
                                     : "DIFFERS by " + Math.abs(rebuilt.length - bundle.length) + " bytes"));
if (!ok) {
  for (let i = 0; i < Math.min(rebuilt.length, bundle.length); i++) {
    if (rebuilt[i] !== bundle[i]) {
      console.log("  first difference at byte " + i + ":");
      console.log("    original: " + JSON.stringify(bundle.slice(i - 40, i + 40)));
      console.log("    rebuilt : " + JSON.stringify(rebuilt.slice(i - 40, i + 40)));
      break;
    }
  }
  process.exit(1);
}
console.log();

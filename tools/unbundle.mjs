/* =============================================================================
   tools/unbundle.mjs — the VENUE UNBUILD. The exact inverse of bundle.mjs.

   A bundle is a self-contained artifact, but it is also a TRAP: work that only
   exists inside a bundle cannot be tested, diffed, or inherited. This tool
   recovers the folder from the artifact, so a bundle is never a dead end.

   bundle.mjs stamps every inlined script with a marker comment:
       <script>
       /* ===== inlined: engine/zigcore.js ===== *\/
       ...source...
       </script>
   We read those markers back out, undo the "<\/script" escape, and restore
   each module to its declared path.

   usage: node tools/unbundle.mjs <bundle.html> [outDir]
     e.g. node tools/unbundle.mjs dist/Zigverse_Engine_v1.html .
          node tools/unbundle.mjs dist/Zigverse_Engine_v1.html /tmp/recovered

   Default outDir is "." (the repo root), matching bundle.mjs's own root
   resolution. Nothing is overwritten without --force; by default a file that
   already differs is reported and SKIPPED, so recovery can never silently
   clobber newer work. That asymmetry is deliberate: bundling is routine,
   unbundling is a rescue, and a rescue must not destroy the thing it rescues.
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const force = args.includes("--force");
const [srcHtml, outDirArg] = args.filter((a) => !a.startsWith("--"));

if (!srcHtml) {
  console.error("usage: node tools/unbundle.mjs <bundle.html> [outDir] [--force]");
  process.exit(2);
}

const outDir = path.resolve(outDirArg || ".");
const html = readFileSync(srcHtml, "utf8");

/* Match each inlined block. The marker is written by bundle.mjs verbatim, so
   this pattern is its literal counterpart — keep the two in step. */
const RE = /<script>\s*\/\* ===== inlined: ([^ ]+) ===== \*\/\n([\s\S]*?)\n<\/script>/g;

let found = 0, wrote = 0, same = 0, skipped = 0;
const report = [];

for (const m of html.matchAll(RE)) {
  found++;
  const rel = m[1];
  /* undo the escape bundle.mjs applied so "</script" inside comments survived */
  const js = m[2].replace(/<\\\/script/gi, "</script");
  const dest = path.join(outDir, rel);

  if (existsSync(dest)) {
    const cur = readFileSync(dest, "utf8");
    if (cur === js) { same++; report.push(["same", rel, js.length]); continue; }
    if (!force) { skipped++; report.push(["DIFFERS (skipped)", rel, js.length]); continue; }
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, js);
  wrote++;
  report.push(["wrote", rel, js.length]);
}

if (found === 0) {
  console.error("no inlined-script markers found — is this a bundle built by tools/bundle.mjs?");
  process.exit(1);
}

for (const [status, rel, len] of report) {
  console.log("  " + status.padEnd(20) + rel.padEnd(28) + (len / 1024).toFixed(1) + " KB");
}
console.log(
  "\n" + found + " module(s) in bundle — " +
  wrote + " written, " + same + " already identical, " + skipped + " differ (skipped)"
);
if (skipped && !force) console.log("re-run with --force to overwrite the differing files");

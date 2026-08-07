/* =============================================================================
   tools/bundle.mjs — the VENUE BUILD. A reusable platform capability:
   inline every local <script src> of a species HTML into ONE self-contained
   file that boots from anywhere — Downloads, a USB stick, a venue node with
   no folder structure. Every species inherits this.

   usage: node tools/bundle.mjs <species.html> <out.html>
     e.g. node tools/bundle.mjs fireflies.html Fireflies_ZigGlow_004_shell.html
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const [, , srcHtml, outHtml] = process.argv;
if (!srcHtml || !outHtml) { console.error("usage: node tools/bundle.mjs <species.html> <out.html>"); process.exit(2); }

const root = path.dirname(path.resolve(srcHtml));
let html = readFileSync(srcHtml, "utf8");
let inlined = 0;

html = html.replace(/<script\s+src="([^"]+)"\s*><\/script>/g, (m, src) => {
  if (/^https?:/.test(src)) return m;                       // leave CDN refs alone
  const p = path.join(root, src);
  let js = readFileSync(p, "utf8");
  /* engine headers contain literal "</script>" inside comments — that would
     end the inline block early. "<\/script" is byte-identical in JS strings
     and harmless in comments. */
  js = js.replace(/<\/script/gi, "<\\/script");
  inlined++;
  return "<script>\n/* ===== inlined: " + src + " ===== */\n" + js + "\n</script>";
});

if (inlined === 0) { console.error("no local <script src> tags found — nothing bundled"); process.exit(1); }
mkdirSync(path.dirname(path.resolve(outHtml)), { recursive: true });
writeFileSync(outHtml, html);
console.log("bundled " + inlined + " scripts → " + outHtml + " (" + (html.length / 1024).toFixed(1) + " KB)");

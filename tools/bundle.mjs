/* =============================================================================
   tools/bundle.mjs — the VENUE BUILD. A reusable platform capability:
   inline every local <script src> of a species HTML into ONE self-contained
   file that boots from anywhere — Downloads, a USB stick, a venue node with
   no folder structure. Every species inherits this.

   usage: node tools/bundle.mjs <species.html> <out.html> [--app]
     --app (v5.6) — the HOME-SCREEN build, for ANY species: adds the icon
       (tools/app_icon.png, inlined), the Apple/Android app tags when the page
       lacks them, and window.ZIG_APP = true so a host can open with its app
       defaults. Share → Add to Home Screen then opens it full-screen.
     e.g. node tools/bundle.mjs fireflies.html Fireflies_ZigGlow_004_shell.html
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ARGS = process.argv.slice(2);
const APP = ARGS.includes("--app");
const [srcHtml, outHtml] = ARGS.filter((a) => !a.startsWith("--"));
if (!srcHtml || !outHtml) { console.error("usage: node tools/bundle.mjs <species.html> <out.html> [--app]"); process.exit(2); }

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
let appNote = "";
if (APP) {
  /* THE HOME-SCREEN BUILD. Everything inlined, like the scripts: the icon
     travels inside the one file, so the app still has its face from a USB
     stick or a venue node. Tags a page already carries are left alone. */
  const here = path.dirname(fileURLToPath(import.meta.url));   // Windows-safe (drive letters, spaces)
  const iconPath = path.join(here, "app_icon.png");
  let head = "\n<script>window.ZIG_APP = true;</script>";
  try {
    const uri = "data:image/png;base64," + readFileSync(iconPath).toString("base64");
    head += "\n<link rel=\"apple-touch-icon\" href=\"" + uri + "\">\n<link rel=\"icon\" type=\"image/png\" href=\"" + uri + "\">";
  } catch (e) { console.error("  --app: no tools/app_icon.png — building without an icon"); }
  const tags = [
    ['apple-mobile-web-app-capable', '<meta name="apple-mobile-web-app-capable" content="yes">'],
    ['mobile-web-app-capable', '<meta name="mobile-web-app-capable" content="yes">'],
    ['apple-mobile-web-app-status-bar-style', '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'],
    ['apple-mobile-web-app-title', '<meta name="apple-mobile-web-app-title" content="Zigverse">'],
    ['theme-color', '<meta name="theme-color" content="#010204">']];
  let added = 0;
  for (const [n, t] of tags) if (!new RegExp('name="' + n + '"').test(html)) { head += "\n" + t; added++; }
  if (!/<head[^>]*>/i.test(html)) { console.error("  --app: no <head> in " + srcHtml); process.exit(2); }
  html = html.replace(/<head[^>]*>/i, (m) => m + head);
  appNote = " · APP: icon + ZIG_APP" + (added ? " + " + added + " app tags" : " (app tags already present)");
}
writeFileSync(outHtml, html);
console.log("bundled " + inlined + " scripts → " + outHtml + " (" + (html.length / 1024).toFixed(1) + " KB)" + appNote);

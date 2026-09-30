#!/usr/bin/env node
/* tools/apply_chladni_live.mjs - CHLADNI: THE TEST READS LIVE VALUES - 2026-09-30
 * Small patch on top of apply_chladni_keys.mjs. Checks the fingerprint before AND after;
 * anything unexpected writes nothing. Re-running skips.
 *   node tools/apply_chladni_live.mjs --dry-run
 *   node tools/apply_chladni_live.mjs
 */
import fs from "node:fs"; import crypto from "node:crypto";
const DRY = process.argv.includes("--dry-run");
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const OPS = [{"file": "chladni_study.html", "target": "8b84978252f05f826c5b6437316554474f19c858d42add5c546ce6e0974bc009", "variants": [{"base": "0ba0f29ed29102dc78ae04c558f767136dbb0ed9d625038e8fc29a9824b086d8", "hunks": [["  let mode = CH.pick(MODES, CH.kFor(64)), prev = null, fadeW = 1, note = 64, noteSrc = \"\", sMorph = -1, bendS = 0;\n", "  let mode = CH.pick(MODES, CH.kFor(64)), prev = null, fadeW = 1, note = 64, noteSrc = \"\", sMorph = -1, bendS = 0;\n  /* what the note IS right now - read live, never a copy from the last frame\n     (a test that presses keys faster than frames are drawn must see every step) */\n  Object.defineProperties(window.ChladniStudy, {\n    note: { get: () => note, enumerable: true }, noteSrc: { get: () => noteSrc, enumerable: true },\n    n: { get: () => mode.n, enumerable: true }, m: { get: () => mode.m, enumerable: true }, k: { get: () => mode.k, enumerable: true }\n  });\n"], ["    const S = window.ChladniStudy;\n    S.frames++; S.booted = true; S.N = N; S.n = mode.n; S.m = mode.m; S.k = mode.k; S.s = sMorph; S.note = note; S.E = E; S.formed = formed;\n    S.medium = medium; S.aligned = aligned; S.listening = listening; S.noteSrc = noteSrc; S.fingers = fingers.size; S.sung = sung; S.dropped = gov.drops; S.hopping = (() => { let c = 0; for (let i = 0; i < N; i += 7) if (P.h[i] > 0) c++; return c; })();\n", "    const S = window.ChladniStudy;\n    S.frames++; S.booted = true; S.N = N; S.s = sMorph; S.E = E; S.formed = formed;\n    S.medium = medium; S.aligned = aligned; S.listening = listening; S.fingers = fingers.size; S.sung = sung; S.dropped = gov.drops; S.hopping = (() => { let c = 0; for (let i = 0; i < N; i += 7) if (P.h[i] > 0) c++; return c; })();\n"]]}]}];
const LOGS = [["2026-09-30 - CHLADNI - THE TEST READS LIVE VALUES", "\n\n**2026-09-30 - CHLADNI - THE TEST READS LIVE VALUES** - chladni_study.html\n- eyeZ, with key logging: the page RECEIVED all 7 ArrowUp (none marked repeat) yet the test saw 64 -> 69. So no key was lost and the e.repeat theory was also wrong. Cause: ChladniStudy.note / n / m / k / noteSrc were copied into the test object once per DRAWN FRAME; on eyeZ several key presses land between two frames, and the test read the copy from the frame before. (It also explains the earlier finger-slide miss, which read the note right after the move.)\n- Fix: those values are now live getters - the test sees the note as it IS. Proof in the container: with drawing frozen completely, seven presses read 64 -> 71, k 37. The plate itself was never wrong.\n- Lesson for every study's test hooks: a value a test reads right after an input must be live, not a per-frame mirror.\n"]];
console.log("apply_chladni_live.mjs\n");
if (!fs.existsSync("engine/zigcore.js") || !fs.existsSync("briefs/Session_Log.md")) { console.log("  FAIL  run this from C:\\Users\\billy\\Zigverse"); process.exit(1); }
let bad = 0; const plan = [];
for (const o of OPS) {
  const cur = fs.existsSync(o.file) ? fs.readFileSync(o.file, "utf8").replace(/\r\n/g, "\n") : null;
  if (cur === null) { const w = o.variants.find((x) => x.base === "ABSENT"); if (!w) { console.log("  FAIL  " + o.file + " missing"); bad++; continue; }
    if (sha(w.whole) !== o.target) { console.log("  FAIL  " + o.file + " payload"); bad++; continue; } plan.push([o.file, w.whole]); console.log("  OK    " + o.file.padEnd(22) + " new file"); continue; }
  const h = sha(cur);
  if (h === o.target) { console.log("  SKIP  " + o.file.padEnd(22) + " already fixed"); continue; }
  const vr = o.variants.find((x) => x.base === h);
  if (!vr) { console.log("  FAIL  " + o.file.padEnd(22) + " not a file this patch knows (is apply_chladni_keys installed?) (" + h.slice(0, 12) + ")"); bad++; continue; }
  let out = cur;
  for (const [a, b] of vr.hunks) { if (out.split(a).length !== 2) { console.log("  FAIL  " + o.file + " patch anchor"); bad++; break; } out = out.replace(a, () => b); }
  if (sha(out) !== o.target) { console.log("  FAIL  " + o.file + " result fingerprint"); bad++; continue; }
  plan.push([o.file, out]); console.log("  OK    " + o.file.padEnd(22) + " will be patched (" + vr.hunks.length + " changes)");
}
const LOGTXT = fs.readFileSync("briefs/Session_Log.md", "utf8"); const need = LOGS.filter(([m]) => !LOGTXT.includes(m));
for (const [m] of LOGS) console.log("  " + (need.some(([k]) => k === m) ? "OK    Session_Log: " + m.slice(13) + " will be appended" : "SKIP  Session_Log: " + m.slice(13) + " already present"));
if (bad) { console.log("\n  Nothing written."); process.exit(1); }
if (DRY) { console.log("\n  DRY RUN - all checks pass, nothing written."); process.exit(0); }
for (const [f, out] of plan) { fs.writeFileSync(f, out); if (sha(fs.readFileSync(f, "utf8")) !== sha(out)) { console.log("  FAIL  write verify " + f); process.exit(1); } console.log("  WROTE " + f + "  verified"); }
for (const [m, t] of need) { fs.appendFileSync("briefs/Session_Log.md", t); console.log("  WROTE Session_Log: " + m.slice(13)); }
console.log("\n  NEXT: node test/_chladniboot.mjs");

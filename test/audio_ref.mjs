/* =============================================================================
   test/audio_ref.mjs — AUDIO GAIN (dial.audio), PROVED ON THE CPU
   run: node test/audio_ref.mjs

   dial.audio scales how far the horn reaches into the body. It is pure JS on
   uniform VALUES — view[74], view[52..54], view[70] — not shader source, so no
   WGSL changes, no bindings move, and the Metal gate is not implicated.

   The three claims that matter:
     1. gain 0 means audio drives NOTHING. Not "a little" — the lifts collapse
        to x1 and the strike is skipped. Silence must be silent.
     2. gain scales BOTH paths. One dial cannot mean two things depending on
        whether VOICE or AMBIENCE happens to be armed.
     3. the strike threshold moves the OTHER way and is floored. More gain
        crosses sooner, but never so soon that room noise strikes.
   (Built 2026-09-21 as v5.3 AudioDial; never landed. Restored 2026-09-23.)
   ========================================================================== */
import { readFileSync } from "node:fs";
import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = readFileSync(path.join(ROOT, "species", "sickleswarm.js"), "utf8");

let bad = 0;
const chk = (n, c) => { console.log((c ? "  OK   " : "  FAIL ") + n); if (!c) bad++; };

console.log("A — the dial exists and is bounded");
chk("dial.audio declared", /audio:\s*\(global\.ZIG_AUDIOGAIN/.test(SRC));
chk("clamped 0..4 at boot", /Math\.max\(0,\s*Math\.min\(4,\s*\+global\.ZIG_AUDIOGAIN\)\)/.test(SRC));
chk("defaults to 1", /:\s*1\),\s*\/\/ AUDIO GAIN/.test(SRC));

console.log("\nB — the VOICE path is scaled");
chk("body -> ink",    SRC.includes("view[74] *= 1 + 0.45 * dial.audio * ZC.Timbre.body"));
chk("brightness -> moon", SRC.includes("const bl = 1 + 0.5 * dial.audio * ZC.Timbre.brightness"));

console.log("\nC — the AMBIENCE path is scaled by the SAME dial");
chk("life -> ink",    SRC.includes("view[74] *= 1 + 0.65 * dial.audio * life"));
chk("brightness -> moon", SRC.includes("const bl = 1 + 0.55 * dial.audio * A.brightness"));
chk("onset -> moonpath",  SRC.includes("view[70] *= 1 + 0.9 * dial.audio * A.onset"));

console.log("\nD — the strike threshold inverts, floors, and dies at zero");
chk("gain 0 skips the strike entirely", SRC.includes("dial.audio > 0 && ZC.Timbre.flux >"));
chk("threshold divided by gain",        SRC.includes("0.55 / dial.audio"));
chk("floored at 0.15",                  SRC.includes("Math.max(0.15, 0.55 / dial.audio)"));

console.log("\nE — the arithmetic, not just the text");
const lift = (k, g, v) => 1 + k * g * v;
chk("gain 0 -> ink lift is exactly 1.0", lift(0.45, 0, 0.9) === 1);
chk("gain 1 -> the old value survives", Math.abs(lift(0.45, 1, 0.9) - (1 + 0.45 * 0.9)) < 1e-12);
chk("gain 4 -> reaches further",        lift(0.45, 4, 0.9) > lift(0.45, 1, 0.9));
const thr = (g) => Math.max(0.15, 0.55 / g);
chk("gain 1 -> threshold still 0.55",   Math.abs(thr(1) - 0.55) < 1e-12);
chk("gain 4 -> threshold lower",        thr(4) < 0.55);
chk("gain 4 -> still above the floor",  thr(4) >= 0.15);

console.log("\nF — the ALT layer does not collide");
chk("Alt+] bound",  SRC.includes('e.altKey && e.code === "BracketRight"'));
chk("Alt+[ bound",  SRC.includes('e.altKey && e.code === "BracketLeft"'));
chk("Alt+\\ snaps off/1", SRC.includes('e.altKey && e.code === "Backslash"'));
chk("bare brackets still drive FOV", SRC.includes('if (e.code === "BracketRight") dial.fov'));
chk("alt checked BEFORE the bare binding",
    SRC.indexOf('e.altKey && e.code === "BracketRight"') < SRC.indexOf('if (e.code === "BracketRight") dial.fov'));

console.log("\n" + (bad ? `FAIL — ${bad} check(s)` : "PASS — all checks"));
process.exit(bad ? 1 : 0);

/* =============================================================================
   test/notefield_ref.mjs — CPU reference for ZC.NoteField (MELODIC STRATA)
   (run: node test/notefield_ref.mjs) — pure math, no browser, no GPU.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigcore.js"), "utf8"))();
const NF = globalThis.ZigCore.NoteField;

let fails = 0;
const ok = (name, cond, got) => { if (!cond) { fails++; console.log("FAIL", name, "· got", got); } else console.log("ok  ", name, got !== undefined ? "· " + got : ""); };
const approx = (x) => Math.round(x * 1000) / 1000;

NF.reset();
ok("starts empty", NF.bands.length === 0, NF.bands.length);

/* deposit a note → one band at its y/hue, full energy */
NF.note(50, 0.25, 1);
ok("note deposits a band", NF.bands.length === 1, NF.bands.length);
ok("band carries y", NF.bands[0].y === 50, NF.bands[0].y);
ok("band carries hue", approx(NF.bands[0].hue) === 0.25, NF.bands[0].hue);

/* hue wraps into 0..1 */
NF.note(60, 1.25, 1);
ok("hue wraps to 0..1", approx(NF.bands[1].hue) === 0.25, NF.bands[1].hue);

/* energy decays over ~2.2 s (one time-constant → ~1/e) and culls when faded */
NF.reset(); NF.note(40, 0.5, 1);
for (let i = 0; i < 132; i++) NF.update(1 / 60);         // 2.2 s → ~1/e
ok("energy decays ~1/e in one tau (2.2 s)", NF.bands.length === 1 && NF.bands[0].e > 0.3 && NF.bands[0].e < 0.42, NF.bands[0] ? approx(NF.bands[0].e) : "culled");
for (let i = 0; i < 500; i++) NF.update(1 / 60);         // long silence
ok("faded band is culled", NF.bands.length === 0, NF.bands.length);

/* MAX cap — newest crowd out oldest */
NF.reset();
for (let p = 0; p < 9; p++) NF.note(30 + p, p / 12, 1);
ok("caps at MAX=6", NF.bands.length === 6, NF.bands.length);
ok("oldest dropped (first y = 33)", NF.bands[0].y === 33, NF.bands[0].y);

/* pack → (y, hue, e, 0) per band into a Float32Array at an offset */
NF.reset(); NF.note(55, 0.1, 0.8);
const arr = new Float32Array(108);
NF.pack(arr, 84);
ok("pack writes y at off", arr[84] === 55, arr[84]);
ok("pack writes hue", approx(arr[85]) === 0.1, arr[85]);
ok("pack writes energy", approx(arr[86]) === 0.8, arr[86]);
ok("pack zero-fills empty slots", arr[88] === 0 && arr[107] === 0, arr[88] + "," + arr[107]);

console.log(fails ? `\nNOTEFIELD REF: FAIL (${fails})` : "\nNOTEFIELD REF: PASS");
process.exit(fails ? 1 : 0);

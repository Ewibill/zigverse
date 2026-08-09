// Assemble STEP_SRC through every capability that touches it, without a GPU.
// This is what failed on eyeZ yesterday: CONTACT must not consume an anchor
// another capability still needs.
import { readFileSync } from "fs";
const src = readFileSync("/home/claude/live/engine/zigwebgpu.js", "utf8");
const K_PREINT = "  /* ---- integrate with speed band ---- */";
const VELOUT   = "@group(0) @binding(6) var<storage, read_write> velOut: array<vec4f>;";
const VMIN_SH  = "let vmin = U.knobsA.z;";
const MCAP     = "  let vmin = U.knobsA.z; let vmax = U.knobsA.w + U.knobsB.x * agit + 6.0 * localBreath;";
const VOICE    = "agit = max(agit * exp(-1.6 * U.dt), nAgit * U.knobsA.x);";
const ONSET1   = "  /* ---- contagion: agitation spreads one neighbor-hop per step ----";
const ONSET2   = "  /* ---- impulse wavefronts (the falcon strike \u00b7 the thrown stone) ----";

// pull the raw STEP_SRC template out of the file
const m = src.match(/const STEP_WGSL = COMMON \+ `([\s\S]*?)`;/);
if (!m) { console.log("could not locate STEP_SRC template"); process.exit(1); }
let S = m[1];
const count = (h, n) => h.split(n).length - 1;

console.log("anchors present in the RAW kernel:");
const ANCH = [["K_PREINT", K_PREINT], ["velOut binding", VELOUT], ["vmin (short)", VMIN_SH],
              ["mCap (MEDIUM full line)", MCAP], ["VOICE contagion line", VOICE],
              ["ONSET anchor 1", ONSET1], ["ONSET anchor 2", ONSET2]];
for (const [n, a] of ANCH) console.log(`  ${n.padEnd(26)} ${count(S, a)}`);

// simulate CONTACT (prepend-only) then ONSET (brackets, never replaces)
S = S.replace(VELOUT, VELOUT + "\nconst CT_R: f32 = 1.0;");
S = S.replace(K_PREINT, "  /* CONTACT block */\n" + K_PREINT);
S = S.replace(ONSET1, "  let agitPrev = agit;\n" + ONSET1);
S = S.replace(ONSET2, "  /* ONSET limiter */\n" + ONSET2);
console.log("\nafter CONTACT + ONSET splices:");
let ok = true;
for (const [n, a] of ANCH) { const c = count(S, a); if (!c) ok = false;
  console.log(`  ${n.padEnd(26)} ${c}   ${c ? "" : "<-- CONSUMED"}`); }
console.log("\n" + (ok ? "PASS — no capability consumed an anchor another still needs"
                       : "FAIL — an anchor was eaten"));

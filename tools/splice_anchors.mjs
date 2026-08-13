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

/* ---- CROSS-SHADER LEAKS ---------------------------------------------------
   The compute kernel's uniform block is `U`; the render kernel's is `V`. They are
   different shaders and neither can see the other's. Reaching for U.* inside the
   render source compiles to nothing, the whole render module fails, and the result
   is a TOTALLY BLACK canvas with a perfectly healthy HUD and the flock still
   running at 100fps behind it — which is exactly what happened on 2026-08-09 and
   reads like a dead page rather than a shader error. Cheap to check, so check. */
const rm = src.match(/const RENDER_WGSL = `([\s\S]*?)`;/);
if (rm) {
  const R = rm[1];
  const leaks = (R.match(/\bU\.[a-zA-Z]/g) || []);
  console.log("\nrender shader referencing the COMPUTE uniform (U.*):", leaks.length);
  if (leaks.length) console.log("   ", [...new Set(leaks)].join(" "), "  <-- would blank the canvas");
  console.log(leaks.length ? "FAIL — cross-shader uniform leak" : "PASS — render shader touches no compute uniform");
} else console.log("\n(could not isolate RENDER_WGSL to check for cross-shader leaks)");

/* ---- VIEW STRUCT vs UNIFORM BUFFER ----------------------------------------
   The View struct is declared in several shaders and the buffer that backs it is
   sized separately, by hand, in three places. If any shader declares a struct
   LARGER than the buffer, the pipeline fails and the canvas goes BLACK with a
   perfectly healthy HUD — the same silent failure mode as a cross-shader uniform
   leak. Adding a field to View means updating every size. Twice in one session a
   field was added and a size was missed. Mechanical from here. */
{
  const sizes = [];
  const re = /struct View \{([\s\S]*?)\};/g;
  let m;
  while ((m = re.exec(src))) {
    const body = m[1].replace(/\/\/[^\n]*/g, "");
    let f = 16 * ((body.match(/mat4x4f/g) || []).length);
    const arr = body.match(/array<vec4f,\s*(\d+)>/);
    if (arr) f += 4 * parseInt(arr[1]);
    f += 4 * ((body.replace(/array<vec4f,\s*\d+>/, "").match(/vec4f/g) || []).length);
    sizes.push(f);
  }
  /* only the buffers actually named viewBuf back the View struct — other uniform
     buffers in the file are unrelated and must not drag the budget down. */
  const bufs = [...src.matchAll(/const viewBuf = device\.createBuffer\(\{\s*size:\s*(\d+)\s*\*\s*4/g)].map((x) => +x[1]);
  const viewf = (src.match(/const VIEWF = (\d+);/) || [])[1];
  const budget = Math.min(...bufs.filter((b) => b >= 60), viewf ? +viewf : Infinity);
  console.log("\nView struct sizes (floats):", sizes.join(", "));
  console.log("uniform buffers sized (floats):", bufs.join(", "), viewf ? "· VIEWF " + viewf : "");
  const bad = sizes.filter((f) => f > budget);
  console.log(bad.length ? `FAIL — a View (${bad.join(", ")}) exceeds the ${budget}-float buffer; the canvas will be BLACK`
                         : `PASS — every View fits the ${budget}-float buffer`);
}

/* ---- BACKTICKS INSIDE SHADER SOURCE ---------------------------------------
   Every WGSL block in this engine lives inside a JS template literal, so a
   backtick in a shader COMMENT silently terminates the string and the file stops
   parsing. Hit three times in one session while writing perfectly ordinary prose
   about a variable name. `node --check` does catch it, but only after the edit is
   already written; naming it here makes the cause obvious instead of hunting a
   SyntaxError pointing at a comment. */
{
  const shaderBlocks = [...src.matchAll(/const [A-Z_]+_WGSL = (?:COMMON \+ )?`([\s\S]*?)`;/g)];
  let ticks = 0;
  for (const b of shaderBlocks) ticks += (b[1].match(/`/g) || []).length;
  console.log("\nbackticks inside WGSL source blocks:", ticks);
  console.log(ticks ? "FAIL — a backtick in shader source will close its template literal"
                    : "PASS — no stray backticks in shader source");
}

/* ---- BirdOut VARYING SLOTS ------------------------------------------------
   BirdOut's @location slots are claimed from two places: the struct text and
   SPLICES that append their own. MATERIAL appends @location(10) snw by anchoring
   on the struct's last line plus its closing brace, so writing a new varying into
   that text both COLLIDES on the slot and BREAKS the anchor — which blanked the
   canvas on 2026-08-09.
   Scoped to slots >= 7: every other struct in the file is small and reuses the
   low slots legitimately, so only BirdOut reaches this range. A heuristic, but a
   stable one, and the alternative is parsing WGSL properly for no extra safety. */
{
  const claims = new Map();
  for (const m of src.matchAll(/@location\((\d+)\)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) {
    const slot = +m[1];
    if (slot < 7) continue;
    if (!claims.has(slot)) claims.set(slot, new Set());
    claims.get(slot).add(m[2]);
  }
  const dupes = [...claims.entries()].filter(([, n]) => n.size > 1);
  const listed = [...claims.entries()].sort((a, b) => a[0] - b[0])
    .map(([k, v]) => k + ":" + [...v].join("/")).join("  ");
  console.log("\nBirdOut varying slots (>=7):", listed);
  for (const [slot, names] of dupes) console.log(`   slot ${slot} claimed twice: ${[...names].join(", ")}`);
  console.log(dupes.length ? "FAIL — a varying slot is claimed twice; the pipeline fails and the canvas goes BLACK"
                           : "PASS — no BirdOut varying slot is claimed twice");
}

/* ---- VARYINGS REFERENCED vs VARYINGS DECLARED ------------------------------
   A varying added by splice exists only when that splice runs. If ANOTHER
   capability's block reads it, the two must be conditioned together — otherwise
   the fragment stage references something never declared and the pipeline fails.
   Turning the BEE off while FLASH was on did exactly that on 2026-08-09: bee ON
   worked, bee OFF went black, which reads like the opposite of a bug.
   Checks that every inp.NAME used anywhere has a matching @location declaration. */
{
  const used = new Set([...src.matchAll(/\binp\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]));
  const declared = new Set([...src.matchAll(/@location\(\d+\)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((m) => m[1]));
  /* @builtin members are declared too, just not with @location */
  for (const m of src.matchAll(/@builtin\([a-z_]+\)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g)) declared.add(m[1]);
  const missing = [...used].filter((n) => !declared.has(n));
  console.log("\nvaryings read as inp.*:", [...used].sort().join(" "));
  console.log(missing.length ? "FAIL — read but never declared: " + missing.join(", ") + " (pipeline fails, canvas BLACK)"
                             : "PASS — every varying read is declared somewhere");
  /* and the conditioning: bee is spliced, so anything reading it must be gated with it */
  const beeGate = src.match(/if \(BEE > 1([^)]*)\) \{\s*\n\s*\/\* THE BEE varying/);
  if (beeGate) console.log(beeGate[1].includes("NOTEFLASH")
    ? "PASS — the bee varying is declared for every consumer (BEE and NOTEFLASH)"
    : "FAIL — the bee varying is gated on BEE alone but NOTEFLASH also reads it");
}

/* ---- CROSS-MODULE CONSTANTS -----------------------------------------------
   Each WGSL block is compiled as a SEPARATE shader module. A const declared in
   one does not exist in the others, however adjacent they look in this file.
   nvidia's compiler let a dangling reference through; **Metal refused it**, the
   render pipeline failed to build, and the result was a black canvas with a
   healthy HUD at sixty fps — found on a MacBook Air, on a backend this engine
   had never been run on. Every module must declare what it uses. */
{
  const mods = [...src.matchAll(/const ([A-Z_0-9]+_WGSL) = (?:COMMON \+ )?(?:!PHASE \? "" : )?`([\s\S]*?)`;/g)];
  const skip = /^(GX|GY|GZ|CAP|MAX|PI|WLIFE)$/;
  let bad = 0;
  for (const m of mods) {
    const name = m[1];
    const body = m[2].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const used = new Set([...body.matchAll(/\b([A-Z][A-Z_0-9]{3,})\b/g)].map((x) => x[1]));
    for (const u of used) {
      if (skip.test(u)) continue;
      if (!/_(SIZE|BEE|FRAC|CEIL|TOTAL|REST|BEND|NSPAN|SPANS|DAMP|K|R|N)$/.test(u)) continue;
      if (!new RegExp("const\\s+" + u + "\\s*:").test(body)) {
        console.log(`   ${name} uses ${u} without declaring it`);
        bad++;
      }
    }
  }
  console.log("\nWGSL modules checked for cross-module constants:", mods.length);
  console.log(bad ? "FAIL — a module references a constant from another module; the pipeline will fail and the canvas go BLACK"
                  : "PASS — every module declares the constants it uses");
}

/* ---- MUTABLE LOCAL ARRAYS IN VERTEX STAGES --------------------------------
   Metal gives a vertex function a small stack, and a `var` array is a mutable
   local that cannot live in registers — six vec2f was enough to overflow it and
   kill the render pipeline. nvidia kept it in registers and never complained.
   Compute the values instead. */
{
  const fns = [...src.matchAll(/fn ([a-zA-Z_]+Vs)\(/g)];
  let bad = 0;
  for (const f of fns) {
    const end = src.indexOf("\nfn ", f.index + 5);
    const body = src.slice(f.index, end < 0 ? f.index + 4000 : end);
    /* `var o: WOut;` is a struct, not an array — only an ARRAY spills. Match the
       assignment form and the typed form, both requiring the word array. */
    const arrs = [...body.matchAll(/var\s+\w+\s*(?::\s*array<|=\s*array<)/g)];
    if (arrs.length) { console.log(`   ${f[1]} declares ${arrs.length} mutable local array(s)`); bad++; }
  }
  console.log("\nvertex stages checked for stack-spilling arrays:", fns.length);
  console.log(bad ? "FAIL — a vertex stage declares a mutable local array; Metal will refuse it"
                  : "PASS — no vertex stage declares a mutable local array");
}

// Assemble STEP_SRC through every capability that touches it, without a GPU.
// This is what failed on eyeZ yesterday: CONTACT must not consume an anchor
// another capability still needs.
import { readFileSync } from "fs";
const src = readFileSync(process.argv[2] || "/home/claude/live/engine/zigwebgpu.js", "utf8");
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
    /* MEASURE THE SHADER, NOT THE SOURCE (2026-08-17). Every capability that
       adds a module-scope const splices on the literal `"struct View {"`, so
       that text also appears in this file as JS — and the regex then runs from
       the JS occurrence forward to the NEXT REAL struct's `};`, swallowing both
       and reporting a struct that does not exist. RADIANCE hit this and was
       reported as a 116-float View against a 112-float buffer: a black-canvas
       FAIL for a law that never touched View.
       This is the same error as counting `var<private>` with grep — counting a
       hazard's NAME in source instead of the hazard in emitted output. A real
       WGSL struct body is field declarations and comments; once the comments
       are stripped it never contains a JS string quote or a template backtick.
       Comments MUST be stripped first: the lantern's truncated View carries the
       word "struct member render5 not found" in a block comment, and a naive
       quote test silently dropped the one struct that has already caused a
       Metal black canvas. An audit that quietly stops auditing is worse than
       no audit. */
    const stripped = m[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    if (/["`]/.test(stripped)) { re.lastIndex = m.index + 1; continue; }   // REWIND: a JS occurrence runs forward to the NEXT real struct's `};` and would otherwise EAT it — skipping without rewinding is how RADIANCE made the lantern's View disappear from the audit entirely
    const body = stripped;
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

/* ---- TENTH CHECK · THE METAL CLAUSE, MEASURED ON EMITTED WGSL --------------
   CANON.md §2: "Any law emitting WGSL is checked for `var<private>` arrays
   reachable from a vertex function before it lands. Metal overflows the vertex
   stack. Lint it, don't test it."

   The Session_Log already recorded the trap (2026-08-16): a naive
   `grep -c 'var<private>'` returns 1 on the FIXED zigmesh.js, because the
   survivor is the comment describing the hazard. Counting occurrences of a
   hazard's NAME is not counting the hazard. This strips comments FIRST and then
   looks only at what actually reaches a shader string. */
{
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const clean = strip(src);
  const inStrings = (clean.match(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g) || []).join("\n");
  const hits = (inStrings.match(/var<private>/g) || []).length;
  const named = (src.match(/var<private>/g) || []).length;
  console.log("\n`var<private>` — text occurrences:", named, "\u00b7 EMITTED into WGSL:", hits);
  console.log(hits === 0
    ? "PASS \u2014 no var<private> reaches a shader (the remaining " + named + " are comments about the hazard)"
    : "FAIL \u2014 " + hits + " var<private> would be emitted; Metal will overflow the vertex stack");
}

/* ---- ELEVENTH CHECK · THE ORDERING CONTRACT -------------------------------
   Added 2026-08-17 with Canon.Order 1.0.0, and it is the check that would have
   caught Ambience-vs-Radiance BEFORE it shipped rather than during a design
   session.

   Two capabilities that append after the SAME anchor execute in the REVERSE of
   the order they were applied in, because `.replace(A, A + block)` pushes the
   later one in front. The engine ALSO uses `.replace(A, block + A)`, which has
   the opposite semantics. So whenever two capabilities share an anchor, their
   order in the emitted shader is decided by which idiom each author reached
   for and where their `if` block happened to sit — not by anything anyone
   declared. tools/order_collisions.mjs measures this; this check forbids it.

   The rule: an anchor may be APPENDED at by at most one capability. If two
   want the same insertion point, they belong on a rail (ZigCore.Canon.Order),
   which emits every claim once, in a declared station order, with no idiom to
   get backwards.

   MEASURE THE ANCHOR, NOT THE VARIABLE. The first version of this check
   counted anchor VARIABLE NAMES and reported `a1` as contested three times.
   It is not: `a1` is declared separately inside BIOME, MEDIUM and BOUNDARY and
   holds a DIFFERENT string in each. Meanwhile `q1` is genuinely the same
   velOut binding in three blocks. A check keyed on names invents one fault and
   would have missed the real one if the authors had picked different letters —
   which is the same failure this log recorded twice already (`grep -c
   'var<private>'`, and the View-struct regex reading JS as WGSL). So each
   anchor variable is resolved to its literal VALUE and the values are what
   gets counted. */
{
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const clean = strip(src);

  /* Resolve every `const NAME = "literal";` to its value, keyed by the offset
     it was declared at, so the nearest PRECEDING declaration wins — which is
     what block scoping does. */
  const decls = [...clean.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*("(?:\\.|[^"\\])*")\s*;/g)]
    .map((m) => ({ at: m.index, name: m[1], val: m[2] }));
  const valueAt = (name, at) => {
    let best = null;
    for (const d of decls) if (d.name === name && d.at < at && (!best || d.at > best.at)) best = d;
    return best ? best.val : "?" + name;
  };

  const writes = {};                       // anchor VALUE -> [{idiom, name}]
  const note = (val, idiom, name) => (writes[val] || (writes[val] = [])).push({ idiom, name });
  for (const m of clean.matchAll(/\.replace\(\s*([A-Za-z_$][\w$]*)\s*,\s*\1\s*\+/g))
    note(valueAt(m[1], m.index), "append", m[1]);
  for (const m of clean.matchAll(/\.replace\(\s*([A-Za-z_$][\w$]*)\s*,\s*[^,]*?\+\s*\1\s*\)/g))
    note(valueAt(m[1], m.index), "prepend", m[1]);

  const railed = (clean.match(/Order\.(render|emit)\(/g) || []).length;
  const contested = Object.keys(writes).filter((v) => writes[v].length > 1);

  /* ORDER IS ONLY SEMANTICS INSIDE A FUNCTION. An anchor that is itself a
     MODULE-SCOPE declaration (a binding, a struct, a const, an fn) opens an
     order-free region: WGSL places no ordering requirement on module-scope
     declarations, so seven capabilities appending their own bindings after the
     velOut line cannot get in each other's way however they are sequenced.
     An anchor that is a STATEMENT inside a function is an execution chain, and
     there order IS the meaning — that is the Ambience-vs-Radiance case.
     Reporting both as the same fault would put a permanent red line in the
     audit that everyone learns to scroll past, so they are separated. */
  const isDecl = (v) => /^"\s*(@group|@binding|struct\s|const\s|alias\s|fn\s|var<)/.test(v);
  const free = contested.filter(isDecl);
  const chains = contested.filter((v) => !isDecl(v));

  console.log("\ndistinct anchors written by a splice:", Object.keys(writes).length,
    "\u00b7 rail-emitted insertion points:", railed);
  const show = (v) => {
    const w = writes[v];
    const mixed = w.some((x) => x.idiom === "append") && w.some((x) => x.idiom === "prepend");
    console.log("   " + v.slice(0, 60) + (v.length > 60 ? "\u2026\"" : "") +
      "\n     written " + w.length + " times as " + w.map((x) => x.name + ":" + x.idiom).join(", ") +
      (mixed ? "  \u2190 MIXED idioms: the same pair would order oppositely" : ""));
  };
  for (const v of free) show(v);
  if (free.length) console.log("   \u2191 module-scope declarations \u2014 WGSL does not order these, so sharing is safe");
  for (const v of chains) show(v);
  console.log(chains.length === 0
    ? "PASS \u2014 no EXECUTION-chain anchor is written by two capabilities" +
      (free.length ? " (" + free.length + " order-free declaration anchor(s) shared, which is fine)" : "")
    : "FAIL \u2014 " + chains.length + " statement anchor(s) written by more than one capability. Inside a\n         function, order IS the meaning. Put them on a rail (ZigCore.Canon.Order).");
}

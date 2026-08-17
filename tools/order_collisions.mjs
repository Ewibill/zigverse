/* =============================================================================
   tools/order_collisions.mjs — THE EVIDENCE FOR THE ORDERING CONTRACT
   (run: node tools/order_collisions.mjs [engineDir])

   Two collisions were named on 2026-08-17. This file proves both of them
   NUMERICALLY, against the shipped 0.45.0 engine, before any of it is changed.
   A contract argued from a reading of the source is an opinion; a contract
   argued from emitted WGSL is a measurement.

   COLLISION 1 · THE APPEND INVERSION (Ambience vs Radiance)
     Two laws that append after the SAME anchor execute in the REVERSE of the
     order they were applied in. Radiance appends after the fog line. Ambience
     must scatter BEFORE Radiance's tone remap or the veil compensation never
     reaches the medium's own glow. Whether it does is currently decided by
     which `if (LAW)` block sits higher in createFlock — build history.

   COLLISION 2 · THE FOUR-OWNER UNDERSIDE
     Four capabilities write the back face's colour `c`: FABRIC (0.29),
     MEMORY (0.27), NOTE FLASH (0.43), GEM (0.33). Two of them REPLACE `c`
     outright and two TINT it. Their sequence is the order they happen to sit
     in one template literal — which is neither version order nor any other
     principle. When a REPLACE lands after a TINT, the TINT is computed and
     thrown away, and nothing in the engine says so.
   ========================================================================== */
import { readFileSync } from "fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = process.argv[2] || path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const STUB = `
globalThis.__shaders = []; globalThis.__err = '';
globalThis.GPUBufferUsage = { UNIFORM:64, COPY_DST:8, STORAGE:128, COPY_SRC:4, VERTEX:32, INDEX:16, INDIRECT:256, MAP_READ:1 };
globalThis.GPUTextureUsage = { RENDER_ATTACHMENT:16, TEXTURE_BINDING:4, COPY_DST:2, COPY_SRC:1, STORAGE_BINDING:8 };
globalThis.GPUShaderStage = { VERTEX:1, FRAGMENT:2, COMPUTE:4 };
globalThis.GPUMapMode = { READ:1, WRITE:2 };
globalThis.__mkGpu = function () {
  const nul = () => ({ destroy() {}, createView: () => ({}) });
  const pipe = () => ({ getBindGroupLayout: () => ({}) });
  return { device: {
      createBuffer: nul, createTexture: nul, createSampler: () => ({}),
      createShaderModule: (d) => { globalThis.__shaders.push(d.code); return {}; },
      createBindGroupLayout: () => ({}), createPipelineLayout: () => ({}),
      createComputePipeline: pipe, createRenderPipeline: pipe,
      createBindGroup: () => ({}), createCommandEncoder: () => ({}),
      queue: { writeBuffer() {}, submit() {}, writeTexture() {} },
      limits: {}, features: { has: () => false }, destroy() {} },
    format: "bgra8unorm", canvas: { width: 1920, height: 1080 },
    ctx: {}, configure() {}, aspect: 16 / 9 };
};`;

function emit(dir, extra) {
  const ctx = vm.createContext({ console, Math, JSON, Float32Array, Uint32Array,
    Int32Array, Uint8Array, ArrayBuffer, Object, Array, String, Number, Boolean,
    Error, TypeError, Map, Set, isNaN, parseInt, parseFloat, performance, Date });
  vm.runInContext(STUB, ctx);
  for (const f of ["zigcore.js", "zigmesh.js", "zigwebgpu.js"])
    vm.runInContext(readFileSync(dir + "/engine/" + f, "utf8"), ctx, { filename: f });
  vm.runInContext(`
    const OPTS = {
      max: 20000, count: 6000, seed: 1234, extent: 60, extentY: 30, cell: 12, debris: 0,
      mesh: ZigMesh.make(ZigMesh.presets.sicklePetal, { refine: 1 })
    };
    Object.assign(OPTS, ${JSON.stringify(extra || {})});
    try { ZigWebGPU.createFlock(__mkGpu(), OPTS); } catch (e) { globalThis.__err = String(e).slice(0, 200); }
  `, ctx);
  return { shaders: vm.runInContext("__shaders", ctx), err: vm.runInContext("__err || ''", ctx) };
}

let FAIL = 0;
const ok = (b, s) => { console.log((b ? "  PROVEN  " : "  UNPROVEN") + " · " + s); if (!b) FAIL++; };

/* ---------------------------------------------------------------------------
   COLLISION 1 — the append inversion, shown with the engine's REAL anchor.
   No Ambience exists yet, so a stand-in block is spliced with exactly the
   idiom Radiance uses. The point is not what the block does; it is that the
   emitted ORDER flips when the application order flips.
   ------------------------------------------------------------------------ */
console.log("\nCOLLISION 1 · THE APPEND INVERSION  (Ambience vs Radiance)");
console.log("-".repeat(74));

const ANCHOR = "    col = mix(c, V.skyMid.rgb, clamp(inp.fog, 0.0, 0.92));";
const RAD_LINE = "\n    col = radiance(col, V.render6.w);";
const AMB_LINE = "\n    col = ambience(col, V.render7.x);";

const applyAfter = (src, anchor, line) => src.replace(anchor, anchor + line);

const base = "  /* fragment */\n" + ANCHOR + "\n  return vec4f(col, 1.0);\n";
const radFirst = applyAfter(applyAfter(base, ANCHOR, RAD_LINE), ANCHOR, AMB_LINE);
const ambFirst = applyAfter(applyAfter(base, ANCHOR, AMB_LINE), ANCHOR, RAD_LINE);

const seq = (s) => [["ambience", s.indexOf("ambience(")], ["radiance", s.indexOf("radiance(")]]
  .filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]).map(([n]) => n).join(" → ");

console.log("  applied radiance THEN ambience   → executes: " + seq(radFirst));
console.log("  applied ambience THEN radiance   → executes: " + seq(ambFirst));
ok(seq(radFirst) !== seq(ambFirst),
   "the emitted execution order INVERTS with the application order");
ok(seq(radFirst) === "ambience → radiance",
   "the CORRECT order (scatter before tone) requires applying radiance FIRST — the counter-intuitive one");

/* The engine uses BOTH idioms, which have OPPOSITE order semantics. */
const applyBefore = (src, anchor, line) => src.replace(anchor, line + anchor);
const bRadFirst = applyBefore(applyBefore(base, ANCHOR, RAD_LINE + "\n"), ANCHOR, AMB_LINE + "\n");
console.log("\n  the same two laws using the PREPEND idiom `.replace(A, block + A)`:");
console.log("  applied radiance THEN ambience   → executes: " + seq(bRadFirst));
ok(seq(bRadFirst) !== seq(radFirst),
   "APPEND and PREPEND give OPPOSITE order for the same application sequence");
console.log("  → order is a property of the IDIOM, not of the law. Both idioms are in use.");

/* ---------------------------------------------------------------------------
   COLLISION 2 — the four-owner underside, read out of emitted WGSL.
   ------------------------------------------------------------------------ */
console.log("\n\nCOLLISION 2 · THE FOUR-OWNER UNDERSIDE");
console.log("-".repeat(74));

const NACRE = { dark: [0.12, 0.115, 0.13], light: [0.92, 0.90, 0.88], moon: [0.55, 0.58, 0.72],
                iriBase: 0.55, iriBurst: 2.9, tex: [2, 18, 0.16, 26, 0.5, 0.15, 0.65, 0] };
const VELVET = { weave: "pile", wscale: 42, wdepth: 0.45, sheen: "retro", spow: 1.4,
                 sgain: 0.85, base: 0.55, col: [0.57, 0.02, 0.20] };
const AQUA = { col: [0.46, 0.88, 0.93], ior: 1.58, disp: 0.014, facet: 0.72, spark: 0.62 };

const ALL_FOUR = { material: NACRE, backFabric: VELVET, memoryBack: true,
                   noteFlash: true, bee: 1.45, gem: AQUA, gemFace: "inside" };

const { shaders, err } = emit(ROOT, ALL_FOUR);
if (err) console.log("  (init stopped: " + err + ")");
const render = shaders.find((s) => s.indexOf("fn birdFs(") >= 0) || "";
ok(render.length > 0, "the render module was emitted (" + render.length + " chars)");

/* Each owner's signature write, and whether it REPLACES c or TINTS it. */
const OWNERS = [
  { id: "fabric",    since: "0.29", mode: "REPLACE", mark: "c = fc;" },
  { id: "memory",    since: "0.27", mode: "TINT",    mark: "c = mix(c, memC, V.render4.w);" },
  { id: "noteflash", since: "0.43", mode: "TINT",    mark: "c = mix(c, ncol * (0.30 + 1.6 * lumn), nf * 0.80)" },
  { id: "gem",       since: "0.33", mode: "REPLACE", mark: "c = gc;" }
];
const found = OWNERS.map((o) => Object.assign({ at: render.indexOf(o.mark) }, o))
                    .filter((o) => o.at >= 0).sort((a, b) => a.at - b.at);

console.log("\n  emitted write order on the back face:");
for (let i = 0; i < found.length; i++) {
  const o = found[i];
  console.log("    " + (i + 1) + ". " + o.id.padEnd(10) + " (since " + o.since + ")  " +
              o.mode.padEnd(8) + "  at char " + o.at);
}
ok(found.length === 4, "all four owners write the back face in one fragment");

const versions = found.map((o) => o.since);
const sortedV = versions.slice().sort();
ok(JSON.stringify(versions) !== JSON.stringify(sortedV),
   "the write order is NOT version order — it is template position: " + versions.join(" → "));

/* The finding that matters: a REPLACE after a TINT discards the TINT. */
const lastReplace = found.filter((o) => o.mode === "REPLACE").pop();
const tintsKilled = found.filter((o) => o.mode === "TINT" && o.at < (lastReplace ? lastReplace.at : -1));
console.log("\n  last REPLACE is `" + (lastReplace ? lastReplace.id : "none") + "`; every earlier write to c is discarded on the back face.");
for (const t of tintsKilled)
  console.log("    DEAD · " + t.id + " (" + t.mode + " at " + t.at + ") is overwritten by " + lastReplace.id);
ok(tintsKilled.length > 0,
   tintsKilled.length + " underside writer(s) are computed and then DISCARDED with gemFace=inside");

/* And prove it is the composition, not the capability: each alone survives. */
const alone = emit(ROOT, { material: NACRE, memoryBack: true }).shaders.find((s) => s.indexOf("fn birdFs(") >= 0) || "";
ok(alone.indexOf("c = mix(c, memC, V.render4.w);") >= 0 && alone.indexOf("c = gc;") < 0,
   "MEMORY alone survives — the loss is caused by COMPOSITION, not by the law");

console.log("\n" + "=".repeat(74));
console.log(FAIL === 0
  ? "BOTH COLLISIONS PROVEN from emitted WGSL. Order is currently an accident\nof build history, and one composition silently discards work it computed."
  : FAIL + " claim(s) could not be proven — do not build the contract on them yet.");
process.exit(FAIL === 0 ? 0 : 1);

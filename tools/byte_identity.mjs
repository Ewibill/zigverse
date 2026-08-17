/* =============================================================================
   tools/byte_identity.mjs — THE CANON'S SECOND OBLIGATION, MECHANISED
   (run: node tools/byte_identity.mjs [baselineDir])

   CANON.md §2: "splice is SPLICED, not branched. When the law is off, the WGSL
   is not emitted at all — no dead uniform, no `if (0.0)`. The shader is
   byte-identical to the pre-law shader."

   That was a promise kept by reading diffs carefully. This makes it mechanical.
   Each engine is loaded in its OWN vm context — the modules are classic scripts
   that bind to globalThis, so a shared realm lets one silently overwrite the
   other and every comparison comes out equal for the wrong reason. createFlock
   is then driven with an identical opts object against a stub device, and every
   WGSL string handed to createShaderModule is captured, joined and hashed.

   Three runs, and the middle one is the whole point:
     baseline            — the previous release, untouched
     law ABSENT          — this release with the law not declared  → MUST MATCH
     law ON              — this release with the law declared      → MUST DIFFER

   The third run matters as much as the second: a law that is off when it should
   be off, and ALSO off when it should be on, passes an identity test perfectly.

   Why a stub device and not a real one: this proves what the compiler is HANDED,
   which is the thing the contract is about. Whether it then RUNS is a different
   gate — SwiftShader headless for compile, eyeZ for truth, tools/metal_gate.mjs
   for Metal.
   ========================================================================== */
import { readFileSync } from "fs";
import { createHash } from "crypto";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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

function run(dir, extra) {
  const ctx = vm.createContext({ console, Math, JSON, Float32Array, Uint32Array,
    Int32Array, Uint8Array, ArrayBuffer, Object, Array, String, Number, Boolean,
    Error, TypeError, Map, Set, isNaN, parseInt, parseFloat, performance, Date });
  vm.runInContext(STUB, ctx);
  for (const f of ["zigcore.js", "zigmesh.js", "zigwebgpu.js"])
    vm.runInContext(readFileSync(dir + "/engine/" + f, "utf8"), ctx, { filename: f });
  vm.runInContext(`
    const OPTS = {
      max: 20000, count: 6000, seed: 1234, extent: 60, extentY: 30, cell: 12, debris: 0,
      unseen: 0.33, onset: 0.7, noteFlash: true, bee: 1.45,
      contact: { r: 2.1, k: 45, damp: 4, max: 12 }, sepCap: { pair: 0.55, total: 3.2 },
      mesh: ZigMesh.make(ZigMesh.presets.sicklePetal, { refine: 1 })
    };
    Object.assign(OPTS, ${JSON.stringify(extra || {})});
    try { ZigWebGPU.createFlock(__mkGpu(), OPTS); } catch (e) { globalThis.__err = String(e).slice(0, 90); }
  `, ctx);
  return { shaders: vm.runInContext("__shaders", ctx), err: vm.runInContext("__err || ''", ctx) };
}

const BRIGHT = { radiance: { black: 0, gain: 1.7, gamma: 1.9, knee: 0.75, preset: "bright", version: "0.1.0" } };

/* THE MATRIX (added 2026-08-17 with the ordering contract).
   The original tool asked one question — "is the law off when it is off?" —
   against one option set. That is necessary and not sufficient. A REFACTOR
   (routing a law through Canon.Order instead of letting it splice itself)
   changes no behaviour and must therefore change no BYTE, in EVERY state the
   law can be in, not just the off one. So the tool now runs a matrix: each
   case is hashed on the baseline and on the current tree and the two must
   agree, unless the case is declared NEW (it exercises something the baseline
   does not have, so a difference is the point).

   The fourth case is the four-owner underside. It is here because it is the
   composition the ordering contract exists for, and any change to how those
   four laws compose must be a deliberate, visible diff. */
const NACRE  = { dark: [0.12, 0.115, 0.13], light: [0.92, 0.90, 0.88], moon: [0.55, 0.58, 0.72],
                 iriBase: 0.55, iriBurst: 2.9, tex: [2, 18, 0.16, 26, 0.5, 0.15, 0.65, 0] };
const VELVET = { weave: "pile", wscale: 42, wdepth: 0.45, sheen: "retro", spow: 1.4,
                 sgain: 0.85, base: 0.55, col: [0.57, 0.02, 0.20] };
const AQUA   = { col: [0.46, 0.88, 0.93], ior: 1.58, disp: 0.014, facet: 0.72, spark: 0.62 };

const CASES = [
  { label: "law ABSENT            ", extra: null },
  { label: "radiance=bright       ", extra: BRIGHT },
  { label: "radiance=white        ", extra: { radiance: { black: 0, gain: 0.55, gamma: 0.62, knee: 1e9, preset: "white", version: "0.1.0" } } },
  { label: "four-owner underside  ", extra: { material: NACRE, backFabric: VELVET, memoryBack: true,
                                              noteFlash: true, bee: 1.45, gem: AQUA, gemFace: "inside" } },
  { label: "underside + radiance  ", extra: Object.assign({ material: NACRE, backFabric: VELVET, memoryBack: true,
                                              noteFlash: true, bee: 1.45, gem: AQUA, gemFace: "inside" }, BRIGHT) }
];

/* The baseline tree: the release this change is measured against. Passed on
   the command line, because a hard-coded sandbox path is a gate that stops
   running the moment the sandbox is rebuilt — which is exactly what had
   happened to this file and to tools/splice_anchors.mjs. */
const BASE = process.argv[2] || null;
if (!BASE) {
  console.log("usage: node tools/byte_identity.mjs <baselineDir>");
  console.log("       (a checkout of the release this tree is measured against)");
  process.exit(2);
}

let fail = 0;
const hash = (a) => createHash("sha256").update(a).digest("hex").slice(0, 16);
console.log("baseline: " + BASE);
console.log("current : " + ROOT + "\n");
console.log("  case                     | baseline         | current          | verdict");
console.log("  " + "-".repeat(78));

const cur = {};
for (const c of CASES) {
  const b = run(BASE, c.extra), n = run(ROOT, c.extra);
  const bs = b.shaders.join("\n\u0000\n"), ns = n.shaders.join("\n\u0000\n");
  cur[c.label.trim()] = ns;
  const same = bs === ns;
  if (!same) fail++;
  console.log("  " + c.label + " | " + hash(bs) + " | " + hash(ns) + " | " +
    (same ? "IDENTICAL" : "DIFFERS by " + (ns.length - bs.length) + " chars"));
  if (b.err || n.err) console.log("      (init stopped: " + (b.err || n.err) + ")");
}

console.log();
console.log(fail === 0
  ? "PASS \u2014 every case is BYTE-IDENTICAL to the baseline. Composition was refactored,\n       not changed: the rail emits exactly the shader the hand splice did."
  : "FAIL \u2014 " + fail + " case(s) differ from the baseline. A refactor must change no bytes;\n       if the change is deliberate, declare the case NEW and say so in the log.");

/* The original two-sided assertion, kept: off must be off, and on must be on. */
const off = cur["law ABSENT"], on = cur["radiance=bright"];
const onOk = off !== on;
console.log(onOk
  ? "PASS \u2014 the law is absent when absent and PRESENT when declared (+" + (on.length - off.length) + " chars).\n       A law that is off when it should be on passes a one-sided test perfectly."
  : "FAIL \u2014 the law was requested and emitted nothing");
if (!onOk) fail++;
process.exit(fail === 0 ? 0 : 1);

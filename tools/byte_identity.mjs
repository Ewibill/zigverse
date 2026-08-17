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
const runs = [
  ["0.44.6 pristine       ", process.argv[2] || "/home/claude/pristine/zigverse-main", null],
  ["0.45.0 law ABSENT     ", ROOT, null],
  ["0.45.0 radiance=bright", ROOT, BRIGHT]
];
const out = [];
for (const [label, dir, extra] of runs) {
  const { shaders, err } = run(dir, extra);
  const all = shaders.join("\n\u0000\n");
  const h = createHash("sha256").update(all).digest("hex").slice(0, 16);
  out.push({ label, h, all, n: shaders.length, err });
  console.log(label, "| modules", String(shaders.length).padStart(2),
    "| chars", String(all.length).padStart(7), "| sha256", h,
    "| fn radiance()", all.indexOf("fn radiance(") >= 0 ? "PRESENT" : "absent",
    err ? "| (init stopped: " + err + ")" : "");
}
console.log();
const same = out[0].all === out[1].all;
console.log(same
  ? "PASS — 0.45.0 with the law ABSENT is BYTE-IDENTICAL to 0.44.6 (" + out[0].all.length + " chars, same hash)"
  : "FAIL — the law changed the shader while switched off");
const grew = out[2].all.length - out[1].all.length;
console.log(out[2].all !== out[1].all
  ? "PASS — with radiance=bright the shader differs by exactly " + grew + " chars of spliced WGSL"
  : "FAIL — the law was requested and emitted nothing");
process.exit(same && out[2].all !== out[1].all ? 0 : 1);

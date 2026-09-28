/* =============================================================================
   test/nature_ref.mjs — NATURE (v5.8 · 2026-09-28)   (run: node test/nature_ref.mjs)
   MASS showed inertia was the biggest missing piece of "alive". NATURE adds the
   laws the kernel was still breaking, each established physics or biology:
   variation, reaction delay, a heading apart from the velocity, gliding blades,
   and currents that actually push. Proves the law (ZigCore.Nature) on the CPU,
   then that the WGSL the engine is handed says the same thing.
   ========================================================================== */
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (f) => fs.readFileSync(path.join(ROOT, "engine", f), "utf8");
let bad = 0;
const chk = (name, ok, extra) => { console.log((ok ? "  PASS " : "  FAIL ") + name + (extra ? "  (" + extra + ")" : "")); if (!ok) bad++; };
const G = {}; new Function("window", src("zigcore.js"))(G);
const N = G.ZigCore.Nature, P = N && N.presets.natural;
chk("ZigCore.Nature exists with the natural preset", !!P);

/* VARIATION */
let sum = 0, lo = 9, hi = 0; for (let i = 0; i < 6000; i++) { const f = N.factor(i, P.vary); sum += f; lo = Math.min(lo, f); hi = Math.max(hi, f); }
chk("variation: every individual differs, the crowd averages ~1", Math.abs(sum / 6000 - 1) < 0.02 && hi / lo > 1.25, "mean " + (sum / 6000).toFixed(3) + ", range " + lo.toFixed(2) + ".." + hi.toFixed(2));
chk("variation: fixed per individual (deterministic)", N.factor(42, P.vary) === N.factor(42, P.vary));

/* DELAY: a step in steering reaches ~63% after one time constant */
const tau = N.tauOf(3, P.tau); let a = [0, 0, 0]; const dt = 1 / 600;
for (let t = 0; t < tau - 1e-9; t += dt) a = N.lag(a, [1, 0, 0], dt, tau);
chk("delay: an individual reacts over its own time constant (63% at tau)", Math.abs(a[0] - 0.632) < 0.03, "tau " + (tau * 1000).toFixed(0) + " ms -> " + a[0].toFixed(3));
let tmin = 9, tmax = 0; for (let i = 0; i < 2000; i++) { const t = N.tauOf(i, P.tau); tmin = Math.min(tmin, t); tmax = Math.max(tmax, t); }
chk("delay: reaction times differ across the crowd (0.6..1.4 x)", tmin < P.tau * 0.65 && tmax > P.tau * 1.35, (tmin * 1000).toFixed(0) + ".." + (tmax * 1000).toFixed(0) + " ms");

/* HEADING: weathervanes toward the motion, faster when fast */
const turnT = (sp) => { let h = [1, 0, 0]; for (let t = 0; t < 10; t += 1 / 120) { h = N.align(h, [0, 0, sp], 1 / 120, P.align); if (h[2] > 0.7071) return t; } return 99; };
const tFast = turnT(6), tSlow = turnT(0.6);
chk("heading: a fast body swings to its motion quickly, a slow one drifts", tFast < 0.2 && tSlow > 3 * tFast, "fast " + tFast.toFixed(2) + " s, slow " + tSlow.toFixed(2) + " s");
chk("heading stays a unit vector", Math.abs(Math.hypot(...N.align([1, 0, 0], [0, 3, 1], 0.05, P.align)) - 1) < 1e-9);

/* GLIDE: sideways is damped hard, forward barely; lift never creates speed */
const h0 = [1, 0, 0];
let vs = [0, 0, 4]; for (let t = 0; t < 0.5; t += 1 / 120) vs = N.glide(vs, h0, 1 / 120, P.cPar, P.cPerp, P.glide);
let vf = [4, 0, 0]; for (let t = 0; t < 0.5; t += 1 / 120) vf = N.glide(vf, h0, 1 / 120, P.cPar, P.cPerp, P.glide);
chk("glide: half a second broadside loses most of the sideways speed", Math.abs(vs[2]) < 4 * 0.35, "4 -> " + Math.abs(vs[2]).toFixed(2));
chk("glide: along the blade it barely slows", vf[0] > 3.85, "4 -> " + vf[0].toFixed(2));
chk("glide: part of the lost sideways speed became forward (lift)", vs[0] > 0.3, "forward gained " + vs[0].toFixed(2));
let worst = 0; for (let k = 0; k < 500; k++) { const v = [Math.sin(k) * 5, Math.cos(k * 1.3) * 3, Math.sin(k * 0.7) * 4]; const s0 = Math.hypot(...v), o = N.glide(v, h0, 1 / 60, P.cPar, P.cPerp, P.glide); worst = Math.max(worst, Math.hypot(...o) - s0); }
chk("glide: lift redirects, never creates (no speed gain in 500 random cases)", worst <= 1e-9, "worst " + worst.toExponential(1));

/* SLIP: a sideways kick - the body keeps its heading a moment and slips */
{ let h = [1, 0, 0], v = [4, 0, 3], slipT = 0;
  for (let t = 0; t < 1; t += 1 / 120) { h = N.align(h, v, 1 / 120, P.align); v = N.glide(v, h, 1 / 120, P.cPar, P.cPerp, P.glide);
    const sp = Math.hypot(...v), ang = Math.acos(Math.min(1, (h[0] * v[0] + h[1] * v[1] + h[2] * v[2]) / sp)); if (ang > 0.17) slipT += 1 / 120; }
  chk("slip: after a sideways kick the body visibly points away from its motion for a moment", slipT > 0.05 && slipT < 0.6, (slipT * 1000).toFixed(0) + " ms over 10 deg"); }

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
function shaders(extra, material) {
  const ctx = vm.createContext({ console, Math, JSON, Float32Array, Uint32Array, Int32Array, Uint8Array, ArrayBuffer,
    Object, Array, String, Number, Boolean, Error, TypeError, Map, Set, isNaN, parseInt, parseFloat, performance, Date });
  vm.runInContext(STUB, ctx);
  for (const f of ["zigcore.js", "zigmesh.js", "zigwebgpu.js"]) vm.runInContext(src(f), ctx, { filename: f });
  const NACRE = { dark: [0.12, 0.115, 0.13], light: [0.92, 0.90, 0.88], moon: [0.55, 0.58, 0.72],
                  iriBase: 0.55, iriBurst: 2.9, tex: [2, 18, 0.16, 26, 0.5, 0.15, 0.65, 0] };
  vm.runInContext(`
    const OPTS = { max: 20000, count: 6000, seed: 1234, extent: 60, extentY: 30, cell: 12, debris: 0, noteFlash: true, bee: 1.45,
      mesh: ZigMesh.make(ZigMesh.presets.sicklePetal, { refine: 1 }) };
    if (${JSON.stringify(!!(extra && extra.__flow))}) { OPTS.flow = ZigWebGPU.createFlow(__mkGpu(), { extent: 60, extentY: 30, cell: 8 }); }
    Object.assign(OPTS, ${JSON.stringify(extra || {})});
    ${material ? "OPTS.material = " + JSON.stringify(NACRE) + ";" : ""}
    try { ZigWebGPU.createFlock(__mkGpu(), OPTS); } catch (e) { globalThis.__err = String(e).slice(0, 160); }
  `, ctx);
  return { all: vm.runInContext("__shaders", ctx).join("\n\u0000\n"), err: vm.runInContext("__err || ''", ctx) };
}
const base = shaders(null), nat = shaders({ nature: N.resolve("natural") }), natF = shaders({ nature: N.resolve("natural"), __flow: 1 });
const baseF = shaders({ __flow: 1 });
chk("engine builds with NATURE (with and without the flow field)", !nat.err && !natF.err, nat.err || natF.err);
chk("NATURE absent: nothing of it in any shader", !base.all.includes("NATURE") && !baseF.all.includes("NATURE"));
const stepOf = (all) => all.split("\n\u0000\n").find((m) => m.includes("fn step(")) || "";
const sF = stepOf(natF.all), sB = stepOf(baseF.all);
chk("classic: the flow push sits AFTER the integrate (it only tilted the bank)", sB.indexOf("accel += (flowAt(p) - v) * FL.par.w;") > sB.indexOf("v += accel * U.dt;"));
chk("natural: the flow push moves BEFORE the integrate, exactly once",
  sF.split("accel += (flowAt(p) - v) * FL.par.w;").length === 2 && sF.indexOf("accel += (flowAt(p) - v) * FL.par.w;") < sF.indexOf("v += accel * U.dt;"));
chk("natural: variation, delay, heading and glide are in the step kernel",
  sF.includes("accel = accel / (1.0 + 0.3000 * (natH - 0.5));") && sF.includes("accel = accLag;") && sF.includes("natHd = normalize(") && sF.includes("lift redirects, never creates"));
chk("natural: body state is written past the velocities (heading at MAX, steering at 2 MAX)", sF.includes("velOut[20000u + i] = vec4f(natHd, 0.0);") && sF.includes("velOut[40000u + i] = vec4f(accLag, 0.0);"));
chk("natural: the shard is drawn along its heading", nat.all.includes("let hd = vel[20000u + ii].xyz;"));
chk("no new binding: the same @binding set as classic",
  JSON.stringify([...new Set(baseF.all.match(/@binding\(\d+\)/g))].sort()) === JSON.stringify([...new Set(natF.all.match(/@binding\(\d+\)/g))].sort()));
const M = G.ZigCore.Mass;
const all3 = shaders({ nature: N.resolve("natural"), mass: M.resolve("stone"), solid: { sun: [0.35, 0.62, -0.30], r: 2.25 }, __flow: 1 });
chk("composes with MASS stone + SOLID + flow", !all3.err && all3.all.includes("MASS: a = F / m") && all3.all.includes("velOut[i] = vec4f(v, bank + 4.0 * occQ);") && all3.all.includes("accel = accLag;"), all3.err);
const Z = fs.readFileSync(path.join(ROOT, "engine", "zigwebgpu.js"), "utf8"), S = fs.readFileSync(path.join(ROOT, "species", "sickleswarm.js"), "utf8"), H = fs.readFileSync(path.join(ROOT, "zigverse_engine.html"), "utf8");
chk("the velocity buffers are three regions long only under NATURE", Z.includes("const VELN = NATURE ? 3 : 1;") && Z.includes("size: MAX * f4 * VELN"));
chk("STILLNESS listens to the performer's live breath; NATURE acts as glass", S.includes("const alive = Math.min(1, state.liveBreath * 2.2") && S.includes("const STILL_EFF = NATURE_OPT ? 1 : STILLNESS;"));
chk("the HUD always shows SOLO or ALIVE", S.includes('(solo ? "SOLO" : "ALIVE")'));
chk("host: NATURE dropdown classic / natural, reloads, rides the address", H.includes('id="naturepick"') && H.includes('fill(nasel, ["classic", "natural"]') && H.includes('"&nature="'));
console.log("\n" + (bad ? `FAIL — ${bad} check(s)` : "PASS — all checks"));
process.exit(bad ? 1 : 0);

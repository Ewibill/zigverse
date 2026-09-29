/* =============================================================================
   test/swell_ref.mjs — SWELL + the Bee's charisma (v5.9 · 2026-09-28)
   (run: node test/swell_ref.mjs)
   Bill: "steal from nature to make viewers feel familiarity and mystery at the
   same time." SWELL borrows the ocean's GRAMMAR (orbits, depth, dispersion,
   sets, breaking) and none of its look. Plus: the Bee's glow now follows her
   attention, and her pull on the field is performance, never divided by mass.
   ========================================================================== */
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (f) => fs.readFileSync(path.join(ROOT, "engine", f), "utf8");
let bad = 0;
const chk = (name, ok, extra) => { console.log((ok ? "  PASS " : "  FAIL ") + name + (extra ? "  (" + extra + ")" : "")); if (!ok) bad++; };
const G = {}; new Function("window", src("zigcore.js"))(G);
const W = G.ZigCore.Swell, S = W.resolve("swell", 74), SS = W.resolve("sets", 74);
chk("ZigCore.Swell exists with swell and sets", !!(S && SS));

/* ORBITS: over one period of a single train, a shard traces a closed loop and goes nowhere */
{ const one = { name: "one", surf: 74, spray: 9, trains: [S.trains[0]] }, T = 2 * Math.PI / one.trains[0].w;
  const p = [5, 74, 3]; let mx = 0, my = 0, n = 0, ymin = 9, ymax = -9;
  for (let t = 0; t < T; t += T / 200) { const d = W.displace(one, p, t, 1, 0); mx += d[0]; my += d[1]; n++; ymin = Math.min(ymin, d[1]); ymax = Math.max(ymax, d[1]); }
  chk("orbits: a shard circles in place - no net travel over a period", Math.abs(mx / n) < 0.05 && Math.abs(my / n) < 0.05, "mean drift " + (mx / n).toFixed(3) + ", " + (my / n).toFixed(3));
  chk("orbits: ...and the circle is the wave's height", Math.abs((ymax - ymin) / 2 - one.trains[0].A) < 0.05, "radius " + ((ymax - ymin) / 2).toFixed(2));
  /* the SHAPE travels: the crest moves along the wave direction at c = w / k */
  const c = one.trains[0].w / one.trains[0].k;
  chk("the shape travels while the shards stay: crest speed c = w / k", c > 5 && c < 12, "c = " + c.toFixed(2) + " units/s"); }

/* DEPTH: orbits shrink with depth, never vanish */
{ const top = W.displace(S, [0, 74, 0], 1.3, 1, 0), deep = W.displace(S, [0, 44, 0], 1.3, 1, 0);
  const a = (d) => Math.hypot(d[0], d[1], d[2]);
  let rTop = 0, rDeep = 0; for (let t = 0; t < 20; t += 0.1) { rTop = Math.max(rTop, a(W.displace(S, [0, 74, 0], t, 1, 0))); rDeep = Math.max(rDeep, a(W.displace(S, [0, 44, 0], t, 1, 0))); }
  chk("depth: the top of the field rides, the deep only stirs", rDeep < rTop * 0.5 && rDeep > rTop * 0.1, "top " + rTop.toFixed(2) + ", 30 below " + rDeep.toFixed(2)); }

/* DISPERSION: long waves outrun short ones (deep water, c = sqrt(g/k)) */
{ const c = S.trains.map((w) => w.w / w.k);
  chk("dispersion: the longest wave is the fastest", c[0] > c[1] && c[1] > c[2], c.map((x) => x.toFixed(2)).join(" > "));
  chk("dispersion: omega = sqrt(g k) exactly", S.trains.every((w) => Math.abs(w.w - Math.sqrt(W.G * w.k)) < 1e-12)); }

/* SETS: waves arrive in groups - the envelope rises and falls far more under sets */
{ const env = (SW) => { const hs = []; for (let t = 0; t < 400; t += 0.25) hs.push(W.displace(SW, [0, 74, 0], t, 1, 0)[1]);
    const win = 24, pk = []; for (let i = 0; i + win < hs.length; i += win) pk.push(Math.max(...hs.slice(i, i + win)));
    return Math.max(...pk) / Math.max(0.05, Math.min(...pk)); };
  const eS = env(S), eSS = env(SS);
  chk("sets: calm, a set, calm - the peak height swings strongly over time", eSS > 3, "loudest / quietest 6 s window " + eSS.toFixed(1)); }

/* BREAKING: only steep crests throw spray, and only some shards */
{ let br = 0, n = 0, brQuiet = 0;
  for (let t = 0; t < 120; t += 0.2) for (let h = 0; h < 1; h += 0.1) { n++;
    const base = W.displace(S, [0, 74, 0], t, 1, 0)[1], d = W.displace(S, [0, 74, 0], t, 1, h)[1]; if (d > base + 1e-9) br++;
    const bq = W.displace(S, [0, 74, 0], t, 0.4, 0)[1], dq = W.displace(S, [0, 74, 0], t, 0.4, h)[1]; if (dq > bq + 1e-9) brQuiet++; }
  chk("breaking: a full sea throws spray from a few shards at steep crests", br > 0 && br < n * 0.25, br + " of " + n + " samples");
  chk("breaking: a quiet sea never breaks", brQuiet === 0); }
chk("energy 0 = a flat sea (the swell lies down in silence)", W.displace(S, [3, 70, 1], 5, 0, 0.9).slice(0, 3).every((x) => x === 0));

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

const base = shaders(null), sw = shaders({ swell: S }), ss = shaders({ swell: SS });
chk("engine builds with SWELL swell and sets", !sw.err && !ss.err, sw.err || ss.err);
chk("SWELL absent: not one character of it", !base.all.includes("swellAt"));
chk("SWELL moves where the shard is DRAWN, never its physics body",
  sw.all.includes("swp += swellAt(p,") && !(sw.all.split("\n\u0000\n").find((m) => m.includes("fn step(")) || "").includes("swellAt"));
chk("SWELL reads energy and phase from noteBands[5]", sw.all.includes("let E = V.noteBands[5].x; let t = V.noteBands[5].y;"));
chk("sets bakes five trains, swell three", (ss.all.match(/let th = /g) || []).length === 5 && (sw.all.match(/let th = /g) || []).length === 3);
chk("no new binding", JSON.stringify([...new Set(base.all.match(/@binding\(\d+\)/g))].sort()) === JSON.stringify([...new Set(sw.all.match(/@binding\(\d+\)/g))].sort()));

/* THE BEE: her pull is performance, never divided by mass or delayed */
const M = G.ZigCore.Mass, N = G.ZigCore.Nature;
const bee = shaders({ presence: { mode: "cozy" }, mass: M.resolve("stone"), nature: N.resolve("natural"), swell: S, solid: { sun: [0.35, 0.62, -0.3], r: 2.25 }, __flow: 1 });
const stepB = bee.all.split("\n\u0000\n").find((m) => m.includes("fn step(")) || "";
chk("everything together builds (Bee + stone + natural + swell + solid + flow)", !bee.err, bee.err);
chk("her pull is captured apart from the physics and added AFTER the integrate at full strength",
  stepB.includes("let accPre = accel;") && stepB.includes("let accPerf = accel - accPre; accel = accPre;") && stepB.indexOf("v += accPerf * U.dt;") > stepB.indexOf("v += accel * (U.dt * select("));
chk("the Bee herself steers at m = 1, with no variation, no delay and no weight",
  stepB.includes("select(0.33333, 1.0, i32(U.avatarA.x) == i32(i))") && stepB.includes("if (!natMe) { accel = accLag; }") && stepB.includes("if (!(i32(U.avatarA.x) == i32(i))) {   /* MASS: weight"));
const noMass = shaders({ presence: { mode: "cozy" } });
chk("without MASS or NATURE the Bee's physics is exactly as before", !noMass.all.includes("accPerf"));
const SP = fs.readFileSync(path.join(ROOT, "species", "sickleswarm.js"), "utf8"), H = fs.readFileSync(path.join(ROOT, "zigverse_engine.html"), "utf8");
chk("her glow follows her attention (V sets how far it rises); Bee off = the old beacon",
  SP.includes("(BEE > 0 ? (dial.mark === 0 ? 0 : (0.9 + 2.6 * beeAttn) * (dial.mark === 2 ? 1 : 0.6))") && SP.includes(": [0, 0.9, 3.0][dial.mark]);"));
chk("breath is the wind: the sea builds over seconds, lies down slower, never below its floor in ALIVE",
  SP.includes("const want = (solo ? 0 : 0.2) + 0.8 * state.liveBreath;") && SP.includes("(want > swellE ? 2.5 : 6.0)"));
chk("SWELL is refused alongside MELODIC STRATA / RELAY (they share noteBands)", SP.includes("global.ZIG_SWELL && !STRATA_ON && !RELAY_ON"));
chk("host: SWELL dropdown off / swell / sets, reloads, rides the address", H.includes('id="swellpick"') && H.includes('fill(swsel, ["off", "swell", "sets"]') && H.includes('"&swell="'));
console.log("\n" + (bad ? `FAIL — ${bad} check(s)` : "PASS — all checks"));
process.exit(bad ? 1 : 0);

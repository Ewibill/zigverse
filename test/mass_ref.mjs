/* =============================================================================
   test/mass_ref.mjs — MASS + SOLID + GOD RAYS OFF (v5.7 · 2026-09-27)
   (run: node test/mass_ref.mjs)

   Bill: "the shards feel more like they are hollow ... more like objects than
   foil shapes." The eye reads weight from MOTION first, so MASS is Newton:
   a = F/m on every force (drag included) plus a weight that settles in silence
   and that breath lifts. This proves the LAW on the CPU (ZigCore.Mass), then
   proves the WGSL the engine is HANDED says the same thing (a stub device
   captures every shader string, as tools/byte_identity.mjs does).
     A  turning     heavier = wider arc: stone takes ~3x as long to turn 90 deg
     B  a strike    the same blow moves stone ~1/3 as far
     C  coasting    once moving, drag takes ~m times as long to slow it
     D  weight      silence settles it `sink` below the roost; full breath = none
     E  the kernel  stone bakes dt/3, drag/3 and the sink; absent = no splice
     F  SOLID       occlusion packs into velocity.w above the bank and decodes
                    exactly; the terminator is firm; nothing new is BOUND
     G  god rays    godRays:false removes the shafts only, never the ember
   ========================================================================== */
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = (f) => fs.readFileSync(path.join(ROOT, "engine", f), "utf8");

let bad = 0;
const chk = (name, ok, extra) => { console.log((ok ? "  PASS " : "  FAIL ") + name + (extra ? "  (" + extra + ")" : "")); if (!ok) bad++; };

const G = {}; new Function("window", src("zigcore.js"))(G);
const M = G.ZigCore.Mass;
chk("ZigCore.Mass exists with feather / wood / stone", !!(M && M.presets.feather && M.presets.wood && M.presets.stone));

/* A — turning: a shard cruising at speed 8 is steered by a constant lateral
   force toward a heading 90 deg away (the flock's alignment pull, in miniature).
   Its heading IS its velocity, so the time to turn is the time for v to swing. */
function turnTime(m) {
  let v = [8, 0, 0]; const dt = 1 / 120;
  for (let t = 0; t < 30; t += dt) {
    const sp = Math.hypot(v[0], v[2]); const want = [0, 0, 8];
    const a = [(want[0] - v[0]) * 3, 0, (want[2] - v[2]) * 3];      // steer toward the new heading
    v = M.integrate(v, a, dt, m, 0);
    const s2 = Math.hypot(v[0], v[2]); if (s2 > 0) { v[0] *= 8 / s2; v[2] *= 8 / s2; }   // the speed band holds its cruise
    if (Math.atan2(v[2], v[0]) > Math.PI / 4) return t;              // halfway round
  }
  return 99;
}
const t1 = turnTime(1), tS = turnTime(M.presets.stone.m), tF = turnTime(M.presets.feather.m), tW = turnTime(M.presets.wood.m);
chk("A  stone turns ~3x slower than today (m = 1)", Math.abs(tS / t1 - 3) < 0.25, "today " + t1.toFixed(3) + " s, stone " + tS.toFixed(3) + " s");
chk("A  the order is feather < today < wood < stone", tF < t1 && t1 < tW && tW < tS, [tF, t1, tW, tS].map((x) => x.toFixed(3)).join(" < "));

/* B — a strike: 0.1 s of a 40-unit shove in water (drag 0.9). The blow gives
   stone a third of the speed; it then coasts longer (C), so over a full second
   it still travels well under half as far. (First cut asserted "a third as far"
   over the second - the coast is real physics and made that wrong.) */
function strike(m, T) {
  let v = [0, 0, 0], x = 0; const dt = 1 / 120;
  for (let t = 0; t < T - 1e-9; t += dt) { v = M.integrate(v, [t < 0.1 ? 40 : 0, 0, 0], dt, m, 0.9); x += v[0] * dt; }
  return [v[0], x];
}
const [v1] = strike(1, 0.1), [vS] = strike(M.presets.stone.m, 0.1);
chk("B  the same blow gives stone a third of the speed", Math.abs(vS / v1 - 1 / 3) < 0.02, "today " + v1.toFixed(2) + ", stone " + vS.toFixed(2));
const s1 = strike(1, 1)[1], sS = strike(M.presets.stone.m, 1)[1];
chk("B  ...and a second later it has moved under half as far", sS / s1 < 0.5, "today " + s1.toFixed(2) + ", stone " + sS.toFixed(2));

/* C — coasting: moving at 10 with drag 0.9 and no force, time to halve */
function halfLife(m) { let v = [10, 0, 0]; const dt = 1 / 120; for (let t = 0; t < 60; t += dt) { v = M.integrate(v, [0, 0, 0], dt, m, 0.9); if (v[0] < 5) return t; } return 99; }
const h1 = halfLife(1), hS = halfLife(M.presets.stone.m);
chk("C  stone coasts ~3x longer before it has lost half its speed", Math.abs(hS / h1 - 3) < 0.1, h1.toFixed(2) + " s vs " + hS.toFixed(2) + " s");

/* D — weight: the roost target */
const st = M.presets.stone;
chk("D  in silence stone settles `sink` below the roost", Math.abs(M.targetY(62, 0, 10, st.sink) - (62 - st.sink)) < 1e-9, "roost 62 -> " + M.targetY(62, 0, 10, st.sink));
chk("D  full breath lifts it back to exactly today's height", Math.abs(M.targetY(62, 1, 10, st.sink) - 72) < 1e-9);
chk("D  half breath is half the sink", Math.abs(M.targetY(62, 0.5, 10, st.sink) - (62 + 5 - st.sink / 2)) < 1e-9);
chk("D  feather has no weight to settle", M.presets.feather.sink === 0 && M.presets.feather.w === 0);
/* D2 - WEIGHT as its own force (eyeZ 2026-09-27: moving only the roost TARGET
   shifted stone 0.5 units in 12 s). Vertical only, water drag 0.9/m, plus a
   stiff stand-in (1.5/s) for everything else that couples a shard to its
   neighbours and the water - the thing that swallowed the target-only law. */
function vertical(m, w, sink, breathAt, T) {
  let y = 62, vy = 0; const dt = 1 / 120;
  for (let t = 0; t < T; t += dt) {
    const b = breathAt(t);
    vy = M.integrate([0, vy, 0], [0, -1.5 * vy, 0], dt, m, 0.9)[1];
    vy = M.fall(vy, y, 62, b, w, sink, dt);
    y += vy * dt;
  }
  return y;
}
const ySil = vertical(st.m, st.w, st.sink, () => 0, 12);
chk("D2 in 12 s of silence stone settles onto its bed, about `sink` below", ySil < 62 - st.sink + 3 && ySil > 62 - st.sink - 3, "62 -> " + ySil.toFixed(1));
const yUp = vertical(st.m, st.w, st.sink, (t) => (t < 12 ? 0 : 1), 21);
chk("D2 nine seconds of full breath lifts it home to the roost", Math.abs(yUp - 62) < 3, "-> " + yUp.toFixed(1));
const yOver = vertical(st.m, st.w, st.sink, () => 1, 20);
chk("D2 breath brings it home with only a small float past the roost (< 3 units)", yUp < 65 && yOver < 63, "after lift " + yUp.toFixed(2) + ", held from the roost " + yOver.toFixed(2));
const yHigh = (() => { let y = 80, vy = 0; for (let t = 0; t < 3; t += 1 / 120) { vy = M.fall(vy, y, 62, 1, st.w, st.sink, 1 / 120); y += vy / 120; } return y; })();
chk("D2 with breath, a shard ABOVE the roost is left alone (the field keeps its volume)", Math.abs(yHigh - 80) < 1e-9, yHigh.toFixed(2));
chk("D2 weight is gravity-like: not divided by the mass", /fall\(vy, y, anchorY, breath, w, sink, dt\) \{\s*const down = w \* \(1 - breath\);/.test(fs.readFileSync(path.join(ROOT, "engine", "zigcore.js"), "utf8")));

/* E–G — what the GPU is handed */
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
    Object.assign(OPTS, ${JSON.stringify(extra || {})});
    ${material ? "OPTS.material = " + JSON.stringify(NACRE) + ";" : ""}
    try { ZigWebGPU.createFlock(__mkGpu(), OPTS); } catch (e) { globalThis.__err = String(e).slice(0, 160); }
  `, ctx);
  return { all: vm.runInContext("__shaders", ctx).join("\n\u0000\n"), err: vm.runInContext("__err || ''", ctx) };
}
const base = shaders(null), stone = shaders({ mass: M.resolve("stone") });
chk("E  engine builds with MASS stone", !stone.err, stone.err);
chk("E  a = F/m: the integrate is baked with dt/3", stone.all.includes("v += accel * (U.dt * 0.33333);"));
chk("E  drag is a force too: divided by the same mass", /v \*= \(1\.0 - U\.dt \* \([^;]*\) \* 0\.33333\);/.test(stone.all));
chk("E  the roost is lowered by the sink in silence", stone.all.includes("- 14.000 * (1.0 - U.morph.w);"));
chk("E  the weight block is baked (w 4, bed = roost - 14)", stone.all.includes("let wDown = 4.000 * (1.0 - U.morph.w);") && stone.all.includes("let bed = U.anchor.y - 14.000;"));
chk("E  weight reads the LIVE breath lane (morph.w), never the idle auto-breath", !/wDown[^\n]*U\.breath/.test(stone.all) && stone.all.includes("let wUp = U.morph.w *"));
chk("E  the species feeds morph.w only from the performer (live or B/touch), 0 when idle",
  fs.readFileSync(path.join(ROOT, "species", "sickleswarm.js"), "utf8").includes("state.liveBreath = (ZC.Perf.live || ZC.Perf._sim > 0) ? ZC.Perf.breath : 0;")
  && fs.readFileSync(path.join(ROOT, "engine", "zigwebgpu.js"), "utf8").includes("simArr[211] = MASS ? (state.liveBreath || 0) : (state.drift || 0);"));
chk("E  feather carries no weight block", !shaders({ mass: M.resolve("feather") }).all.includes("wDown"));
chk("E  MASS absent: no mass text anywhere", !base.all.includes("MASS:") && base.all.includes("  v += accel * U.dt;"));

const sol = shaders({ solid: { sun: [0.35, 0.62, -0.30], r: 2.25 } });
const solM = shaders({ solid: { sun: [0.35, 0.62, -0.30], r: 2.25 } }, true);
chk("F  engine builds with SOLID (plain and under a material skin)", !sol.err && !solM.err, sol.err || solM.err);
chk("F  compute writes the shade above the bank; both readers decode it",
  sol.all.includes("velOut[i] = vec4f(v, bank + 4.0 * occQ);") && sol.all.includes("var bank = velIn[i].w - 4.0 * round(velIn[i].w / 4.0);")
  && sol.all.includes("let p = P.xyz; let bank = Vl.w - 4.0 * occQ;"));
chk("F  no new binding: the same @binding set as without SOLID",
  JSON.stringify([...new Set(base.all.match(/@binding\(\d+\)/g))].sort()) === JSON.stringify([...new Set(sol.all.match(/@binding\(\d+\)/g))].sort()));
chk("F  the shade varying sits ABOVE near (MATERIAL's anchor intact)", /@location\(12\) occ: f32,[^\n]*\n  @location\(9\) near: f32,/.test(solM.all) && solM.all.includes("@location(10) snw"));
chk("F  material skin: terminator + shade per pixel, bevel exactly once",
  solM.all.includes("let matShade = smoothstep(0.46, 0.71, mshade0) * (1.0 - 0.8 * inp.occ);") && (solM.all.match(/SOLID: a bevelled rim/g) || []).length === 1);
chk("F  plain shading: bevel exactly once", (sol.all.match(/SOLID: a bevelled rim/g) || []).length === 1);
/* the packing, exactly as the kernel does it (f32) */
let worst = 0;
for (let b = -1.25; b <= 1.25; b += 0.01) for (let q = 0; q <= 8; q++) {
  const w = Math.fround(b + 4 * q), qq = Math.round(w / 4), bb = Math.fround(w - 4 * qq);
  if (qq !== q) worst = 99; else worst = Math.max(worst, Math.abs(bb - b));
}
chk("F  bank + 4q decodes exactly for every bank and all 9 shade steps", worst < 1e-5, "worst bank error " + worst.toExponential(1));
/* the terminator: today's half-Lambert never lets the dark side go dark */
const today = (d) => (d * 0.5 + 0.5) ** 2, ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const solidS = (d) => ss(-0.08, 0.42, d);
chk("F  facing away from the moon: today 0.06 light, SOLID 0", today(-0.5) > 0.05 && solidS(-0.5) === 0, "today " + today(-0.5).toFixed(3));
chk("F  the light-to-shadow change is ~3x sharper at the terminator", (solidS(0.2) - solidS(0.1)) / (today(0.2) - today(0.1)) > 2.5);

const noG = shaders({ godRays: false });
chk("G  god rays off: every shaft term reads 0.0, not the ember", !noG.all.includes("ripple * V.render2.y") && noG.all.includes("ripple * 0.0"));
chk("G  ...and her ember and beacon still read render2.y", noG.all.includes("select(0.0, V.render2.y, isAvatar)") && noG.all.includes("min(V.render2.y, 3.0)"));
chk("G  godRays absent: the shafts are exactly as before", base.all.includes("ripple * V.render2.y") && !base.all.includes("ripple * 0.0"));

console.log("\n" + (bad ? `FAIL — ${bad} check(s)` : "PASS — all checks"));
process.exit(bad ? 1 : 0);

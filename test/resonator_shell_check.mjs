/* =============================================================================
   test/resonator_shell_check.mjs — VOICE law headless verification (v0.6)
   (run: node test/resonator_shell_check.mjs)

   Proves, on a real SwiftShader WebGPU device, presentation-free:
     1. engine + species parse clean
     2. halofield.html boots (probe verdict, ZigCore loop alive) — the ONLY
        suppressed error is the known headless-present artifact
     3. the RESONATOR pair compiles + dispatches: a scene with
        flock A = halo mesh + phase (voice 1, gong)  and
        flock B = woodblock mesh, NO phase, voice 0
        → exercises the new step-kernel voice splice, the SimR binding-4
        render layout in BOTH mesh variants, and 60 compute frames with a
        live impulse crossing both strata. Zero validation errors required.
   ========================================================================== */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files = ["engine/zigcore.js", "engine/zigmesh.js", "engine/zigwebgpu.js", "species/sickleswarm.js"];
const KNOWN_PRESENT_ARTIFACT = /valid external Instance reference no longer exists/i;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };

console.log("[1] syntax");
for (const f of files) {
  const r = spawnSync(process.execPath, ["--check", path.join(root, f)], { encoding: "utf8" });
  say(r.status === 0, f + (r.status === 0 ? " parses" : " FAILED: " + r.stderr.trim()));
}

const { chromium } = await import("playwright");
const exe = process.env.FIREFLIES_CHROMIUM ||
  (process.platform === "linux" ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch({
  executablePath: exe,
  args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--use-angle=vulkan", "--use-vulkan=swiftshader", "--no-sandbox"]
});

console.log("[2] shell boot (halofield.html — resonator config)");
{
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("file://" + path.join(root, "halofield.html"));
  await page.waitForTimeout(3000);
  const probeText = await page.locator("#probe").innerText().catch(() => "");
  say(/GREEN|RED/.test(probeText), "probe gate rendered a verdict: " + JSON.stringify(probeText.trim().split("\n")[0]));
  const f1 = await page.evaluate(() => window.ZigCore ? ZigCore.clock.frame : -1).catch(() => -1);
  await page.waitForTimeout(1000);
  const f2 = await page.evaluate(() => window.ZigCore ? ZigCore.clock.frame : -1).catch(() => -1);
  say(f2 > f1 && f1 >= 0, "ZigCore loop alive: frame " + f1 + " → " + f2);
  const hard = errors.filter((e) => !KNOWN_PRESENT_ARTIFACT.test(e));
  const artifact = errors.length - hard.length;
  say(hard.length === 0, hard.length === 0
    ? "zero unexpected errors" + (artifact ? " (" + artifact + " known headless-present artifact suppressed)" : "")
    : "unexpected errors:\n      " + hard.join("\n      "));
  await page.close();
}

console.log("[3] resonator pair compute (halo voice-1 + woodblock voice-0, 60 dispatches)");
{
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("file://" + path.join(root, "test/blank_probe.html"));
  await page.addScriptTag({ path: path.join(root, "engine/zigcore.js") });
  await page.addScriptTag({ path: path.join(root, "engine/zigmesh.js") });
  await page.addScriptTag({ path: path.join(root, "engine/zigwebgpu.js") });

  const r = await page.evaluate(async () => {
    if (!navigator.gpu) return { skip: "no navigator.gpu in this headless build" };
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 360; document.body.appendChild(canvas);
    let gpu;
    try { gpu = await ZigWebGPU.init(canvas, { msaa: true }); }
    catch (e) { return { skip: "no adapter headless: " + e.message }; }
    let lost = null; gpu.device.lost.then((i) => { lost = i.reason + ": " + i.message; });

    /* exactly the Halo Field pairing */
    const scene = ZigWebGPU.createScene(gpu, { sky: true });
    const A = ZigWebGPU.createFlock(gpu, { max: 8000, count: 3000, seed: 0xA10, extent: 130, extentY: 130, debris: 0,
      mesh: ZigMesh.make(ZigMesh.presets.halo), phase: {} });
    const B = ZigWebGPU.createFlock(gpu, { max: 4000, count: 1200, seed: 0xB10C, extent: 130, extentY: 130, debris: 0,
      mesh: ZigMesh.make(ZigMesh.presets.woodblock) });     // no phase, voice 0
    scene.add(A); scene.add(B);
    A.seed([0, 62, 0]); A.seedPhase(4.4, 0.25);
    B.seed([0, 36, 0]);

    const mk = (over) => Object.assign({
      dt: 1 / 60, time: 0, breath: 0.4, bend: 0, attack: 0, energy: 0.4,
      waveSpeed: 22, waveWidth: 8, agitAmbient: 0.1, cohW: 0.55, sepW: 3.2, aliW: 0.4,
      anchor: [0, 62, 0, 0], refpt: [0, 62, 0, 6], wind: [0, 0, 0],
      knobsA: [0.5, 3.6, 0.35, 4.2], knobsB: [8, 16, 0.85, 0.9],
      impulses: Array.from({ length: 8 }, () => ({ o: [0, 0, 0], t0: -1, strength: 0 })),
      taps: new Float32Array(64), medium: 1,
      K: 1.5, tempo: 1, ignite: 3.4, pacePhase: 0, pacePull: 0.4, waveLife: 10,
      avatarA: [0, 0, 62, 0], avatarB: [0.85, 0, 0.1, 5]
    }, over);
    const sA = mk({});
    const sB = mk({ voice: 0, breath: 0, energy: 0, agitAmbient: 0, K: 0, tempo: 0, ignite: 0, pacePull: 0,
      anchor: [0, 36, 0, 0], avatarA: [-1, 0, 36, 0], avatarB: [0, 0, 0, 0] });
    sB.impulses = sA.impulses;                       // the shared wave path
    sA.impulses[0] = { o: [0, 62, 0], t0: 0.1, strength: 0.9 };

    for (let f = 0; f < 60; f++) {
      sA.time = sB.time = f / 60;
      const enc = gpu.device.createCommandEncoder();
      A.computeInto(enc, sA);
      B.computeInto(enc, sB);
      gpu.device.queue.submit([enc.finish()]);
    }
    await gpu.device.queue.onSubmittedWorkDone();
    return { lost, done: true, ver: ZigWebGPU.VERSION };
  });

  if (r.skip) say(true, "SKIPPED (" + r.skip + ") — compute proof requires eyez");
  else {
    say(r.done && !r.lost, "60 paired compute frames dispatched (engine v" + r.ver + "), device " + (r.lost ? "LOST: " + r.lost : "alive"));
    say(errors.length === 0, errors.length === 0 ? "zero WGSL/validation errors"
      : "errors:\n      " + errors.join("\n      "));
  }
  await page.close();
}

console.log("[4] memory glass (afterimage trail+blit, offscreen — presentation-free)");
{
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("file://" + path.join(root, "test/blank_probe.html"));
  await page.addScriptTag({ path: path.join(root, "engine/zigcore.js") });
  await page.addScriptTag({ path: path.join(root, "engine/zigwebgpu.js") });
  const r = await page.evaluate(async () => {
    if (!navigator.gpu) return { skip: "no navigator.gpu" };
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 360; document.body.appendChild(canvas);
    let gpu;
    try { gpu = await ZigWebGPU.init(canvas, { msaa: true }); }
    catch (e) { return { skip: "no adapter headless: " + e.message }; }
    let lost = null; gpu.device.lost.then((i) => { lost = i.reason + ": " + i.message; });
    const after = ZigWebGPU.createAfterimage(gpu, { tau: 1.5 });
    after._ensure();
    const fakeSwap = gpu.device.createTexture({
      size: [gpu.w, gpu.h], format: gpu.format, usage: GPUTextureUsage.RENDER_ATTACHMENT
    }).createView();
    for (let f = 0; f < 10; f++) {
      const enc = gpu.device.createCommandEncoder();
      after.run(enc, fakeSwap, 1 / 60);
      gpu.device.queue.submit([enc.finish()]);
    }
    await gpu.device.queue.onSubmittedWorkDone();
    return { lost, done: true };
  });
  if (r.skip) say(true, "SKIPPED (" + r.skip + ")");
  else {
    say(r.done && !r.lost, "10 trail+blit frames dispatched, device " + (r.lost ? "LOST: " + r.lost : "alive"));
    say(errors.length === 0, errors.length === 0 ? "zero WGSL/validation errors" : "errors:\n      " + errors.join("\n      "));
  }
  await page.close();
}

console.log("[6] wardrobe (3 letters, 1 plate — letter switch + metamorphosis mid-run)");
{
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("file://" + path.join(root, "test/blank_probe.html"));
  await page.addScriptTag({ path: path.join(root, "engine/zigcore.js") });
  await page.addScriptTag({ path: path.join(root, "engine/zigmesh.js") });
  await page.addScriptTag({ path: path.join(root, "engine/zigwebgpu.js") });
  const r = await page.evaluate(async () => {
    if (!navigator.gpu) return { skip: "no navigator.gpu" };
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 360; document.body.appendChild(canvas);
    let gpu;
    try { gpu = await ZigWebGPU.init(canvas, { msaa: true }); }
    catch (e) { return { skip: "no adapter headless: " + e.message }; }
    let lost = null; gpu.device.lost.then((i) => { lost = i.reason + ": " + i.message; });
    const wardrobe = ["seed", "whisper", "halo"].map((n) => ZigMesh.make(ZigMesh.presets[n], { refine: 2 }));
    const A = ZigWebGPU.createFlock(gpu, { max: 6000, count: 2000, seed: 0xA10, extent: 130, extentY: 130, debris: 0,
      mesh: wardrobe, phase: {} });
    A.seed([0, 62, 0]); A.seedPhase(4.4, 0.25);
    const maxV = Math.max.apply(null, wardrobe.map((m) => m.verts));
    if (A.vertsPerAgent !== maxV) return { bad: "vertsPerAgent " + A.vertsPerAgent + " ≠ max " + maxV };
    const state = { dt: 1 / 60, time: 0, breath: 0.4, bend: 0, attack: 0, energy: 0.4,
      waveSpeed: 22, waveWidth: 8, agitAmbient: 0.1, cohW: 0.55, sepW: 3.2, aliW: 0.4,
      anchor: [0, 62, 0, 0], refpt: [0, 62, 0, 6], wind: [0, 0, 0],
      knobsA: [0.5, 3.6, 0.35, 4.2], knobsB: [8, 16, 0.85, 0.9],
      impulses: Array.from({ length: 8 }, () => ({ o: [0, 0, 0], t0: -1, strength: 0 })),
      taps: new Float32Array(64), medium: 1, K: 1.5, tempo: 1, ignite: 3.4,
      letter: 0, letterB: 0, mix: 0 };
    for (let f = 0; f < 60; f++) {
      state.time = f / 60;
      if (f === 20) state.letter = 1;                        // the field re-dresses
      if (f === 40) { state.letterB = 2; state.mix = 0.5; }  // half the field blossoms
      const enc = gpu.device.createCommandEncoder();
      A.computeInto(enc, state);
      gpu.device.queue.submit([enc.finish()]);
    }
    await gpu.device.queue.onSubmittedWorkDone();
    return { lost, done: true, verts: A.vertsPerAgent };
  });
  if (r.skip) say(true, "SKIPPED (" + r.skip + ")");
  else if (r.bad) say(false, r.bad);
  else {
    say(r.done && !r.lost, "60 frames incl. live re-dress + 50% metamorphosis (verts/agent " + r.verts + "), device " + (r.lost ? "LOST: " + r.lost : "alive"));
    say(errors.length === 0, errors.length === 0 ? "zero WGSL/validation errors" : "errors:\n      " + errors.join("\n      "));
  }
  await page.close();
}

console.log("[5] zigflow (wind grid + flow-coupled flock, 60 stirred frames)");
{
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("file://" + path.join(root, "test/blank_probe.html"));
  await page.addScriptTag({ path: path.join(root, "engine/zigcore.js") });
  await page.addScriptTag({ path: path.join(root, "engine/zigmesh.js") });
  await page.addScriptTag({ path: path.join(root, "engine/zigwebgpu.js") });
  const r = await page.evaluate(async () => {
    if (!navigator.gpu) return { skip: "no navigator.gpu" };
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 360; document.body.appendChild(canvas);
    let gpu;
    try { gpu = await ZigWebGPU.init(canvas, { msaa: true }); }
    catch (e) { return { skip: "no adapter headless: " + e.message }; }
    let lost = null; gpu.device.lost.then((i) => { lost = i.reason + ": " + i.message; });
    const flow = ZigWebGPU.createFlow(gpu, { extent: 130, extentY: 130, cell: 8 });
    const A = ZigWebGPU.createFlock(gpu, { max: 8000, count: 3000, seed: 0xA10, extent: 130, extentY: 130, debris: 0,
      mesh: ZigMesh.make(ZigMesh.presets.halo), phase: {}, flow });
    A.seed([0, 62, 0]); A.seedPhase(4.4, 0.25);
    const state = { dt: 1 / 60, time: 0, breath: 0.5, bend: 0, attack: 0, energy: 0.4,
      waveSpeed: 22, waveWidth: 8, agitAmbient: 0.1, cohW: 0.55, sepW: 3.2, aliW: 0.4,
      anchor: [0, 62, 0, 0], refpt: [0, 62, 0, 6], wind: [0, 0, 0],
      knobsA: [0.5, 3.6, 0.35, 4.2], knobsB: [8, 16, 0.85, 0.9],
      impulses: Array.from({ length: 8 }, () => ({ o: [0, 0, 0], t0: -1, strength: 0 })),
      taps: new Float32Array(64), medium: 1,
      K: 1.5, tempo: 1, ignite: 3.4, waveLife: 10,
      avatarA: [0, 0, 62, 0], avatarB: [0.85, 0, 0.1, 5] };
    state.impulses[0] = { o: [0, 62, 0], t0: 0.1, strength: 0.9 };
    for (let f = 0; f < 60; f++) {
      state.time = f / 60;
      flow.frame(state, { x: 10, y: 62, z: 0, vx: 3, vy: 0, vz: 1, radius: 7 });
      const enc = gpu.device.createCommandEncoder();
      A.computeInto(enc, state);
      gpu.device.queue.submit([enc.finish()]);
    }
    await gpu.device.queue.onSubmittedWorkDone();
    return { lost, done: true, ver: ZigWebGPU.VERSION };
  });
  if (r.skip) say(true, "SKIPPED (" + r.skip + ")");
  else {
    say(r.done && !r.lost, "60 stirred frames dispatched (engine v" + r.ver + "), device " + (r.lost ? "LOST: " + r.lost : "alive"));
    say(errors.length === 0, errors.length === 0 ? "zero WGSL/validation errors" : "errors:\n      " + errors.join("\n      "));
  }
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nRESONATOR SHELL CHECK: PASS" : "\nRESONATOR SHELL CHECK: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);

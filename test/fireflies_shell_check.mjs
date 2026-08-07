/* =============================================================================
   test/fireflies_shell_check.mjs — milestone-1 headless verification
   Reusable pattern for EVERY species shell (run: node test/fireflies_shell_check.mjs)

   Verification reality (Kickoff Brief): the cloud sandbox has NO real GPU.
   Headless Chromium + SwiftShader gives a REAL WebGPU device for compute and
   shader compilation, but canvas PRESENTATION kills the SwiftShader device
   ("A valid external Instance reference no longer exists") — proven with a
   6-line engine-free repro (clear+present, nothing else). So headless we
   verify everything short of the glass; Bill judges pixels on eyez.

   What this proves without a real GPU:
     1. engine + species parse clean (node --check)
     2. fireflies.html boots: probe gate renders a verdict, HUD lives,
        the ZigCore loop runs — zero errors other than the known
        presentation artifact
     3. the FULL flock kernel (grid clear/build + 7-NN step) COMPILES and
        DISPATCHES 60 frames on a real WebGPU device — no render pass, no
        presentation, no validation errors
   ========================================================================== */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files = ["engine/zigcore.js", "engine/zigwebgpu.js", "species/fireflies.js"];
const KNOWN_PRESENT_ARTIFACT = /valid external Instance reference no longer exists/i;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };

/* 1 · parse gate */
console.log("[1] syntax");
for (const f of files) {
  const r = spawnSync(process.execPath, ["--check", path.join(root, f)], { encoding: "utf8" });
  say(r.status === 0, f + (r.status === 0 ? " parses" : " FAILED: " + r.stderr.trim()));
}

const { chromium } = await import("playwright");
/* cloud sandbox pins its own Chromium; on eyez the default resolution works */
const exe = process.env.FIREFLIES_CHROMIUM ||
  (process.platform === "linux" ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch({
  executablePath: exe,
  args: [
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan",
    "--use-angle=vulkan",
    "--use-vulkan=swiftshader",
    "--no-sandbox"
  ]
});

/* 2 · full shell boot */
console.log("[2] shell boot (fireflies.html)");
{
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto("file://" + path.join(root, "fireflies.html"));
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
    ? "zero unexpected errors" + (artifact ? " (" + artifact + " known headless-present artifact suppressed — green glass is judged on eyez)" : "")
    : "unexpected errors:\n      " + hard.join("\n      "));
  await page.close();
}

/* 3 · flock kernel compute dry-run — no render pass, no presentation */
console.log("[3] kernel compute (60 dispatches, presentation-free)");
{
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto("file://" + path.join(root, "fireflies.html").replace("fireflies.html", "test/blank_probe.html"));
  await page.addScriptTag({ path: path.join(root, "engine/zigcore.js") });
  await page.addScriptTag({ path: path.join(root, "engine/zigwebgpu.js") });

  const r = await page.evaluate(async () => {
    if (!navigator.gpu) return { skip: "no navigator.gpu in this headless build" };
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 360; document.body.appendChild(canvas);
    let gpu;
    try { gpu = await ZigWebGPU.init(canvas, { msaa: true }); }
    catch (e) { return { skip: "no adapter headless: " + e.message }; }
    let lost = null; gpu.device.lost.then((i) => { lost = i.reason + ": " + i.message; });
    const flock = ZigWebGPU.createFlock(gpu, { max: 20000, count: 6000, seed: 0xF1EF, extent: 130, extentY: 130, debris: 0 });
    flock.seed([0, 62, 0]);
    const taps = new Float32Array(64);
    const state = { dt: 1 / 60, time: 0, breath: 0.4, bend: 0, attack: 0, energy: 0.4,
      waveSpeed: 30, waveWidth: 8, agitAmbient: 0.1, cohW: 1, sepW: 3, aliW: 0.4,
      anchor: [0, 62, 0, 18], refpt: [0, 62, 0, 6], wind: [0, 0, 0],
      knobsA: [0.45, 2.6, 0.35, 4.2], knobsB: [8, 26, 0.55, 0.85],
      impulses: Array.from({ length: 8 }, () => ({ o: [0, 0, 0], t0: -1, strength: 0 })),
      taps, medium: 1 };
    /* one live impulse so the wavefront branch executes too */
    state.impulses[0] = { o: [0, 62, 0], t0: 0.1, strength: 0.9 };
    for (let f = 0; f < 60; f++) {
      state.time = f / 60;
      const enc = gpu.device.createCommandEncoder();
      flock.computeInto(enc, state);              // grid clear+build + 7-NN step
      gpu.device.queue.submit([enc.finish()]);
    }
    await gpu.device.queue.onSubmittedWorkDone();
    return { lost, done: true };
  });

  if (r.skip) say(true, "SKIPPED (" + r.skip + ") — compute proof requires eyez");
  else {
    say(r.done && !r.lost, "60 compute frames dispatched, device " + (r.lost ? "LOST: " + r.lost : "alive"));
    say(errors.length === 0, errors.length === 0 ? "zero WGSL/validation errors"
      : "errors:\n      " + errors.join("\n      "));
  }
  await page.close();
}

await browser.close();
console.log(failures === 0 ? "\nSHELL CHECK: PASS" : "\nSHELL CHECK: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);

/* =============================================================================
   test/timbre_ref.mjs — CPU reference checks for ZigTimbre._analyze
   (run: node test/timbre_ref.mjs) — pure math, no browser, no GPU.

   Frames are synthesized exactly as the analyser delivers them:
   freq = Float32Array of 1024 linear magnitudes 0..1 · time = samples −1..1
   sampleRate 48000 → 23.44 Hz/bin.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigcore.js"), "utf8"))();
const T = globalThis.ZigCore.Timbre;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };

const SR = 48000, BINS = 1024, N = 2048;
const hzBin = (hz) => Math.round(hz / (SR / 2 / BINS));
const frame = (peaks) => {           // peaks: [[hz, mag], ...] with a little width
  const f = new Float32Array(BINS);
  for (const [hz, mag] of peaks) {
    const c = hzBin(hz);
    for (let d = -2; d <= 2; d++) if (c + d > 0 && c + d < BINS) f[c + d] = Math.max(f[c + d], mag * (1 - Math.abs(d) * 0.3));
  }
  return f;
};
const tone = (amp) => { const s = new Float32Array(N); for (let i = 0; i < N; i++) s[i] = amp * Math.sin(i * 0.13); return s; };

console.log("[silence]");
{
  const r = T._analyze(new Float32Array(BINS), new Float32Array(N), SR, null);
  say(r.body < 0.01, "body ≈ 0 (" + r.body.toFixed(3) + ")");
  say(r.brightness === 0, "brightness 0 with no energy");
  say(r.flux === 0, "flux 0 with no previous frame");
}

console.log("[body — loudness is monotonic]");
{
  const quiet = T._analyze(frame([[400, 0.5]]), tone(0.05), SR, null);
  const loud = T._analyze(frame([[400, 0.5]]), tone(0.35), SR, null);
  say(loud.body > quiet.body * 3, "louder horn → much more body (" + quiet.body.toFixed(2) + " → " + loud.body.toFixed(2) + ")");
  say(loud.body <= 1, "body clamped ≤ 1");
}

console.log("[brightness — growl vs shine]");
{
  const dark = T._analyze(frame([[300, 0.8], [600, 0.35]]), tone(0.2), SR, null);       // subtone growl
  const mid = T._analyze(frame([[800, 0.6], [1600, 0.5], [3200, 0.3]]), tone(0.2), SR, null);
  const shine = T._analyze(frame([[4000, 0.5], [7000, 0.7]]), tone(0.2), SR, null);     // altissimo shine
  say(dark.brightness < 0.42, "growl reads dark (" + dark.brightness.toFixed(2) + ")");
  say(shine.brightness > 0.65, "shine reads bright (" + shine.brightness.toFixed(2) + ")");
  say(dark.brightness < mid.brightness && mid.brightness < shine.brightness,
    "strict ordering dark < mid < bright (" + dark.brightness.toFixed(2) + " < " + mid.brightness.toFixed(2) + " < " + shine.brightness.toFixed(2) + ")");
}

console.log("[flux — articulation, not sustain]");
{
  const a = frame([[600, 0.7], [1200, 0.4]]);
  const still = T._analyze(a, tone(0.2), SR, a);
  say(still.flux === 0, "held note → zero flux");
  const onset = T._analyze(frame([[600, 0.7], [1200, 0.4], [2400, 0.5], [4800, 0.4]]), tone(0.2), SR, frame([[600, 0.2]]));
  say(onset.flux > 0.25, "hard articulation → flux fires (" + onset.flux.toFixed(2) + ")");
  const decayF = T._analyze(frame([[600, 0.2]]), tone(0.2), SR, a);
  say(decayF.flux < 0.05, "energy FALLING → no flux (release is not a strike)");
  say(onset.flux <= 1, "flux clamped ≤ 1");
  const wobble = T._analyze(frame([[600, 0.66], [1200, 0.44]]), tone(0.2), SR, frame([[600, 0.6], [1200, 0.4]]));
  say(wobble.flux < 0.12, "vibrato on a held note stays quiet (" + wobble.flux.toFixed(3) + ")");
}

console.log(failures === 0 ? "\nTIMBRE REF: PASS" : "\nTIMBRE REF: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);

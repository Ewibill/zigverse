/* =============================================================================
   test/ambience_ref.mjs — CPU reference checks for the ATMOSPHERE BUS
   (run: node test/ambience_ref.mjs) — pure math, no browser, no GPU.

   Covers: Timbre._analyze noisiness/low/high · Ambience._derive (tail/onset) ·
   Ambience._synthAt (the deterministic phrase) · Ambience.update synth path
   (the §5 tail ringing after silence) · AmbienceMap leaky integrators (and the
   glow-lingers-slower-than-lum property that IS the §5 divergence).
   Frames: freq = Float32Array 1024 linear mags 0..1, sr 48000 → 23.44 Hz/bin.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigcore.js"), "utf8"))();
const ZC = globalThis.ZigCore;
const T = ZC.Timbre, A = ZC.Ambience, M = ZC.AmbienceMap;

let fails = 0;
const approx = (x) => Math.round(x * 1000) / 1000;
function ok(name, cond, got) { if (!cond) { fails++; console.log("FAIL", name, "· got", got); } else console.log("ok  ", name, got !== undefined ? "· " + got : ""); }

const SR = 48000, NB = 1024;
const HZ = SR / 2 / NB;                                   // 23.44 Hz/bin
const zeros = () => new Float32Array(NB);
const timeSine = (n = 2048) => { const t = new Float32Array(n); for (let i = 0; i < n; i++) t[i] = 0.3 * Math.sin(i * 0.2); return t; };
const tone = (binHz) => { const f = zeros(); f[Math.round(binHz / HZ)] = 1.0; return f; };
const noise = (lvl = 0.3) => { const f = zeros(); for (let i = 1; i < NB; i++) f[i] = lvl; return f; };

/* ---- Timbre._analyze: the new spectral channels -------------------------- */
const aTone = T._analyze(tone(3000), timeSine(), SR, null);     // pure pitch at 3 kHz
ok("tone → noisiness low", aTone.noisiness < 0.15, approx(aTone.noisiness));
ok("tone(3k) → high band", aTone.high > 0.8, approx(aTone.high));
ok("tone(3k) → low band ~0", aTone.low < 0.1, approx(aTone.low));

const aLow = T._analyze(tone(140), timeSine(), SR, null);       // pitch at 140 Hz
ok("tone(140) → low band", aLow.low > 0.8, approx(aLow.low));
ok("tone(140) → high band ~0", aLow.high < 0.1, approx(aLow.high));

const aNoise = T._analyze(noise(0.3), timeSine(), SR, null);    // broadband air
ok("noise → noisiness high", aNoise.noisiness > 0.5, approx(aNoise.noisiness));

/* ---- Ambience._derive: tail rings, onset passes flux ---------------------- */
const d1 = A._derive(0.8, 0.2, 0, 1 / 60);
ok("tail rises to energy", approx(d1.tail) === 0.8, approx(d1.tail));
ok("onset = flux", d1.onset === 0.2, d1.onset);
const d2 = A._derive(0.0, 0.0, 0.8, 0.5);                       // half-second of silence
ok("tail decays in silence", d2.tail < 0.8 && d2.tail > 0.5, approx(d2.tail));
let tl = 0.8; for (let i = 0; i < 300; i++) tl = A._derive(0, 0, tl, 1 / 60).tail;   // ~5 s
ok("tail → ~0 after long silence", tl < 0.05, approx(tl));

/* ---- Ambience._synthAt: deterministic phrase ----------------------------- */
let bmin = 9, bmax = -9, attackFlux = 0, silenceBody = 0;
for (let i = 0; i < 700; i++) { const s = A._synthAt(i / 100); bmin = Math.min(bmin, s.body); bmax = Math.max(bmax, s.body); }
attackFlux = A._synthAt(0.05).flux;                            // inside the attack window
silenceBody = A._synthAt(5.5).body;                            // deep in the silence
ok("synth body in [0,1]", bmin >= 0 && bmax <= 1, approx(bmin) + ".." + approx(bmax));
ok("synth attack fires flux", attackFlux === 1, attackFlux);
ok("synth silence body low", silenceBody < 0.2, approx(silenceBody));

/* ---- Ambience.update (synth): §5 — the world rings after the body stills -- */
A.synth(true);
for (let i = 0; i < 210; i++) A.update(1 / 60);                // advance to ~3.5 s (sustain end)
const sustain = A.read();
for (let i = 0; i < 120; i++) A.update(1 / 60);               // ~+2 s → ~5.5 s (silence)
const silence = A.read();
ok("energy falls in silence", silence.energy < 0.2, approx(silence.energy));
ok("tail lingers past the note (§5)", silence.tail > 0.2 && silence.tail > silence.energy, approx(silence.tail));
ok("sustain had real energy", sustain.energy > 0.6, approx(sustain.energy));

/* ---- AmbienceMap: levers drive up, relax down, glow lingers slower -------- */
M.reset();
const hot = { brightness: 1, noisiness: 1, flux: 0, energy: 1, tail: 1, low: 0, high: 0, onset: 0 };
for (let i = 0; i < 400; i++) M.step(hot, 1 / 60);            // ~6.7 s of full signal (glow is slow by design)
const up = Object.assign({}, M.lev);
ok("temp → brightness", up.temp > 0.9, approx(up.temp));
ok("mist → noisiness", up.mist > 0.9, approx(up.mist));
ok("glow → tail (slow)", up.glow > 0.9, approx(up.glow));

// from a shared start of 1.0, one zero-signal step: glow must fall LESS than lum
M.lev.lum = 1; M.lev.glow = 1;
M.step({ brightness: 0, noisiness: 0, flux: 0, energy: 0, tail: 0, low: 0, high: 0, onset: 0 }, 1 / 60);
ok("glow lingers slower than lum (§5)", M.lev.glow > M.lev.lum, approx(M.lev.glow) + " > " + approx(M.lev.lum));

console.log(fails ? `\nAMBIENCE REF: FAIL (${fails})` : "\nAMBIENCE REF: PASS");
process.exit(fails ? 1 : 0);

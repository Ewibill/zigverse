// shell_species_ref.mjs — the SHELL species (species/shell.js v0.1).
//
// The first species built entirely from the 2026-08-07 laws: it adds no physics of its own,
// only asks questions of structure · allometry · shell · contact · refinement · age ·
// undulation · slip. If a species can be this thin, the platform is doing its job — so this
// file also checks the thinness, not just the behaviour.
//
// Proves: four named forms all grow · breath is the life-force (silence grows nothing and
// moves nothing) · interval sets handedness · a well-fed season opens the whorl faster ·
// the whorls PACK rather than interpenetrating · geometry emits a usable ribbon with the
// aperture widest · the shell survives being blown at any strength.

import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
(0, eval)(readFileSync(new URL("../species/shell.js", import.meta.url), "utf8"));
const ZC = globalThis.ZigCore, Shell = globalThis.TheShell, C = ZC.Contact;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

const play = (sh, notes, breath, settle) => {
  for (const n of notes) { sh.blow(breath); sh.play(n, 0.8); for (let f = 0; f < 3; f++) sh.step(1/60); }
  for (let f = 0; f < (settle === undefined ? 120 : settle); f++) sh.step(1/60);
  return sh;
};
const scale = (k) => { const a = []; for (let i = 0; i < k; i++) a.push(60 + (i % 5)); return a; };

// ---------------------------------------------------------------- 1) the species is THIN
{
  ok(Shell.laws.length >= 7, `the shell declares the ${Shell.laws.length} laws it stands on`);
  const src = readFileSync(new URL("../species/shell.js", import.meta.url), "utf8");
  ok(!/Math\.hypot\([^)]*\)\s*[-*/+]/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")) || src.length < 12000,
     "the species file stays small — physics lives in the engine, not here");
  ok(Shell.formNames().length === 4, `four forms ship as DATA (${Shell.formNames().join(", ")})`);
}

// ---------------------------------------------------------------- 2) every named form grows
for (const form of Shell.formNames()) {
  const sh = Shell.create({ form });
  play(sh, scale(40), 0.8);
  ok(sh.chambers() > 40, `${form}: 40 notes grow ${sh.chambers()} chambers`);
  const g = sh.geometry();
  let fin = true; for (let i = 0; i < g.n; i++) if (!Number.isFinite(g.x[i]) || !Number.isFinite(g.y[i])) fin = false;
  ok(fin, `${form}: geometry is finite`);
}

// ---------------------------------------------------------------- 3) BREATH IS THE LIFE-FORCE
{
  const sh = Shell.create({ form: "nautilus" });
  play(sh, scale(30), 0.8);
  sh.blow(0);
  for (let f = 0; f < 1500; f++) sh.step(1/60);      // let the shell come to rest
  const g0 = sh.geometry();
  for (let f = 0; f < 60; f++) sh.step(1/60);
  const g1 = sh.geometry();
  let moved = 0; for (let i = 0; i < g0.n; i++) moved += Math.abs(g0.x[i]-g1.x[i]) + Math.abs(g0.y[i]-g1.y[i]);
  ok(moved < g0.n * 0.05, `unblown, the shell is STILL (${moved.toFixed(2)} over ${g0.n} chambers)`);

  const before = sh.chambers();
  for (let f = 0; f < 60; f++) sh.step(1/60);
  ok(sh.chambers() === before, "and silence grows nothing");
}

// ---------------------------------------------------------------- 4) the melody decides the shell
{
  // small steps only modulate tightness within the species' own handedness; it takes a
  // real LEAP to reverse the coil, which is the honest behaviour and a musical one
  const rise = [], fall = [];
  for (let i = 0; i < 30; i++) { rise.push(40 + i*12); fall.push(100 - i*12); }
  const turnOf = (notes) => {
    const sh = Shell.create({ form: "nautilus" });
    play(sh, notes, 0.8);
    const g = sh.geometry();
    /* signed area of the traced polygon: sign is handedness, magnitude is how
       much of a whorl got drawn */
    let a = 0;
    for (let i = 1; i < g.n; i++) a += g.x[i-1]*g.y[i] - g.x[i]*g.y[i-1];
    return a;
  };
  const up = turnOf(rise), down = turnOf(fall);
  ok(Math.sign(up) !== Math.sign(down),
     `rising and FALLING OCTAVES coil opposite ways (${up.toFixed(0)} vs ${down.toFixed(0)}) — a leap reverses the shell, a step only tightens it`);
}

// ---------------------------------------------------------------- 5) a good season opens the whorl
{
  const spanOf = (breath) => {
    const sh = Shell.create({ form: "nautilus" });
    for (let q = 0; q < 200; q++) { sh.blow(breath); sh.step(1/60); }   // establish the season first
    play(sh, scale(60), breath);
    const g = sh.geometry();
    return g.w[g.n - 1] / g.w[0];                                        // how much the aperture outgrew the apex
  };
  const lean = spanOf(0.15), fat = spanOf(1.0);
  ok(fat > lean * 1.4, `a well-fed season opens the whorl faster (${fat.toFixed(2)}x vs ${lean.toFixed(2)}x)`);
}

// ---------------------------------------------------------------- 6) the whorls PACK
// A spiral's whole nature is to lie against its own previous turn, so this is the clearest
// case there is for self-contact — and the reason the species asks for it every step.
{
  const sh = Shell.create({ form: "nautilus" });
  play(sh, scale(140), 0.9, 400);
  const g = sh.geometry();
  const r = g.w[g.n - 1];
  const skip = Math.max(3, sh.form.detail * 2);
  let worst = 0;
  for (let i = 0; i < g.n; i++) for (let j = i + skip + 1; j < g.n; j++) {
    const rr = (g.w[i] + g.w[j]) * 0.5;
    const d = Math.hypot(g.x[i]-g.x[j], g.y[i]-g.y[j]);
    if (rr - d > worst) worst = rr - d;
  }
  ok(worst < r * 0.75, `${g.n} chambers and the whorls PACK rather than crossing (worst overlap ${worst.toFixed(3)} vs aperture radius ${r.toFixed(3)})`);
}

// ---------------------------------------------------------------- 7) the ribbon is usable
{
  const sh = Shell.create({ form: "horn" });
  play(sh, scale(50), 0.8);
  const g = sh.geometry();
  ok(g.n === sh.chambers(), "geometry length matches the living body");
  ok(g.age[0] === 0 && Math.abs(g.age[g.n-1] - 1) < 1e-9, "age spans 0 (apex) → 1 (aperture)");
  ok(g.w[g.n-1] > g.w[1] * 1.5, `the APERTURE is the widest part (${g.w[g.n-1].toFixed(2)} vs ${g.w[1].toFixed(2)}) — a cone wrapped on a spiral`);
  let mono = true; for (let i = 2; i < g.n; i++) if (g.w[i] < g.w[i-1] - 1e-9) mono = false;
  ok(mono, "and it widens monotonically — the animal never shrank");
}

// ---------------------------------------------------------------- 8) it cannot be blown apart
{
  for (const b of [0.3, 1.0, 3.0]) {
    const sh = Shell.create({ form: "crozier" });
    play(sh, scale(60), b, 240);
    const g = sh.geometry();
    let fin = true; for (let i = 0; i < g.n; i++) if (!Number.isFinite(g.x[i])) fin = false;
    ok(fin, `blown at ${b}, the shell holds together (rest curvature cannot tear a bond)`);
  }
}

console.log(fail ? `shell_species_ref: ${fail} FAIL` : "shell_species_ref: PASS");
process.exit(fail ? 1 : 0);

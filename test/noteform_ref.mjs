// noteform_ref.mjs — CPU proof of the NOTE→FORM (summon) mappings (species v0.4x).
// A note is read as biological telemetry, not notation: its PITCH is the register of the body
// that emerges (low = heavy/rooted → high = light/aerial), its onset a BIRTH and release a DEATH.
// These are the pure mappings the species drives the wardrobe/reveal/hue rails with.

// the wardrobe ordered by weight (heavy→light), as in the species
const REG_ORDER = ["woodblock", "drop", "ember", "burr", "seed", "kite", "sail", "sicklePetal", "compass", "halo", "crook", "ribbon", "plume", "echo", "whisper", "thorn"];
// a representative live wardrobe (zigmedium's 16), to build REGIDX like the species does
const WNAMES = ["sicklePetal", "ribbon", "ember", "woodblock", "halo", "whisper", "compass", "sail", "seed", "echo", "kite", "thorn", "plume", "drop", "crook", "burr"];
const REGIDX = REG_ORDER.filter((n) => WNAMES.indexOf(n) >= 0).map((n) => WNAMES.indexOf(n));

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const pitchToRegPos = (note) => clamp((note - 48) / 48, 0, 1);              // MIDI 48..96 → 0..1
const pitchToLetterIdx = (note) => REGIDX[Math.min(REGIDX.length - 1, Math.floor(pitchToRegPos(note) * REGIDX.length))];
const pitchToHue = (voice) => 0.02 + clamp((voice - 48) / 54, 0, 1) * 0.62;  // warm(low) → cool(high)

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const nameAt = (note) => WNAMES[pitchToLetterIdx(note)];

// 1) REGIDX covers the whole wardrobe (every form reachable by some pitch) and is a valid perm.
ok(REGIDX.length === WNAMES.length, `every wardrobe form is in the register (${REGIDX.length}/${WNAMES.length})`);
ok(new Set(REGIDX).size === REGIDX.length, "no form appears twice in the register");

// 2) LOW pitch → a HEAVY form; HIGH pitch → a LIGHT form (the core telemetry).
const heavy = ["woodblock", "drop", "ember", "burr", "seed"];
const light = ["thorn", "whisper", "echo", "plume", "ribbon"];
ok(heavy.indexOf(nameAt(48)) >= 0, `lowest note summons a heavy body (got ${nameAt(48)})`);
ok(light.indexOf(nameAt(96)) >= 0, `highest note summons a light body (got ${nameAt(96)})`);

// 3) MONOTONIC register: as pitch rises, the register position never goes backward.
{
  let mono = true, prev = -1;
  for (let n = 48; n <= 96; n += 2) { const p = pitchToRegPos(n); if (p < prev - 1e-9) mono = false; prev = p; }
  ok(mono, "register position rises monotonically with pitch");
}

// 4) PITCH → HUE leans warm→cool and stays on the wheel (0..1), monotonic.
ok(pitchToHue(48) < pitchToHue(96), `low note warmer than high (${pitchToHue(48).toFixed(2)} < ${pitchToHue(96).toFixed(2)})`);
ok(pitchToHue(48) >= 0 && pitchToHue(96) <= 1, "hue stays on the wheel");

// 5) THE LIFECYCLE envelope: born fast on a held note, dies slower on release, silence → 0.
function envelope(seq) {   // seq = array of {held, secs}
  const dt = 1 / 60; let life = 0;
  for (const s of seq) for (let t = 0; t < s.secs; t += dt) life += ((s.held ? 1 : 0) - life) * Math.min(1, dt * (s.held ? 9 : 2.2));
  return life;
}
ok(envelope([{ held: true, secs: 0.4 }]) > 0.9, "a held note blooms the form toward whole (life→1)");
ok(envelope([{ held: true, secs: 0.5 }, { held: false, secs: 2.0 }]) < 0.1, "release dissolves it back to the drift (life→0)");
ok(envelope([{ held: true, secs: 0.15 }]) < envelope([{ held: true, secs: 0.6 }]), "longer sustain = more fully emerged");

console.log(fail ? `\nNOTEFORM REF: FAIL (${fail})` : "\nNOTEFORM REF: PASS");
process.exit(fail ? 1 : 0);

// formfield_ref.mjs — CPU proof of the FORM FIELD selector (engine v0.16.0).
// The vertex maps a per-agent signal (0..1) to a letter index in the rack:
//   li = min(floor(clamp(sig, 0, 0.9999) * N), N-1)
// Proves: endpoints hit the first/last letter, the map is monotonic and covers
// the whole rack evenly, the AGE driver walks young→old across the alphabet,
// and the BIOME (born-hash) driver spreads agents across all letters.
// Structural, not GPU bit-match (f32 vs f64 hash differs by design).

const fract = (x) => x - Math.floor(x);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const pick = (sig, N) => Math.min(Math.floor(clamp(sig, 0, 0.9999) * N), N - 1);
const biomeSig = (ii) => fract(Math.sin(ii * 34.71 + 5.3) * 92677.13);

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };
const N = 4;   // e.g. seed, sickle, whisper, echo

// 1) ENDPOINTS: sig 0 → first letter, sig ~1 → last letter
{
  ok(pick(0.0, N) === 0, `sig 0 → letter 0 (got ${pick(0.0, N)})`);
  ok(pick(0.999, N) === N - 1, `sig ~1 → letter ${N - 1} (got ${pick(0.999, N)})`);
}

// 2) MONOTONIC: rising signal never picks an earlier letter
{
  let prev = -1, mono = true;
  for (let s = 0; s <= 1.0001; s += 0.01) { const li = pick(s, N); if (li < prev) mono = false; prev = li; }
  ok(mono, "monotonic — higher signal → same-or-later letter");
}

// 3) COVERAGE: a signal sweep hits every letter in the rack
{
  const seen = new Set();
  for (let s = 0; s < 1.0; s += 0.005) seen.add(pick(s, N));
  ok(seen.size === N, `sweep covers all ${N} letters (hit ${seen.size})`);
}

// 4) AGE DRIVER: young (age 0) wears the first form, old (age→1) the last
{
  ok(pick(0.05, N) === 0 && pick(0.95, N) === N - 1, `age walks the rack: young=${pick(0.05, N)}, old=${pick(0.95, N)}`);
  // equal-width bands across life
  const bands = [pick(0.1, N), pick(0.35, N), pick(0.6, N), pick(0.85, N)];
  ok(bands.join(",") === "0,1,2,3", `life-arc bands = ${bands.join(",")}`);
}

// 5) BIOME DRIVER: a born hash spreads a population across all letters
{
  const seen = new Set();
  for (let ii = 0; ii < 3000; ii++) seen.add(pick(biomeSig(ii), N));
  ok(seen.size === N, `born-hash populates all ${N} letters (hit ${seen.size})`);
  // roughly balanced (no letter starved)
  const counts = [0, 0, 0, 0];
  for (let ii = 0; ii < 3000; ii++) counts[pick(biomeSig(ii), N)]++;
  ok(Math.min(...counts) > 3000 / N * 0.6, `each letter well-populated (min ${Math.min(...counts)})`);
}

console.log(fail ? `\nFORMFIELD REF: FAIL (${fail})` : "\nFORMFIELD REF: PASS");
process.exit(fail ? 1 : 0);

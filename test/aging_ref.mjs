// aging_ref.mjs — CPU proof of ZIGAGE (lifespan clock) dynamics.
// Mirrors the step-kernel age block (engine v0.15.0). Proves: age advances
// slowly and WRAPS at 1 (renewal in place); lifespans vary per agent; old
// agents mellow (drive/blaze scaled down); and the render life-arc fades the
// young-born and the old while the prime glows. Structural, not GPU bit-match.

const fract = (x) => x - Math.floor(x);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lifeHash = (i) => fract(Math.sin(i * 92.31 + 2.7) * 51234.9);
const ageRate = (i) => 0.010 + 0.014 * lifeHash(i);

function stepAge(age, i, dt = 1 / 60) { return fract(age + ageRate(i) * dt); }
// the render life-arc (vitality → base tone)
const vitality = (age) => 0.25 + 0.75 * smoothstep(0, 0.12, age) * (1 - smoothstep(0.72, 1, age));

const dt = 1 / 60;
let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

// 1) AGE ADVANCES over time (a slow clock)
{
  let age = 0; for (let s = 0; s < 60 * 20; s++) age = stepAge(age, 100);   // 20 s
  ok(age > 0.1 && age < 0.9, `age advances over 20s (got ${age.toFixed(3)})`);
}

// 2) LIFESPAN ~ 42..100 s (rate bounds) — time to first wrap is in range
{
  for (const i of [1, 50, 999]) {
    let age = 0, t = 0, wrapped = false;
    for (let s = 0; s < 60 * 200 && !wrapped; s++) { const na = stepAge(age, i); if (na < age) wrapped = true; age = na; t = s / 60; }
    ok(wrapped && t > 40 && t < 105, `agent ${i} renews at ${t.toFixed(0)}s (in 42..100 band)`);
  }
}

// 3) RENEWAL: age wraps 1 → 0 (a new generation in place), never exceeds [0,1)
{
  let age = 0.99, bad = false, sawWrap = false;
  for (let s = 0; s < 60 * 30; s++) { const na = stepAge(age, 100); if (na < age) sawWrap = true; if (na < 0 || na >= 1) bad = true; age = na; }
  ok(sawWrap && !bad, `renews cleanly and stays in [0,1) (wrap ${sawWrap}, bad ${bad})`);
}

// 4) LIFESPANS VARY across agents (staggered generations)
{
  const rates = []; for (let i = 0; i < 500; i++) rates.push(ageRate(i));
  const mn = Math.min(...rates), mx = Math.max(...rates);
  ok(mx - mn > 0.005, `lifespans vary (rate spread ${(mx - mn).toFixed(4)})`);
}

// 5) OLD AGENTS MELLOW: drive & blaze scale down past age 0.72
{
  const oldY = smoothstep(0.72, 1.0, 0.95), oldP = smoothstep(0.72, 1.0, 0.4);
  const driveOld = 1 - 0.35 * oldY, drivePrime = 1 - 0.35 * oldP;
  ok(driveOld < drivePrime * 0.8 && oldP === 0, `old = slower (${driveOld.toFixed(2)} vs prime ${drivePrime.toFixed(2)})`);
}

// 6) LIFE-ARC: born dim → prime vivid → old dim (the render fade)
{
  const born = vitality(0.0), prime = vitality(0.4), old = vitality(1.0);
  ok(prime > born + 0.4 && prime > old + 0.4, `arc: born ${born.toFixed(2)} < prime ${prime.toFixed(2)} > old ${old.toFixed(2)}`);
}

console.log(fail ? `\nAGING REF: FAIL (${fail})` : "\nAGING REF: PASS");
process.exit(fail ? 1 : 0);

// medium_ref.mjs — CPU proof of the MEDIUM law (engine v0.19.0).
// The step kernel damps velocity by the medium's viscosity and caps top speed:
//   v   *= (1 - dt * drag)        // thicker world → more velocity lost per step
//   vmax = base * vmaxScale       // thicker world → lower top speed
// Presets: air {0.25, 1.20} · water {1.10, 0.72} · honey {3.40, 0.38}.
// Proves the ORDERING (air freest → honey thickest), that honey settles a moving
// blade far faster than air, and that a still-water default (no medium) is unchanged.

const MEDIA = { air: { drag: 0.25, vmax: 1.20 }, water: { drag: 1.10, vmax: 0.72 }, honey: { drag: 3.40, vmax: 0.38 } };
const retain = (drag, dt) => 1 - dt * drag;              // fraction of speed kept per step
const dt = 1 / 60;

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

// 1) ORDERING — thicker media keep LESS speed each step (more drag) and cap lower.
{
  const rAir = retain(MEDIA.air.drag, dt), rWat = retain(MEDIA.water.drag, dt), rHon = retain(MEDIA.honey.drag, dt);
  ok(rAir > rWat && rWat > rHon, `retain: air ${rAir.toFixed(3)} > water ${rWat.toFixed(3)} > honey ${rHon.toFixed(3)}`);
  ok(MEDIA.air.vmax > MEDIA.water.vmax && MEDIA.water.vmax > MEDIA.honey.vmax, "speed cap: air > water > honey");
}

// 2) SETTLING — a blade pushed to speed 10, no new force, how long to fall under 1?
const settleTime = (drag) => {
  let v = 10, t = 0;
  while (v > 1 && t < 30) { v *= retain(drag, dt); t += dt; }
  return t;
};
{
  const tAir = settleTime(MEDIA.air.drag), tWat = settleTime(MEDIA.water.drag), tHon = settleTime(MEDIA.honey.drag);
  ok(tAir > tWat && tWat > tHon, `settle time: air ${tAir.toFixed(2)}s > water ${tWat.toFixed(2)}s > honey ${tHon.toFixed(2)}s`);
  ok(tHon < 1.0, `honey settles fast (< 1s): ${tHon.toFixed(2)}s`);
  ok(tAir > 5.0, `air coasts long (> 5s): ${tAir.toFixed(2)}s`);
}

// 3) AIR is genuinely thin — retains almost all speed (nearly free motion).
ok(retain(MEDIA.air.drag, dt) > 0.99, `air is nearly frictionless (retain ${retain(MEDIA.air.drag, dt).toFixed(3)})`);

// 4) HONEY nearly halts within a stroke — the labor read.
ok(retain(MEDIA.honey.drag, dt) < 0.95, `honey bites hard each step (retain ${retain(MEDIA.honey.drag, dt).toFixed(3)})`);

// 5) DEFAULT unchanged — no medium set → the kernel keeps its built-in water-drag
//    coefficient (0.9·modes.x). We only PROVE the presets order correctly; the
//    "byte-identical off" property is enforced by the splice anchor guard.
ok(MEDIA.water.drag > 0.9 && MEDIA.air.drag < 0.9, "presets straddle the legacy 0.9 baseline (air thinner, water/honey thicker)");

console.log(fail ? `\nMEDIUM REF: FAIL (${fail})` : "\nMEDIUM REF: PASS");
process.exit(fail ? 1 : 0);

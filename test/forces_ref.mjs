// forces_ref.mjs — CPU proof of the FORCES law (engine v0.20.0). Gravity/buoyancy
// adds a constant vertical accel before the integrate, a soft floor/ceiling that
// catches the matter in view, and vertical damping — composed with MEDIUM drag.
//   accel.y += g;  [floor/ceiling spring];  accel.y -= v.y*damp
//   v.y += accel.y*dt;  v.y *= (1 - dt*mediumDrag)      // MEDIUM composes here
// Presets: sink{g -7, floor -FRAME_H} · float{g +5, ceil +FRAME_H} · suspend{g 0, damp 2.4}.
// FRAME_H is DERIVED from the viewing geometry (camera radius + fov, at a performing dolly)
// so the settled/gathered mass rests at the frame edges — see sickleswarm.js. Default CAMR 54 → 18.
// Proves: sink falls & SETTLES at the floor; float rises & GATHERS at the ceiling;
// suspend hangs (vertical velocity → ~0); and the SAME force settles slower in a
// thicker medium (honey vs air) — the coupling that makes it believable.

const CAMR = 54, CAMFOV = 1.02, _perfRad = Math.max(11, CAMR * (1 - 0.55 * 0.40));
const FRAME_H = Math.round(Math.hypot(_perfRad, 8) * Math.tan(CAMFOV / 2) - 6);   // frame-derived floor/ceiling (≈18)
const FORCEP = { sink: { g: -7.0, floor: -FRAME_H, damp: 0.9 }, float: { g: 5.0, ceil: FRAME_H, damp: 0.8 }, suspend: { g: 0.0, damp: 2.4 } };
const MEDIA = { air: 0.25, water: 1.10, honey: 3.40 };
const dt = 1 / 60, ANCHORY = 90;

// simulate a single blade's vertical channel under a force in a medium, from y0
function sim(force, mediumDrag, y0, secs) {
  let y = y0, vy = 0;
  for (let t = 0; t < secs; t += dt) {
    let a = force.g;
    if (force.floor !== undefined && y < ANCHORY + force.floor) a += (ANCHORY + force.floor - y) * 2.6;
    if (force.ceil !== undefined && y > ANCHORY + force.ceil) a += (ANCHORY + force.ceil - y) * 2.6;
    a -= vy * force.damp;
    vy += a * dt;
    vy *= (1 - dt * mediumDrag);        // MEDIUM composes
    y += vy * dt;
  }
  return { y, vy };
}

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

// 1) SINK — falls from anchor and settles at the floor (anchor.y - FRAME_H), then rests.
{
  const r = sim(FORCEP.sink, MEDIA.water, ANCHORY, 12);
  ok(r.y < ANCHORY - (FRAME_H - 8), `sink fell well below anchor (y ${r.y.toFixed(1)} < ${ANCHORY - (FRAME_H - 8)})`);
  ok(Math.abs(r.y - (ANCHORY - FRAME_H)) < 6, `sink SETTLES near the floor ${ANCHORY - FRAME_H} (got ${r.y.toFixed(1)})`);
  ok(Math.abs(r.vy) < 0.5, `sink comes to rest (|vy| ${Math.abs(r.vy).toFixed(2)} < 0.5)`);
}

// 2) FLOAT — rises from anchor and gathers at the ceiling (anchor.y + FRAME_H).
{
  const r = sim(FORCEP.float, MEDIA.water, ANCHORY, 14);
  ok(r.y > ANCHORY + (FRAME_H - 8), `float rose above anchor (y ${r.y.toFixed(1)})`);
  ok(Math.abs(r.y - (ANCHORY + FRAME_H)) < 8, `float GATHERS near the ceiling ${ANCHORY + FRAME_H} (got ${r.y.toFixed(1)})`);
}

// 3) SUSPEND — hangs: no gravity + heavy damping → vertical velocity dies, stays near anchor.
{
  const r = sim(FORCEP.suspend, MEDIA.water, ANCHORY, 6);
  ok(Math.abs(r.vy) < 0.2, `suspend hangs (|vy| ${Math.abs(r.vy).toFixed(3)} → ~0)`);
  ok(Math.abs(r.y - ANCHORY) < 4, `suspend stays near anchor (y ${r.y.toFixed(1)})`);
}

// 4) THE COUPLING — the SAME sink settles SLOWER in a thicker medium (honey > air).
function settleTime(force, drag) {
  let y = ANCHORY, vy = 0, t = 0;
  while (t < 30) {
    let a = force.g;
    if (y < ANCHORY + force.floor) a += (ANCHORY + force.floor - y) * 2.6;
    a -= vy * force.damp; vy += a * dt; vy *= (1 - dt * drag); y += vy * dt; t += dt;
    if (y < ANCHORY - (FRAME_H - 3) && Math.abs(vy) < 0.4) return t;   // reached & rested near the floor
  }
  return t;
}
{
  const tAir = settleTime(FORCEP.sink, MEDIA.air), tHoney = settleTime(FORCEP.sink, MEDIA.honey);
  ok(tHoney > tAir, `honey+sink settles SLOWER than air+sink (${tHoney.toFixed(2)}s > ${tAir.toFixed(2)}s) — the coupling`);
}

console.log(fail ? `\nFORCES REF: FAIL (${fail})` : "\nFORCES REF: PASS");
process.exit(fail ? 1 : 0);

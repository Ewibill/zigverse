/* =============================================================================
   test/body_ref.mjs — THE BEE OCCUPIES HER BODY (ZigWebGPU 0.48 · sickleswarm 0.35)
   run: node test/body_ref.mjs

   Bill, 2026-09-24: "the bee shard lets the edges of other shards bleed through
   it ... one object cannot go through another one." She is DRAWN up to 2.8x an
   ordinary shard, but the kernel knew her only as a point, and cozy's pull
   peaked at her CENTRE — so the field was dragged INTO her.

   This mirrors the PRESENCE block on the CPU and proves:
     A  the WGSL carries the law (and w = 0 is the 0.47 formula exactly)
     B  old law: a cozy field ends up INSIDE her body (the bleed-through)
     C  new law: the same field gathers AGAINST her — nothing inside her skin
     D  the pull still gathers (the field is drawn in, not pushed off)
     E  the species feeds her live drawn radius; #body=off gives the old law
   ========================================================================== */
import { readFileSync } from "node:fs";
import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EN = readFileSync(path.join(ROOT, "engine", "zigwebgpu.js"), "utf8");
const SP = readFileSync(path.join(ROOT, "species", "sickleswarm.js"), "utf8");
let bad = 0; const chk = (n, c) => { console.log((c ? "  OK   " : "  FAIL ") + n); if (!c) bad++; };

console.log("A — the kernel");
const W = EN.slice(EN.indexOf("const PRESENCE_WGSL"), EN.indexOf("';", EN.indexOf("const PRESENCE_WGSL")));
chk("reads her body radius from presence.w", W.includes("let bodyR = U.presence.w;"));
chk("the pull fades to zero at her surface (shell)", W.includes("clamp((dB - bodyR) / max(bodyR, 0.001), 0.0, 1.0)") && W.includes("fall * fall * shell"));
chk("w = 0 → shell = 1 → the 0.47 pull exactly", W.includes("select(1.0,") && W.includes("bodyR > 0.0)"));
chk("inside her skin: a push out, stronger than any pull (320 > 18 x 11)", W.includes("accel -= (toB / dB) * 320.0 * pen;"));
chk("the engine packs her radius live (simArr[215])", EN.includes("simArr[215] = PRESENCE.body || 0;"));

/* ---- the CPU mirror: one Bee at the origin, a cozy field around her ---- */
function sim(bodyR, seconds = 12) {
  const K = 18, CH = 6, REACH = 60, SEP = 3.6, dt = 1 / 60, N = 160;
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P = []; for (let i = 0; i < N; i++) { const r = 8 + 30 * rnd(), a = rnd() * 6.283, b = Math.acos(2 * rnd() - 1);
    P.push({ x: r * Math.sin(b) * Math.cos(a), y: r * Math.cos(b), z: r * Math.sin(b) * Math.sin(a), vx: 0, vy: 0, vz: 0 }); }
  for (let step = 0; step < seconds / dt; step++) {
    for (const p of P) {
      let ax = 0, ay = 0, az = 0;
      const tx = -p.x, ty = -p.y, tz = -p.z, dB = Math.hypot(tx, ty, tz) + 1e-4;
      const shell = bodyR > 0 ? Math.min(1, Math.max(0, (dB - bodyR) / Math.max(bodyR, 1e-3))) : 1;
      if (dB < REACH) { const fall = 1 - dB / REACH, f = K * CH * fall * fall * shell / dB; ax += tx * f; ay += ty * f; az += tz * f; }
      if (bodyR > 0 && dB < bodyR) { const pen = 1 - dB / bodyR, f = -320 * pen / dB; ax += tx * f; ay += ty * f; az += tz * f; }
      for (const q of P) { if (q === p) continue; const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, d = Math.hypot(dx, dy, dz) + 1e-4;
        if (d < SEP) { const f = 3.2 * 40 * Math.min((SEP - d) / SEP, 1) / d; ax += dx * f; ay += dy * f; az += dz * f; } }
      p.vx = (p.vx + ax * dt) * 0.96; p.vy = (p.vy + ay * dt) * 0.96; p.vz = (p.vz + az * dt) * 0.96;
      const sp = Math.hypot(p.vx, p.vy, p.vz), vmax = 12; if (sp > vmax) { p.vx *= vmax / sp; p.vy *= vmax / sp; p.vz *= vmax / sp; }
    }
    for (const p of P) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
  }
  const d = P.map((p) => Math.hypot(p.x, p.y, p.z)).sort((a, b) => a - b);
  return { min: d[0], inside: (R) => d.filter((v) => v < R).length, median: d[d.length >> 1] };
}
const R = 6.2;                                   // her drawn radius at the default beacon: 1.25 x 1.22 x (1.45 x 1.96 + 0.5) ≈ 5.1-7.4
const start = 8 + 15;                            // median starting distance
const old = sim(0), neu = sim(R);
console.log(`\n     old law: nearest ${old.min.toFixed(2)} · ${old.inside(R)} of 160 inside her skin · median ${old.median.toFixed(1)}`);
console.log(`     new law: nearest ${neu.min.toFixed(2)} · ${neu.inside(R * 0.8)} of 160 deeper than 80% of her radius · median ${neu.median.toFixed(1)}`);
console.log("\nB — the old law (the bleed-through, reproduced)");
chk(`cozy drags the field INTO her (${old.inside(R)} shards inside her skin)`, old.inside(R) >= 10);
console.log("\nC — the new law");
chk(`nothing deeper than 80% of her radius (${neu.inside(R * 0.8)})`, neu.inside(R * 0.8) === 0);
chk(`the nearest shard sits at her skin, not her centre (${neu.min.toFixed(2)} of ${R})`, neu.min > R * 0.8);
console.log("\nD — the gather survives");
chk(`the field is still drawn in (median ${neu.median.toFixed(1)} from a start near ${start})`, neu.median < start * 0.85);

console.log("\nE — the species");
chk("her radius is fed live from her DRAWN size (size x 1.22 x BEE 1.45 x beacon swell + half a shard)",
    SP.includes("view[59] * 1.22 * (1.45 * (1 + 0.32 * Math.min(Math.max(view[69], 0), 3)) + 0.5)"));
chk("#body=off gives the old law for an A/B", SP.includes("/[#&]body=off/i") && SP.includes("? view[59] * 1.22") && SP.includes(": 0;"));
console.log("\n" + (bad ? `FAIL — ${bad} check(s)` : "PASS — all checks"));
process.exit(bad ? 1 : 0);

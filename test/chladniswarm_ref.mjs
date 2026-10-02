/* =============================================================================
   test/chladniswarm_ref.mjs — CHLADNI in the living swarm (engine 0.53 ·
   sickleswarm 0.39 · ZigChladni 0.3 swarmAccel)   (run: node test/chladniswarm_ref.mjs)

   The sand law is a random walk; a Zigverse shard is a BODY with a velocity, a
   speed band, neighbours. So in the swarm the plate is a force: slide toward
   the still line, shake where it is loud, grip (in-plane friction). This proves
   the law on a stand-in flock with the engine's real speed band and spacing,
   and that the WGSL splice is the same law, wired as the other laws are.
   ========================================================================== */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let bad = 0;
const chk = (name, ok, extra) => { console.log((ok ? "  PASS " : "  FAIL ") + name + (extra ? "  (" + extra + ")" : "")); if (!ok) bad++; };
const G = {}; new Function("window", read("engine/zigchladni.js"))(G); const C = G.ZigChladni;
let h = 11; const rnd = () => (h = (h * 16807) % 2147483647) / 2147483647;

/* ---- the law, pointwise ---------------------------------------------------- */
const ug = [0, 0, 0];
chk("silence is no force at all (E = 0)", C.swarmAccel([0.8, 3, -2], 0, 12, 10, 2, 5, 5, 0.3, 0.7).every((v) => v === 0));
let toward = 0, tot = 0;
for (let t = 0; t < 400; t++) { const x = rnd() * 2 - 1, y = rnd() * 2 - 1; C.ug(4, 3, -1, x, y, ug); if (Math.abs(ug[0]) < 0.05) continue;
  const a = C.swarmAccel(ug, 1, 12, 0, 0, 0, 0, 0, 0); tot++; if (a[0] * ug[1] * Math.sign(ug[0]) + a[1] * ug[2] * Math.sign(ug[0]) < 0) toward++; }
chk("the slide always points down the slope of |u| - toward the still line", toward === tot, toward + " of " + tot);
C.ug(4, 3, -1, 0.31, -0.2, ug); const g1 = C.swarmAccel(ug, 1, 0, 0, 2, 3, -1.5, 0, 0);
chk("the grip opposes in-plane motion (the plate's friction)", g1[0] < 0 && g1[1] > 0 && Math.abs(g1[0] + 6) < 1e-9 && Math.abs(g1[1] - 3) < 1e-9);
const q = [0, 0, 0]; let ln = 0; for (let t = 0; t < 2000; t++) { const x = rnd() * 2 - 1; const y = rnd() * 2 - 1; C.ug(4, 3, -1, x, y, q); if (Math.abs(q[0]) < 0.02) { const a = C.swarmAccel(q, 1, 12, 10, 0, 0, 0, 0.25, 0.5); ln = Math.max(ln, Math.hypot(a[0], a[1])); } }
chk("a shard ON a still line is barely touched (slide ~0, shake only the floor)", ln < 12 * 0.02 + 10 * 1.0 * 0.09 + 0.01, "max " + ln.toFixed(2));
chk("two presets: gentle and firm", C.SWARM.gentle && C.SWARM.firm && C.SWARM.firm.K > C.SWARM.gentle.K);

/* ---- a stand-in flock with the engine's speed band ------------------------- */
function flock(P, n, m, s, secs, E) {
  const N = 900, L = 45, sepR = 3.6, vmin = 0.35, vmaxB = 4.2;
  h = 23; const X = new Float32Array(N), Y = new Float32Array(N), Z = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N), VZ = new Float32Array(N);
  for (let i = 0; i < N; i++) { const r = L * Math.sqrt(rnd()) * 0.95, a = rnd() * 6.283; X[i] = r * Math.cos(a); Y[i] = r * Math.sin(a); Z[i] = (rnd() - 0.5) * 30; VX[i] = rnd() - 0.5; VY[i] = rnd() - 0.5; VZ[i] = rnd() - 0.5; }
  const dt = 1 / 60, u3 = [0, 0, 0], cell = new Map(), base = C.baseline(n, m, s); let last = 1, ok = true;
  for (let f = 0; f < secs * 60; f++) {
    cell.clear(); for (let i = 0; i < N; i++) { const k = ((X[i] / sepR) | 0) + "," + ((Y[i] / sepR) | 0) + "," + ((Z[i] / sepR) | 0); (cell.get(k) || cell.set(k, []).get(k)).push(i); }
    for (let i = 0; i < N; i++) {
      let ax = 0, ay = 0, az = 0;
      const cx = (X[i] / sepR) | 0, cy = (Y[i] / sepR) | 0, cz = (Z[i] / sepR) | 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const l = cell.get((cx + dx) + "," + (cy + dy) + "," + (cz + dz)); if (!l) continue;
        for (const j of l) { if (j === i) continue; const ex = X[i] - X[j], ey = Y[i] - Y[j], ez = Z[i] - Z[j], d2 = ex * ex + ey * ey + ez * ez; if (d2 < sepR * sepR && d2 > 1e-6) { const d = Math.sqrt(d2), f2 = (sepR - d) / sepR * 6; ax += ex / d * f2; ay += ey / d * f2; az += ez / d * f2; } } }
      const r = Math.hypot(X[i], Y[i], Z[i]); if (r > 1) { const k = Math.min(r * 0.02, 1) * 3 / r; ax -= X[i] * k * 0.5; ay -= Y[i] * k * 0.5; az -= Z[i] * k; }
      const px = X[i] / L, py = Y[i] / L;
      if (P && Math.abs(px) < 1 && Math.abs(py) < 1) { C.ug(n, m, s, px, py, u3); const a = C.swarmAccel(u3, E, P.K, P.J, P.D, VX[i], VY[i], rnd(), rnd()); ax += a[0]; ay += a[1]; }
      VX[i] += ax * dt; VY[i] += ay * dt; VZ[i] += az * dt;
      const sp = Math.hypot(VX[i], VY[i], VZ[i]), vmax = vmaxB + 6 * 0.8;
      if (sp > 1e-4) { const c = Math.min(Math.max(sp, vmin), vmax) / sp; VX[i] *= c; VY[i] *= c; VZ[i] *= c; }
    }
    for (let i = 0; i < N; i++) { X[i] += VX[i] * dt; Y[i] += VY[i] * dt; Z[i] += VZ[i] * dt; if (!isFinite(X[i] + Y[i] + Z[i])) ok = false; }
  }
  let acc = 0, c = 0; for (let i = 0; i < N; i++) { const px = X[i] / L, py = Y[i] / L; if (Math.abs(px) < 1 && Math.abs(py) < 1) { acc += Math.abs(C.u(n, m, s, px, py)); c++; } }
  return { r: acc / c / base, ok };
}
const ctl = flock(null, 4, 3, -1, 4, 1), firm = flock(C.SWARM.firm, 4, 3, -1, 4, 1), gentle = flock(C.SWARM.gentle, 4, 3, -1, 4, 1), soft = flock(C.SWARM.firm, 4, 3, -1, 4, 0.3);
chk("a flock with the engine's speed band draws the figure: firm", firm.r < ctl.r * 0.45, `plate motion under the shards ${ctl.r.toFixed(2)} (no plate) -> ${firm.r.toFixed(2)} in 4 s`);
chk("...and gentle, a little less (the swarm keeps more of its own life)", gentle.r < ctl.r * 0.6 && gentle.r >= firm.r * 0.9, gentle.r.toFixed(2));
chk("a softer breath draws it more slowly", soft.r > firm.r, "E 0.3 -> " + soft.r.toFixed(2));
chk("nothing blows up (every body finite)", ctl.ok && firm.ok && gentle.ok && soft.ok);

/* ---- the engine splice is the same law, wired like the others --------------- */
const W = read("engine/zigwebgpu.js"), SP = read("species/sickleswarm.js"), H = read("zigverse_engine.html");
chk("WGSL: slide toward the still line, shake by |u| + 0.07, grip in the plane, times the drive",
  W.includes("chA = -sign(cg.x) * min(chAmp, 1.0) * ${f(CHLADNI.K)} * cg.yz / chGl;") && W.includes("(0.5 + chH2) * (chAmp + 0.07) * ${f(CHLADNI.J)}") &&
  W.includes("chA -= vec2f(dot(v, chRt), dot(v, chUp)) * ${f(CHLADNI.D)};") && W.includes("accel += (chRt * chA.x + chUp * chA.y) * chE;") &&
  W.includes("let chQ = vec2f(dot(chD, chRt), dot(chD, chUp)) / chL;"));
chk("WGSL u and slope are ZigChladni.ug term for term",
  W.includes("return vec3f(cnX * cmY + s * cmX * cnY, h * (-n * snX * cmY - s * m * smX * cnY), h * (-m * cnX * smY - s * n * cmX * snY));"));
chk("before the integrate (MASS divides it, NATURE delays it); the Bee is exempt; silent plate costs one branch",
  W.includes('.replace(K_PREINT, `  /* ---- CHLADNI:') && W.includes("if (U.chl[0].w > 0.0005 && !(U.avatarA.x >= 0.0 && i32(U.avatarA.x) == i32(i)))") &&
  W.indexOf("if (CHLADNI) {") < W.indexOf("if (MASS && BIOME) throw"));
chk("Sim.chl[5] declared ONLY when the law is present (after the presence slot), SIMF 236; the plate has its own right AND up axes",
  W.includes('${CHLADNI ? (PRESENCE ? "" : "  chlPad: vec4f,') && W.includes("chl: array<vec4f, 5>,") && W.includes("const SIMF = CHLADNI ? 236 : 216;") && W.includes("simArr.set(state.chladni, 216)") && W.includes("simArr.fill(0, 216, 236)") &&
  W.includes("let chRt = U.chl[3].xyz;") && W.includes("let chUp = U.chl[4].xyz;"));
chk("species: gentle|firm presets, the same fixed note->figure map as the study, drive = live breath while a note is held",
  SP.includes("CH.SWARM[String(global.ZIG_CHLADNI_SWARM).toLowerCase()]") && SP.includes("CH.pick(chModes, CH.kFor(chNote))") &&
  SP.includes("const want = (held && liveP) ? Math.min(1.2, state.liveBreath + 0.4 * ZC.Perf.attack) : 0;") && SP.includes("chladni: CHLADNI_OPT || undefined"));
chk("the plate faces the camera: centred on the aim, sized to the measured body, spanning the camera's right and up (orthonormalised) - upright from the side, flat from overhead",
  SP.includes("let chC = (CH_BODY && measured) ? [measured.cx, measured.cy, measured.cz] : aimP, chR = chRt3, chU = chUp3, chLL = chL;") && SP.includes("chArr[8] = chC[0]; chArr[9] = chC[1]; chArr[10] = chC[2]; chArr[11] = chLL;") && SP.includes("chArr[12] = chR[0]; chArr[13] = chR[1]; chArr[14] = chR[2];") && SP.includes("chArr[16] = chU[0]; chArr[17] = chU[1]; chArr[18] = chU[2];") && SP.includes("const chUpRaw = [view[24], view[25], view[26]], chRtRaw = [view[20], view[21], view[22]];") && SP.includes("measured.r * 1.15"));
chk("host: CHLADNI dropdown off | gentle | firm, in the link, reloads, and loads the plate law",
  H.includes('id="chladnipick"') && H.includes('fill(chsel, ["off", "gentle", "firm"], window.ZIG_CHLADNINAME);') && H.includes('"&chladni=" + (chsel ? chsel.value : "off")') &&
  H.includes('<script src="engine/zigchladni.js"></script>') && H.indexOf('engine/zigchladni.js') < H.indexOf('species/sickleswarm.js'));

chk("the shake's random is an integer hash per (shard, frame) by default; the old sine hash only on request (#chtune ...,sin)",
  W.includes("fn chladniRnd(a: u32, b: u32) -> f32") && W.includes('CHLADNI.hash === "sin"') && W.includes("chladniRnd(i * 2u, bitcast<u32>(U.time))"));
chk("the plate is SET at note-on by default (frozen while it sings, set again on each new note, let go in silence); aim/body only on request",
  SP.includes('const CH_LATCH = !(CH_TUNE && (CH_TUNE.centre === "aim" || CH_TUNE.centre === "body"));') && SP.includes("chNote = ZC.Perf.lastNote; chLatch = null;") && SP.includes("if (held && !chLatch) chLatch =") && SP.includes("else if (!held && chE < 0.001) chLatch = null;"));
/* ---- v6.1 ANGLE: the overhead camera's basis, recomputed from the species' own formulas ---- */
{ const ok = []; for (const ang of [0, 0.7, 2.1, 4.4]) {
    const u0 = [Math.cos(ang), 0, Math.sin(ang)], f = [0, -1, 0];
    let rx = u0[1] * f[2] - u0[2] * f[1], ry = u0[2] * f[0] - u0[0] * f[2], rz = u0[0] * f[1] - u0[1] * f[0];
    const rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
    const ux = f[1] * rz - f[2] * ry, uy = f[2] * rx - f[0] * rz, uz = f[0] * ry - f[1] * rx;
    ok.push(Math.abs(ry) < 1e-9 && Math.abs(uy) < 1e-9 && Math.abs(Math.hypot(ux, uy, uz) - 1) < 1e-9 && Math.abs(rx * ux + rz * uz) < 1e-9); }
  chk("overhead: right and up are horizontal and orthonormal at every turn of the frame (so the plate lies flat)", ok.every(Boolean) &&
    SP.includes("const u0 = [Math.cos(ang), 0, Math.sin(ang)];") && SP.includes("let rx = u0[1] * f[2] - u0[2] * f[1], ry = u0[2] * f[0] - u0[0] * f[2], rz = u0[0] * f[1] - u0[1] * f[0];") &&
    SP.includes("const ux = f[1] * rz - f[2] * ry, uy = f[2] * rx - f[0] * rz, uz = f[0] * ry - f[1] * rx;"));
}
chk("host: ANGLE side | overhead, in the link, reloads; absent = side (today's camera)",
  H.includes('id="anglepick"') && H.includes('fill(agsel, ["side", "overhead"], window.ZIG_ANGLE);') && H.includes('"&angle=" + (agsel ? agsel.value : "side")') &&
  SP.includes('const OVERHEAD = String(global.ZIG_ANGLE || "side").toLowerCase() === "overhead";'));
/* ---- v6.1.1 FRAME: fit the body across the screen, not 93% of shards in a sphere ---- */
{ let h2 = 7; const r2 = () => (h2 = (h2 * 16807) % 2147483647) / 2147483647; const P = [];
  for (let i = 0; i < 6000; i++) { const a = r2() * 6.283; if (i < 5400) { const d = 40 * Math.sqrt(r2()); P.push([Math.cos(a) * d, (r2() - 0.5) * 10, Math.sin(a) * d]); } else P.push([Math.cos(a) * 150, (r2() - 0.5) * 40, Math.sin(a) * 150]); }
  const q = (ds, f) => { ds.sort((x, y) => x - y); return ds[Math.floor(ds.length * f)]; };
  const whole = q(P.map((p) => Math.hypot(p[0], p[1], p[2])), 0.93);
  const body = q(P.map((p) => Math.hypot(p[0], p[2])), 0.80);   // seen from overhead: the depth (y) removed, as measure(..., axis) does
  chk("FRAME body: a 40-wide swarm with 10% strays at 150 is framed by its body (~40), not the strays (whole fits 150 - the 'speck')",
    whole > 140 && body < 45 && W.includes("measure(cb, stride, axis)") && W.includes("scr = { p60: q(0.60), p80: q(0.80), p93: q(0.93) };") &&
    SP.includes("fitR = (FRAME_PCT && measured.scr) ? (FRAME_PCT >= 0.8 ? measured.scr.p80 : measured.scr.p60) : measured.r;") &&
    H.includes('id="framepick"') && H.includes('fill(frsel, ["body", "core", "whole"], window.ZIG_FRAMEFIT);'), `whole ${whole.toFixed(0)} · body ${body.toFixed(0)}`);
}
console.log("\n" + (bad ? `FAIL — ${bad} check(s)` : "PASS — all checks"));
process.exit(bad ? 1 : 0);

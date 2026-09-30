/* =============================================================================
   test/chladni_ref.mjs — the singing plate (ZigChladni), the ear for pitch
   (ZigPitch), the shared shard renderer, and the Chladni study's wiring
   (run: node test/chladni_ref.mjs)
   ========================================================================== */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let bad = 0;
const chk = (name, ok, extra) => { console.log((ok ? "  PASS " : "  FAIL ") + name + (extra ? "  (" + extra + ")" : "")); if (!ok) bad++; };
const G = {}; new Function("window", read("engine/zigchladni.js"))(G); new Function("window", read("engine/zigpitch.js"))(G);
const C = G.ZigChladni, Z = G.ZigPitch;
let h = 7; const rnd = () => (h = (h * 16807) % 2147483647) / 2147483647;

/* ---- the plate ------------------------------------------------------------ */
const L = C.modes(10);
chk("modes are sorted by frequency (k = n^2 + m^2) and a tie goes to the woven figure (25 -> 4,3)",
  L.every((d, i) => i === 0 || d.k >= L[i - 1].k) && C.pick(L, 25).n === 4 && C.pick(L, 25).m === 3, L.length + " modes");
let ge = 0, ue = 0; const out = [0, 0, 0];
for (let t = 0; t < 300; t++) { const x = rnd() * 2 - 1, y = rnd() * 2 - 1, n = 1 + (t % 9), m = t % n, s = rnd() * 2 - 1, e = 1e-5, g = C.grad(n, m, s, x, y);
  ge = Math.max(ge, Math.abs((C.u(n, m, s, x + e, y) - C.u(n, m, s, x - e, y)) / (2 * e) - g[0]), Math.abs((C.u(n, m, s, x, y + e) - C.u(n, m, s, x, y - e)) / (2 * e) - g[1]));
  C.ug(n, m, s, x, y, out); ue = Math.max(ue, Math.abs(out[0] - C.u(n, m, s, x, y)), Math.abs(out[1] - g[0]), Math.abs(out[2] - g[1])); }
chk("the gradient is exact (matches finite differences)", ge < 1e-6, ge.toExponential(1));
chk("u + gradient together (ug) equals u and grad separately", ue < 1e-12);
chk("the classic minus figure is antisymmetric across the diagonal (u(x,y) = -u(y,x))",
  [...Array(50)].every(() => { const x = rnd() * 2 - 1, y = rnd() * 2 - 1; return Math.abs(C.u(5, 2, -1, x, y) + C.u(5, 2, -1, y, x)) < 1e-12; }));
chk("bend morphs the figure: 0 -> minus family, +-0.5 -> the plain grid, +-1 -> plus family",
  Math.abs(C.morph(0) + 1) < 1e-12 && Math.abs(C.morph(0.5)) < 1e-12 && Math.abs(C.morph(-0.5)) < 1e-12 && Math.abs(C.morph(1) - 1) < 1e-12);
chk("the note map is FIXED and learnable: an octave doubles k; E4 is the (4,3) figure",
  Math.abs(C.kFor(76) / C.kFor(64) - 2) < 1e-12 && C.pick(L, C.kFor(64)).k === 25);
const ewi = []; for (let nt = 55; nt <= 91; nt++) ewi.push(C.pick(L, C.kFor(nt)));
chk("across an EWI's range a higher note always draws an equal or finer figure", ewi.every((d, i) => i === 0 || d.k >= ewi[i - 1].k),
  "G3 (" + ewi[0].n + "," + ewi[0].m + ") ... G6 (" + ewi[36].n + "," + ewi[36].m + "), " + new Set(ewi.map((d) => d.k)).size + " figures");

/* ---- the sand: the figure EMERGES ---------------------------------------- */
const formedAfter = (n, m, s, secs, E) => { const P = C.create(6000); C.scatter(P, rnd); let a = 0;
  for (let f = 0; f < secs * 60; f++) a = C.step(P, n, m, s, E, 1 / 60, rnd); return { P, r: a / C.baseline(n, m, s) }; };
const f1 = formedAfter(4, 3, -1, 5, 1), f2 = formedAfter(7, 2, 1, 5, 1);
chk("bowed, the sand leaves the loud places and gathers on the still lines (nothing places it)", f1.r < 0.35 && f2.r < 0.35,
  "mean |u| under the grains vs an even spread: " + f1.r.toFixed(2) + ", " + f2.r.toFixed(2));
const weak = formedAfter(4, 3, -1, 5, 0.3);
chk("more breath forms the figure faster", weak.r > f1.r + 0.05, "E 0.3 -> " + weak.r.toFixed(2) + " vs E 1 -> " + f1.r.toFixed(2));
const x0 = f1.P.x.slice(), y0 = f1.P.y.slice(); for (let f = 0; f < 120; f++) C.step(f1.P, 4, 3, -1, 0, 1 / 60, rnd);
let mv = 0; for (let i = 0; i < x0.length; i++) mv = Math.max(mv, Math.abs(f1.P.x[i] - x0[i]), Math.abs(f1.P.y[i] - y0[i]));
chk("silence stops the plate: the figure stays exactly where it fell (memory)", mv === 0);
const inb = f2.P.x.every((v) => v >= -1 && v <= 1) && f2.P.y.every((v) => v >= -1 && v <= 1);
chk("no grain leaves the plate", inb);
/* a new note: the grains on the OLD lines are now in loud places and move to the new ones */
const P3 = f1.P; let r3 = 0; for (let f = 0; f < 300; f++) r3 = C.step(P3, 6, 1, -1, 1, 1 / 60, rnd, { prev: { n: 4, m: 3, s: -1 }, w: Math.min(1, f / 9) });
chk("a new note re-forms the sand into the new figure", r3 / C.baseline(6, 1, -1) < 0.4, (r3 / C.baseline(6, 1, -1)).toFixed(2));
const P4 = C.create(2000); C.scatter(P4, rnd); for (let f = 0; f < 300; f++) C.step(P4, 5, 2, -1, 1, 1 / 60, rnd);
chk("hops come down: every grain lands (h >= 0, no runaway)", P4.h.every((v) => v >= 0 && v < 2) && P4.x.every(isFinite));

/* ---- MEDIA: sand or rice (0.2.0) ---------------------------------------- */
chk("two media on the plate: fine numerous sand, few long rice grains", C.MEDIA.sand.count >= 5 * C.MEDIA.rice.count && C.MEDIA.rice.size > 2.5 * C.MEDIA.sand.size && C.MEDIA.rice.align > 0 && C.MEDIA.sand.align === 0);
const alignOf = (P, n, m, s) => { let al = 0, c = 0; const A = [0, 0, 0];
  for (let i = 0; i < P.x.length; i++) { C.ug(n, m, s, P.x[i], P.y[i], A); if (Math.abs(A[0]) < 0.3 && P.h[i] <= 0) { al += Math.abs(Math.cos(Math.atan2(A[2], A[1]) + Math.PI / 2 - P.a[i])); c++; } } return al / c; };
const RM = C.MEDIA.rice, PR = C.create(RM.count); C.scatter(PR, rnd); const a0 = alignOf(PR, 4, 3, -1); let rr = 0;
for (let f = 0; f < 300; f++) { rr = C.step(PR, 4, 3, -1, 1, 1 / 60, rnd, RM); C.orient(PR, 4, 3, -1, 1, 1 / 60, RM.align); }
const a1 = alignOf(PR, 4, 3, -1);
chk("rice forms the figure too", rr / C.baseline(4, 3, -1) < 0.35, (rr / C.baseline(4, 3, -1)).toFixed(2));
chk("rice turns to lie ALONG the line it found (mean |cos| to the line: random 0.64 -> near 1)", a0 < 0.75 && a1 > 0.9, a0.toFixed(2) + " -> " + a1.toFixed(2));
const PA = PR.a.slice(); C.orient(PR, 4, 3, -1, 0, 1 / 60, RM.align);
chk("in silence rice does not turn either", PR.a.every((v, i) => v === PA[i]));

/* ---- the ear: which note? ------------------------------------------------ */
const sr = 48000;
const gen = (f, kind, noise) => { const b = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const ph = (i * f / sr) % 1;
  const v = kind === "sine" ? Math.sin(2 * Math.PI * ph) : kind === "saw" ? 2 * ph - 1 : (Math.sin(2 * Math.PI * ph) + 0.6 * Math.sin(4 * Math.PI * ph) + 0.4 * Math.sin(6 * Math.PI * ph) + 0.25 * Math.sin(8 * Math.PI * ph));
  b[i] = 0.3 * v + (noise || 0) * (rnd() * 2 - 1); } return b; };
let worst = 0, lowC = 1;
for (let nt = 40; nt <= 90; nt++) { const f = 440 * Math.pow(2, (nt - 69) / 12);
  for (const k of ["sine", "saw", "horn"]) { const d = Z.detect(gen(f, k, 0.05), sr); worst = Math.max(worst, Math.abs(d.note - nt)); lowC = Math.min(lowC, d.clarity); } }
chk("ZigPitch hears every note E2..F#6 (sine, saw, horn-like, with noise) within 10 cents - no octave errors", worst < 0.1, "worst " + (worst * 100).toFixed(1) + " cents, lowest clarity " + lowC.toFixed(2));
const nz = Z.detect(gen(0, "noise", 0.3).map(() => rnd() * 0.6 - 0.3), sr);
chk("breath noise is not a note (clarity low)", nz.clarity < 0.5, nz.clarity.toFixed(2));
chk("silence is not a note", Z.detect(new Float32Array(2048), sr).clarity === 0);

/* ---- the shared renderer + the study's wiring ----------------------------- */
const R = read("engine/zigshardgl.js"), H = read("chladni_study.html") + read("studies/chladni.js");   // the host + the shared study code
chk("ZigShardGL carries the Calabi shard (lens, SOLID terminator, thin film) for every new study",
  R.includes("smoothstep(-0.08, 0.45, d)") && R.includes("thin-film at the turning edge") && R.includes("global.ZigShardGL = ZigShardGL"));
chk("the study loads core, plate, ear and renderer",
  ['engine/zigcore.js', 'engine/zigchladni.js', 'engine/zigpitch.js', 'engine/zigshardgl.js'].every((f) => H.includes('<script src="' + f + '"></script>')));
chk("pitch picks the figure (EWI note, sung note, finger, keys) through the one fixed map",
  H.includes('setNote(lastNote, "EWI")') && H.includes('setNote(nt, "voice")') && H.includes('"touch")') && H.includes("CH.pick(MODES, CH.kFor(nt))"));
chk("breath is the bow; bend morphs; attack makes the sand jump",
  H.includes("drive = Perf.breath + 0.6 * Perf.attack") && H.includes("sMorph = CH.morph(bendS)"));
chk("the sand is stepped by the law, not placed by the page", H.includes("CH.step(P, mode.n, mode.m, sMorph, E, dt, rnd,") && !/P\.x\[i\]\s*=\s*[^;]*mode/.test(H));
chk("listen stays opt-in (no mic until tapped) and the MOTU is never auto-levelled",
  H.includes("let listening = false") && H.includes("await TB.arm(/M2|MOTU/i)") && H.includes("TB.auto = !TB.iface;"));
chk("the study pours sand or rice (button, G, #medium=), remembers it, and turns rice along its lines",
  H.includes('id="medium"') && H.includes('if (e.code === "KeyG") pour(') && H.includes("medium=(sand|rice)") && H.includes('"zigverse.chladni.medium"') && H.includes("if (M.align) CH.orient(P, mode.n, mode.m, sMorph, E, dt, M.align);"));
chk("phone: the finger bows, its height is the note, double-tap shakes the plate clean",
  H.includes("const hold = fingers.size === 1 ? 1 : 0;") && H.includes("(0.5 - y / innerHeight) * 36") && H.includes("if (now - lastTap < 320) { shakeClean();"));

/* ---- the GPU mirror (eyeZ) ------------------------------------------------ */
const GP = read("engine/zigchladnigpu.js"), EZ = read("chladni_eyez.html"), LAW = read("engine/zigchladni.js");
chk("the GPU sand runs the SAME law: shake by |u| + floor, the slide down u^2, hops under gravity 9, reflection, alignment",
  GP.includes("uShake * sqrt(uDt) * uE * (amp + uFloor)") && GP.includes("- sl * 2.0 * u * g") && GP.includes("vh -= 9.0 * uDt") &&
  GP.includes("if (p.x > 1.0) p.x = 2.0 - p.x;") && GP.includes("r3 < amp * uE * uDt * uHopRate") && GP.includes("atan(g2.y, g2.x) + PI * 0.5 - a") &&
  LAW.includes("P.vh[i] -= 9.0 * dt") && LAW.includes("rnd() < amp * E * dt * hopRate"));
chk("...with the same defaults as the CPU law (floor 0.07, slide 0.0012, hop 0.9, hop rate 6)",
  GP.includes("p.floor == null ? 0.07") && GP.includes("p.slide == null ? 0.0012") && GP.includes("p.hop == null ? 0.9") && GP.includes("p.hopRate == null ? 6") &&
  LAW.includes("o.floor == null ? 0.07") && LAW.includes("o.slide == null ? 0.0012") && LAW.includes("o.hop == null ? 0.9") && LAW.includes("o.hopRate == null ? 6"));
chk("the GPU shard wears the shared look (ZigShardGL.FS), face down like the CPU grains",
  GP.includes("draw = SG.program(gl, DRAW_VS, SG.FS)") && GP.includes("-1.0, (hs(seed * 3.31 + 2.0) - 0.5) * tb"));
chk("eyeZ host: GPU engine, 150,000 sand / 9,000 rice, stage manners, one shared study file",
  EZ.includes('engine: "gpu", count: { sand: 150000, rice: 9000 }, stage: true') && EZ.includes('<script src="engine/zigchladnigpu.js"></script>') &&
  EZ.includes('<script src="studies/chladni.js"></script>') && read("chladni_study.html").includes('<script src="studies/chladni.js"></script>'));
chk("if the GPU path cannot start, the CPU law takes over and says so", H.includes('GPU = false; gpuNote = " (GPU sand unavailable here - the CPU moves it)"'));

console.log("\n" + (bad ? `FAIL — ${bad} check(s)` : "PASS — all checks"));
process.exit(bad ? 1 : 0);

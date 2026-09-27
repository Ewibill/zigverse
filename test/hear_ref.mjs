/* =============================================================================
   test/hear_ref.mjs — SENSITIVITY + AUTO-LEVEL + the MOTU-safe listen (v5.7)
   (run: node test/hear_ref.mjs)

   Bill cast the app from his phone to a TV and "the audio response was fairly
   low". Timbre's body is RMS x 3.2 on a FIXED scale tuned for the MOTU at gig
   level. ZigCore 0.16 gives the ears two controls - trim (SENSITIVITY) and an
   auto-level that is used ONLY when the input is not the interface - and this
   proves the law (ZigCore.Timbre.hear) and the wiring.
   ========================================================================== */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let bad = 0;
const chk = (name, ok, extra) => { console.log((ok ? "  PASS " : "  FAIL ") + name + (extra ? "  (" + extra + ")" : "")); if (!ok) bad++; };

const G = {}; new Function("window", read("engine/zigcore.js"))(G);
const T = G.ZigCore.Timbre;
const st = (o) => Object.assign({ trim: 1, auto: false, target: 0.55, maxGain: 12, _lvl: 0 }, o || {});
const run = (s, x, secs) => { let g = 1; for (let t = 0; t < secs; t += 1 / 60) g = T.hear(s, x, 1 / 60); return g; };

chk("trim 1, auto off = gain exactly 1 (every build before)", T.hear(st(), 0.3, 1 / 60) === 1);
chk("SENSITIVITY on the MOTU is a fixed trim (max = 4x, low = 0.5x)", T.hear(st({ trim: 4 }), 0.3, 1 / 60) === 4 && T.hear(st({ trim: 0.5 }), 0.3, 1 / 60) === 0.5);

/* a phone across a room: body ~0.05 where the horn in the MOTU reads ~0.5 */
const phone = st({ auto: true });
const gP = run(phone, 0.05, 3);
chk("auto-level lifts a quiet room toward the target (x11 for a phone at 0.05)", Math.abs(gP * 0.05 - 0.55) < 0.02, "gain " + gP.toFixed(2) + " -> body " + (gP * 0.05).toFixed(2));
const loud = st({ auto: true });
chk("a room already loud is left alone (never turned DOWN below 1)", run(loud, 0.8, 3) === 1);
/* phrase dynamics survive: after the level is learned, a 1.5 s rest barely moves the gain */
const dyn = st({ auto: true }); run(dyn, 0.1, 4); const gBefore = T.hear(dyn, 0.1, 1 / 60);
const gRest = run(dyn, 0.0, 1.5);
chk("a 1.5 s rest between phrases does not pump the gain (slow release)", gRest / gBefore < 1.25, (gRest / gBefore).toFixed(2) + "x");
const dyn2 = st({ auto: true }); run(dyn2, 0.1, 4);
chk("a phrase's own swell still reads (a forte is louder than a piano)", T.hear(dyn2, 0.2, 1 / 60) * 0.2 > T.hear(st({ auto: true, _lvl: dyn2._lvl }), 0.1, 1 / 60) * 0.1);
chk("silence is never lifted past the ceiling (x12)", run(st({ auto: true }), 0, 30) === 12);
chk("SENSITIVITY scales the auto target (max hears fuller than low)",
  run(st({ auto: true, trim: 1.8 }), 0.05, 3) > run(st({ auto: true, trim: 0.6 }), 0.05, 3));
chk("_analyze now reports bodyRaw (unclamped) and body is unchanged",
  (() => { const tm = new Float32Array(256).fill(0.5), f = new Float32Array(128); const r = T._analyze(f, tm, 48000, null); return r.body === 1 && Math.abs(r.bodyRaw - 1.6) < 1e-6; })());

const Z = read("engine/zigcore.js"), S = read("species/sickleswarm.js"), H = read("zigverse_engine.html");
chk("arm() recognises the interface (iface) from the device it opened", Z.includes("this.iface = want.test(this.device);"));
chk("the analyser's dB window is lifted by the same gain (brightness hears it too)", Z.includes("maxDecibels = -30 - sh"));
chk("MOTU is never auto-levelled; any other mic is", S.includes("ZC.Timbre.auto = !ZC.Timbre.iface;"));
chk("MIC listen quiets strikes for the ROOM mic only - the MOTU still strikes", S.includes("if (!(MIC_QUIET && !ZC.Timbre.iface) && dial.audio > 0"));
chk("normal on the MOTU = trim 1 (the 0.35 numbers)", /SENS_FIX\s*=\s*\{ low: 0\.5, normal: 1,/.test(S));
chk("SENSITIVITY is live (setSens) and in the HUD", S.includes("Sickle.setSens = ") && S.includes("\" · HEAR \" + sens"));
chk("host: SENSITIVITY dropdown, low..max, remembered on the device, no reload",
  H.includes('id="senspick"') && H.includes('fill(sesel, ["low", "normal", "high", "max"]') && H.includes('"zigverse.sens.v1"')
  && !/sesel[^\n]*location\.reload/.test(H));

console.log("\n" + (bad ? `FAIL — ${bad} check(s)` : "PASS — all checks"));
process.exit(bad ? 1 : 0);

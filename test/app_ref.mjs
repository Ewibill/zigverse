/* =============================================================================
   test/app_ref.mjs — v5.6 APP, PROVED ON THE CPU        run: node test/app_ref.mjs
   The six things Bill asked for after the iPhone, each pinned to its code:
     A  the Bee's off-switch is honest     B  the camera is smooth
     C  SKY none puts out the overhead light   D  the gather is gentler on a phone
     E  MIC listen hears the room          F  bundle --app makes a home-screen build
   Every change is OFF when not asked for: touch off, sky lit, mic off and no
   --app leave the page as v5.5 (camera smoothing only exists when touch is on).
   ========================================================================== */
import { readFileSync } from "node:fs";
import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SP = readFileSync(path.join(ROOT, "species", "sickleswarm.js"), "utf8");
const HT = readFileSync(path.join(ROOT, "zigverse_engine.html"), "utf8");
const BU = readFileSync(path.join(ROOT, "tools", "bundle.mjs"), "utf8");
let bad = 0; const chk = (n, c) => { console.log((c ? "  OK   " : "  FAIL ") + n); if (!c) bad++; };

console.log("A — the Bee's off-switch");
chk("BEE or MOOD off while nucleus → TOUCH steps down to field",
    HT.includes('if (s.value === "off" && tosel && tosel.value === "nucleus") tosel.value = "field";'));
chk("…registered BEFORE the reload rail, so the tail it writes is right",
    HT.indexOf('tosel.value = "field"') < HT.indexOf("for (const s of [hfsel, bdsel"));

console.log("\nB — the camera");
chk("smoothing exists only with touch on (zt) and yields to #camsmooth=0", SP.includes("const camS = !!(zt && zt.camSmooth)") && SP.includes("/[#&]camsmooth=0/i"));
chk("no Bee-chase in touch mode (the Bee is the finger)", SP.includes("const avW = (FLY || camS) ? 0.0 : 0.4;"));
chk("a hand's breath never dollies", SP.includes("const camTgt = (camS && !ZC.Perf.live) ? 0 :"));
chk("dolly and orbit freeze while held", SP.includes("if (!camHeld) flyDolly +=") && SP.includes("if (!camHeld) flyOrbit +="));
chk("auto-frame distance eased twice (continuous velocity)", SP.includes("radT = ZC.Frame.ease(radT,") && SP.includes("autoRad = ZC.Frame.ease(autoRad, radT, dt, 0.9)"));
chk("auto-frame aim eased twice", SP.includes("aimT[0] += (measured.cx - aimT[0]) * ka") && SP.includes("aimP[0] += (aimT[0] - aimP[0]) * kb"));
chk("touch off → the v5.5 camera paths are all still there",
    SP.includes("} else if (!(zt && zt.holdCam())) autoRad = ZC.Frame.ease(autoRad, Math.max(14, Math.min(400, want)), dt, 0.9);") &&
    SP.includes("} else if (!(zt && zt.holdCam())) {"));
// the double ease really is smoother: a 4 Hz step target, first-order vs second-order
{
  const run = (two) => { let a = 0, b = 0, prevV = 0, jerk = 0; const dt = 1 / 60;
    for (let i = 0; i < 600; i++) { const tgt = 10 * Math.floor(i / 15);           // a new measurement every 0.25 s
      if (two) { a += (tgt - a) * dt * 1.2; b += (a - b) * dt * 0.8; } else { b += (tgt - b) * dt * 0.8; }
      const v = b; const dv = Math.abs((v - (run.p || 0)) - prevV); prevV = v - (run.p || 0); run.p = v; if (i > 2) jerk = Math.max(jerk, dv); }
    run.p = 0; return jerk; };
  const one = run(false), two = run(true);
  chk(`double ease: worst velocity kink ${two.toExponential(1)} vs ${one.toExponential(1)} single (${Math.round(one / two)}× smoother)`, two < one / 3);
}

console.log("\nC — SKY none");
chk("sun disc off (sunDir.w — read only by the sky passes)", SP.includes("view[35] = 0;"));
chk("sky gradient → the ground's dark", SP.includes("for (const o of [36, 40, 44]) { view[o] = view[48];"));
chk("god rays off, AFTER the lantern write every frame (they share render2.y)",
    SP.indexOf("if (SKY_NONE) view[69] = 0;") > SP.indexOf("view[69] = dial.cockpit ? 0 : [0, 0.9, 3.0][dial.mark];"));
chk("SKY absent → nothing changes", SP.includes('const SKY_NONE = String(global.ZIG_SKYLIGHT || "").toLowerCase() === "none";'));
chk("phones start at none; desktop at lit", HT.includes('(ZPHONE ? "none" : "lit")'));

console.log("\nD — the gather on a phone");
chk("softer pull on a phone (0.6, #nucleus overrides)", HT.includes("window.ZIG_NUCLEUS = 0.6;") && SP.includes('touchNum("nucleus", 0, 2, global.ZIG_NUCLEUS != null ? +global.ZIG_NUCLEUS : 1)'));
chk("slower gather on a phone (riseTau 1.0 vs 0.25)", HT.includes("window.ZIG_NUCRISE = 1.0;") && SP.includes("riseTau: global.ZIG_NUCRISE != null"));

console.log("\nE — MIC listen");
chk("the A key and a finger open the SAME audio path", SP.includes('if (e.code === "KeyA") openAudio();') && SP.includes("function openAudio() {"));
chk("first tap asks once; later taps resume a suspended context", SP.includes("if (!asked) { asked = true;") && SP.includes('A._ctx.state === "suspended"'));
chk("MIC absent → no listener at all (v5.6.1: listen OR pulse arms it)", SP.includes('if (/^(listen|pulse)$/i.test(String(global.ZIG_MIC || ""))) {'));
chk("a phone starts the gain at 1.5 unless #audio= says otherwise", HT.includes("window.ZIG_AUDIOGAIN = 1.5;"));
chk("MIC and SKY ride the tail AND the rail", HT.includes('"&sky=" + (skysel ? skysel.value : "lit") + "&mic="') && /vwsel, skysel, micsel, nfsel/.test(HT));

console.log("\nF — bundle --app");
chk("--app is a flag any species can use", BU.includes('const APP = ARGS.includes("--app");'));
chk("the icon is inlined (the app keeps its face off-line)", BU.includes('"data:image/png;base64," + readFileSync(iconPath)'));
chk("app tags added only when missing", BU.includes("if (!new RegExp('name=\"' + n + '\"').test(html))"));
chk("ZIG_APP opens the host as the instrument (nucleus) when the address says nothing",
    HT.includes('(window.ZIG_APP ? "nucleus" : "off")'));

console.log("\nH — v5.6.1: MIC listen is quiet, COLOUR is a dropdown");
chk("listen = glow and shimmer, NO strikes (the U pulse); pulse = strikes as before",
    SP.includes('const MIC_QUIET = String(global.ZIG_MIC || "").toLowerCase() === "listen";') &&
    SP.includes("if (!MIC_QUIET && dial.audio > 0 && ZC.Timbre.flux >"));
chk("MIC offers off · listen · listen+pulse", HT.includes('fill(micsel, ["off", "listen", "pulse"]') && HT.includes('o.textContent = "listen+pulse"'));
chk("COLOUR: 12 steps of Q, 120 is the tuned 0.33 exactly", HT.includes("opts.push(k === 4 ? 0.33 : k / 12)"));
chk("COLOUR is LIVE (setHue, no reload) and NOT on the reload rail", SP.includes("Sickle.setHue = (v) =>") && !/nfsel, cwsel\]\)[^\n]*husel|husel, nfsel/.test(HT) && HT.includes("SickleField.setHue(v)"));
chk("COLOUR is remembered on the device, never in the address", HT.includes("localStorage.setItem(window.ZIG_HUEKEY") && !HT.includes('"&hue="'));
chk("Q and the dropdown stay in step", SP.includes("global.ZigOnHue(dial.hueRot)") && HT.includes("window.ZigOnHue = (v) =>"));

console.log("\nG — survives a sandboxed frame (the Claude preview, embeds, venue players)");
chk("no bare history.replaceState left in the host (every one guarded)",
    (HT.match(/history\.replaceState/g) || []).length === (HT.match(/try \{ history\.replaceState/g) || []).length);

console.log("\n" + (bad ? `FAIL — ${bad} check(s)` : "PASS — all checks"));
process.exit(bad ? 1 : 0);

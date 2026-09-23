/* =============================================================================
   test/mobile_ref.mjs — v5.5 MOBILE NUCLEUS, PROVED ON THE CPU
   run: node test/mobile_ref.mjs

   Four claims:
     1. VIEW normal is TODAY'S FRAME exactly (zoom 1.0 · fov 1.02, C resets to it),
        so a desktop with no #view= sees no change at all.
     2. The camera HOLDS while a hand is the nucleus — both auto-frame's distance
        and its aim are guarded; nothing else in the frame loop is.
     3. The Bee's reach GROWS with trust from her resting reach to the hand's,
        and Shift+↑/↓ in nucleus mode moves the HAND's reach (not presence.r,
        which the next frame would overwrite — a dial that lies).
     4. The panel SCROLLS inside the glass, and VIEW + the new dials ride the
        hash tail AND the reload rail (the GEM 2 lesson).
   ========================================================================== */
import { readFileSync } from "node:fs";
import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SP = readFileSync(path.join(ROOT, "species", "sickleswarm.js"), "utf8");
const HT = readFileSync(path.join(ROOT, "zigverse_engine.html"), "utf8");
let bad = 0; const chk = (n, c) => { console.log((c ? "  OK   " : "  FAIL ") + n); if (!c) bad++; };

console.log("A — VIEW");
const V = SP.match(/const V = \{([^}]+)\}/);
chk("four views declared", V && /close/.test(V[1]) && /normal: \[1, 1\.02\]/.test(V[1]) && /far: \[1\.6, 1\.02\]/.test(V[1]) && /wide: \[1\.35, 1\.3\]/.test(V[1]));
chk("normal = the old frame (frameZoom 1.0 · fov 1.02)", /normal: \[1, 1\.02\]/.test(SP));
chk("frameZoom starts at the VIEW", SP.includes("let frameZoom = VIEW0[0];"));
chk("fov starts at the VIEW", SP.includes("fov: VIEW0[1],"));
chk("C resets to the VIEW", SP.includes("dial.fov = VIEW0[1]; frameZoom = VIEW0[0];"));
chk("#zoom clamped 0.35..2.6, #fov 0.5..1.4 (the same limits the keys obey)",
    SP.includes("Math.max(0.35, Math.min(2.6, +z[1]))") && SP.includes("Math.max(0.5, Math.min(1.4, +f[1]))"));
chk("phones in portrait start at far", /orientation: portrait\)"\)\.matches\) \? "far" : "normal"/.test(HT));

console.log("\nB — CAMERA HOLD");
chk("auto-frame distance guarded", SP.includes("if (!(zt && zt.holdCam())) autoRad = ZC.Frame.ease("));
chk("auto-frame aim guarded", /if \(!\(zt && zt\.holdCam\(\)\)\) \{\s*aimP\[0\] \+= \(measured\.cx/.test(SP));
chk("exactly two guards (nothing else frozen)", (SP.match(/zt\.holdCam\(\)/g) || []).length === 2);
chk("holds on contact OR a held/travelling nucleus", SP.includes("touch.field.contacts > 0 || !!(nuc && nuc.w > 0.15)"));
chk("touch off → zt is null → no hold (today's camera)", SP.includes("let zt = null;"));

console.log("\nC — REACH GROWS WITH TRUST");
chk("#reach= 4..200, default 60", SP.includes('touchNum("reach", 4, 200, 60)'));
chk("presence.r = rest + (hand − rest) × nucleus", SP.includes("flock.presence.r = zt.restR + (zt.reachMax - zt.restR) * nuc.w;"));
const grow = (rest, max, w) => rest + (max - rest) * w;
chk("no hand → her resting reach, exactly", grow(14, 60, 0) === 14);
chk("fully trusted → the hand's reach", grow(14, 60, 1) === 60);
chk("half-trusted → between", grow(14, 60, 0.5) === 37);
chk("Shift in nucleus mode moves the HAND's reach", SP.includes("zt.reachMax = clamp(zt.reachMax + ((e.code === \"ArrowUp\") ? 4 : -4), 4, 200);"));
chk("…and the old Shift path is kept for every other mode", SP.includes("} else if ((e.code === \"ArrowUp\" || e.code === \"ArrowDown\") && e.shiftKey && flock.presence) {"));
chk("HUD shows reach → hand reach", SP.includes('(zt && zt.nucleus ? "\\u2192" + zt.reachMax : "")'));

console.log("\nD — THE PANEL ON A PHONE");
chk("panel height-limited to the glass", /#picks \{[^}]*max-height: calc\(100dvh - 24px\)/.test(HT));
chk("panel scrolls", /#picks \{[^}]*overflow-y: auto/.test(HT));
chk("VIEW dropdown exists", HT.includes('<select id="viewpick"'));
chk("VIEW rides the hash tail", HT.includes('"&view=" + (vwsel ? vwsel.value : "normal")'));
chk("VIEW rides the reload rail", /tosel, vwsel, nfsel/.test(HT));
chk("reach · zoom · fov survive a dropdown reload", HT.includes('"reach", "zoom", "fov"]'));

console.log("\n" + (bad ? `FAIL — ${bad} check(s)` : "PASS — all checks"));
process.exit(bad ? 1 : 0);

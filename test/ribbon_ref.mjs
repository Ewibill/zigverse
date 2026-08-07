/* =============================================================================
   test/ribbon_ref.mjs — the Pacemaker listens to BILL'S ACTUAL TAKE
   (run: node test/ribbon_ref.mjs)

   Fixture: test/bill_ribbons_onsets.json — 697 real note-on times from
   Zigfield_sickle_field.mid (2026-07-19). Style: "play fast to go slow" —
   ~10 notes/s in ribbons whose starts pulse at ~3.4s, ending in sparse
   deliberate taps (~0.75s).

   Claims:
     1. The PLL hears the PHRASE pulse (2–4.5s), not the note rate (0.095s)
     2. Only ribbon-starts/taps reach the clock (≈23 events, not 697)
     3. Flow saturates during the 16s mega-ribbons
     4. When Bill switches to sparse tapping at the end, the clock follows
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigcore.js"), "utf8"))();
const ZC = globalThis.ZigCore;
const ons = JSON.parse(readFileSync(path.join(root, "test/bill_ribbons_onsets.json"), "utf8"));

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };

const PM = Object.create(ZC.Pacemaker);
PM.init();
let taps = 0;
const rawOnset = PM._onset.bind(PM);
PM._onset = (t) => { taps++; rawOnset(t); };

const DT = 1 / 60, END = ons[ons.length - 1] + 2;
let oi = 0, lastNote = -1e9, maxFlow = 0, periodAt60 = 0;
for (let t = 0; t < END; t += DT) {
  while (oi < ons.length && ons[oi] <= t) { PM.noteOn(ons[oi]); lastNote = ons[oi]; oi++; }
  /* emulate update() without Perf/wall-clock */
  PM.phase = (PM.phase + 6.28318 / Math.max(PM.period, 0.05) * DT) % 6.28318;
  PM.flow *= Math.exp(-DT / 0.8);
  if (t - lastNote > PM.period * 2 && PM.flow < 0.12) PM.confidence *= Math.exp(-DT / 2.5);
  if (PM.flow > maxFlow) maxFlow = PM.flow;
  if (Math.abs(t - 60) < DT) periodAt60 = PM.period;
}

console.log("[Bill's take · 697 notes · 96s]");
console.log("   taps that reached the clock: " + taps + " · period@60s " + periodAt60.toFixed(2) +
  "s (" + (60 / periodAt60).toFixed(0) + " bpm) · final period " + PM.period.toFixed(2) +
  "s · max flow " + maxFlow.toFixed(2) + " · final confidence " + PM.confidence.toFixed(2));

say(taps < 45, "gap-gating: " + taps + " taps from 697 notes (the ribbons, not the notes)");
say(periodAt60 > 2.0 && periodAt60 < 4.5, "mid-piece clock is PHRASE-scale: " + periodAt60.toFixed(2) + "s (his ribbons pulse ≈3.4s)");
say(maxFlow > 0.8, "flow saturates in the mega-ribbons: " + maxFlow.toFixed(2));
say(PM.period < 1.8, "clock followed his switch to sparse tapping: final " + PM.period.toFixed(2) + "s");

console.log(failures === 0 ? "\nRIBBON REF: PASS" : "\nRIBBON REF: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);

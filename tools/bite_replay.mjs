#!/usr/bin/env node
/* =============================================================================
   tools/bite_replay.mjs — PLAY A TAKE THROUGH THE WHOLE CHAIN, HEADLESS
   run:  node tools\bite_replay.mjs <file.mid> [more.mid ...]
         node tools\bite_replay.mjs --train <file.mid>     (print every event)

   Feeds a recorded performance through Bite -> Bounce -> Relay exactly as the
   live rig will, and prints what the organism would have done. The point is to
   answer "does the event rate hold across Bill's 8.8 notes/s and his 1.6
   notes/s" with numbers, on his own playing, before anything is installed.

   Contains a minimal SMF reader. It reads note-ons and CC2 only — the two things
   an EWI actually says.
   ========================================================================== */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CANDIDATES = [path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), process.cwd()];
const ROOT = CANDIDATES.find((d) => existsSync(path.join(d, "engine", "zigcore.js")));
if (!ROOT) { console.log("\n  run this from the Zigverse repo.\n"); process.exit(1); }
(0, eval)(readFileSync(path.join(ROOT, "engine", "zigcore.js"), "utf8"));
const ZC = globalThis.ZigCore;

/* ----------------------------------------------------------------- SMF READ */
function readMidi(file) {
  const d = readFileSync(file);
  let p = 0;
  const u32 = () => { const v = d.readUInt32BE(p); p += 4; return v; };
  const u16 = () => { const v = d.readUInt16BE(p); p += 2; return v; };
  const vlq = () => { let v = 0, c; do { c = d[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80); return v; };
  if (d.toString("latin1", 0, 4) !== "MThd") throw new Error("not a MIDI file");
  p = 8; u16(); const ntrk = u16(), div = u16();
  const ev = [], tempos = [];
  for (let k = 0; k < ntrk; k++) {
    if (d.toString("latin1", p, p + 4) !== "MTrk") break;
    p += 4; const len = u32(); const end = p + len;
    let tick = 0, last = 0;
    while (p < end) {
      tick += vlq();
      let st = d[p];
      if (st & 0x80) { last = st; p++; } else st = last;
      if (st === 0xFF) {
        const ty = d[p++]; const ln = vlq();
        if (ty === 0x51) tempos.push([tick, (d[p] << 16) | (d[p + 1] << 8) | d[p + 2]]);
        p += ln;
      } else if (st === 0xF0 || st === 0xF7) { const ln = vlq(); p += ln; }
      else {
        const kind = st & 0xF0, n = (kind === 0xC0 || kind === 0xD0) ? 1 : 2;
        const a = d[p], b = n > 1 ? d[p + 1] : 0; p += n;
        ev.push([tick, kind, a, b]);
      }
    }
    p = end;
  }
  if (!tempos.length) tempos.push([0, 500000]);
  tempos.sort((x, y) => x[0] - y[0]);
  const sec = (tick) => {
    let s = 0, prev = 0, us = tempos[0][1];
    for (const [tt, u] of tempos) { if (tt >= tick) break; s += (tt - prev) / div * (us / 1e6); prev = tt; us = u; }
    return s + (tick - prev) / div * (us / 1e6);
  };
  ev.sort((a, b) => a[0] - b[0]);
  const notes = [], breath = [];
  for (const [tick, kind, a, b] of ev) {
    if (kind === 0x90 && b > 0) notes.push({ t: sec(tick), p: a, v: b });
    else if (kind === 0xB0 && a === 2) breath.push({ t: sec(tick), v: b });
  }
  return { notes, breath };
}

/* ------------------------------------------------------------------- REPLAY */
function replay(file, train) {
  const { notes, breath } = readMidi(file);
  if (!notes.length) { console.log("  no notes in " + file); return; }
  const T0 = notes[0].t, T1 = notes[notes.length - 1].t, D = T1 - T0;

  const bite   = ZC.Bite.create({ target: 2.0 });
  const ball   = ZC.Bounce.create({ surfaces: [{ rest: 0.52, k: 0.42 }], floor: 0.06 });
  const relay  = ZC.Relay.create({ n: 14, full: 1, reset: 0.12, spill: 0.14,
                                   lag: 0.17, bleed: 0.35, headBleed: 0,
                                   spanMin: 0.9, spanMax: 1.8 });

  const DT = 1 / 120;
  let bi = 0, ni = 0, br = 0, t = T0;
  const why = {}, log = [];
  let bites = 0, impacts = 0, headFires = 0, spanSum = 0, spanN = 0;

  while (t <= T1) {
    while (br < breath.length && breath[br].t <= t) { bi = breath[br].v; br++; }
    while (ni < notes.length && notes[ni].t <= t) {
      const nt = notes[ni];
      const hit = ZC.Bite.note(bite, nt.t, nt.p, bi);
      if (hit) {
        bites++; why[hit.why] = (why[hit.why] || 0) + 1;
        ZC.Relay.note(relay, nt.t);
        /* a cell sets the body's LENGTH to the cell's own duration */
        if (hit.cell && hit.cellSecs > 0.15) ZC.Relay.setInterval(relay, hit.cellSecs / (relay.n - 1));
        ZC.Relay.fill(relay, 1.1 * hit.strength);       /* BITE — the note itself deposits */
        ZC.Bounce.throw_(ball, hit.strength);
        if (train) log.push((nt.t - T0).toFixed(2) + "s  " + hit.why.padEnd(5) +
                            "  str " + hit.strength.toFixed(2) +
                            "  thr " + bite.thr.toFixed(2) +
                            "  span " + ZC.Relay.span(relay).toFixed(2) + "s" +
                            (hit.cell ? "   cell " + hit.cell : ""));
      }
      ni++;
    }
    for (const h of ZC.Bounce.step(ball, DT)) { impacts++; ZC.Relay.fill(relay, 0.55 * h); }
    if (ZC.Relay.step(relay, DT).includes(0)) headFires++;
    spanSum += ZC.Relay.span(relay); spanN++;
    t += DT;
  }

  const name = path.basename(file).replace(/\.mid$/i, "");
  console.log("\n" + name);
  console.log("  " + D.toFixed(0) + "s · " + notes.length + " notes · " +
              (notes.length / D).toFixed(2) + " notes/s");
  console.log("  BITES      " + String(bites).padStart(4) + "  = " + (bites / D).toFixed(2) +
              "/s   (target 2.00)   " +
              Object.entries(why).map(([k, v]) => k + " " + v).join(" · "));
  console.log("  bounce     " + String(impacts).padStart(4) + "  = " + (impacts / D).toFixed(2) + "/s");
  console.log("  head fires " + String(headFires).padStart(4) + "  = " + (headFires / D).toFixed(2) +
              "/s   mean span " + (spanSum / spanN).toFixed(2) + "s   waves in body ~" +
              ((spanSum / spanN) / (D / Math.max(1, headFires))).toFixed(1));
  if (train) { console.log(); log.slice(0, 40).forEach((l) => console.log("    " + l));
               if (log.length > 40) console.log("    ... " + (log.length - 40) + " more"); }
}

const args = process.argv.slice(2);
const train = args.includes("--train");
const files = args.filter((a) => a !== "--train");
if (!files.length) { console.log("\n  usage: node tools\\bite_replay.mjs <file.mid> [...]\n"); process.exit(1); }
console.log("\n  ZIGVERSE — replaying takes through Bite " + ZC.Bite.VERSION +
            " -> Bounce " + ZC.Bounce.VERSION + " -> Relay " + ZC.Relay.VERSION);
files.forEach((f) => replay(f, train));
console.log();

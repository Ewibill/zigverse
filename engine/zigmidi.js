/* =============================================================================
   ZigMidi — recorded performance as a live input (ENGINE module, additive)
   v0.1 · classic script · exposes a global `ZigMidi`

   THE IDEA (Sickle Field build, 2026-07): a Standard MIDI File of a
   performance IS the performance — breath CCs, notes, bends, all of it.
   ZigMidi parses the file and streams its events into ZigCore.Perf.onMsg
   byte-identical to the live instrument, so the engine cannot tell the
   recording from the horn. Consequences:
     · any organism can dance to a captured take, audio synced later
     · export renders become deterministic performances, not sims
     · the LIVE instrument keeps flowing into the same Perf — the performer
       can duet with their own history
   ========================================================================== */
(function (global) {
  "use strict";
  const ZigMidi = global.ZigMidi || (global.ZigMidi = {});
  ZigMidi.VERSION = "0.1.0";

  /* ---- parse — SMF type 0/1, tempo-mapped to seconds -------------------- */
  ZigMidi.parse = function (buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let p = 0;
    const str4 = () => { const s = String.fromCharCode(u8[p], u8[p+1], u8[p+2], u8[p+3]); p += 4; return s; };
    const u32 = () => { const v = dv.getUint32(p); p += 4; return v; };
    const u16 = () => { const v = dv.getUint16(p); p += 2; return v; };

    if (str4() !== "MThd") throw new Error("not a Standard MIDI File");
    const hlen = u32(); u16(); const ntrk = u16(); const div = u16();
    p += hlen - 6;
    if (div & 0x8000) throw new Error("SMPTE division not supported");

    const raw = [];
    for (let tr = 0; tr < ntrk; tr++) {
      if (str4() !== "MTrk") throw new Error("bad track chunk");
      const len = u32(), end = p + len;
      let tick = 0, run = 0, b;
      while (p < end) {
        let d = 0;
        do { b = u8[p++]; d = (d << 7) | (b & 0x7f); } while (b & 0x80);
        tick += d;
        let st = u8[p];
        if (st & 0x80) { p++; if (st < 0xF0) run = st; } else { st = run; }
        if (st === 0xFF) {
          const type = u8[p++]; let ln = 0;
          do { b = u8[p++]; ln = (ln << 7) | (b & 0x7f); } while (b & 0x80);
          if (type === 0x51) raw.push({ tick, tempo: (u8[p] << 16) | (u8[p+1] << 8) | u8[p+2] });
          p += ln;
        } else if (st === 0xF0 || st === 0xF7) {
          let ln = 0;
          do { b = u8[p++]; ln = (ln << 7) | (b & 0x7f); } while (b & 0x80);
          p += ln;
        } else {
          const hi = st & 0xF0;
          const n1 = u8[p++];
          const two = !(hi === 0xC0 || hi === 0xD0);
          raw.push({ tick, data: two ? [st, n1, u8[p++]] : [st, n1] });
        }
      }
    }

    raw.sort((a, b2) => a.tick - b2.tick);
    let tempo = 500000, lastTick = 0, lastSec = 0;
    const events = [];
    for (const e of raw) {
      const sec = lastSec + (e.tick - lastTick) * (tempo / 1e6) / div;
      lastSec = sec; lastTick = e.tick;
      if (e.tempo) tempo = e.tempo;
      else events.push({ t: sec, data: new Uint8Array(e.data) });
    }
    let notes = 0, breathCC = 0;
    for (const e of events) {
      const s = e.data[0] & 0xF0;
      if (s === 0x90 && e.data[2] > 0) notes++;
      if (s === 0xB0 && e.data[1] === 2) breathCC++;
    }
    return { events, duration: lastSec, notes, breathCC };
  };

  /* ---- player — streams into Perf.onMsg on the frame clock -------------- */
  ZigMidi.createPlayer = function (parsed, opts) {
    const o = Object.assign({ loop: true, into: null }, opts || {});
    return {
      t: 0, i: 0, playing: false, duration: parsed.duration,
      notes: parsed.notes, loop: o.loop,
      toggle() { this.playing = !this.playing; return this.playing; },
      stop() { this.playing = false; this.t = 0; this.i = 0; },
      update(dt) {
        if (!this.playing) return;
        this.t += dt;
        const P = o.into || (global.ZigCore && global.ZigCore.Perf);
        while (this.i < parsed.events.length && parsed.events[this.i].t <= this.t) {
          if (P) P.onMsg({ data: parsed.events[this.i].data });
          this.i++;
        }
        if (this.i >= parsed.events.length) {
          if (this.loop) {
            this.t = 0; this.i = 0;
            if (P) { P.held.clear(); P.heldT.clear(); }   // clean rejoin at the top
          } else { this.playing = false; }
        }
      }
    };
  };

})(typeof window !== "undefined" ? window : globalThis);

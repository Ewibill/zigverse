/* ============================================================================
   ZigCore — the Zigverse engine (rendering-agnostic logic core)
   v0.2 · classic script · exposes a global `ZigCore`
   Load BEFORE the renderer and the species:  <script src="zigcore.js"></script>
   (classic script, not an ES module, so it works from file:// on venue nodes.)

   This file is the shared BRAIN — zero DOM, zero WebGL. Renderers (ZigGL / a
   future ZigCanvas) and species sit on top of it. Every organism inherits these
   levers on frame one; you only ever author what is genuinely new.

   Modules (extraction order):
     [x] util        — clamp / lerp / smoothstep / hash
     [x] rng         — deterministic seedable RNG (from Kelp/Jellyfish)
     [x] Perf        — EWI / Web-MIDI breath  → the source of life
     [x] Drive       — breath history + positional DELAY ("swell, not decay")  ← v0.2
     [x] Climate     — slow never-looping metabolism (incommensurate drifts)   ← v0.2
     [x] mode/clock  — 'live' | 'export' + Recorder (deterministic playback)  ← v0.2
     [ ] Flow/Field  — wandering current + queryable field
     [ ] Palette · Contagion · Gait · Agent · Depth · Director · Emerge · Probe
   (v0.2 modules appended below the v0.1 IIFE — extracted during the
    Murmuration build, 2026-07-16.)
   ========================================================================= */
(function (global) {
  "use strict";
  const ZigCore = global.ZigCore || (global.ZigCore = {});
  ZigCore.VERSION = "0.1.0";

  /* ---- util ------------------------------------------------------------- */
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp  = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a || 1e-6), 0, 1); return t * t * (3 - 2 * t); };
  ZigCore.util = { clamp, lerp, smoothstep,
    hash1: (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); } };

  /* ---- rng — deterministic mulberry32 (shared by Kelp & Jellyfish) ------ */
  ZigCore.rng = function (seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    const next = () => { s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    next.seed = (v) => { s = v >>> 0; };
    return next;
  };

  /* ========================================================================
     ZigCore.Perf — the SOURCE OF LIFE.
     Human performance (EWI breath, via Web MIDI) becomes a normalized life-force
     signal every organism reads. Unified from three organisms:
       · Warm Butterfly : CC 2/7/11 → breath, pitch-bend, held notes, idle decay
       · Kelp / Jellyfish: CC2 + channel-pressure, "any CC" diagnostic, sim/idle
     Exposes:
       Perf.breath   0..1  smoothed life-force (live · simulated · idle auto-breath)
       Perf.breathRaw       pre-smoothing (feed the Drive integrator with this)
       Perf.bend     -1..1  pitch-bend (tension / lean)
       Perf.attack   0..1   decaying pulse on each note-on (intention)
       Perf.held     Set    currently-held notes (sustain / commitment)
       Perf.live     bool   a performer is connected & playing
     Call Perf.init(opts) once, Perf.update(dt, t) every frame.
     opts: { idle:true, breathCC:[2,7,11], anyCC:false, onStatus:fn }
     ==================================================================== */
  ZigCore.Perf = {
    breath: 0, breathRaw: 0, bend: 0, attack: 0, live: false, held: new Set(),
    heldT: new Map(), lastNote: -1, holdSec: 0,   // note start-times · most recent note-on · longest current hold (s)
    // diagnostics (for a monitor readout)
    inputs: "none", msgCount: 0, allMsg: 0, lastCC: "—", rawLog: [],
    _sim: 0, _last: 0, _midi: null,
    // gain/curve/smooth: the breath RESPONSE — how the instrument feels.
    // gain scales input · curve is gamma (>1 = more headroom at the top,
    // <1 = touchy) · smooth is the lag rate (higher = snappier)
    _opts: { idle: true, breathCC: [2, 7, 11], anyCC: false, onStatus: null,
             gain: 1, curve: 1, smooth: 7 },

    init(opts) {
      Object.assign(this._opts, opts || {});
      if (!global.navigator || !navigator.requestMIDIAccess) {
        this._status("Web MIDI unavailable (use Chrome)"); return Promise.resolve(false);
      }
      return navigator.requestMIDIAccess({ sysex: false }).then((acc) => {
        this._midi = acc;
        const bind = () => this._bindInputs();
        acc.onstatechange = bind; bind();
        return true;
      }).catch((err) => { this._status("MIDI blocked: " + err); return false; });
    },
    _bindInputs() {
      if (!this._midi) return;
      const names = [];
      this._midi.inputs.forEach((inp) => { inp.onmidimessage = (m) => this.onMsg(m); names.push(inp.name || "input"); });
      this.inputs = names.length ? names.join(", ") : "none";
      this._status(names.length ? ("EWI: " + this.inputs) : "EWI: awaiting device");
    },
    _status(s) { if (this._opts.onStatus) this._opts.onStatus(s); },

    onMsg(e) {
      const d = e && e.data; if (!d) return;
      this.allMsg++;
      // keep a small hex tail for diagnostics
      const hex = Array.from(d).map((b) => b.toString(16).padStart(2, "0")).join(" ");
      this.rawLog.unshift(hex); if (this.rawLog.length > 4) this.rawLog.pop();
      if (d.length < 2) return;
      const st = d[0] & 0xf0, o = this._opts, now = this._nowMs();
      if (st === 0xB0) {                         // control-change
        const cc = d[1], v = d[2] / 127;
        if (o.breathCC.indexOf(cc) >= 0) { this.breathRaw = Math.max(this.breathRaw * 0.55, v); this._hit("CC" + cc + " (breath)", now); }
        else if (o.anyCC) { this.breathRaw = v; this._hit("CC" + cc + " (mapped)", now); }
      } else if (st === 0xD0) {                  // channel pressure (aftertouch) — some EWIs send breath here
        this.breathRaw = d[1] / 127; this._hit("chan-pressure (breath)", now);
      } else if (st === 0xE0) {                  // pitch bend → tension/lean
        this.bend = (((d[2] << 7) | d[1]) - 8192) / 8192;
      } else if (st === 0x90 && d[2] > 0) {      // note on → intention
        this.held.add(d[1]); this.heldT.set(d[1], now); this.lastNote = d[1];
        this.attack = Math.max(this.attack, d[2] / 127); this.live = true; this._last = now;
      } else if (st === 0x80 || (st === 0x90 && d[2] === 0)) { // note off
        this.held.delete(d[1]); this.heldT.delete(d[1]);
      }
    },
    _hit(label, now) { this.lastCC = label; this.msgCount++; this.live = true; this._last = now; },
    _nowMs() { return (global.performance && performance.now) ? performance.now() : 0; },

    // hold-key / test breath (e.g. hold "B") — proves routing when the EWI is silent
    sim(v) { this._sim = clamp(v || 0, 0, 1); },

    update(dt, t) {
      const now = this._nowMs();
      // performer went quiet → let live breath fall away (Warm Butterfly's 1.6s window)
      if (this.live && now - this._last > 1600) { this.live = false; }
      if (this.live) { if (now - this._last > 120) this.breathRaw *= Math.max(0, 1 - dt * 1.2); }
      else if (this._sim > 0) { this.breathRaw = this._sim; }
      else if (this._opts.idle) {               // gentle auto-breath so the organism lives with no performer
        this.breathRaw = 0.22 + 0.16 * Math.sin((t || 0) * 0.28) + 0.08 * Math.sin((t || 0) * 0.09 + 1.3);
      } else { this.breathRaw *= Math.max(0, 1 - dt * 1.2); }
      // holdSec: the longest-running current hold — sustain as COMMITMENT
      let hs = 0; this.heldT.forEach((t0) => { const s = (now - t0) / 1000; if (s > hs) hs = s; });
      this.holdSec = hs;
      const o2 = this._opts;
      const shaped = Math.pow(clamp(this.breathRaw * (o2.gain || 1), 0, 1), o2.curve || 1);
      this.breath += (shaped - this.breath) * clamp(dt * (o2.smooth || 7), 0, 1);
      this.attack *= Math.max(0, 1 - dt * 4);   // intention pulse decays
      return this.breath;
    }
  };

})(typeof window !== "undefined" ? window : globalThis);

/* =============================================================================
   ZigCore v0.2 additions — Drive · Climate · Clock/Mode · Recorder
   Engine work promoted during the Murmuration build (2026-07).
     [x] Drive    — breath history + positional DELAY taps ("swell, not decay").
                    Drive.taps(out, maxDelay) fills a Float32Array for GPU upload:
                    each agent reads the swell at its OWN lag → the swell IS the wave.
     [x] Climate  — slow never-looping metabolism (seeded incommensurate drifts).
     [x] mode/clock — 'live' (wall clock) | 'export' (fixed dt, deterministic).
     [x] Recorder — capture breath/bend/attack timeline → deterministic playback.
   ========================================================================== */
(function (global) {
  "use strict";
  const ZigCore = global.ZigCore;
  if (!ZigCore) return;
  ZigCore.VERSION = "0.2.1";
  const clamp = ZigCore.util.clamp;

  /* ---- Drive — breath history + positional delay --------------------------
     Perf gives the NOW of the breath; Drive gives its PAST. An agent that reads
     tap(delay) where delay = its distance from a disturbance / waveSpeed is
     literally riding the performer's swell as a travelling wave.              */
  ZigCore.Drive = {
    depth: 8, hz: 60,                 // seconds of history · sample rate
    buf: null, n: 0, head: 0, energy: 0, _acc: 0,
    init(opts) {
      Object.assign(this, opts || {});
      this.n = Math.max(2, Math.ceil(this.depth * this.hz));
      this.buf = new Float32Array(this.n); this.head = 0; this.energy = 0; this._acc = 0;
    },
    update(dt) {
      if (!this.buf) this.init();
      const P = ZigCore.Perf, step = 1 / this.hz;
      this._acc += dt;
      while (this._acc >= step) {
        this._acc -= step;
        this.head = (this.head + 1) % this.n;
        this.buf[this.head] = P ? P.breath : 0;
      }
      // energy: slow integrator — the organism's accumulated vitality (swell, not decay)
      const target = P ? P.breath : 0;
      this.energy += (target - this.energy) * Math.min(1, dt * 0.5);
      return this.energy;
    },
    tap(delay) {                       // breath value `delay` seconds ago
      if (!this.buf) return 0;
      const s = clamp(Math.round(delay * this.hz), 0, this.n - 1);
      return this.buf[(this.head - s + this.n) % this.n];
    },
    taps(out, maxDelay) {              // evenly spaced taps 0..maxDelay → GPU uniform
      const m = out.length;
      for (let i = 0; i < m; i++) out[i] = this.tap(maxDelay * i / (m - 1 || 1));
      return out;
    }
  };

  /* ---- Climate — never-looping slow metabolism -----------------------------
     N channels of drift, each a sum of three incommensurate sines with seeded
     periods (minutes-scale). Never returns to its start; perfect for live.
     (Export loops handle this per-piece — see Output Targets doc.)           */
  ZigCore.Climate = {
    t: 0, channels: 6, value: [], _seeds: null,
    init(seed) {
      const r = ZigCore.rng(seed || 7); this._seeds = []; this.value = [];
      for (let i = 0; i < this.channels; i++) {
        this._seeds.push({
          f1: 1 / (45 + r() * 120), f2: 1 / (110 + r() * 300), f3: 1 / (23 + r() * 60),
          p1: r() * 6.283, p2: r() * 6.283, p3: r() * 6.283
        });
        this.value.push(0.5);
      }
    },
    update(dt) {
      if (!this._seeds) this.init();
      this.t += dt; const T = this.t * 6.283;
      for (let i = 0; i < this.channels; i++) {
        const s = this._seeds[i];
        this.value[i] = clamp(0.5
          + 0.25 * Math.sin(T * s.f1 + s.p1)
          + 0.15 * Math.sin(T * s.f2 + s.p2)
          + 0.10 * Math.sin(T * s.f3 + s.p3), 0, 1);
      }
    },
    drift(i) { return this.value.length ? this.value[i % this.channels] : 0.5; }
  };

  /* ---- mode + clock ---------------------------------------------------------
     'live'  : dt from the wall clock (clamped — a hitch never explodes physics)
     'export': fixed dt, decoupled from real time → flawless offline capture   */
  ZigCore.mode = "live";
  ZigCore.clock = {
    fixedDt: 1 / 60, frame: 0, _last: 0,
    tick(nowMs) {
      this.frame++;
      if (ZigCore.mode === "export") return this.fixedDt;
      if (!this._last) this._last = nowMs;
      const dt = (nowMs - this._last) / 1000; this._last = nowMs;
      return clamp(dt, 0, 0.05);
    },
    reset() { this._last = 0; this.frame = 0; }
  };

  /* ---- Recorder — a performance, captured -----------------------------------
     Records Perf per frame; playback overrides Perf deterministically, so an
     export render IS a captured performance, not a sim. Call update() BEFORE
     Perf.update() in the frame loop.                                          */
  ZigCore.Recorder = {
    mode: "off", track: [], _i: 0,
    start() { this.mode = "rec"; this.track = []; },
    stop() { const m = this.mode; this.mode = "off"; return m === "rec" ? this.track : null; },
    play(track) { if (track) this.track = track; this._i = 0; this.mode = "play"; },
    update() {
      const P = ZigCore.Perf; if (!P) return;
      if (this.mode === "rec") {
        this.track.push([P.breathRaw, P.bend, P.attack]);
      } else if (this.mode === "play" && this.track.length) {
        const f = this.track[this._i++ % this.track.length];
        P.breathRaw = f[0]; P.bend = f[1]; P.attack = Math.max(P.attack, f[2]);
        P.live = true; P._last = P._nowMs();   // hold the live window open
      }
    },
    toJSON() { return JSON.stringify(this.track); },
    fromJSON(s) { this.track = JSON.parse(s); }
  };

})(typeof window !== "undefined" ? window : globalThis);

/* =============================================================================
   ZigCore v0.3 additions — Temperament · Turnover
   The "make it breathe" layer (Scout review, Murmuration v1.7). Both are
   ENGINE laws, not species tricks — any organism (fish school, bat exodus,
   kelp, pollen cloud) inherits long-duration mood + gentle membership churn.
     [x] Temperament — minute-scale latent MOOD that quietly biases behavior.
                        Never announced. Deterministic (export-safe).
     [x] Turnover    — anonymous individuals quietly depart & rejoin. The
                        population stays constant; the membership drifts.
                        Preserves leaderlessness: wanderers are never focal.
   ========================================================================== */
(function (global) {
  "use strict";
  const ZigCore = global.ZigCore; if (!ZigCore) return;
  ZigCore.VERSION = "0.3.0";
  const clamp = ZigCore.util.clamp;

  /* ---- Temperament — "this flock feels different today" -------------------
     A few latent axes, each a slow bounded drift (sum of incommensurate sines
     on a MINUTES timescale). The organism maps these axes onto gentle biases
     of its own levers — never onto anything the viewer can name. speed=0
     freezes the mood (useful while judging). Deterministic from seed.        */
  ZigCore.Temperament = {
    axes: 3, speed: 1, t: 0, value: [0.5, 0.5, 0.5], _seeds: null,
    // characteristic periods (seconds) — 2 to 12 minutes, so a 10-20 min
    // session drifts through several unrepeating internal states
    init(seed, opts) {
      Object.assign(this, opts || {});
      const r = ZigCore.rng((seed || 0) ^ 0x7EE9);
      this._seeds = []; this.value = [];
      for (let i = 0; i < this.axes; i++) {
        this._seeds.push({
          f1: 1 / (150 + r() * 250), f2: 1 / (280 + r() * 440), f3: 1 / (95 + r() * 130),
          p1: r() * 6.283, p2: r() * 6.283, p3: r() * 6.283, bias: 0.4 + r() * 0.2
        });
        this.value.push(0.5);
      }
      return this;
    },
    update(dt) {
      if (!this._seeds) this.init(1);
      this.t += dt * this.speed; const T = this.t * 6.283;
      for (let i = 0; i < this.axes; i++) {
        const s = this._seeds[i];
        this.value[i] = clamp(s.bias
          + 0.30 * Math.sin(T * s.f1 + s.p1)
          + 0.16 * Math.sin(T * s.f2 + s.p2)
          + 0.09 * Math.sin(T * s.f3 + s.p3), 0, 1);
      }
    },
    axis(i) { return this.value[i] || 0; },
    set(i, v) { this.value[i] = clamp(v, 0, 1); }   // manual lock / testing
  };

  /* ---- Turnover — gentle membership churn ---------------------------------
     Every so often one anonymous individual quietly leaves (steers to a far
     target); a while later it drifts back from an unexpected edge and rejoins.
     Population is EXACTLY constant (same index re-flocks — the viewer can't
     tell, and there is nothing to follow). The kernel reads the wanderer
     slots and applies a gentle steer override; the departing agent's
     agitation is suppressed so it never becomes a focal event.
     update(dt, count, center[3], radius) → fill via getWanderers().          */
  ZigCore.Turnover = {
    slots: 4, interval: 110, departSec: 22, returnSec: 16, reach: 3.6,
    _t: 0, _timer: 0, _rng: null, _list: null,
    init(seed, opts) {
      Object.assign(this, opts || {});
      this._rng = ZigCore.rng((seed || 0) ^ 0x2A17);
      this._list = [];
      for (let i = 0; i < this.slots; i++) this._list.push({ active: false, idx: -1, phase: "", age: 0, tar: [0, 0, 0], str: 0 });
      this._timer = this.interval * 0.4;   // first departure comes fairly soon
      return this;
    },
    update(dt, count, center, radius) {
      if (!this._list) this.init(1);
      this._t += dt; this._timer -= dt;
      const r = this._rng;
      // schedule a new departure into a free slot
      if (this._timer <= 0 && count > 50) {
        const slot = this._list.find(s => !s.active);
        if (slot) {
          const th = r() * 6.283, ph = (r() - 0.5) * 1.6;
          slot.active = true; slot.phase = "leaving"; slot.age = 0; slot.str = 0.85;
          slot.idx = Math.floor(r() * count);
          slot.tar = [center[0] + Math.cos(th) * Math.cos(ph) * radius * this.reach,
                      center[1] + Math.sin(ph) * radius * (this.reach * 0.5) + radius * 0.6,
                      center[2] + Math.sin(th) * Math.cos(ph) * radius * this.reach];
        }
        this._timer = this.interval * (0.6 + r() * 0.9);
      }
      // advance each active slot
      for (const s of this._list) {
        if (!s.active) continue;
        s.age += dt;
        if (s.phase === "leaving" && s.age > this.departSec) {
          // turn for home from an unexpected edge
          const th = r() * 6.283, ph = (r() - 0.5) * 1.2;
          s.phase = "returning"; s.age = 0; s.str = 0.7;
          s.tar = [center[0] + Math.cos(th) * Math.cos(ph) * radius * 1.15,
                   center[1] + Math.sin(ph) * radius * 0.6 + radius * 0.3,
                   center[2] + Math.sin(th) * Math.cos(ph) * radius * 1.15];
        } else if (s.phase === "returning" && s.age > this.returnSec) {
          s.active = false; s.idx = -1; s.str = 0;   // release → normal cohesion re-flocks it
        }
      }
    },
    getWanderers(idxTar, meta) {   // idxTar,meta : Float32Array(slots*4)
      for (let i = 0; i < this.slots; i++) {
        const s = this._list[i], o = i * 4;
        if (s && s.active) {
          idxTar[o] = s.idx; idxTar[o + 1] = s.tar[0]; idxTar[o + 2] = s.tar[1]; idxTar[o + 3] = s.tar[2];
          meta[o] = s.str; meta[o + 1] = 0; meta[o + 2] = 0; meta[o + 3] = 0;
        } else { idxTar[o] = -1; meta[o] = 0; }
      }
    },
    activeCount() { return this._list ? this._list.filter(s => s.active).length : 0; }
  };

})(typeof window !== "undefined" ? window : globalThis);

/* =============================================================================
   ZigCore v0.4 addition — Pacemaker (the performer's clock)
   Promoted during the Fireflies/Pulse build, 2026-07.

   The anti-"generative art meh" law: the performer does not COMMAND the
   field's rhythm — they become one more oscillator in it, and the field must
   be PERSUADED. Pacemaker maintains a live phase/period estimate of the
   performer's rhythm from note-on times (a phase-locked loop, not a BPM
   detector), plus a CONFIDENCE that rises with steady playing and decays
   with silence or sloppiness. Confidence gates the coupling: play committed
   and the field locks to you; rush or drift and it slips back to its own
   pulse. Losing the field is possible — which is what makes winning it mean
   something.

   Usage: Pacemaker.init() once · Pacemaker.update(dt) every frame AFTER
   Perf.update (it watches Perf for onsets). Read:
     .phase 0..2π (your beat: 0 = the flash-point) · .period s · .bpm
     .confidence 0..1 · .pull (= confidence, gate for coupling) · .beat
   (Export note: Recorder tracks carry breath/bend/attack, not note times —
    pacemaker playback fidelity for export mode is a v2 item.)
   ========================================================================== */
(function (global) {
  "use strict";
  const ZigCore = global.ZigCore; if (!ZigCore) return;
  ZigCore.VERSION = "0.4.0";
  const clamp = ZigCore.util.clamp, lerp = ZigCore.util.lerp;

  ZigCore.Pacemaker = {
    phase: 0, period: 0.75, confidence: 0, pull: 0, beat: false, bpm: 80, omega: 8.38,
    flow: 0,                     // 0..1 streaming intensity — notes INSIDE a ribbon feed this
    _lastOnsetMs: -1, _lastT: -1, _prevT: -1, _pa: 0,
    /* RIBBON LISTENING (from Bill's own telemetry, 2026-07-19): his style is
       "play fast to go slow" — ~10 notes/s bundled into ribbons whose STARTS
       pulse at ~3.4s (18 bpm at phrase level), with deliberate sparse taps
       (~0.75s) as a second vocabulary. So: a note is a BEAT-TAP only when it
       follows silence (> ribbonGap). Notes inside a ribbon feed `flow`.
       The pulse lives in the gaps, not the notes. */
    _opts: { ribbonGap: 0.35, minPeriod: 0.3, maxPeriod: 4.5 },
    init(opts) {
      Object.assign(this._opts, opts || {});
      this.phase = 0; this.confidence = 0; this.flow = 0;
      this._lastOnsetMs = -1; this._lastT = -1; this._prevT = -1; this._pa = 0;
      return this;
    },
    /* every note-on lands here; only gap-preceded ones reach the PLL */
    noteOn(tSec) {
      const gap = this._prevT < 0 ? 1e9 : tSec - this._prevT;
      this._prevT = tSec;
      this.flow = Math.min(1, this.flow + 0.12);
      if (gap > this._opts.ribbonGap) this._onset(tSec);
    },
    _now() { return (global.performance && performance.now) ? performance.now() : 0; },

    _onset(tSec) {
      if (this._lastT >= 0) {
        const ioi = tSec - this._lastT;
        if (ioi > 0.12 && ioi < 20.0) {
          /* harmonic snap: a double/quadruple-length phrase is still YOUR
             pulse (a 16.7s mega-ribbon ≈ 5 × the 3.4s phrase beat) */
          const ratio = ioi / this.period;
          const mult = Math.round(ratio);
          let cand = (mult >= 1 && mult <= 6 && Math.abs(ratio - mult) < 0.25 * mult) ? ioi / mult : ioi;
          cand = clamp(cand, this._opts.minPeriod, this._opts.maxPeriod);
          this.period = lerp(this.period, cand, this.confidence > 0.4 ? 0.22 : 0.45);
          /* phase error at the onset — you tapped: how far were we from 0? */
          let e = this.phase % 6.28318; if (e > 3.14159) e -= 6.28318;
          this.phase -= e * 0.55;                       // snap toward your beat
          /* accuracy → confidence, ASYMMETRIC: only taps that land where the
             field predicted (>70% accurate) build trust; surprises spend it
             faster than accuracy earns it. Random tapping averages ~50% —
             the field cannot be fooled. */
          const acc = 1 - Math.min(Math.abs(e) / 3.14159, 1);
          this.confidence = clamp(this.confidence +
            (acc > 0.7 ? (acc - 0.7) * 0.55 : -(0.7 - acc) * 0.4), 0, 1);
        }
      }
      this._lastT = tSec;
    },

    update(dt) {
      const P = ZigCore.Perf;
      /* onset detection: newest note-on start from Perf's own ledger */
      if (P) {
        let newest = -1;
        P.heldT.forEach((t0) => { if (t0 > newest) newest = t0; });
        if (newest > this._lastOnsetMs + 40) { this._lastOnsetMs = newest; this.noteOn(newest / 1000); }
        else if (P.attack > this._pa + 0.22) {          // fallback: attack rising edge
          const now = this._now();
          if (now > this._lastOnsetMs + 60) { this._lastOnsetMs = now; this.noteOn(now / 1000); }
        }
        this._pa = P.attack;
      }
      this.flow *= Math.exp(-dt / 0.8);                 // streaming intensity fades in ~1s of quiet
      /* advance your clock; silence loosens the grip */
      const prev = this.phase;
      this.phase += (6.28318 / Math.max(this.period, 0.05)) * dt;
      this.beat = this.phase >= 6.28318;
      if (this.beat) this.phase -= 6.28318;
      const idleFor = this._lastT < 0 ? 1e9 : (this._now() / 1000 - this._lastT);
      /* a streaming ribbon is not silence — don't punish the mega-phrase */
      if (idleFor > this.period * 2 && this.flow < 0.12) this.confidence *= Math.exp(-dt / 2.5);
      this.pull = this.confidence;
      this.bpm = 60 / Math.max(this.period, 0.05);
      this.omega = 6.28318 / Math.max(this.period, 0.05);   // your beat as rad/s —
      // species use it for FREQUENCY ADAPTATION (real fireflies shift their
      // intrinsic rate toward a driver; phase pull then does fine alignment)
      return this.phase;
    }
  };

  /* ==========================================================================
     ZIGTIMBRE (v0.5 · 2026-07-20) — the horn's ACTUAL VOICE as telemetry.
     MIDI hears the valves; Timbre hears the AIR. A WebAudio analyser on the
     interface input (MOTU M2) distills the sound into three life-force
     channels, all 0..1, smoothed with the crisp-AND-smooth dual-envelope
     idiom:
       body       — RMS loudness: how much horn is in the room
       brightness — spectral centroid, log-mapped 200 Hz → 8 kHz: growl vs shine
       flux       — positive spectral change: articulation, flutter, attack
                    of the SOUND itself (fires even between MIDI notes)
     The pure math lives in _analyze() — testable in Node with synthesized
     frames; the browser plumbing lives in arm(). Species call update(dt)
     once per REAL-time frame, exactly like Perf.
     ======================================================================= */
  ZigCore.Timbre = {
    live: false, device: "", err: "",
    body: 0, brightness: 0, flux: 0, noisiness: 0, low: 0, high: 0,
    _ctx: null, _an: null, _freq: null, _fNorm: null, _time: null, _prev: null, _hasPrev: false,

    /* PURE analysis — freq: Float32Array linear magnitudes 0..1 per bin ·
       time: Float32Array samples −1..1 · prev: previous freq frame or null */
    _analyze(freq, time, sampleRate, prev) {
      let sum2 = 0;
      for (let i = 0; i < time.length; i++) sum2 += time[i] * time[i];
      const body = Math.min(1, Math.sqrt(sum2 / time.length) * 3.2);
      /* brightness centroid weights only bins ABOVE the room floor (0.45).
         Calibrated against Jimmy's live-gig recording (2026-07-21): without
         the floor, a real room — crowd, band, reverb — fills every bin and
         pins the centroid high; with it, brightness tracks the VOICES, not
         the wash (expressive spread ×3.4 on the fixture). */
      let mSum = 0, fSum = 0;
      const hzPerBin = sampleRate / 2 / freq.length;
      for (let i = 1; i < freq.length; i++) {
        const w = freq[i] - 0.45;
        if (w > 0) { mSum += w; fSum += w * i * hzPerBin; }
      }
      let brightness = 0;
      if (mSum > 1e-4) {
        const centroid = fSum / mSum;
        brightness = Math.min(1, Math.max(0, Math.log2(Math.max(centroid, 200) / 200) / Math.log2(8000 / 200)));
      }
      /* flux is RELATIVE — positive spectral change over the energy that was
         already there. Scale-invariant: the M2's gain knob changes nothing.
         Per-bin floor 0.04 keeps line noise from ever reading as a strike. */
      let flux = 0;
      if (prev) {
        let rise = 0, eSum = 0;
        for (let i = 1; i < freq.length; i++) {
          const d = freq[i] - prev[i];
          if (d > 0.04) rise += d;
          eSum += prev[i];
        }
        flux = Math.min(1, rise / (eSum + 2.0));
      }
      /* NOISINESS — spectral flatness (geometric ÷ arithmetic mean) over 100 Hz–8 kHz.
         A pure pitch concentrates energy in a few bins → flatness ≈ 0; breath and
         air spread it across the band → flatness ≈ 1. The one perceptual axis MIDI
         structurally cannot carry (breathy vs pure). LOW/HIGH — the spectral balance:
         energy below 250 Hz (body/depth) vs above 2 kHz (air/brilliance), as fractions. */
      let lg = 0, ln = 0, nb = 0, eLow = 0, eHigh = 0, eTot = 0;
      for (let i = 1; i < freq.length; i++) {
        const hz = i * hzPerBin, m = freq[i];
        if (hz >= 100 && hz <= 8000) { lg += Math.log(m + 1e-6); ln += m + 1e-6; nb++; }
        if (hz < 250) eLow += m; else if (hz > 2000) eHigh += m;
        eTot += m;
      }
      const noisiness = nb > 0 ? Math.min(1, Math.max(0, Math.exp(lg / nb) / (ln / nb))) : 0;
      const low  = eTot > 1e-4 ? eLow / eTot : 0;
      const high = eTot > 1e-4 ? eHigh / eTot : 0;
      return { body, brightness, flux, noisiness, low, high };
    },

    /* SPLIT VOICES (v0.5.1): a stereo cable is TWO instruments. When armed
       with {split:true}, the left and right channels get their own analysers
       and their own body/brightness/flux — so a DAW can pan stem A hard left
       and stem B hard right, and one world hears two performers distinctly.
       Timbre.L / Timbre.R carry the split voices; the top-level fields stay
       the mono mix (every existing mapping keeps working untouched). */
    L: null, R: null,
    _mkVoice() {
      return { body: 0, brightness: 0, flux: 0, noisiness: 0, low: 0, high: 0,
        _an: null, _freq: null, _fNorm: null, _time: null, _prev: null, _hasPrev: false };
    },

    /* browser side — ask for the interface input (prefers a device whose
       label matches hint — a RegExp or string, default /M2|MOTU/i), with no
       browser DSP in the way */
    async arm(hint, opts) {
      const md = (typeof navigator !== "undefined") && navigator.mediaDevices;
      if (!md) { this.err = "no mediaDevices in this venue"; return false; }
      const want = typeof hint === "string" ? new RegExp(hint, "i") : (hint || /M2|MOTU/i);
      const gUM = (id) => md.getUserMedia({ audio: {
        deviceId: id ? { exact: id } : undefined,
        echoCancellation: false, noiseSuppression: false, autoGainControl: false
      } });
      try {
        let stream = await gUM();                       // permission first — labels unlock after
        try {
          const devs = await md.enumerateDevices();
          const hit = devs.find((d) => d.kind === "audioinput" && want.test(d.label || ""));
          const cur = (stream.getAudioTracks()[0] || {}).label || "";
          if (hit && !want.test(cur)) {                 // default wasn't the M2 — switch to it
            stream.getTracks().forEach((t) => t.stop());
            stream = await gUM(hit.deviceId);
          }
        } catch (e) { /* keep the default input */ }
        const AC = global.AudioContext || global.webkitAudioContext;
        this._ctx = new AC();
        const src = this._ctx.createMediaStreamSource(stream);
        const rig = (v) => {
          v._an = this._ctx.createAnalyser();
          v._an.fftSize = 2048; v._an.smoothingTimeConstant = 0;   // our envelopes, not theirs
          v._freq = new Uint8Array(v._an.frequencyBinCount);
          v._fNorm = new Float32Array(v._an.frequencyBinCount);
          v._prev = new Float32Array(v._an.frequencyBinCount);
          v._time = new Float32Array(v._an.fftSize);
          v._hasPrev = false;
        };
        rig(this);
        src.connect(this._an);                       // mono mix — the compatible voice
        if (opts && opts.split) {
          const sp = this._ctx.createChannelSplitter(2);
          src.connect(sp);
          this.L = this._mkVoice(); this.R = this._mkVoice();
          rig(this.L); rig(this.R);
          sp.connect(this.L._an, 0); sp.connect(this.R._an, 1);
        } else { this.L = null; this.R = null; }
        this.device = (stream.getAudioTracks()[0] || {}).label || "audio input";
        if (this._ctx.state === "suspended") this._ctx.resume();
        this.live = true; this.err = "";
        return true;
      } catch (e) { this.err = String((e && e.message) || e); this.live = false; return false; }
    },

    _tick(v, dt) {
      v._an.getByteFrequencyData(v._freq);
      v._an.getFloatTimeDomainData(v._time);
      for (let i = 0; i < v._freq.length; i++) v._fNorm[i] = v._freq[i] / 255;
      const raw = this._analyze(v._fNorm, v._time, this._ctx.sampleRate, v._hasPrev ? v._prev : null);
      v._prev.set(v._fNorm); v._hasPrev = true;
      const dtc = dt || 1 / 60;
      v.body += (raw.body - v.body) * Math.min(1, dtc * (raw.body > v.body ? 22 : 6));   // crisp rise, smooth fall
      v.brightness += (raw.brightness - v.brightness) * Math.min(1, dtc * 9);
      v.flux = Math.max(raw.flux, v.flux * Math.exp(-dtc / 0.35));                       // spikes, then drains
      v.noisiness += (raw.noisiness - v.noisiness) * Math.min(1, dtc * 9);
      v.low += (raw.low - v.low) * Math.min(1, dtc * 9);
      v.high += (raw.high - v.high) * Math.min(1, dtc * 9);
    },

    update(dt) {
      if (!this.live || !this._an) return;
      this._tick(this, dt);
      if (this.L) { this._tick(this.L, dt); this._tick(this.R, dt); }
    }
  };
  /* ==========================================================================
     ZC.AMBIENCE (v0.1) — the ATMOSPHERE BUS. MIDI drives the organism; Ambience
     lets the PROCESSED SOUND drive the ENVIRONMENT. It layers on Timbre (the raw
     air): energy/brightness/flux come straight from it, plus noisiness/low/high,
     plus two TEMPORAL derivations the environment lives on — TAIL (a slow-release
     follower: the reverb still ringing after you stop) and ONSET (the attack).
     read() → one 8-number vector any environment subscribes to. Source is 'live'
     (Timbre) or 'synth' (a deterministic phrase — so the whole bus can be built
     and judged BEFORE the audio cabling exists). Same socket, either current.
     Arm + update via Ambience; do NOT also update Timbre when live.
     ======================================================================= */
  ZigCore.Ambience = {
    src: "off",                 // "off" | "live" | "synth"
    energy: 0, brightness: 0, flux: 0, noisiness: 0, low: 0, high: 0, tail: 0, onset: 0,
    _tail: 0, _t: 0,

    async arm(hint, opts) { const ok = await ZigCore.Timbre.arm(hint, opts); if (ok) this.src = "live"; return ok; },
    synth(on) { this.src = (on === false) ? "off" : "synth"; if (this.src === "synth") this._t = 0; return this; },
    off() { this.src = "off"; return this; },

    /* PURE temporal derivation: energy/flux + previous tail + dt → {tail, onset}.
       tail rises instantly to energy, then releases slowly (~1.6 s) — it OUTLIVES
       the note the way a reverb does, which is what makes the §5 divergence real. */
    _derive(energy, flux, tailPrev, dt) {
      const tail = energy > tailPrev ? energy : tailPrev * Math.exp(-dt / 1.6);
      return { tail, onset: flux };
    },

    /* PURE deterministic synthetic phrase (no RNG → replayable). A ~7 s loop:
       a breath swell (attack → sustain → release) then SILENCE, so the environment
       can be watched ringing on the tail after the 'note' stops. brightness and
       noisiness drift on their own slow cycles — the colour and the mist breathe. */
    _synthAt(t) {
      const LEN = 7.0, p = ((t % LEN) + LEN) % LEN;
      let env = 0;
      if (p < 1.2) env = p / 1.2;                     // attack
      else if (p < 3.5) env = 1.0;                    // sustain
      else if (p < 4.6) env = 1.0 - (p - 3.5) / 1.1;  // release
      else env = 0.0;                                 // silence — the tail rings here
      const brightness = 0.5 + 0.42 * Math.sin(6.2831 * 0.055 * t);
      const noisiness = Math.min(1, 0.18 + 0.65 * Math.max(0, Math.sin(6.2831 * 0.09 * t + 0.6)));
      return {
        body: 0.05 + 0.9 * env,
        brightness, flux: (p < 0.10) ? 1.0 : 0.0,     // the attack strike
        noisiness,
        low: Math.min(1, 0.30 + 0.5 * (1 - brightness) * env),
        high: Math.min(1, 0.25 + 0.6 * brightness * env)
      };
    },

    update(dt) {
      const d = dt || 1 / 60;
      let raw;
      if (this.src === "synth") { this._t += d; raw = this._synthAt(this._t); }
      else if (this.src === "live") {
        ZigCore.Timbre.update(d); const T = ZigCore.Timbre;
        raw = { body: T.body, brightness: T.brightness, flux: T.flux, noisiness: T.noisiness, low: T.low, high: T.high };
      } else return;
      const der = this._derive(raw.body, raw.flux, this._tail, d); this._tail = der.tail;
      this.energy = raw.body; this.brightness = raw.brightness; this.flux = raw.flux;
      this.noisiness = raw.noisiness; this.low = raw.low; this.high = raw.high;
      this.tail = der.tail; this.onset = der.onset;
    },

    read() {
      return { energy: this.energy, brightness: this.brightness, flux: this.flux,
        noisiness: this.noisiness, low: this.low, high: this.high, tail: this.tail, onset: this.onset };
    }
  };

  /* ==========================================================================
     ZC.AMBIENCEMAP (v0.1) — the §4 mapping. Each environment lever is a LEAKY
     INTEGRATOR the features perturb; it relaxes toward base on its own, so the
     world keeps its own inertia (emergence, not a level meter). glow rides TAIL
     with a slow k, so the afterglow LINGERS after the organism stills (§5). Pure
     math; a file reads .lev each frame and writes it into its OWN env uniforms.
     ======================================================================= */
  ZigCore.AmbienceMap = {
    PROFILE: { tempK: 1.6, mistK: 1.3, turbK: 2.2, lumK: 1.9, glowK: 0.6, lowK: 1.1, highK: 1.5 },
    lev: { temp: 0.5, mist: 0, turb: 0, lum: 0, glow: 0, low: 0, high: 0, flash: 0 },
    reset() { this.lev = { temp: 0.5, mist: 0, turb: 0, lum: 0, glow: 0, low: 0, high: 0, flash: 0 }; return this; },
    step(A, dt, profile) {
      const P = profile || this.PROFILE, d = dt || 1 / 60, L = this.lev;
      const li = (cur, tgt, k) => cur + (tgt - cur) * Math.min(1, d * k);
      L.temp = li(L.temp, A.brightness, P.tempK);   // §4 colour temperature
      L.mist = li(L.mist, A.noisiness, P.mistK);    // §4 mist
      L.turb = li(L.turb, A.flux, P.turbK);         // §4 turbulence
      L.lum  = li(L.lum,  A.energy, P.lumK);        // §4 luminosity
      L.glow = li(L.glow, A.tail, P.glowK);         // §5 afterglow — slow, so it lingers
      L.low  = li(L.low,  A.low, P.lowK);
      L.high = li(L.high, A.high, P.highK);
      L.flash = Math.max(A.onset, L.flash * Math.exp(-d / 0.25));   // §5 impulse flash
      return L;
    }
  };

  /* ==========================================================================
     ZC.NOTEFIELD (v0.1) — the NOTE INTERPRETER (first facet: MELODIC STRATA).
     A note is not one signal but a bundle; this reads the facet "pitch → PLACE +
     pitch-class → COLOUR" and holds it as a fading band. Works in (y, hue) space —
     the SPECIES owns the musical mapping (pitch → world height, pitch-class → hue)
     and calls note(y, hue); NoteField decays the bands and packs them for the
     shader's noteBands[6]. Pure & Node-testable. The seed of a fuller interpreter
     (interval → force, duration → commitment, harmony → relationship) to come.
     ======================================================================= */
  ZigCore.NoteField = {
    MAX: 6, DECAY: 2.2,            // up to 6 live bands · ~2.2 s ring-down (play fast → the trail lingers into a slow tapestry)
    bands: [],
    reset() { this.bands = []; return this; },
    /* deposit a band: y = world height (from pitch) · hue 0..1 (from pitch class) · e = energy */
    note(y, hue, energy) {
      this.bands.push({ y: y, hue: ((hue % 1) + 1) % 1, e: (energy == null ? 1 : energy) });
      if (this.bands.length > this.MAX) this.bands.shift();   // newest crowd out oldest
      return this;
    },
    update(dt) {
      const d = dt || 1 / 60, k = Math.exp(-d / this.DECAY);
      for (let i = 0; i < this.bands.length; i++) this.bands[i].e *= k;
      this.bands = this.bands.filter((b) => b.e > 0.02);       // cull the faded
      return this;
    },
    /* pack up to MAX bands into arr at float offset off, as (y, hue, e, 0) per band. */
    pack(arr, off) {
      for (let i = 0; i < this.MAX; i++) {
        const b = this.bands[i], o = off + i * 4;
        arr[o] = b ? b.y : 0; arr[o + 1] = b ? b.hue : 0; arr[o + 2] = b ? b.e : 0; arr[o + 3] = 0;
      }
      return arr;
    }
  };
  /* ==========================================================================
     THE COLOR ECOLOGY (v0.6 · Scout's physiology, 2026-07-21)
     "Living systems don't have colors. They occupy color over time."
     Four layers: MATERIAL (what it's made of — near-constant) · STRUCTURAL
     (the geometric iridescence — always present, varying in willingness) ·
     EMOTIONAL (Mood: what the organism feels) · EVENT (Reserve: the rarest
     color — the audience earns it). All CPU-side laws feeding the existing
     view uniforms: zero shader risk, every world can inherit.
     ======================================================================= */

  /* LAYER 1 — MATERIALS. Not hue: substance. dark = the dome that swallows
     light · light = the hollow that holds it · moon = how moonlight lands ·
     iriBase = how willing the rainbow is at rest · iriBurst = how far a
     Reserve spend can take it (the hummingbird ceiling). */
  /* THE MATERIAL LAW (v0.6.1 · Bill, 2026-07-23): "The organism isn't
     painted. It is COMPOSED." Every material carries a composition profile —
     tex: [grain, gscale, gdepth, specPow, specGain, fiber, sss, weather]
       grain    0 none · 1 facets (crystal/mineral/glass) · 2 fibers
                (wood/nacre/silk — run ALONG the letter) · 3 pores
                (coral/volcanic/tissue — sit IN the skin)
       gscale   how fine the microstructure is (cells per letter-length)
       gdepth   how far it bends the light (0 = polished film)
       specPow  highlight sharpness: 6 velvet → 140 glass
       specGain highlight strength
       fiber    grain visibility in the body tone (brushed/striped look)
       sss      subsurface — light passing THROUGH: bone, nacre, tissue glow
                on their shadow side
       weather  age: mottle and history on the surface (crystal has none)
     All in the letterform's OWN coordinates — texture anchored to flesh,
     never to screen. */
  ZigCore.Materials = {
    /* the original cabinet, now composed */
    pearl:     { dark: [0.100, 0.104, 0.118], light: [0.880, 0.868, 0.836], moon: [0.50, 0.55, 0.70], iriBase: 0.10, iriBurst: 2.6, tex: [2, 16, 0.08, 34, 0.50, 0.10, 0.50, 0.00] },
    bone:      { dark: [0.110, 0.104, 0.092], light: [0.820, 0.790, 0.700], moon: [0.52, 0.53, 0.60], iriBase: 0.06, iriBurst: 1.6, tex: [3, 20, 0.12, 12, 0.20, 0.00, 0.40, 0.15] },
    obsidian:  { dark: [0.016, 0.016, 0.022], light: [0.280, 0.265, 0.300], moon: [0.42, 0.44, 0.58], iriBase: 0.04, iriBurst: 2.9, tex: [1, 5, 0.22, 120, 1.30, 0.00, 0.05, 0.05] },
    ice:       { dark: [0.055, 0.085, 0.115], light: [0.800, 0.880, 0.950], moon: [0.55, 0.62, 0.78], iriBase: 0.14, iriBurst: 2.2, tex: [1, 9, 0.28, 70, 0.90, 0.00, 0.55, 0.00] },
    copper:    { dark: [0.085, 0.048, 0.028], light: [0.850, 0.560, 0.310], moon: [0.62, 0.50, 0.38], iriBase: 0.08, iriBurst: 2.0, tex: [2, 40, 0.20, 50, 1.00, 0.45, 0.00, 0.25] },   // burnished — Scout's companion metal
    moonstone: { dark: [0.070, 0.075, 0.105], light: [0.760, 0.780, 0.860], moon: [0.48, 0.54, 0.74], iriBase: 0.18, iriBurst: 2.4, tex: [2, 12, 0.08, 30, 0.45, 0.05, 0.70, 0.00] },
    moss:      { dark: [0.085, 0.105, 0.060], light: [0.820, 0.790, 0.700], moon: [0.46, 0.53, 0.72], iriBase: 0.35, iriBurst: 1.8, tex: [3, 18, 0.25, 14, 0.25, 0.00, 0.20, 0.30] },   // the classic register
    smoke:     { dark: [0.060, 0.060, 0.065], light: [0.480, 0.470, 0.475], moon: [0.40, 0.42, 0.50], iriBase: 0.05, iriBurst: 1.4, tex: [0, 0, 0.00, 5, 0.08, 0.00, 0.30, 0.20] },
    /* the new families (Bill's list, 2026-07-23) */
    volcanic:  { dark: [0.050, 0.034, 0.028], light: [0.360, 0.225, 0.180], moon: [0.55, 0.42, 0.34], iriBase: 0.04, iriBurst: 1.8, tex: [3, 26, 0.50, 8, 0.15, 0.00, 0.30, 0.55] },   // porous, aged; the ember is INSIDE
    crystal:   { dark: [0.060, 0.080, 0.100], light: [0.750, 0.820, 0.920], moon: [0.55, 0.60, 0.78], iriBase: 0.30, iriBurst: 2.8, tex: [1, 7, 0.55, 90, 1.20, 0.00, 0.18, 0.00] },   // facets flash one face at a time
    nacre:     { dark: [0.120, 0.115, 0.130], light: [0.920, 0.900, 0.880], moon: [0.55, 0.58, 0.72], iriBase: 0.55, iriBurst: 2.9, tex: [2, 18, 0.16, 26, 0.50, 0.15, 0.65, 0.00] },   // mother-of-pearl: wave-grain + deep glow
    wood:      { dark: [0.110, 0.070, 0.040], light: [0.620, 0.450, 0.280], moon: [0.58, 0.48, 0.36], iriBase: 0.02, iriBurst: 0.8, tex: [2, 30, 0.30, 6, 0.12, 0.65, 0.05, 0.35] },   // fibers run the length; matte, warm, old
    coral:     { dark: [0.140, 0.060, 0.058], light: [0.880, 0.550, 0.500], moon: [0.60, 0.48, 0.46], iriBase: 0.08, iriBurst: 1.6, tex: [3, 34, 0.45, 10, 0.20, 0.00, 0.30, 0.25] },   // built by lives, pore by pore
    ceramic:   { dark: [0.100, 0.100, 0.110], light: [0.860, 0.830, 0.780], moon: [0.54, 0.55, 0.62], iriBase: 0.05, iriBurst: 1.2, tex: [0, 0, 0.00, 60, 0.80, 0.00, 0.08, 0.06] },   // deep body color, quiet, warm
    chitin:    { dark: [0.050, 0.060, 0.040], light: [0.450, 0.520, 0.300], moon: [0.48, 0.55, 0.44], iriBase: 0.32, iriBurst: 2.2, tex: [2, 10, 0.10, 45, 0.90, 0.10, 0.20, 0.15] },   // beetle-shell wax, oiled sheen
    glass:     { dark: [0.040, 0.050, 0.060], light: [0.550, 0.620, 0.660], moon: [0.58, 0.64, 0.74], iriBase: 0.45, iriBurst: 2.6, tex: [1, 3, 0.12, 140, 1.50, 0.00, 0.50, 0.00] },   // razor highlight, cold clarity
    tissue:    { dark: [0.160, 0.080, 0.090], light: [0.850, 0.620, 0.600], moon: [0.62, 0.50, 0.50], iriBase: 0.10, iriBurst: 1.6, tex: [3, 14, 0.15, 18, 0.35, 0.00, 0.85, 0.10] },   // living: the light gets IN
    botanical: { dark: [0.060, 0.100, 0.050], light: [0.550, 0.720, 0.350], moon: [0.48, 0.58, 0.42], iriBase: 0.10, iriBurst: 1.8, tex: [2, 22, 0.25, 22, 0.40, 0.35, 0.45, 0.20] },   // leaf veins, chlorophyll glow
    mineral:   { dark: [0.080, 0.075, 0.070], light: [0.580, 0.550, 0.500], moon: [0.52, 0.51, 0.50], iriBase: 0.12, iriBurst: 1.8, tex: [1, 12, 0.35, 30, 0.50, 0.00, 0.00, 0.40] }    // stone: faceted, opaque, patient
  };

  /* ---- FABRICS — the UNDERSIDE library (v0.29): textiles that line the concave
     interior of each letter. A fabric is a WEAVE (the micro-pattern that tilts the
     surface) + a SHEEN model (how it catches light) + how deep/matte it sits + a
     characteristic colour. Front stays pearl/nacre; the back can be any of these.
       weave  : pile · twill · rib · plain · slub · smooth · herring
       sheen  : retro (velvet grazing glow) · spec (silk/satin highlight) · metal · matte
       fields : { weave, wscale, wdepth, sheen, spow, sgain, base, hue }  (hue 0..1, null = use ZIG_BACKHUE) */
  ZigCore.Fabrics = {
    velvet:      { weave: "pile",   wscale: 42, wdepth: 0.45, sheen: "retro", spow: 1.4, sgain: 0.85, base: 0.55, hue: 0.98 },  // deep pile, strong grazing bloom
    silk:        { weave: "smooth", wscale: 0,  wdepth: 0.0,  sheen: "spec",  spow: 44,  sgain: 0.75, base: 0.42, hue: 0.11 },  // lustrous, liquid highlight
    satin:       { weave: "smooth", wscale: 0,  wdepth: 0.0,  sheen: "spec",  spow: 95,  sgain: 1.05, base: 0.34, hue: 0.55 },  // sharp glossy sheen
    denim:       { weave: "twill",  wscale: 60, wdepth: 0.55, sheen: "matte", spow: 8,   sgain: 0.10, base: 0.62, hue: 0.62 },  // indigo diagonal twill
    linen:       { weave: "slub",   wscale: 34, wdepth: 0.42, sheen: "matte", spow: 8,   sgain: 0.12, base: 0.52, hue: 0.12 },  // natural slubby weave
    suede:       { weave: "pile",   wscale: 22, wdepth: 0.30, sheen: "retro", spow: 2.6, sgain: 0.5,  base: 0.55, hue: 0.07 },  // soft broad nap
    felt:        { weave: "pile",   wscale: 12, wdepth: 0.22, sheen: "matte", spow: 4,   sgain: 0.06, base: 0.6,  hue: 0.0  },  // dense, dead matte
    corduroy:    { weave: "rib",    wscale: 26, wdepth: 0.6,  sheen: "retro", spow: 2.0, sgain: 0.5,  base: 0.55, hue: 0.08 },  // vertical ribs catch light
    leather:     { weave: "plain",  wscale: 30, wdepth: 0.35, sheen: "spec",  spow: 20,  sgain: 0.4,  base: 0.46, hue: 0.05 },  // fine grain, semi-gloss
    wool:        { weave: "pile",   wscale: 30, wdepth: 0.45, sheen: "matte", spow: 5,   sgain: 0.12, base: 0.55, hue: 0.09 },  // soft, fuzzy, matte
    cashmere:    { weave: "pile",   wscale: 20, wdepth: 0.25, sheen: "retro", spow: 3.2, sgain: 0.38, base: 0.46, hue: 0.10 },  // fine, gentle halo
    canvas:      { weave: "plain",  wscale: 46, wdepth: 0.42, sheen: "matte", spow: 6,   sgain: 0.12, base: 0.55, hue: 0.12 },  // coarse plain weave
    burlap:      { weave: "plain",  wscale: 22, wdepth: 0.62, sheen: "matte", spow: 5,   sgain: 0.10, base: 0.6,  hue: 0.11 },  // rough, open weave
    tweed:       { weave: "slub",   wscale: 40, wdepth: 0.5,  sheen: "matte", spow: 6,   sgain: 0.14, base: 0.55, hue: 0.09 },  // flecked, coarse
    taffeta:     { weave: "smooth", wscale: 0,  wdepth: 0.0,  sheen: "spec",  spow: 62,  sgain: 0.9,  base: 0.32, hue: 0.44 },  // crisp shimmer
    organza:     { weave: "smooth", wscale: 0,  wdepth: 0.0,  sheen: "retro", spow: 1.1, sgain: 0.6,  base: 0.20, hue: 0.5  },  // sheer, edge-lit
    brocade:     { weave: "twill",  wscale: 30, wdepth: 0.5,  sheen: "spec",  spow: 30,  sgain: 0.7,  base: 0.4,  hue: 0.9  },  // raised lustrous pattern
    lame:        { weave: "smooth", wscale: 0,  wdepth: 0.0,  sheen: "metal", spow: 80,  sgain: 1.4,  base: 0.32, hue: 0.13 },  // metallic cloth
    chiffon:     { weave: "smooth", wscale: 0,  wdepth: 0.0,  sheen: "retro", spow: 1.7, sgain: 0.42, base: 0.18, hue: 0.83 },  // soft sheer veil
    herringbone: { weave: "herring",wscale: 40, wdepth: 0.45, sheen: "matte", spow: 6,   sgain: 0.15, base: 0.55, hue: 0.6  }   // zigzag suiting
  };

  /* ---- GEMS — materials that PLAY with light (v0.30): refraction (the view bends
     through the stone, deepened by its colour), DISPERSION/fire (that refraction split
     into R·G·B = the rainbow flash), FRESNEL (mirror rim, clear face), FACET flash and
     SPARKLE. All sampled from the world's own sky+moon, so it shimmers as the field turns.
       col   : the gem's body/absorption colour (what survives the light passing through)
       ior   : index of refraction — how hard the view bends (diamond 2.42 → glass 1.5)
       disp  : dispersion / fire — how far R·G·B split (diamond throws the most)
       facet : facet-flash strength · spark : scintillation strength */
  ZigCore.Gems = {
    diamond:    { col: [0.93, 0.96, 1.00], ior: 2.42, disp: 0.045, facet: 1.00, spark: 1.00 },
    ruby:       { col: [0.86, 0.08, 0.17], ior: 1.77, disp: 0.016, facet: 0.85, spark: 0.70 },
    sapphire:   { col: [0.12, 0.28, 0.92], ior: 1.77, disp: 0.016, facet: 0.85, spark: 0.70 },
    emerald:    { col: [0.10, 0.80, 0.42], ior: 1.58, disp: 0.014, facet: 0.60, spark: 0.42 },
    amethyst:   { col: [0.56, 0.32, 0.90], ior: 1.55, disp: 0.013, facet: 0.75, spark: 0.60 },
    topaz:      { col: [1.00, 0.72, 0.22], ior: 1.62, disp: 0.015, facet: 0.80, spark: 0.70 },
    aquamarine: { col: [0.46, 0.88, 0.93], ior: 1.58, disp: 0.014, facet: 0.72, spark: 0.62 },
    garnet:     { col: [0.74, 0.10, 0.09], ior: 1.79, disp: 0.024, facet: 0.80, spark: 0.68 },
    citrine:    { col: [0.98, 0.78, 0.20], ior: 1.55, disp: 0.014, facet: 0.75, spark: 0.66 },
    peridot:    { col: [0.60, 0.85, 0.20], ior: 1.65, disp: 0.020, facet: 0.72, spark: 0.60 }
  };

  /* LAYER 3 — MOOD: the emotional metabolism. Reads the same telemetry the
     body reads (breath, energy, flow) and distills five slow states.
     calm — deep slate stillness · curious — gentle activity from quiet ·
     excited — sustained intensity · fear — intensity that COLLAPSES ·
     wonder — the afterglow of a Reserve spend (set by the spend itself). */
  ZigCore.Mood = {
    calm: 1, curious: 0, excited: 0, fear: 0, wonder: 0,
    _pi: 0,
    update(dt) {
      const P = ZigCore.Perf, D = ZigCore.Drive, PM = ZigCore.Pacemaker;
      const intensity = Math.min(1, 0.6 * (P.breath || 0) + 0.5 * Math.min((D && D.energy) || 0, 1) + 0.5 * ((PM && PM.flow) || 0));
      const exT = intensity > 0.55 ? (intensity - 0.55) / 0.45 : 0;
      this.excited += (exT - this.excited) * Math.min(1, dt / 2.5);
      /* fear = the cliff: what was intense is suddenly gone */
      const drop = this._pi - intensity;
      if (drop > 0.35 && this._pi > 0.55) this.fear = Math.min(1, this.fear + drop * 1.6);
      this.fear *= Math.exp(-dt / 3.5);
      this._pi += (intensity - this._pi) * Math.min(1, dt / 1.2);
      /* curiosity = touch without force: breath present, intensity low */
      const gentle = ((P.breath || 0) > 0.06 && intensity < 0.45) ? Math.min(1, P.breath * 2) : 0;
      this.curious += (gentle - this.curious) * Math.min(1, dt / 4);
      this.wonder *= Math.exp(-dt / 6);
      this.calm = Math.max(0, 1 - Math.max(this.excited, this.fear, this.curious * 0.7, this.wonder * 0.6));
    }
  };

  /* LAYER 4 — RESERVE: the color treasury. Like dynamic range in music —
     if every moment is fortissimo, nothing is. Events SPEND from a finite
     budget (≈30% each, cooldown so bursts can't machine-gun); quiet slowly
     restores it. burst (0..1) is the visible flash envelope — a few seconds
     of impossible color, then back to silver. Spends also feed Mood.wonder:
     the organism remembers revealing something private. */
  ZigCore.Reserve = {
    level: 1, burst: 0, _cool: 0,
    event(kind, strength) {
      if (this._cool > 0 || this.level < 0.16) return 0;       // an organism never spends its last color
      const s = Math.max(0.2, Math.min(1, strength === undefined ? 0.7 : strength));
      const spend = Math.min(this.level - 0.06, 0.30 * s);
      this.level -= spend;
      this.burst = Math.min(1, this.burst + spend / 0.30);
      this._cool = 2.2;
      ZigCore.Mood.wonder = Math.min(1, ZigCore.Mood.wonder + spend * 2.2);
      return spend;
    },
    update(dt, quiet) {
      this.burst *= Math.exp(-dt / 1.1);                       // ~3 s of visible flash, then silver again
      this._cool = Math.max(0, this._cool - dt);
      this.level = Math.min(1, this.level + (quiet ? 0.012 : 0.002) * dt);   // silence restores the treasury
    }
  };

  /* ==========================================================================
     THE ZIGVERSE CANON (v0.7 · adopted 2026-07-23 · Scout's Four Pillars)
     Zigverse no longer accumulates SCENES — it accumulates LAWS. Every
     capability is declared here as data, sorted into the pillar it serves,
     so the engine can state the universe it currently contains. The measure
     of progress is the richness of this list, not the count of ZigGlows.

     PRIME LAW — INEVITABILITY: nothing exists because it looked good;
     everything is a consequence of the world it inhabits. Form, motion, and
     color are downstream — physics → habitat → life → experience — never a
     decision made for its own sake.

     The pillars flow DOWNWARD. Each law names what it makes possible and the
     proof that guards it. A project that only makes a beautiful result ends
     with itself; a project that adds a law here, every future organism
     inherits.
     ======================================================================= */
  ZigCore.Canon = {
    primeLaw: "Inevitability — nothing exists merely because it looks good; everything is a consequence of the world it inhabits.",
    flow: ["physics", "habitat", "life", "experience"],
    laws: [
      /* PHYSICS — the immutable rules; never artistic, they simply exist */
      { id: "flocking",     pillar: "physics", since: "0.1",    enables: "topological 7-NN cohesion/separation/alignment — the collective body", proof: "resonator_shell_check" },
      { id: "zigphase",     pillar: "physics", since: "0.3",    enables: "Kuramoto synchronization — chaos falls into one rhythm at coupling K", proof: "fireflies_sync_ref" },
      { id: "surface",      pillar: "physics", since: "0.5",    enables: "membrane/fluid skins — a level that carries waves", proof: "resonator_shell_check" },
      { id: "zigflow",      pillar: "physics", since: "0.8",    enables: "divergence-free current field — currents swirl, never drain or pile up", proof: "zigflow_ref" },
      { id: "membrane",     pillar: "physics", since: "0.10",   enables: "elastic space + topological memory — the surface remembers what it lived", proof: "membrane_ref" },
      { id: "load",         pillar: "physics", since: "0.16",   enables: "proximity to criticality — the sweet spot of organization where a mass is most alive; too little is slack, too much is dead (Bill, 2026-07-23)", proof: "(felt — only a performer holds it)" },
      /* HABITAT — the environment; inherits physics, expresses it. OUR THINNEST PILLAR — the frontier. */
      { id: "medium",       pillar: "habitat", since: "0.5",    enables: "air vs water — gravity vs neutral buoyancy, chosen per world", proof: "resonator_shell_check" },
      { id: "sky",          pillar: "habitat", since: "0.14",   enables: "atmospheres — moonlit, spectral, dusk; the register a world is lit by", proof: "(visual)" },
      { id: "echo-space",   pillar: "habitat", since: "0.5",    enables: "finite space — walls that reflect wavefronts (the lake's echo pool)", proof: "(visual)" },
      { id: "environment",  pillar: "habitat", since: "0.19",   enables: "the three elemental laws — MEDIUM (viscosity) · FORCES (gravity/buoyancy) · CURRENT (flow) — that act on matter from outside; centralized in ZigCore.Env, they compose around one kernel hook", proof: "medium_ref, forces_ref, current_ref, env_ref" },
      { id: "formative-worlds", pillar: "habitat", since: "0.9(core)", enables: "named PLACES — medium+forces+current composed into one coherent world (amber · thermal · lakebed · the deep) where density, pull and flow AGREE; 'what world shaped that matter'", proof: "worlds_ref" },
      { id: "boundary",     pillar: "habitat", since: "0.10",   enables: "the world's SHAPE — a soft surface (bowl · chimney · vessel) that HOLDS matter inside a volume; where forces pull and currents push, a boundary contains, so a world can't drift out of frame over an all-day run. Generalizes the lake's echo-space into a reusable law", proof: "boundary_ref" },
      /* LIFE — species; adaptations to habitat, never decoration */
      { id: "zigmesh",      pillar: "life",    since: "0.2",    enables: "parametric letterforms — 3 generators, 14 roles; form as DNA", proof: "zigmesh_ref" },
      { id: "material",     pillar: "life",    since: "0.6.1",  enables: "composition profiles — grain/spec/subsurface/weather; composed, not painted", proof: "zigcolor_ref" },
      { id: "wardrobe",     pillar: "life",    since: "0.9",    enables: "live letter-swap + per-agent metamorphosis — one body, changing form", proof: "resonator_shell_check" },
      { id: "microbreath",  pillar: "life",    since: "0.10.1", enables: "vertex-level pulse — a letter alive in its own skin (the bubble)", proof: "zigmesh_ref" },
      { id: "turnover",     pillar: "life",    since: "0.2.1",  enables: "wanderers — organisms depart and return; the field is never static", proof: "(runtime)" },
      { id: "arousal",      pillar: "life",    since: "0.11",   enables: "per-agent rest/wake — breath wakes, silence sleeps; the individual-behavior substrate (fatigue/age ride the same channel)", proof: "arousal_ref" },
      { id: "seek",         pillar: "life",    since: "0.12",   enables: "world attractor + repulsor — agents seek toward / avoid away with a regional falloff; the base for foraging, attachment, predator-flight", proof: "seek_ref" },
      { id: "attach",       pillar: "life",    since: "0.13",   enables: "bind-in-place / release — a global signal freezes agents into a held pose in a staggered wave, then melts back to flow; persistence & structure (bond channel of the shared life buffer)", proof: "attach_ref" },
      { id: "metabolism",   pillar: "life",    since: "0.14",   enables: "fatigue & recover — effort drains energy, rest/calm-breath/huddle refill it; an exhausted agent can't blaze and droops → forced rest → recovery (stamina; energy channel of the life buffer)", proof: "fatigue_ref" },
      { id: "aging",        pillar: "life",    since: "0.15",   enables: "a slow per-agent lifespan clock — born → prime → old → renew in place; the field is always renewing (generational turnover + life-arc fade; age channel of the life buffer)", proof: "aging_ref" },
      { id: "form-field",   pillar: "life",    since: "0.16",   enables: "form EXPRESSES state — a per-agent signal (born-hash, age, energy, later density) picks the letter from the rack; aging becomes a metamorphosis through the alphabet. The form-twin of the color Biome; foundation of the collective-self-awareness law", proof: "formfield_ref" },
      /* EXPERIENCE — the observer as an environmental force. Where Zigverse is unique. */
      { id: "perf",         pillar: "experience", since: "0.1", enables: "breath as the source of life — the EWI drives the world", proof: "(runtime)" },
      { id: "pacemaker",    pillar: "experience", since: "0.4", enables: "the performer's clock earns entrainment (Trust) — ribbon-aware", proof: "pacemaker_ref, ribbon_ref" },
      { id: "timbre",       pillar: "experience", since: "0.5", enables: "the horn's actual voice — body/brightness/flux from real audio", proof: "timbre_ref" },
      { id: "avatar",       pillar: "experience", since: "0.4", enables: "the performer embodied as one organism; influence spreads by law (Embodiment)", proof: "resonator_shell_check" },
      { id: "reserve",      pillar: "experience", since: "0.6", enables: "the audience earns rare events — color/coherence as dynamic range", proof: "zigcolor_ref" },
      { id: "mood",         pillar: "experience", since: "0.6", enables: "emotional metabolism — calm/curious/excited/fear/wonder tint the world", proof: "zigcolor_ref" },
      { id: "memory-glass", pillar: "experience", since: "0.7", enables: "the light remembers — gated afterimage; flashes ghost, bodies stay crisp", proof: "resonator_shell_check" },
      { id: "camera",       pillar: "experience", since: "0.1", enables: "camera language — chase/overhead/side/cockpit; how the world is witnessed", proof: "(visual)" },
      { id: "vitrine",      pillar: "experience", since: "0.22", enables: "THE STAGE — a floor + pool of light beneath the organism; a boundary contains the matter, the vitrine displays it, so the viewer becomes a voyeur looking IN at a specimen rather than watching weather drift by (the boundary law reveals itself as half habitat, half experience)", proof: "stage_ref" }
    ],
    byPillar(p) { return this.laws.filter((l) => l.pillar === p); },
    count() { return this.laws.length; }
  };

  /* ==========================================================================
     ZigCore.Env — THE ENVIRONMENT LIBRARY (v0.8 · 2026-07-30)
     The Canon above declares the environment LAWS; this is their canonical
     DATA — the named presets every species inherits instead of re-declaring.
     "The presets ARE platform" (platform before project): when Rootwhale, Kelp,
     or Zigpede arrive they name a medium/force/current, they don't copy a table.
     One edit here retunes every world at once.

       MEDIUM  — density/viscosity: { drag, vmax }            (thin air ⟶ thick honey)
       CURRENT — the world's flow:  { d:[x,y,z] drift, gyre } (stream · whirlpool · eddy)
       FORCES  — gravity/buoyancy:  { g, damp, floorFrac|ceilFrac }
                 floorFrac/ceilFrac are FRACTIONS of a species' frame half-extent —
                 resolved per-species via force(name, frameH) so the settled/gathered
                 mass fills whatever frame it is viewed in (a species keeps its own
                 view geometry; the archetype stays view-independent).
     Values are the proven ones (medium_ref · forces_ref · current_ref · env_ref). */
  ZigCore.Env = {
    media:    { air: { drag: 0.25, vmax: 1.20 }, water: { drag: 1.10, vmax: 0.72 }, honey: { drag: 3.40, vmax: 0.38 } },
    currents: { neutral: null, drift: { d: [1.8, 0, 0.6], gyre: 0 }, gyre: { d: [0, 0, 0], gyre: 0.10 }, eddy: { d: [1.0, 0, 0], gyre: 0.07 } },
    forces:   { neutral: null, sink: { g: -7.0, damp: 0.9, floorFrac: -1 }, float: { g: 5.0, damp: 0.8, ceilFrac: 1 }, suspend: { g: 0.0, damp: 2.4 } },
    medium(name)  { return (name && this.media[name]) || null; },
    current(name, axis) { const c = name && this.currents[name]; if (!c) return null; return axis ? { ...c, axis } : c; },   // axis = the gyre's spin axis ("x"/"y"/"z"); omit → shared def, byte-identical
    force(name, frameH) {                       // resolve an archetype against a species' frame half-extent
      const a = name && this.forces[name]; if (!a) return null;
      const f = { g: a.g || 0, damp: a.damp || 0 };
      if (a.floorFrac !== undefined) f.floor = a.floorFrac * (frameH || 0);
      if (a.ceilFrac  !== undefined) f.ceil  = a.ceilFrac  * (frameH || 0);
      return f;
    },
    /* BOUNDARY — the world's SHAPE: a soft surface that HOLDS the matter inside a volume.
       Where forces PULL and currents PUSH, a boundary CONTAINS — so a place is somewhere the
       matter *is*, and (the practical payoff) a world physically can't drift out of frame over
       an all-day run. Shapes: cylinder (radial wall ± floor/ceiling → a bowl or a chimney) ·
       sphere (a rounded vessel on all sides). Sizes are FRACTIONS of the species' frame, like
       forces, so a world fills whatever view it's seen in. k = restoring stiffness.
       A cylinder has an AXIS — the free direction matter is free to run along; the radial
       wall squeezes the other two. axis "y" is the upright chimney (free to rise); axis "x"
       is the same law laid on its side — a horizontal tube matter runs WIDE along (the cigar
       that fills a landscape frame). Same containment, rotated; each pose gets its own long-
       axis "gravity". axis defaults to "y" so every existing world is byte-identical. */
    boundaries: {
      none:    null,
      basin:   { shape: "cylinder", rFrac: 2.2, loFrac: -1.05, k: 3.0 },  // a wide bowl — radial walls + a floor, matter settles in
      column:  { shape: "cylinder", axis: "y", rFrac: 0.9, k: 3.2 },      // a narrow VERTICAL tube — free to rise (a chimney / standing spindle)
      capsule: { shape: "cylinder", axis: "x", rFrac: 0.9, k: 3.2 },      // the same tube laid on its side — free to run WIDE along X (the horizontal cigar)
      vessel:  { shape: "sphere",   rFrac: 2.3, k: 2.6 },                  // a rounded container on every side (an aquarium / the deep's hold)
      // ELLIPSOID — a sphere with independent per-axis radii. lens = squashed short in Y, generous
      // in X & Z: the vertical squeeze spreads the mass outward (volume conservation) into a wide
      // disc that reads as a squashed circle from the front, consistent under a vertical spin.
      lens:    { shape: "ellipsoid", rxFrac: 1.55, ryFrac: 0.42, rzFrac: 1.55, k: 2.8 }
    },
    boundary(name, frameH) {
      const a = name && this.boundaries[name]; if (!a) return null;
      const H = frameH || 0;
      const b = { shape: a.shape, k: a.k || 2.6, r: (a.rFrac || 2) * H };
      if (a.shape === "cylinder")  b.axis = a.axis || "y";               // the free / long axis; "y" keeps every prior world byte-identical
      if (a.shape === "ellipsoid") { b.rx = (a.rxFrac || 2) * H; b.ry = (a.ryFrac || 2) * H; b.rz = (a.rzFrac || 2) * H; }
      if (a.loFrac !== undefined) b.lo = a.loFrac * H;
      if (a.hiFrac !== undefined) b.hi = a.hiFrac * H;
      return b;
    }
  };

  /* ==========================================================================
     ZigCore.Worlds — FORMATIVE WORLDS (v0.9 · 2026-07-30 · Phase 2 synthesis)
     The layer ABOVE ZigCore.Env: the three elemental laws (medium · forces ·
     current) stop being three dials and become one coherent PLACE. A world is
     not an arbitrary triple — it is a combination where the density, the pull,
     and the flow AGREE, so the matter reads as *shaped by somewhere*. This is
     the "conditions for belief" thesis made mechanical: the coupling we proved
     (honey+gyre turns slow, sink+gyre drains) is what makes these read as worlds
     rather than settings. Ask not "what should it do" but "what world shaped it".

     Each place names a medium/force/current; get(name, frameH) composes them via
     ZigCore.Env into the exact {medium, forces, current} a species hands the engine.
     Add a world here → every species can inhabit it by name. Species stay thin. */
  ZigCore.Worlds = {
    /* skin = the world's NATIVE material (its default look): the place shapes the surface,
       not just the motion. A species applies it unless the performer overrides SURFACE. */
    places: {
      open:      { medium: "air",   force: "neutral", current: "drift",   skin: "glass",     bound: "none",   of: "open air — thin, weightless, streaming past" },
      thermal:   { medium: "air",   force: "float",   current: "gyre",    skin: "moonstone", bound: "column", of: "an updraft — it rises and turns, a column of warm air" },
      lakebed:   { medium: "water", force: "sink",    current: "drift",   skin: "moss",      bound: "basin",  of: "a lakebed — it settles to the floor and streams along it" },
      tidepool:  { medium: "water", force: "neutral", current: "eddy",    skin: "coral",     bound: "basin",  of: "held water — suspended, swirling gently in a rimmed pool" },
      whirlpool: { medium: "water", force: "sink",    current: "gyre",    skin: "ice",       bound: "basin",  of: "a draining vortex — pulled down while it spins" },
      deep:      { medium: "honey", force: "suspend", current: "eddy",    skin: "obsidian",  bound: "vessel", of: "the thick deep — it hangs in the dark and slowly turns" },
      amber:     { medium: "honey", force: "sink",    current: "neutral", skin: "copper",    bound: "basin",  of: "amber — fossil-slow, settling into thick gold" }
    },
    get(name, frameH) {
      const w = name && this.places[name]; if (!w) return null;
      return {
        medium:   ZigCore.Env.medium(w.medium),
        forces:   ZigCore.Env.force(w.force, frameH),
        current:  ZigCore.Env.current(w.current),
        boundary: ZigCore.Env.boundary(w.bound, frameH),
        spec: w
      };
    },
    names() { return Object.keys(this.places); }
  };

  ZigCore.VERSION = "0.12.0";   // 0.11: BOUNDARY AXIS · 0.11.1: GYRE AXIS · 0.12: ELLIPSOID boundary (lens = a squashed sphere; per-axis radii → the wide breathing disc); byte-identical for sphere/cylinder

})(typeof window !== "undefined" ? window : globalThis);

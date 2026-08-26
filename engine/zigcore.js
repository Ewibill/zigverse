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
    _sim: 0, _last: 0, _midi: null, _touch: false,
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

    /* HOLD — a SUSTAINED note from something that is not MIDI: a finger, a
       kiosk button, a bridge from OSC. Breath alone is not enough to make the
       engine feel played. Charisma reads heldT and NOTHING else, so the idle
       auto-breath below — which creates no notes — leaves dwell at 0 and every
       dwell-earned law silent forever, however hard the organism appears to be
       breathing. That is exactly why the Bee did nothing on 2026-08-25.
       So a held finger must post a real note-on, accumulate real dwell, and
       release it. Any input source that can say "pressed / how hard / released"
       now drives the full causal chain, and a phone becomes a performer.
       Deliberately does NOT set live: update() lets _sim set breathRaw only
       while live is false, and marking touch as live would decay it to nothing
       after 120ms. */
    hold(on, v) {
      const NOTE = 60;                                   // one voice, middle C — a plausible pitch for hue/flash consumers
      if (on) {
        this._touch = true;
        this._sim = clamp(v == null ? 0.72 : v, 0, 1);
        if (!this.heldT.has(NOTE)) {                     // press once; re-pressing must not restart the dwell
          this.held.add(NOTE); this.heldT.set(NOTE, this._nowMs());
          this.lastNote = NOTE; this.attack = Math.max(this.attack, this._sim);
        }
      } else if (this._touch) {                          // guarded so a released finger cannot cancel a held B key
        this._touch = false; this._sim = 0;
        this.held.delete(NOTE); this.heldT.delete(NOTE);
      }
    },

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
      { id: "reciprocity", pillar: "habitat", since: "0.18(core)", enables: "THE MEDIUM REMEMBERS BEING MOVED - a momentum field agents stir and are carried by, so a body finally leaves a mark on what it moves through. Every medium law before this was one-way. Momentum is conserved between body and medium (deposit is an IMPULSE, push x dt, shed BEHIND the body or a swimmer drowns in its own backwash); the wake fades and spreads; one body passage measurably changes the water another is in; and INDUCED DRAG emerges unasked - shedding a wake costs speed. NO VORTICITY, therefore no drafting: a follower directly behind is pushed BACKWARD, which is why real fish school offset", proof: "wake_ref" },
      { id: "shape-memory", pillar: "physics", since: "0.17(core)", enables: "a body REMEMBERS the angle it grew at - per-joint rest curvature recorded at growth (state.kap0), so a spiral holds its spiral instead of straining to unwind. Without it a shell creeps forever (motion still 5.6/s after 1500 frames of silence); with it, 0.4. This is what lets a performed shape persist rather than relaxing away", proof: "shell_species_ref" },
      { id: "framing", pillar: "experience", since: "0.21(core)", enables: "A CAMERA THAT HOLDS ITS SUBJECT - the distance at which a body of known radius is exactly TANGENT to the view frustum, for the current field of view and ASPECT. A fixed distance is a promise about one screen: measured on a 2560x1440 capture the field was cropped on all four edges while filling 26% of the frame. Aspect is the crux - a vertical fov means the binding axis SWAPS between wide and tall windows, which is why a piece composed on one monitor is cropped on the next. Pure arithmetic, no readback", proof: "frame_ref" },
      { id: "escapement", pillar: "physics", since: "0.20(core)", enables: "FILL UNTIL IT IS ENOUGH, THEN ALL AT ONCE - a store, a threshold, a release, a reset. The pattern behind a tipping-bucket gauge, a geyser, a seed pod, a heart, a neuron reaching action potential and the escapement in a clock. Turns a CONTINUOUS supply into a COUNTABLE event, so period = threshold / rate and a chain of stages with different thresholds gives seconds, minutes and hours from one supply. HYSTERESIS is the law, not a detail: without a reset level the store chatters at the frame rate instead of ticking", proof: "escapement_ref" },
      { id: "coalescence", pillar: "physics", since: "0.19(core)", enables: "WHEN TWO TOUCH THEY BECOME ONE - the exact counterpart to contact, sharing its broadphase and pair test with the opposite resolution. VOLUME is conserved (r = cbrt(r1^3+r2^3)), not radius, which is what makes a merged body rise FASTER than either parent while the event rate collapses: motion accelerating as events decelerate. Momentum conserved with volume as mass. Absorbed agents are PARKED at radius 0 rather than deleted, so a fixed agent count needs no allocation. Lower index survives, so a run is deterministic", proof: "coalesce_ref" },
      { id: "contact", pillar: "physics", since: "0.16(core)", enables: "MATTER THAT OCCUPIES SPACE - static exclusion AND a body that cannot pass through ITSELF (uniform-grid broadphase, bonded near-neighbours exempt, every pair resolved once so a body cannot push itself; coils PACK instead of interpenetrating - measured overlap 0.84 -> 0.03). Flocking separation is a force between strangers, a preference that can be overpowered; this is a body that cannot be entered. A stone, a pillar, a reef: something a creature must go AROUND, which turns a drawing into a creature in a PLACE. The general case (a body against itself) is the same mathematics with both sides moving", proof: "contact_ref" },
      { id: "allometry", pillar: "physics", since: "0.15(core)", enables: "per-segment REST LENGTH - one body whose segments differ in size. A kelp frond tapers, a whale tapers, and a SHELL is a body whose every segment slightly outgrows the last", proof: "structure_ref" },
      { id: "shell", pillar: "life", since: "0.15(core)", enables: "GROWTH WITH ROTATION - constant turn plus constant growth ratio traces a logarithmic spiral: nautilus, ammonite, ram horn, fern crozier. One of the commonest forms in biology because it is simply what steady growth plus steady turning draws, and it is self-similar so the animal never changes proportion. Interval sets the whorl tightness and handedness; attack opens the ratio", proof: "structure_ref" },
      { id: "undulation", pillar: "life", since: "0.14(core)", enables: "SWIMMING - age() fed in as a phase offset makes a bonded body carry a travelling wave head to tail, which is how every eel, fish, snake and worm moves. No new rhythm: zigphase clock read through structure geometry. The wave writes ANGLES (rest curvature), never forces - muscle changes what the body considers REST and the elastic structure follows, so no drive level can tear a bond", proof: "structure_ref" },
      { id: "slip", pillar: "habitat", since: "0.14(core)", enables: "the medium tells ALONG from ACROSS - a slender body slides along its own length and resists moving sideways, so a curve advances THROUGH itself the way a snake does instead of sweeping the whole shape sideways. Shapes the character of any slender organism, swimming or not", proof: "structure_ref" },
      { id: "refinement", pillar: "physics", since: "0.13.2(core)", enables: "the same body at any RESOLUTION — refine() subdivides joints while holding physical length, so a creature stops being a bicycle chain without the camera pulling back. Scaling is forced, not chosen: k as factor2 (N links in series carry N x the load at 1/N the rest), damp linearly, bend not at all; the bond reports the substeps it needs. Measured invariant to 8x", proof: "structure_ref" },
      { id: "travelling-body", pillar: "life", since: "0.13.1(core)", enables: "TURNOVER applied to a BODY — the tail grows, the root retires, so a bonded organism holds a fixed span and TRAVELS instead of accumulating. Unbounded growth turns a creature into a thread (the camera must pull back, every segment shrinks to a dot); a bounded body stays legible and moves. `age()` then reads time-since-played within LIVING MEMORY. This is Zigpede's skeleton, and it composes two existing laws rather than adding a third", proof: "structure_ref" },
      { id: "structure",    pillar: "physics", since: "0.13(core)", enables: "matter that is JOINED — a parent-index topology + spring/damping/BEND makes a cloud into a BODY that cannot come apart; one number (bend) spans rope→spine. Because the topology is an index, a body GROWS by appending, so a played stream builds the organism note by note and position along the body IS time (the organism is its own history)", proof: "structure_ref" },
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
     THE CANON RUNTIME (v1.0 · 2026-08-17) — the ledger above is a DECLARATION;
     this is the MACHINERY. A law registers here, ships OFF, and a host turns it
     on by name. Contract (CANON.md §2), five obligations:

       1. defaults ARE the identity element — off means unchanged, provably.
       2. splice is SPLICED, not branched — when off the WGSL is never emitted.
       3. probe is mandatory — a law with no numeric test is an opinion.
       4. doc states the MECHANISM, not the intent.
       5. laws version independently of the engine ("0.45.0 + radiance 0.1.0").

     INHERITANCE (CANON.md §3) — the answer to "let prior builds gain laws."
     A bundle is frozen and is never edited. Instead a prior build is RE-BUNDLED
     from source with one line added to its host:

         window.ZIG_LAWS = { radiance: { room: "bright" } };

     Omit ZIG_LAWS entirely and the build is byte-identical to its pre-Canon
     self — which is what lets an APPROVED signature ride a newer engine and
     still be the same creature. Every law also takes a hash override
     (#radiance=bright) so a configuration can be A/B'd on eyeZ without a
     rebuild.
     ======================================================================= */
  ZigCore.Canon.registry = {};    // id → law definition
  ZigCore.Canon.actives  = {};    // id → resolved config (only what a host turned on)

  ZigCore.Canon.register = function (law) {
    if (!law || !law.id) throw new Error("Canon.register: a law needs an id");
    if (!law.version)    throw new Error("Canon.register(" + law.id + "): a law needs its own version");
    if (!law.defaults)   throw new Error("Canon.register(" + law.id + "): defaults ARE the identity element — declare them");
    if (!law.probe)      throw new Error("Canon.register(" + law.id + "): a law with no probe is an opinion");
    this.registry[law.id] = law;
    return law;
  };

  /* Resolve a law's config: defaults ← preset (if the law offers named presets)
     ← explicit fields. Returns a NEW object; never mutates the defaults. */
  ZigCore.Canon.resolve = function (id, cfg) {
    const law = this.registry[id];
    if (!law) return null;
    const out = Object.assign({}, law.defaults);
    const pk = law.presetKey || "preset";          // radiance names its presets ROOMS, so #radiance=bright reads naturally
    if (cfg && typeof cfg === "string") {
      if (!(law.presets && law.presets[cfg])) return null;    // an unknown preset name is OFF, never a guess
      Object.assign(out, law.presets[cfg], { preset: cfg });
    } else if (cfg && typeof cfg === "object") {
      const name = cfg[pk] || cfg.preset;
      if (name && law.presets && law.presets[name]) Object.assign(out, law.presets[name], { preset: name });
      Object.assign(out, cfg);
    }
    out.version = law.version;
    return out;
  };

  /* Is this config the identity element? A law resolved to its defaults must
     NOT be emitted at all — that is obligation 2, enforced here rather than
     remembered at each call site. */
  ZigCore.Canon.isIdentity = function (id, cfg) {
    const law = this.registry[id]; if (!law) return true;
    const r = this.resolve(id, cfg); if (!r) return true;
    for (const k in law.defaults) {
      if (Math.abs((+r[k] || 0) - (+law.defaults[k] || 0)) > 1e-9) return false;
    }
    return true;
  };

  /* activate(decl, hash) — a host declares which laws apply, at what strength.
     decl: window.ZIG_LAWS (an object) · hash: location.hash (string, optional).
     A hash entry (#radiance=bright / #radiance=off) OVERRIDES the declaration,
     so a performance configuration is A/B-able live without a rebuild. */
  ZigCore.Canon.activate = function (decl, hash) {
    this.actives = {};
    const ids = Object.keys(this.registry);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      let cfg = (decl && Object.prototype.hasOwnProperty.call(decl, id)) ? decl[id] : undefined;
      if (typeof hash === "string" && hash) {
        const m = hash.match(new RegExp("[#&]" + id + "=([a-z0-9._-]+)", "i"));
        if (m) cfg = (m[1] === "off" || m[1] === "none") ? undefined : (isNaN(+m[1]) ? m[1] : +m[1]);
      }
      if (cfg === undefined || cfg === null || cfg === false) continue;   // absent = OFF = byte-identical
      if (this.isIdentity(id, cfg)) continue;                            // resolved to identity = also OFF
      this.actives[id] = this.resolve(id, cfg);
    }
    return this.actives;
  };

  ZigCore.Canon.law = function (id) { return this.actives[id] || null; };
  ZigCore.Canon.stamp = function () {                                    // "0.45.0 + radiance 0.1.0"
    const on = Object.keys(this.actives);
    return on.length ? on.map((id) => id + " " + this.registry[id].version).join(" + ") : "no laws";
  };

  /* ==========================================================================
     THE ORDERING CONTRACT (Canon.Order v1.0.0 · 2026-08-17)
     ---------------------------------------------------------------------------
     ORDER IS A LAW, NOT A LEFTOVER.

     Until now, two laws that touch the same pixel composed in whatever order
     their `if (LAW)` blocks happened to sit in createFlock — an accident of
     build history. `tools/order_collisions.mjs` proves what that costs:

       1. THE APPEND INVERSION. `.replace(A, A + block)` puts the LAST-applied
          block FIRST in the emitted shader; `.replace(A, block + A)` puts it
          LAST. Both idioms are in use. So a law's position in the light's path
          is decided by which idiom its author reached for — and getting
          Ambience to scatter BEFORE Radiance's tone remap requires applying
          Radiance FIRST, which no one would guess and nothing enforced.

       2. THE FOUR-OWNER UNDERSIDE. Fabric (0.29), Memory (0.27), Note Flash
          (0.43) and Gem (0.33) all write the back face's colour. Emitted order
          is 0.29 → 0.27 → 0.43 → 0.33: not version order, not any order — just
          where each cursor happened to be. Two of them REPLACE the colour
          outright. With `gemFace=inside` the gem lands last, and the fabric,
          the memory and the note flash are all computed and thrown away. The
          shader is valid, the frame renders, and three capabilities are dead.

     THE FIX IS STRUCTURAL, not vigilance. A law never splices itself. It files
     a CLAIM naming a RAIL and a STATION, and the rail emits every claim once,
     in the rail's declared order. The idiom disappears, so the inversion
     cannot happen; the order is data, so it can be read, tested and argued
     about without reading createFlock top to bottom.

     A RAIL is the path a value takes. Its STATIONS are ordered because the
     PHYSICS is ordered — which is the Canon's prime law (Inevitability)
     applied to composition itself. Radiance sits at `tone` not because it was
     built last but because the room is the only thing that happens after the
     light leaves the screen. Ambience sits at `medium` because the space
     between body and eye is crossed before the screen is reached. Neither
     position is a decision any more; both are consequences.

     FOUR REFUSALS, all at build time, all mechanical:
       · unknown rail or station                → the claim is a typo, not a law
       · two claims at one station, no `after`  → AMBIGUOUS: order undeclared
       · two REPLACE claims on one face         → CONTESTED: they cannot coexist
       · a write earlier than a REPLACE it      → DEAD: computed and discarded
         shares a face with

     The fourth is the one that had been running in production for four months.
     ======================================================================= */
  ZigCore.Canon.Order = {
    VERSION: "1.0.0",

    /* THE RAILS. Each is a path a value takes, with its stations in the order
       the physics puts them. Adding a station is a Canon-level edit and shows
       up in every build's stamp; adding a law is not. */
    rails: {
      "shard.face": {
        says: "the colour of one face of a body, from what it is made of to what stains it",
        carries: "c",                       // the WGSL identifier the claims write
        stations: [
          "surface",   // what the face IS — geometric normal, relief, buff. Writes normals, not colour.
          "pigment",   // what colour the material HAS — base shade, spectrum, iridescence
          "lining",    // what LINES this face — a skin that REPLACES the pigment (fabric, gem)
          "tint",      // what STAINS it — an event or a memory colouring what is already there
          "edge"       // what its RIM does — silhouette, edge occlusion; last because it is geometry, not skin
        ]
      },
      "frame.light": {
        says: "the journey of the finished colour from the body to the eye to the room",
        carries: "col",
        stations: [
          "body",      // the colour as the body emitted it
          "medium",    // what the space between body and eye does — haze, scatter, glow (AMBIENCE)
          "tone"       // what the ROOM does to the display — the veil (RADIANCE). Always last: nothing follows the screen.
        ]
      }
    },

    claims: {},   // rail id → [claim]

    /* file a claim. A law calls this instead of touching the shader source. */
    claim(rail, c) {
      const R = this.rails[rail];
      if (!R) throw new Error("Canon.Order: no rail \"" + rail + "\"");
      if (!c || !c.id) throw new Error("Canon.Order(" + rail + "): a claim needs an id");
      if (R.stations.indexOf(c.station) < 0)
        throw new Error("Canon.Order(" + rail + "): \"" + c.id + "\" claims station \"" +
          c.station + "\", which is not on this rail (" + R.stations.join(" → ") + ")");
      const mode = c.mode || "modulate";
      if (["replace", "tint", "add", "modulate"].indexOf(mode) < 0)
        throw new Error("Canon.Order(" + rail + "): \"" + c.id + "\" has no write mode");
      const rec = { id: c.id, station: c.station, mode, face: c.face || "both",
                    after: c.after || [], yieldsTo: c.yieldsTo || [], wgsl: c.wgsl || "",
                    note: c.note || "", since: c.since || "" };
      (this.claims[rail] || (this.claims[rail] = [])).push(rec);
      return rec;
    },

    reset(rail) { if (rail) delete this.claims[rail]; else this.claims = {}; return this; },

    /* Do two claims land on the same physical face? "both" overlaps everything. */
    _shareFace(a, b) { return a.face === "both" || b.face === "both" || a.face === b.face; },

    /* ORDER — the rail's claims, sorted by station, ties broken only by an
       explicit `after`. Returns { order, faults }. Never throws, so a caller
       can REPORT faults (the audit) or REFUSE them (the build). */
    order(rail) {
      const R = this.rails[rail];
      if (!R) throw new Error("Canon.Order: no rail \"" + rail + "\"");
      const cs = (this.claims[rail] || []).slice();
      const si = (c) => R.stations.indexOf(c.station);
      const faults = [];

      /* stable sort by station; `after` resolves ties within a station */
      cs.sort((a, b) => (si(a) - si(b)) ||
        (a.after.indexOf(b.id) >= 0 ? 1 : b.after.indexOf(a.id) >= 0 ? -1 : 0));

      /* REFUSAL 2 — two claims at one station with nothing to separate them.
         Silence here is exactly how the underside got its order. */
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i], b = cs[j];
        if (a.station !== b.station) continue;
        if (a.after.indexOf(b.id) >= 0 || b.after.indexOf(a.id) >= 0) continue;
        if (!this._shareFace(a, b)) continue;
        faults.push({ kind: "AMBIGUOUS", rail, a: a.id, b: b.id, station: a.station,
          says: "\"" + a.id + "\" and \"" + b.id + "\" both write " + a.station +
                " on the same face and neither declares `after` — their order is undeclared" });
      }

      /* REFUSAL 3 — two skins that both REPLACE the same face. They do not
         compose at all; one of them is invisible whatever the order. */
      const reps = cs.filter((c) => c.mode === "replace");
      for (let i = 0; i < reps.length; i++) for (let j = i + 1; j < reps.length; j++) {
        const a = reps[i], b = reps[j];
        if (!this._shareFace(a, b)) continue;
        if (a.yieldsTo.indexOf(b.id) >= 0 || b.yieldsTo.indexOf(a.id) >= 0) continue;
        faults.push({ kind: "CONTESTED", rail, a: a.id, b: b.id, face: a.face,
          says: "\"" + a.id + "\" and \"" + b.id + "\" both REPLACE the " + a.face +
                " face; whichever runs second erases the other. One must declare `yieldsTo`" });
      }

      /* REFUSAL 4 — a write that a later REPLACE on the same face discards.
         This is the four-owner underside, stated as a rule. */
      for (let i = 0; i < cs.length; i++) {
        const w = cs[i];
        for (let j = i + 1; j < cs.length; j++) {
          const r = cs[j];
          if (r.mode !== "replace" || !this._shareFace(w, r)) continue;
          if (w.yieldsTo.indexOf(r.id) >= 0) continue;    // declared: I accept being overwritten
          faults.push({ kind: "DEAD", rail, dead: w.id, by: r.id, face: w.face,
            says: "\"" + w.id + "\" writes the " + w.face + " face at station \"" + w.station +
                  "\", then \"" + r.id + "\" REPLACES it at \"" + r.station +
                  "\" — every instruction in \"" + w.id + "\" is computed and thrown away" });
          break;
        }
      }
      return { order: cs, faults };
    },

    /* EMIT — the rail's WGSL, once, in order. This is the only place a claim's
       text enters a shader, which is what makes the append/prepend inversion
       structurally impossible: there is no anchor and no idiom to choose. */
    _resolved(rail, opts) {
      const o = this.order(rail);
      if (!(opts && opts.strict === false) && o.faults.length)
        throw new Error("Canon.Order(" + rail + "): " + o.faults.length + " ordering fault(s)\n  " +
          o.faults.map((f) => f.kind + " \u00b7 " + f.says).join("\n  "));
      return o.order.filter((c) => c.wgsl);
    },

    emit(rail, opts) { return this._resolved(rail, opts).map((c) => c.wgsl).join("\n"); },

    /* RENDER — emit() in the house style of the shader it lands in: one
       statement per line at a given indent, each claim's note aligned to a
       fixed column. A spliced block should be indistinguishable from the
       hand-written WGSL around it, or the next person reading the emitted
       shader can see which lines the machine wrote and stops trusting them
       equally. */
    render(rail, opts) {
      const ind = (opts && opts.indent) || "";
      const col = (opts && opts.noteCol) || 0;
      return this._resolved(rail, opts).map((c) => {
        let line = ind + c.wgsl;
        if (c.note) { while (line.length < col) line += " "; line += c.note; }
        return line;
      }).join("\n");
    },

    /* the ordering half of Canon.stamp() — "shard.face: fabric→memory→gem" */
    stamp(rail) {
      const ids = (this.claims[rail] || []).length ? this.order(rail).order.map((c) => c.id) : [];
      return rail + ": " + (ids.length ? ids.join(" → ") : "empty");
    }
  };

  /* ==========================================================================
     RADIANCE 0.1.0 — the FIRST Canon law. "Light has a source and a falloff."
     ---------------------------------------------------------------------------
     THE SECOND LIGHT. Every law before this one modelled the light INSIDE the
     world. Radiance is the first to model the light source that is NOT in the
     world: the room the panel stands in. Ambient light lands on the glass and
     reflects to the eye, adding a constant to every pixel. That source has no
     falloff at all — it is behind you — which is exactly why it is ruinous.

     THE PHYSICS. Perceived = displayed + veil. A linear delta survives that
     addition; a RATIO does not. Two near-blacks at 0.00 and 0.05 are an
     infinite contrast in a dark room and 1.25:1 in a lit one, so shadow detail
     disappears while the arithmetic insists nothing was lost. That is why the
     summit's bright classroom flattened the field and why it is a physics
     problem, not a resolution one.

     THE MECHANISM (what it multiplies, per obligation 4). The law remaps
     outgoing LUMINANCE only, then scales the colour by the ratio — so hue and
     saturation are untouched and every skin, gem and spectrum tuned by eye
     survives it:

         x = max((L - black) / (1 - black), 0)     black-point: refuse the drowned region
         x = pow(x * gain, 1/gamma)                exposure, then shadow expansion
         L' = x / (1 + max(x - knee, 0))           soft shoulder — gain must not clip to flat white
         c' = c * mix(1, L'/L, amount)             amount = the live dial

     TWO OPPOSITE INSTINCTS, both real, and Bill's eye arbitrates:
       · EXPAND (gain + gamma) — stretch the shadows apart so their differences
         are big enough in display units to survive the veil being added.
       · CUT (black) — refuse to spend range on values the room will drown, and
         rescale the survivors. Costs the faintest matter; buys separation.

     WHAT THIS LAW CANNOT DO: make black blacker. The floor is set by the room
     and the panel, not by us. Every honest move is therefore a move of the
     ORGANISM relative to an unmovable floor — which is also why `white` (the
     projection/spa inversion) is the same arithmetic with gain below 1.

     FALLOFF — the first light's half of the law — is deliberately NOT in 0.1.0.
     It needs the source's position and the flock's radius in the View uniform,
     and growing View is the single most black-canvas-prone edit in the engine.
     0.1.0 ships the half that needs no new uniform and no species change.
     ======================================================================= */
  ZigCore.Radiance = {
    VERSION: "0.1.0",
    /* Named ROOMS — the presets ARE platform: a host names a room, it does not
       copy four numbers. One edit here retunes every build at once. */
    rooms: {
      dark:   { black: 0.0,  gain: 1.00, gamma: 1.00, knee: 1e9  },   // the black-box theatre — IDENTITY
      lit:    { black: 0.0,  gain: 1.35, gamma: 1.45, knee: 0.85 },   // a normally lit room
      bright: { black: 0.0,  gain: 1.70, gamma: 1.90, knee: 0.75 },   // the summit classroom · a spa in daylight
      sunlit: { black: 0.0,  gain: 2.10, gamma: 2.40, knee: 0.65 },   // worst case — a window in frame
      cut:    { black: 0.06, gain: 1.50, gamma: 1.00, knee: 0.85 },   // the OPPOSITE instinct: drop the drowned region, rescale the rest
      white:  { black: 0.0,  gain: 0.55, gamma: 0.62, knee: 1e9  }    // BACKGROUND INVERSION: a dark organism against a bright floor
    },
    /* The tone curve. This function IS the law — the WGSL is a transcription of
       it, and test/law_radiance_ref.mjs proves the two agree. */
    tone(L, c) {
      const black = +c.black || 0, gain = +c.gain || 1, gamma = +c.gamma || 1;
      const knee = (c.knee === undefined ? 1e9 : +c.knee);
      let x = (L - black) / (1 - black);
      if (x < 0) x = 0;
      x = Math.pow(x * gain, 1 / gamma);
      return x / (1 + Math.max(x - knee, 0));
    },
    /* Apply to a colour, preserving hue and saturation. amount = the live dial. */
    apply(rgb, c, amount) {
      const a = (amount === undefined ? 1 : amount);
      const L = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      if (L <= 1e-5) return [rgb[0], rgb[1], rgb[2]];
      const k = 1 + ((this.tone(L, c) / L) - 1) * a;
      return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
    }
  };

  ZigCore.Canon.register({
    id: "radiance",
    version: ZigCore.Radiance.VERSION,
    pillar: "habitat",
    says: "light has a source and a falloff — including the one behind you",
    defaults: { black: 0.0, gain: 1.0, gamma: 1.0, knee: 1e9 },   // IDENTITY
    presets: ZigCore.Radiance.rooms,
    presetKey: "room",                                             // window.ZIG_LAWS = { radiance: { room: "bright" } }
    cpu: null,                                                     // logic tier is untouched — this law is optical
    /* ORDERING (Canon.Order v1.0.0): the LAST station on the light's rail, and
       not by seniority — the room is the only thing that happens after the
       light has left the screen, so nothing can legally follow it. Ambience
       scatters at "medium", one station earlier, which is what makes the veil
       compensation reach the medium's own glow. */
    splice: { stage: "fragment", owner: "zigwebgpu:RENDER_WGSL",
              rail: "frame.light", station: "tone", mode: "modulate", face: "both" },
    probe: "test/law_radiance_ref.mjs",
    doc: "briefs/law_radiance.md"
  });

  /* ==========================================================================
     GROUND 0.1.0 — the SECOND Canon law. "A world has a ground of being."
     ---------------------------------------------------------------------------
     Every world so far has been black, and black was never a decision. It was
     the value the sky triple happened to be authored at, plus a clear colour
     nobody has ever seen. `tools/ground_gap.mjs` measures all of it:

       · the sky is a FULLSCREEN triangle, depth writes off, depthCompare
         "always" — it paints over every pixel before an agent draws, so the
         clear colour is invisible in every build ever shipped. It is the
         background only when `sky:false`.
       · skyTop / skyMid / horizon / ground are already View UNIFORMS. There is
         no plumbing to lay. The engine has always been able to paint a lit
         world; nobody has ever asked it to.
       · skyMid is ALSO the haze the fragment fogs toward, so lifting the sky
         lifts the medium for free. Two thirds of the pairing is already wired.

     So why a LAW and not a preset? Because of the third finding, which nobody
     had named:

       THE AFTERIMAGE ASSUMES A DARK WORLD, IN ITS ARITHMETIC.

     It composites with max() — correct when light accumulates upward from
     black. Invert the world and the sky's own memory sits at 0.85 while a dark
     body draws at 0.25, so max(scene, trail) returns 0.8359 and THE CREATURE IS
     ERASED BY ITS OWN AFTERIMAGE. The same body in a dark world reaches the
     glass untouched. The memory gate is a luminance FLOOR, too, so an inverted
     world remembers its empty sky and forgets the organism.

     A preset can set a colour. Only a law can say that four capabilities must
     agree — sky, haze, tone curve and compositing — and REFUSE the ones that
     do not. On 2026-08-17 Bill set `radiance=white` and watched the organism
     sink into a dark floor. That was four settings disagreeing with nothing to
     stop them. Under this law it is a build-time fault.

     GROUNDS are named, and `void` is the identity: today's near-black sky,
     max() compositing, no tone curve. Every build that exists keeps rendering
     byte-for-byte what it renders now.
     ======================================================================= */
  ZigCore.Ground = {
    VERSION: "0.1.0",

    /* Named GROUNDS. `lift` is the ground's own luminance — the floor the world
       never falls below. `sky` is the triple (top, mid, horizon); `mid` doubles
       as the haze target, which is why it is not a free parameter. `compose`
       says how memory stacks against this ground, and `room` is the Radiance
       curve that belongs with it: a lit ground REQUIRES an inverted body or the
       organism has nothing to be dark against. */
    grounds: {
      /* IDENTITY — the black-box theatre. What every build has always been. */
      void:   { lift: 0.000, compose: "rise",  room: null, gateAt: 0.45,
                sky: { top: [0.003, 0.005, 0.014], mid: [0.007, 0.011, 0.024], hor: [0.010, 0.014, 0.030] },
                says: "no ground at all — light accumulates upward out of nothing" },
      /* Pre-dawn: a sky that is no longer black and not yet day. The balloon
         glow ground, and the gentlest test of the inversion. */
      dusk:   { lift: 0.055, compose: "rise",  room: null, gateAt: 0.45,
                sky: { top: [0.028, 0.026, 0.040], mid: [0.075, 0.050, 0.044], hor: [0.130, 0.085, 0.060] },
                says: "the hour before the sun — the floor has lifted but light still rises" },
      /* The inversion proper: a bright ground, a dark organism. Projection,
         the spa, a lobby, any room that is not a black box. */
      mist:   { lift: 0.620, compose: "signed", room: "white", gateAt: 0.15,
                sky: { top: [0.560, 0.600, 0.660], mid: [0.660, 0.700, 0.750], hor: [0.740, 0.770, 0.800] },
                says: "a pale fog with no horizon — the medium IS the ground" },
      paper:  { lift: 0.880, compose: "signed", room: "white", gateAt: 0.15,
                sky: { top: [0.870, 0.870, 0.865], mid: [0.900, 0.898, 0.890], hor: [0.920, 0.918, 0.910] },
                says: "a white field — print, projection onto a pale wall, a gallery" }
    },

    /* THE COMPOSITING MODES. This is the half a preset could never reach.

       "rise"   — memory = max(scene, trail). Light accumulates upward from a
                  dark ground. Correct, and the only mode that has ever existed.
       "signed" — memory is the FURTHEST-FROM-GROUND value, not the brightest.
                  On a bright ground a dark body is the departure, so the trail
                  must remember darkness. Same operation, measured as a signed
                  distance from `lift` rather than an unsigned climb from zero.

       Both reduce to identical arithmetic when lift = 0, which is what keeps
       `void` byte-identical. */
    compose(mode, scene, trail, lift) {
      if (mode !== "signed") return Math.max(scene, trail);
      return (Math.abs(scene - lift) >= Math.abs(trail - lift)) ? scene : trail;
    },

    /* THE DECAY. Memory fades TOWARD THE GROUND, not toward black.

       This is the half the first draft of this law got wrong, and the probe
       caught it: `trail * decay - eps` fades every memory to zero, which is
       correct only when zero IS the ground. On a bright ground a decayed trail
       kept sliding past the floor into negative luminance, and under signed
       compositing a value further from the ground WINS — so a fading memory
       eventually outranked everything and the glass returned -0.1388.

       A memory of a dark body on a pale field should fade back to the pale
       field. The operation is the same one, measured from `lift`. */
    decay(mode, trail, lift, k, eps) {
      if (mode !== "signed") return trail * k - eps;
      const d = trail - lift;
      const mag = Math.abs(d) * k - eps;
      return lift + (mag <= 0 ? 0 : (d < 0 ? -mag : mag));
    },

    /* The memory gate: which pixels are worth remembering. A luminance FLOOR
       ("remember what is bright") is correct only on a dark ground. On a lit
       one the test is DISTANCE from the ground, or the world remembers its own
       empty sky and forgets the organism crossing it. */
    gate(mode, L, lift, at, width) {
      const x = (mode === "signed") ? Math.abs(L - lift) : L;
      const t = Math.min(1, Math.max(0, (x - at) / (width || 0.22)));
      return t * t * (3 - 2 * t);
    },

    /* THE GATED SCENE — what a pixel contributes to memory once the gate has
       spoken. `scene * keep` is right only when zero is the ground: it means
       "not worth remembering, so contribute nothing", and nothing IS the floor.
       On a pale ground, contributing zero is contributing pure black, which
       under signed compositing is the furthest thing from the ground there is —
       so an ungated pixel would win everything and the memory would fill with
       darkness that was never drawn.

       An ungated pixel must fall back TO THE GROUND. Same operation, measured
       from `lift`, and identical to `scene * keep` when lift is zero. */
    gated(mode, scene, lift, at, width) {
      const keep = this.gate(mode, scene, lift, at, width);
      return (mode !== "signed") ? scene * keep : lift + (scene - lift) * keep;
    },

    resolve(name) { return this.grounds[name] || this.grounds.void; }
  };

  /* THE PAIRING. A lit ground REQUIRES an inverted tone curve — that is the
     whole finding of 2026-08-17, where `radiance=white` alone put a bright body
     on a bright floor and the organism sank. The ground names the room it needs;
     this is where a declared ground supplies it, so the two cannot be set
     independently and disagree. An explicitly declared radiance always wins:
     the law informs the default, it does not overrule the director. */
  ZigCore.Canon.pairGroundToRadiance = function (declared) {
    const g = this.law && this.law("ground");
    if (!g || !g.room) return declared || null;
    if (declared) return declared;                       // Bill said otherwise; Bill wins
    const room = ZigCore.Radiance.rooms[g.room];
    if (!room) return declared || null;
    /* THE STAMP MUST NOT LIE. A paired room is really in the shader, so it has
       to be really in the actives — otherwise Canon.stamp() reports "ground
       0.1.0" for a build whose WGSL also carries radiance, and the one place a
       build states what it IS becomes untrustworthy. This was caught by a probe
       reading the live runtime: the ordering rail showed `frame.light:
       radiance` while Canon.law("radiance") returned null. */
    this.actives.radiance = Object.assign({}, room, { pairedBy: "ground" });
    return this.actives.radiance;
  };

  ZigCore.Canon.register({
    id: "ground",
    version: ZigCore.Ground.VERSION,
    pillar: "habitat",
    says: "a world has a ground of being — a floor it never falls below, and a direction its light travels from",
    defaults: { lift: 0.0, compose: "rise", room: null },          // IDENTITY = void
    presets: ZigCore.Ground.grounds,
    presetKey: "ground",                                            // window.ZIG_LAWS = { ground: { ground: "mist" } }
    cpu: null,
    /* ORDERING (Canon.Order 1.0.0): Ground does not ride the frame.light rail.
       It is not a step in the light's journey — it is the STARTING CONDITION of
       that journey, and it also reaches sideways into the afterimage's
       compositing, which is a different pass entirely. A law that changes the
       arithmetic other capabilities compose WITH cannot be a station on their
       rail; it is what the rail runs over. */
    splice: { stage: "scene", owner: "zigwebgpu:createScene+AFTERIMAGE",
              rail: null, station: null, mode: "world", face: "both" },
    /* THE PAIRING REFUSALS — the reason this is a law. Each names a combination
       that renders without error and destroys the piece. */
    refuses: [
      { when: "lift > 0.3 && compose === 'rise'",
        says: "a lit ground with rise compositing: the sky's own memory outranks a dark body, and max() erases the organism (measured: body 0.2500 reaches the glass at 0.8359)" },
      { when: "lift > 0.3 && room === null",
        says: "a lit ground with no inverted tone curve: the body stays bright against a bright floor and sinks — this is what was seen on 2026-08-17" },
      { when: "lift === 0 && compose === 'signed'",
        says: "signed compositing on a dark ground: legal but pointless — it reduces to max() and only costs clarity" }
    ],
    probe: "test/law_ground_ref.mjs",
    doc: "briefs/law_ground.md"
  });

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
    },

    /* BONDS — the world's LINKAGE: matter that is JOINED. Where a boundary contains a
       mass from outside, a bond holds it together from inside — the difference between
       a cloud of agents that happen to fly near each other and a BODY that cannot come
       apart. Flocking's separation is a force between strangers; a bond is a commitment
       between neighbours that survives being pulled.
         rest — the length the link wants to be (FRACTION of frame half-extent, like
                every other archetype, so a body scales with the view it lives in)
         k    — how hard it pulls back to rest (stiffness)
         damp — resistance along the link; without it a chain rings like a spring forever
         bend — ANGULAR stiffness (0..1): how hard a joint resists folding. 0 is a rope
                (limp, folds anywhere); 1 is a spine (wants to continue straight). This
                one number is the whole difference between kelp and a centipede.
         anchor — the root is pinned to its birthplace (holdfast). A stalk is anchored;
                a swimming body is free and its root is simply the head. */
    bonds: {
      none:   null,
      chain:  { restFrac: 0.11, k: 26, damp: 3.2, bend: 0.00 },                 // a limp rope — folds anywhere (tentacle, streamer)
      spine:  { restFrac: 0.10, k: 34, damp: 4.0, bend: 0.55 },                 // a segmented BODY that holds its line (zigpede)
      stalk:  { restFrac: 0.13, k: 30, damp: 3.6, bend: 0.35, anchor: true },   // rooted and springy — sways, never leaves (kelp)
      tether: { restFrac: 0.26, k: 12, damp: 2.0, bend: 0.00 },                 // a long loose leash — followers trail far behind
      eel:    { restFrac: 0.09, k: 20, damp: 1.8, bend: 0.16 }                  // COMPLIANT — holds a line loosely enough to be bent by its own wave (undulation)
    },
    bond(name, frameH) {
      const a = name && this.bonds[name]; if (!a) return null;
      return { rest: (a.restFrac || 0.1) * (frameH || 0), k: a.k || 26, damp: a.damp || 3, bend: a.bend || 0, anchor: !!a.anchor };
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

  /* ==========================================================================
     ZigCore.Frame — WHAT THE CAMERA MUST DO TO HOLD THE SUBJECT. (v0.21)

     A fixed camera distance is a promise about a screen. Change the monitor,
     the window, or the size of the organism and the promise breaks: measured on
     a 2560x1440 capture, the field was cropped on ALL FOUR EDGES while filling
     only 26% of the frame — badly placed and too close at the same time, which
     is what a fixed distance always eventually gives you.

     This is the arithmetic that fixes it, and it is deliberately PURE: no GPU
     readback, no per-frame stall, no knowledge of where the agents actually are.
     A world already declares how big it is — its extent, its boundary — and that
     is enough. Give it the subject's radius and the camera's field of view and
     aspect, and it returns the distance at which the subject exactly fills the
     frame, times whatever margin you want to leave.

     THE ASPECT MATTERS MORE THAN PEOPLE EXPECT. A vertical field of view means a
     WIDE window is generous horizontally and a TALL one is not — so the binding
     constraint swaps depending on the shape of the glass. Fitting to the vertical
     alone is why a piece composed on one monitor is cropped on the next.
     ====================================================================== */
  ZigCore.Frame = {
    VERSION: "0.21.0",

    /* the distance at which a sphere of radius R exactly fills the frame.
       `fov` is the VERTICAL field of view in radians. */
    fit(R, fov, aspect, margin) {
      const m = (margin === undefined) ? 1.12 : margin;
      const halfV = Math.max(1e-3, fov * 0.5);
      const halfH = Math.atan(Math.tan(halfV) * Math.max(0.05, aspect));
      /* the tighter of the two axes decides — this is the line that makes a
         piece survive being moved to a different screen */
      const need = Math.max(R / Math.sin(halfV), R / Math.sin(halfH));
      return need * m;
    },

    /* the radius a world of this extent and boundary actually occupies */
    radius(extent, bound) {
      let r = extent;
      if (bound) {
        if (bound.shape === "ellipsoid") r = Math.min(r, Math.hypot(bound.rx || r, bound.ry || r, bound.rz || r));
        else if (bound.r) r = Math.min(r, bound.r);
      }
      return r;
    },

    /* ease a camera distance toward its target — a camera that SNAPS reads as a
       cut, and a piece that recomposes itself should breathe rather than jump */
    ease(current, target, dt, rate) {
      const k = 1 - Math.exp(-dt * ((rate === undefined) ? 1.6 : rate));
      return current + (target - current) * k;
    }
  };

  /* ==========================================================================
     ZigCore.Escapement — FILL UNTIL IT IS ENOUGH, THEN ALL AT ONCE. (v0.20)

     The Canon has laws for things that flow and things that touch, but none for
     the pattern where something ACCUMULATES QUIETLY AND THEN DISCHARGES. That
     pattern is everywhere: a tipping-bucket rain gauge, a geyser, a seed pod, a
     heart filling and emptying, a neuron reaching its action potential, and the
     escapement in a clock. All the same shape — a store, a threshold, a release,
     a reset — and all of them turn a CONTINUOUS supply into a COUNTABLE event.

     That last part is why this is a clock rather than a valve. If the fill rate
     is steady the period is threshold divided by rate, so a chain of stages with
     different thresholds gives seconds, minutes and hours from one supply. Rube
     Goldberg as GEARING.

     HYSTERESIS is not a detail. A store that discharges the instant it is full
     and refills the instant it is empty will chatter at the frame rate rather
     than tick; `reset` is the level it must fall BELOW before it can arm again,
     and it is what makes the beat discrete. A real tipping bucket has it as
     geometry: once tipped past centre it must swing right back before it can
     catch again.

     `phase` runs 0..1 through the discharge so a body can be drawn mid-tip —
     a lid halfway over is the most legible moment in the whole cycle.
     ====================================================================== */
  ZigCore.Escapement = {
    VERSION: "0.20.0",

    /* `full` is the level that trips it · `reset` the level it must fall below
       to arm again · `spill` seconds the discharge takes (the tip itself). */
    create(opts) {
      const o = opts || {};
      return {
        level: +o.level || 0,
        full: (o.full === undefined) ? 1 : +o.full,
        reset: (o.reset === undefined) ? 0.12 : +o.reset,
        spill: (o.spill === undefined) ? 0.6 : +o.spill,
        armed: true,          // able to trip
        tipping: false,       // mid-discharge
        phase: 0,             // 0..1 through the tip
        ticks: 0,             // how many times it has fired
        last: -1              // seconds since the last fire, -1 = never
      };
    },

    /* add to the store — whatever the supply is, in whatever units */
    fill(e, amount) { if (!e.tipping) e.level += amount; return e; },

    /* advance. Returns TRUE on the frame it fires, so a caller can drive the
       next stage from the return value and nothing else. */
    step(e, dt) {
      let fired = false;
      if (e.last >= 0) e.last += dt;
      if (e.tipping) {
        /* re-arm the MOMENT the tip empties it, not on a later frame. Waiting
           until the next step lets a fast supply refill past the reset level in
           the gap — and then the arming branch never runs and the store is
           deadlocked, disarmed and filling forever. Found by tracing: level
           jumped 0 to 5 in one frame with reset at 4.9 and it never ticked
           again. An escapement must arm on the way DOWN, which is where a real
           tipping bucket arms too: as it swings back through centre. */
        e.phase += dt / Math.max(1e-4, e.spill);
        /* the store empties as it tips, so a body drawn from `level` visibly
           pours rather than vanishing */
        e.level *= Math.max(0, 1 - dt / Math.max(1e-4, e.spill) * 1.6);
        if (e.level <= e.reset) e.armed = true;
        if (e.phase >= 1) { e.phase = 0; e.tipping = false; e.level = 0; e.armed = true; }
      } else if (e.armed && e.level >= e.full) {
        e.tipping = true; e.armed = false; e.phase = 0;
        e.ticks++; e.last = 0; fired = true;
      } else if (!e.armed && e.level <= e.reset) {
        e.armed = true;                       /* hysteresis: it must fall first */
      }
      return fired;
    },

    /* 0..1 — how full, for drawing */
    charge(e) { return Math.max(0, Math.min(1, e.level / Math.max(1e-9, e.full))); }
  };

  /* ==========================================================================
     ZigCore.Coalesce — WHEN TWO TOUCH, THEY BECOME ONE. (v0.19)

     The exact counterpart to `Contact`, and deliberately built on the same
     detection: contact says TWO CANNOT BE IN THE SAME PLACE, coalescence says
     WHEN THEY TOUCH THEY BECOME ONE. Same broadphase, same pair test, opposite
     resolution. Any world that can exclude can also merge.

     VOLUME IS THE CONSERVED QUANTITY, not radius — r = (r1^3 + r2^3)^(1/3).
     That single choice gives the piece its shape for free. Buoyancy scales with
     VOLUME and drag with AREA, so a merged bubble rises FASTER than either
     parent: the motion accelerates. Meanwhile each merge halves the population,
     so the EVENT RATE collapses — thousands of collisions in the first seconds,
     then a long patient drift of four huge bubbles toward each other. Motion
     speeding up while events slow down is a tension nothing had to be told to do.

     MOMENTUM IS CONSERVED with volume as mass, so a big slow bubble absorbing a
     small fast one barely changes course — which is what makes the survivor feel
     heavy rather than merely large.

     NO DELETION. The flock has a fixed agent count, so an absorbed bubble is not
     removed: its radius goes to zero and it is parked. `UNSEEN` already proved an
     agent can be fully present and not drawn; this is the same idea with the
     physics switched off too. No allocation, and the burst simply wakes them all.

     The LOWER index always survives, so a run is deterministic and repeatable —
     the same seed gives the same collapse every time, which a piece that runs
     unattended needs.
     ====================================================================== */
  ZigCore.Coalesce = {
    VERSION: "0.19.0",

    /* merge every touching pair. `r` is per-agent radius; a radius of 0 is a
       parked agent and is skipped. Returns the number of merges performed. */
    step(pos, vel, r, n, opts) {
      const o = opts || {};
      const touch = (o.touch === undefined) ? 1 : o.touch;   // how close counts as contact
      /* GROUPS — bubbles only merge with their own kind. A piece with several
         populations (in a vessel · held at a nozzle · released and free) needs
         them kept apart, or a departing bubble swallows the field it just left.
         `keep` names one index that must SURVIVE every merge it takes part in,
         which is what lets a bubble held at a nozzle absorb arrivals without
         ever being absorbed itself. */
      const grp = o.group || null;
      /* `keep` may name SEVERAL protected indices — a world with six nozzles has
         six bubbles that must each survive every merge they take part in, and
         protecting only one leaves the other five to be absorbed by their own
         arrivals. */
      const keepList = (o.keep === undefined || o.keep === null) ? null
                     : (Array.isArray(o.keep) ? o.keep : [o.keep]);
      const isKeep = keepList ? ((x) => keepList.indexOf(x) >= 0) : (() => false);
      /* CARGO — any per-agent quantity that must be CONSERVED through a merge,
         summed rather than averaged. Volume is conserved by construction; this
         lets a world conserve what a body is CARRYING as well. A bubble that
         accretes material from the water it passes through becomes heavier with
         age, and a bubble that has absorbed a hundred others carries all their
         cargo — so weight becomes the sum of many histories, while size is only
         the sum of many volumes. That difference is what lets a large old body
         hang in equilibrium while a large young one still rises. */
      let cargo = o.cargo || null;
      /* one array or several — colour needs three channels, and a world that
         conserves colour as VOLUME-WEIGHTED cargo gets the mix for free: store
         channel x volume, sum through the merge, divide by volume to read it
         back. The blend is then exactly proportional to what each body brought. */
      if (cargo && !Array.isArray(cargo)) cargo = [cargo];
      /* FILM DRAINAGE — two bodies that touch do not merge at once. The film
         between them has to thin and break first, which for real bubbles takes
         anywhere from an instant to several seconds, and is why they visibly
         PRESS against each other and hesitate before becoming one. `delay` is
         that dwell in seconds and `dwell` is the per-agent accumulator; pair a
         delay with `ZigCore.Contact` and the two bodies genuinely lean on one
         another for the duration instead of vanishing into each other on the
         frame they meet. Delay 0 restores the instantaneous behaviour. */
      const delay = (o.delay === undefined) ? 0 : o.delay;
      const dwell = o.dwell || null;
      const dt = (o.dt === undefined) ? 0 : o.dt;
      const touching = (delay > 0 && dwell) ? new Uint8Array(n) : null;
      /* a world that wants to ANIMATE the merge needs to know what just happened
         and where both parents were — the survivor's own position is already the
         volume-weighted centroid by the time the caller sees it. */
      const onMerge = o.onMerge || null;
      let rMax = 0;
      for (let i = 0; i < n; i++) if (r[i] > rMax) rMax = r[i];
      if (rMax <= 0) return 0;

      /* same uniform grid as Contact, and the same INJECTIVE key — the obvious
         a*P1 ^ b*P2 collapses at the origin and double-visits buckets. */
      const D = rMax * 2 * touch;
      const cells = new Map();
      const key = (a, b) => a * 4194304 + b;
      for (let i = 0; i < n; i++) {
        if (r[i] <= 0) continue;
        const kk = key(Math.floor(pos[i*3] / D), Math.floor(pos[i*3+1] / D));
        let arr = cells.get(kk); if (!arr) { arr = []; cells.set(kk, arr); }
        arr.push(i);
      }

      let merges = 0;
      for (let i = 0; i < n; i++) {
        if (r[i] <= 0) continue;
        const cx = Math.floor(pos[i*3] / D), cy = Math.floor(pos[i*3+1] / D);
        for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
          const arr = cells.get(key(cx + gx, cy + gy)); if (!arr) continue;
          for (let a = 0; a < arr.length; a++) {
            const j = arr[a];
            if (j <= i || r[j] <= 0 || r[i] <= 0) continue;
            if (grp && grp[i] !== grp[j]) continue;         // different kinds do not merge
            const dx = pos[i*3] - pos[j*3], dy = pos[i*3+1] - pos[j*3+1], dz = pos[i*3+2] - pos[j*3+2];
            const reach = (r[i] + r[j]) * touch;
            if (dx*dx + dy*dy + dz*dz >= reach * reach) continue;

            /* in contact — but the film has to drain before they are one */
            if (touching) {
              touching[i] = 1; touching[j] = 1;
              const ready = Math.min(dwell[i], dwell[j]) + dt;
              if (ready < delay) continue;                 // still pressing
            }

            /* VOLUME conserved; mass IS volume, so the centroid and the velocity
               are both volume-weighted and momentum survives the merge. */
            /* the survivor is the lower index, unless `keep` names the other —
               a bubble held at a nozzle must never be the one absorbed. */
            const A = isKeep(j) ? j : i, B = isKeep(j) ? i : j;
            /* reported BEFORE anything is modified — by the time the survivor's
               position is the volume-weighted centroid, both originals are gone */
            if (onMerge) onMerge(A, B,
              pos[A*3], pos[A*3+1], pos[A*3+2], r[A],
              pos[B*3], pos[B*3+1], pos[B*3+2], r[B]);
            const va = r[A]*r[A]*r[A], vb = r[B]*r[B]*r[B], vt = va + vb;
            for (let k = 0; k < 3; k++) {
              pos[A*3+k] = (pos[A*3+k]*va + pos[B*3+k]*vb) / vt;
              vel[A*3+k] = (vel[A*3+k]*va + vel[B*3+k]*vb) / vt;
              pos[B*3+k] = 0; vel[B*3+k] = 0;
            }
            if (cargo) for (const c of cargo) { c[A] += c[B]; c[B] = 0; }   // summed, never averaged
            r[A] = Math.cbrt(vt);
            r[B] = 0;                                  // parked, not deleted
            merges++;
          }
        }
      }
      /* advance the dwell of everything still in contact, clear the rest */
      if (touching) {
        for (let i = 0; i < n; i++) {
          if (r[i] <= 0) { dwell[i] = 0; continue; }
          dwell[i] = touching[i] ? dwell[i] + dt : 0;
        }
      }
      return merges;
    },

    /* how many bubbles are still alive */
    alive(r, n) { let c = 0; for (let i = 0; i < n; i++) if (r[i] > 0) c++; return c; },

    /* total volume — the invariant. A run that loses volume has a bug. */
    volume(r, n) { let v = 0; for (let i = 0; i < n; i++) v += r[i]*r[i]*r[i]; return v; }
  };

  /* ==========================================================================
     ZigCore.Wake — RECIPROCITY: the medium remembers being moved. (v0.18)

     Every medium law so far has been ONE-WAY. `zigflow` pushes agents; `medium`
     gives them drag; `slip` decides along from across. In every case the world
     acts on the creature and the creature leaves no mark. That asymmetry is the
     deepest tell that a Zigverse world is a simulation rather than a place —
     real bodies disturb what they move through, and the disturbance outlives
     them by a few seconds.

     This is a MOMENTUM FIELD on a grid. An agent pushing against the medium
     deposits exactly what it takes; the field spreads and fades; and the field
     pushes back on whatever is standing in it. Because deposit and sample are
     the same coupling with the sign reversed, momentum is CONSERVED between body
     and medium — the proof checks it, so nothing here is a hidden thruster.

     What it buys, beyond honesty: a wake is shared history. One body's passage
     changes the water another body swims in, so DRAFTING falls out — a follower
     in the leader's wake is carried. Nothing scripts that; it is what a momentum
     field does. It is also the substrate Scout's note keeps circling (social
     signalling, resource economies, light ecology are all "a field that spreads
     and decays, written by agents and read by agents") — a scalar version of
     exactly this machinery.

     HONEST SCOPE — this is deposit, diffuse, decay. It is not a fluid solver:
     no self-advection, no pressure projection, therefore NO VORTICITY. That has
     one specific consequence worth stating plainly, because the obvious guess is
     wrong: there is no DRAFTING here. Real schooling benefit comes from the
     reverse Karman street a swimmer sheds, and a diffusive field has no vortices
     to sit between. Measured: a follower directly behind a leader is pushed
     BACKWARD, always, with the effect falling off as it moves laterally aside —
     which is honest backwash, and is incidentally why real fish school OFFSET
     rather than in line.

     What it does give, all of it earned rather than scripted: momentum
     conservation between body and medium · a wake that fades and spreads · one
     body's passage measurably changing the water another is in · and INDUCED
     DRAG — a swimmer that sheds momentum goes slower for it (48.05 without a
     wake, 46.38 with), which nothing in the code asks for.
     ====================================================================== */
  ZigCore.Wake = {
    VERSION: "0.18.0",

    /* a grid of momentum over a square region, anchored at (ox, oy) */
    create(cells, cell, ox, oy) {
      const n = cells | 0;
      return { n, cell, ox: ox || 0, oy: oy || 0,
               vx: new Float64Array(n * n), vy: new Float64Array(n * n),
               tx: new Float64Array(n * n), ty: new Float64Array(n * n) };
    },

    /* RECENTER — shift the grid by whole cells so a travelling body stays inside
       it. Whole cells only, so the shift is lossless: the wake is carried, not
       resampled. What scrolls off the edge is forgotten, which is correct — a
       wake that far behind has faded anyway. */
    recenter(g, x, y) {
      const half = g.n * g.cell * 0.5;
      const di = Math.round((x - half - g.ox) / g.cell), dj = Math.round((y - half - g.oy) / g.cell);
      if (!di && !dj) return false;
      g.tx.fill(0); g.ty.fill(0);
      for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
        const si = i + di, sj = j + dj;
        if (si < 0 || si >= g.n || sj < 0 || sj >= g.n) continue;
        g.tx[j * g.n + i] = g.vx[sj * g.n + si];
        g.ty[j * g.n + i] = g.vy[sj * g.n + si];
      }
      g.vx.set(g.tx); g.vy.set(g.ty);
      g.ox += di * g.cell; g.oy += dj * g.cell;
      return true;
    },

    /* bilinear weights for a world point; returns false if outside */
    _at(g, x, y, o) {
      const fx = (x - g.ox) / g.cell, fy = (y - g.oy) / g.cell;
      const i0 = Math.floor(fx), j0 = Math.floor(fy);
      if (i0 < 0 || j0 < 0 || i0 >= g.n - 1 || j0 >= g.n - 1) return false;
      const sx = fx - i0, sy = fy - j0;
      o.i0 = i0; o.j0 = j0;
      o.w00 = (1 - sx) * (1 - sy); o.w10 = sx * (1 - sy);
      o.w01 = (1 - sx) * sy;       o.w11 = sx * sy;
      return true;
    },

    /* STIR — agents give the medium exactly what they take from it. `push` is the
       per-agent acceleration the body is applying AGAINST the water; the field
       receives the negative.

       The deposit is SHED BEHIND the agent, one `shed` distance down its own
       velocity. Without that offset an agent writes into the cell it is standing
       in and samples it back the same step — it pushes against its own backwash
       and cancels itself out. (Measured before the fix: a swimmer pushing +9 the
       whole time travelled BACKWARD, -8 to -24.) A real swimmer leaves its wake
       behind; that is not a detail, it is the whole mechanism. */
    stir(g, pos, vel, n, head, push, dt, gain, shed) {
      /* the field holds VELOCITY, `push` is an ACCELERATION, so what is deposited
         is an IMPULSE: push x dt. Without the dt the wake accumulates without
         bound every step and the swimmer drowns in its own backwash — measured
         before this fix, a body pushing +9 forever ended up at -56. `gain`
         absorbs how much water a cell stands for. */
      const k = ((gain === undefined) ? 1 : gain) * dt;
      const o = {};
      const back = (shed === undefined) ? g.cell * 1.5 : shed;
      for (let a = (head || 0); a < n; a++) {
        let bx = 0, by = 0;
        if (vel) {
          const vx = vel[a * 3], vy = vel[a * 3 + 1];
          const L = Math.hypot(vx, vy);
          if (L > 1e-6) { bx = -vx / L * back; by = -vy / L * back; }
        }
        if (!this._at(g, pos[a * 3] + bx, pos[a * 3 + 1] + by, o)) continue;
        const px = -push[a * 3] * k, py = -push[a * 3 + 1] * k;
        const b = o.j0 * g.n + o.i0;
        g.vx[b] += px * o.w00; g.vy[b] += py * o.w00;
        g.vx[b + 1] += px * o.w10; g.vy[b + 1] += py * o.w10;
        g.vx[b + g.n] += px * o.w01; g.vy[b + g.n] += py * o.w01;
        g.vx[b + g.n + 1] += px * o.w11; g.vy[b + g.n + 1] += py * o.w11;
      }
      return g;
    },

    /* RELAX — the wake spreads and fades. `spread` 0..0.25 is how far momentum
       leaks to neighbours per step; `life` is the seconds to fall to 1/e. Water
       has memory, but not forever. */
    relax(g, dt, opts) {
      const o = opts || {};
      const spread = Math.max(0, Math.min(0.24, o.spread === undefined ? 0.12 : o.spread));
      const life = o.life === undefined ? 2.2 : o.life;
      const keep = Math.exp(-dt / Math.max(1e-3, life));
      const N = g.n;
      g.tx.set(g.vx); g.ty.set(g.vy);
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        const b = j * N + i;
        const lapx = g.tx[b - 1] + g.tx[b + 1] + g.tx[b - N] + g.tx[b + N] - 4 * g.tx[b];
        const lapy = g.ty[b - 1] + g.ty[b + 1] + g.ty[b - N] + g.ty[b + N] - 4 * g.ty[b];
        g.vx[b] = (g.tx[b] + spread * lapx) * keep;
        g.vy[b] = (g.ty[b] + spread * lapy) * keep;
      }
      /* edges just fade — momentum that reaches the rim leaves the world */
      for (let i = 0; i < N; i++) {
        for (const b of [i, (N - 1) * N + i, i * N, i * N + N - 1]) { g.vx[b] *= keep * 0.9; g.vy[b] *= keep * 0.9; }
      }
      return g;
    },

    /* CARRY — the field pushes back on whatever stands in it. This is the other
       half of `stir`, and the pair is what makes the coupling reciprocal.

       It is a VELOCITY MATCH, not a raw acceleration: the water pulls a body
       toward the water's own motion, `k * (fluid - body)`. Still water therefore
       drags a moving body, moving water carries a still one, and a body already
       going with the flow feels nothing — which is what being IN a medium means.
       Raw acceleration would give none of those three. */
    carry(g, pos, vel, n, head, acc, gain) {
      const k = (gain === undefined) ? 1 : gain, o = {};
      for (let a = (head || 0); a < n; a++) {
        if (!this._at(g, pos[a * 3], pos[a * 3 + 1], o)) continue;
        const b = o.j0 * g.n + o.i0;
        const fx = g.vx[b] * o.w00 + g.vx[b + 1] * o.w10 + g.vx[b + g.n] * o.w01 + g.vx[b + g.n + 1] * o.w11;
        const fy = g.vy[b] * o.w00 + g.vy[b + 1] * o.w10 + g.vy[b + g.n] * o.w01 + g.vy[b + g.n + 1] * o.w11;
        acc[a * 3] += (fx - vel[a * 3]) * k;
        acc[a * 3 + 1] += (fy - vel[a * 3 + 1]) * k;
      }
      return acc;
    },

    /* TOTAL — the momentum the medium is holding. The proof's honesty check:
       what the body gave up must show up here. */
    total(g) {
      let x = 0, y = 0;
      for (let i = 0; i < g.vx.length; i++) { x += g.vx[i]; y += g.vy[i]; }
      return [x, y];
    },

    /* ENERGY — for measuring that a wake actually fades. */
    energy(g) { let e = 0; for (let i = 0; i < g.vx.length; i++) e += g.vx[i]*g.vx[i] + g.vy[i]*g.vy[i]; return e; }
  };

  /* ==========================================================================
     ZigCore.Contact — MATTER THAT OCCUPIES SPACE (v0.16 · 2026-08-07)

     Nothing in the Canon has ever given an agent VOLUME. Flocking's separation is
     a force between strangers — a preference, not a body — and a preference can
     always be overpowered. So a coil passes through its own length, and a world
     has nothing in it that a creature must actually go AROUND.

     This is the first half of that law: STATIC exclusion. A stone, a pillar, a
     post, a reef — an object held still that a body cannot enter. The general
     case (a body refusing to pass through itself, every segment against every
     other) is the same mathematics with both sides moving, so building the fixed
     case first is a stepping stone rather than a detour.

     Why an object matters more than it sounds: a line with something to work
     around stops being a drawing and becomes a creature in a PLACE. It can wrap,
     brace, hide behind, and be deflected — and with `slip` it slides around an
     obstacle along its own length the way a snake does, instead of pancaking
     against it. (Bill, 2026-08-07: "wondering whether there could be a static
     object that the line could operate around.")

     Shapes are `{x, y, z, r}`. `skin` is the body's own half-thickness, so a
     segment stops with its surface touching rather than its centre. The response
     is a stiff spring on PENETRATION DEPTH plus damping along the normal, which
     is the same shape as a bond and settles rather than bouncing forever.
     Opt-in: no shapes, no work, byte-identical. ============================== */
  ZigCore.Contact = {
    VERSION: "0.17.0",

    exclude(pos, vel, n, head, acc, shapes, opts) {
      if (!shapes || !shapes.length) return acc;
      const o = opts || {};
      const k = (o.k === undefined) ? 400 : o.k;
      const damp = (o.damp === undefined) ? 12 : o.damp;
      const skin = o.skin || 0;
      const h = head || 0;
      for (let i = h; i < n; i++) {
        const i3 = i * 3;
        for (let s = 0; s < shapes.length; s++) {
          const sh = shapes[s];
          const dx = pos[i3] - sh.x, dy = pos[i3 + 1] - sh.y, dz = pos[i3 + 2] - (sh.z || 0);
          const R = sh.r + skin;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= R * R) continue;                       // outside — nothing to do
          const d = Math.sqrt(d2) || 1e-6;
          const nx = dx / d, ny = dy / d, nz = dz / d;
          const pen = R - d;                               // how far in it has got
          let f = pen * k;
          if (vel) {                                       // bleed the approach, not the slide
            const vn = vel[i3] * nx + vel[i3 + 1] * ny + vel[i3 + 2] * nz;
            if (vn < 0) f -= vn * damp;
          }
          acc[i3] += nx * f; acc[i3 + 1] += ny * f; acc[i3 + 2] += nz * f;
        }
      }
      return acc;
    },

    /* ==========================================================================
       SELF — a body that cannot pass through ITSELF. (v0.17)

       The other half of contact, and the hard half. A stone is cheap because it
       holds still: one pass over the agents. A body against itself is every
       segment against every other, changing every frame — 240 segments is ~28,000
       pairs per substep, times four to eight substeps, times sixty frames. Naive
       does not hold framerate, so this buckets the body into a UNIFORM GRID at the
       contact diameter and only tests the nine cells around each segment. Cost
       goes from O(n²) to roughly O(n).

       TWO THINGS MUST BE SKIPPED or the law tears the body apart instead of
       protecting it:
         · the segment's own near neighbours along the chain (`skip` links), which
           are touching BY CONSTRUCTION — a bond holds them at rest length, and
           asking them to also stay a diameter apart is a contradiction the two
           laws would fight over forever;
         · every pair twice. Each pair is resolved once, with equal and opposite
           force, so the body conserves its own momentum and cannot push itself.

       What this buys: coils PACK instead of interpenetrating. A tight turn stops
       being a line crossing a line and becomes a body pressed against itself —
       which is what a snake in a knot, kelp in a mat, or a shell's whorls actually
       are. (Bill's v0.6 recording showed a body running clean through its own
       coils; this is the answer to it.) ==================================== */
    self(pos, vel, par, n, head, acc, opts) {
      const o = opts || {};
      const R = o.r || 0;                                  if (R <= 0) return acc;
      /* PER-AGENT RADII, for bodies that are not one thickness. A shell is
         allometric — the apex is tiny and the aperture is huge — and forcing a
         single radius on it shoves the small inner whorls apart by the APERTURE's
         diameter, so they cannot nest and the spiral tangles. With `radii` the
         contact distance for a pair is r_i + r_j, which is what two spheres of
         different size actually want. `r` still sets the broadphase cell, so it
         should be the LARGEST radius present. (Found by species/shell.js.) */
      const RA = o.radii || null;
      /* self-contact must be STIFF. A body pressing on itself is fighting its own
         bonds, which are stiff by construction, so a soft response just lets the
         coil sink in: measured on a 3-turn coil, k 700 leaves 0.31 of overlap
         while k 6000 leaves 0.03 — the difference between "pushes back" and
         "keeps matter out". */
      const k = (o.k === undefined) ? 6000 : o.k;
      const damp = (o.damp === undefined) ? 50 : o.damp;
      const skip = (o.skip === undefined) ? 4 : o.skip;
      const maxF = (o.max === undefined) ? 0 : +o.max;   // 0 = no ceiling (historical)
      const h = head || 0, D = R * 2;
      if (n - h < skip + 2) return acc;

      /* bucket into a uniform grid at the contact diameter */
      const cells = new Map();
      /* The cell key must be INJECTIVE over the neighbourhoods actually walked,
         or a bucket is visited twice and every pair inside it counted twice.
         The obvious `a*P1 ^ b*P2` is NOT: xor collapses whenever a term is zero,
         so cell (0,0)'s nine-cell neighbourhood yields only SEVEN distinct keys —
         and a clump centred on the origin lands squarely in it. Found by
         parity_contact.html on 2026-08-08, where it put the CPU law and the GPU
         kernel 3.7e+1 apart while both were individually correct.
         A single multiply-add over a bounded lane is injective for any |b| under
         the lane width, which no realistic world exceeds. */
      const key = (a, b) => a * 4194304 + b;
      for (let i = h; i < n; i++) {
        const cx = Math.floor(pos[i*3] / D), cy = Math.floor(pos[i*3+1] / D);
        const kk = key(cx, cy);
        let arr = cells.get(kk); if (!arr) { arr = []; cells.set(kk, arr); }
        arr.push(i);
      }

      for (let i = h; i < n; i++) {
        const i3 = i * 3;
        const cx = Math.floor(pos[i3] / D), cy = Math.floor(pos[i3+1] / D);
        for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
          const arr = cells.get(key(cx + gx, cy + gy)); if (!arr) continue;
          for (let a = 0; a < arr.length; a++) {
            const j = arr[a];
            if (j <= i) continue;                          // each pair exactly once
            if (j - i <= skip) continue;                   // bonded neighbours are touching by construction
            const j3 = j * 3;
            const dx = pos[i3] - pos[j3], dy = pos[i3+1] - pos[j3+1], dz = pos[i3+2] - pos[j3+2];
            const d2 = dx*dx + dy*dy + dz*dz;
            const Dij = RA ? (RA[i] + RA[j]) : D;
            if (d2 >= Dij * Dij) continue;
            const d = Math.sqrt(d2) || 1e-6;
            const nx = dx/d, ny = dy/d, nz = dz/d;
            let f = (Dij - d) * k;
            if (vel) {
              const vn = (vel[i3]-vel[j3])*nx + (vel[i3+1]-vel[j3+1])*ny + (vel[i3+2]-vel[j3+2])*nz;
              if (vn < 0) f -= vn * damp;
            }
            /* PER-PAIR ceiling (optional). A deep overlap is unbounded, and an
               unbounded force fires one agent out of the mass while the rest sit —
               which reads as popping rather than as a body. Clamping the PAIR (not
               the agent) keeps both sides identical, so forces stay equal and
               opposite and momentum is still conserved. */
            if (maxF > 0 && f > maxF) f = maxF;
            f *= 0.5;                                       // shared between the two
            acc[i3] += nx*f; acc[i3+1] += ny*f; acc[i3+2] += nz*f;
            acc[j3] -= nx*f; acc[j3+1] -= ny*f; acc[j3+2] -= nz*f;
          }
        }
      }
      return acc;
    },

    /* WORST — the deepest self-overlap, in world units. Ignores the same near
       neighbours the law does, so it measures what the law is actually
       responsible for rather than the bonds it is not allowed to touch. */
    worstSelf(pos, n, head, r, skip, radii) {
      const D = r * 2, sk = (skip === undefined) ? 4 : skip;
      let worst = 0;
      for (let i = (head||0); i < n; i++) for (let j = i + sk + 1; j < n; j++) {
        const Dij = radii ? (radii[i] + radii[j]) : D;
        const d = Math.hypot(pos[i*3]-pos[j*3], pos[i*3+1]-pos[j*3+1], pos[i*3+2]-pos[j*3+2]);
        if (Dij - d > worst) worst = Dij - d;
      }
      return worst;
    },

    /* DEEPEST — how far the worst offender has penetrated, in world units. The
       proof's honesty check: a law that merely pushes back is not the same as a
       law that keeps matter OUT, and only a measurement tells them apart. */
    deepest(pos, n, head, shapes, skin) {
      if (!shapes || !shapes.length) return 0;
      let worst = 0;
      for (let i = (head || 0); i < n; i++) {
        for (let s = 0; s < shapes.length; s++) {
          const sh = shapes[s], R = sh.r + (skin || 0);
          const d = Math.hypot(pos[i*3] - sh.x, pos[i*3+1] - sh.y, pos[i*3+2] - (sh.z || 0));
          if (R - d > worst) worst = R - d;
        }
      }
      return worst;
    }
  };

  /* ==========================================================================
     ZigCore.Structure — THE STRUCTURE LAW (v0.13 · 2026-08-07)
     Every organism so far has been a CLOUD: agents that influence each other but
     never hold on. Structure is the law of matter that is JOINED — and it is the
     one law Rootwhale, Kelp and Zigpede are all waiting on, because none of them
     is a cloud. A whale is articulated, kelp is rooted and segmented, a zigpede
     is a body that follows its own head.

     THE TOPOLOGY IS A PARENT INDEX. `par[i]` is the index of the agent that i is
     bonded to, or -1 if i is a root. That single array expresses every shape this
     law needs to serve — a chain (each links to the last), a tree (many children
     per parent, branching), an anchored stalk (root pinned), a free swimmer (root
     is the head). No new structure is needed to add a new body plan; only a
     different parent array. Species stay thin.

     GROWTH IS APPENDING. Because the topology is just an index, a body can be
     EXTENDED at runtime: `grow()` bonds a new agent to the tail and places it one
     rest-length along the body's own heading. A performer who plays a stream of
     notes grows the organism note by note, and because the chain is built in the
     order it was played, POSITION ALONG THE BODY IS TIME. The history is not
     stored beside the organism — the organism *is* the history. (Bill, 2026-08-07.)

     THE LAW, per bonded agent i with parent p:
       1. SPRING   — the link wants to be `rest` long; deviation pulls back at k.
       2. DAMPING  — resists closing/opening speed ALONG the link only, so a body
                     settles instead of ringing. Lateral motion is untouched, which
                     is what lets a chain still swing freely while not oscillating.
       3. BENDING  — if p has a parent g, the joint at p resists folding: i is
                     drawn toward where it would sit if the body continued STRAIGHT
                     out of g→p. Scaled by `bend`. This is what separates a spine
                     from a rope, and it costs one extra index lookup.
     Forces are equal and opposite (Newton's third) so a free body conserves its
     own momentum and can swim rather than pull itself through space by its
     bootstraps. An anchored root ignores everything and stays home.

     The engine's WGSL compute mirrors these functions exactly; `structure_ref.mjs`
     is the proof that guards them. ========================================== */
  ZigCore.Structure = {
    VERSION: "0.15.0",

    /* CHAIN — the simplest topology: 0 is the root, every other agent bonds to the
       one before it. `n` agents ⟶ a parent array. The building block for kelp,
       zigpede, tentacles, and any performance-grown body. */
    chain(n, offset) {
      const o = offset || 0, par = new Int32Array(n);
      for (let i = 0; i < n; i++) par[i] = (i === 0) ? -1 : (o + i - 1);
      return par;
    },

    /* GROW — bond a new agent to the tail and place it one rest-length out.
       `dir` STEERS the growth: pass a heading and the body turns that way, which
       is how a performance draws (interval → heading → shape). Omit `dir` and the
       body continues its own line, so an unsteered stream grows straight. Returns
       the new agent's index. One note, one segment. */
    grow(state, bond, dir, len) {
      const { pos, par } = state, n = state.n;
      const tail = n - 1, prev = par[tail];
      let d = dir;
      if (!d) {                                          // unsteered: continue the body's own line
        if (prev >= 0) d = [pos[tail * 3] - pos[prev * 3], pos[tail * 3 + 1] - pos[prev * 3 + 1], pos[tail * 3 + 2] - pos[prev * 3 + 2]];
        else d = [0, 1, 0];                              // a lone agent has no line yet
      }
      const L = Math.hypot(d[0], d[1], d[2]) || 1;
      d = [d[0] / L, d[1] / L, d[2] / L];
      const i = n;
      const step = (len === undefined) ? bond.rest : len;
      if (state.rest) state.rest[i] = step;
      if (state.kap0) state.kap0[i] = 0;      // plain growth rests straight; shell() overwrites
      pos[i * 3]     = pos[tail * 3]     + d[0] * step;
      pos[i * 3 + 1] = pos[tail * 3 + 1] + d[1] * step;
      pos[i * 3 + 2] = pos[tail * 3 + 2] + d[2] * step;
      par[i] = tail;
      state.n = n + 1;
      return i;
    },

    /* REFINE — the same body at higher RESOLUTION. Returns a bond that produces a
       physically IDENTICAL organism made of `factor`× more, shorter segments.

       Resolution and legibility look like a trade-off and are not. A body only
       became a thread when it grew LONGER; here the length is held and the joints
       are subdivided, so the camera never pulls back — the creature just stops
       being a bicycle chain and starts being flesh.

       The scaling is not free choice, it is forced. With N segments in series the
       root link carries N times the load while each rest length is 1/N, so relative
       stretch goes as N²/k — stiffness MUST scale with the square of the factor or
       a finer body sags into a longer one. Damping scales linearly (it partners a
       velocity, not a displacement). `bend` needs no scaling at all: its weight is
       bend·k acting on an error that shrinks as 1/factor, so it stays in proportion
       on its own. Measured invariant to 8× — contour 1.269 → 1.258, tip −66.0 → −65.4.

       `substeps` comes back with the bond because it is not advice: explicit
       integration is stable while dt·√k stays small, and k grew as factor², so the
       timestep must shrink as factor. Ignoring it does not degrade the body, it
       destroys it (measured: factor 8 at one substep goes non-finite).

       A species asks for the detail it wants; it does not re-derive this. */
    refine(bond, factor) {
      const f = Math.max(1, factor || 1);
      return {
        rest: bond.rest / f,
        k: bond.k * f * f,
        damp: bond.damp * f,
        bend: bond.bend,
        anchor: bond.anchor,
        substeps: Math.max(1, Math.ceil(f / 4))
      };
    },

    /* ==========================================================================
       UNDULATE — the travelling wave, as REST CURVATURE. (v0.15)

       A bonded body has a spine and `age()` already tells every segment how far
       along it sits. Feed that in as a PHASE OFFSET and the whole body carries a
       wave from head to tail — how every eel, fish, snake and worm moves. No new
       rhythm law was needed: this is `zigphase`'s clock read through `structure`'s
       geometry.

       IT WRITES ANGLES, NOT FORCES. The first version applied a lateral force and
       it was wrong in a way worth recording: a force competes with the spring that
       holds the body together, so driving it hard enough to move the animal tore
       the animal open — measured at 2.9x its own rest length, bonds ripped, no
       usable window between "does not move" and "explodes". Muscle does not shove
       a body sideways; it changes what the body considers to be REST, and the
       elastic structure follows. Amplitude here is an ANGLE PER JOINT, so it is
       bounded by geometry: no drive level can stretch a bond.

       s = 1 - age is distance behind the leading end. The wave lags with s so it
       travels backward while the animal goes forward, and amplitude grows with s
       because a fish's head barely moves and its tail sweeps wide.

       Fills `kappa` (length n) for `accel` to consume. That is the whole coupling.
       ====================================================================== */
    undulate(par, n, head, kappa, opts) {
      const o = opts || {};
      const amp = (o.amp === undefined) ? 0.35 : o.amp;        // RADIANS per joint
      const waves = (o.waves === undefined) ? 2.0 : o.waves;
      const phase = o.phase || 0;
      const taper = (o.taper === undefined) ? 0.6 : o.taper;
      const h = head || 0, depth = Math.max(1, n - h - 1);
      for (let i = h; i < n; i++) {
        if (par[i] < 0) { kappa[i] = 0; continue; }
        const s = 1 - this.age(par, i, depth);
        const env = 1 - taper * (1 - s);
        kappa[i] = amp * env * Math.sin(phase + s * 6.283185307 * waves);
      }
      return kappa;
    },

    /* SLIP — the medium tells ALONG from ACROSS. (v0.14)

       A slender body in a fluid does not feel one drag; it slides easily along its
       own length and fights hard to move sideways. `slip` is why an eel is an eel
       and a sphere is not.

       Be precise about what this does and does not do. In an INERTIAL regime like
       ours it is not the source of thrust — `undulate` already swims without it
       (measured: isotropic low drag travels farther). What anisotropy buys is
       CHARACTER: the body slides along its own length instead of skidding
       sideways, so a curve advances through itself the way a snake does rather
       than sweeping the whole shape across the floor. It is also the honest
       medium for any slender organism, swimming or not — kelp feels it, a
       zigpede feels it.

       `along` is drag lengthwise, `across` drag sideways; the ratio is the
       animal's slipperiness. ================================================== */
    slip(pos, vel, par, n, head, acc, opts) {
      const o = opts || {};
      const along = (o.along === undefined) ? 0.05 : o.along;
      const across = (o.across === undefined) ? 4.0 : o.across;
      const h = head || 0;
      for (let i = h; i < n; i++) {
        const p = par[i];
        const i3 = i * 3;
        let ux, uy, uz;
        if (p >= 0) { ux = pos[i3] - pos[p * 3]; uy = pos[i3 + 1] - pos[p * 3 + 1]; uz = pos[i3 + 2] - pos[p * 3 + 2]; }
        else {                                                   /* the head borrows its child's line */
          let c = -1; for (let j = h; j < n; j++) if (par[j] === i) { c = j; break; }
          if (c < 0) continue;
          ux = pos[c * 3] - pos[i3]; uy = pos[c * 3 + 1] - pos[i3 + 1]; uz = pos[c * 3 + 2] - pos[i3 + 2];
        }
        const L = Math.hypot(ux, uy, uz) || 1e-6; ux /= L; uy /= L; uz /= L;
        const vx = vel[i3], vy = vel[i3 + 1], vz = vel[i3 + 2];
        const vA = vx * ux + vy * uy + vz * uz;                  // speed along the body
        acc[i3]     -= along * vA * ux + across * (vx - vA * ux);
        acc[i3 + 1] -= along * vA * uy + across * (vy - vA * uy);
        acc[i3 + 2] -= along * vA * uz + across * (vz - vA * uz);
      }
      return acc;
    },


    /* ==========================================================================
       SHELL — growth with rotation. (v0.15)

       Turn at a constant rate while growing at a constant RATIO and you get a
       logarithmic spiral — a nautilus, an ammonite, a ram's horn, a fern crozier.
       It is one of the commonest forms in biology for exactly this reason: it is
       what an organism traces when it grows steadily and turns steadily, and the
       shape is self-similar so the animal never changes proportion as it gets
       bigger.

       Discovered by accident, and worth saying so: the force-based undulation was
       over-driven so hard that it tore the body open into a spiral, and Bill saw a
       shell where I had only seen broken physics. This makes the form reachable on
       PURPOSE — no torn bonds, repeatable, at any scale — instead of being an
       artefact that a bug-fix would have deleted.

       `turn` is radians per segment; `ratio` is how much each segment outgrows the
       last (1.0 = a plain circle, >1 opens the whorl). The spiral's tightness is
       `ratio` and its handedness is the sign of `turn`; a performer supplies both
       from whatever they like — interval, breath, phrase direction. ========== */
    shell(state, bond, turn, ratio, span) {
      const n = state.n, tail = n - 1, prev = state.par[tail];
      let d;
      if (prev >= 0) d = [state.pos[tail*3] - state.pos[prev*3], state.pos[tail*3+1] - state.pos[prev*3+1], state.pos[tail*3+2] - state.pos[prev*3+2]];
      else d = [0, 1, 0];
      const L = Math.hypot(d[0], d[1], d[2]) || 1;
      const c = Math.cos(turn), s2 = Math.sin(turn);
      const hx = d[0]/L * c - d[1]/L * s2, hy = d[0]/L * s2 + d[1]/L * c;
      const last = (state.rest && prev >= 0) ? state.rest[tail] : bond.rest;
      const i = this.grow(state, bond, [hx, hy, 0], last * (ratio === undefined ? 1.02 : ratio));
      /* REMEMBER THE TURN. Without this the bend law targets STRAIGHT and a spiral
         is under permanent tension trying to unwind — it creeps forever and never
         settles (measured: motion still 5.6/s after 1500 frames of silence). A
         shell's rest shape IS its spiral, so the angle it grew at becomes the
         angle it prefers. This is shape memory: the body keeps what was played. */
      if (state.kap0) state.kap0[i] = turn;
      if (span) { while (state.n - (state.head || 0) > span) this.retire(state); if ((state.head || 0) > span) this.compact(state); }
      return i;
    },

    /* AGE — how far along the body an agent sits, 0 (root) .. 1 (tail), by walking
       parents. For a performance-grown body this IS normalized time-since-played:
       the channel a species reads to draw its own history (colour, size, fade). */
    age(par, i, depthMax) {
      let d = 0, k = i;
      while (par[k] >= 0 && d < 4096) { k = par[k]; d++; }
      return depthMax > 0 ? Math.min(1, d / depthMax) : d;
    },

    /* RETIRE — drop the oldest segment. The root forgets; the tail keeps growing.
       Composed with grow(), this is the TURNOVER law (Canon, life, since 0.2.1 —
       "organisms depart and return; the field is never static") applied to a BODY
       instead of to a field of strangers.

       Why it matters: unbounded growth turns a creature into a thread. The camera
       must pull back to hold a longer body, so every segment shrinks toward a dot
       and what was an organism becomes a trace. A bounded body stays legible, and
       — because it sheds its tail as fast as it grows its head — it TRAVELS rather
       than accumulating. That is a Zigpede: your notes push the head forward, the
       body follows by force propagation, and the oldest note is quietly forgotten.

       Implementation: the buffer is a ring. `state.head` is the index of the oldest
       live segment; retiring advances it. Nothing is copied, so a body can travel
       indefinitely at constant cost. `age()` still reads position-along-body, but
       over a MOVING WINDOW — time-since-played within living memory. */
    retire(state) {
      const head = state.head || 0;
      if (state.n - head <= 2) return -1;          // never dissolve the body entirely
      state.par[head + 1] = -1;                    // the next segment becomes the new root
      state.head = head + 1;
      return head;
    },

    /* COMPACT — slide the living window back to index 0. Retiring alone leaves the
       buffer index climbing forever, so a body that travels long enough would run
       off the end of its own arrays. Compacting costs one copy of the LIVE span
       (not the history), and amortizes to nothing because it only fires when the
       dead prefix has grown larger than the body itself. */
    compact(state) {
      const head = state.head || 0; if (head === 0) return 0;
      const live = state.n - head;
      for (let i = 0; i < live; i++) {
        const s = (head + i) * 3, d = i * 3;
        state.pos[d] = state.pos[s]; state.pos[d + 1] = state.pos[s + 1]; state.pos[d + 2] = state.pos[s + 2];
        state.vel[d] = state.vel[s]; state.vel[d + 1] = state.vel[s + 1]; state.vel[d + 2] = state.vel[s + 2];
        const p = state.par[head + i];
        state.par[i] = (p < 0) ? -1 : (p - head);
      }
      state.n = live; state.head = 0;
      return head;
    },

    /* LIVE — the whole loop for a travelling body: grow a segment, retire the oldest
       while the body is longer than `span`, and compact when the dead prefix has
       outgrown the body. One call per note. A species NAMES its span the way it
       names a medium or a boundary; it does not implement one. */
    live(state, bond, span, dir) {
      const i = this.grow(state, bond, dir);
      while (state.n - (state.head || 0) > span) this.retire(state);
      if ((state.head || 0) > span) this.compact(state);
      return i;
    },

    /* LENGTH — how many segments are currently alive (the body, not the buffer). */
    length(state) { return state.n - (state.head || 0); },

    /* ACCEL — the law itself. Accumulates into `acc` (length 3n) for every bonded
       agent. Pure, allocation-free, and the exact shape the WGSL kernel mirrors. */
    /* `kappa` (optional) is per-joint REST CURVATURE; `restA` (optional) is
       per-segment REST LENGTH, which lets one body have segments of different
       sizes — allometry. A kelp frond tapers, a whale tapers, and a SHELL is a
       body whose every segment is slightly larger than the last. */
    accel(bond, pos, vel, par, n, acc, kappa, restA) {
      for (let i = 0; i < n; i++) {
        const p = par[i]; if (p < 0) continue;
        const i3 = i * 3, p3 = p * 3;
        let dx = pos[i3] - pos[p3], dy = pos[i3 + 1] - pos[p3 + 1], dz = pos[i3 + 2] - pos[p3 + 2];
        const L = Math.hypot(dx, dy, dz) || 1e-6;
        const ux = dx / L, uy = dy / L, uz = dz / L;

        /* 1 · SPRING — restore toward rest length */
        const rest = restA ? restA[i] : bond.rest;
        let s = -(L - rest) * bond.k;

        /* 2 · DAMPING — only the component of relative velocity ALONG the link,
           so a body settles instead of ringing while lateral swing stays free */
        let rvx = 0, rvy = 0, rvz = 0, alongV = 0;
        if (vel) {
          rvx = vel[i3] - vel[p3]; rvy = vel[i3 + 1] - vel[p3 + 1]; rvz = vel[i3 + 2] - vel[p3 + 2];
          alongV = rvx * ux + rvy * uy + rvz * uz;
          s -= alongV * bond.damp;
        }
        let ax = ux * s, ay = uy * s, az = uz * s;

        /* 3 · BENDING — resist folding at the joint: aim for where a STRAIGHT
           continuation of g→p would place i. bend 0 = rope, 1 = spine.
           The correction is projected PERPENDICULAR to the link: a bending moment
           rotates a joint, it must never lengthen or shorten the bond. Its damping
           partner is likewise lateral — without it a flexing body rings forever,
           because term 2 only ever bleeds RADIAL energy.

           A bending moment is a THREE-body force. Applying it as an i/p pair
           conserves linear momentum but leaves a free COUPLE — the body spins for
           nothing (measured: net torque −208 on a curved spine), and under
           anisotropic drag that phantom spin rectifies into phantom locomotion.
           So the reaction is split: g takes a force with the opposite lever arm
           about p, and p takes whatever is left to keep the net at zero. Both
           linear AND angular momentum are then conserved, and any swimming the
           body does has to be earned.
           (All three caught by the growth bench and the undulation proof.) */
        if (bond.bend > 0) {
          const g = par[p];
          if (g >= 0) {
            const g3 = g * 3;
            let wx = pos[p3] - pos[g3], wy = pos[p3 + 1] - pos[g3 + 1], wz = pos[p3 + 2] - pos[g3 + 2];
            const BL = Math.hypot(wx, wy, wz) || 1e-6;
            let dx = wx / BL, dy = wy / BL, dz = wz / BL;
            /* REST CURVATURE — the joint's preferred angle. Zero means "continue
               straight" (a spine at rest); a non-zero kappa[i] rotates the target
               direction, so the joint WANTS to be bent. This is how muscle works:
               it does not shove the body sideways, it changes what shape the body
               considers to be rest, and the elastic structure follows. Because the
               control is an ANGLE it is bounded by geometry — no drive level can
               stretch a bond, which a lateral force always could. */
            if (kappa) {
              const kk = kappa[i];
              if (kk) {
                const a0 = bond.axis ? bond.axis[0] : 0, a1 = bond.axis ? bond.axis[1] : 0, a2 = bond.axis ? bond.axis[2] : 1;
                const ck = Math.cos(kk), sk = Math.sin(kk);
                const cx2 = a1 * dz - a2 * dy, cy2 = a2 * dx - a0 * dz, cz2 = a0 * dy - a1 * dx;
                const dot = a0 * dx + a1 * dy + a2 * dz, om = 1 - ck;
                const rx = dx * ck + cx2 * sk + a0 * dot * om;
                const ry = dy * ck + cy2 * sk + a1 * dot * om;
                const rz = dz * ck + cz2 * sk + a2 * dot * om;
                dx = rx; dy = ry; dz = rz;
              }
            }
            let ex = pos[p3] + dx * rest - pos[i3],
                ey = pos[p3 + 1] + dy * rest - pos[i3 + 1],
                ez = pos[p3 + 2] + dz * rest - pos[i3 + 2];
            const along = ex * ux + ey * uy + ez * uz;          // strip the radial part
            ex -= along * ux; ey -= along * uy; ez -= along * uz;
            const w = bond.bend * bond.k;
            let bx = ex * w, by = ey * w, bz = ez * w;
            if (vel) {                                           // lateral (angular) damping
              const dw = bond.bend * bond.damp;
              bx -= (rvx - alongV * ux) * dw;
              by -= (rvy - alongV * uy) * dw;
              bz -= (rvz - alongV * uz) * dw;
            }
            /* balance the couple. g's share must be perpendicular to the g→p link
               (not merely antiparallel to b — on a curved body those differ), with
               the lever arm about p that cancels b's moment; p absorbs the rest. */
            let nx = uy * bz - uz * by, ny = uz * bx - ux * bz, nz = ux * by - uy * bx;
            const nl = Math.hypot(nx, ny, nz);
            let gx = 0, gy = 0, gz = 0;
            if (nl > 1e-12) {
              nx /= nl; ny /= nl; nz /= nl;
              const wxh = wx / BL, wyh = wy / BL, wzh = wz / BL;
              gx = ny * wzh - nz * wyh; gy = nz * wxh - nx * wzh; gz = nx * wyh - ny * wxh;
              const sc = (L / BL) * Math.hypot(bx, by, bz);
              gx *= sc; gy *= sc; gz *= sc;
            }
            acc[i3] += bx; acc[i3 + 1] += by; acc[i3 + 2] += bz;
            acc[g3] += gx; acc[g3 + 1] += gy; acc[g3 + 2] += gz;
            acc[p3] -= (bx + gx); acc[p3 + 1] -= (by + gy); acc[p3 + 2] -= (bz + gz);
          }
        }

        acc[i3] += ax; acc[i3 + 1] += ay; acc[i3 + 2] += az;
        /* Newton's third — an unanchored parent feels the equal and opposite pull,
           so a free body carries its own momentum instead of hauling itself along. */
        if (!(bond.anchor && par[p] < 0)) { acc[p3] -= ax; acc[p3 + 1] -= ay; acc[p3 + 2] -= az; }
      }
      return acc;
    }
  };

  ZigCore.VERSION = "0.15.0";   // 0.15: GROUND 0.1.0 — the SECOND Canon law. "A world has a ground of being." Declared, NOT yet consulted by the engine. Four grounds (void=identity, dusk, mist, paper); one word sets sky, haze, Radiance room and the afterimage's compositing together. Exists because the afterimage assumes a dark world IN ITS ARITHMETIC: max() compositing erases a dark body on a bright ground (0.2500 reaches the glass at 0.8359). Three refusals; the 8/17 sinking organism now trips two of them at build time · 0.14: THE ORDERING CONTRACT (Canon.Order — composition order is DECLARED, not inherited from build history. Two rails, "shard.face" and "frame.light", whose stations are ordered because the physics is; a law files a CLAIM at a station instead of splicing itself, and the rail emits every claim once, in order. Kills the append inversion structurally — there is no idiom left to get backwards — and refuses four faults at build time: unknown station, AMBIGUOUS (two claims, one station, no `after`), CONTESTED (two REPLACE skins on one face), DEAD (a write a later REPLACE discards). Byte-identical: the rail emits exactly the shader the hand splice did) · 0.13: THE CANON RUNTIME (Canon.register/resolve/activate/stamp — laws ship OFF and a host names them via window.ZIG_LAWS or #law=preset; absent = byte-identical) + RADIANCE 0.1.0, the first law: the room is a light source with no falloff, and the response is a hue-preserving luminance remap (black-point · gain · shadow gamma · soft knee). Identity at defaults · 0.11: BOUNDARY AXIS · 0.11.1: GYRE AXIS · 0.12: ELLIPSOID boundary (lens = a squashed sphere; per-axis radii → the wide breathing disc); byte-identical for sphere/cylinder

})(typeof window !== "undefined" ? window : globalThis);

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

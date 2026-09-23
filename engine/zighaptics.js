/* =============================================================================
   engine/zighaptics.js — ZIGHAPTICS 0.1.0 · the organism's feelings, in the hand
   2026-09-22

   The organism EMITS feelings (ZigTouch: notice · startle · pulse · trust ·
   current · settle · release). This layer RENDERS them on whatever the
   platform has. A species never calls navigator.vibrate; it never learns what
   phone it is on. Swap the backend, keep every organism.

   BACKENDS (auto-chosen in this order)
     "capacitor"  iOS/Android native app — @capacitor/haptics via
                  window.Capacitor.Plugins.Haptics. STUBBED: the mapping is
                  written and exercised by the test with a fake plugin; it goes
                  live the day the Capacitor shell exists. Taptic impact styles
                  carry STRENGTH, which web vibration cannot.
     "vibrate"    Android Chrome / Firefox — navigator.vibrate(pattern). WORKS
                  NOW. Duration only, no amplitude: strength is spent as
                  pulse length and pattern shape. Chrome needs one prior tap on
                  the page (sticky activation) and blocks it in cross-origin
                  iframes.
     "ios-switch" iOS 18+ Safari — EXPERIMENTAL, off unless opts.iosSwitch.
                  Clicking a <label> for an <input type=checkbox switch> ticks
                  the Taptic Engine. One fixed tick, only inside a gesture
                  handler, so tap-feelings may land and heartbeats will not.
     "none"       graceful silence. onVisual still fires for every feeling, so
                  a species can answer with light instead.

   RULES
     · Rate-limited (minGapMs) with priority: a startle pre-empts a grain tick;
       a grain tick never pre-empts a startle.
     · Strength is scaled by gain and floored: below `floor` a feeling is
       rendered visually only — the calm is also knowing when not to buzz.
     · Everything fails silent. A haptic error never reaches the organism.
   ========================================================================== */
(function (global) {
  "use strict";

  const VERSION = "0.1.1";
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  /* THE PROFILE — feeling → how each backend renders it. `vib(s)` returns a
     navigator.vibrate pattern; `nat(s)` a Capacitor call. prio orders
     collisions. This table is the one place the FEEL of the organism is tuned. */
  const PROFILE = {
    notice:  { prio: 1, vib: (s) => [Math.round(10 + 8 * s)],
                        nat: (s) => ({ fn: "selectionChanged" }) },
    startle: { prio: 4, vib: (s) => [Math.round(18 + 34 * s)],
                        nat: (s) => ({ fn: "impact", style: s > 0.66 ? "HEAVY" : s > 0.33 ? "MEDIUM" : "LIGHT" }) },
    pulse:   { prio: 2, vib: (s) => [Math.round(10 + 14 * s), 110, Math.round(6 + 8 * s)],      // lub … dub
                        nat: (s) => ({ fn: "impact", style: s > 0.5 ? "MEDIUM" : "LIGHT", dub: true }) },
    trust:   { prio: 3, vib: (s) => [14, 70, 14, 70, 22],                                        // a small, warm answer
                        nat: (s) => ({ fn: "notification", type: "SUCCESS" }) },
    current: { prio: 0, vib: (s) => [Math.round(9 + 11 * s)],                                    // grain under the finger (≥9ms: shorter is below many phone motors)
                        nat: (s) => ({ fn: "selectionChanged" }) },
    wave:    { prio: 3, vib: (s) => [Math.round(16 + 20 * s), 45, Math.round(11 + 12 * s), 60, Math.round(8 + 6 * s)],  // a swell that runs away from the hand
                        nat: (s) => ({ fn: "impact", style: s > 0.5 ? "MEDIUM" : "LIGHT", dub: true }) },
    release: { prio: 1, vib: (s) => null, nat: (s) => null },                                    // felt as absence
    settle:  { prio: 1, vib: (s) => [10, 180, 8],                                                // an exhale
                        nat: (s) => ({ fn: "impact", style: "LIGHT" }) }
  };

  function detect(opts) {
    const nav = global.navigator || {};
    const cap = global.Capacitor;
    const native = cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform();
    const plugin = native && cap.Plugins && cap.Plugins.Haptics;
    if (plugin) return { name: "capacitor", plugin };
    const inFrame = (() => { try { return global.self !== global.top; } catch (_) { return true; } })();
    if (typeof nav.vibrate === "function") return { name: "vibrate", inFrame };
    const iOS = /iPad|iPhone|iPod/.test(nav.userAgent || "") ||
                (nav.platform === "MacIntel" && (nav.maxTouchPoints || 0) > 1);
    if (iOS && opts.iosSwitch && global.document) return { name: "ios-switch" };
    return { name: "none", iOS };
  }

  function create(opts) {
    opts = Object.assign({ gain: 1, floor: 0.06, minGapMs: 60, enabled: true, profile: PROFILE,
                           backend: "auto", iosSwitch: false, onVisual: null, now: null }, opts || {});
    const now = opts.now || (() => (global.performance && performance.now ? performance.now() : Date.now()));
    const B = opts.backend === "auto" ? detect(opts) : { name: opts.backend };
    if (B.name === "capacitor" && !B.plugin && opts.plugin) B.plugin = opts.plugin;   // test/injection seam
    let lastAt = -1e9, lastPrio = -1, sent = 0, blocked = 0, sw = null;

    if (B.name === "ios-switch") {
      /* the switch must be in the DOM, visually absent, and reachable by a label */
      const id = "zighaptic-" + Math.random().toString(36).slice(2, 8);
      const input = document.createElement("input");
      input.type = "checkbox"; input.setAttribute("switch", ""); input.id = id;
      const label = document.createElement("label"); label.htmlFor = id;
      for (const n of [input, label]) Object.assign(n.style, { position: "fixed", left: "-9999px", opacity: "0", pointerEvents: "none" });
      document.body.appendChild(input); document.body.appendChild(label);
      sw = label;
    }

    function render(kind, s) {
      const p = opts.profile[kind]; if (!p) return false;
      try {
        if (B.name === "vibrate") {
          const pat = p.vib(s); if (!pat) return false;
          const ok = global.navigator.vibrate(pat);
          if (ok === false) blocked++;
          return ok !== false;
        }
        if (B.name === "capacitor" && B.plugin) {
          const n = p.nat(s); if (!n) return false;
          const H = B.plugin;
          if (n.fn === "impact") {
            H.impact({ style: n.style });
            if (n.dub) setTimeout(() => { try { H.impact({ style: "LIGHT" }); } catch (_) {} }, 110);
          } else if (n.fn === "notification") H.notification({ type: n.type });
          else if (n.fn === "selectionChanged") { H.selectionStart && H.selectionStart(); H.selectionChanged(); H.selectionEnd && H.selectionEnd(); }
          return true;
        }
        if (B.name === "ios-switch" && sw) {
          if (kind === "current" || kind === "pulse") return false;   // can't land outside a gesture — don't pretend
          sw.click(); return true;
        }
      } catch (_) { blocked++; }
      return false;
    }

    const api = {
      VERSION,
      get backend() { return B.name; },
      get enabled() { return opts.enabled; },
      set enabled(v) { opts.enabled = !!v; if (!v && B.name === "vibrate") { try { global.navigator.vibrate(0); } catch (_) {} } },
      get gain() { return opts.gain; }, set gain(v) { opts.gain = clamp(+v || 0, 0, 2); },

      /* feel(event) — accepts a ZigTouch event {type, strength, x, y}. Returns
         true if the hand should have felt something. Always calls onVisual. */
      feel(ev) {
        const kind = ev.type, s = clamp((ev.strength || 0) * opts.gain, 0, 1);
        if (opts.onVisual) { try { opts.onVisual(ev, B.name); } catch (_) {} }
        if (!opts.enabled || B.name === "none" || s < opts.floor) return false;
        const p = opts.profile[kind]; if (!p) return false;
        const t = now();
        if (t - lastAt < opts.minGapMs && p.prio <= lastPrio) return false;   // too soon, not more important
        const ok = render(kind, s);
        if (ok) { lastAt = t; lastPrio = p.prio; sent++; }
        return ok;
      },

      status() {
        const why = {
          capacitor: "native Taptic / Android haptics via Capacitor",
          vibrate: B.inFrame ? "Android vibration — but this page is inside a frame, where Chrome blocks it"
                             : "Android vibration (duration only — strength becomes length)",
          "ios-switch": "iOS switch tick (experimental — taps only)",
          none: B.iOS ? "iPhone browsers have no web vibration — the native app will add it"
                      : "no haptics on this device — the organism answers with light"
        }[B.name];
        return { backend: B.name, sent, blocked, why };
      },

      /* stop anything in flight — call on visibilitychange/pagehide */
      silence() { if (B.name === "vibrate") { try { global.navigator.vibrate(0); } catch (_) {} } }
    };
    return api;
  }

  /* ===========================================================================
     CAPACITOR BUILD NOTES (the stub's other half, for the native shell)
       npm i @capacitor/core @capacitor/haptics && npx cap sync ios
       Nothing in this file changes: detect() finds window.Capacitor.Plugins
       .Haptics on a native platform and the profile's `nat` column goes live.
     LATER: continuous feelings (a heartbeat whose intensity and sharpness
       follow trust) want Core Haptics — CHHapticEngine + AHAP — which
       @capacitor/haptics does not expose. That is a small custom plugin
       ("ZigHapticsNative") and a third column in PROFILE; not v1.
     ======================================================================== */

  const ZigHaptics = { VERSION, PROFILE, create, detect };
  global.ZigHaptics = ZigHaptics;
  if (typeof module !== "undefined" && module.exports) module.exports = ZigHaptics;
})(typeof window !== "undefined" ? window : globalThis);

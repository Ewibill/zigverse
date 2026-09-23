/* =============================================================================
   engine/zigtouch.js — ZIGTOUCH 0.1.1 · a touch is weather, not a command
   2026-09-22 · the first ZigSense input, for the living-world instrument
   0.1.1 THE WAVE (Bill, same day): "nucleus when they hold the screen, then a
   wave can send the shards away with the current." A stroke released while
   still MOVING is a wave: it carries the direction, the speed, and whatever
   trust was gathered, so what a hold drew in, a wave lets go. Released after
   the finger has stopped, it is only a release. Nothing else changed.

   WHY THIS EXISTS
   v5.3 turned a finger into a MIDI note: press = Perf.hold(), lift under 220ms
   = Sickle.strike(). That made a phone a performer, and it was right for the
   Bee. It is wrong for someone who wants "something beautiful to attend to":
   a finger that commands the organism turns watching into operating. Here a
   finger changes the organism's WORLD, and the organism answers from its own
   state — so the tenth tap is met differently from the first, and a hand left
   still is met differently from one that pokes.

   THE THREE GESTURES (classified per contact, with no mode switch)
     tap    — down and up before HOLD_MS with no travel → STARTLE + orient.
              Scaled by habituation, trust, familiarity and trait. Never grows.
     hold   — still past HOLD_MS → TRUST, earned through two smoothing stages
              (the charisma curve — ~3.5s to 0.8), felt as a heartbeat that
              slows and softens as trust rises. Trust outlives the finger.
     stroke — travel past STROKE_U → a CURRENT with position, velocity and
              strength that decays after lift. Slow strokes soothe (a little
              trust); fast strokes stir (a little arousal, habituated).

   THE FOUR MEMORY LAYERS
     seconds    habituation h (τ 5s) · arousal (τ 1.1s) · the startle reflex
     minutes    mood.agitation (EMA of arousal, τ 45s) · mood.ease (EMA of trust, τ 90s)
     session    familiarity — gentle contact-seconds, saturating (1 - e^(-s/120))
     persistent trait.boldness · trait.sociability — drift ≤ 0.03 per session,
                exported/imported as JSON; the HOST decides where it lives

   CONTRACT
     · Pure logic. No DOM, no GPU. The DOM adapter is ZigTouch.attach().
     · FIXED TIMESTEP (1/120 s). Inputs carry timestamps and are applied at the
       step their time falls in, so the same gestures give the same field at
       30, 60, 120 or 144 fps — proven in test/zigtouch_ref.mjs.
     · Coordinates are SURFACE UNITS: 1.0 = the shorter side of the surface.
       A phone and a 55" lobby screen classify a stroke the same way; set
       opts.unit to rescale for physical size later.
     · The organism READS touch.field. Feeling events (notice · startle ·
       pulse · trust · current · wave · settle) go to listeners — ZigHaptics renders
       them, a species may answer them visually. Nothing here moves an agent.
   ========================================================================== */
(function (global) {
  "use strict";

  const VERSION = "0.1.1";
  const STEP = 1 / 120;                 // behavior clock — rendering never touches it
  const STEP_MS = 1000 * STEP;
  const MAX_CATCHUP_MS = 250;           // a backgrounded tab resumes; it does not replay a minute

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const ease = (cur, tgt, dt, tau) => cur + (tgt - cur) * (1 - Math.exp(-dt / tau));
  const hyp = (x, y) => Math.sqrt(x * x + y * y);

  /* every number a species or a venue might retune lives here, named */
  const DEFAULTS = {
    unit: 1,                 // surface-unit scale (1 = shorter side of the surface)
    holdMs: 320,             // stillness this long = a hold (v5.3 used 220 for tap/hold)
    strokeU: 0.045,          // travel beyond this = a stroke
    jitterU: 0.25,           // speed (u/s) during a hold that counts as fidgeting

    habitUp: 0.40,           // fraction of the remaining headroom one tap consumes
    habitTau: 5.0,           // s — habituation fades
    habitDepth: 0.88,        // fully habituated response = 1 - depth
    novelReach: 0.5,         // u — a tap this far from the last one is fully novel
    novelWeight: 0.6,        // how much novelty restores the response (dishabituation)

    arousalTau: 1.1,         // s — the startle envelope decays
    trustTau1: 1.2,          // s — first smoothing stage of trust (÷ with familiarity)
    trustTau2: 1.0,          // s — second smoothing stage
    trustKeepTau: 6.0,       // s — trust lingers after the hand leaves
    trustFire: 0.75,         // trust event threshold (re-arms below trustRearm)
    trustRearm: 0.40,
    heartMin: 0.85,          // s — heartbeat period at zero trust
    heartSpan: 1.10,         // s — added to the period at full trust (slower = calmer)

    currentTau: 1.6,         // s — a current outlives the stroke
    grainU: 0.07,            // u of travel between 'current' grain events
    strokeSlow: 0.8,         // u/s — at or below: soothing
    strokeFast: 2.5,         // u/s — at or above: stirring
    waveSpeed: 0.9,          // u/s — a stroke let go at this speed or more is a WAVE
    waveFull: 2.5,           // u/s — a wave at full strength

    settleTau: 4.0,          // s — the world comes to rest
    settleFire: 0.6,         // settle event threshold
    settleQuiet: 0.15,       // arousal must be under this before settling begins
    attentionTau: 3.0,       // s — the organism stops looking where you were

    moodAgitTau: 45, moodEaseTau: 90, famScale: 120,
    traitDrift: 0.03, traitLo: 0.2, traitHi: 0.8
  };

  function create(opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const listeners = [];
    const queue = [];                   // pending inputs, applied by timestamp
    const contacts = new Map();         // pointer id → contact record
    let simMs = null;                   // behavior clock (ms, same base as input timestamps)
    let lastTap = null;                 // {x,y} — novelty is measured from here
    let t1 = 0;                         // trust, first smoothing stage
    let interacted = false, settleArmed = false, trustArmed = true;

    const field = {
      phase: "idle",                    // idle · contact · hold · stroke · settling
      contacts: 0,
      arousal: 0, trust: 0, settle: 1, habituation: 0,
      attention: { x: 0.5, y: 0.5, w: 0 },
      current: { x: 0.5, y: 0.5, vx: 0, vy: 0, s: 0 },
      mood: { agitation: 0, ease: 0 },
      familiarity: 0, gentleSec: 0,
      trait: { boldness: 0.5, sociability: 0.5 },
      lastStartle: 0,                   // strength of the most recent startle (for probes)
      time: 0                           // seconds of behavior simulated
    };

    const emit = (type, strength, x, y, extra) => {
      const ev = Object.assign({ type, strength: clamp(strength, 0, 1), x, y, t: field.time }, extra || {});
      for (const fn of listeners) fn(ev, field);
    };

    /* the startle a single tap earns right now — the heart of the calm */
    function startleFor(x, y) {
      const novelty = lastTap ? clamp(hyp(x - lastTap.x, y - lastTap.y) / (o.novelReach * o.unit), 0, 1) : 1;
      const hEff = field.habituation * (1 - o.novelWeight * novelty);
      const bold = 1.15 - 0.3 * field.trait.boldness;             // a bold creature flinches less
      const fam = 1 - 0.4 * field.familiarity;                     // a familiar hand, less
      const calm = 1 - 0.6 * field.trust;                          // a trusted hand, less still
      return clamp((1 - o.habitDepth * hEff) * bold * fam * calm, 0, 1);
    }

    function applyInput(ev) {
      const u = o.unit;
      if (ev.kind === "down") {
        const c = { id: ev.id, x0: ev.x, y0: ev.y, x: ev.x, y: ev.y, t0: ev.t, tLast: ev.t,
                    vx: 0, vy: 0, travel: 0, grain: 0, kind: "contact", heartIn: 0 };
        contacts.set(ev.id, c);
        interacted = true; settleArmed = true;
        field.settle = 0;
        field.attention.x = ev.x; field.attention.y = ev.y; field.attention.w = 1;
        /* notice — the organism feels contact before it knows what kind. Soft,
           and it habituates with the startle so a tapping hand fades together. */
        emit("notice", 0.35 * startleFor(ev.x, ev.y), ev.x, ev.y, { id: ev.id });
      } else if (ev.kind === "move") {
        const c = contacts.get(ev.id); if (!c) return;
        const dtm = Math.max(1, ev.t - c.tLast) / 1000;
        const dx = ev.x - c.x, dy = ev.y - c.y;
        const k = 1 - Math.exp(-dtm / 0.08);                         // 80ms velocity smoothing
        c.vx += (dx / dtm - c.vx) * k; c.vy += (dy / dtm - c.vy) * k;
        c.travel += hyp(dx, dy); c.grain += hyp(dx, dy);
        c.x = ev.x; c.y = ev.y; c.tLast = ev.t;
        if (c.kind !== "stroke" && hyp(c.x - c.x0, c.y - c.y0) > o.strokeU * u) c.kind = "stroke";
        field.attention.x = c.x; field.attention.y = c.y; field.attention.w = 1;
      } else if (ev.kind === "up" || ev.kind === "cancel") {
        const c = contacts.get(ev.id); if (!c) return;
        contacts.delete(ev.id);
        if (ev.kind === "up" && c.kind === "contact" && (ev.t - c.t0) < o.holdMs) {
          /* TAP: startle + orient, then habituate. The response is computed
             BEFORE the increment, so the first tap is always the fullest. */
          const s = startleFor(c.x, c.y);
          field.lastStartle = s;
          field.arousal = Math.max(field.arousal, s);
          field.habituation += (1 - field.habituation) * o.habitUp;
          field.trust *= 1 - 0.25 * s; t1 *= 1 - 0.25 * s;           // a poke costs a little trust
          lastTap = { x: c.x, y: c.y };
          emit("startle", s, c.x, c.y, { id: c.id });
        } else if (c.kind === "stroke") {
          /* THE WAVE — let go while still moving and the gathered body is sent
             off along the current. Strength = speed × what trust was gathered
             (a wave from an open hand is light; from a nucleus it carries). */
          const sp = hyp(c.vx, c.vy);
          if (sp >= o.waveSpeed * u) {
            const s = clamp(sp / (o.waveFull * u), 0, 1) * (0.4 + 0.6 * field.trust);
            field.current.s = Math.max(field.current.s, clamp(sp / (o.waveFull * u), 0, 1));
            emit("wave", s, c.x, c.y, { id: c.id, vx: c.vx, vy: c.vy, speed: sp, gathered: field.trust });
          } else emit("release", 0.3 * field.current.s, c.x, c.y, { id: c.id, from: "stroke" });
        } else if (c.kind === "hold") {
          emit("release", 0.3 * field.trust, c.x, c.y, { id: c.id, from: "hold" });
        }
      }
    }

    function step(dt) {
      field.time += dt;
      /* promote still contacts to holds (time is the classifier's other axis) */
      let holding = null, stroking = null;
      for (const c of contacts.values()) {
        /* a finger that stops sends NO more move events, so its last velocity
           would freeze — and a stopped finger would throw a wave. Silence on
           the wire means stillness: velocity bleeds away after 40ms of it. */
        if (simMs - c.tLast > 40) { const k = Math.exp(-dt / 0.08); c.vx *= k; c.vy *= k; }
        if (c.kind === "contact" && (simMs - c.t0) >= o.holdMs) { c.kind = "hold"; c.heartIn = 0.25; }
        if (c.kind === "hold") holding = c;
        if (c.kind === "stroke") stroking = c;
      }

      /* ---- seconds layer ---- */
      field.habituation *= Math.exp(-dt / o.habitTau);
      field.arousal *= Math.exp(-dt / o.arousalTau);

      /* ---- TRUST: earned by stillness, two stages, familiarity speeds it ---- */
      const soc = 0.75 + 0.5 * field.trait.sociability;            // 1.0 at the neutral trait
      const famK = (1 + field.familiarity) * soc;
      if (holding) {
        const fidget = clamp(hyp(holding.vx, holding.vy) / o.jitterU, 0, 1);
        t1 = ease(t1, 1, dt * (1 - 0.7 * fidget), o.trustTau1 / famK);
        field.trust = ease(field.trust, t1, dt, o.trustTau2);
        field.gentleSec += dt * (0.5 + 0.5 * field.trust);
        /* heartbeat — the organism's pulse felt through the glass. Slower and
           softer as trust rises: this is the settling, rendered in time. */
        holding.heartIn -= dt;
        if (holding.heartIn <= 0) {
          holding.heartIn = o.heartMin + o.heartSpan * field.trust;
          emit("pulse", 0.25 + 0.45 * (1 - field.trust), holding.x, holding.y, { id: holding.id, trust: field.trust });
        }
      } else {
        const keep = Math.exp(-dt / o.trustKeepTau);                // trust outlives the hand
        t1 *= keep; field.trust *= keep;
      }
      if (trustArmed && field.trust >= o.trustFire) {
        trustArmed = false;
        emit("trust", field.trust, field.attention.x, field.attention.y);
      } else if (!trustArmed && field.trust < o.trustRearm) trustArmed = true;

      /* ---- CURRENT: a stroke is a current to ride ---- */
      const cur = field.current;
      if (stroking) {
        const sp = hyp(stroking.vx, stroking.vy);
        cur.x = stroking.x; cur.y = stroking.y;
        cur.vx = stroking.vx; cur.vy = stroking.vy;
        cur.s = ease(cur.s, clamp(sp / 1.5, 0, 1), dt, 0.08);
        if (sp <= o.strokeSlow) {                                   // a slow stroke soothes
          t1 = ease(t1, 0.6, dt, o.trustTau1 * 2 / famK);
          field.trust = ease(field.trust, t1, dt, o.trustTau2);
          field.gentleSec += dt * 0.5;
        } else if (sp >= o.strokeFast) {                            // a fast one stirs — habituated, capped
          const stir = 0.5 * clamp((sp - o.strokeFast) / o.strokeFast, 0, 1) * (1 - o.habitDepth * field.habituation);
          field.arousal = Math.max(field.arousal, stir);
          field.habituation += (1 - field.habituation) * 0.02;
        }
        if (stroking.grain >= o.grainU * o.unit) {
          stroking.grain = 0;
          emit("current", 0.2 + 0.6 * cur.s, cur.x, cur.y, { id: stroking.id, vx: cur.vx, vy: cur.vy });
        }
      } else {
        cur.s *= Math.exp(-dt / o.currentTau);
        cur.vx *= Math.exp(-dt / o.currentTau); cur.vy *= Math.exp(-dt / o.currentTau);
      }

      /* ---- SETTLE: after the hand leaves, the world comes to rest ---- */
      field.contacts = contacts.size;
      if (contacts.size === 0) {
        field.attention.w *= Math.exp(-dt / o.attentionTau);
        if (field.arousal < o.settleQuiet) field.settle = ease(field.settle, 1, dt, o.settleTau);
        if (settleArmed && field.settle >= o.settleFire) {
          settleArmed = false;
          emit("settle", 0.3 * (0.4 + 0.6 * field.trust), field.attention.x, field.attention.y);
        }
      }
      field.phase = stroking ? "stroke" : holding ? "hold" : contacts.size ? "contact"
                  : (interacted && field.settle < 0.95) ? "settling" : "idle";

      /* ---- minutes + session layers ---- */
      field.mood.agitation = ease(field.mood.agitation, field.arousal, dt, o.moodAgitTau);
      field.mood.ease = ease(field.mood.ease, field.trust, dt, o.moodEaseTau);
      field.familiarity = 1 - Math.exp(-field.gentleSec / o.famScale);
      field.arousal = clamp(field.arousal, 0, 1);
      field.trust = clamp(field.trust, 0, 1);
    }

    const api = {
      VERSION, field, options: o,
      on(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },

      /* inputs — x,y in surface units, t in ms on the same clock update() is fed */
      down(id, x, y, t)   { queue.push({ kind: "down", id, x, y, t }); },
      move(id, x, y, t)   { queue.push({ kind: "move", id, x, y, t }); },
      up(id, x, y, t)     { queue.push({ kind: "up", id, x, y, t }); },
      cancel(id, t)       { queue.push({ kind: "cancel", id, x: 0, y: 0, t }); },

      /* advance the behavior clock to nowMs in fixed steps, applying each input
         at the step its timestamp falls in. Call every frame AND inside input
         handlers — the second is what lets a haptic land inside the gesture. */
      update(nowMs) {
        if (simMs === null) simMs = queue.length ? Math.min(nowMs, queue[0].t) : nowMs;
        if (nowMs - simMs > MAX_CATCHUP_MS) simMs = nowMs - MAX_CATCHUP_MS;
        queue.sort((a, b) => a.t - b.t);
        while (simMs + STEP_MS <= nowMs) {
          const edge = simMs + STEP_MS;
          while (queue.length && queue[0].t <= edge) applyInput(queue.shift());
          simMs = edge;
          step(STEP);
        }
        /* inputs stamped inside the step that has not run yet are applied NOW,
           to the same state the next step would have applied them to — so a
           startle is emitted inside the gesture handler (iOS needs that for
           haptics) and the result is still identical at every frame rate */
        while (queue.length && queue[0].t <= nowMs) applyInput(queue.shift());
        return field;
      },

      /* ---- persistent layer — the HOST stores the JSON (localStorage, a venue file) ---- */
      exportMemory() {
        return { v: 1, trait: { boldness: field.trait.boldness, sociability: field.trait.sociability } };
      },
      importMemory(m) {
        if (!m || m.v !== 1 || !m.trait) return false;
        field.trait.boldness = clamp(+m.trait.boldness || 0.5, o.traitLo, o.traitHi);
        field.trait.sociability = clamp(+m.trait.sociability || 0.5, o.traitLo, o.traitHi);
        return true;
      },
      /* close the session: traits DRIFT toward what this session was like —
         lightly, bounded, never more than traitDrift per session */
      commitSession() {
        const d = o.traitDrift;
        const sessionBold = clamp(0.5 + 0.5 * field.familiarity - 0.6 * field.mood.agitation, 0, 1);
        const sessionSoc = clamp(0.5 + 0.8 * (field.mood.ease - 0.25), 0, 1);
        field.trait.boldness = clamp(field.trait.boldness + clamp(sessionBold - field.trait.boldness, -1, 1) * d, o.traitLo, o.traitHi);
        field.trait.sociability = clamp(field.trait.sociability + clamp(sessionSoc - field.trait.sociability, -1, 1) * d, o.traitLo, o.traitHi);
        return api.exportMemory();
      }
    };
    return api;
  }

  /* ===========================================================================
     ZigTouch.attach(el, touch) — the DOM adapter. Pointer events → surface
     units, with the phone's own gestures (scroll, zoom, callout, context menu,
     text selection) taken off the glass so a hold is ALWAYS a hold.
     Returns detach(). opts.onInput(kind) fires after each input is applied,
     inside the gesture — ZigHaptics needs that for iOS.
     ======================================================================== */
  function attach(el, touch, opts) {
    opts = opts || {};
    const now = () => (global.performance && performance.now ? performance.now() : Date.now());
    const pos = (e) => {
      const r = el.getBoundingClientRect(), m = Math.max(1, Math.min(r.width, r.height));
      return [(e.clientX - r.left) / m, (e.clientY - r.top) / m];
    };
    /* event.timeStamp shares performance.now()'s origin in every current
       browser; fall back to now() if it looks like an epoch value */
    const stamp = (e) => (e.timeStamp > 0 && e.timeStamp < 1e11) ? e.timeStamp : now();
    const flush = (kind) => { touch.update(now()); if (opts.onInput) opts.onInput(kind); };

    el.style.touchAction = "none";
    el.style.userSelect = "none"; el.style.webkitUserSelect = "none";
    el.style.webkitTouchCallout = "none";
    el.style.webkitTapHighlightColor = "transparent";

    const onDown = (e) => {
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (_) {} }
      const [x, y] = pos(e); touch.down(e.pointerId, x, y, stamp(e)); flush("down"); e.preventDefault();
    };
    const onMove = (e) => {
      const list = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
      for (const ce of list) { const [x, y] = pos(ce); touch.move(e.pointerId, x, y, stamp(ce)); }
    };
    const onUp = (e) => { const [x, y] = pos(e); touch.up(e.pointerId, x, y, stamp(e)); flush("up"); };
    const onCancel = (e) => { touch.cancel(e.pointerId, stamp(e)); flush("cancel"); };
    const block = (e) => e.preventDefault();

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("contextmenu", block);                         // Android long-press menu
    el.addEventListener("touchstart", block, { passive: false });      // iOS callout / magnifier
    el.addEventListener("gesturestart", block);                        // iOS pinch
    return function detach() {
      el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp); el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("contextmenu", block); el.removeEventListener("touchstart", block);
      el.removeEventListener("gesturestart", block);
    };
  }

  /* ===========================================================================
     ZigTouch.legacyBridge — TEMPORARY. Drives v5.3's Perf/strike chain from
     the field so the WebGPU organism can feel ZigTouch before ZigField exists
     in the engine. Delete it the day species read ZigField directly.
       startle → strike(x, y, strength)   (already habituated)
       hold    → Perf.hold(true, 0.30 + 0.55 * trust) — dwell still accrues,
                 so the Bee's charisma keeps working
       release → Perf.hold(false)
     Stroke has no v5.3 consumer: field.current is exposed and unread until
     the flock's flow kernel reads ZigField. That is the next splice.
     ======================================================================== */
  function legacyBridge(touch, perf, strike) {
    touch.on((ev, f) => {
      if (ev.type === "startle" && strike) strike(ev.x, ev.y, 0.35 + 0.6 * ev.strength);
      if (ev.type === "release" && perf) perf.hold(false);
    });
    return function frame() {
      const f = touch.field;
      if (perf && f.phase === "hold") perf.hold(true, 0.30 + 0.55 * f.trust);
    };
  }

  const ZigTouch = { VERSION, STEP, DEFAULTS, create, attach, legacyBridge };
  global.ZigTouch = ZigTouch;

  /* declare the capability in the Canon when the engine is present */
  const C = global.ZigCore && global.ZigCore.Canon;
  if (C && Array.isArray(C.laws) && !C.laws.some((l) => l.id === "touch-field")) {
    C.laws.push({ id: "touch-field", pillar: "experience", since: "touch 0.1.0",
      enables: "A TOUCH IS WEATHER, NOT A COMMAND - tap startles and habituates, a still hand earns trust on the charisma curve, a stroke leaves a current; four memory layers (seconds/minutes/session/persistent) on a fixed 120Hz clock, so the tenth tap is met differently from the first and the same gestures give the same organism at any frame rate",
      proof: "zigtouch_ref" });
  }
  if (typeof module !== "undefined" && module.exports) module.exports = ZigTouch;
})(typeof window !== "undefined" ? window : globalThis);

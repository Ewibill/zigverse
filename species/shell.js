/* =============================================================================
   THE SHELL — Zigverse · species/shell.js · v0.1 · 2026-08-07
   A nautilus you play into being.

   Bill saw it first. On 2026-08-07 an over-driven undulation tore a body open
   into a spiral and Glyph called the frame a failure; Bill looked at the same
   frame and said "this spiraling line is fascinating." He was right — what the
   broken physics had drawn was a logarithmic spiral, which is what any organism
   traces when it grows steadily while turning steadily, and which is therefore
   everywhere in biology: nautilus, ammonite, ram's horn, fern crozier, sunflower.
   This species makes that form reachable ON PURPOSE — repeatable, at any scale,
   with nothing torn.

   THE FIRST SPECIES BUILT ENTIRELY FROM THE 2026-08-07 LAWS. It adds no physics
   of its own; every behaviour below is a Canon law being asked a question:

     structure   the whorls are a bonded chain — a BODY, not a drawn curve
     allometry   each chamber slightly outgrows the last (per-segment rest length)
     shell       constant turn + constant ratio = the logarithmic spiral itself
     contact     the whorls PACK against each other instead of interpenetrating
     refinement  detail without the camera pulling back (k∝f², damp∝f)
     age         position along the body IS time-since-played — the colour ramp
     undulation  the living edge ripples when blown (rest curvature, never force)
     slip        the aperture end slides along itself rather than skidding

   BREATH IS THE LIFE-FORCE. Silence is stillness: no breath, no growth, no
   ripple. Breath opens the whorl (harder blowing = a faster-opening spiral, an
   animal that grew in a good season); pitch INTERVAL sets the turn per chamber,
   so the melody decides the tightness and the handedness of the shell. A rising
   line coils one way, a falling line the other, and a held note draws a circle.

   The species owns growth and mapping. It owns NO renderer: `geometry()` emits a
   ribbon (centres, widths, ages) that a 2D canvas can stroke today and that the
   CPU-geometry path already used by ZigWebGPU.createForest can turn into GPU
   triangles unchanged. That split is deliberate — the organism should outlive
   whatever is drawing it.
   ========================================================================== */
(function (global) {
  "use strict";
  const ZC = global.ZigCore;
  if (!ZC || !ZC.Structure) throw new Error("species/shell.js needs ZigCore with Structure (>= 0.15)");
  const S = ZC.Structure, C = ZC.Contact;

  const Shell = global.TheShell = {
    version: "0.1.0",
    laws: ["structure", "allometry", "shell", "contact", "refinement", "undulation", "slip"]
  };

  /* ---- the archetypes a shell can be. Data, not code: a new shell is a new
     entry here, never a new organism file. --------------------------------- */
  Shell.forms = {
    nautilus: { turn: 0.30, ratio: 1.022, bond: "spine", detail: 4, span: 0, width: 0.85 },
    ammonite: { turn: 0.20, ratio: 1.010, bond: "spine", detail: 4, span: 0, width: 0.55 },
    horn:     { turn: 0.13, ratio: 1.045, bond: "spine", detail: 2, span: 0, width: 1.25 },
    crozier:  { turn: 0.42, ratio: 1.055, bond: "eel",   detail: 4, span: 0, width: 0.60 }
  };

  /* ---- birth --------------------------------------------------------------
     `frameH` is the half-extent of the view the shell lives in, exactly as every
     other Env law scales. `cap` bounds the buffer; a shell that reaches it simply
     stops growing rather than corrupting itself. */
  Shell.create = function (opts) {
    opts = opts || {};
    const frameH = opts.frameH || 20;
    const form = Object.assign({}, Shell.forms[opts.form || "nautilus"], opts.override || {});
    const cap = opts.cap || 1200;
    const base = ZC.Env.bond(form.bond, frameH);
    const bond = S.refine(base, form.detail);

    const st = {
      n: 1, head: 0,
      pos: new Float64Array(cap * 3),
      vel: new Float64Array(cap * 3),
      par: new Int32Array(cap).fill(-1),
      rest: new Float64Array(cap),
      /* the angle each chamber GREW at, which is also the angle it prefers —
         so the shell holds its spiral instead of straining to unwind. */
      kap0: new Float64Array(cap)
    };
    st.rest[0] = bond.rest;

    const self = {
      form, bond, frameH, cap, st,
      kappa: new Float64Array(cap),
      rip: new Float64Array(cap),
      radii: new Float64Array(cap),
      acc: new Float64Array(cap * 3),
      heading: [0, 1, 0],
      lastNote: null,
      breath: 0, phase: 0, grown: 0,
      /* the shell's own sense of season: a slow average of breath, which is what
         opens the whorl. A single hard note should not change the animal's shape;
         a sustained passage should. */
      season: 0
    };

    /* ---- ONE NOTE, ONE CHAMBER -------------------------------------------
       interval → turn (melody sets tightness and handedness)
       breath   → ratio (a well-fed season opens the whorl faster)
       Silence grows nothing at all. */
    self.play = function (note, velocity) {
      if (st.n >= cap - 2) return -1;
      const iv = (self.lastNote === null) ? 0 : (note - self.lastNote);
      self.lastNote = note;
      const v = (velocity === undefined) ? 0.7 : velocity;
      const turn = form.turn + iv * 0.045;
      const ratio = 1 + (form.ratio - 1) * (0.45 + self.season * 1.3);
      const i = S.shell(st, self.bond, turn, ratio, form.span || 0);
      self.grown++;
      return i;
    };

    /* breath drives everything alive; feed it the continuous controller, not
       note-on velocity — articulation is not life. */
    self.blow = function (b) { self.breath = Math.max(0, Math.min(1, b || 0)); };

    self.step = function (dt, env) {
      const e = env || {};
      const sub = 4 * (self.bond.substeps || 1), h = dt / sub;
      self.season += (self.breath - self.season) * Math.min(1, dt * 0.35);

      /* the living edge ripples only while blown — rest CURVATURE, so no drive
         level can tear the shell open. Only the newest tenth is soft tissue. */
      /* the shell's RESTING curvature is the spiral it grew as; the living edge
         adds a ripple on top of that while blown. Rest shape first, life second. */
      self.kappa.set(st.kap0.subarray(st.head, st.n), st.head);
      if (self.breath > 0.002) {
        self.phase += self.breath * 9 * dt;
        const live = Math.max(2, Math.round((st.n - st.head) * 0.12));
        const from = Math.max(st.head, st.n - live);
        self.rip.fill(0, from, st.n);
        S.undulate(st.par, st.n, from, self.rip, { amp: 0.5 * self.breath, waves: 1.4, taper: 0.5, phase: self.phase });
        for (let i = from; i < st.n; i++) self.kappa[i] += self.rip[i];
      }

      /* a shell is not one thickness: every chamber's radius follows its own rest
         length, so the inner whorls can nest tightly while the aperture stays fat. */
      let rMax = 0;
      for (let i = st.head; i < st.n; i++) {
        const ri = (st.rest[i] || self.bond.rest) * 0.5 * form.width;
        self.radii[i] = ri; if (ri > rMax) rMax = ri;
      }
      const r = rMax;
      for (let q = 0; q < sub; q++) {
        self.acc.fill(0, st.head * 3, st.n * 3);
        S.accel(self.bond, st.pos, st.vel, st.par, st.n, self.acc, self.kappa, st.rest);
        /* the whorls must PACK, not pass through each other — the shell is the
           clearest case there is for self-contact, since a spiral's whole nature
           is to lie against its own previous turn. */
        if (C) C.self(st.pos, st.vel, st.par, st.n, st.head, self.acc, { r: r, radii: self.radii, skip: Math.max(3, form.detail * 2) });
        if (C && e.stones && e.stones.length)
          C.exclude(st.pos, st.vel, st.n, st.head, self.acc, e.stones, { skin: r });
        S.slip(st.pos, st.vel, st.par, st.n, st.head, self.acc, { along: 0.25, across: 3.0 });
        for (let i = st.head; i < st.n; i++) for (let k = 0; k < 3; k++) {
          st.vel[i*3+k] += self.acc[i*3+k] * h;
          st.pos[i*3+k] += st.vel[i*3+k] * h;
        }
      }
    };

    /* ---- GEOMETRY — a ribbon, not a drawing ------------------------------
       Centres, half-widths and ages. A canvas strokes it; the CPU-geometry path
       ZigWebGPU.createForest already uses turns the same arrays into triangles.
       The species does not know or care which. */
    self.geometry = function () {
      const live = st.n - st.head;
      const out = { n: live, x: new Float64Array(live), y: new Float64Array(live),
                    z: new Float64Array(live), w: new Float64Array(live), age: new Float64Array(live) };
      const depth = Math.max(1, live - 1);
      for (let i = 0; i < live; i++) {
        const j = st.head + i;
        out.x[i] = st.pos[j*3]; out.y[i] = st.pos[j*3+1]; out.z[i] = st.pos[j*3+2];
        out.age[i] = S.age(st.par, j, depth);
        /* the aperture is the widest part — a shell is a cone wrapped on a
           spiral, so half-width follows the chamber's own rest length. */
        out.w[i] = (st.rest[j] || self.bond.rest) * 0.5 * form.width;
      }
      return out;
    };

    self.reset = function () {
      st.n = 1; st.head = 0; st.pos.fill(0); st.vel.fill(0); st.par.fill(-1);
      st.rest.fill(0); st.rest[0] = self.bond.rest; st.kap0.fill(0); self.kappa.fill(0);
      self.heading = [0, 1, 0]; self.lastNote = null;
      self.breath = 0; self.phase = 0; self.grown = 0; self.season = 0;
    };

    self.chambers = () => st.n - st.head;
    return self;
  };

  Shell.formNames = () => Object.keys(Shell.forms);
})(typeof globalThis !== "undefined" ? globalThis : this);

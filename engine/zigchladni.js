/* =============================================================================
   ZigChladni 0.2.0 — sand (or rice) on a singing plate
   (classic script · exposes global `ZigChladni` · pure law, no GPU, no DOM)

   What is ESTABLISHED: Ernst Chladni (1787) bowed a sand-covered plate and the
   sand gathered on the NODAL LINES - the places that do not move. Each
   resonance of the plate draws its own figure, and a higher note draws a finer
   one. For a square plate the classic approximation of a mode (n, m) is
       u(x, y) = cos(n pi X) cos(m pi Y)  +  s * cos(m pi X) cos(n pi Y)
   (X, Y in 0..1 across the plate), whose frequency rises with k = n^2 + m^2.
   s = -1 and s = +1 are the two classic families of figures; in between the
   figure morphs through the plain grid (s = 0). What is NOT exact: a real
   free-edged plate needs a numerical solution - this is the textbook form,
   and it is what the famous figures look like.

   THE SAND IS NOT DRAWN. Nothing here places a grain on a line. The plate
   shakes each grain in proportion to how hard its spot is moving (|u|), so
   grains random-walk OUT of the loud places and pile up where the plate is
   still - which is how real sand finds the lines. A gentle drift down the
   slope of u^2 speeds it up. Silence stops the shaking, so the last figure
   stays exactly where it fell: the plate REMEMBERS.

   Pieces (all pure, all tested in test/chladni_ref.mjs):
     modes(maxN)            every (n, m, k) with 0 <= m < n <= maxN, sorted by k
     u(n, m, s, x, y)       displacement at plate coords x, y in -1..1
     grad(n, m, s, x, y)    [du/dx, du/dy] (analytic)
     kFor(note, ref)        the mode number a note asks for (fixed, learnable)
     pick(list, k)          the mode closest to k (in log - frequency is log)
     morph(bend)            s from pitch-bend: 0 -> -1, +-0.5 -> 0, +-1 -> +1
     step(P, n, m, s, E, dt, rnd, opts)   one tick of the sand
     orient(P, n, m, s, E, dt)            long grains turn to lie ALONG the lines
     MEDIA.sand / MEDIA.rice              what is on the plate (0.2.0)
     swarmAccel(ug, E, K, J, D, vX, vY, h1, h2)   THE SWARM LAW (0.3.0): the same idea as a
                                          FORCE for flying agents (see below)

   THE SWARM LAW (0.3.0, 2026-09-30). Bill: "your first step is my first step" -
   Chladni folded INTO the living swarm (ZigWebGPU opts.chladni). Sand is a random
   walk; a Zigverse shard is a body with a velocity, a speed band, neighbours and
   (with MASS / NATURE) weight and reactions. So here the plate is a FORCE:
     slide  toward the still line - down the slope of |u| - with a pull that grows
            with how loud the spot is (K), so a shard ON a line feels nothing
     shake  a random kick scaled by how hard its spot moves (+ the same small
            floor as the sand), so loud places cannot hold a shard (J)
     grip   the plate's friction: velocity IN the plate's plane bleeds (D). Sand
            has no momentum; a shard does, and without grip it overshoots every
            line and swings across it. Motion in DEPTH is free, so a settled
            shard streams along its sheet instead of stopping.
   both times the drive E (breath while a note is held). The plate faces the
   viewer: a standing wave in the air between you and the swarm, so its still
   lines read as Chladni's figures and in depth they are sheets to stream along.
   The Bee is exempt (charisma is performance, not physics).

   MEDIA (0.2.0, 2026-09-30). Bill: "an option between rice and grains of sand".
   They are not the same experiment. SAND is fine and numerous: the figure
   is everything, the grain disappears into it. RICE is few, large and long:
   every grain is a body you can follow - it is the Zigverse shard - it hops
   higher and tumbles, settles a little slower, and because it is LONG it is
   turned by the vibration until it lies along the line it has found, the
   way real rice does on a speaker. The law is the same; only the medium
   changes (count, size, how hard it is shaken, how high it hops, alignment).
   ========================================================================== */
(function (global) {
  "use strict";
  const PI = Math.PI;

  const ZigChladni = {
    VERSION: "0.3.0",
    SWARM: { gentle: { K: 8, J: 8, D: 2 }, firm: { K: 12, J: 10, D: 2 } },   // presets for the swarm law - tuned on a stand-in flock with the real speed band (vmin 0.35, vmax 4.2 + breath), spacing 3.6 and a 45-unit body: the figure forms in ~3 s (plate motion under the shards 0.13-0.25 of a plate-less control)
    MEDIA: {
      sand: { count: 40000, phone: 16000, size: 0.016, shake: 0.16, floor: 0.07, slide: 0.0012, hop: 0.9, hopRate: 6, align: 0, tilt: 1.7 },
      rice: { count: 5000, phone: 5000, size: 0.045, shake: 0.13, floor: 0.05, slide: 0.0012, hop: 1.5, hopRate: 4, align: 4.0, tilt: 0.45 }
    },
    K_REF: 25,          // the mode number of the reference note (the (4,3) figure)
    NOTE_REF: 64,       // E4 - an EWI's range (~55..91) then spans k ~ 15..120

    modes(maxN) {
      const out = [];
      for (let n = 1; n <= maxN; n++) for (let m = 0; m < n; m++) out.push({ n, m, k: n * n + m * m });
      return out.sort((a, b) => a.k - b.k || b.m - a.m);          // a tie (25 = 5,0 = 4,3) goes to the more woven figure
    },

    u(n, m, s, x, y) {
      const X = PI * (x + 1) / 2, Y = PI * (y + 1) / 2;
      return Math.cos(n * X) * Math.cos(m * Y) + s * Math.cos(m * X) * Math.cos(n * Y);
    },

    grad(n, m, s, x, y) {
      const X = PI * (x + 1) / 2, Y = PI * (y + 1) / 2, h = PI / 2;
      const cnX = Math.cos(n * X), snX = Math.sin(n * X), cmX = Math.cos(m * X), smX = Math.sin(m * X);
      const cnY = Math.cos(n * Y), snY = Math.sin(n * Y), cmY = Math.cos(m * Y), smY = Math.sin(m * Y);
      return [h * (-n * snX * cmY - s * m * smX * cnY), h * (-m * cnX * smY - s * n * cmX * snY)];
    },

    /* u and its gradient together (they share every trig call) -> out [u, dx, dy] */
    ug(n, m, s, x, y, out) {
      const X = PI * (x + 1) / 2, Y = PI * (y + 1) / 2, h = PI / 2;
      const cnX = Math.cos(n * X), snX = Math.sin(n * X), cmX = Math.cos(m * X), smX = Math.sin(m * X);
      const cnY = Math.cos(n * Y), snY = Math.sin(n * Y), cmY = Math.cos(m * Y), smY = Math.sin(m * Y);
      out[0] = cnX * cmY + s * cmX * cnY;
      out[1] = h * (-n * snX * cmY - s * m * smX * cnY);
      out[2] = h * (-m * cnX * smY - s * n * cmX * snY);
      return out;
    },

    /* a FIXED map, so an instrument can be learned: the same note always asks
       for the same figure. Frequency doubles per octave, so k does too. */
    kFor(note, ref) { return this.K_REF * Math.pow(2, (note - (ref == null ? this.NOTE_REF : ref)) / 12); },

    pick(list, k) {
      let best = list[0], bd = Infinity; const lk = Math.log(Math.max(1e-6, k));
      for (const md of list) { const d = Math.abs(Math.log(md.k) - lk); if (d < bd) { bd = d; best = md; } }
      return best;
    },

    morph(bend) { return -Math.cos(PI * Math.max(-1, Math.min(1, bend || 0))); },

    /* ONE TICK OF THE SAND. P = { x, y, h, vh: Float32Array(N) } plate coords
       (x, y in -1..1), h = hop height. E = drive 0..1 (how hard the plate is
       bowed). rnd() -> 0..1. The mode can be cross-faded: opts.prev = {n, m, s}
       and opts.w (0..1 weight of the new mode) - a plate does not jump modes
       in zero time, and a 0.15 s fade keeps a note change from popping.
       Returns the mean |u| under the grains (low = the figure has formed). */
    step(P, n, m, s, E, dt, rnd, opts) {
      const o = opts || {}, N = P.x.length;
      const shake = (o.shake == null ? 0.16 : o.shake) * E * Math.sqrt(dt);
      const slide = (o.slide == null ? 0.0012 : o.slide) * E * dt;    // gentle: the shaking alone finds the lines; the slide only speeds it (too strong and a line collapses to one grain)
      const prev = o.prev, w = o.w == null ? 1 : o.w, floor = o.floor == null ? 0.07 : o.floor;
      const hop = o.hop == null ? 0.9 : o.hop, hopRate = o.hopRate == null ? 6 : o.hopRate;
      let acc = 0; const A = this._A, B = this._B;
      for (let i = 0; i < N; i++) {
        let x = P.x[i], y = P.y[i];
        this.ug(n, m, s, x, y, A);
        let a = A[0], gx = A[1], gy = A[2];
        if (prev && w < 1) {
          this.ug(prev.n, prev.m, prev.s, x, y, B);
          a = B[0] + (a - B[0]) * w; gx = B[1] + (gx - B[1]) * w; gy = B[2] + (gy - B[2]) * w;
        }
        const amp = Math.abs(a);
        acc += amp;
        if (E > 0) {
          /* random walk scaled by how hard this spot moves (Box-Muller pair) */
          const r1 = Math.max(1e-9, rnd()), r2 = rnd(), R = Math.sqrt(-2 * Math.log(r1));
          const k = shake * (amp + floor);                            // a real plate is never perfectly still: the floor gives a line its width
          x += k * R * Math.cos(6.2831853 * r2) - slide * 2 * a * gx;
          y += k * R * Math.sin(6.2831853 * r2) - slide * 2 * a * gy;
          /* the plate edge: grains bounce back in (a real free plate would lose them) */
          if (x > 1) x = 2 - x; else if (x < -1) x = -2 - x;
          if (y > 1) y = 2 - y; else if (y < -1) y = -2 - y;
          P.x[i] = Math.max(-1, Math.min(1, x)); P.y[i] = Math.max(-1, Math.min(1, y));
          /* a hop: loud spots toss grains up, gravity brings them down */
          if (P.h[i] <= 0 && rnd() < amp * E * dt * hopRate) P.vh[i] = (0.25 + 0.75 * rnd()) * amp * E * hop;
        }
        if (P.h[i] > 0 || P.vh[i] > 0) {
          P.vh[i] -= 9.0 * dt; P.h[i] += P.vh[i] * dt;
          if (P.h[i] <= 0) { P.h[i] = 0; P.vh[i] = 0; }
        }
      }
      return acc / Math.max(1, N);
    },

    _A: [0, 0, 0], _B: [0, 0, 0],
    /* LONG GRAINS ALIGN. A grain lying across a nodal line has one end in
       motion and one end still, so the shaking turns it until it lies ALONG
       the line (perpendicular to the slope of u). P.a holds each grain's
       angle on the plate; a grain has no head or tail, so it turns the
       shorter way (a doubled angle). A grain in the air is left to tumble. */
    orient(P, n, m, s, E, dt, rate) {
      if (!P.a || !(E > 0)) return;
      const k = Math.min(1, (rate == null ? 4 : rate) * E * dt), A = this._A;
      for (let i = 0; i < P.a.length; i++) {
        if (P.h[i] > 0) continue;
        this.ug(n, m, s, P.x[i], P.y[i], A);
        if (A[1] * A[1] + A[2] * A[2] < 1e-6) continue;
        const along = Math.atan2(A[2], A[1]) + PI / 2, d2 = 2 * (along - P.a[i]);
        P.a[i] += 0.5 * Math.atan2(Math.sin(d2), Math.cos(d2)) * k;
      }
    },

    /* THE SWARM LAW: plate-plane acceleration for one agent. ug = [u, du/dX, du/dY]
       at its place on the plate; vX, vY = its velocity along the plate's right and
       up; h1, h2 = two per-agent-per-frame randoms 0..1.
       Returns [aX, aY] (world units / s^2 along the plate's right and up). */
    swarmAccel(ug, E, K, J, D, vX, vY, h1, h2) {
      if (!(E > 0)) return [0, 0];
      const u = ug[0], gx = ug[1], gy = ug[2], amp = Math.abs(u), gl = Math.hypot(gx, gy);
      let ax = 0, ay = 0;
      if (gl > 1e-4) { const k = -Math.sign(u) * Math.min(amp, 1) * K / gl; ax = k * gx; ay = k * gy; }
      const a = 6.2831853 * h1, j = (0.5 + h2) * (amp + 0.07) * J;
      return [(ax + Math.cos(a) * j - D * vX) * E, (ay + Math.sin(a) * j - D * vY) * E];
    },

    /* sand scattered evenly across the plate (a fresh plate, or a shake) */
    scatter(P, rnd) {
      for (let i = 0; i < P.x.length; i++) { P.x[i] = rnd() * 2 - 1; P.y[i] = rnd() * 2 - 1; P.h[i] = 0; P.vh[i] = 0; if (P.a) P.a[i] = rnd() * PI * 2; }
    },
    create(N) { return { x: new Float32Array(N), y: new Float32Array(N), h: new Float32Array(N), vh: new Float32Array(N), a: new Float32Array(N) }; },

    /* mean |u| of an EVEN spread - the baseline a formed figure is judged against */
    baseline(n, m, s) { let a = 0, c = 0; for (let i = 0; i < 64; i++) for (let j = 0; j < 64; j++) { a += Math.abs(this.u(n, m, s, -1 + (i + 0.5) / 32, -1 + (j + 0.5) / 32)); c++; } return a / c; }
  };
  global.ZigChladni = ZigChladni;
})(typeof window !== "undefined" ? window : globalThis);

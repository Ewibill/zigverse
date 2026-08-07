/* =============================================================================
   FIREFLIES — ZigGlow 004 · species/fireflies.js · v0.2 (THE HEARTBEAT)
   A field of light in the dark that synchronizes.

   v0.2 delivers the mandate: the ZigPhase law (engine v0.3). Every firefly
   carries a blink oscillator with its own natural frequency; each frame it is
   pulled toward its 7 nearest neighbors' phases — Kuramoto over the SAME
   topological graph the flock flies on. Proven on CPU parity:
   test/fireflies_sync_ref.mjs — local coherence −0.01 at K=0 → 0.80 at K=2.5.

   THE PERFORMANCE MAPPING (breath = source of life):
     breath  → coupling K. Play, and chaos falls into one rhythm.
               Stop, and the field scatters back to random twinkling.
     strike  → ignition wave: a synchronized pulse expands from the point
               (impulse ring reused; the wavefront yanks phases to the flash)
     bend    → tempo: the whole field's blink rate leans faster/slower
     silence → Climate/Temperament drift — the night never repeats

   Emotional register: intimate wonder. The goosebump is the moment chaos
   resolves into one heartbeat. A room goes quiet, it doesn't gasp.

   Load order: zigcore.js · zigwebgpu.js · species/fireflies.js
   ========================================================================== */
(function (global) {
  "use strict";
  const ZC = global.ZigCore, ZG = global.ZigWebGPU;

  const SEED = 0xF1EF;
  const COUNT = 6000;
  const EXT = 130, EXTY = 130;
  const ANCHOR = [0, 62, 0];

  const Fireflies = global.Fireflies = { version: "0.4.1", flock: null, gpu: null, stage: "loaded", booted: false };   // 0.4: REVIVAL — ghosts (E/D) & wind (F/G), nothing else on purpose
  /* v0.3 — PACEMAKER: your note-on rhythm becomes an oscillator in the graph.
     Steady playing entrains the field to YOUR beat; sloppiness loses it. */

  const withTimeout = (p, ms, what) => Promise.race([p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(what + " stalled (" + (ms / 1000) + "s)")), ms))]);

  function hud(el) {
    return {
      pill(ok, txt) { el.querySelector("#probe").innerHTML =
        '<span class="pill ' + (ok ? "ok" : "bad") + '">PROBE ' + (ok ? "●" : "✕") + " " + (ok ? "GREEN" : "RED") +
        "</span> <span class='dim'>" + txt + "</span>"; },
      line(id, txt) { const n = el.querySelector("#" + id); if (n) n.textContent = txt; }
    };
  }

  Fireflies.boot = async function (canvas, hudEl) {
    const H = hud(hudEl);

    Fireflies.stage = "asking for a WebGPU adapter";
    H.line("status", "asking the browser for a WebGPU adapter + device…");
    if (!global.navigator || !navigator.gpu) {
      H.pill(false, "navigator.gpu missing — use Chrome/Edge; check chrome://gpu");
      H.line("status", "gate closed"); return { ok: false };
    }
    let gpu;
    try { gpu = await withTimeout(ZG.init(canvas, { msaa: true }), 10000, "adapter/device request"); }
    catch (e) {
      const m = (e && e.message) || String(e);
      H.pill(false, m);
      H.line("status", /OUTOFMEMORY|OutOfMemory/i.test(m)
        ? "GPU is full — CLOSE the other Zigverse tabs (each keeps its world alive), then reload"
        : "gate closed — fix WebGPU, then reload");
      return { ok: false, reason: m };
    }
    H.pill(true, gpu.probe.desc);
    Fireflies.gpu = gpu;
    gpu.device.lost.then((i) => { H.pill(false, "device lost: " + (i.message || i.reason)); H.line("status", "gate re-closed — reload the node"); });

    Fireflies.stage = "waking ZigCore";
    ZC.Perf.init({ idle: true, onStatus: (s) => H.line("midi", s) });
    ZC.Drive.init({ depth: 8 });
    ZC.Climate.init(SEED);
    ZC.Temperament.init(SEED);
    ZC.Turnover.init(SEED, { slots: 2, interval: 160, departSec: 18, returnSec: 14, reach: 2.6 });
    ZC.Pacemaker.init();

    Fireflies.stage = "compiling the kernel + the phase law";
    H.line("status", "compiling the kernel · waking the oscillators…");
    /* REVIVAL TOUR stop 1 (2026-07-22): this journey deserves exactly two
       gifts — GHOSTS and WIND. Nothing else was added on purpose. */
    const flow = ZG.createFlow(gpu, { extent: EXT, extentY: EXTY, cell: 8, gain: 0.8, damp: 0.32 });
    Fireflies.flow = flow;
    const flock = ZG.createFlock(gpu, {
      max: 20000, count: COUNT, seed: SEED,
      extent: EXT, extentY: EXTY, cell: 12, debris: 0,
      phase: {},                                  // ← ZigPhase: the TIME law
      flow                                        // ← ZigFlow: lanterns drift on real air
    });
    flock.seed(ANCHOR);
    flock.seedPhase(4.4, 0.25);                   // ≈0.7 Hz lanterns, each its own clock
    Fireflies.flock = flock;
    /* MEMORY GLASS, gated: only the FLASH crosses into memory — a blink
       lingers on the night the way it lingers on the retina. E/D dials τ. */
    const after = ZG.createAfterimage(gpu, { tau: 1.5, gate: 0.30 });
    flock.attachAfterimage(after);
    Fireflies.after = after;

    const taps = new Float32Array(64);
    const wanderers = new Float32Array(16), wmeta = new Float32Array(16);
    const impulses = [];
    for (let i = 0; i < 8; i++) impulses.push({ o: [0, 0, 0], t0: -1, strength: 0 });
    let impPtr = 0;

    const state = {
      dt: 0, time: 0, breath: 0, bend: 0, attack: 0, energy: 0,
      waveSpeed: 26, waveWidth: 9,               // a hush rolling over a meadow
      agitAmbient: 0.08,
      cohW: 0.5, sepW: 3.2, aliW: 0.3,
      anchor: [ANCHOR[0], ANCHOR[1], ANCHOR[2], 16],
      refpt: [0, ANCHOR[1], 0, 6],
      wind: [0, 0, 0],
      knobsA: [0.4, 3.4, 0.3, 3.6],              // gentle — they mostly hover
      knobsB: [6, 20, 0.5, 0.8],
      impulses, taps, wanderers, wmeta,
      medium: 1,
      K: 0, tempo: 1, ignite: 2.4,               // ZigPhase levers
      pacePhase: 0, pacePull: 0,                 // Pacemaker (the performer's clock)
      center: ANCHOR, breathPush: 0
    };

    Fireflies.strike = function (x, y, z, strength) {
      const im = impulses[impPtr]; impPtr = (impPtr + 1) % 8;
      im.o = [x, y, z]; im.t0 = state.time; im.strength = strength || 0.85;
      state.refpt = [x, y, z, state.refpt[3]];
    };

    /* View — the dark field. birdLight.rgb = lantern color · birdDark.w = size */
    const view = new Float32Array(76);
    const setV4 = (o, a, b, c, d) => { view[o] = a; view[o + 1] = b; view[o + 2] = c; view[o + 3] = d; };
    const GOLD = [0.62, 0.88, 0.28];             // warm green-gold lantern
    const BLUE = [0.30, 0.62, 1.00];             // the cold-blue variant night
    const dial = { Kmax: 3.0, size: 0.55, glow: 0.45, camRad: 62, fov: 1.0, blue: false, paceGain: 2.2, time: 0.75 };
    let camPhase = 0, hPhase = 0;
    const applyDials = () => {
      const c = dial.blue ? BLUE : GOLD;
      setV4(60, c[0], c[1], c[2], dial.glow);    // lantern color · w = GLOW: specks vs blazing cloud (W/S)
      view[59] = dial.size;                      // birdDark.w = lantern size
    };
    setV4(32, 0.35, 0.62, -0.30, 0.03);          // the faintest moon — dark is the canvas
    setV4(36, 0.002, 0.004, 0.011, 0.0);
    setV4(40, 0.005, 0.008, 0.019, 0.0);
    setV4(44, 0.010, 0.016, 0.028, 0.0);
    setV4(48, 0.003, 0.004, 0.007, 0.0);
    setV4(52, 0.22, 0.27, 0.38, 0.0);
    setV4(56, 0.0, 0.0, 0.0, dial.size);         // birdDark unused by lanterns except .w
    setV4(64, 0, 0, 0, 0);
    setV4(68, 0, 0, 0, 0);
    setV4(72, 0, 0, 0, 0);
    applyDials();

    function camera(t) {
      const ang = t * 0.019 + camPhase, rad = dial.camRad, eyeY = 58 + 6 * Math.sin(t * 0.05 + hPhase);
      const eye = [Math.cos(ang) * rad, eyeY, Math.sin(ang) * rad];
      const ctr = [ANCHOR[0], ANCHOR[1] - 2, ANCHOR[2]];
      const aspect = gpu.canvas.clientWidth / Math.max(1, gpu.canvas.clientHeight);
      const fov = dial.fov;
      const vp = ZG.mat.mul(ZG.mat.persp(fov, aspect, 0.5, 1200), ZG.mat.lookAt(eye, ctr, [0, 1, 0]));
      view.set(vp, 0);
      let fx = ctr[0] - eye[0], fy = ctr[1] - eye[1], fz = ctr[2] - eye[2];
      const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
      let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
      const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
      setV4(16, eye[0], eye[1], eye[2], t);
      setV4(20, rx, 0, rz, aspect);
      setV4(24, -ux, -uy, -uz, Math.tan(fov / 2));
      setV4(28, fx, fy, fz, 0);
    }

    let t = 0, st = 0, fps = 0, fN = 0, fAcc = 0, hudT = 0;
    function frame(nowMs) {
      const dt = ZC.clock.tick(nowMs);
      t += dt;
      /* METABOLISM: the world's clock, not yours. Perf/Pacemaker/camera stay
         real-time; the organism (motion, waves, blinks, moods) runs at
         dial.time — slow the field without slowing the performer. */
      const sdt = dt * dial.time;
      st += sdt;
      ZC.Recorder.update();
      ZC.Perf.update(dt, t);
      ZC.Drive.update(dt);
      ZC.Climate.update(sdt);
      ZC.Temperament.update(sdt);
      ZC.Turnover.update(sdt, flock.count, ANCHOR, 60);
      ZC.Turnover.getWanderers(wanderers, wmeta);
      ZC.Drive.taps(taps, state.refpt[3]);

      state.dt = sdt; state.time = st;
      state.breath = ZC.Perf.breath; state.bend = ZC.Perf.bend; state.attack = ZC.Perf.attack;
      state.energy = ZC.Drive.energy;

      /* THE MAPPING: breath pulls them into rhythm. Below the threshold the
         field is chaos; sustained breath sweeps K through the transition the
         CPU ref proved (lock ≈ 2.5). Climate drifts the threshold a whisper
         so the same breath never lands exactly the same way twice. */
      const thr = 0.10 + 0.06 * ZC.Climate.drift(1);
      state.K = dial.Kmax * ZC.util.smoothstep(thr, 0.75, ZC.Perf.breath);
      state.tempo = 1 + 0.35 * ZC.Perf.bend;                  // bend leans the blink rate
      /* PACEMAKER: your note-on rhythm becomes an oscillator the field can
         lock to — IF you earn it. Confidence gates the pull, and (like real
         fireflies) it also slides the field's intrinsic tempo toward yours,
         so the phase pull only has to close the last gap. */
      ZC.Pacemaker.update(dt);
      state.pacePhase = ZC.Pacemaker.phase;
      state.pacePull = dial.paceGain * ZC.Pacemaker.pull;
      const rate = Math.min(3.2, Math.max(0.4, ZC.Pacemaker.omega / (4.4 * dial.time)));   // sim-time compensated
      state.tempo *= 1 + (rate - 1) * 0.85 * ZC.Pacemaker.confidence;
      /* RIBBONS: playing fast is how Bill goes slow — streaming density
         (flow) deepens the coupling and shimmers the field, so a ribbon
         literally pulls the swarm together while its STARTS set the pulse */
      state.K = Math.min(dial.Kmax, state.K + dial.Kmax * 0.45 * ZC.Pacemaker.flow);
      state.agitAmbient += 0.12 * ZC.Pacemaker.flow;
      state.knobsB[3] = 0.55 + 0.5 * ZC.Temperament.axis(0);
      state.cohW = 0.35 + 0.4 * ZC.Temperament.axis(1);
      state.agitAmbient = 0.05 + 0.08 * ZC.Climate.drift(0);

      /* the meadow's air: breath brews a gentle wind; strikes stir swirls
         that outlive the hush; lanterns drift instead of hovering in vacuum */
      flow.ambient = 0.35 + 1.6 * ZC.Perf.breath;
      flow.frame(state, null);

      camera(t);
      flock.frame(state, view);

      fAcc += dt; fN++;
      if (fAcc >= 0.5) { fps = fN / fAcc; fAcc = 0; fN = 0; }
      hudT += dt;
      if (hudT > 0.25) {
        hudT = 0;
        H.line("status", flock.count + " fireflies · " + fps.toFixed(0) + " fps · " +
          (ZC.Perf.live ? "LIVE" : (ZC.Perf._sim > 0 ? "SIM" : "idle")) +
          " · breath " + "▮".repeat(Math.round(ZC.Perf.breath * 10)).padEnd(10, "▯") +
          " · K " + state.K.toFixed(2) + (state.K > 2.4 ? "  ← LOCKED" : (state.K > 1.2 ? "  ← gathering" : "")) +
          (ZC.Pacemaker.flow > 0.15 ? "  ·  ribbon " + "≈".repeat(Math.max(1, Math.round(ZC.Pacemaker.flow * 5))) : "") +
          (ZC.Pacemaker.confidence > 0.05
            ? "  ·  you " + ZC.Pacemaker.bpm.toFixed(0) + "bpm " +
              "●".repeat(Math.round(ZC.Pacemaker.confidence * 4)).padEnd(4, "○") +
              (ZC.Pacemaker.confidence > 0.7 ? " FOLLOWING YOU" : (ZC.Pacemaker.confidence > 0.35 ? " listening…" : ""))
            : ""));
        H.line("engine", "time " + dial.time.toFixed(2) + "\u00d7 \u00b7 " + (dial.blue ? "cold blue" : "green-gold") + " · Kmax " + dial.Kmax.toFixed(1) +
          " · pace " + dial.paceGain.toFixed(1) +
          " · ghosts " + (after.tau < 0.02 ? "off" : after.tau.toFixed(1) + "s") + " · wind " + flow.gain.toFixed(1) +
          " · glow " + dial.glow.toFixed(2) + " · size " + dial.size.toFixed(2) + " · cam " + dial.camRad.toFixed(0) + " · fov " + dial.fov.toFixed(2) +
          " · ZigCore " + ZC.VERSION + " · ZigWebGPU " + ZG.VERSION);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    global.addEventListener("keydown", (e) => {
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
      if (e.code === "KeyB") ZC.Perf.sim(0.85);
      if (e.code === "Space") { Fireflies.strike(ANCHOR[0], ANCHOR[1], ANCHOR[2], 0.95); e.preventDefault(); }
      if (e.code === "KeyI") dial.Kmax = clamp(dial.Kmax + 0.2, 0, 6);
      if (e.code === "KeyK") dial.Kmax = clamp(dial.Kmax - 0.2, 0, 6);
      if (e.code === "KeyO") dial.size = clamp(dial.size + 0.1, 0.2, 3);
      if (e.code === "KeyL") dial.size = clamp(dial.size - 0.1, 0.2, 3);
      if (e.code === "Equal") dial.camRad = clamp(dial.camRad - 5, 22, 170);
      if (e.code === "Minus") dial.camRad = clamp(dial.camRad + 5, 22, 170);
      if (e.code === "BracketRight") dial.fov = clamp(dial.fov + 0.05, 0.5, 1.4);
      if (e.code === "BracketLeft") dial.fov = clamp(dial.fov - 0.05, 0.5, 1.4);
      if (e.code === "KeyP") dial.blue = !dial.blue;           // a different night
      if (e.code === "KeyE") after.tau = clamp(after.tau < 0.15 ? 0.15 : after.tau * 1.3, 0, 6);   // E/D — the ghost dial
      if (e.code === "KeyD") { after.tau /= 1.3; if (after.tau < 0.15) after.tau = 0; }
      if (e.code === "KeyF") flow.gain = clamp(flow.gain + 0.2, 0, 3);       // F/G — the meadow wind
      if (e.code === "KeyG") flow.gain = clamp(flow.gain - 0.2, 0, 3);
      if (e.code === "KeyW") dial.glow = clamp(dial.glow + 0.1, 0.1, 2);     // W/S — glow: specks ↔ blazing cloud
      if (e.code === "KeyS") dial.glow = clamp(dial.glow - 0.1, 0.1, 2);
      if (e.code === "KeyY") dial.paceGain = clamp(dial.paceGain + 0.2, 0, 5);   // Y/H — your pull on the field
      if (e.code === "KeyH") dial.paceGain = clamp(dial.paceGain - 0.2, 0, 5);
      if (e.code === "Comma") dial.time = clamp(dial.time / 1.15, 0.15, 1.6);   // , slower
      if (e.code === "Period") dial.time = clamp(dial.time * 1.15, 0.15, 1.6);  // . faster
      if (e.code === "KeyC") { dial.camRad = 62; dial.fov = 1.0; camPhase = -t * 0.019; hPhase = -t * 0.05; }
      applyDials();
    });
    global.addEventListener("keyup", (e) => { if (e.code === "KeyB") ZC.Perf.sim(0); });
    canvas.addEventListener("pointerdown", (e) => {
      const r = canvas.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = 1 - ((e.clientY - r.top) / r.height) * 2;
      Fireflies.strike(ANCHOR[0] + nx * 70, ANCHOR[1] + ny * 50, ANCHOR[2], 0.9);
    });

    Fireflies.stage = "alive";
    Fireflies.booted = true;
    H.line("status", "alive — hold B (or play) and watch chaos become one heartbeat");
    return { ok: true, flock };
  };

})(typeof window !== "undefined" ? window : globalThis);

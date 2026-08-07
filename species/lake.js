/* =============================================================================
   THE LAKE — ZigFlight · species/lake.js · v0.1
   Throw a stone. Watch the rings fan out. Then become the frog.

   Bill's vision (2026-07-20): stones → rings → incarnation. Act one you are
   the sky: notes fall on the water as stones, rings fan out and CROSS (eight
   live fronts superpose — interference is free). Act two you press F and
   become the frog: leaping on your attacks, splashing rings of your own,
   playing in and around the waves you made. Waves GROW with activity — ring
   strength rides accumulated energy and flow — and they DIE SLOWLY: water
   has memory ("swell, not decay" come home).

   Engine: Surface law (medium 2 — the skin) · waveLife 12s · everything else
   inherited: ZigPhase shimmer, Pacemaker, Avatar-as-frog, ZigMidi duet.

   Cameras (X cycles): CHASE · OVERHEAD (above the last stone) ·
   SIDE SKIN (wave depth + peaks in profile) · COCKPIT (the frog's eyes).
   ========================================================================== */
(function (global) {
  "use strict";
  const ZC = global.ZigCore, ZG = global.ZigWebGPU, ZM = global.ZigMesh, ZMI = global.ZigMidi;

  const SEED = 0x1A6E;
  const COUNT = 11000;                             // water, not dots
  const EXT = 150, EXTY = 90;
  const LAKE = 40;                                 // the water level
  const CTRV = [0, LAKE, 0];
  const PETAL = Object.assign({}, ZM ? ZM.presets.sicklePetal : {});

  const Lake = global.TheLake = { version: "0.7.0", flock: null, gpu: null, stage: "loaded", booted: false };   // 0.7: LIVING WATER — ZigFlow currents (Q/Z) + gated memory glass (E/D) + ZigTimbre (A)

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

  Lake.boot = async function (canvas, hudEl) {
    const H = hud(hudEl);

    Lake.stage = "asking for a WebGPU adapter";
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
    Lake.gpu = gpu;
    gpu.device.lost.then((i) => { H.pill(false, "device lost: " + (i.message || i.reason)); H.line("status", "gate re-closed — reload the node"); });

    Lake.stage = "waking ZigCore";
    let ewiStatus = "";
    ZC.Perf.init({ idle: true, onStatus: (s) => { ewiStatus = s; H.line("midi", s); } });
    ZC.Drive.init({ depth: 10 });
    ZC.Climate.init(SEED);
    ZC.Temperament.init(SEED);
    ZC.Turnover.init(SEED, { slots: 2, interval: 170, departSec: 16, returnSec: 12, reach: 2.2 });
    ZC.Pacemaker.init();

    Lake.stage = "pouring the lake + compiling the kernel";
    H.line("status", "pouring the lake · compiling the kernel…");
    /* TWO WATERS (Bill, 2026-07-20): sickle-leaves as the skin, WOODBLOCKS
       as the under-row 14 below. Stones are spheres, so the deep stratum
       hears every ring ~1s late and softer — echo in DEPTH, layering with
       the wall echoes. Scene mode: two species, one world, one camera. */
    const DEEP = LAKE - 14, COUNT_D = 4600;
    const scene = ZG.createScene(gpu, { sky: true });
    /* ZIGFLOW (engine v0.8, joined the Lake 2026-07-21): the water gains
       CURRENTS. Breath brews slow under-streams, every stone's ring stirs a
       swirl that outlives it, and the koi ride what the stones remember.
       Q = more current · Z = less. Gentler than air: leaves drift, not fly. */
    const flow = ZG.createFlow(gpu, { extent: EXT, extentY: EXTY, cell: 8, gain: 0.9, damp: 0.30 });
    Lake.flow = flow;
    const flock = ZG.createFlock(gpu, {
      max: 20000, count: COUNT, seed: SEED,
      extent: EXT, extentY: EXTY, cell: 12, debris: 0,
      mesh: ZM.shard(PETAL), phase: {}, flow
    });
    const flockD = ZG.createFlock(gpu, {
      max: 8000, count: COUNT_D, seed: SEED ^ 0xDEE9,
      extent: EXT, extentY: EXTY, cell: 12, debris: 0,
      mesh: ZM.shard(ZM.presets.woodblock), phase: {}, flow
    });
    /* KOI — inhabitants: pale slivers gliding beneath the wood. They feel
       your stones (shared impulse list scatters them) and your breath
       gathers the school. No blink — fish don't burn, they glide. */
    const KOI = 420, SWIM = LAKE - 26;
    const flockF = ZG.createFlock(gpu, {
      max: 2000, count: KOI, seed: SEED ^ 0x0F15,
      extent: EXT, extentY: EXTY, cell: 12, debris: 0,
      mesh: ZM.shard(ZM.presets.ribbon), flow       // koi RIDE the currents the stones stir
    });
    scene.add(flock); scene.add(flockD); scene.add(flockF);
    /* MEMORY GLASS (engine v0.7.1, gated): only true flashes — glints on the
       moonpath, splash crowns — leave ghosts; the drifting skin stays crisp.
       E = longer memory · D = shorter (snaps OFF below 0.15 s). */
    const after = ZG.createAfterimage(gpu, { tau: 1.4, gate: 0.5 });
    scene.attachAfterimage(after);
    Lake.after = after;
    flock.seed(CTRV);            flockD.seed([0, DEEP, 0]);   flockF.seed([0, SWIM, 0]);
    flock.seedSurface(LAKE, EXT * 0.88);
    flockD.seedSurface(DEEP, EXT * 0.8);
    flock.seedPhase(4.4, 0.25);  flockD.seedPhase(3.2, 0.3);   // deeper = slower lanterns
    Lake.flock = flock; Lake.flockD = flockD; Lake.flockF = flockF;

    const taps = new Float32Array(64);
    const wanderers = new Float32Array(16), wmeta = new Float32Array(16);
    const impulses = [];
    for (let i = 0; i < 8; i++) impulses.push({ o: [0, 0, 0], t0: -1, strength: 0 });
    let impPtr = 0;

    const state = {
      dt: 0, time: 0, breath: 0, bend: 0, attack: 0, energy: 0,
      waveSpeed: 13, waveWidth: 5,               // rings amble, they don't strike
      waveLife: 12,                              // WATER HAS MEMORY — slow fade
      agitAmbient: 0.05,
      cohW: 0.09, sepW: 3.6, aliW: 0.12,   // near-zero self-attraction: the lake STAYS a lake; the curdle is slow and earned
      anchor: [0, LAKE, 0, 0],
      refpt: [0, LAKE, 0, 8],
      wind: [0, 0, 0],
      knobsA: [0.4, 3.8, 0.05, 1.6],             // wider personal space — the skin self-heals flat
      knobsB: [3, 34, 0.5, 0.3],                 // waveKick↑ (crest height) · calm churn
      impulses, taps, wanderers, wmeta,
      medium: 2,                                  // ← SURFACE — the lake law
      K: 0, tempo: 1, ignite: 2.0,
      pacePhase: 0, pacePull: 0,
      avatarA: [-1, 0, LAKE, 0],                  // stone mode: no body (the sky throws)
      avatarB: [0.9, 0, 0.1, 5],
      center: CTRV, breathPush: 0
    };

    /* ---- stones + THE ECHO POOL ------------------------------------------
       Finite water: hard walls at ±POOL. A reflection off a wall is exactly
       a phantom stone thrown from the MIRROR position at the same moment
       (image-source acoustics) — so when a ring's front reaches a wall, we
       spawn its mirror and the arc peels back INTO the pool. One bounce per
       ring, half strength; echoes share the same 8 wavefront slots. */
    const POOL = EXT * 0.88;
    let lastStone = [0, LAKE, 0], stoneN = 0, echoQ = [];
    function spawnImpulse(x, z, t0, strength) {
      /* recycle the emptiest/oldest/weakest slot — a fresh stone never
         evicts a young ring; gust-ruffles give way first */
      let best = 0, bestAge = -1e9;
      for (let i = 0; i < 8; i++) {
        const im = impulses[i];
        const age = im.t0 < 0 ? 1e9 : (state.time - im.t0) + (0.5 - im.strength) * 4;
        if (age > bestAge) { bestAge = age; best = i; }
      }
      const im = impulses[best];
      im.o = [x, LAKE, z]; im.t0 = t0; im.strength = strength;
      return im;
    }
    function throwStone(x, z, strength, gen) {
      const str = (strength || 0.7) * (0.55 + 0.75 * Math.min(ZC.Drive.energy, 1) + 0.5 * ZC.Pacemaker.flow);
      spawnImpulse(x, z, state.time, str);
      state.refpt = [x, LAKE, z, state.refpt[3]];
      lastStone = [x, LAKE, z]; stoneN++;
      if ((gen || 0) < 1 && str * 0.5 > 0.14) {
        /* schedule the four first-order echoes: mirror sources, born the
           moment the real front kisses each wall */
        const ws = state.waveSpeed, t0 = state.time;
        const walls = [
          { d: POOL - x,  mx: 2 * POOL - x,  mz: z },
          { d: POOL + x,  mx: -2 * POOL - x, mz: z },
          { d: POOL - z,  mx: x,  mz: 2 * POOL - z },
          { d: POOL + z,  mx: x,  mz: -2 * POOL - z }];
        for (const wll of walls) {
          if (wll.d < 4) continue;
          const at = t0 + wll.d / ws;
          if (at - t0 < state.waveLife - 1.5) echoQ.push({ at, x: wll.mx, z: wll.mz, t0, str: str * 0.5 });
        }
      }
    }
    Lake.throwStone = throwStone;
    Lake.stoneCount = () => stoneN;

    /* the under-row's own physics: slower fronts, longer memory, softer
       crests, its own rest level — but the SAME stones (shared impulse list) */
    const stateD = Object.assign({}, state, {
      waveSpeed: 9.5, waveLife: 16,
      anchor: [0, DEEP, 0, 0],
      knobsA: state.knobsA.slice(), knobsB: [3, 24, 0.5, 0.22],
      wanderers: new Float32Array(16), wmeta: new Float32Array(16),
      avatarA: [-1, 0, DEEP, 0], avatarB: [0, 0, 0, 0],
      center: [0, DEEP, 0]
    });
    Lake.echoPending = () => echoQ.length;

    /* ---- the frog --------------------------------------------------------- */
    const frog = { on: false, x: 20, z: 0, ang: 0, hopT: -1, hop: null };
    function startHop(pitch, vel) {
      const dist = 8 + 26 * ZC.Perf.breath;
      const h = 5 + Math.min(1, Math.max(0, (pitch - 48) / 54)) * 18;
      frog.hop = { x0: frog.x, z0: frog.z, h,
        x1: frog.x + Math.cos(frog.ang) * dist, z1: frog.z + Math.sin(frog.ang) * dist,
        vel: vel || 0.7 };
      frog.hop.x1 = Math.max(-EXT + 30, Math.min(EXT - 30, frog.hop.x1));
      frog.hop.z1 = Math.max(-EXT + 30, Math.min(EXT - 30, frog.hop.z1));
      frog.hopT = 0;
    }

    /* the koi's water: volume medium, lazy school, no clock */
    const stateF = Object.assign({}, state, {
      medium: 1, waveSpeed: 13, waveLife: 12,
      anchor: [0, SWIM, 0, 0],
      cohW: 0.5, sepW: 2.5, aliW: 0.6,
      knobsA: [0.4, 2.2, 0.6, 3.4], knobsB: [5, 18, 0.6, 0.5],
      wanderers: new Float32Array(16), wmeta: new Float32Array(16),
      avatarA: [-1, 0, SWIM, 0], avatarB: [0, 0, 0, 0],
      K: 0, pacePull: 0, center: [0, SWIM, 0]
    });

    /* ---- view ------------------------------------------------------------- */
    const view = new Float32Array(76);
    const setV4 = (o, a, b, c, d) => { view[o] = a; view[o + 1] = b; view[o + 2] = c; view[o + 3] = d; };
    const MOON = [0.46, 0.55, 0.74];
    const MOSS = [0.075, 0.112, 0.100], BONE = [0.80, 0.84, 0.80];   // water tones, lifted
    const dial = { ink: 1.5, moon: 1.7, size: 1.7, smear: 1.2, camRad: 150, fov: 1.05, spectral: false,
                   Kmax: 2.6, paceGain: 2.2, time: 0.7, mark: 2, genesis: false, cam: 0 };
    const CAMS = ["chase", "overhead", "side skin", "cockpit"];
    let camPhase = 0;
    const applyDials = () => {
      if (dial.spectral) {
        setV4(52, 0, 0, 0, 0);
        view[56] = 0; view[57] = 0; view[58] = 0;
        view[60] = 0; view[61] = 0; view[62] = 0;
        view[63] = 0.0012;
        setV4(36, 0.001, 0.002, 0.004, 0.0);      // spectral: the void stays sacred
        setV4(40, 0.002, 0.004, 0.007, 0.0);
        setV4(44, 0.004, 0.007, 0.010, 0.0);
        setV4(48, 0.001, 0.002, 0.003, 0.0);
      } else {
        /* WATER IN THE BOWL: gaps between petals show DEPTH, not void */
        setV4(36, 0.006, 0.016, 0.020, 0.0);      // far sky over water
        setV4(40, 0.010, 0.028, 0.034, 0.0);      // waterline haze
        setV4(44, 0.016, 0.042, 0.048, 0.0);      // horizon glow
        setV4(48, 0.014, 0.040, 0.046, 0.0);      // looking DOWN: deep teal body
        setV4(52, MOON[0] * dial.moon, MOON[1] * dial.moon, MOON[2] * dial.moon, 0.0);
        view[56] = MOSS[0]; view[57] = MOSS[1]; view[58] = MOSS[2];
        view[60] = BONE[0]; view[61] = BONE[1]; view[62] = BONE[2];
        view[63] = 0.0024;
      }
      view[74] = dial.ink;
    };
    setV4(32, 0.45, 0.30, -0.62, 0.06);          // LOW moon — a long road of light
    setV4(36, 0.002, 0.004, 0.012, 0.0);
    setV4(40, 0.005, 0.009, 0.021, 0.0);
    setV4(44, 0.011, 0.018, 0.032, 0.0);
    setV4(48, 0.003, 0.004, 0.007, 0.0);
    setV4(56, MOSS[0], MOSS[1], MOSS[2], 0.8);
    setV4(60, BONE[0], BONE[1], BONE[2], 0.0024);
    setV4(64, 2, 0, 0, 0);
    setV4(68, -1, 0, 0, 0);
    setV4(72, 0, 0, 0.9, 0);
    applyDials();

    /* focus point per camera: frog when embodied, else the last stone */
    const aimP = [0, LAKE, 0], cpPos = [20, LAKE + 1, 0], vsm = [0, 0, 0], cpFwd = [1, 0, 0];
    function camera(t, dt) {
      const aspect = gpu.canvas.clientWidth / Math.max(1, gpu.canvas.clientHeight);
      const focus = frog.on ? [frog.x, LAKE + 1, frog.z] : lastStone;
      let eye, ctr, up = null, fov = dial.fov;

      if (dial.cam === 3) {                       // COCKPIT — the frog's eyes
        const f = cpFwd;
        eye = [cpPos[0] - f[0] * 1.5, cpPos[1] + 1.1, cpPos[2] - f[2] * 1.5];
        ctr = [eye[0] + f[0], eye[1] + f[1] * 0.4 - 0.06, eye[2] + f[2]];
        fov = 1.18;
      } else if (dial.cam === 1) {                // OVERHEAD — above the release
        aimSlow(focus, dt, 7);
        eye = [aimP[0], LAKE + dial.camRad * 1.35, aimP[2] + dial.camRad * 0.28];
        ctr = [aimP[0], LAKE, aimP[2]];
      } else if (dial.cam === 2) {                // SIDE SKIN — depth + peaks in profile
        aimSlow(frog.on ? focus : [0, LAKE, 0], dt, 7);
        eye = [aimP[0] * 0.25, LAKE + 5.5, dial.camRad * 1.7];
        ctr = [aimP[0] * 0.25, LAKE + 2.2, 0];
      } else {                                    // CHASE — STATIONARY: locked on the
        // pool's center (or the frog); high steep vantage → water fills ≥90%
        const focusC = frog.on ? [frog.x, LAKE, frog.z] : [0, LAKE, 0];
        aimSlow(focusC, dt, 7);
        const az = camPhase, elev = 1.13, d = dial.camRad;
        eye = [aimP[0] + Math.cos(az) * Math.cos(elev) * d,
               LAKE + Math.sin(elev) * d,
               aimP[2] + Math.sin(az) * Math.cos(elev) * d];
        ctr = [aimP[0], LAKE + 1, aimP[2]];
      }

      const vp = ZG.mat.mul(ZG.mat.persp(fov, aspect, 0.3, 1400), ZG.mat.lookAt(eye, ctr, [0, 1, 0]));
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
    function aimSlow(target, dt, cap) {
      const fdt = dt || 0.016, k = Math.min(1, fdt * 0.9);
      let sx = (target[0] - aimP[0]) * k, sz = (target[2] - aimP[2]) * k;
      const sL = Math.hypot(sx, sz), mx = cap * fdt;
      if (sL > mx) { sx *= mx / sL; sz *= mx / sL; }
      aimP[0] += sx; aimP[2] += sz;
    }

    /* ---- the loop ---------------------------------------------------------- */
    let t = 0, st = 0, fastB = 0, avPitch = 72, avLastMs = -1, prevNoteMs = -1e9, rainT = 3, gustT = 5, breachT = 12, gusts = [], fps = 0, fN = 0, fAcc = 0, hudT = 0;
    function frame(nowMs) {
      const dt = ZC.clock.tick(nowMs);
      t += dt;
      const sdt = dt * dial.time;
      st += sdt;
      ZC.Recorder.update();
      if (Lake.player) Lake.player.update(dt);
      ZC.Perf.update(dt, t);
      ZC.Drive.update(dt);
      ZC.Climate.update(sdt);
      ZC.Temperament.update(sdt);
      ZC.Turnover.update(sdt, flock.count, CTRV, 70);
      ZC.Turnover.getWanderers(wanderers, wmeta);
      ZC.Drive.taps(taps, state.refpt[3]);

      state.dt = sdt; state.time = st;
      /* RAIN when the water sleeps — the sky keeps the pool alive, then
         steps aside the moment the performer arrives */
      const performerHere = (ZC.Perf.live && ZC.Perf.breath > 0.15) || ZC.Perf._sim > 0 || ZC.Pacemaker.flow > 0.12 || (Lake.player && Lake.player.playing);
      if (!performerHere) {
        rainT -= sdt;
        if (rainT <= 0) {
          throwStone((ZC.util.hash1(st * 1.7) * 2 - 1) * POOL * 0.8,
                     (ZC.util.hash1(st * 2.9 + 5.1) * 2 - 1) * POOL * 0.8,
                     0.75 + 0.35 * ZC.util.hash1(st * 4.3));
          rainT = 1.2 + 2.4 * ZC.Climate.drift(2);
        }
      } else { rainT = 1.4; }

      /* echoes come home */
      for (let i = echoQ.length - 1; i >= 0; i--) {
        if (echoQ[i].at <= st) {
          const ev = echoQ[i]; echoQ.splice(i, 1);
          spawnImpulse(ev.x, ev.z, ev.t0, ev.str);   // the mirror stone — its arc re-enters the pool
        }
      }
      state.breath = ZC.Perf.breath; state.bend = ZC.Perf.bend; state.attack = ZC.Perf.attack;
      state.energy = ZC.Drive.energy;
      state.knobsB[3] = 0.22 + 0.3 * ZC.Temperament.axis(0);
      state.agitAmbient = 0.03 + 0.05 * ZC.Climate.drift(0);
      const thr = 0.10 + 0.06 * ZC.Climate.drift(1);
      state.K = dial.Kmax * ZC.util.smoothstep(thr, 0.75, ZC.Perf.breath);
      state.tempo = 1 + 0.3 * ZC.Perf.bend;
      ZC.Pacemaker.update(dt);
      state.pacePhase = ZC.Pacemaker.phase;
      state.pacePull = dial.paceGain * ZC.Pacemaker.pull;
      const rate = Math.min(3.2, Math.max(0.4, ZC.Pacemaker.omega / (4.4 * dial.time)));
      state.tempo *= 1 + (rate - 1) * 0.85 * ZC.Pacemaker.confidence;
      state.K = Math.min(dial.Kmax, state.K + dial.Kmax * 0.4 * ZC.Pacemaker.flow);

      /* NOTES: stones from the sky, or the frog's mind */
      let newNote = -1, newVel = 0, deliberate = false;
      ZC.Perf.heldT.forEach((t0, note) => { if (t0 > avLastMs) {
        deliberate = (t0 - prevNoteMs) > 300;   // followed silence — a CHOSEN stone
        prevNoteMs = t0; avLastMs = t0; newNote = note; } });
      if (newNote >= 0) { avPitch = newNote; newVel = ZC.Perf.attack; }

      if (!frog.on) {
        state.avatarA[0] = -1;
        if (newNote >= 0 && deliberate) {
          /* stone lands where the pitch aims it: low notes near, high far */
          const px = ((avPitch - 75) / 27) * EXT * 0.55;
          const pz = ((stoneN % 2) * 2 - 1) * (18 + 24 * ZC.util.hash1(stoneN * 3.7));
          throwStone(Math.max(-EXT + 25, Math.min(EXT - 25, px)), pz, 0.5 + 0.8 * newVel);
        }
      } else {
        /* THE FROG — bend steers, attack leaps, splashdown rings */
        state.avatarA[0] = 0;
        frog.ang += ZC.Perf.bend * sdt * 1.8 + sdt * 0.1;
        if (frog.hopT < 0 && newNote >= 0 && deliberate && newVel > 0.3) startHop(avPitch, newVel);
        if (frog.hopT >= 0 && frog.hop) {
          frog.hopT += sdt / 0.85;
          const s = Math.min(1, frog.hopT), hp = frog.hop;
          frog.x = hp.x0 + (hp.x1 - hp.x0) * s;
          frog.z = hp.z0 + (hp.z1 - hp.z0) * s;
          state.avatarA[1] = frog.x;
          state.avatarA[2] = LAKE + 0.6 + hp.h * 4 * s * (1 - s);
          state.avatarA[3] = frog.z;
          if (s >= 1) { frog.hopT = -1; throwStone(frog.x, frog.z, 0.55 + 0.9 * hp.vel); state.avatarB[2] = 0.9; frog.hop = null; }
        } else {
          state.avatarA[1] = frog.x; state.avatarA[2] = LAKE + 0.6; state.avatarA[3] = frog.z;
          state.avatarB[2] = 0.1 + 0.6 * ZC.Perf.attack;
        }
        state.avatarB[1] = newNote >= 0 ? 1 : 0;
      }
      view[68] = frog.on ? 0 : -1;
      view[69] = (frog.on && dial.cam !== 3) ? [0, 0.9, 3.0][dial.mark] : 0;

      /* WATER HAS MEMORY: crisp attack, liquid release; light rides stored
         energy so the lake keeps glowing after the breath stops */
      const bRaw = ZC.Perf.breathRaw;
      fastB += (bRaw - fastB) * Math.min(1, dt * (bRaw > fastB ? 28 : 1.1));
      const en = Math.min(1, ZC.Drive.energy);
      const act = ZC.Perf.live || ZC.Perf._sim > 0;
      const rev = dial.genesis ? ZC.util.smoothstep(0.03, 0.6, Math.max(act ? ZC.Perf.breath : 0, en * 0.9)) : 1;
      view[74] = dial.ink * rev * (0.32 + 0.85 * fastB + 0.75 * en);
      if (!dial.spectral) {
        const ml = dial.moon * rev * (0.55 + 0.5 * fastB + 0.45 * en);
        view[52] = MOON[0] * ml; view[53] = MOON[1] * ml; view[54] = MOON[2] * ml;
        view[56] = MOSS[0] * rev; view[57] = MOSS[1] * rev; view[58] = MOSS[2] * rev;
        view[60] = BONE[0] * rev; view[61] = BONE[1] * rev; view[62] = BONE[2] * rev;
      }
      view[59] = dial.size * (0.85 + 0.3 * ZC.Perf.breath);
      view[70] = 3.2 * dial.moon * rev;                      // MOONPATH gain (render2.z)
      view[71] = dial.smear;                                  // FLUID smear (render2.w)

      /* cockpit proxy */
      {
        const pk = Math.min(1, dt * 1.8);
        const ox = cpPos[0], oy = cpPos[1], oz = cpPos[2];
        const tgt = frog.on ? [state.avatarA[1], state.avatarA[2], state.avatarA[3]] : [lastStone[0], LAKE + 2, lastStone[2]];
        cpPos[0] += (tgt[0] - cpPos[0]) * pk;
        cpPos[1] += (tgt[1] - cpPos[1]) * pk;
        cpPos[2] += (tgt[2] - cpPos[2]) * pk;
        const iv = 1 / Math.max(dt, 1e-3);
        vsm[0] += ((cpPos[0] - ox) * iv - vsm[0]) * Math.min(1, dt * 2.5);
        vsm[1] += ((cpPos[1] - oy) * iv - vsm[1]) * Math.min(1, dt * 2.5);
        vsm[2] += ((cpPos[2] - oz) * iv - vsm[2]) * Math.min(1, dt * 2.5);
        const vl = Math.hypot(vsm[0], vsm[1], vsm[2]);
        if (vl > 0.5) { cpFwd[0] = vsm[0] / vl; cpFwd[1] = vsm[1] / vl; cpFwd[2] = vsm[2] / vl; }
      }

      /* CAT'S PAWS — wind walks on the water, trailing ruffle-lines */
      gustT -= sdt;
      if (gustT <= 0 && gusts.length < 2) {
        const side = ZC.util.hash1(st * 7.7) * 6.283;
        const g = { x: Math.cos(side) * POOL * 0.9, z: Math.sin(side) * POOL * 0.9,
                    hx: -Math.cos(side) + (ZC.util.hash1(st * 9.1) - 0.5),
                    hz: -Math.sin(side) + (ZC.util.hash1(st * 11.3) - 0.5),
                    life: 9 + 6 * ZC.Climate.drift(3), drop: 0 };
        const hl = Math.hypot(g.hx, g.hz) || 1; g.hx /= hl; g.hz /= hl;
        gusts.push(g);
        gustT = 7 + 9 * ZC.Climate.drift(4);
      }
      for (let i = gusts.length - 1; i >= 0; i--) {
        const g = gusts[i];
        g.x += g.hx * 7 * sdt; g.z += g.hz * 7 * sdt; g.life -= sdt; g.drop -= sdt;
        if (g.drop <= 0) { spawnImpulse(g.x, g.z, st, 0.15 + 0.08 * ZC.Climate.drift(5)); g.drop = 2.1; }
        if (g.life <= 0 || Math.abs(g.x) > POOL || Math.abs(g.z) > POOL) gusts.splice(i, 1);
      }

      /* BREACH — a koi rises when the water is calm. A ring you didn't throw. */
      breachT -= sdt;
      if (breachT <= 0) {
        if (Math.min(ZC.Drive.energy, 1) < 0.55 && ZC.Pacemaker.flow < 0.3) {
          const bx = (ZC.util.hash1(st * 5.9) * 2 - 1) * POOL * 0.7;
          const bz = (ZC.util.hash1(st * 8.3) * 2 - 1) * POOL * 0.7;
          spawnImpulse(bx, bz, st, 0.5);                              // the plop
          echoQ.push({ at: st + 0.35, x: bx, z: bz, t0: st + 0.35, str: 0.8 });   // the splash
          lastStone = [bx, LAKE, bz];
        }
        breachT = 13 + 14 * ZC.Climate.drift(1);
      }

      /* TIDE — the skin breathes on accumulated energy: a chest, not a wave */
      state.anchor[1] = LAKE + (Math.min(ZC.Drive.energy, 1) - 0.35) * 4;
      stateD.anchor[1] = DEEP + (Math.min(ZC.Drive.energy, 1) - 0.35) * 2.4;

      /* the deep row breathes the same life, a shade dimmer */
      stateD.dt = state.dt; stateD.time = state.time;
      stateD.breath = state.breath; stateD.bend = state.bend; stateD.attack = state.attack;
      stateD.energy = state.energy;
      stateD.K = state.K * 0.85; stateD.tempo = state.tempo;
      stateD.pacePhase = state.pacePhase; stateD.pacePull = state.pacePull * 0.7;
      stateD.agitAmbient = state.agitAmbient;
      stateD.cohW = state.cohW; stateD.refpt = state.refpt;

      /* the koi breathe your life too — breath gathers the school */
      stateF.dt = state.dt; stateF.time = state.time;
      stateF.breath = state.breath; stateF.attack = state.attack; stateF.energy = state.energy;
      stateF.refpt = state.refpt;

      /* ZIGTIMBRE — the horn's actual voice in the water (A to arm the M2):
         body deepens the ink · shine brightens the moonpath · BITE gusts the
         currents themselves (articulation becomes weather, not a splash). */
      ZC.Timbre.update(dt);
      if (ZC.Timbre.live) {
        view[74] *= 1 + 0.4 * ZC.Timbre.body;
        view[70] *= 1 + 0.5 * ZC.Timbre.brightness;
      }
      /* stir the water: breath brews under-streams · stones swirl them
         (shared impulse queue) · audio bite gusts them */
      flow.ambient = 0.4 + 1.5 * ZC.Perf.breath + (ZC.Timbre.live ? 1.6 * ZC.Timbre.flux : 0);
      flow.frame(state, null);

      camera(t, dt);
      scene.frame(view, [state, stateD, stateF]);

      fAcc += dt; fN++;
      if (fAcc >= 0.5) { fps = fN / fAcc; fAcc = 0; fN = 0; }
      hudT += dt;
      if (hudT > 0.25) {
        hudT = 0;
        H.line("status", (frog.on ? "FROG" : "STONES") + " · " + flock.count + "+" + flockD.count + "+" + flockF.count + " · " + fps.toFixed(0) + " fps · " +
          (ZC.Perf.live ? "LIVE" : (ZC.Perf._sim > 0 ? "SIM" : "rain")) +
          " · breath " + "▮".repeat(Math.round(ZC.Perf.breath * 10)).padEnd(10, "▯") +
          " · water " + "≋".repeat(Math.max(0, Math.round(en * 6))).padEnd(6, "·") +
          (echoQ.length ? " · echoes " + echoQ.length : "") +
          (ZC.Pacemaker.confidence > 0.35 ? "  ·  you " + ZC.Pacemaker.bpm.toFixed(0) + "bpm" +
            (ZC.Pacemaker.confidence > 0.7 ? " FOLLOWING" : " listening") : ""));
        H.line("engine", "cam " + CAMS[dial.cam] + " · " + (dial.spectral ? "SPECTRAL" : "moonlit") +
          (dial.genesis ? " · GENESIS" : "") + " · time " + dial.time.toFixed(2) +
          "× · ink " + dial.ink.toFixed(1) + " · petal " + dial.size.toFixed(1) + " · smear " + dial.smear.toFixed(1) +
          " · current " + flow.gain.toFixed(1) + " · mem " + (after.tau < 0.02 ? "off" : after.tau.toFixed(1) + "s") +
          " · waveLife " + state.waveLife + "s");
        if (ZC.Timbre.live) {
          const bar = (v) => "▮".repeat(Math.round(Math.min(1, v) * 6)).padEnd(6, "▯");
          H.line("audio", "VOICE " + ZC.Timbre.device.slice(0, 22) +
            " · body " + bar(ZC.Timbre.body) + " · shine " + bar(ZC.Timbre.brightness) + " · bite " + bar(ZC.Timbre.flux));
        }
        if (Lake.player) {
          const pl = Lake.player, mm = (x) => Math.floor(x / 60) + ":" + ("0" + Math.floor(x % 60)).slice(-2);
          H.line("midi", (ewiStatus ? ewiStatus + "  ·  " : "") + "track " + mm(pl.t) + "/" + mm(pl.duration) + (pl.playing ? " ▶" : " ⏸"));
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    /* ---- the duet + hands -------------------------------------------------- */
    Lake.player = null;
    Lake.loadMidi = (buf) => {
      const parsed = ZMI.parse(buf);
      Lake.player = ZMI.createPlayer(parsed, { loop: true });
      Lake.player.playing = true;
      return { notes: parsed.notes, duration: parsed.duration };
    };
    global.addEventListener("dragover", (e) => e.preventDefault());
    global.addEventListener("drop", async (e) => {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      try { const r = Lake.loadMidi(await f.arrayBuffer()); H.line("midi", "track loaded: " + f.name + " · " + r.notes + " notes"); }
      catch (err) { H.line("midi", "not a readable .mid: " + err.message); }
    });

    global.addEventListener("keydown", (e) => {
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
      if (e.code === "KeyB") ZC.Perf.sim(0.85);
      if (e.code === "Space") { throwStone(0, 0, 0.9); e.preventDefault(); }
      if (e.code === "KeyF") frog.on = !frog.on;                          // become the frog
      if (e.code === "KeyX") dial.cam = (dial.cam + 1) % 4;               // cycle cameras
      if (e.code === "KeyI") dial.ink = clamp(dial.ink + 0.15, 0, 3);
      if (e.code === "KeyK") dial.ink = clamp(dial.ink - 0.15, 0, 3);
      if (e.code === "KeyO") dial.moon = clamp(dial.moon + 0.2, 0.2, 3.5);
      if (e.code === "KeyL") dial.moon = clamp(dial.moon - 0.2, 0.2, 3.5);
      if (e.code === "Equal") dial.camRad = clamp(dial.camRad - 10, 55, 320);
      if (e.code === "Minus") dial.camRad = clamp(dial.camRad + 10, 55, 320);
      if (e.code === "BracketRight") dial.fov = clamp(dial.fov + 0.05, 0.5, 1.4);
      if (e.code === "BracketLeft") dial.fov = clamp(dial.fov - 0.05, 0.5, 1.4);
      if (e.code === "KeyP") dial.spectral = !dial.spectral;
      if (e.code === "KeyR") dial.genesis = !dial.genesis;
      if (e.code === "KeyW") dial.smear = clamp(dial.smear + 0.25, 0, 4);    // W/S — fluid smear
      if (e.code === "KeyS") dial.smear = clamp(dial.smear - 0.25, 0, 4);
      if (e.code === "KeyQ") flow.gain = clamp(flow.gain + 0.2, 0, 3);       // Q/Z — the current dial
      if (e.code === "KeyZ") flow.gain = clamp(flow.gain - 0.2, 0, 3);
      if (e.code === "KeyE") after.tau = clamp(after.tau < 0.15 ? 0.15 : after.tau * 1.3, 0, 6);   // E/D — memory glass
      if (e.code === "KeyD") { after.tau /= 1.3; if (after.tau < 0.15) after.tau = 0; }
      if (e.code === "KeyA" && !ZC.Timbre.live) {                            // A — arm the horn's voice
        H.line("audio", "asking for the audio input…");
        ZC.Timbre.arm(global.ZIG_VOICE, { split: !!global.ZIG_SPLIT }).then((ok) => H.line("audio",
          ok ? "VOICE LIVE — " + ZC.Timbre.device + (ZC.Timbre.L ? " · SPLIT L/R" : "") : "voice failed: " + ZC.Timbre.err));
      }
      if (e.code === "Digit0") { flock.seedSurface(LAKE, EXT * 0.88); flockD.seedSurface(DEEP, EXT * 0.8); }   // 0 — RE-POUR the lake
      if (e.code === "KeyU") dial.size = clamp(dial.size + 0.2, 0.5, 3.6);   // U/G — petal size
      if (e.code === "KeyG") dial.size = clamp(dial.size - 0.2, 0.5, 3.6);
      if (e.code === "KeyV") dial.mark = (dial.mark + 1) % 3;
      if (e.code === "KeyJ") dial.Kmax = clamp(dial.Kmax + 0.2, 0, 6);
      if (e.code === "KeyM") dial.Kmax = clamp(dial.Kmax - 0.2, 0, 6);
      if (e.code === "KeyY") dial.paceGain = clamp(dial.paceGain + 0.2, 0, 5);
      if (e.code === "KeyH") dial.paceGain = clamp(dial.paceGain - 0.2, 0, 5);
      if (e.code === "Comma") dial.time = clamp(dial.time / 1.15, 0.15, 1.6);
      if (e.code === "Period") dial.time = clamp(dial.time * 1.15, 0.15, 1.6);
      if (e.code === "KeyT" && Lake.player) Lake.player.toggle();
      if (e.code === "KeyC") { dial.camRad = 150; dial.fov = 1.05; camPhase = 0; }
      applyDials();
    });
    global.addEventListener("keyup", (e) => { if (e.code === "KeyB") ZC.Perf.sim(0); });
    canvas.addEventListener("pointerdown", (e) => {
      const r = canvas.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = 1 - ((e.clientY - r.top) / r.height) * 2;
      throwStone(nx * EXT * 0.6, -ny * EXT * 0.5, 0.85);
    });

    Lake.stage = "alive"; Lake.booted = true;
    H.line("status", "still water — play a note to throw a stone · F to become the frog");
    return { ok: true, flock };
  };

})(typeof window !== "undefined" ? window : globalThis);

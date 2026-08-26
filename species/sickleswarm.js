/* =============================================================================
   SICKLE FIELD — species/sickleswarm.js · v0.1
   6000 letterforms in the dark. The face-swarm, printed.

   Born from Bill's observation (2026-07-18): the bird swarm grew FACES under
   EWI breath — orientation patches + tonal flips + edge line-work = pareidolia
   as a performable channel. The sickle-petal (ZigMesh) is the letter designed
   to maximize that alphabet; this species is the printing press.

   Load order:
     <script src="engine/zigcore.js"></script>
     <script src="engine/zigmesh.js"></script>
     <script src="engine/zigwebgpu.js"></script>
     <script src="species/sickleswarm.js"></script>

   MEANINGS (all six numbers of the letter itself come from the turntable —
   when Bill approves new numbers there, they drop into PETAL below):
     breath  → cohesion swell (engine law) — the field gathers as you play
     attack  → agitation + iridescent flash riding the contagion wave
     strike  → impulse wavefront; every mid-turn shard glows a hue the
               settled field lacks (the wave is VISIBLE as iridescence)
     bend    → the whole field leans
     silence → Climate/Temperament drift; the night never repeats
   ========================================================================== */
(function (global) {
  "use strict";
  const ZC = global.ZigCore, ZG = global.ZigWebGPU, ZM = global.ZigMesh, ZMI = global.ZigMidi;

  const SEED = 0x51CC;
  const COUNT = (+global.ZIG_COUNT > 0) ? Math.min(20000, +global.ZIG_COUNT | 0) : 6000;   // fewer = bigger, more legible individual shapes (a shape-browsing field)
  const SIZEK = (+global.ZIG_SIZE > 0) ? +global.ZIG_SIZE : 1;                              // shard size multiplier — crank it to make each letterform big enough to read
  const EXT = 130, EXTY = 130;
  const ANCHOR = [0, 62, 0];
  /* the approved letterform — retune on the turntable, paste numbers here */
  /* the letter is CONFIGURATION: the page may set window.ZIG_LETTER to any
     ZigMesh preset name (sicklePetal · ribbon · ember · woodblock · halo) */
  const LETTER = global.ZIG_LETTER || "sicklePetal";
  const PETAL = Object.assign({}, ZM && ZM.presets[LETTER] ? ZM.presets[LETTER] : {});

  const Sickle = global.SickleField = { version: "0.31.0", flock: null, gpu: null, stage: "loaded", booted: false };   // 0.28: MEDIUM · 0.29: FORCES · 0.30: ENVIRONMENT·CURRENT (ZIG_CURRENT drift/gyre/eddy — the world's flow the field rides, composes with medium+forces)   // 0.26: note-impulse + MIDI monitor + ribbon-off bugfix · 0.27: SMOKE/FOG (ZIG_SMOKE — breath lifts & billows luminous puffs, notes puff bursts, silence thins them)   // 0.25: melodic ribbon (shelved) · 0.26: NOTE-IMPULSE (ZIG_NOTEPULSE — each note is a nerve pulse traveling through the organism, flaring the tissue; energy of the notes INTO the body)   // 0.24.1: fly dolly smoothed · 0.25: MELODIC RIBBON (ZIG_RIBBON — pitch draws a glowing streamer through the field; the note-twin of breath, so the ribbon of notes finally has a body)
  /* v0.2 — THE PULSE: the ZigPhase heartbeat in the spectral register.
     Every stroke carries a blink oscillator; breath = coupling. In spectral
     ink (P), the flash is a surge of pure rainbow — six thousand color-
     strokes falling into one rhythm under the performer's lungs. */

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

  Sickle.boot = async function (canvas, hudEl) {
    const H = hud(hudEl);

    Sickle.stage = "asking for a WebGPU adapter";
    H.line("status", "asking the browser for a WebGPU adapter + device…");
    if (!global.navigator || !navigator.gpu) {
      H.pill(false, "navigator.gpu missing — use Chrome/Edge; check chrome://gpu");
      H.line("status", "gate closed"); return { ok: false };
    }
    let gpu;
    try { gpu = await withTimeout(ZG.init(canvas, { msaa: (global.ZIG_MSAA !== false) }), 10000, "adapter/device request"); }   // RENDER SCALE: #msaa=off
    catch (e) {
      const m = (e && e.message) || String(e);
      H.pill(false, m);
      H.line("status", /OUTOFMEMORY|OutOfMemory/i.test(m)
        ? "GPU is full — CLOSE the other Zigverse tabs (each keeps its world alive), then reload"
        : "gate closed — fix WebGPU, then reload");
      return { ok: false, reason: m };
    }
    H.pill(true, gpu.probe.desc);
    Sickle.gpu = gpu;
    gpu.device.lost.then((i) => { H.pill(false, "device lost: " + (i.message || i.reason)); H.line("status", "gate re-closed — reload the node"); });

    Sickle.stage = "waking ZigCore";
    let ewiStatus = "";
    /* BREATH RESPONSE — how hard you must blow to light the field up. The engine
       maps breath = pow(breathRaw·GAIN, CURVE). GAIN>1 lets lower pressure reach
       full; CURVE<1 is a concave gamma that lifts the low/mid (touch, not force).
       True silence still maps to 0 (pow(0,·)=0), so breath-to-zero transitions hold.
       Loosened defaults so a comfortable, sustainable breath lights it; dial via
       ZIG_BREATHGAIN / ZIG_BREATHCURVE / ZIG_BREATHSMOOTH. */
    const BGAIN   = global.ZIG_BREATHGAIN   !== undefined ? +global.ZIG_BREATHGAIN   : 1.6;   // >1 = lights up at lower pressure
    const BCURVE  = global.ZIG_BREATHCURVE  !== undefined ? +global.ZIG_BREATHCURVE  : 0.65;  // <1 = touchy (lifts low/mid) · 1 = linear · >1 = top headroom
    const BSMOOTH = global.ZIG_BREATHSMOOTH !== undefined ? +global.ZIG_BREATHSMOOTH : 7;     // response lag (higher = snappier)
    ZC.Perf.init({ idle: true, anyCC: !!global.ZIG_ANYCC, gain: BGAIN, curve: BCURVE, smooth: BSMOOTH, onStatus: (s) => { ewiStatus = s; H.line("midi", s); } });   // ZIG_ANYCC=1 → map ANY continuous controller to breath (recovers an EWI whose breath rides an unrecognized CC)
    ZC.Drive.init({ depth: 8 });
    ZC.Climate.init(SEED);
    ZC.Temperament.init(SEED);
    ZC.Turnover.init(SEED, { slots: 2, interval: 150, departSec: 18, returnSec: 14, reach: 2.6 });
    ZC.Pacemaker.init();

    Sickle.stage = "growing the letterform + compiling the kernel";
    H.line("status", "growing the letterform · compiling the kernel…");
    /* ZIGFLOW (engine v0.8 · 2026-07-21): the world gets AIR before it gets
       wings. One shared current grid — breath brews the weather, gong waves
       stir swirls that outlive the ring, the avatar drags a wake. Both
       strata ride the same medium: the deep hears the horn only through the
       atmosphere the whole world shares. F = more wind · G = less. */
    const flow = ZG.createFlow(gpu, { extent: EXT, extentY: EXTY, cell: 8 });
    Sickle.flow = flow;
    /* THE MEMBRANE (engine v0.10 · page config ZIG_SKIN): an invisible
       elastic sphere lives at the anchor. The flock never chases it — it
       inherits its local geometry, and the audience discovers the surface.
       Breath changes ELASTICITY (the weather), strikes are disturbances
       that travel, and the surface remembers what it has lived. */
    const skin = global.ZIG_SKIN ? ZG.createMembrane(gpu, { center: [ANCHOR[0], ANCHOR[1], ANCHOR[2]], radius: 34 }) : null;
    Sickle.skin = skin;
    const RESMODE = global.ZIG_RESERVE || "color";   // "coherence": spends buy AGREEMENT, not brightness
    /* COLOR ECOLOGY (page config ZIG_ECOLOGY = material name · ZigCore v0.6):
       the world stops HAVING colors and starts OCCUPYING them over time.
       Material is the substance; Mood tints it; the Reserve decides when the
       rainbow is allowed to explode. ZIG_MINT = letterform refinement. */
    const ECO = global.ZIG_ECOLOGY ? (ZC.Materials[global.ZIG_ECOLOGY] || ZC.Materials.pearl) : null;
    /* THE ORCHARD (Scout, 2026-07-21 · page config ZIG_BIOME="orchard"):
       one color range, explored as a WORLD. Eight oranges, no two alike —
       every letter born ONE note; the population drifts through the family
       over ~10 minutes (temperature drift); breath gilds the leading edges
       with burnished copper; the Reserve reveals ember. */
    const BIOMES = {
      orchard: { drift: 8 / 600, names: ["apricot", "peach", "honey", "amber", "copper", "persimmon", "rust", "ember"], notes: [
        { dark: [0.295, 0.140, 0.062], light: [0.980, 0.720, 0.460] },   // apricot — almost edible
        { dark: [0.320, 0.128, 0.070], light: [0.985, 0.655, 0.415] },   // peach
        { dark: [0.340, 0.180, 0.040], light: [0.965, 0.740, 0.300] },   // honey — light passes through
        { dark: [0.300, 0.140, 0.030], light: [0.940, 0.615, 0.200] },   // amber — mineral begins
        { dark: [0.255, 0.100, 0.040], light: [0.880, 0.480, 0.220] },   // copper — geological
        { dark: [0.300, 0.088, 0.030], light: [0.955, 0.475, 0.160] },   // persimmon
        { dark: [0.215, 0.078, 0.040], light: [0.720, 0.340, 0.140] },   // rust — age, history
        { dark: [0.160, 0.040, 0.018], light: [0.990, 0.420, 0.100] }    // ember — the brightest point is inside
      ] }
    };
    const BIOME = global.ZIG_BIOME ? (BIOMES[global.ZIG_BIOME] || null) : null;
    /* MATERIAL LAW in the field: the composition profile wears its texture on the letters,
       separable from palette (ecology/biome) so any color can wear any grain. RESOLVED BELOW,
       after the world is known — an explicit SURFACE pick wins, else a named world wears its
       NATIVE skin (the world shapes the surface, not just the motion). See matName. */
    const SEEK_ON = (global.ZIG_SEEK != null && global.ZIG_SEEK !== false);   // ZIGSEEK: chase an attractor / flee a repulsor (demo drives a lure)
    const ATTACH_ON = (global.ZIG_ATTACH != null && global.ZIG_ATTACH !== false);   // ZIGATTACH: freeze the field into a held pose (Z toggles) / melt back
    const SOLO_START = (global.ZIG_SOLO != null && global.ZIG_SOLO !== false);   // SOLO: breath is the ONLY pulse — no idle auto-breath, no ambient churn, breath acts uniformly (no traveling wave). U toggles.
    const SPECTRUM_ON = (global.ZIG_SPECTRUM != null && global.ZIG_SPECTRUM !== false);   // ZIGSPECTRUM: order the thin-film hue ALONG the letter (base→tip) instead of scattering it. Q rotates the wheel live.
    const HUEROT0 = (global.ZIG_HUEROT !== undefined ? +global.ZIG_HUEROT : 0);           // starting rotation (0..1 around the wheel — which colors land at base vs tip)
    const HUESPAN0 = (global.ZIG_HUESPAN !== undefined ? +global.ZIG_HUESPAN : 1.0);       // how much of the wheel runs base→tip (1 = a full rainbow along each blade · 0.35 = a gentle two-tone)
    const SMEAR0 = (global.ZIG_SMEAR !== undefined ? +global.ZIG_SMEAR : 0.6);             // FLUID SMEAR: each blade STRETCHES along its own motion → fast = brushstrokes, still = petals. THE infinite-shapes magic (no two read alike). 0 = rigid stamps.
    const GLINT0 = (global.ZIG_GLINT !== undefined ? +global.ZIG_GLINT : 0.5);             // moonpath half-vector sparkle — glitter where a blade's tilt agrees with the moon
    const GLOW0 = (global.ZIG_GLOW !== undefined ? +global.ZIG_GLOW : 1.0);                // brightness FLOOR (×): the steady light the field HOLDS regardless of breath. Raise it to keep the colours lit while you play.
    const LUMEN0 = (global.ZIG_LUMEN !== undefined ? +global.ZIG_LUMEN : 1.0);             // breath→brightness SWING (×): how much a blow changes brightness. LOW = colours stay ~constant brightness → your breath data drives SHAPE (smear/reveal/motion), not glare. More room to sculpt.
    const REVEAL0 = (global.ZIG_REVEAL !== undefined ? +global.ZIG_REVEAL : 0);            // REVEAL WINDOW: each blade shows only a base→frontier FRAGMENT (its own amount) that unfurls with motion/breath → a drift of letter-fragments, never 100% of a glyph. 0 = whole letters. needs a wardrobe rack.
    const TRANSMIT0 = (global.ZIG_TRANSMIT !== undefined ? +global.ZIG_TRANSMIT : 0);       // OPTICS · LUMINESCENCE: backlit transmission — thin blades GLOW FROM WITHIN where the moon sits behind them (light passes through). number = glow gain. 0 = reflective only.
    const SHEEN_ON = (global.ZIG_SHEEN != null && global.ZIG_SHEEN !== false);              // OPTICS · ANISOTROPIC SHEEN: the highlight sweeps ALONG each blade's length as it twists (silk/petal-grain) instead of a round dot. rides the glint channel (ZIG_GLINT gain).
    const WEB_ON  = (global.ZIG_WEB === true) || (+global.ZIG_WEB > 0);                      // WEB: connective filaments between neighbouring letters (grid K-NN → drawn threads). ZIG_WEB=0/false/absent = OFF (fixed: 0 was read as on).
    const WEB_K   = Math.max(1, Math.min(8, (+global.ZIG_WEBK | 0) || 4));                   // threads per letter (K nearest)
    const WEB_RAD = +global.ZIG_WEBRAD || 15;                                                // max thread length (world units) — beyond it neighbours don't connect
    const WEBENERGY_ON = (global.ZIG_WEBENERGY === undefined) ? true : (+global.ZIG_WEBENERGY > 0);   // NOTE→WEB ENERGY (the blast): notes pour energy that conducts through the web. 0 = web stays a calm resting lattice, notes summon shapes only (no blast).
    const MEMBACK_COMPILED = (+global.ZIG_MEMBACK > 0);   // MEMORY UNDERSIDE compiled into the shader (Shift+M toggles it live); ZIG_MEMBACK=0/absent → not compiled (byte-identical)
    const AVATAR_ON = (global.ZIG_AVATAR === undefined) ? true : (global.ZIG_AVATAR === true || +global.ZIG_AVATAR > 0);   // AVATAR / BEACON: the lit lead shape (agent #0) that orbits apart. 0 = no beacon, no lone floating shape — just the field.
    /* CONTACT (2026-08-08) — matter that OCCUPIES SPACE. `separation` is a
       preference between neighbours and can be overpowered; where several shards
       bundle they end up in the same cubic space and smear into one translucent
       mass. This forbids it. Radius is in world units; keep it at or below the
       grid cell or the 3x3x3 walk could miss a neighbour. 0 = off, byte-identical. */
    const CONTACT_R = (+global.ZIG_CONTACT > 0) ? +global.ZIG_CONTACT : 0;
    /* CROWDING — how hard embedded shards are allowed to shove each other.
       The overlap force is unbounded and SUMS over neighbours, so a shard buried
       in twenty others was being kicked ten to fifty times harder than anything
       else in the world. Bill: "groups of shards embedded in each other deliver
       the most agitation." 0 = unbounded, the historical behaviour. */
    const CROWD_CAP = (+global.ZIG_SEPCAP > 0) ? +global.ZIG_SEPCAP : 0;
    /* ONSET (2026-08-08) — seconds for agitation to RISE. Contagion has always
       risen in one frame (a max()), which with agit driving vmax makes individual
       shards dart: Bill's "popcorn". Giving the rise a time constant makes the eye
       read the whole organism instead of the sparks. 0 = instant, historical. */
    const ONSET_S = (+global.ZIG_ONSET > 0) ? +global.ZIG_ONSET : 0;
    /* UNSEEN — the share of the flock that is present but not drawn. Keeps the
       crowd the emergent behaviours need while giving the eye a thinner field. */
    const UNSEEN_F = (+global.ZIG_UNSEEN > 0) ? Math.min(0.95, +global.ZIG_UNSEEN) : 0;
    /* THE BEE — peak charisma. 0 = the historical constant-5 avatar (byte-identical).
       BEE_IGNORE / BEE_FULL are the dwell seconds over which attention is earned. */
    const BEE = (+global.ZIG_BEE > 0) ? +global.ZIG_BEE : 0;
    const BEE_IGNORE = (+global.ZIG_BEEIGNORE > 0) ? +global.ZIG_BEEIGNORE : 0.28;
    const BEE_FULL = (+global.ZIG_BEEFULL > 0) ? +global.ZIG_BEEFULL : 1.9;
    /* PRESENCE (0.47) — the Bee's first behaviour. She was a costume: drawn
       larger, her own flash hue, a bigger lantern, and the compute kernel had
       never heard of her. Charisma already weighted her in the PHASE kernel, so
       she pulled the field's TIMING; this is the half that pulls their BODIES.
          window.ZIG_BEEMODE = "cozy" | "agitate"   ·   #beemode=agitate
       The MODE is Bill's decision and breath drives only the MAGNITUDE, so the
       same energy reaches both — a fierce cozy and a gentle agitation are each
       playable. Absent → not one character spliced into the kernel. */
    const BEEMODE = (function () {
      const h = (global.location && global.location.hash) || "";
      const m = h.match(/[#&]beemode=([a-z]+)/i);
      const v = String((m && m[1]) || global.ZIG_BEEMODE || "").toLowerCase();
      return (v === "cozy" || v === "agitate") ? v : null;
    })();
    const PRESENCE = (BEE > 0 && BEEMODE) ? { mode: BEEMODE } : null;
    let beeAttn = 0, beeHue = 0;
    /* NOTE FLASH — inside takes the note's colour, outside takes one. */
    const NOTEFLASH_ON  = (+global.ZIG_NOTEFLASH > 0);
    const NOTEFLASH_AMT = NOTEFLASH_ON ? Math.min(1, +global.ZIG_NOTEFLASH) : 0;
    const NOTEFLASH_TAU = (+global.ZIG_NOTEFLASHTAU > 0) ? +global.ZIG_NOTEFLASHTAU : 0.55;
    const NOTEFLASH_OUT = (global.ZIG_NOTEFLASHOUT != null) ? +global.ZIG_NOTEFLASHOUT : 0.58;

    /* THE CANON (ZigCore 0.13) — laws ship OFF. The host declares which ones
       apply and at what strength, and the URL hash overrides the host, so a
       configuration is A/B-able on eyeZ without a rebuild:
           window.ZIG_LAWS = { radiance: { room: "bright" } };   ·   #radiance=bright
       Declare nothing and this species is byte-identical to its pre-Canon self —
       which is what lets an APPROVED signature ride a newer engine unchanged. */
    const LAWS = (ZC.Canon && ZC.Canon.activate)
      ? ZC.Canon.activate(global.ZIG_LAWS, (global.location && global.location.hash) || "")
      : {};
    let RADIANCE = (ZC.Canon && ZC.Canon.law) ? ZC.Canon.law("radiance") : null;
    /* GROUND (Canon 0.1.0): the world's floor of light. Absent → `void`, which
       is today's near-black sky, rise compositing and no tone curve, and every
       shader emits byte-for-byte what it always has. A lit ground carries its
       own sky triple, its compositing mode AND the Radiance room that must
       accompany it — because a bright floor with an un-inverted body is the
       composition that sank the organism on 2026-08-17.
          window.ZIG_LAWS = { ground: { ground: "mist" } }   ·   #ground=mist   */
    const GROUND = (ZC.Canon && ZC.Canon.law) ? ZC.Canon.law("ground") : null;
    if (ZC.Canon && ZC.Canon.pairGroundToRadiance) RADIANCE = ZC.Canon.pairGroundToRadiance(RADIANCE);   // resolved {black,gain,gamma,knee} or null
    let noteHue = 0, noteFlash = 0;
    const VMIN_BASE = 0.35;   // the historical speed floor (knobsA[2]); STILLNESS scales this, so the base must survive the per-frame rewrite
    const STILLNESS = (global.ZIG_STILLNESS == null) ? 0 : Math.max(0, Math.min(1, +global.ZIG_STILLNESS));   // STILLNESS: how completely the field is allowed to REST when you stop playing. 0 = the historical cloud (a vmin speed floor + a churn field, neither of which ever listened to breath); 1 = both fade to nothing in silence.
    const SPREAD = (+global.ZIG_SPREAD > 0) ? +global.ZIG_SPREAD : 1;                      // SPREAD: neighbour separation multiplier — 1 is the historical field, higher lets bundled shards read as individual objects
    const FLY = (global.ZIG_FLY != null && global.ZIG_FLY !== false);                       // FLY THE CAMERA: the organism HOLDS at its anchor (stays on the page — no breath jump) and your breath instead dollies you IN and orbits you AROUND it. Breath moves the viewer, not the mass.
    const RIBBON_ON = +global.ZIG_RIBBON > 0;                                                // MELODIC RIBBON (a separate streamer object — shelved by default; ZIG_RIBBON=1 to bring it back). NOTE: numeric check — ZIG_RIBBON=0 now correctly means OFF.
    const NOTEPULSE = +global.ZIG_NOTEPULSE > 0;                                             // NOTE-IMPULSE: each note fires a nerve pulse from a pitch-placed point that travels THROUGH the organism — blades quicken & flare as it passes, then settle. The note's energy INTO the body (not a separate object).
    const SMOKE_ON = +global.ZIG_SMOKE > 0;                                                  // SMOKE / FOG: luminous drifting puffs the performance animates — breath LIFTS & BILLOWS them, each note PUFFS a burst, silence thins them. Atmosphere the organism lives inside, not an object beside it.
    /* ENVIRONMENT (Phase 2) — three elemental laws act on the matter: MEDIUM (viscosity),
       FORCES (gravity/buoyancy), CURRENT (flow), all inherited from ZigCore.Env. A named
       ZIG_WORLD resolves all three into one coherent PLACE via ZigCore.Worlds (the synthesis
       layer — amber, thermal, lakebed, the deep); otherwise each speaks on its own dial. */
    /* FRAME_H — the floor/ceiling the settled/gathered mass rests at, DERIVED from the
       viewing geometry so it matches Bill's frame instead of a guessed constant. The
       camera aims at the anchor from radius CAMR and ~8 above; a blow dollies it IN
       (rad·(1-0.55·breath)), which SHRINKS the visible window — so we size the bound at a
       representative performing dolly (~0.4 breath), take the vertical half-extent visible
       at the anchor plane (dist·tan(fov/2)), and pull in ~6 for blade spread/overshoot.
       Result: sink piles up at the bottom edge and float gathers at the top edge, filling
       the frame but never leaving it — even while you're blowing. (fov mirrors dial.fov.) */
    const CAMR = +global.ZIG_CAM || 54, CAMFOV = 1.02;
    const _perfRad = Math.max(11, CAMR * (1 - 0.55 * 0.40));
    const FRAME_H = Math.round(Math.hypot(_perfRad, 8) * Math.tan(CAMFOV / 2) - 6);   // ≈20 at CAMR 58, ≈18 at 54
    /* FORMATIVE WORLDS: a named place composes all three laws at once and takes precedence;
       when absent, the individual medium / force / current dials speak. FORCES' floor/ceil
       resolve to THIS species' frame either way (view geometry stays here). */
    const WORLD   = ZC.Worlds.get(global.ZIG_WORLD, FRAME_H);
    const MEDIUM  = WORLD ? WORLD.medium  : ZC.Env.medium(global.ZIG_MEDIUM);
    const FORCES  = WORLD ? WORLD.forces  : ZC.Env.force(global.ZIG_FORCES, FRAME_H);
    let CURRENT = WORLD ? WORLD.current : ZC.Env.current(global.ZIG_CURRENT);
    if (CURRENT && global.ZIG_GYREAXIS) CURRENT = { ...CURRENT, axis: global.ZIG_GYREAXIS };   // GYRE AXIS: roll the flow around a chosen axis ("x" = a horizontal cigar rolling broadside so it always presents its full width); default "y" is byte-identical
    /* BOUNDARY — the world's shape. Explicit ZIG_BOUNDARY wins (incl. "none" to strip walls);
       else a named world holds matter in its native shape (bowl/chimney/vessel). */
    const BOUNDARY = global.ZIG_BOUNDARY ? ZC.Env.boundary(global.ZIG_BOUNDARY, FRAME_H)
                                         : (WORLD ? WORLD.boundary : null);
    /* THE VITRINE (ZIG_STAGE): a floor with a soft pool of light beneath the organism —
       it reads as a lit specimen on a plinth in a dark room. Floor sits at the basin depth
       so the held mass settles onto it (grounds, doesn't levitate). ZIG_STAGE = pool gain. */
    const STAGE_ON = +global.ZIG_STAGE > 0;
    const stage = STAGE_ON ? { x: ANCHOR[0], y: ANCHOR[1] - FRAME_H * 1.05, z: ANCHOR[2],
                               r: FRAME_H * 7, pool: FRAME_H * 1.9, color: [0.16, 0.22, 0.34], gain: (+global.ZIG_STAGE || 1) } : null;
    /* MATERIAL — explicit SURFACE pick wins; else a named world wears its NATIVE skin; else none. */
    const matName = global.ZIG_MATERIAL || (WORLD ? WORLD.spec.skin : null);
    const MAT = matName ? (ZC.Materials[matName] || null) : null;
    const hrgb = (h) => [0.5 + 0.5 * Math.cos(6.2831 * h), 0.5 + 0.5 * Math.cos(6.2831 * (h + 0.33)), 0.5 + 0.5 * Math.cos(6.2831 * (h + 0.66))];   // hue(0..1) → rgb, matching the ZIGSPECTRUM palette
    const DUSK = global.ZIG_SKY === "dusk";   // late-afternoon California light: not the sun — everything the sun touches
    /* THE WARDROBE (engine v0.9 · page config ZIG_WARDROBE="seed,whisper,…"):
       several letters baked into ONE plate. N steps the field's letter live —
       same positions, same phases, same memory, new body. In ecology worlds
       a Reserve spend is a METAMORPHOSIS: a growing fraction of the field
       blossoms into the next letter for the length of the flash, then closes. */
    const WNAMES = global.ZIG_WARDROBE
      ? String(global.ZIG_WARDROBE).split(",").map((s) => s.trim()).filter((n) => ZM.presets[n])
      : [LETTER];
    /* NOTE→FORM register: the wardrobe ordered by visual WEIGHT (heavy/rooted → light/aerial).
       A note's pitch reads as the register of the body that emerges — biological, not notation:
       low notes summon heavy forms, high notes airy ones. REGIDX = wardrobe indices in that order. */
    const REG_ORDER = ["woodblock", "drop", "ember", "burr", "seed", "kite", "sail", "sicklePetal", "compass", "halo", "crook", "ribbon", "plume", "echo", "whisper", "thorn"];
    const REGIDX = REG_ORDER.filter((n) => WNAMES.indexOf(n) >= 0).map((n) => WNAMES.indexOf(n));
    const THICK = Math.max(0, +global.ZIG_THICKNESS || 0);   // THICKNESS: 0 = thin foil sheet · up = a solid lens (thick middle, sharp edges). Baked into the mesh (set on load).
    const HOLLOW = (+global.ZIG_HOLLOW > 0);                  // back curves as a concave SHELL (cupped underside) instead of a convex lens
    const AMBIENCE_ON = (global.ZIG_AMBIENCE != null && global.ZIG_AMBIENCE !== false && +global.ZIG_AMBIENCE !== 0);   // ATMOSPHERE BUS: the processed SOUND drives the environment (colour temp · mist · afterglow) while MIDI drives the body. Synth-sourced until the audio cabling is live. Byte-identical when off.
    const STRATA_ON = (global.ZIG_STRATA != null && global.ZIG_STRATA !== false && +global.ZIG_STRATA !== 0);   // MELODIC STRATA: each EWI note blooms a band of light at its pitch-height, fading over time — the melody written on the body's vertical axis. Byte-identical when off.
    const STRATA_DEMO = (+global.ZIG_STRATADEMO > 0);   // auto-play a deterministic demo melody when no live MIDI (for demos only); off = strata responds to REAL notes only
    let strataSynthT = 0, strataSeq = 0;
    /* GEM MATERIAL — the shard becomes a cut stone (ZigCore.Gems: diamond, ruby, sapphire, …).
       ZIG_GEM = gem name; ZIG_GEMHUE overrides its body colour (0..1 wheel). */
    let GEMPROF = null;
    {
      const G = (ZC.Gems || {})[(global.ZIG_GEM || "").toLowerCase()];
      if (G) {
        let col = G.col.slice();
        if (global.ZIG_GEMHUE !== undefined) {
          const gh = +global.ZIG_GEMHUE, hc = (p) => 0.5 + 0.5 * Math.cos(6.2831 * (gh + p));
          const hr = hc(0), hg = hc(0.3333), hb = hc(0.6667), mn = Math.min(hr, hg, hb);
          col = [(hr - mn) * 0.85 + 0.1, (hg - mn) * 0.85 + 0.1, (hb - mn) * 0.85 + 0.1];
        }
        GEMPROF = { col, ior: G.ior, disp: G.disp, facet: G.facet, spark: G.spark };
      }
    }
    /* FABRIC UNDERSIDE — a textile lining the concave interior (ZigCore.Fabrics: velvet, silk,
       denim, …20). ZIG_BACKMAT = fabric name · ZIG_BACKHUE overrides its colour (0..1 wheel). */
    let BACKFAB = null;
    {
      const FABS = ZC.Fabrics || {};
      const fn = (global.ZIG_BACKMAT || "").toLowerCase();
      const F = FABS[fn];
      if (F) {
        const bh = (global.ZIG_BACKHUE !== undefined) ? +global.ZIG_BACKHUE : (F.hue != null ? F.hue : 0.98);
        const huec = (ph) => 0.5 + 0.5 * Math.cos(6.2831 * (bh + ph));
        const hr = huec(0), hg = huec(0.3333), hb = huec(0.6667), mn = Math.min(hr, hg, hb);
        const sat = (F.sheen === "metal") ? 0.7 : 0.55;
        BACKFAB = { weave: F.weave, wscale: F.wscale, wdepth: F.wdepth, sheen: F.sheen, spow: F.spow,
                    sgain: (+global.ZIG_BACKGAIN || F.sgain), base: F.base,
                    col: [(hr - mn) * sat + 0.02, (hg - mn) * sat + 0.02, (hb - mn) * sat + 0.02] };
      }
    }
    const mesh = WNAMES.length > 1
      ? WNAMES.map((n) => ZM.make(ZM.presets[n], { refine: global.ZIG_MINT || 1, thickness: THICK, hollow: HOLLOW }))
      : ZM.make(PETAL, { refine: global.ZIG_MINT || 1, thickness: THICK, hollow: HOLLOW });
    const flock = ZG.createFlock(gpu, {
      ground: GROUND || undefined,   // GROUND: a sceneless build still has a floor of light
      contact: CONTACT_R > 0 ? { r: CONTACT_R, k: 45, damp: 4, max: 12 } : null,
      onset: ONSET_S,
      sepCap: CROWD_CAP > 0 ? { pair: 0.55, total: CROWD_CAP } : null,
      unseen: UNSEEN_F,
      noteFlash: NOTEFLASH_ON,
      radiance: RADIANCE || undefined,   // RADIANCE (Canon 0.1.0): absent → not one character of the law's WGSL is emitted
      bee: BEE > 0 ? 1.45 : 1,   // agent #0 drawn larger when the bee is live
      presence: PRESENCE || undefined,   // PRESENCE: the field feels her (cozy = drawn in · agitate = driven off)
      max: 20000, count: COUNT, seed: SEED,
      extent: EXT, extentY: EXTY, cell: 12, debris: 0,
      mesh,                                      // ← ZigMesh wears the kernel
      phase: {},                                 // ← ZigPhase: the letters learn rhythm
      flow,                                      // ← ZigFlow: the letters ride the wind
      biome: BIOME || undefined,                 // ← BIOME: born colors (the Orchard law)
      material: MAT || undefined,                // ← MATERIAL: composed surface (grain/weather/subsurface)
      medium: MEDIUM || undefined,               // ← ENVIRONMENT · MEDIUM: the world's viscosity (air/water/honey)
      forces: FORCES || undefined,               // ← ENVIRONMENT · FORCES: gravity/buoyancy (sink/float/suspend)
      current: CURRENT || undefined,             // ← ENVIRONMENT · CURRENT: the world's flow (drift/gyre/eddy)
      boundary: BOUNDARY || undefined,           // ← ENVIRONMENT · BOUNDARY: the world's shape holds it in (basin/column/vessel)
      stage: stage || undefined,                 // ← EXPERIENCE · STAGE: the vitrine floor + pool of light (voyeur framing)
      skin: skin || undefined,                   // ← MEMBRANE: the letters reveal elastic space
      rest: (global.ZIG_REST != null) ? global.ZIG_REST : false,  // ← ZIGLIFE: rest/wake. number = starting arousal (low = starts asleep)
      seek: SEEK_ON || undefined,                // ← ZIGSEEK: the field can chase an attractor / flee a repulsor
      attach: ATTACH_ON || undefined,            // ← ZIGATTACH: the field can freeze into a held pose and melt back
      fatigue: (global.ZIG_FATIGUE != null && global.ZIG_FATIGUE !== false) || undefined,  // ← ZIGMETABOLISM: stamina — drives to exhaustion, recovers at rest/breath/huddle
      aging: (global.ZIG_AGING != null && global.ZIG_AGING !== false) || undefined,        // ← ZIGAGE: a lifespan clock — generations are born, mature, fade, renew
      formField: global.ZIG_FORM || undefined,   // ← FORM FIELD: a per-agent signal ("biome"/"age"/"energy") picks the letter from the wardrobe rack — form expresses state
      ribbon: RIBBON_ON ? 160 : undefined,       // ← MELODIC RIBBON: max spine points — the pitch contour draws a glowing streamer through the field
      smoke: SMOKE_ON ? 240 : undefined,         // ← SMOKE / FOG: luminous puffs the breath lifts & the notes puff — atmosphere through the body
      spectrum: SPECTRUM_ON || undefined,        // ← ZIGSPECTRUM: order the thin-film hue ALONG the letter (base→tip), Q-rotatable
      reveal: REVEAL0 || undefined,              // ← REVEAL WINDOW: each blade a base→frontier fragment that unfurls with motion (never 100% of a letter)
      transmit: TRANSMIT0 || undefined,          // ← OPTICS · LUMINESCENCE: thin blades glow from within where backlit
      sheen: SHEEN_ON || undefined,              // ← OPTICS · ANISOTROPIC SHEEN: highlight sweeps along the blade's length as it twists
      web: WEB_ON ? { k: WEB_K, radius: WEB_RAD, width: 0.5 } : undefined,  // ← WEB: connective filaments between neighbouring letters (breath strings the web)
      memoryBack: (+global.ZIG_MEMBACK > 0) || undefined,  // ← MEMORY UNDERSIDE: the 2nd performance surface — back faces glow with a lagging ghost of the phrase (front=now, back=recent past)
      backFabric: BACKFAB,                                 // ← FABRIC UNDERSIDE: the concave interior lined in a textile (20 in ZigCore.Fabrics)
      gem: GEMPROF,                                         // ← GEM MATERIAL: the shard becomes a cut stone (refraction/dispersion/fresnel/facet), sampling the sky
      gemFace: (["both", "inside", "outside"].indexOf(String(global.ZIG_GEMFACE || "both")) >= 0 ? String(global.ZIG_GEMFACE || "both") : "both")   // SEASHELL: "inside" = gem lines the cupped interior, material stays the outside
    });   // CHIAROSCURO is a LIVE uniform now (view[76]), driven by dial.chiaro + keys 1/2
    flock.seed(ANCHOR);
    flock.seedPhase(4.4, 0.25);
    Sickle.flock = flock;

    /* UNDER-ROW → THE RESONATOR (page config ZIG_UNDERROW · 2026-07-20):
       the deep stratum is not a second dancer — it is the instrument's BODY.
       Woodblocks with no clock (no phase law), no breath, no light of their
       own (voice 0). They ring ONLY when a gong wave from the halo field
       reaches down and strikes them (~1s late — spherical fronts, free),
       borrow that strike's color, and fade 5× slower than the halos above.
       Embodiment: the deep owns nothing it wasn't handed by a wave.        */
    let scene = null, flockB = null;
    if (global.ZIG_UNDERROW) {
      scene = ZG.createScene(gpu, { sky: true, ground: GROUND || undefined });
      flockB = ZG.createFlock(gpu, {
        ground: GROUND || undefined,
        contact: CONTACT_R > 0 ? { r: CONTACT_R, k: 45, damp: 4, max: 12 } : null,
        onset: ONSET_S,
        sepCap: CROWD_CAP > 0 ? { pair: 0.55, total: CROWD_CAP } : null,
        unseen: UNSEEN_F,
        noteFlash: NOTEFLASH_ON,
        radiance: RADIANCE || undefined,
        bee: BEE > 0 ? 1.45 : 1,   // agent #0 drawn larger when the bee is live
        presence: PRESENCE || undefined,   // PRESENCE: the field feels her (cozy = drawn in · agitate = driven off)
        max: 8000, count: 2600, seed: SEED ^ 0xB10C,
        extent: EXT, extentY: EXTY, cell: 12, debris: 0,
        mesh: ZM.make(ZM.presets.woodblock),         // no phase — a body, not a voice
        flow                                         // the deep breathes the same air
      });
      scene.add(flock); scene.add(flockB);
      flockB.seed([ANCHOR[0], ANCHOR[1] - 26, ANCHOR[2]]);
      Sickle.flockB = flockB;
    }

    /* THE MEMORY GLASS (engine v0.7.1 · Bill's contrail verdict 2026-07-21):
       the glass remembers FLASHES, not flight — a luminance gate keeps
       ordinary moving bodies crisp (zero contrails) while tolls, strikes and
       glints leave slow ghosts. Gong worlds wake remembering (τ 2.2); the
       plain field wakes CRISP (τ 0 = memory off — E dials it in when wanted).
       E = longer · D = shorter (τ < 0.15 s snaps OFF). */
    const after = ZG.createAfterimage(gpu, {
      tau: global.ZIG_FX === "gong" ? 2.2 : 0,
      /* GROUND: on a lit floor the gate is a DISTANCE from the ground, not a
         luminance ceiling — a luminance gate on a pale field keeps the empty
         sky at 1.000 and the organism at 0.000, so the world remembers its own
         emptiness. The ground supplies its own threshold; void keeps 0.48. */
      gate: (GROUND && GROUND.compose === "signed" && GROUND.gateAt !== undefined) ? GROUND.gateAt : 0.48,
      ground: GROUND || undefined
    });
    if (scene) scene.attachAfterimage(after); else flock.attachAfterimage(after);
    Sickle.after = after;

    const taps = new Float32Array(64);
    const wanderers = new Float32Array(16), wmeta = new Float32Array(16);
    const impulses = [];
    for (let i = 0; i < 8; i++) impulses.push({ o: [0, 0, 0], t0: -1, strength: 0 });
    let impPtr = 0;

    const state = {
      dt: 0, time: 0, breath: 0, bend: 0, attack: 0, energy: 0,
      waveSpeed: 30, waveWidth: 8,
      agitAmbient: 0.10,
      /* SPREAD (2026-08-07) — how hard neighbours hold each other off. At the
         default the shards CROWD, and where several bundle they stop reading as
         objects and smear into one translucent mass (Bill, 2026-08-07). Raising
         separation lets each plate keep its own space so edges, orientation and
         depth stay legible. `ZIG_SPREAD` is a multiplier on the separation weight
         AND its radius; absent or 1 is byte-identical to every build before this.
         The real answer is `Contact` in the compute pass — matter that occupies
         space rather than merely preferring to; this is the dial that exists now. */
      cohW: 0.55, sepW: 3.2 * SPREAD, aliW: 0.4,
      anchor: [ANCHOR[0], ANCHOR[1], ANCHOR[2], 0],   // breath-lift DISCONNECTED (2026-07-19) — no bouncing; breath speaks as light/form, not altitude
      refpt: [0, ANCHOR[1], 0, 6],
      wind: [0, 0, 0],
      knobsA: [0.5, 3.6 * Math.min(SPREAD, 1.9), 0.35, 4.2],     // contagion · sepRadius (SPREAD-scaled, capped so the grid stays sane) · vmin · vmaxBase
      knobsB: [8, 26, 0.85, 0.9],        // vmaxAgit · waveKick · bankGain↑ (rolls flip the letters) · churn
      impulses, taps, wanderers, wmeta,
      medium: 1,                          // hover — still night air on the water law
      K: 0, tempo: 1, ignite: 2.4,        // ZigPhase levers
      pacePhase: 0, pacePull: 0,          // Pacemaker (the performer's clock)
      /* AVATAR — Bill embodied as letterform #0. yzw = steer target;
         avatarB = [steer, flash-now, agit burn, charisma] */
      avatarA: [0, ANCHOR[0], ANCHOR[1], ANCHOR[2]],
      avatarB: [0.85, 0, 0.1, 5],
      center: ANCHOR, breathPush: 0,
      letter: 0, letterB: 0, mix: 0,                    // WARDROBE: which body the field wears
      drift: 0                                          // BIOME: the orchard's slow season
    };
    if (!AVATAR_ON) { state.avatarA[0] = -1; state.avatarB[0] = 0; }   // no beacon: agent 0 stays in the flock, no lone lit shape orbiting apart

    /* FX "gong" (Halo Field): echo translated into AIR — temporal, not
       spatial. Strikes travel 10s, push gently, yank phase hard: the front
       leaves synchronized TOLLING in its wake. Rings that ring. */
    if (global.ZIG_FX === "gong") {
      state.waveLife = 10; state.waveSpeed = 22;
      state.knobsB[1] = 16;                     // soft shove
      state.knobsB[2] = 1.1;                    // deeper rolls — coins spin in the wake
      state.ignite = 3.4;                       // the toll
    }

    const stateB = !flockB ? null : Object.assign({}, state, {
      anchor: [ANCHOR[0], ANCHOR[1] - 26, ANCHOR[2], 0],
      wanderers: new Float32Array(16), wmeta: new Float32Array(16),
      avatarA: [-1, 0, ANCHOR[1] - 26, 0], avatarB: [0, 0, 0, 0],
      center: [ANCHOR[0], ANCHOR[1] - 26, ANCHOR[2]],
      /* THE RESONATOR — everything self-generated is zeroed. The deep hears
         ONLY what the shared impulse queue carries down to it: no breath, no
         delay-taps, no Kuramoto, no pacemaker, no ambient restlessness. */
      voice: 0,                              // engine v0.6: dark body · slow agit drain
      breath: 0, attack: 0, energy: 0,
      agitAmbient: 0, K: 0, tempo: 0, ignite: 0, pacePull: 0,
      taps: new Float32Array(64),            // its own SILENT taps — breath never leaks down
      knobsA: [0.85, 3.6, 0.10, 1.2],        // contagion UP (a body conducts) · near-still drift
      knobsB: [3, 16, 0.85, 0.25]            // gentle surge when rung · soft shove · low churn
    });

    Sickle.strike = function (x, y, z, strength) {
      const im = impulses[impPtr]; impPtr = (impPtr + 1) % 8;
      im.o = [x, y, z]; im.t0 = state.time; im.strength = strength || 0.85; im.kick = 1;   // full shove — the falcon strike
      state.refpt = [x, y, z, state.refpt[3]];
      if (ECO || BIOME) ZC.Reserve.event("strike", strength || 0.85);   // the bell rings — the treasury decides if amber answers
      if (skin) skin.poke(x, y, z, strength || 0.85);                   // a disturbance enters the surface — and TRAVELS
    };
    /* NOTE-IMPULSE: a nerve pulse from a pitch-placed point — it FLARES the tissue
       as it travels (full strength → agit/iridescence) but barely SHOVES (low kick).
       No refpt move / Reserve / skin poke → it never yanks the frame; it just lights
       and quickens the body from within. The energy of the note, INTO the organism. */
    const noteImpulse = (x, y, z, strength, kick) => {
      const im = impulses[impPtr]; impPtr = (impPtr + 1) % 8;
      im.o = [x, y, z]; im.t0 = state.time; im.strength = strength; im.kick = kick;
    };

    /* View — night palette. In shard mode: birdDark = moss dome ·
       birdLight = bone hollow · sunCol = moonlight. */
    const view = new Float32Array(112);  // +render6 (view[108..111] note flash, v0.43) · +render4 (view[76] chiaroscuro) · +render5 (view[80] rim) · +noteBands[6] (view[84..107] melodic strata)
    const setV4 = (o, a, b, c, d) => { view[o] = a; view[o + 1] = b; view[o + 2] = c; view[o + 3] = d; };
    if (DUSK) {
      /* CALIFORNIA, LATE AFTERNOON: the sun rides LOW, the sky holds warm
         gray, the horizon burns quiet amber. Gray world, orange light. */
      setV4(32, 0.60, 0.16, -0.36, 0.10);        // low sun
      setV4(36, 0.028, 0.026, 0.040, 0.0);       // skyTop — cooling overhead
      setV4(40, 0.075, 0.050, 0.044, 0.0);       // skyMid — warm dust
      setV4(44, 0.235, 0.108, 0.045, 0.0);       // horizon — the amber line
      setV4(48, 0.020, 0.012, 0.008, 0.0);       // ground — umber
    } else {
      setV4(32, 0.35, 0.62, -0.30, 0.07);        // moon
      setV4(36, 0.003, 0.005, 0.014, 0.0);       // skyTop
      setV4(40, 0.007, 0.011, 0.024, 0.0);       // skyMid (also the haze color)
      setV4(44, 0.013, 0.020, 0.035, 0.0);       // horizon
      setV4(48, 0.004, 0.005, 0.008, 0.0);       // ground
    }
    /* GROUND (Canon 0.1.0) — THE FLOOR OF LIGHT, and the last word on the sky.

       Everything above authors a NIGHT. That was never a limitation of the
       engine: skyTop/skyMid/horizon have always been View uniforms, and
       `tools/ground_gap.mjs` proves the plumbing was complete. They had simply
       only ever been given dark values. A declared ground overwrites them.

       This is also the ONLY place the background truly changes. The clear
       colour is a fallback the sky paints over (fullscreen triangle, depth
       writes off, depthCompare "always"), so lifting the sky here is what
       actually lights the world — and because slot 40 doubles as the haze the
       fragment fogs toward, the medium lifts with it at no cost. */
    if (GROUND && GROUND.sky && GROUND.lift > 0) {
      const K = GROUND.sky;
      setV4(36, K.top[0], K.top[1], K.top[2], 0.0);   // skyTop
      setV4(40, K.mid[0], K.mid[1], K.mid[2], 0.0);   // skyMid — AND the haze target
      setV4(44, K.hor[0], K.hor[1], K.hor[2], 0.0);   // horizon
      setV4(48, K.mid[0] * 0.92, K.mid[1] * 0.92, K.mid[2] * 0.92, 0.0);   // ground plane, a shade under the sky
    }
    /* LIVE DIALS — start hot (the extremes hunt), tune with keys, read the
       numbers off the HUD when a sweet spot lands */
    const CAM0 = global.ZIG_CAM || 54;
    /* AUTO-FRAME (2026-08-10). A fixed camera distance is a promise about one
       screen. Measured on a 2560x1440 capture, the field was cropped on ALL FOUR
       EDGES while filling only 26% of the frame — badly placed AND too close, at
       the same time, which is what a fixed distance eventually gives you.
       The flock is measured occasionally and asynchronously (subsampled, never
       blocking), and `ZigCore.Frame.fit` turns its radius plus the CURRENT aspect
       into the distance that holds it. Aspect matters more than expected: a
       vertical fov means a wide window is generous horizontally and a tall one is
       not, so the binding axis SWAPS with the shape of the glass — which is
       exactly why a piece composed on one monitor is cropped on the next.
       ZIG_AUTOFRAME = 0 restores the hand-set camera. */
    const AUTOFRAME = (global.ZIG_AUTOFRAME === undefined) ? 1 : +global.ZIG_AUTOFRAME;
    const FRAME_MARGIN = (+global.ZIG_FRAMEMARGIN > 0) ? +global.ZIG_FRAMEMARGIN : 1.20;
    let measured = null, measureAcc = 0, autoRad = CAM0;
    /* + and - still work, but they now mean something better: a zoom RELATIVE to
       the frame the camera has chosen. The piece keeps composing itself and you
       keep the last word on how tight it sits. Replacing camRad with autoRad
       without this silently broke both keys — they went on adjusting a number
       nothing read any more, which is the same failure as a method on the wrong
       object: correct code, never consulted. */
    let frameZoom = 1.0;
    const dial = { ink: (global.ZIG_INK !== undefined ? +global.ZIG_INK : 1.8), moon: 1.6, camRad: CAM0, fov: 1.02, spectral: false, Kmax: 3.0, paceGain: 2.2, time: 0.55,
                   hueRot: HUEROT0, hueSpan: HUESPAN0,   // ZIGSPECTRUM: rotation around the wheel (Q) · base→tip span
                   shadowComp: (global.ZIG_SHADOWCOMP !== undefined ? +global.ZIG_SHADOWCOMP : 0),   // SHADOW COMPLEMENT (9/0): dark side → the material's complementary colour instead of black
                   hueSpread: (global.ZIG_HUESPREAD !== undefined ? +global.ZIG_HUESPREAD : 0),   // SPECTRUM SPREAD (7/8): 0 = one coherent band (Q sweeps it) → up = the WHOLE spectrum across the field at once
                   reveal: REVEAL0,   // REVEAL / WHOLENESS (5/6): low = tiny letter-fragments (the drift magic) → high = WHOLE letters (the N letterform-switch reads clearly)
                   webGain: (global.ZIG_WEBGAIN !== undefined ? +global.ZIG_WEBGAIN : (WEB_ON ? 0.6 : 0)),   // WEB (- =): filament visibility · webHue: their colour (rides Q with the wheel by default)
                   webHue: (global.ZIG_WEBHUE !== undefined ? +global.ZIG_WEBHUE : 0.57),
                   chiaro: Math.max(0, Math.min(1, +global.ZIG_CONTRAST || 0)),   // CHIAROSCURO (1/2 keys): 0 = soft full lighting → 1 = single-direction light, unlit side → black
                   rim: Math.max(0, +global.ZIG_RIM || 0),           // SILHOUETTE RIM (↑/↓): 0 = off → up = a bright fresnel edge re-draws each letter's outline against the void (legible under gem/fabric/skin, either face)
                   rimSharp: (global.ZIG_RIMSHARP !== undefined ? +global.ZIG_RIMSHARP : 3.0),   // RIM SHARPNESS (←/→): low = wide glow → high = thin, precise outline
                   memBack: (+global.ZIG_MEMBACK > 0) ? 1 : 0,   // MEMORY UNDERSIDE (Shift+M): the 2nd surface on/off
                   radiance: RADIANCE ? 1 : 0,   // RADIANCE (Shift+R): the live dial. 1 = the law applies · 0 = arithmetic identity, same shader, same frame — the A/B is against ITSELF, not against a memory of another build.
                   mark: (!AVATAR_ON ? 0 : (global.ZIG_MARK !== undefined ? global.ZIG_MARK : 2)),   // beacon marking off when the avatar is off
                   murmur: (global.ZIG_MURMUR !== undefined ? +global.ZIG_MURMUR : 0),   // 0 = calm field · →1.4 = one folding body (W/S)
                   genesis: (global.ZIG_GENESIS !== undefined ? !!global.ZIG_GENESIS : true), cockpit: false };
    const MOON = ECO ? ECO.moon.slice() : (DUSK ? [0.98, 0.60, 0.26] : [0.46, 0.53, 0.72]);
    /* THE BODY COLOUR — COMPOSE material + spectrum: the base pigment is now the SELECTED
       MATERIAL's own dark/light (the solid colour you judge in the Studio), so the field shows
       the skin's true colour. The ZIGSPECTRUM then rides OVER it on the grazing/turning parts,
       scaled by the ink dial (I/K) — so I/K is the solid↔rainbow amount, Q rotates the wheel.
       Falls back to the ecology palette, then the classic moss/bone, when no material is set. */
    const MOSS = MAT ? MAT.dark.slice()  : (ECO ? ECO.dark.slice()  : [0.085, 0.105, 0.060]),
          BONE = MAT ? MAT.light.slice() : (ECO ? ECO.light.slice() : [0.82, 0.79, 0.70]);
    const applyDials = () => {
      if (dial.spectral) {
        /* SPECTRAL INK — Bill's register (2026-07-19): black out the body and
           the moon so ONLY the iridescence survives. The petal vanishes; the
           TURNING remains. Every visible shape is an angle, not an object. */
        setV4(52, 0, 0, 0, 0);
        view[56] = 0; view[57] = 0; view[58] = 0;
        view[60] = 0; view[61] = 0; view[62] = 0;
        view[63] = 0.0015;                        // thinner haze — distant color survives
      } else {
        setV4(52, MOON[0] * dial.moon, MOON[1] * dial.moon, MOON[2] * dial.moon, 0.0);
        view[56] = MOSS[0]; view[57] = MOSS[1]; view[58] = MOSS[2];
        view[60] = BONE[0]; view[61] = BONE[1]; view[62] = BONE[2];
        view[63] = 0.0026;
      }
      view[74] = dial.ink;
      view[72] = dial.hueRot;                        // ZIGSPECTRUM: render3.x = hue rotation (Q walks it)
      view[73] = SPECTRUM_ON ? dial.hueSpan : 0;     // render3.y = base→tip span (0 keeps the legacy scatter untouched)
    };
    setV4(56, MOSS[0], MOSS[1], MOSS[2], 0.85);  // MOSS dome · w agent size
    setV4(60, BONE[0], BONE[1], BONE[2], 0.0026);// BONE hollow · w fog
    setV4(64, 2, 0, 0, 0);                       // render mode 2 = SHARD
    setV4(68, 0, 0, 0, 0);
    setV4(72, 0, 0, dial.ink, 0);                // z = iridescence gain — THE RAINBOW INK
    applyDials();

    let camPhase = 0, hPhase = 0, flyOrbit = 0, flyDolly = 0;  // C-key recenter offsets · flyOrbit = breath-driven walk around · flyDolly = SMOOTHED dolly (tracks the phrase, not each breath — no yo-yo)
    const aimP = [ANCHOR[0], ANCHOR[1], ANCHOR[2]];
    function camera(t, dt) {
      const aspectC = gpu.canvas.clientWidth / Math.max(1, gpu.canvas.clientHeight);
      if (dial.cockpit) {
        /* COCKPIT — the view FROM the lead petal. The field streams past;
           bend banks the horizon; your melody is the flight path. */
        const f = cpFwd, fov = 1.18;
        const eye = [cpPos[0] - f[0] * 1.2, cpPos[1] + 0.7 - f[1] * 1.2, cpPos[2] - f[2] * 1.2];
        const ro = -ZC.Perf.bend * 0.7;                    // bank into the bend
        let r0x = f[2], r0z = -f[0];
        const r0l = Math.hypot(r0x, r0z) || 1; r0x /= r0l; r0z /= r0l;
        const u0x = -r0z * f[1], u0y = r0z * f[0] - r0x * f[2], u0z = r0x * f[1];
        const upx = -u0x, upy = -u0y, upz = -u0z;          // engine up-convention
        const cr = Math.cos(ro), sr = Math.sin(ro);
        const rx2 = r0x * cr + upx * sr, ry2 = upy * sr, rz2 = r0z * cr + upz * sr;
        const ux2 = upx * cr - r0x * sr, uy2 = upy * cr, uz2 = upz * cr - r0z * sr;
        const ctr = [eye[0] + f[0], eye[1] + f[1], eye[2] + f[2]];
        const vp = ZG.mat.mul(ZG.mat.persp(fov, aspectC, 0.25, 1200), ZG.mat.lookAt(eye, ctr, [ux2, uy2, uz2]));
        view.set(vp, 0);
        setV4(16, eye[0], eye[1], eye[2], t);
        setV4(20, rx2, ry2, rz2, aspectC);
        setV4(24, ux2, uy2, uz2, Math.tan(fov / 2));
        setV4(28, f[0], f[1], f[2], 0);
        return;
      }
      /* AVATAR-CENTRIC: the camera moves THROUGH and AROUND the field with
         the lead petal locked in the middle third of the frame. The aim
         chases the avatar smoothly, but its lag is CLAMPED to the angular
         radius of the central 34% — the petal can never leave it. */
      /* SPEED-LIMITED follow: the petal may drift off-center during a fast
         run — the camera is capped at dolly speed (5 u/s vertical, 9 u/s
         lateral) and catches up calmly. Slow beats centered. */
      /* ZIG_FLY: the performer flies the camera — the organism HOLDS at the anchor
         (locked aim → stays on the page, no breath jump) and breath dollies you IN
         and orbits you AROUND it. camB = live breath only (idle = camera at rest). */
      const camTgt = FLY && (ZC.Perf.live || ZC.Perf._sim > 0) ? ZC.Perf.breath : 0;
      /* SLOW ASYMMETRIC follow — the camera tracks the PHRASE, not each breath, so
         rapid articulation no longer yo-yos the dolly. Draws in fairly quick (0.7),
         eases back out slow (0.22) so inter-note rests don't pull you out. */
      flyDolly += (camTgt - flyDolly) * Math.min(1, dt * (camTgt > flyDolly ? 0.7 : 0.22));
      const avW = FLY ? 0.0 : 0.4;                 // FLY locks the aim to the anchor (no avatar chase → the mass can't yank the frame)
      const ax = ANCHOR[0] * (1 - avW) + state.avatarA[1] * avW,
            ay = ANCHOR[1] * (1 - avW) + state.avatarA[2] * avW,
            az = ANCHOR[2] * (1 - avW) + state.avatarA[3] * avW;
      const fdt = dt || 0.016, k = Math.min(1, fdt * 0.8);
      let sx = (ax - aimP[0]) * k, sy = (ay - aimP[1]) * k, sz = (az - aimP[2]) * k;
      const capY = 5 * fdt, capXZ = 9 * fdt;
      sy = Math.max(-capY, Math.min(capY, sy));
      const sL = Math.hypot(sx, sz);
      if (sL > capXZ) { sx *= capXZ / sL; sz *= capXZ / sL; }
      aimP[0] += sx; aimP[1] += sy; aimP[2] += sz;
      flyOrbit += flyDolly * dt * 0.6;                                // orbit rides the SMOOTHED envelope (walks you around, persists — no jitter)
      const ang = t * (FLY ? 0.006 : 0.021) + camPhase + flyOrbit;    // FLY: near-still at rest, the phrase orbits you
      /* ---- AUTO-FRAME: measure occasionally, ease continuously ---- */
      if (AUTOFRAME && flock && flock.measure) {
        measureAcc += dt;
        if (measureAcc > 0.25) {                       // four times a second is plenty
          measureAcc = 0;
          flock.measure((m) => { if (m.n > 8 && isFinite(m.r)) measured = m; }, 7);
        }
        if (measured && measured.r > 1) {
          const aspect2 = gpu.canvas.clientWidth / Math.max(1, gpu.canvas.clientHeight);
          const want = ZC.Frame.fit(measured.r, dial.fov, aspect2, FRAME_MARGIN) * frameZoom;
          autoRad = ZC.Frame.ease(autoRad, Math.max(14, Math.min(400, want)), dt, 0.9);
          /* AIM AT THE FLOCK, not at a drifting target. Being off-centre cost as
             much of the frame as being too close did. */
          aimP[0] += (measured.cx - aimP[0]) * Math.min(1, dt * 0.8);
          aimP[1] += (measured.cy - aimP[1]) * Math.min(1, dt * 0.8);
          aimP[2] += (measured.cz - aimP[2]) * Math.min(1, dt * 0.8);
        }
      }
      const baseRad = AUTOFRAME ? autoRad : dial.camRad;
      const rad = Math.max(11, baseRad * (1 - 0.55 * flyDolly));  // SMOOTHED dolly — glides IN over a phrase, eases out on real rest (no yo-yo)
      const eye = [aimP[0] + Math.cos(ang) * rad,
                   aimP[1] + 8 + 5 * Math.sin(t * 0.05 + hPhase),
                   aimP[2] + Math.sin(ang) * rad];
      const ctr = aimP;
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

    /* AGITATION master (live · ; calmer · ' busier): one factor over the motion-restlessness
       sources (churn · ambient · agit→speed coupling · note-flare). 1.0 = as-designed
       (byte-identical); lower = calmer letters. Lets Bill dial "too agitated" back at the horn. */
    let agitF = (global.ZIG_AGIT !== undefined ? +global.ZIG_AGIT : 1);
    /* how long a summoned form must live before another may replace it */
    const SUMMON_HOLD = (+global.ZIG_SUMMON >= 0) ? +global.ZIG_SUMMON : 0;
    let summonPitch = 72, summonAt = 0;
    let formLife = 0, noteForm = +global.ZIG_NOTEFORM > 0;   // NOTE→FORM (summon): \ toggles the EWI driving the form · formLife = birth→life→death envelope
    let revealBase = REVEAL0, revealPulse = 0;   // REVEAL composition: manual baseline (5/6) · N-preview pulse (see the letter you pick) · note bloom overrides while summoning
    let memHue = HUEROT0, memGlow = 0;   // MEMORY UNDERSIDE: the back's lagging ghost of the phrase — memHue slow-follows the played hue, memGlow burns as you play & fades in silence
    let t = 0, st = 0, avAng = 0, avY = 62, camY = 62, avPitch = 72, avLastMs = -1, fastB = 0, lastFluxT = -9,
        ecoLock = false, ecoBiteT = -9, fps = 0,
        cpPos = [ANCHOR[0] + 20, ANCHOR[1], ANCHOR[2]], cpFwd = [1, 0, 0], vsm = [0, 0, 0], fN = 0, fAcc = 0, hudT = 0, lureTh = 0, atSmooth = 0;
    const noteHist = [];    // MELODIC RIBBON: rolling {t, y, hue, att} per emitted point (the ribbon of notes)
    let ribPitch = 72;      // SMOOTHED pitch — ramps between notes so the ribbon flows instead of stepping in bars
    let attachOn = false;   // ZIGATTACH: Z toggles the freeze/melt gesture
    let solo = SOLO_START;  // SOLO: U toggles. breath is the only life-force — silence = true stillness
    function frame(nowMs) {
      const dt = ZC.clock.tick(nowMs);
      t += dt;
      /* METABOLISM: the world's clock, not yours. Perf/Pacemaker/camera stay
         real-time; the organism (motion, waves, blinks, moods) runs at
         dial.time — slow the field without slowing the performer. */
      const sdt = dt * dial.time;
      st += sdt;
      /* SOLO mode: breath is the sole life-force. Idle auto-breath OFF (silence
         → true stillness, not a pulse), and the breath's delay window collapses
         so breath acts UNIFORMLY across the field instead of rolling through as
         a traveling wave — you sculpt a form, not a ripple. Ambient churn zeroed
         below. Set before Perf.update (idle) and Drive.taps (refpt window). */
      if (ZC.Perf._opts) ZC.Perf._opts.idle = !solo;
      state.refpt[3] = solo ? 0.2 : 6;         // breath travel window: flat in solo · full swell when Alive
      ZC.Recorder.update();
      if (Sickle.player) Sickle.player.update(dt);   // recorded performer plays into Perf
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
      /* ZIGSEEK — PERFORMED (2026-07-28): the lure is no longer on a clock, it
         is on YOU. Breath drives the hunt (the lure races and the pull sharpens
         with your breath; silence lets it drift slow and calm). Pitch-bend
         drives the ring's size (bend opens the galaxy wide or draws it to a
         tight bright knot). A central repulsor holds the void. This is the
         reusable performance→target binding — any world can drive seek/avoid
         from any signal (breath, bend, the avatar, a food map). */
      if (SEEK_ON) {
        /* The lure answers YOU, not the idle auto-breath. Gated to LIVE playing
           (Perf.live / B key) so silence relaxes the field into a loose calm
           cloud and your breath GRABS it into the chasing ring — an immediate,
           felt cause & effect (like rest's wake). breathRaw = the punchy live
           signal; bend opens/closes the ring. */
        const playing = ZC.Perf.live || ZC.Perf._sim > 0;
        const bLive = playing ? ZC.Perf.breath : 0;         // smooth live breath (0 when idle)
        const bRaw = playing ? ZC.Perf.breathRaw : 0;       // immediate live breath — the grab
        const bnd = Math.max(0, Math.min(1, 0.5 + ZC.Perf.bend));
        lureTh += sdt * (0.05 + 0.55 * bLive);              // idle: barely drifts · breath: races
        const R = EXT * (0.24 + 0.34 * bnd);                // pitch-bend → ring radius
        state.seek = [ANCHOR[0] + Math.cos(lureTh) * R, ANCHOR[1] + Math.sin(lureTh * 1.7) * EXTY * 0.10, ANCHOR[2] + Math.sin(lureTh) * R,
                      2 + 42 * bRaw];                        // LOOSE when quiet · a STRONG grab when you breathe
        state.avoid = [ANCHOR[0], ANCHOR[1], ANCHOR[2], 15];
        state.seekcfg = [EXT * 0.55, EXT * 0.30, 0, 0];
      }
      /* ZIGATTACH: Z toggles the attach gesture. The signal RAMPS (not snaps) so
         agents cross their staggered thresholds at different moments → the field
         freezes and melts as a WAVE. state.attach reaches the kernel each frame. */
      if (ATTACH_ON) {
        atSmooth += ((attachOn ? 1 : 0) - atSmooth) * Math.min(1, dt * 2.2);
        state.attach = atSmooth;
      }
      state.knobsB[3] = 0.65 + 0.6 * ZC.Temperament.axis(0);      // churn — keeps letters turning
      state.cohW = 0.35 + 0.5 * ZC.Temperament.axis(1);
      /* THE MURMURATION DIAL (2026-07-23 · the blend, step 1): push the field
         toward one folding, breathing BODY. Cohesion gathers the mass;
         ALIGNMENT makes it turn as one — and orients the letters so a passing
         flash sweeps a coherent band (fish-silver). Separation radius widens
         with it so the mass tendrils and holes instead of curdling to a ball.
         0 = the calm field, byte-identical. W/S dials it live. */
      if (dial.murmur > 0.001) {
        const mu = Math.min(1.4, dial.murmur), mc = Math.min(mu, 1);
        state.cohW = state.cohW + (1.55 - state.cohW) * mc;   // gather (capped — cohesion is the curdle risk)
        state.aliW = 0.4 + 1.95 * mu;                         // the "moves as one" knob
        state.knobsB[3] *= (1 - 0.5 * mc);                    // churn down — coherent, not jittery
        state.knobsA[1] = 3.6 + 1.0 * mc;                     // wider personal space → structure, not a ball
      }
      state.agitAmbient = 0.06 + 0.10 * ZC.Climate.drift(0);
      if (solo) { state.agitAmbient = 0; state.knobsB[3] = 0.14; }   // SOLO: no background restlessness · minimal churn (breath drives motion, not the engine)
      /* AGITATION master — scale the restlessness sources by agitF (live, ; / '). At 1.0 this
         is byte-identical to the design; below it the churn, background restlessness, and the
         agit→speed coupling all ease, so busy playing and idle both read calmer. */
      state.knobsB[3] *= agitF;                          // churn (keeps letters turning)
      state.agitAmbient *= agitF;                        // background restlessness
      state.knobsB[0] = 8 * (0.45 + 0.55 * agitF);       // agit→vmax coupling (from base 8; note/contagion spikes drive speed less)
      state.knobsA[0] = 0.5 * agitF;                     // CONTAGION — the master never scaled this, so even at agitF 0.2 the social wave still spread at full strength
      /* STILLNESS (2026-08-08) — let the field be ABLE to rest.
         Two floors kept this cloud permanently in motion and NEITHER listened to
         breath: `knobsA[2]` is vmin, a MINIMUM speed the shader clamps every agent
         up to (`clamp(sp, vmin, vmax)`), so no shard could ever come to rest; and
         `knobsB[3]` is the churn field, added every frame "so the cloud never
         crystallizes". Breath only ever raised vmax, so playing softer never
         reached the floor — there was no lowest setting, it was in the kernel.
         Measured on Bill's 2026-08-08 capture: motion at ~4 Hz (frame-rate jitter,
         not sway) and frame-to-frame change never dropping below 79% of its mean.

         Both are PER-FRAME UNIFORMS, so this needs no shader splice at all — which
         is also why the first attempt was wrong: it rewrote the `let vmin …` line
         that the MEDIUM capability anchors on, and MEDIUM then failed to find it.
         Scaling the numbers here cannot collide with anything.

         STILLNESS fades both toward zero AS BREATH FALLS. Full breath is untouched,
         so nothing is lost at volume; silence is finally silent. 0 = historical. */
      if (STILLNESS > 0) {
        const alive = Math.min(1, ZC.Perf.breath * 2.2 + state.agitAmbient * 2.0);
        const gate = 1 - STILLNESS * (1 - alive);
        state.knobsA[2] = VMIN_BASE * gate;               // the speed FLOOR yields to silence
        state.knobsB[3] *= gate;                          // …and so does the churn
      }
      /* THE HEARTBEAT: breath pulls the strokes into one rhythm (lock ≈ 2.5,
         proven in test/fireflies_sync_ref.mjs) · bend leans the tempo */
      const thr = 0.10 + 0.06 * ZC.Climate.drift(1);
      state.K = dial.Kmax * ZC.util.smoothstep(thr, 0.75, ZC.Perf.breath);
      state.tempo = solo ? 1.4 * ZC.Perf.breath : (1 + 0.35 * ZC.Perf.bend);   // SOLO: the ZigPhase HEARTBEAT is breath-driven — no breath = frozen phase = no pulse; breathe and it beats
      ZC.Pacemaker.update(dt);
      state.pacePhase = ZC.Pacemaker.phase;
      state.pacePull = dial.paceGain * ZC.Pacemaker.pull;

      /* AVATAR BODY — pitch is altitude, breath is drive, bend banks.
         The target orbits through the crowd; your melody is its flight path. */
      let newNote = -1;
      ZC.Perf.heldT.forEach((t0, note) => { if (t0 > avLastMs) { avLastMs = t0; newNote = note; } });
      if (newNote >= 0) {
        avPitch = newNote;
        const pit = Math.min(102, Math.max(48, newNote)), py0 = ANCHOR[1] + (pit - 75) / 27 * 20, nhue = dial.hueRot + (pit - 48) / 54 * 0.5;
        if (NOTEPULSE) noteImpulse(ANCHOR[0], py0, ANCHOR[2], (0.55 + 0.4 * ZC.Perf.attack) * (0.45 + 0.55 * agitF), 0.18);   // nerve pulse INTO the body — flare eased by the agitation master
        if (flock.smoke) flock.smoke.puff(ANCHOR[0], py0, ANCHOR[2], 0.5 + 0.6 * ZC.Perf.attack, nhue);   // a puff of atmosphere on the note
        if (STRATA_ON) ZC.NoteField.note(py0, (pit % 12) / 12, 0.7 + 0.5 * ZC.Perf.attack);   // MELODIC STRATA: a band at the note's pitch-height, in its pitch-class colour
      }
      /* ============ NOTE → FORM (summon · \ toggles) ============================
         A note is a BIRTH: the field re-forms into a body whose REGISTER is the pitch
         (low = heavy/rooted, high = light/aerial), blooms WHOLE while you sustain it, and
         DISSOLVES back to the drift on release — type emerging, living, disappearing. Pitch
         also leans the colour warm→cool. Pure wiring of rails we already have (wardrobe
         letter · reveal/wholeness · hue wheel · the note nerve-pulse); no new geometry. */
      if (noteForm && REGIDX.length) {
        const held = ZC.Perf.held, anyHeld = !!(held && held.size > 0);
        /* SUMMON RATE (2026-08-09) — the form follows the PHRASE, not the note.
           This chose a new letterform on EVERY fresh onset, and since pitch maps
           to letter by register, each form covers only a few semitones: a phrase
           spanning an octave re-targeted all 6000 agents through several complete
           letterforms and the field never settled into any of them. Measured on
           Bill's take: motion 3.0 while off, climbing to 25.2 with it on, back to
           2.2 the instant he switched it off. The intent was right and the RATE
           was wrong.
           `summonHold` is the seconds a chosen form must live before another may
           replace it, and the register is read from a SMOOTHED pitch rather than
           the raw onset, so a run reads as one gesture and a real register change
           still lands. 0 = every onset, the historical behaviour. */
        if (newNote >= 0) {
          summonPitch += (newNote - summonPitch) * (SUMMON_HOLD > 0 ? 0.34 : 1);
          const tt = Math.max(0, Math.min(1, (summonPitch - 48) / 48));
          const want = REGIDX[Math.min(REGIDX.length - 1, Math.floor(tt * REGIDX.length))];
          if (want !== state.letter && (nowMs - summonAt) >= SUMMON_HOLD * 1000) {
            state.letter = want; summonAt = nowMs;
          }
        }
        formLife += ((anyHeld ? 1 : 0) - formLife) * Math.min(1, dt * (anyHeld ? 9 : 2.2));   // born fast, dies slower
        const voice = anyHeld ? (held.has(avPitch) ? avPitch : Math.max.apply(null, Array.from(held))) : avPitch;
        const ht = 0.02 + Math.max(0, Math.min(1, (voice - 48) / 54)) * 0.62;   // pitch → warm(low)…cool(high)
        dial.hueRot += (ht - dial.hueRot) * Math.min(1, dt * 4);
      }
      /* REVEAL composition — the note bloom no longer STOMPS reveal every frame (that
         pinned it to the drift so N never read). Instead reveal is the max of: the
         manual baseline (5/6), an N-preview pulse (pressing N briefly blooms the letter
         you picked so you SEE it), and the note bloom WHILE actively summoning. */
      revealPulse *= 0.982;                                   // N-preview eases out over ~2s
      const noteBloom = (noteForm && formLife > 0.02) ? (0.22 + 1.5 * formLife) : 0;   // EMERGE while held → DISSOLVE on release, then hands reveal back
      dial.reveal = Math.max(revealBase, revealPulse, noteBloom);
      avAng += sdt * (0.12 + 0.55 * ZC.Perf.breath) + ZC.Perf.bend * sdt * 1.4;
      const avR = 16 + (FLY ? 6 : 30) * ZC.Perf.breath;   // FLY: keep the attractor NEAR the mass centre so breath doesn't yank the field outward (organism holds)
      const targetY = 24 + (Math.min(102, Math.max(48, avPitch)) - 48) / 54 * 82;   // note 48..102 → y 24..106
      avY += (targetY - avY) * Math.min(1, dt * 3.5);
      camY += (avY - camY) * Math.min(1, dt * 0.22);          // the frame drifts, never jumps
      state.avatarA[1] = ANCHOR[0] + Math.cos(avAng) * avR;
      state.avatarA[2] = avY;
      state.avatarA[3] = ANCHOR[2] + Math.sin(avAng) * avR;
      /* NOTE → WEB ENERGY (both-at-once): a note pours energy into the membrane at
         the avatar point (where your intention burns), which then conducts OUTWARD
         along the filaments. A sharp spike on the onset (attack) + a sustained
         fountain while held (formLife); release → 0, so the pulse ripples out and
         fades to the resting lattice. Gated on the same / toggle as the summon. */
      if (flock.web && WEBENERGY_ON) {
        const eStr = noteForm ? (formLife * 0.9 + (newNote >= 0 ? (1.0 + 1.2 * ZC.Perf.attack) : 0)) : 0;
        flock.web.inject(state.avatarA[1], state.avatarA[2], state.avatarA[3], eStr);
      }
      state.avatarB[1] = newNote >= 0 ? 1 : 0;                  // flash NOW on your note
      state.avatarB[2] = 0.12 + 0.85 * ZC.Perf.attack;          // your intention burns

      /* ===== THE BEE (2026-08-09, Bill's idea) ==========================
         She lands with a note and NOTHING HAPPENS. Only if the note is HELD
         does the field begin to attend her, and the attention GROWS with the
         dwell — nearest shards first, then the local cluster, then the whole
         mass. Release and the attention breaks; her wake keeps moving for a
         few seconds after, because the medium remembers.

         Why this shape: a field that reacts to everything that touches it is
         not alive, it is nervous — three days of "popcorn" and "too jumpy"
         were all the same complaint, that too little earned too much. Making
         NON-RESPONSE the default and requiring the event to persist inverts
         that. It also spends SUSTAIN, the one dimension of the EWI that has
         been carrying nothing while pitch, attack, interval and breath were
         all in use — and sustain is the parameter a wind player owns most.

         She is not a new creature. She is agent #0: the SAME letterform as
         every other shard, the same matter, only larger, self-lit and still.
         A queen is the same species as her workers. If she were a glowing
         mote she would be a cursor pointing at the world; being one of them
         makes the field's turn toward her read as recognition, not alarm.
         Bill: "the bee is always queen, so no consequences other than
         reaction." She is never at risk, so the field's attention is a
         welcome and never a threat. */
      if (BEE > 0) {
        let dwell = 0;                                          // seconds the longest-held note has been down
        ZC.Perf.heldT.forEach((t0) => { const d = (nowMs - t0) / 1000; if (d > dwell) dwell = d; });
        if (!ZC.Perf.heldT.size) dwell = 0;
        /* attention is EARNED, and it grows rather than switching: a stab is
           ignored, a breath-length note stirs the nearest, a long one commits
           the mass. Smoothstep so there is no threshold to feel. */
        const reach = ZC.util.smoothstep(BEE_IGNORE, BEE_FULL, dwell);
        beeAttn += (reach - beeAttn) * Math.min(1, dt * (reach > beeAttn ? 2.2 : 9.0));  // rises like a swell, breaks on release
        state.avatarB[3] = BEE * beeAttn;                        // CHARISMA — how hard the field is drawn to her
        state.avatarB[0] = 0.85 * (0.25 + 0.75 * beeAttn);       // she steers more surely the more she is attended
        view[69] = dial.cockpit ? 0 : (0.9 + 2.6 * beeAttn);     // and lights up as the field turns
      }
      view[68] = 0;                                             // render2.x avatar idx
      view[69] = dial.cockpit ? 0 : [0, 0.9, 3.0][dial.mark];  // beacon off in first person
      /* cockpit proxy — fly the path the melody commands, smoothly */
      {
        const pk = Math.min(1, dt * 1.6);
        const ox = cpPos[0], oy = cpPos[1], oz = cpPos[2];
        cpPos[0] += (state.avatarA[1] - cpPos[0]) * pk;
        cpPos[1] += (state.avatarA[2] - cpPos[1]) * pk;
        cpPos[2] += (state.avatarA[3] - cpPos[2]) * pk;
        const iv = 1 / Math.max(dt, 1e-3);
        vsm[0] += ((cpPos[0] - ox) * iv - vsm[0]) * Math.min(1, dt * 2.5);
        vsm[1] += ((cpPos[1] - oy) * iv - vsm[1]) * Math.min(1, dt * 2.5);
        vsm[2] += ((cpPos[2] - oz) * iv - vsm[2]) * Math.min(1, dt * 2.5);
        const vl = Math.hypot(vsm[0], vsm[1], vsm[2]);
        if (vl > 0.6) { cpFwd[0] = vsm[0] / vl; cpFwd[1] = vsm[1] / vl; cpFwd[2] = vsm[2] / vl; }
      }
      const rate = Math.min(3.2, Math.max(0.4, ZC.Pacemaker.omega / (4.4 * dial.time)));   // sim-time compensated
      state.tempo *= 1 + (rate - 1) * 0.85 * ZC.Pacemaker.confidence;
      /* RIBBONS: streaming density deepens coupling + shimmers the letters —
         a ribbon pulls the field together; its STARTS set the pulse */
      state.K = Math.min(dial.Kmax, state.K + dial.Kmax * 0.45 * ZC.Pacemaker.flow);
      state.agitAmbient += 0.12 * ZC.Pacemaker.flow;

      /* BREATH AS PRIMARY — two envelopes, two bodies:
         CRISP: ~35ms-attack envelope of breathRaw drives LIGHT (ink + moon)
                with frame-level immediacy — every articulation is luminance.
         SMOOTH: Perf.breath (the liquid envelope) drives FORM — the letters
                 themselves swell, and the field gathers (K, engine cohesion).
         Light answers instantly; mass answers like mass. */
      const bRaw = ZC.Perf.breathRaw;
      /* wonder BROADENS: after a Reserve spend the light releases slower —
         the iridescence lingers before fading (Scout's Layer 3) */
      const rel = ECO ? Math.max(1.6, 5 - 3.4 * ZC.Mood.wonder) : 5;
      fastB += (bRaw - fastB) * Math.min(1, dt * (bRaw > fastB ? 28 : rel));
      /* GENESIS (R toggles): the screen is BLACK until you breathe. Only the
         lead petal's ember survives the dark. The idle auto-breath still
         moves the field — it lives unseen — but only LIVE breath (EWI or B)
         reveals it: the world exists exactly as much as you're playing it. */
      const act = ZC.Perf.live || ZC.Perf._sim > 0;
      const lB = dial.genesis && !act ? 0 : ZC.Perf.breath;
      const lF = dial.genesis && !act ? 0 : fastB;
      const rev = dial.genesis ? ZC.util.smoothstep(0.04, 0.72, lB) : 1;
      view[74] = dial.ink * (dial.genesis ? rev * (0.15 + 1.55 * lF) : (0.35 * GLOW0 + 1.35 * LUMEN0 * lF));   // GLOW = steady floor · LUMEN = breath swing. Flatten LUMEN → breath is freed for SHAPING, not brightness.
      view[65] = dial.shadowComp;   // render.y — SHADOW COMPLEMENT: the second colour in the dark side
      view[66] = dial.hueSpread;    // render.z — SPECTRUM SPREAD: per-agent hue scatter (whole spectrum at once)
      view[67] = dial.reveal;       // render.w — REVEAL amount: fragments ↔ whole letters (makes the N switch visible)
      view[76] = dial.chiaro;       // render4.x — CHIAROSCURO: back off ambient so only the lit side shows (1/2 keys)
      view[80] = dial.rim;          // render5.x — SILHOUETTE RIM: fresnel outline strength (↑/↓)
      view[81] = dial.rimSharp;     // render5.y — RIM SHARPNESS: thin↔wide edge (←/→)
      view[111] = dial.radiance;    // render6.w — RADIANCE amount (Shift+R). 0 = the law is present in the shader and multiplies by exactly one.
      /* NOTE FLASH (Bill, 2026-08-09) — the two faces answer a note differently.
         The cupped INTERIOR takes the pitch-class hue, the same (pitch mod 12)/12
         wheel MELODIC STRATA already uses, so a C is the same colour wherever it
         appears. The OUTSIDE takes one fixed colour whatever is played. A turning
         field then reads as two alternating states: a constant skin, and an
         interior that is different for every pitch. */
      if (NOTEFLASH_ON) {
        if (newNote >= 0) { noteHue = (newNote % 12) / 12; noteFlash = 1; }
        noteFlash *= Math.exp(-dt / NOTEFLASH_TAU);          // rises on the note, decays after
        if (noteFlash < 0.002) noteFlash = 0;
        view[108] = noteHue;                                  // render6.x — INSIDE: the note's colour
        view[109] = NOTEFLASH_OUT;                            // render6.y — OUTSIDE: one colour
        view[110] = noteFlash * NOTEFLASH_AMT;                // render6.z — how hard it flashes
      }
      /* MEMORY UNDERSIDE — the back glows with a lagging ghost of the phrase. memGlow burns
         fast as you play, fades slow in silence; memHue slow-follows the played hue (shortest
         way round the wheel). render4.y = remembered hue · render4.z = its burn (with a floor,
         so the ghost is always faintly present). */
      {
        const play = Math.min(1, (ZC.Perf.breath || 0) + (newNote >= 0 ? 0.7 : 0));
        memGlow += (play - memGlow) * Math.min(1, dt * (play > memGlow ? 3.5 : 0.35));   // burn fast · fade slow
        let dh = (((dial.hueRot - memHue) % 1) + 1.5) % 1 - 0.5;                          // shortest arc to the active hue
        memHue = (((memHue + dh * Math.min(1, dt * 0.9)) % 1) + 1) % 1;                   // slow lag (~1s)
        view[77] = memHue;                 // render4.y
        view[78] = 0.22 + 0.78 * memGlow;  // render4.z — floor keeps a faint ghost even in silence
        view[79] = dial.memBack;           // render4.w — MEMORY UNDERSIDE on/off (Shift+M)
      }
      if (!dial.spectral) {
        const ml = dial.moon * (dial.genesis ? rev * (0.25 + 1.0 * lF) : (0.5 * GLOW0 + 0.85 * LUMEN0 * lF));
        view[52] = MOON[0] * ml; view[53] = MOON[1] * ml; view[54] = MOON[2] * ml;
        view[56] = MOSS[0] * rev; view[57] = MOSS[1] * rev; view[58] = MOSS[2] * rev;
        view[60] = BONE[0] * rev; view[61] = BONE[1] * rev; view[62] = BONE[2] * rev;
      }
      view[59] = 0.85 * (0.82 + 0.38 * lB) * SIZEK;   // SIZEK (ZIG_SIZE): scale each shard up so the letterform reads
      /* THE INFINITE-SHAPE MAGIC (restored) + breath-summoned sparkle: FLUID SMEAR
         (render2.w) stretches each blade along its OWN motion so no two read alike —
         a playing field becomes brushstrokes; GLINT (render2.z) lights the moonpath.
         Both rest LOW (settled petals) and BLOOM with breath — performance is the
         source of both light and form. Genesis keeps them black until you breathe. */
      const alive = dial.genesis && !act ? 0 : 1;
      view[71] = SMEAR0 * alive * (0.45 + 1.05 * lF);                 // fluid smear gain — motion → infinite shapes (SHAPE: stays breath-driven, this is the sculpting)
      view[70] = GLINT0 * alive * (0.35 * GLOW0 + 0.95 * LUMEN0 * lF); // moonpath glint/sheen — flattened with LUMEN so it doesn't blow out as you play                            // smooth: the letters swell with the phrase

      /* ZIGTIMBRE — the horn's ACTUAL voice drives the ORGANISM (press A to arm).
         BODY lifts the ink · BRIGHTNESS silvers the moon · FLUX strikes the field.
         SUPPRESSED when ZIG_AMBIENCE is on: there the audio belongs to the
         ENVIRONMENT (the loop / the world), NOT the body — the two streams stay
         separate, so the sound never smears or strikes the creature. When Ambience
         owns the audio it also owns Timbre.update (called once inside it). */
      if (!AMBIENCE_ON) {
        ZC.Timbre.update(dt);
        if (ZC.Timbre.live) {
          view[74] *= 1 + 0.45 * ZC.Timbre.body;
          if (!dial.spectral) {
            const bl = 1 + 0.5 * ZC.Timbre.brightness;
            view[52] *= bl; view[53] *= bl; view[54] *= bl;
          }
          if (ZC.Timbre.flux > 0.55 && t - lastFluxT > 0.25) {
            lastFluxT = t;
            Sickle.strike(state.avatarA[1] || ANCHOR[0], state.avatarA[2] || ANCHOR[1],
                          state.avatarA[3] || ANCHOR[2], 0.45 + 0.5 * ZC.Timbre.flux);
          }
        }
      }

      /* THE ATMOSPHERE BUS (ZIG_AMBIENCE) — the processed SOUND drives the ENVIRONMENT
         while MIDI drives the body (the two-stream design). §4: brightness → colour
         temperature, noisiness → mist. §5: the reverb TAIL keeps the world glowing
         after the note stops — the organism stills, the world rings. Synth-sourced
         until the audio cabling is live (same socket either way). Guarded → byte-
         identical when ZIG_AMBIENCE is absent. */
      /* MELODIC STRATA — the melody written up the body's vertical axis. Real EWI notes
         deposit bands in the newNote block above; when no MIDI is live, a deterministic demo
         melody keeps it alive so the capability is visible on open. Bands decay & pack each
         frame into view[84..107]; byte-identical (all zero) when STRATA is off. */
      if (STRATA_ON) {
        const stLive = ZC.Perf.live || ZC.Perf._sim > 0;
        if (STRATA_DEMO && !stLive) {                         // demo melody (ZIG_STRATADEMO): an up-and-down scale, one note ~every 0.5 s
          strataSynthT += dt;
          if (strataSynthT >= 0.5) {
            strataSynthT = 0;
            const SCALE = [48, 52, 55, 60, 64, 67, 72, 76, 79, 76, 72, 67, 64, 60, 55, 52];
            const pit = SCALE[strataSeq % SCALE.length]; strataSeq++;
            const py0 = ANCHOR[1] + (Math.min(102, Math.max(48, pit)) - 75) / 27 * 20;
            ZC.NoteField.note(py0, (pit % 12) / 12, 1.0);
          }
        }
        ZC.NoteField.update(dt);
        ZC.NoteField.pack(view, 84);
      }
      if (AMBIENCE_ON) {
        if (ZC.Ambience.src === "off") { ZC.Ambience.synth(true); ZC.AmbienceMap.reset(); }
        ZC.Ambience.update(dt);
        const A = ZC.Ambience.read();
        const L = ZC.AmbienceMap.step(A, dt);
        /* AUDIO → ORGANISM LIFE (Bill, 2026-08-03): the void stays BLACK — the sound is
           not a backdrop, it is MORE LIFE-FORCE for the creature. MIDI gives the gestures
           (notes/breath); the audio gives VITALITY. energy → the ink/iridescence swells
           (the field comes alive as the room fills with sound) · the reverb TAIL (glow)
           keeps that life LINGERING after the note, then rings down toward the MIDI
           baseline · brightness → the moon silvers the body (shine in the sound = shine in
           the flesh) · onset → a soft NERVE-PULSE flares the glint on each attack. It adds
           light & shimmer only — never a frame-trail, never a twitchy strike, never a
           change to the FORM (that stays MIDI's alone). */
        const life = 0.55 * A.energy + 0.95 * L.glow;        // glow rides the ringing tail → the life lingers
        view[74] *= 1 + 0.65 * life;                          // INK / iridescence swells & lingers with the sound
        if (!dial.spectral) {
          const bl = 1 + 0.55 * A.brightness;                 // shine in the sound → shine in the body
          view[52] *= bl; view[53] *= bl; view[54] *= bl;
        }
        view[70] *= 1 + 0.9 * A.onset;                        // moonpath glint FLARES softly on each attack
      }

      /* THE COLOR ECOLOGY (ZIG_ECOLOGY worlds · ZigCore v0.6): material ·
         mood · reserve. The field lives at 90% material — pearl, bone,
         moonlight. Events (strikes, phase-lock, hard bites) SPEND the
         treasury: a few seconds of hummingbird, then back to silver.
         The audience earns the color. */
      if (ECO && !dial.spectral) {
        ZC.Mood.update(dt);
        const quiet = !(ZC.Perf.live && ZC.Perf.breath > 0.15) && ZC.Pacemaker.flow < 0.1 &&
                      !(Sickle.player && Sickle.player.playing);
        ZC.Reserve.update(dt, quiet);
        const Mo = ZC.Mood, Rv = ZC.Reserve;
        if (state.K > 2.4 && !ecoLock) { ecoLock = true; Rv.event("lock", 0.9); }   // the field finds one heartbeat
        if (state.K < 1.8) ecoLock = false;
        if (ZC.Timbre.live && ZC.Timbre.flux > 0.75 && t - ecoBiteT > 3) { ecoBiteT = t; Rv.event("bite", ZC.Timbre.flux); }
        /* METAMORPHOSIS: a spend re-dresses a growing fraction of the field
           into the NEXT letter of the wardrobe — seeds open into whispers —
           then the flash drains and the letters close again. */
        if (WNAMES.length > 1) {
          state.letterB = (state.letter + 1) % WNAMES.length;
          state.mix = Math.min(1, Rv.burst * 1.15);
        }
        /* Layer 2 — willingness: whisper at rest, explode on a spend;
           fear drains the rainbow, wonder broadens it. In COHERENCE mode a
           spend buys AGREEMENT instead of color: for two seconds every
           organism aligns — the membrane suddenly becomes visible — while
           iridescence stays reserved for STRESS (curvature → agit → light). */
        if (RESMODE === "coherence") {
          state.K = Math.min(6, state.K + 3.2 * Rv.burst);
          state.aliW = 0.4 + 0.9 * Rv.burst;
          if (skin) skin.alignW = 1.9 * (1 + 1.6 * Rv.burst);
        }
        const tb = ZC.Timbre.live ? ZC.Timbre : null;
        const iri = (ECO.iriBase + (RESMODE === "coherence" ? 0 : ECO.iriBurst * Rv.burst)) *
                    (1 - 0.8 * Mo.fear) * (1 + 0.35 * Mo.wonder) *
                    (tb ? 1 + 0.4 * tb.body : 1);
        view[74] = dial.ink * iri * (dial.genesis ? Math.max(rev, 0.22) : 1);
        /* Layers 1+3 — the material, tinted by feeling */
        const mlE = dial.moon * (dial.genesis ? rev * (0.25 + 1.0 * lF) : (0.5 + 0.85 * lF)) *
                    (tb ? 1 + 0.5 * tb.brightness : 1);
        const GOLD = [1.0, 0.72, 0.30], GREEN = [0.30, 0.85, 0.45];
        for (let ci = 0; ci < 3; ci++) {
          let dk = ECO.dark[ci] + (GREEN[ci] * 0.16 - ECO.dark[ci]) * (Mo.curious * 0.45);   // curiosity: a hint at the dome
          let lt = ECO.light[ci] + (GOLD[ci] - ECO.light[ci]) * (Mo.excited * 0.42);         // excitement: gold spreads
          dk = dk + (ECO.light[ci] * 0.55 - dk) * (Mo.fear * 0.6);                           // fear: color drains to bone
          view[56 + ci] = dk * rev;
          view[60 + ci] = lt * rev;
          view[52 + ci] = ECO.moon[ci] * mlE;
        }
      }

      /* THE ORCHARD (BIOME worlds): temperature drift + the ember treasury.
         Bodies are born colors (baked in the kernel); here we advance the
         slow season, gild the leading edges with breath, and let spends
         warm the shimmer — never a rainbow, always inside the family. */
      if (BIOME) {
        state.drift = (state.drift + sdt * BIOME.drift) % BIOME.notes.length;
        if (!ECO) {
          ZC.Mood.update(dt);
          const quietB = !(ZC.Perf.live && ZC.Perf.breath > 0.15) && ZC.Pacemaker.flow < 0.1 &&
                         !(Sickle.player && Sickle.player.playing);
          ZC.Reserve.update(dt, quietB);
        }
        const Rv = ZC.Reserve;
        /* shimmer stays inside the family: low ink, warmed by spends */
        view[74] = dial.ink * (0.10 + 0.22 * lF + 1.1 * Rv.burst) * (dial.genesis ? Math.max(rev, 0.22) : 1);
        /* burnished copper on the leading edges — breath makes orange precious */
        view[75] = 1.5 * lF + 2.6 * Rv.burst;
      }

      /* THE MEMBRANE breathes: your breath softens its tension SLOWLY —
         weather, not steering. Silence lets rigidity return. */
      if (skin) {
        skin.elastic += (ZC.Perf.breath - skin.elastic) * Math.min(1, dt * 2.2);
        skin.frame(sdt);
      }

      /* stir the world's air: breath brews weather · waves swirl it (shared
         impulse queue) · the avatar's flight drags a wake through it */
      flow.ambient = solo ? 2.6 * ZC.Perf.breath : (0.5 + 2.1 * ZC.Perf.breath);   // SOLO: no baseline current — the air moves only when you breathe
      flow.frame(state, {
        x: state.avatarA[1], y: state.avatarA[2], z: state.avatarA[3],
        vx: vsm[0], vy: vsm[1], vz: vsm[2], radius: 7
      });

      camera(t, dt);

      /* MELODIC RIBBON — the note-twin of breath. PITCH (avPitch) sets the height
         of a new spine point each frame while you play; points flow away in x with
         age and fade, so your melody draws itself as a glowing streamer threading
         the organism. Colour follows the ZIGSPECTRUM wheel by pitch. Silence lets
         it age out and vanish — the ribbon exists exactly as much as you play. */
      if (flock.ribbon) {
        const playing = ZC.Perf.live || ZC.Perf._sim > 0, RIBLIFE = 3.5;
        ribPitch += (Math.min(102, Math.max(48, avPitch)) - ribPitch) * Math.min(1, dt * 7);   // SMOOTH the pitch → a flowing line, not a staircase
        if (playing && ZC.Perf.breath > 0.05) {
          noteHist.push({ t: t, y: ANCHOR[1] + (ribPitch - 75) / 27 * 28,
                          hue: dial.hueRot + (ribPitch - 48) / 54 * 0.5,
                          att: 0.35 + 0.55 * ZC.Perf.attack });
        }
        while (noteHist.length && (t - noteHist[0].t > RIBLIFE || noteHist.length > flock.ribbon.cap)) noteHist.shift();
        const eye = [view[16], view[17], view[18]], pts = [];
        for (let i = 0; i < noteHist.length; i++) {
          const p = noteHist[i], age = t - p.t, a = Math.max(0, 1 - age / RIBLIFE) * p.att, c = hrgb(p.hue);
          pts.push({ x: ANCHOR[0] - age * 9, y: p.y, z: ANCHOR[2], w: 0.12 + 0.34 * a, r: c[0], g: c[1], b: c[2], a: a });   // thin + tapered → streamer
        }
        flock.ribbon.build(pts, eye);
      }

      /* SMOKE / FOG — atmosphere the breath lifts & billows and the notes puff.
         Rides live breath; thins to nothing in silence (performance = the source). */
      if (flock.smoke) flock.smoke.frame({ dt: dt, time: t, breath: ZC.Perf.breath,
        cen: [ANCHOR[0], ANCHOR[1], ANCHOR[2]], eye: [view[16], view[17], view[18]], baseHue: dial.hueRot, size: 8 });

      /* WEB — connective filaments. Colour rides the wheel (Q) so threads match the
         field; BREATH strings the web (vitality = connection). Idle keeps a faint
         resting web so the structure reads even in silence. */
      if (flock.web) flock.web.ctrl(dial.webGain, 0.5, dial.webHue + dial.hueRot,
        0.30 + 0.85 * (ZC.Perf.breath || 0));

      if (scene) {
        /* RESONATOR sync — clock and geometry ONLY. Breath, K, pacemaker,
           ambient agitation all stay zero: the deep is moved by waves, not
           by wires. (The impulse queue is the shared reference — every gong
           strike already travels down through it, arriving late and true.) */
        stateB.dt = state.dt; stateB.time = state.time;
        stateB.cohW = state.cohW; stateB.refpt = state.refpt;
        scene.frame(view, [state, stateB]);
      } else {
        flock.frame(state, view);
      }

      fAcc += dt; fN++;
      if (fAcc >= 0.5) { fps = fN / fAcc; fAcc = 0; fN = 0; }
      hudT += dt;
      if (hudT > 0.25) {
        hudT = 0;
        H.line("status", flock.count + (flockB ? "+" + flockB.count + " resonator" : "") + " × " +
          (WNAMES.length ? WNAMES[state.letter].toUpperCase() + (state.mix > 0.05 && WNAMES.length > 1 ? "⟶" + WNAMES[state.letterB].toUpperCase() : "") : LETTER.toUpperCase()) +
          (WNAMES.length > 1 ? " (N)" : "") + " · " + fps.toFixed(0) + " fps · " +
          (ZC.Perf.live ? "LIVE" : (ZC.Perf._sim > 0 ? "SIM" : "idle")) +
          " · breath " + "▮".repeat(Math.round(ZC.Perf.breath * 10)).padEnd(10, "▯") +
          " · K " + state.K.toFixed(2) + (state.K > 2.4 ? "  ← LOCKED" : (state.K > 1.2 ? "  ← gathering" : "")) +
          (ZC.Pacemaker.flow > 0.15 ? "  ·  ribbon " + "≈".repeat(Math.max(1, Math.round(ZC.Pacemaker.flow * 5))) : "") +
          (ZC.Pacemaker.confidence > 0.05
            ? "  ·  you " + ZC.Pacemaker.bpm.toFixed(0) + "bpm " +
              "●".repeat(Math.round(ZC.Pacemaker.confidence * 4)).padEnd(4, "○") +
              (ZC.Pacemaker.confidence > 0.7 ? " FOLLOWING YOU" : (ZC.Pacemaker.confidence > 0.35 ? " listening…" : ""))
            : ""));
        if (Sickle.player) {
          const pl = Sickle.player, mm = (x) => Math.floor(x / 60) + ":" + ("0" + Math.floor(x % 60)).slice(-2);
          H.line("midi", (ewiStatus ? ewiStatus + "  ·  " : "") + "track " + mm(pl.t) + "/" + mm(pl.duration) + (pl.playing ? " ▶" : " ⏸"));
        } else {
          /* MIDI MONITOR — what the EWI is ACTUALLY sending. raw = the last MIDI
             message's bytes (status · data1 · data2). Blow and watch: breathRaw
             should rise and 'last' should read a breath CC (2/7/11) or chan-pressure.
             If breathRaw stays 0 while raw[…] changes, your breath is on a CC we're
             not mapping — read me the raw bytes and I'll bind it (or set ZIG_ANYCC=1). */
          H.line("midi", (ewiStatus || "EWI: awaiting device") +
            " · msgs " + ZC.Perf.allMsg + " · last " + ZC.Perf.lastCC +
            " · breathRaw " + ZC.Perf.breathRaw.toFixed(2) + (ZC.Perf.live ? " · LIVE" : " · idle") +
            "  · raw[" + (ZC.Perf.rawLog[0] || "—") + "]");
        }
        if (skin) {
          H.line("skin", "MEMBRANE σ " + skin.sigma.toFixed(1) + " · elastic " + Math.round(skin.elastic * 100) + "%" +
            " · memory " + skin.depth.toFixed(1) +
            (RESMODE === "coherence" && ZC.Reserve.burst > 0.08 ? "  ✶ COHERENCE — every organism agrees" : ""));
        }
        if (BIOME) {
          const Rv = ZC.Reserve;
          H.line("ecology", "BIOME " + global.ZIG_BIOME + " · season " + BIOME.names[Math.floor(state.drift) % BIOME.names.length].toUpperCase() +
            " · reserve " + "▮".repeat(Math.round(Rv.level * 8)).padEnd(8, "▯") +
            (Rv.burst > 0.08 ? "  ✶ EMBER REVEAL" : ""));
        }
        if (ECO) {
          const Mo = ZC.Mood, Rv = ZC.Reserve;
          const moods = { calm: Mo.calm, curious: Mo.curious, excited: Mo.excited, fear: Mo.fear, wonder: Mo.wonder };
          const dom = Object.keys(moods).reduce((a, b) => moods[a] >= moods[b] ? a : b);
          H.line("ecology", "MATERIAL " + global.ZIG_ECOLOGY + " · mood " + dom.toUpperCase() +
            " · reserve " + "▮".repeat(Math.round(Rv.level * 8)).padEnd(8, "▯") +
            (Rv.burst > 0.08 ? "  ✶ SPENDING — hummingbird for " + (Math.log(Rv.burst / 0.05) * 1.1).toFixed(1) + "s" : ""));
        }
        if (ZC.Timbre.live) {
          const bar = (v) => "▮".repeat(Math.round(Math.min(1, v) * 6)).padEnd(6, "▯");
          H.line("audio", ZC.Timbre.L
            ? "VOICE " + ZC.Timbre.device.slice(0, 16) +
              " · L body " + bar(ZC.Timbre.L.body) + " bite " + bar(ZC.Timbre.L.flux) +
              " · R body " + bar(ZC.Timbre.R.body) + " bite " + bar(ZC.Timbre.R.flux)
            : "VOICE " + ZC.Timbre.device.slice(0, 22) +
              " · body " + bar(ZC.Timbre.body) + " · shine " + bar(ZC.Timbre.brightness) + " · bite " + bar(ZC.Timbre.flux));
        }
        H.line("engine", (dial.cockpit ? "COCKPIT · " : "") + (dial.genesis ? "GENESIS · " : "") + (dial.spectral ? "SPECTRAL INK · " : "moonlit · ") +
          "time " + dial.time.toFixed(2) + "\u00d7 \u00b7 " + "ink " + dial.ink.toFixed(2) + " · moon " + dial.moon.toFixed(2) +
          " · Kmax " + dial.Kmax.toFixed(1) +
          " · mem " + (after.tau < 0.02 ? "off" : after.tau.toFixed(1) + "s") +
          " · wind " + flow.gain.toFixed(1) +
          " · agit " + agitF.toFixed(1) +
          (dial.shadowComp > 0.001 ? " · shadow " + dial.shadowComp.toFixed(1) : "") +
          (dial.hueSpread > 0.001 ? " · spread " + dial.hueSpread.toFixed(1) : "") +
          (SPECTRUM_ON ? " · span " + dial.hueSpan.toFixed(2) : "") +
          (flock.web ? " · web " + dial.webGain.toFixed(2) : "") +
          (dial.chiaro > 0.001 ? " · light " + dial.chiaro.toFixed(2) : "") +
          (dial.rim > 0.001 ? " · rim " + dial.rim.toFixed(2) + "/" + dial.rimSharp.toFixed(1) : "") +
          (RADIANCE ? " · radiance " + (dial.radiance > 0 ? (RADIANCE.preset || "custom") : "off") : "") +
          /* GROUND: name the floor of light in the HUD. A law you cannot see the
             state of is a law you debug by guessing — which cost most of an
             afternoon on 2026-08-18, when a black screen could have been either
             an inactive law or an active one rendering wrongly. */
          (GROUND ? " · ground " + (GROUND.preset || "?") + " lift " + (GROUND.lift || 0).toFixed(2) +
                    " " + (GROUND.compose || "rise") : " · ground void") +
          (MEMBACK_COMPILED ? (dial.memBack > 0 ? " · mem-back " + Math.round((0.22 + 0.78 * memGlow) * 100) + "%" : " · mem-back off") : "") +
          " · reveal " + dial.reveal.toFixed(2) +
          " · EWI " + (noteForm ? "ON" + (formLife > 0.05 ? " ▮" + (WNAMES.length ? WNAMES[state.letter].toUpperCase() : "") : "") : "off") +
          (dial.murmur > 0.001 ? " · MURMUR " + Math.round(dial.murmur * 100) + "%" : "") +
          /* PRESENCE: name the mode AND the reach. A law you cannot see the state
             of is a law you debug by guessing — the same argument GROUND makes
             two lines up, and the reason three separate causes hid this one on
             2026-08-25. The reach is live on Shift+↑/↓; read it off here. */
          (flock.presence ? " · BEE " + (flock.presence.sign < 0 ? "agitate" : "cozy") +
                            " reach " + flock.presence.r.toFixed(0) : "") +
          (MAT ? " · " + matName + (WORLD && !global.ZIG_MATERIAL ? " (native)" : "") : "") +
          " · cam " + (AUTOFRAME ? autoRad.toFixed(0) + (measured ? "\u2194" + measured.r.toFixed(0) : "") + (Math.abs(frameZoom-1) > 0.01 ? " \u00d7" + frameZoom.toFixed(2) : "") : dial.camRad.toFixed(0)) + " · fov " + dial.fov.toFixed(2) +
          " · " + (WNAMES.length > 1
            ? "wardrobe " + WNAMES[state.letter] + (state.mix > 0.05 ? " ⟶ " + WNAMES[state.letterB] + " " + Math.round(state.mix * 100) + "%" : "") + " (N steps)"
            : LETTER + (PETAL.gen === "arc" ? "[sweep " + PETAL.sweep + " twist " + PETAL.twist + "]" : "[curve " + PETAL.curve + " twist " + PETAL.twist + " taper " + PETAL.taper + "]")));
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    /* THE DUET — a .mid becomes a live performer. Events stream into
       Perf.onMsg byte-identical to the EWI; the horn stays live on top. */
    Sickle.player = null;
    Sickle.loadMidi = (buf) => {
      const parsed = ZMI.parse(buf);
      Sickle.player = ZMI.createPlayer(parsed, { loop: true });
      Sickle.player.playing = true;
      return { notes: parsed.notes, duration: parsed.duration };
    };
    global.addEventListener("dragover", (e) => e.preventDefault());
    global.addEventListener("drop", async (e) => {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      try { const r = Sickle.loadMidi(await f.arrayBuffer());
            H.line("midi", "track loaded: " + f.name + " · " + r.notes + " notes"); }
      catch (err) { H.line("midi", "not a readable .mid: " + err.message); }
    });

    global.addEventListener("keydown", (e) => {
      if (e.code === "KeyB") ZC.Perf.sim(0.85);
      if (e.code === "Space") { Sickle.strike(ANCHOR[0], ANCHOR[1], ANCHOR[2], 0.9); e.preventDefault(); }
      /* live dials — the extremes hunt */
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
      if (e.code === "KeyI") dial.ink = clamp(dial.ink + 0.15, 0, 3);
      if (e.code === "KeyK") dial.ink = clamp(dial.ink - 0.15, 0, 3);
      if (e.code === "KeyO") dial.moon = clamp(dial.moon + 0.2, 0.2, 3.5);
      if (e.code === "KeyL") dial.moon = clamp(dial.moon - 0.2, 0.2, 3.5);
      /* + zooms IN. Under auto-framing this scales the CHOSEN frame rather than
         setting an absolute distance, so it survives the organism changing size. */
      if (e.code === "Equal") { if (AUTOFRAME) frameZoom = clamp(frameZoom - 0.07, 0.35, 2.6);
                                else dial.camRad = clamp(dial.camRad - 5, 22, 170); }
      if (e.code === "Minus") { if (AUTOFRAME) frameZoom = clamp(frameZoom + 0.07, 0.35, 2.6);
                                else dial.camRad = clamp(dial.camRad + 5, 22, 170); }
      if (e.code === "BracketRight") dial.fov = clamp(dial.fov + 0.05, 0.5, 1.4);
      if (e.code === "BracketLeft") dial.fov = clamp(dial.fov - 0.05, 0.5, 1.4);
      if (e.code === "KeyP") dial.spectral = !dial.spectral;   // P — spectral ink toggle
      if (e.code === "KeyJ") dial.Kmax = clamp(dial.Kmax + 0.2, 0, 6);   // J/M — heartbeat depth
      if (e.code === "KeyM" && e.shiftKey) { dial.memBack = dial.memBack > 0 ? 0 : 1;   // Shift+M — MEMORY UNDERSIDE on/off (the 2nd performance surface)
        H.line("status", dial.memBack ? "MEMORY UNDERSIDE ON — the backs carry a ghost of the phrase" : "MEMORY UNDERSIDE OFF"); }
      else if (e.code === "KeyM") dial.Kmax = clamp(dial.Kmax - 0.2, 0, 6);
      if (e.code === "KeyY") dial.paceGain = clamp(dial.paceGain + 0.2, 0, 5);   // Y/H — your pull
      if (e.code === "KeyH") dial.paceGain = clamp(dial.paceGain - 0.2, 0, 5);
      if (e.code === "KeyA") {                                  // A — open the audio input
        /* per-world input pinning: window.ZIG_VOICE names this world's input
           device (regex, e.g. "Motu M|M2|MOTU") · window.ZIG_SPLIT = 1 hears the
           stereo cable as TWO instruments (pan stems hard L/R in the DAW) */
        if (AMBIENCE_ON && ZC.Ambience.src !== "live") {       // the audio feeds the ORGANISM'S LIFE (replaces the synth stand-in)
          H.line("audio", "opening the audio input for the field's LIFE…");
          ZC.Ambience.arm(global.ZIG_VOICE).then((ok) => H.line("audio",
            ok ? "LIFE LIVE — " + ZC.Timbre.device + " → glow · shine · pulse" : "audio failed (staying on synth): " + ZC.Timbre.err));
        } else if (!AMBIENCE_ON && !ZC.Timbre.live) {          // ORGANISM: the horn drives the body
          H.line("audio", "asking for the audio input…");
          ZC.Timbre.arm(global.ZIG_VOICE, { split: !!global.ZIG_SPLIT }).then((ok) => H.line("audio",
            ok ? "VOICE LIVE — " + ZC.Timbre.device + (ZC.Timbre.L ? " · SPLIT L/R" : "") : "voice failed: " + ZC.Timbre.err));
        }
      }
      if (e.code === "KeyN" && WNAMES.length > 1) {                      // N — next letter: the field re-dresses LIVE
        state.letter = (state.letter + 1) % WNAMES.length;
        revealPulse = Math.max(revealPulse, 1.7);                       // PREVIEW: assemble the picked letter WHOLE (past the 1.6 whole-threshold) for ~2s so the switch reads clearly
        H.line("status", "the field re-dresses: " + WNAMES[state.letter].toUpperCase() + " — same life, new body");
      }
      if (e.code === "KeyQ" && SPECTRUM_ON) {                            // Q — ZIGSPECTRUM: rotate the base→tip color wheel (spin purples/greens to the tip and back)
        dial.hueRot = (dial.hueRot + 1 / 12) % 1;
        H.line("status", "spectrum rotated → " + Math.round(dial.hueRot * 360) + "° (base ⟶ tip color order)");
      }
      if (e.code === "KeyF") flow.gain = clamp(flow.gain + 0.2, 0, 3);    // F/G — the wind dial
      if (e.code === "KeyG") flow.gain = clamp(flow.gain - 0.2, 0, 3);
      if (e.code === "KeyW") dial.murmur = clamp(dial.murmur + 0.1, 0, 1.4);   // W/S — MURMURATION: field → one folding body
      if (e.code === "KeyS") dial.murmur = clamp(dial.murmur - 0.1, 0, 1.4);
      if (e.code === "KeyE") after.tau = clamp(after.tau < 0.15 ? 0.15 : after.tau * 1.3, 0, 6);   // E/D — memory glass
      if (e.code === "KeyD") { after.tau /= 1.3; if (after.tau < 0.15) after.tau = 0; }
      if (e.code === "KeyV") dial.mark = (dial.mark + 1) % 3;   // V — hidden → ember → BEACON
      if (e.code === "KeyR" && e.shiftKey && RADIANCE) {        // Shift+R — RADIANCE on/off: the A/B is against ITSELF in the same frame
        dial.radiance = dial.radiance > 0 ? 0 : 1;
        H.line("status", dial.radiance > 0
          ? "RADIANCE ON — room \"" + (RADIANCE.preset || "custom") + "\" · gain " + (+RADIANCE.gain).toFixed(2) + " · gamma " + (+RADIANCE.gamma).toFixed(2) + (RADIANCE.black > 0 ? " · black " + (+RADIANCE.black).toFixed(2) : "")
          : "RADIANCE OFF — the shader is unchanged, the law multiplies by one");
        e.preventDefault();
      } else if (e.code === "KeyR") dial.genesis = !dial.genesis;      // R — genesis: black until breath
      if (e.code === "KeyX") dial.cockpit = !dial.cockpit;      // X — COCKPIT: fly it first-person
      if (e.code === "KeyZ" && ATTACH_ON) attachOn = !attachOn;  // Z — ZIGATTACH: freeze the field into a held pose / melt
      if (e.code === "KeyU") { solo = !solo; H.line("status", solo ? "SOLO — breath is the only pulse (no idle, no wave)" : "ALIVE — the field breathes on its own"); }   // U — SOLO toggle
      if (e.code === "KeyT" && Sickle.player) Sickle.player.toggle();   // T — the recorded performer
      if (e.code === "Comma") dial.time = clamp(dial.time / 1.15, 0.15, 1.6);   // , slower
      if (e.code === "Period") dial.time = clamp(dial.time * 1.15, 0.15, 1.6);  // . faster
      if (e.code === "KeyC") {                                 // C — center: reset the view
        dial.camRad = CAM0; dial.fov = 1.02; frameZoom = 1.0;
        camPhase = -t * 0.021; hPhase = -t * 0.05;             // square to the anchor, level the bob
      }
      if (e.code === "Semicolon") agitF = Math.max(0.2, agitF - 0.1);   // ; — calmer letters (live)
      if (e.code === "Quote")     agitF = Math.min(1.5, agitF + 0.1);   // ' — busier letters (live)
      if (e.code === "Digit1") dial.chiaro = Math.max(0, dial.chiaro - 0.08);           // 1 — softer light (more fill, whole shape shows)
      if (e.code === "Digit2") dial.chiaro = Math.min(1, dial.chiaro + 0.08);           // 2 — harder single-direction light (unlit side → black)
      if (e.code === "Digit3") dial.webGain = Math.max(0, dial.webGain - 0.15);         // 3 — fewer/fainter connective filaments
      if (e.code === "Digit4") dial.webGain = Math.min(2.5, dial.webGain + 0.15);       // 4 — the WEB strings up (breath still strings it live)
      if (e.code === "Digit9") dial.shadowComp = Math.max(0, dial.shadowComp - 0.1);   // 9 — less shadow-complement (toward black)
      if (e.code === "Digit0") dial.shadowComp = Math.min(1.5, dial.shadowComp + 0.1); // 0 — more shadow-complement (the second colour)
      if (e.code === "Digit7") { if (e.shiftKey) dial.hueSpan = Math.max(0.0, dial.hueSpan - 0.08); else dial.hueSpread = Math.max(0, dial.hueSpread - 0.1); }   // 7 spread narrower · SHIFT+7 = FEWER colours per letter (bigger bands)
      if (e.code === "Digit8") { if (e.shiftKey) dial.hueSpan = Math.min(1.5, dial.hueSpan + 0.08); else dial.hueSpread = Math.min(1.2, dial.hueSpread + 0.1); }   // 8 spread wider · SHIFT+8 = MORE colours per letter
      if (e.code === "Digit5") revealBase = Math.max(0.05, revealBase - 0.15);          // 5 — smaller letter-fragments (the drift) — sets the RESTING baseline (no longer stomped by note→form)
      if (e.code === "Digit6") revealBase = Math.min(2.0, revealBase + 0.15);           // 6 — toward WHOLE letters (the N switch reads clearly)
      /* SILHOUETTE RIM — arrow cluster (brackets are FOV). ↑/↓ strength · ←/→ edge thickness */
      /* PRESENCE REACH — Shift+↑/↓. Every letter and every digit was already
         bound, so the Bee's reach takes the SHIFT LAYER of the arrow cluster.
         The unshifted rim handlers below are guarded accordingly: they did not
         test shiftKey, so without the guard Shift+↑ would move rim AND reach.
         Radius is a uniform float (simArr[213]) — live, no recompile. Default
         14 against a field 130 across is a whisper in a stadium; this is the
         dial that finds the true one, and the HUD prints it so the number
         SURVIVES the tab closing. */
      if ((e.code === "ArrowUp" || e.code === "ArrowDown") && e.shiftKey && flock.presence) {
        const d = (e.code === "ArrowUp") ? 4 : -4;
        flock.presence.r = clamp(flock.presence.r + d, 1, 200);
        H.line("status", "BEE REACH " + flock.presence.r.toFixed(0) +
          " — she is felt by everything within " + flock.presence.r.toFixed(0) + " of her");
        e.preventDefault();
      }
      if (e.code === "ArrowUp" && !e.shiftKey)   { dial.rim = Math.min(3, dial.rim + 0.12); e.preventDefault();
        H.line("status", "SILHOUETTE RIM " + dial.rim.toFixed(2) + " — the outline draws the concave side too"); }
      if (e.code === "ArrowDown" && !e.shiftKey) { dial.rim = Math.max(0, dial.rim - 0.12); e.preventDefault();
        H.line("status", dial.rim > 0.001 ? "SILHOUETTE RIM " + dial.rim.toFixed(2) + " — outlines the letters against the void" : "SILHOUETTE RIM OFF"); }
      if (e.code === "ArrowRight"){ dial.rimSharp = Math.min(12, dial.rimSharp + 0.5); e.preventDefault(); H.line("status", "rim edge THINNER — sharpness " + dial.rimSharp.toFixed(1)); }
      if (e.code === "ArrowLeft") { dial.rimSharp = Math.max(0.5, dial.rimSharp - 0.5); e.preventDefault(); H.line("status", "rim edge WIDER — sharpness " + dial.rimSharp.toFixed(1)); }
      if (e.code === "Slash" || e.code === "Backslash") { noteForm = !noteForm;         // / (or \) — NOTE→FORM: EWI notes summon the form on/off
        H.line("status", noteForm ? "NOTE→FORM ON — your notes summon the body (/ off)" : "NOTE→FORM OFF — manual dials"); }
      applyDials();
    });
    global.addEventListener("keyup", (e) => { if (e.code === "KeyB") ZC.Perf.sim(0); });
    canvas.addEventListener("pointerdown", (e) => {
      const r = canvas.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = 1 - ((e.clientY - r.top) / r.height) * 2;
      Sickle.strike(ANCHOR[0] + nx * 70, ANCHOR[1] + ny * 50, ANCHOR[2], 0.85);
    });

    Sickle.stage = "alive"; Sickle.booted = true;
    H.line("status", "alive — hold B to breathe · click or Space to strike · watch for faces");
    return { ok: true, flock };
  };

})(typeof window !== "undefined" ? window : globalThis);

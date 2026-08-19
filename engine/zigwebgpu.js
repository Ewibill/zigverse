/* =============================================================================
   ZigWebGPU — the Zigverse GPU vault (WebGPU compute + render backend)
   v0.1 · classic script · exposes a global `ZigWebGPU`
   Load AFTER zigcore.js, BEFORE the species:
     <script src="zigcore.js"></script>
     <script src="zigwebgpu.js"></script>
     <script src="species/murmuration.js"></script>

   What lives here is ENGINE, not species — every emergent swarm inherits it:
     · probe()        — the WebGPU render-probe gate (venue readiness)
     · init(canvas)   — device / context / depth / MSAA plumbing + resize
     · mat            — minimal mat4 (perspective · lookAt · multiply)
     · Watchdog       — rolling-fps → quality-tier stepper (LIVE mode only)
     · createFlock()  — THE FLOCK KERNEL:
         - spatial hash grid (fixed-capacity cells, atomic insert)
         - TOPOLOGICAL 7-nearest-neighbor boids (rank, not radius — the law
           that lets a murmuration morph without tearing)
         - impulse-wave propagation (a strike at a point → a wavefront kick)
         - neighbor agitation contagion (the social wave — spreads one
           neighbor-hop per step, far faster than any bird flies)
         - per-agent Drive-swell delay taps (the breath, read at each agent's
           own lag → the performer's swell travels the cloud as a wave)
         - banking → broadside/edge-on shimmer (the dark band, emergent)
         - double-buffered state → deterministic under export mode
   Species supply: meanings (what breath/attack/bend DO), palette, Director.
   ========================================================================== */
(function (global) {
  "use strict";
  const ZigWebGPU = global.ZigWebGPU || (global.ZigWebGPU = {});
  ZigWebGPU.VERSION = "0.46.0";   // 0.46.0: GROUND IS WIRED — a declared ground now sets the sky triple, the three scene clear values (NOT the trail's two, where black means zero), the afterimage's compositing/decay/gate, and the Radiance room, from one word. Signed compositing is SPLICED, so `void` and `dusk` emit the base afterimage byte for byte. THE FAULT THAT COST 8/18: the base blitFs never used the uniform, so `layout:"auto"` gave it a 2-entry layout; the signed blitFs uses A.lift, the layout became 3, and every bind group was rejected — 1,240 driver errors per run at 165fps with a black screen. A shader splice that changes WHICH BINDINGS A STAGE USES changes its auto-derived layout · 0.45.1: RADIANCE RIDES THE RAIL — the law no longer splices itself; it files a claim at station "tone" on ZigCore.Canon.Order's `frame.light` rail and the rail emits at one insertion point in declared station order. When AMBIENCE lands at "medium" it is emitted BEFORE the tone remap without a character of the radiance block changing, which is the Ambience-vs-Radiance collision settled in the contract instead of re-litigated per build. Byte-identical to 0.45.0 across the whole option matrix · 0.45.0: RADIANCE (opts.radiance — the FIRST Canon law: the room is a light source with no falloff, so perceived = displayed + veil and the shadow RATIOS that carry the modelling collapse in a lit space. A hue-preserving luminance remap (black-point · gain · shadow gamma · soft knee) spliced at the end of BOTH fragment paths; the live dial V.render6.w cross-fades it against itself. Not one character emitted when opts.radiance is absent) · 0.44.2: two more Metal failures the LANTERN module carried — its truncated View struct stopped at render4 while the note-flash block read render5, and its corner table was a mutable local array that overflowed Metal's small vertex stack. nvidia tolerated both · 0.44.1:   // 0.44.1: the LANTERN module referenced BEE_SIZE, a constant declared only in the BIRD module — nvidia tolerated the dangling reference, Metal refused it and the whole render pipeline failed to build (black canvas, healthy HUD, 60fps). Each WGSL block is a separate module and must declare what it uses · 0.44:   // 0.44: SEPCAP (opts.sepCap — the overlap force is unbounded and SUMS over neighbours, so a shard buried in twenty others was kicked 10-50x harder than anything else in the world; per-pair and total ceilings put it back in the same regime; byte-identical when absent) · 0.43.4:   // 0.43.4: the BEE varying is declared for EVERY consumer (BEE or NOTEFLASH) — the flash reads inp.bee, so turning the bee OFF while flash was ON left the fragment stage referencing an undeclared varying; bee-on worked and bee-off went black · 0.43.3:   // 0.43.3: the BEE varying inserts ABOVE the near line, never between it and the closing brace — MATERIAL anchors on "near ... };" as ONE string, so anything placed BETWEEN them destroys that anchor whichever slot it claims; verified order-independent both ways · 0.43.2:   // 0.43.2: the BEE varying is SPLICED at @location(11) instead of written into BirdOut — MATERIAL appends its own @location(10) snw by anchoring on the struct's last line + closing brace, so editing that text both collided on slot 10 and broke the anchor (black canvas) · 0.43.1:   // 0.43.1: the NOTE FLASH is THE BEE ALONE (a bee varying on BirdOut gates it) — lighting every shard's cup made the whole field answer the note and lost her in it; one lit interior among a thousand dark ones is the point · 0.43: NOTE FLASH (opts.noteFlash — the two faces answer a note DIFFERENTLY: the cupped INTERIOR takes the pitch-class hue while the OUTSIDE takes one fixed colour, so a turning field alternates a constant skin with an interior that differs for every pitch; render6 declared LAST in the View struct so nothing already hand-indexed shifts; byte-identical when absent) · 0.42: THE BEE FLASHES THE NOTE (render5.z/w)/12 mapping MELODIC STRATA already uses, so a C is the same colour as a band or as her flash; her lantern is also 2.7x larger because her flash is an EVENT not one firefly among thousands; byte-identical at render5.w = 0) · 0.41: THE BEE (agent #0 drawn at 1.45x and swelling with charisma — the SAME letterform as every shard, only larger and self-lit, so the field turning toward her reads as recognition rather than alarm; never hidden by UNSEEN) · 0.40: UNSEEN (opts.unseen — a fraction of the flock fully PRESENT to the physics and not DRAWN. The crowd and the eye want opposite things: contagion and murmur need numbers, legibility needs room. Render-side splice only, so hidden agents still flock, collide, carry contagion and count as neighbours — the shards you see are moved by neighbours you cannot; byte-identical at 0) · 0.39: ONSET (opts.onset — agitation may only RISE over a time constant instead of snapping to full in one frame; the max() gave contagion an instant attack and a slow release, i.e. a popcorn envelope, and agit drives vmax so a single-frame spike made individual shards DART. Brackets the contagion line rather than replacing it, since VOICE claims that text. Performer strikes stay instant; byte-identical at 0) · 0.38: CONTACT (opts.contact {r,k,damp} — matter that OCCUPIES SPACE, reusing the flock's own spatial grid; separation is a preference and can be overpowered, this cannot; SCATTER rewritten as GATHER so each thread keeps its own half of every pair; parity-checked against ZigCore.Contact.self by tools/parity_contact.html; byte-identical when absent) · 0.37: STRUCTURE (opts.structure — matter that is JOINED: spring + damping + momentum-conserving bend, SCATTER rewritten as GATHER so a compute thread only writes its own slot; chains only; parity-checked against ZigCore.Structure.accel by tools/parity_structure.html; byte-identical when absent) ·   // 0.34: INTERIOR BUFF (back-face relief ×0.35 + specular broadened/dimmed + gem glints ×0.5 on !ff — the mesh facet seams stop catching as hard straight lines on the back; front keeps full crisp relief; byte-identical on the front face) · 0.33: GEM FACE (opts.gemFace — "inside" = the SEASHELL: matte material on the outside, gem nacre in the cupped interior; "outside"/"both" too; guards the gem's c=gc by front_facing; byte-identical at "both") · 0.32: MELODIC STRATA (View.noteBands[6] · view[84..107] — each EWI note blooms a band of light at its pitch-height in its pitch-class colour, fading over time; the melody written onto the body's vertical axis; driven by ZC.NoteField; zero when silent) · 0.31: SILHOUETTE RIM (live V.render5.x/y — a fresnel edge re-draws every letter's outline against the void, legible under any material on either face; face-corrected so the concave back outlines too; zero at render5.x=0; the reusable legibility capability all species inherit) · 0.30: GEM MATERIALS (opts.gem — refraction + dispersion fire + fresnel sky-reflection + facet flash + sparkle, sampling the analytic sky; byte-identical off) · 0.29: FABRIC UNDERSIDE (opts.backFabric — 20 textiles: weave pattern + sheen model + colour lining the concave back; byte-identical off) · 0.28: VELVET UNDERSIDE (opts.backVelvet — a different fabric skin on the back face: deep matte + grazing sheen; byte-identical off) · 0.27: MEMORY UNDERSIDE (opts.memoryBack — the back face glows with a lagging ghost of the recent phrase; the 2nd performance surface; render4.y/z; byte-identical off) · 0.26: CHIAROSCURO (opts.chiaro — back off ambient/fill so only the light-facing side shows, unlit → black; byte-identical at 0) · 0.25: WEB — connective filaments between neighbouring agents (grid-driven K-NN compute + instanced thread render; breath strings the web; byte-identical when opts.web absent) · 0.24: GRAIN THROUGH COLOUR — the skin's grain corrugates the spectrum too, so surface texture survives at full ink (byte-identical without material/spectrum) · 0.22: BOUNDARY · 0.23: COMPOSE — spectrum TINTS the material body (visible on pale skins; ink I/K = solid↔rainbow amount over the pigment) · 0.19: MEDIUM · 0.20: FORCES · 0.21: CURRENT (opts.boundary {shape,r,k,lo?,hi?} — the world's SHAPE: a soft cylinder/sphere that holds matter inside a volume; restoring accel before integrate, composes with all; byte-identical when absent) // 0.35: BOUNDARY AXIS — cylinder law holds along any free axis (capsule = horizontal cigar); byte-identical for axis "y" · 0.35.1: GYRE AXIS — current circulates around any axis (roll a horizontal cigar broadside); byte-identical for gyre axis "y" · 0.36: ELLIPSOID boundary (lens — squashed sphere, per-axis radii; the wide breathing disc); byte-identical for sphere/cylinder

  /* ---- probe — the gate. Green or it doesn't ship. ---------------------- */
  ZigWebGPU.probe = async function () {
    if (!global.navigator || !navigator.gpu)
      return { ok: false, reason: "WebGPU unavailable — use Chrome/Edge 113+ (or enable chrome://flags/#enable-unsafe-webgpu)" };
    let adapter = null;
    try { adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" }); }
    catch (e) { return { ok: false, reason: "requestAdapter failed: " + e }; }
    if (!adapter) return { ok: false, reason: "No WebGPU adapter (GPU drivers / headless?)" };
    const info = adapter.info || {};
    const desc = [info.vendor, info.architecture, info.device].filter(Boolean).join(" · ") || "adapter";
    return { ok: true, adapter, desc };
  };

  /* ---- minimal mat4 (column-major, WebGPU clip space z 0..1) ------------- */
  ZigWebGPU.mat = {
    persp(fovY, aspect, near, far) {
      const f = 1 / Math.tan(fovY / 2), o = new Float32Array(16);
      o[0] = f / aspect; o[5] = f;
      o[10] = far / (near - far); o[11] = -1;
      o[14] = (near * far) / (near - far);
      return o;
    },
    lookAt(eye, c, up) {
      const zx = eye[0] - c[0], zy = eye[1] - c[1], zz = eye[2] - c[2];
      let zl = Math.hypot(zx, zy, zz) || 1; const Z = [zx / zl, zy / zl, zz / zl];
      const X0 = up[1] * Z[2] - up[2] * Z[1], X1 = up[2] * Z[0] - up[0] * Z[2], X2 = up[0] * Z[1] - up[1] * Z[0];
      let xl = Math.hypot(X0, X1, X2) || 1; const X = [X0 / xl, X1 / xl, X2 / xl];
      const Y = [Z[1] * X[2] - Z[2] * X[1], Z[2] * X[0] - Z[0] * X[2], Z[0] * X[1] - Z[1] * X[0]];
      const o = new Float32Array(16);
      o[0] = X[0]; o[1] = Y[0]; o[2] = Z[0];
      o[4] = X[1]; o[5] = Y[1]; o[6] = Z[1];
      o[8] = X[2]; o[9] = Y[2]; o[10] = Z[2];
      o[12] = -(X[0] * eye[0] + X[1] * eye[1] + X[2] * eye[2]);
      o[13] = -(Y[0] * eye[0] + Y[1] * eye[1] + Y[2] * eye[2]);
      o[14] = -(Z[0] * eye[0] + Z[1] * eye[1] + Z[2] * eye[2]);
      o[15] = 1;
      return o;
    },
    mul(a, b) {           // a * b
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
      return o;
    }
  };

  /* ---- Watchdog — fps → quality tier (live mode ONLY; export pins max) --- */
  ZigWebGPU.Watchdog = function (tiers, onTier) {
    let tier = 0, acc = 0, n = 0, low = 0, high = 0;
    return {
      get tier() { return tier; },
      update(dt) {
        if (global.ZigCore && global.ZigCore.mode === "export") return;   // exactly wrong in export
        acc += dt; n++;
        if (acc >= 0.5) {
          const fps = n / acc; acc = 0; n = 0;
          if (fps < 48) { low += 0.5; high = 0; } else if (fps > 57) { high += 0.5; low = 0; } else { low = 0; high = 0; }
          if (low >= 2 && tier < tiers.length - 1) { tier++; low = 0; onTier(tier, tiers[tier], fps); }
          else if (high >= 8 && tier > 0) { tier--; high = 0; onTier(tier, tiers[tier], fps); }
        }
      }
    };
  };

  /* ---- init — device, context, depth+MSAA, resize ------------------------ */
  ZigWebGPU.init = async function (canvas, opts) {
    opts = opts || {};
    const probe = await ZigWebGPU.probe();
    if (!probe.ok) throw new Error(probe.reason);
    /* Storage-buffer headroom: the step kernel can reach ~10 storage buffers
       (flock 6 + flow + skin + arousal ×2) — past the default per-stage cap of
       8. Request as much as the adapter allows (up to 16), so behavior laws that
       add per-agent buffers don't overflow the stage. Fall back to defaults if
       the raised request is refused. NOTE: headless SwiftShader reports a higher
       default than real GPUs, so this ceiling MUST be verified on hardware. */
    const _adapter = probe.adapter;
    const _cap = (_adapter.limits && _adapter.limits.maxStorageBuffersPerShaderStage) || 8;
    const _want = Math.min(_cap, 16);
    let device;
    try {
      device = await _adapter.requestDevice(
        _want > 8 ? { requiredLimits: { maxStorageBuffersPerShaderStage: _want } } : undefined);
    } catch (e) {
      console.warn("[ZigWebGPU] raised storage-buffer limit refused, using defaults:", e && e.message);
      device = await _adapter.requestDevice();
    }
    // node telemetry: surface every GPU validation error — a silent black screen
    // at a venue is the enemy (Venue Node Spec §3)
    device.addEventListener("uncapturederror", (e) => console.error("[ZigWebGPU]", e.error && e.error.message));
    device.lost.then((info) => console.error("[ZigWebGPU] device lost:", info.reason, info.message));
    const context = canvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();
    // COPY_SRC: the frame is readable — the seed of the export-capture pipeline
    // (Output Targets doc: capture frames → ffmpeg → 4K file) and of verification.
    context.configure({ device, format, alphaMode: "opaque", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    const gpu = {
      device, context, format, canvas, probe,
      sampleCount: opts.msaa === false ? 1 : 4,
      depthTex: null, msaaTex: null, w: 0, h: 0,
      ensureTargets() {
        const dpr = (+global.ZIG_DPR > 0) ? +global.ZIG_DPR : Math.min(global.devicePixelRatio || 1, 2);   // RENDER SCALE: #dpr=1 halves each axis on a retina panel
        const w = Math.max(8, Math.floor(canvas.clientWidth * dpr) || canvas.width);
        const h = Math.max(8, Math.floor(canvas.clientHeight * dpr) || canvas.height);
        if (w === this.w && h === this.h && this.depthTex) return;
        canvas.width = w; canvas.height = h; this.w = w; this.h = h;
        if (this.depthTex) this.depthTex.destroy();
        if (this.msaaTex) this.msaaTex.destroy();
        this.depthTex = device.createTexture({
          size: [w, h], sampleCount: this.sampleCount,
          format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.msaaTex = this.sampleCount > 1 ? device.createTexture({
          size: [w, h], sampleCount: this.sampleCount,
          format, usage: GPUTextureUsage.RENDER_ATTACHMENT
        }) : null;
      }
    };
    gpu.ensureTargets();
    return gpu;
  };

  /* ========================================================================
     THE MEMORY GLASS — Afterimage law (v0.7 · 2026-07-20)
     TD's TOP-feedback idea absorbed as an engine capability: the glass itself
     remembers light. The world renders into an offscreen scene texture; a
     trail pass folds it into a persistence buffer by the PHOSPHOR LAW —
        trail = max(scene, prevTrail · decay − Îµ)
     max() means feedback can NEVER blow out (steady state = the scene
     itself); Îµ defeats unorm rounding so every ghost truly reaches black.
     decay is computed per frame from a time constant Ï (seconds), so memory
     length is frame-rate independent. Ï ≤ 0.02 → decay 0 → byte-exact
     passthrough. Opt-in via scene.attachAfterimage(a) / flock.attach…();
     worlds that never attach render EXACTLY as before. Every species —
     Halo Field, Lake, Fireflies, futures — inherits this with one call.
     ===================================================================== */
  const AFTERIMAGE_BASE = `
struct AU { decay: f32, eps: f32, gate: f32, pad1: f32 };
@group(0) @binding(0) var<uniform> A: AU;
@group(0) @binding(1) var sceneT: texture_2d<f32>;
@group(0) @binding(2) var prevT: texture_2d<f32>;
struct FSQ { @builtin(position) cp: vec4f };
@vertex fn fsqVs(@builtin(vertex_index) vi: u32) -> FSQ {
  var o: FSQ; let xy = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  o.cp = vec4f(xy, 0.0, 1.0); return o;
}
/* THE GATE (v0.7.1): the glass remembers FLASHES, not flight. Only pixels
   brighter than 'gate' enter memory, so ordinary moving bodies stay crisp
   (no contrails) while tolls, strikes and glints leave ghosts. gate 0 =
   remember everything (the original phosphor). */
@fragment fn trailFs(inp: FSQ) -> @location(0) vec4f {
  let px = vec2i(inp.cp.xy);
  let s = textureLoad(sceneT, px, 0).rgb;
  let p = textureLoad(prevT, px, 0).rgb;
  let keep = smoothstep(A.gate, A.gate + 0.22, max(s.r, max(s.g, s.b)));
  return vec4f(max(s * keep, p * A.decay - vec3f(A.eps)), 1.0);
}
/* the glass = the crisp scene, with the memory glowing behind it */
@fragment fn blitFs(inp: FSQ) -> @location(0) vec4f {
  let px = vec2i(inp.cp.xy);
  let s = textureLoad(sceneT, px, 0).rgb;
  let t = textureLoad(prevT, px, 0).rgb;
  return vec4f(max(s, t), 1.0);
}`;

  /* GROUND 0.1.0 — SIGNED COMPOSITING (spliced, never rewritten).

     The base above is correct and stays untouched for every world whose ground
     is `void`: light accumulates upward out of black, and max() is exactly
     right. It is also what every build ever shipped emits, byte for byte.

     A LIT ground inverts the premise. `tools/ground_gap.mjs` measures the cost:
     the bright sky's own memory sits at 0.85 while a dark body draws at 0.25,
     so max(scene, trail) returns the SKY and the creature is erased by its own
     afterimage — in a shader that reports no error. The memory gate is a
     luminance FLOOR too, so the world remembers its empty sky at keep 1.000 and
     forgets the organism at 0.000.

     Every line below is the same operation measured from the ground instead of
     from zero, and each reduces exactly to the base when lift = 0:
       · FARTHER  — memory keeps the value furthest FROM the ground, not the
                    brightest, because on a pale field a dark body is the event
       · the gate — tests DISTANCE from the ground, not luminance
       · the gated scene — an ungated pixel falls back TO THE GROUND, not to
                    black; contributing black on a pale ground is contributing
                    maximal departure, which is how ungated pixels would win
       · the decay — memory fades TO the ground and STOPS there. Fading toward
                    zero slid past the floor into negative luminance, where
                    signed compositing ranked it above everything.

     The last two were design errors caught by the probe, not by reading. Both
     would have shipped as a screen full of darkness that was never drawn. The
     transcription is proved against ZigCore.Ground by test/law_ground_ref.mjs. */
  const AFTERIMAGE_SIGNED = `
/* GROUND: the value FURTHEST from the ground wins — per channel. */
fn gndFarther(a: vec3f, b: vec3f, g: f32) -> vec3f {
  return select(b, a, abs(a - vec3f(g)) >= abs(b - vec3f(g)));
}`;

  const AFTERIMAGE_WGSL = function (ground) {
    const base = AFTERIMAGE_BASE;
    if (!ground || ground.compose !== "signed") return base;          // void — untouched
    return base
      .replace("struct AU { decay: f32, eps: f32, gate: f32, pad1: f32 };",
               "struct AU { decay: f32, eps: f32, gate: f32, lift: f32 };" + AFTERIMAGE_SIGNED)
      .replace(
        "  let keep = smoothstep(A.gate, A.gate + 0.22, max(s.r, max(s.g, s.b)));\n" +
        "  return vec4f(max(s * keep, p * A.decay - vec3f(A.eps)), 1.0);",
        "  let g = vec3f(A.lift);\n" +
        "  let keep = smoothstep(A.gate, A.gate + 0.22, abs(max(s.r, max(s.g, s.b)) - A.lift));\n" +
        "  let gated = g + (s - g) * keep;                       // ungated falls back to the GROUND\n" +
        "  let d = p - g;\n" +
        "  let faded = g + sign(d) * max(abs(d) * A.decay - vec3f(A.eps), vec3f(0.0));   // fades TO the ground\n" +
        "  return vec4f(gndFarther(gated, faded, A.lift), 1.0);")
      .replace("  return vec4f(max(s, t), 1.0);",
               "  return vec4f(gndFarther(s, t, A.lift), 1.0);");
  };

  ZigWebGPU.createAfterimage = function (gpu, opts) {
    opts = opts || {};
    const device = gpu.device;
    /* GROUND 0.1.0 — the afterimage asks the world what its ground is. A world
       that never declares one resolves to `void`, and the shader below is then
       the base text unchanged, byte for byte. */
    const ZCg = global.ZigCore && global.ZigCore.Ground;
    const GND = opts.ground
      ? (typeof opts.ground === "string" ? (ZCg ? ZCg.resolve(opts.ground) : null) : opts.ground)
      : null;
    const AFTER_SRC = AFTERIMAGE_WGSL(GND);
    /* Does the BLIT stage use the uniform? `layout:"auto"` derives a layout
       from the bindings a stage statically uses, so this decides how many
       entries its bind group needs. Computed ONCE here — rebuilding a shader
       string inside a bind-group loop is wasteful and obscures the reason. */
    const blitNeedsU = /A\.lift/.test(AFTER_SRC);
    const mod = device.createShaderModule({ code: AFTER_SRC });
    const mkPipe = (entry) => device.createRenderPipeline({
      layout: "auto",
      vertex: { module: mod, entryPoint: "fsqVs" },
      fragment: { module: mod, entryPoint: entry, targets: [{ format: gpu.format }] },
      primitive: { topology: "triangle-list" }
    });
    const trailPipe = mkPipe("trailFs");
    const blitPipe = mkPipe("blitFs");
    const ubuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const uarr = new Float32Array(4);
    const after = {
      tau: opts.tau === undefined ? 1.2 : opts.tau,   // memory time-constant, seconds (≤0.02 = off)
      gate: opts.gate === undefined ? (GND && GND.gateAt !== undefined && GND.compose === "signed" ? GND.gateAt : 0)
                                    : opts.gate,      // luminance floor for memory (0 = remember all · ~0.45 = only flashes)
      lift: GND ? (GND.lift || 0) : 0,                // GROUND: the floor memory is measured from (0 = void, identity)
      /* GROUND — THE EMPTY TRAIL IS THE GROUND, NOT BLACK.
         This buffer clears to black because black is ZERO: nothing remembered.
         That is true only while the ground is at zero. Under signed
         compositing black is MAXIMALLY far from a lit ground, so a
         freshly-cleared trail outranks every real pixel and wins the whole
         frame — a black screen on `mist` and `paper`, found by Bill's eye on
         2026-08-18 after every probe passed. The probes could not see it: the
         reference sim seeds its buffer at the ground ("a world starts AT its
         ground") while the engine cleared to black, so the test was right about
         the arithmetic and silent about the initial condition. Third time this
         law has confused "empty" with "black". */
      gclear: (GND && GND.compose === "signed" && GND.sky)
        ? { r: GND.sky.mid[0], g: GND.sky.mid[1], b: GND.sky.mid[2], a: 1 }
        : { r: 0, g: 0, b: 0, a: 1 },
      w: 0, h: 0, sceneTex: null, trail: [null, null], flip: 0,
      _bgTrail: [null, null], _bgBlit: [null, null], _sceneView: null,
      _ensure() {
        if (this.w === gpu.w && this.h === gpu.h && this.sceneTex) return;
        this.w = gpu.w; this.h = gpu.h;
        const mk = () => device.createTexture({
          size: [gpu.w, gpu.h], format: gpu.format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        if (this.sceneTex) { this.sceneTex.destroy(); this.trail[0].destroy(); this.trail[1].destroy(); }
        this.sceneTex = mk(); this.trail = [mk(), mk()];        // fresh textures zero-clear: memory starts blank
        this._sceneView = this.sceneTex.createView();
        const tv = [this.trail[0].createView(), this.trail[1].createView()];
        for (let f = 0; f < 2; f++) {
          this._bgTrail[f] = device.createBindGroup({ layout: trailPipe.getBindGroupLayout(0), entries: [
            { binding: 0, resource: { buffer: ubuf } },
            { binding: 1, resource: this._sceneView },
            { binding: 2, resource: tv[f] }] });
          /* THE BLIT'S BIND GROUP DEPENDS ON THE SHADER IT IS FOR.

             `layout: "auto"` derives a layout from the bindings a stage
             STATICALLY USES. The base blitFs is `max(s, t)` and never touches
             the uniform, so its layout has two entries and this bind group
             matched. GROUND's signed blitFs calls gndFarther(s, t, A.lift) —
             it now uses binding 0, the layout becomes three entries, and a
             two-entry bind group is rejected:

               "Number of entries (2) did not match the expected number of
                entries (3) for [BindGroupLayoutInternal]"

             1,240 of those per run on Bill's RTX, cascading into invalid
             command buffers and a black screen — while the loop kept reporting
             165fps. This is the fault that cost 2026-08-18, and the lesson is
             narrow and worth stating: A SHADER SPLICE THAT CHANGES WHICH
             BINDINGS A STAGE USES CHANGES ITS AUTO-DERIVED LAYOUT. Byte
             identity cannot see it (the void text is unchanged), and a boot
             gate that only watches the loop cannot see it either. */
          this._bgBlit[f] = device.createBindGroup({ layout: blitPipe.getBindGroupLayout(0), entries:
            (blitNeedsU ? [{ binding: 0, resource: { buffer: ubuf } }] : []).concat([
            { binding: 1, resource: this._sceneView },
            { binding: 2, resource: tv[f] }]) });
        }
        this._tv = tv;
      },
      /* the world draws into this instead of the swapchain */
      sceneView() { this._ensure(); return this._sceneView; },
      /* fold scene → trail, blit trail → glass. Recorded on the SAME encoder. */
      run(enc, swapView, dt) {
        const decay = this.tau <= 0.02 ? 0 : Math.exp(-(dt || 1 / 60) / this.tau);
        uarr[0] = decay; uarr[1] = 0.6 / 255; uarr[2] = this.gate; uarr[3] = this.lift;   // [3] was pad1 — GROUND uses it, void writes 0
        device.queue.writeBuffer(ubuf, 0, uarr);
        const next = 1 - this.flip;
        const tp = enc.beginRenderPass({ colorAttachments: [{ view: this._tv[next], clearValue: this.gclear, loadOp: "clear", storeOp: "store" }] });
        tp.setPipeline(trailPipe); tp.setBindGroup(0, this._bgTrail[this.flip]); tp.draw(3); tp.end();
        const bp = enc.beginRenderPass({ colorAttachments: [{ view: swapView, clearValue: this.gclear, loadOp: "clear", storeOp: "store" }] });
        bp.setPipeline(blitPipe); bp.setBindGroup(0, this._bgBlit[next]); bp.draw(3); bp.end();
        this.flip = next;
      }
    };
    return after;
  };

  /* ========================================================================
     ZIGFLOW — THE MEDIUM ITSELF (v0.8 · 2026-07-21)
     Until now the organisms flew through dead air: forces reached them only
     as wires (breath, waves, neighbors). ZigFlow gives the WORLD a body — a
     coarse 3-D velocity grid every flock in a scene shares:
       · ambient weather: analytic curl noise (divergence-free by
         construction — winds swirl, never drain or pile up), breath-scaled
       · wavefronts STIR it: a gong strike leaves rotating currents in the
         air that outlive the visible front (the medium remembers)
       · the avatar wakes it: the pilot's passage drags the air behind her
       · it forgets: exponential damping, Ï ≈ 1/damp seconds
     Flocks with opts.flow sample the grid (trilinear) and lean toward the
     local wind. One flow per world; species without opts.flow compile the
     exact golden kernel. Deterministic — no RNG anywhere.
     ===================================================================== */
  const FLOW_WGSL = `
struct FU {
  dim: vec4f,                   // nx, ny, nz, cell size
  org: vec4f,                   // grid origin xyz, w dt
  par: vec4f,                   // x damp/s · y ambient gain · z time · w flock coupling (unused here)
  wav: vec4f,                   // x waveSpeed · y waveWidth · z waveLife · w breath
  imp: array<vec4f, 8>,         // xyz origin · w start time (<0 inactive)
  istr: array<vec4f, 8>,        // x strength ('meta' is WGSL-reserved)
  stir: vec4f,                  // avatar stir point xyz · w on/off
  stirV: vec4f,                 // avatar velocity xyz · w radius
};
@group(0) @binding(0) var<uniform> F: FU;
@group(0) @binding(1) var<storage, read_write> flow: array<vec4f>;

/* curl of a sinusoidal vector potential — divergence-free wind, proven in
   test/zigflow_ref.mjs by numeric divergence on the JS mirror */
fn curlN(p: vec3f, t: f32) -> vec3f {
  let s = 0.021;
  let a = p * s + vec3f(0.0, t * 0.03, 0.0);
  let cx = sin(a.x * 1.4 + 2.3) * (-sin(a.y * 1.2)) * 1.2 - cos(a.x * 0.9) * cos(a.z * 1.1 + 4.2) * 1.1;
  let cy = sin(a.y + 1.7) * (-sin(a.z * 1.3)) * 1.3 - cos(a.y * 1.2) * cos(a.x * 1.4 + 2.3) * 1.4;
  let cz = sin(a.z * 1.1 + 4.2) * (-sin(a.x * 0.9)) * 0.9 - cos(a.y + 1.7) * cos(a.z * 1.3);
  return vec3f(cx, cy, cz);
}

@compute @workgroup_size(64)
fn stirFlow(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let nx = u32(F.dim.x); let ny = u32(F.dim.y); let nz = u32(F.dim.z);
  if (i >= nx * ny * nz) { return; }
  let cx = i % nx; let cy = (i / nx) % ny; let cz = i / (nx * ny);
  let p = F.org.xyz + (vec3f(f32(cx), f32(cy), f32(cz)) + 0.5) * F.dim.w;
  let dt = F.org.w;
  var v = flow[i].xyz;
  v *= exp(-F.par.x * dt);                                        // the air forgets
  v += curlN(p, F.par.z) * F.par.y * (0.35 + 1.9 * F.wav.w) * dt; // weather breathes with the horn
  /* wavefronts stir rotating currents that OUTLIVE the visible ring */
  for (var m = 0u; m < 8u; m++) {
    let im = F.imp[m];
    if (im.w < 0.0) { continue; }
    let age = F.par.z - im.w;
    let life = max(F.wav.z, 0.5);
    if (age < 0.0 || age > life) { continue; }
    let d = p - im.xyz;
    let r = max(length(d), 0.001);
    let dir = d / r;
    let x = abs(r - F.wav.x * age);
    let w = max(F.wav.y, 1.0) * 1.6;
    let g = exp(-x * x / (2.0 * w * w)) * F.istr[m].x * exp(-age * (2.45 / life));
    let tang = normalize(cross(dir, vec3f(0.0, 1.0, 0.0)) + vec3f(0.0, 0.001, 0.0));
    v += (dir * 0.55 + tang * 0.85) * g * 7.0 * dt;
  }
  /* the pilot's wake — flying through the air drags it along */
  if (F.stir.w > 0.5) {
    let dd = p - F.stir.xyz;
    let sg = exp(-dot(dd, dd) / (2.0 * F.stirV.w * F.stirV.w));
    v += F.stirV.xyz * sg * 1.4 * dt;
  }
  let sp = length(v);
  if (sp > 14.0) { v *= 14.0 / sp; }                              // currents, not cannons
  flow[i] = vec4f(v, 0.0);
}`;

  ZigWebGPU.createFlow = function (gpu, opts) {
    opts = opts || {};
    const device = gpu.device;
    const EXT = opts.extent || 240, EXTY = opts.extentY || 240, CELL = opts.cell || 8;
    const NX = Math.ceil((EXT * 2) / CELL), NY = Math.ceil(EXTY / CELL), NZ = NX;
    const CELLS = NX * NY * NZ;
    const buf = device.createBuffer({ size: CELLS * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const ubuf = device.createBuffer({ size: 88 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const fu = new Float32Array(88);
    const mod = device.createShaderModule({ code: FLOW_WGSL });
    const pipe = device.createComputePipeline({ layout: "auto", compute: { module: mod, entryPoint: "stirFlow" } });
    const bg = device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: ubuf } },
      { binding: 1, resource: { buffer: buf } }] });
    return {
      buf, ubuf, NX, NY, NZ, CELL, EXT, EXTY,
      gain: opts.gain === undefined ? 1.2 : opts.gain,       // how hard wings lean toward the wind (1/s)
      damp: opts.damp === undefined ? 0.35 : opts.damp,      // the air's forgetting rate (Ï ≈ 2.9 s)
      ambient: 1.0,                                          // weather amplitude (species scale it with breath)
      /* one stir of the world's air per frame. state supplies clock, waves,
         breath; stir (optional) = { x,y,z, vx,vy,vz, radius } for the wake. */
      frame(state, stir) {
        fu[0] = NX; fu[1] = NY; fu[2] = NZ; fu[3] = CELL;
        fu[4] = -EXT; fu[5] = 0; fu[6] = -EXT; fu[7] = state.dt || 1 / 60;
        fu[8] = this.damp; fu[9] = this.ambient; fu[10] = state.time || 0; fu[11] = this.gain;
        fu[12] = state.waveSpeed || 30; fu[13] = state.waveWidth || 8;
        fu[14] = state.waveLife || 3.5; fu[15] = state.breath || 0;
        for (let m = 0; m < 8; m++) {
          const im = state.impulses && state.impulses[m];
          const o = 16 + m * 4, o2 = 48 + m * 4;
          if (im && im.t0 >= 0) {
            fu[o] = im.o[0]; fu[o + 1] = im.o[1]; fu[o + 2] = im.o[2]; fu[o + 3] = im.t0;
            fu[o2] = im.strength;
          } else { fu[o + 3] = -1; fu[o2] = 0; }
        }
        if (stir) {
          fu[80] = stir.x; fu[81] = stir.y; fu[82] = stir.z; fu[83] = 1;
          fu[84] = stir.vx || 0; fu[85] = stir.vy || 0; fu[86] = stir.vz || 0; fu[87] = stir.radius || 7;
        } else { fu[83] = 0; }
        device.queue.writeBuffer(ubuf, 0, fu);
        const enc = device.createCommandEncoder();
        const cp = enc.beginComputePass();
        cp.setPipeline(pipe); cp.setBindGroup(0, bg); cp.dispatchWorkgroups(Math.ceil(CELLS / 64));
        cp.end();
        device.queue.submit([enc.finish()]);
      }
    };
  };

  /* ========================================================================
     THE MEMBRANE — elastic space (v0.10 · Scout's law, 2026-07-22)
     "The bubble is not the artwork. The bubble is the physics field."
     An invisible elastic sphere lives in the world: a damped wave equation
     on its surface (disturbances PROPAGATE — negotiations, not waves-in-
     lockstep), surface tension (every deformation carries cost; bulges
     shrink, tight curves relax, nothing oscillates forever), and Scout's
     TOPOLOGICAL MEMORY: the rest shape slowly becomes what the surface has
     lived (Ï≈45 s), then forgets (Ï≈220 s). The membrane is NEVER rendered.
     Flocks with opts.skin sample it and inherit its local geometry — the
     organisms reveal the field. Breath changes ELASTICITY, not shape: a
     performer changes the weather, not the geometry.
     Simulated on CPU (512 cells, trivial) → uploaded as a storage buffer;
     the pure step lives in ZigWebGPU.membraneStep for Node-side law proofs.
     ===================================================================== */
  /* pure physics — F: {u,v,mem,lap: Float32Array(nt*np), nt, np} · P: params */
  ZigWebGPU.membraneStep = function (F, dt, P) {
    const nt = F.nt, np = F.np, u = F.u, v = F.v, mem = F.mem, lap = F.lap;
    const c2 = P.c2, k = P.k, damp = P.damp, memW = P.memW, maxU = P.maxU;
    for (let t = 0; t < nt; t++) {
      for (let p = 0; p < np; p++) {
        const i = t * np + p;
        const pl = t * np + (p + np - 1) % np, pr = t * np + (p + 1) % np;
        const pt = (t > 0 ? t - 1 : 0) * np + p, pb = (t < nt - 1 ? t + 1 : nt - 1) * np + p;
        lap[i] = u[pl] + u[pr] + u[pt] + u[pb] - 4 * u[i];
        /* TOPOLOGICAL MEMORY acts on CURVATURE too: the remembered shape
           becomes the surface's rest GEOMETRY, not just a local pull — so a
           held dent stays a dent instead of diffusing flat. Steady state:
           u → memW·mem, exactly the lived shape, slowly forgotten. */
        const memLap = mem[pl] + mem[pr] + mem[pt] + mem[pb] - 4 * mem[i];
        const a = c2 * (lap[i] - memW * memLap) - k * (u[i] - memW * mem[i]) - damp * v[i];
        v[i] += a * dt;
      }
    }
    let mean = 0;
    for (let i = 0; i < nt * np; i++) {
      u[i] += v[i] * dt;
      if (u[i] > maxU) { u[i] = maxU; if (v[i] > 0) v[i] = 0; }
      if (u[i] < -maxU) { u[i] = -maxU; if (v[i] < 0) v[i] = 0; }
      mean += u[i];
    }
    mean /= nt * np;
    for (let i = 0; i < nt * np; i++) {
      u[i] -= mean * 0.02;                                     // the bubble keeps its volume
      mem[i] += (u[i] - mem[i]) * Math.min(1, dt / P.tauMem);  // the pillow remembers
      mem[i] *= Math.exp(-dt / P.tauForget);                   // …and slowly forgets
    }
  };

  ZigWebGPU.createMembrane = function (gpu, opts) {
    opts = opts || {};
    const device = gpu.device;
    const NT = opts.nt || 24, NP = opts.np || 48, CELLS = NT * NP;
    const C = opts.center || [0, 62, 0], R0 = opts.radius || 34;
    const F = { nt: NT, np: NP, u: new Float32Array(CELLS), v: new Float32Array(CELLS),
                mem: new Float32Array(CELLS), lap: new Float32Array(CELLS) };
    const buf = device.createBuffer({ size: CELLS * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const ubuf = device.createBuffer({ size: 12 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const cells = new Float32Array(CELLS * 4);
    const uarr = new Float32Array(12);
    return {
      buf, ubuf, F, C, R0, NT, NP,
      elastic: 0,                    // 0 = rigid (silence) · 1 = willing (full breath)
      attractW: 2.6, alignW: 1.9, stressGain: 0.55,
      sigma: 0, depth: 0,            // HUD telemetry: current deformation · memory depth
      /* a disturbance enters the surface at the nearest point */
      poke(x, y, z, str) {
        const d = [x - C[0], y - C[1], z - C[2]];
        const r = Math.hypot(d[0], d[1], d[2]) || 1;
        const th = Math.acos(Math.max(-1, Math.min(1, d[1] / r)));
        const ph = Math.atan2(d[2], d[0]);
        const ct = Math.min(NT - 1, Math.max(0, Math.floor(th / Math.PI * NT)));
        const cp = ((Math.floor((ph + Math.PI) / (2 * Math.PI) * NP)) % NP + NP) % NP;
        const s = (str || 0.8) * 26;
        for (let dt2 = -2; dt2 <= 2; dt2++) for (let dp = -2; dp <= 2; dp++) {
          const t = Math.min(NT - 1, Math.max(0, ct + dt2)), p = ((cp + dp) % NP + NP) % NP;
          F.v[t * NP + p] += s * Math.exp(-(dt2 * dt2 + dp * dp) / 2.5);
        }
      },
      frame(dt) {
        const e = this.elastic;
        /* breath is WEATHER: elasticity softens tension, quickens travel */
        ZigWebGPU.membraneStep(F, Math.min(dt, 1 / 30), {
          c2: 85 * (1.10 - 0.50 * e), k: 1.15 * (1 - 0.75 * e), damp: 0.50 * (1 - 0.40 * e),   // tension = fast waves + flat skin; breath softens BOTH
          memW: 0.60, tauMem: 30, tauForget: 220, maxU: R0 * 0.32
        });
        let sg = 0, dp = 0;
        for (let i = 0; i < CELLS; i++) {
          cells[i * 4] = F.u[i]; cells[i * 4 + 1] = F.v[i]; cells[i * 4 + 2] = F.lap[i]; cells[i * 4 + 3] = F.mem[i];
          const au = Math.abs(F.u[i]); if (au > sg) sg = au;
          const am = Math.abs(F.mem[i]); if (am > dp) dp = am;
        }
        this.sigma = sg; this.depth = dp;
        device.queue.writeBuffer(buf, 0, cells);
        uarr[0] = C[0]; uarr[1] = C[1]; uarr[2] = C[2]; uarr[3] = R0;
        uarr[4] = NT; uarr[5] = NP; uarr[6] = this.attractW; uarr[7] = this.alignW;
        uarr[8] = this.stressGain; uarr[9] = 0; uarr[10] = 0; uarr[11] = 0;
        device.queue.writeBuffer(ubuf, 0, uarr);
      }
    };
  };

  /* ========================================================================
     SCENE — a shared world many species draw into.
     Owns the camera (view uniform), the sky, and the shared depth/MSAA pass.
     Species call computeInto(encoder) then recordInto(pass); the scene
     sequences them so a fish school, a kelp forest and a murmuration can
     inhabit ONE tank with correct depth, one camera, one light. This is the
     engine's "installation" primitive — every layered piece inherits it.
     NB: the View struct here MIRRORS the one in the flock kernel; keep in sync.
     ===================================================================== */
  const SCENE_SKY_WGSL = `
struct View {
  viewProj: mat4x4f, camPos: vec4f, camRight: vec4f, camUp: vec4f, camFwd: vec4f,
  sunDir: vec4f, skyTop: vec4f, skyMid: vec4f, horizon: vec4f, ground: vec4f,
  sunCol: vec4f, birdDark: vec4f, birdLight: vec4f, render: vec4f, render2: vec4f, render3: vec4f,
};
@group(0) @binding(0) var<uniform> V: View;
struct SkyOut { @builtin(position) cp: vec4f, @location(0) uv: vec2f };
@vertex fn skyVs(@builtin(vertex_index) vi: u32) -> SkyOut {
  var o: SkyOut; let xy = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  o.cp = vec4f(xy, 0.9999, 1.0); o.uv = xy; return o;
}
fn skyColor(dir: vec3f) -> vec3f {
  let y = dir.y;
  var col = mix(V.horizon.rgb, V.skyMid.rgb, smoothstep(-0.02, 0.28, y));
  col = mix(col, V.skyTop.rgb, smoothstep(0.22, 0.85, y));
  let s = max(dot(dir, normalize(V.sunDir.xyz)), 0.0);
  col += V.sunCol.rgb * (pow(s, 350.0) * 1.4 + pow(s, 24.0) * 0.35) * V.sunDir.w;
  if (y < 0.0) { col = mix(col, V.ground.rgb, smoothstep(0.0, -0.06, y)); }
  return col;
}
fn marineSnow(dir: vec3f) -> vec3f {
  let sp = dir.xy * 70.0 + vec2f(0.0, V.camPos.w * 0.5);
  let cell = floor(sp); let hh = fract(sin(dot(cell, vec2f(19.73, 83.11))) * 3571.31);
  let d = fract(sp) - 0.5; let mote = smoothstep(0.13, 0.0, length(d)) * step(0.86, hh);
  return vec3f(0.55, 0.62, 0.60) * mote * (0.35 + 0.65 * max(dir.y, 0.0));
}
fn waterColor(dir: vec3f) -> vec3f {
  let y = dir.y; let deep = V.skyTop.rgb; let mid = V.skyMid.rgb; let surf = V.horizon.rgb;
  var col = mix(mid, deep, smoothstep(0.0, -0.75, y));
  col = mix(col, surf, smoothstep(0.05, 0.85, y));
  let sd = normalize(V.sunDir.xyz); let s = max(dot(dir, sd), 0.0);
  col = mix(col, surf * 1.5 + V.sunCol.rgb * 0.35, smoothstep(0.82, 0.995, y));
  col += V.sunCol.rgb * pow(s, 90.0) * 0.6 * V.sunDir.w;
  let ang = atan2(dir.x, dir.z);
  let ripple = 0.55 + 0.45 * sin(ang * 16.0 + V.camPos.w * 0.35) * sin(ang * 6.3 - V.camPos.w * 0.21);
  col += V.sunCol.rgb * pow(max(y, 0.0), 1.4) * pow(s, 2.5) * ripple * V.render2.y;
  col += marineSnow(dir) * V.ground.w;
  return col;
}
@fragment fn skyFs(inp: SkyOut) -> @location(0) vec4f {
  let aspect = V.camRight.w; let tf = V.camUp.w;
  let dir = normalize(V.camFwd.xyz + V.camRight.xyz * inp.uv.x * tf * aspect + V.camUp.xyz * inp.uv.y * tf);
  if (V.render.x > 0.5) { return vec4f(waterColor(dir), 1.0); }   // fish/underwater scene
  return vec4f(skyColor(dir), 1.0);                                // air scene
}`;

  ZigWebGPU.createScene = function (gpu, opts) {
    opts = opts || {};
    const device = gpu.device;
    const viewBuf = device.createBuffer({  size: 112 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });   // 112: +noteBands[6] strata (v0.32) +render6 note flash (v0.43)
    const drawSky = opts.sky !== false;
    /* GROUND 0.1.0 — the world's floor of light.

       The clear colour is a FALLBACK, not the background: the sky is a
       fullscreen triangle with depth writes off and depthCompare "always", so
       it paints over every pixel before an agent draws. `tools/ground_gap.mjs`
       proves the clear has been invisible in every build ever shipped. It
       matters only when a caller passes `sky:false` — and then it matters
       completely, which is why it is no longer a literal.

       Note the count: THREE clear values live in this file's render passes, not
       five. The other two belong to the trail accumulation buffer, where black
       means ZERO and a lit colour would flood the echo rather than light the
       world. Sweeping all five would have been the obvious change and the
       wrong one. */
    const ZCg = global.ZigCore && global.ZigCore.Ground;
    const GND = opts.ground
      ? (typeof opts.ground === "string" ? (ZCg ? ZCg.resolve(opts.ground) : null) : opts.ground)
      : null;
    const CLEAR = (GND && GND.sky && GND.lift > 0)
      ? { r: GND.sky.mid[0], g: GND.sky.mid[1], b: GND.sky.mid[2], a: 1 }
      : { r: 0, g: 0, b: 0, a: 1 };
    let skyPipe = null, skyBG = null;
    if (drawSky) {
      const mod = device.createShaderModule({ code: SCENE_SKY_WGSL });
      skyPipe = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: mod, entryPoint: "skyVs" },
        fragment: { module: mod, entryPoint: "skyFs", targets: [{ format: gpu.format }] },
        primitive: { topology: "triangle-list" },
        depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "always" },
        multisample: { count: gpu.sampleCount }
      });
      skyBG = device.createBindGroup({ layout: skyPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: viewBuf } }] });
    }
    return {
      gpu, viewBuf, species: [], _viewArr: null, _after: null,
      add(sp) { sp.attachScene(this); this.species.push(sp); return sp; },
      /* MEMORY GLASS (opt-in): the world renders into the afterimage's scene
         texture; the trail+blit passes carry it to the swapchain. Detached
         (the default), this path is byte-identical to golden. */
      attachAfterimage(a) { this._after = a; return this; },
      /* one world-frame: every species' compute, then sky, then every species' draw */
      frame(viewArr, states) {
        this._viewArr = viewArr;                      // forest reads eye/time from here
        device.queue.writeBuffer(viewBuf, 0, viewArr);
        gpu.ensureTargets();
        const enc = device.createCommandEncoder();
        for (let i = 0; i < this.species.length; i++) this.species[i].computeInto(enc, states[i]);
        const swapView = gpu.context.getCurrentTexture().createView();
        const target = this._after ? this._after.sceneView() : swapView;
        const rp = enc.beginRenderPass({
          colorAttachments: [{
            view: gpu.sampleCount > 1 ? gpu.msaaTex.createView() : target,
            resolveTarget: gpu.sampleCount > 1 ? target : undefined,
            clearValue: CLEAR, loadOp: "clear", storeOp: gpu.sampleCount > 1 ? "discard" : "store"
          }],
          depthStencilAttachment: { view: gpu.depthTex.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "discard" }
        });
        if (drawSky) { rp.setPipeline(skyPipe); rp.setBindGroup(0, skyBG); rp.draw(3); }
        for (let i = 0; i < this.species.length; i++) this.species[i].recordInto(rp);   // shared depth → correct compositing
        rp.end();
        if (this._after) this._after.run(enc, swapView, states[0] ? states[0].dt : 1 / 60);
        device.queue.submit([enc.finish()]);
      }
    };
  };

  /* ========================================================================
     THE FLOCK KERNEL
     ===================================================================== */
  ZigWebGPU.createFlock = function (gpu, opts) {
    opts = opts || {};
    /* GROUND 0.1.0 — a flock drawing its OWN pass (no scene) still needs a
       floor. Resolved here rather than borrowed from createScene, which is a
       different closure: reaching for a name that is merely nearby in the file
       is how a ReferenceError becomes a black canvas with no message. */
    const SELFCLEAR = (function () {
      const Z = global.ZigCore && global.ZigCore.Ground;
      const g = opts.ground ? (typeof opts.ground === "string" ? (Z ? Z.resolve(opts.ground) : null) : opts.ground) : null;
      return (g && g.sky && g.lift > 0)
        ? { r: g.sky.mid[0], g: g.sky.mid[1], b: g.sky.mid[2], a: 1 }
        : { r: 0, g: 0, b: 0, a: 1 };
    })();
    const MAX = opts.max || 150000;
    const SEED = opts.seed || 0x516;
    // world: x,z in [-EXT, EXT], y in [0, EXTY]
    const EXT = opts.extent || 240, EXTY = opts.extentY || 240;
    const CELL = opts.cell || 12;
    const GX = Math.ceil((EXT * 2) / CELL), GY = Math.ceil(EXTY / CELL), GZ = GX;
    const CELLS = GX * GY * GZ, CAP = 24, K = 7;
    const device = gpu.device;
    /* THE WARDROBE (v0.9): opts.mesh may be ONE mesh or an ARRAY of meshes.
       An array bakes every letter into one plate; U.morph picks which one
       each agent wears THIS FRAME — the flock keeps its life (positions,
       velocities, phases, memory) and changes its body. */
    const MESHES = Array.isArray(opts.mesh) ? opts.mesh : (opts.mesh ? [opts.mesh] : null);
    const MESH = MESHES ? MESHES[0] : null;   // ZigMesh output → shard agents (render mode 2)
    const WARD = MESHES && MESHES.length > 1;
    const FORMFIELD = (WARD && opts.formField) ? opts.formField : null;   // FORM FIELD: a per-agent signal picks the letter from the rack — form expresses state ("biome" hash · "age" · "energy"). Requires a wardrobe rack.
    const SPECTRUM = !!opts.spectrum;   // ZIGSPECTRUM: map the thin-film hue ALONG the letter (u: base→tip) instead of scattering it by per-agent random. render3.x rotates the wheel · render3.y spans how much of it runs base→tip. Reusable optics; byte-identical when off.
    const REVEAL = (WARD && opts.reveal) ? (+opts.reveal || 1) : 0;   // REVEAL WINDOW: each blade renders only a base→frontier FRAGMENT of its letter — a per-agent amount (identity) that UNFURLS with motion/breath. Reuses the tail-collapse. The field becomes a drift of letter-fragments, never 100% of a glyph. Needs a wardrobe rack; byte-identical when 0.
    const TRANSMIT = opts.transmit ? (+opts.transmit || 1.6) : 0;   // OPTICS · LUMINESCENCE: backlit transmission — a thin petal caught between eye and moon GLOWS FROM WITHIN (light passes through), carrying its own colour out. VS writes the forward-scatter lobe into the shard's unused depth channel; FS adds the inner glow. Number = gain; byte-identical when 0.
    const SHEEN = !!opts.sheen;   // OPTICS · ANISOTROPIC SHEEN: replace the round half-vector glint with a Kajiya-Kay highlight that runs ACROSS the blade and sweeps ALONG its length axis (fwd) as it twists — silk / petal-grain, not a plastic dot. Rides the existing glint channel; byte-identical off.
    const MAXV = MESHES ? Math.max.apply(null, MESHES.map((m) => m.verts)) : 0;
    /* MICRO-MEMBRANE (v0.10.1): letters whose DNA carries `breathe` swell
       and dimple along their normals on their OWN clocks — faster and
       deeper when agitated. Bubbles that are individually alive. */
    const BREATHE = MESHES ? Math.max.apply(null, MESHES.map((m) => (m.params && m.params.breathe) || 0)) : 0;
    const PHASE = opts.phase || null; // ZigPhase law → per-agent blink oscillators (Fireflies build)
    const FLOW = opts.flow || null;   // ZigFlow → this flock rides the world's shared currents
    /* THE BIOME (v0.9.1 · Scout's Orchard): opts.biome = { notes: [{dark,
       light}, …] } bakes a family of BORN colors. Every agent draws ONE note
       at birth (deterministic hash) — no gradients, no rainbow: individual
       identity. U.morph.w = TEMPERATURE DRIFT: the whole population slowly
       migrates through the family, each individual crossing at its own
       moment, so nobody ever sees a transition. */
    const BIOME = opts.biome || null;
    const MAT = opts.material || null;   // MATERIAL LAW: composition texture (grain/weather/subsurface) baked into the shard FS
    const WEB = opts.web ? { k: Math.max(1, Math.min(8, (opts.web.k | 0) || 3)), radius: +opts.web.radius || 16, width: +opts.web.width || 0.5 } : null;   // WEB LAW (v0.25): connective filaments between neighbouring agents — a compute pass reads the flock's own spatial grid for each agent's K nearest, then draws a thin camera-facing thread to each. Living connective tissue any species inherits; byte-identical when absent.
    /* CHIAROSCURO (v0.26) is now a LIVE uniform (View.render4.x = view[76]) — the species
       writes it each frame and a key dials it. No baked opt needed; 0 = soft full lighting. */
    /* NOTE FLASH (v0.43): the cup interior flashes the note's colour, the outside
       flashes one colour. Byte-identical when absent. */
    const NOTEFLASH = !!opts.noteFlash;
    const MEMBACK = !!opts.memoryBack;   // MEMORY UNDERSIDE (v0.27): the back face glows with a lagging ghost of the recent phrase (render4.y=hue, render4.z=glow). The 2nd performance surface — front=now, back=recent past. Byte-identical when off.
    const GEM = opts.gem || null;   // GEM MATERIAL (v0.30): the shard is a cut stone — fresnel rim, sky reflection, refraction bent through the body + tinted by the gem colour, DISPERSION (R·G·B split = fire), facet flash, sparkle. Samples the analytic sky (gemSky). Needs a front material (Nr, hvM). Byte-identical when absent.
    /* GEM FACE (v0.33): which face wears the stone — "both" (whole shard, the classic look) ·
       "inside" (the SEASHELL: matte material outside, gem nacre in the cupped interior) ·
       "outside" (gem shell, other lining within). The final c = gc is guarded by face. */
    /* RADIANCE (Canon law · v0.45): the room is a light source with NO falloff —
       it adds a constant to every pixel and collapses the shadow RATIOS that
       carry the organism's modelling. The law remaps outgoing LUMINANCE (black-
       point · gain · shadow gamma · soft knee) and scales the colour by the
       ratio, so hue and saturation are untouched. opts.radiance = a resolved
       ZigCore.Canon config {black,gain,gamma,knee}. ABSENT → not one character
       of WGSL is emitted; PRESENT → still arithmetically identity while the
       live dial V.render6.w sits at 0, which is what makes it A/B-able mid-frame. */
    const RAD = opts.radiance || null;
    const GEMFACE = (opts.gemFace || "both");
    const GEMCOND = GEMFACE === "inside" ? "if (!ff) " : (GEMFACE === "outside" ? "if (ff) " : "");
    const gemBlock = (G, cond) => {
      const f = (x) => { const s = (Math.round((+x) * 1e5) / 1e5).toString(); return s.indexOf(".") < 0 && s.indexOf("e") < 0 ? s + ".0" : s; };
      const eta = 1 / (+G.ior || 1.6), d = +G.disp || 0.015;
      return `${cond || ""}{
      /* GEM: refraction bent through the stone (3 iors → R·G·B fire) blended with a fresnel
         sky reflection, + facet flash + sparkle. The stone shows the WORLD, coloured by itself. */
      var gN = Nr; if (!ff) { gN = -gN; }
      let gBuff = select(1.0, 0.5, !ff);   // BUFF: soften the INTERIOR gem's sharp glints (nacre reads soft, not a hard cut) so it doesn't redraw facet lines on the back
      let gToC = normalize(V.camPos.xyz - inp.wpos);
      let fres = 0.06 + 0.94 * pow(1.0 - clamp(dot(gN, gToC), 0.0, 1.0), 4.0);
      let refl = gemSky(reflect(-gToC, gN));
      let rR = refract(-gToC, gN, ${f(eta * (1 - d))});
      let rG = refract(-gToC, gN, ${f(eta)});
      let rB = refract(-gToC, gN, ${f(eta * (1 + d))});
      let fire = vec3f(gemSky(rR).r, gemSky(rG).g, gemSky(rB).b);
      let gemC = gemHueRot(vec3f(${f(G.col[0])}, ${f(G.col[1])}, ${f(G.col[2])}), V.render3.x * 6.2831);   // Q rotates the stone's hue live
      let core = fire * gemC * 2.0 + gemC * (0.22 + 0.6 * fres);   // brighter refracted fire + a luminous colour core, so the stone reads even in a dark room
      var gc = mix(core, refl, fres);
      let gH = normalize(normalize(V.sunDir.xyz) + gToC);
      gc = gc + vec3f(1.0, 1.0, 0.98) * pow(max(dot(gN, gH), 0.0), 240.0) * ${f(G.facet)} * 1.6 * gBuff;   // facet flash — sharp white glint (softened on the interior)
      gc = gc + vec3f(1.0) * step(0.985, hvM(floor(vec2f(inp.obj.x, inp.dv) * 90.0))) * (0.4 + 0.6 * fres) * ${f(G.spark)} * 2.6 * gBuff;   // sparkle — RARE + bright, not static (softened on the interior)
      c = gc;
    }`;
    };
    const BACKFAB = opts.backFabric || null;   // FABRIC UNDERSIDE (v0.29): the back face is lined in a textile — a WEAVE (micro-pattern normal) + a SHEEN model (retro/spec/metal/matte) + deep base + colour. 20 fabrics in ZigCore.Fabrics. A different SKIN within; needs a front material (snw). Byte-identical when absent.
    const _fbF = (x) => { const s = (Math.round((+x) * 1e4) / 1e4).toString(); return s.indexOf(".") < 0 && s.indexOf("e") < 0 ? s + ".0" : s; };
    const fabricBlock = (F) => {
      const S = _fbF(F.wscale || 0);
      const weave = {
        pile:    `vnM(fuv * ${S})`,
        twill:   `0.5 + 0.5 * sin((fuv.x + fuv.y) * ${S} * 6.2831)`,
        rib:     `0.5 + 0.5 * sin(fuv.y * ${S} * 6.2831)`,
        plain:   `(0.5 + 0.5 * sin(fuv.x * ${S} * 6.2831)) * (0.5 + 0.5 * sin(fuv.y * ${S} * 6.2831))`,
        slub:    `vnM(vec2f(fuv.x * ${S}, fuv.y * ${_fbF((F.wscale || 0) * 0.3)}))`,
        smooth:  `0.5`,
        herring: `0.5 + 0.5 * sin((fuv.x + abs(fract(fuv.y * ${_fbF((F.wscale || 0) * 0.5)}) - 0.5) * 3.0) * ${S} * 3.1416)`
      }[F.weave] || `0.5`;
      const sheen = {
        retro: `fc += (col * 2.4 + vec3f(0.10)) * pow(graze, ${_fbF(F.spow)}) * ${_fbF(F.sgain)} * (0.4 + 0.6 * ndl);`,
        spec:  `let Hf = normalize(L + toC); fc += V.sunCol.rgb * pow(max(dot(Nb, Hf), 0.0), ${_fbF(F.spow)}) * ${_fbF(F.sgain)} * (0.5 + 0.5 * ndl);`,
        metal: `let Hm = normalize(L + toC); fc = fc * 0.55 + (col * 1.5 + vec3f(0.20)) * pow(max(dot(Nb, Hm), 0.0), ${_fbF(F.spow)}) * ${_fbF(F.sgain)};`,
        matte: `fc += col * graze * ${_fbF(F.sgain)} * 0.25;`
      }[F.sheen] || ``;
      /* FABRIC UNDERSIDE (${F.weave}/${F.sheen}): weave tilts the back normal, the sheen model
         catches the light. The weave gradient uses dpdx/dpdy, which WGSL only allows in UNIFORM
         control flow — so compute it OUTSIDE the (!ff) branch (runs for all shard fragments),
         then only apply the fabric colour on the back faces. */
      return `let fuv = vec2f(inp.obj.x, inp.dv * 0.5 + 0.5);
    let fwh = ${weave};
    let fbump = (dpdx(inp.wpos) * dpdx(fwh) + dpdy(inp.wpos) * dpdy(fwh)) * ${_fbF((F.wdepth || 0) * 6.0)};
    if (!ff) {
      var Nb = normalize(-normalize(inp.snw) - fbump);
      let toC = normalize(V.camPos.xyz - inp.wpos);
      let L = normalize(V.sunDir.xyz);
      let ndl = clamp(dot(Nb, L) * 0.5 + 0.5, 0.0, 1.0);
      let graze = pow(clamp(1.0 - abs(dot(Nb, toC)), 0.0, 1.0), 2.0);
      let col = vec3f(${_fbF(F.col[0])}, ${_fbF(F.col[1])}, ${_fbF(F.col[2])});
      var fc = col * (0.05 + ${_fbF(F.base)} * ndl * ndl);
      fc = fc * (0.72 + 0.56 * fwh);
      ${sheen}
      c = fc;
    }`;
    };
    const MEDIUM = opts.medium || null;  // ENVIRONMENT · MEDIUM: the density/viscosity of the world the matter moves through — {drag, vmax}. Thin air ⟶ resistant water ⟶ thick honey. Scales the step-kernel drag + speed cap; byte-identical when absent. (Phase 2, pillar 1.)
    const FORCES = opts.forces || null;  // ENVIRONMENT · FORCES: gravity / buoyancy — {g (down<0 / up>0), floor|ceil, damp}. Does the matter SINK & settle, FLOAT & gather, or hang SUSPENDED? Adds vertical accel before the integrate (composes with MEDIUM drag). Byte-identical when absent. (Phase 2, pillar 2.)
    const CURRENT = opts.current || null; // ENVIRONMENT · CURRENT: the world's flow the matter RIDES — {d (drift vector), gyre (rotation around the anchor's vertical axis)}. drift = a tethered stream/lean · gyre = a whirlpool · both = a swirling eddy. Adds accel before integrate (composes with MEDIUM + FORCES). Byte-identical when absent. (Phase 2, pillar 3.)
    const STAGE = opts.stage || null;    // EXPERIENCE · STAGE (the vitrine): a floor with a soft pool of light beneath the organism — {x,y,z (pool center on the floor), r (plane half-size), pool (light radius), color[3], gain}. The specimen rests in a lit space in a dark room; the viewer becomes a voyeur looking IN. Byte-identical when absent.
    const BOUNDARY = opts.boundary || null; // ENVIRONMENT · BOUNDARY: the world's SHAPE — {shape "cylinder"|"sphere", r, k, lo?, hi?}. A soft surface that HOLDS matter inside a volume (bowl · chimney · vessel): where forces pull and currents push, a boundary contains. Restoring accel before integrate (composes with all); a world can't drift out of frame. Byte-identical when absent. (Phase 2, pillar 4.)
    const SKIN = opts.skin || null;   // MEMBRANE: this flock inherits the elastic field's local geometry
    /* STRUCTURE (v0.37): matter that is JOINED. {rest, k, damp, bend, chain:[{from,count}]}
       Agents in a declared chain span are bonded to their predecessor. The CPU law
       (ZigCore.Structure.accel) SCATTERS force to i, its parent and its grandparent;
       a compute thread can only write its own slot, so the kernel GATHERS instead —
       each agent sums the force on itself from the bond it owns (role i), the bond
       of its child (role p) and the bond of its grandchild (role g). Exactly
       equivalent for CHAINS, which is what Rootwhale, Kelp and Zigpede are; general
       trees would need child lists and are not claimed. Byte-identical when absent. */
    const STRUCT = opts.structure || null;
    /* SEPCAP (v0.44) — bound the overlap force. 0 = unbounded, byte-identical. */
    const SEPCAP = opts.sepCap ? {
      pair: (opts.sepCap.pair === undefined) ? 0.55 : +opts.sepCap.pair,
      total: (opts.sepCap.total === undefined) ? 3.2 : +opts.sepCap.total
    } : null;
    /* CONTACT (v0.38) — MATTER THAT OCCUPIES SPACE. {r, k, damp}
       Flocking's `separation` is a force between strangers: a PREFERENCE, and a
       preference can always be overpowered. Push density high enough and shards
       occupy the same cubic space, which is why a dense middle smears into one
       translucent mass instead of packing. This is the law that forbids it.
       Reuses the flock's own spatial grid — no second acceleration structure.
       Byte-identical when absent. */
    /* ONSET (v0.39) — how fast agitation may RISE, in seconds. 0 = instantly,
       which is every build before this. Contagion decays smoothly (~0.6s) but has
       always risen in a SINGLE FRAME, because the update is a max(): instant
       attack, slow release — a popcorn envelope by construction. And agit drives
       the speed ceiling (vmax = 4.2 + 8*agit), so a shard whose agitation snaps
       0→1 triples its top speed in one frame and DARTS. Measured on Bill's
       2026-08-08 capture: the top 5% of pixels carried 65% of all motion and half
       of all motion events lasted a single frame. Giving the rise a time constant
       turns each flash into a swell, so the eye reads the ORGANISM rather than
       individual sparks. Performer strikes are deliberately left instant. */
    const ONSET = Math.max(0, +opts.onset || 0);
    /* UNSEEN (v0.40) — a fraction of the flock fully PRESENT and not DRAWN.
       The crowd and the eye want opposite things: contagion, flocking and murmur
       need a large population for a wave to be a wave, while legibility needs few
       enough shards that each has room to show an edge, a facing and a depth. At
       6000 on a 2560x1440 glass a shard gets roughly 10x10 pixels — a coloured
       dot. Hiding a share separates the two: physics keeps its crowd, the eye gets
       a thinner one, and the shards you DO see are moved by neighbours you cannot.
       A wave arriving through unseen matter.
       Uses the per-instance hash already computed for size jitter, so it is
       deterministic and free. 0 = every agent drawn, byte-identical. */
    const UNSEEN = Math.max(0, Math.min(0.95, +opts.unseen || 0));
    /* THE BEE — agent #0's size multiplier. 1 = same as every other shard (byte-identical). */
    const BEE = Math.max(1, Math.min(4, +opts.bee || 1));
    const CONTACT = opts.contact ? {
      r: Math.max(0.01, +opts.contact.r || 1),
      /* STIFFNESS MUST MATCH THE FIELD'S OWN FORCE SCALE. 400 is right for a
         STONE — a wall should be unyielding — and catastrophic for a flock: at
         radius 0.7 a half-overlapped shard takes ~280 accel while separation runs
         on ~3.2 and churn on ~0.9. Ninety times everything else. The shard is
         FIRED, the eye follows the one that moved, and the organism reads as
         POPCORN rather than as a mass (Bill, 2026-08-08). 45 puts contact in the
         same register as the forces it has to negotiate with. */
      k: (opts.contact.k === undefined) ? 45 : +opts.contact.k,
      damp: (opts.contact.damp === undefined) ? 4 : +opts.contact.damp,
      /* AND A CEILING, PER PAIR — not per agent. Stiffness alone cannot prevent
         popcorn, because a deep overlap is unbounded: two shards spawned inside
         each other produce a large force at any stiffness. But WHERE the ceiling
         goes matters. Clamping an agent's TOTAL contact force breaks the pair
         symmetry — the two sides then clamp by different amounts, forces stop
         being equal and opposite, and the clump can push itself (measured: net
         force 174 instead of 0). Clamping each PAIR leaves both sides computing
         the same scalar, so momentum is still conserved and no single collision
         can fire a shard. Exclusion still wins; it just wins patiently. */
      max: (opts.contact.max === undefined) ? 12 : +opts.contact.max
    } : null;
    const REST = opts.rest !== undefined && opts.rest !== false && opts.rest !== null;   // ZIGLIFE: per-agent arousal — rest/wake (breath wakes, silence sleeps). The individual-behavior substrate (arousal·fatigue·age·spare)
    const SEEK = opts.seek || null;   // ZIGSEEK: world attractor + repulsor — agents seek toward / avoid away (the base for foraging, attach, flee)
    const ATTACH = !!opts.attach;     // ZIGATTACH: bind-in-place / release — agents freeze into a held pose (bond channel of the life buffer)
    const FATIGUE = !!opts.fatigue;   // ZIGMETABOLISM: energy drains with effort, refills at rest / calm breath / huddle — stamina (energy channel of the life buffer)
    const AGING = !!opts.aging;       // ZIGAGE: a slow per-agent lifespan clock — born → prime → old → renew; generational turnover (age channel of the life buffer)
    const LIFE = REST || ATTACH || FATIGUE || AGING;   // the shared per-agent life buffer exists when ANY life behavior is on
    const REST_INIT = (typeof opts.rest === "number") ? Math.max(0, Math.min(1, opts.rest)) : 1.0;   // starting arousal (1 awake · low = starts asleep)

    /* ---- WGSL ---------------------------------------------------------- */
    const COMMON = `
struct Sim {
  dt: f32, time: f32, breath: f32, bend: f32,
  attack: f32, waveSpeed: f32, waveWidth: f32, energy: f32,
  count: u32, agit_amb: f32, coh_w: f32, sep_w: f32,
  anchor: vec4f,                // xyz roost anchor · w lift height
  refpt: vec4f,                 // xyz delay reference (last strike) · w maxDelay
  wind: vec4f,                  // xyz wind · w ali_w
  knobsA: vec4f,                // x contagion · y sepRadius · z vmin · w vmaxBase
  knobsB: vec4f,                // x vmaxAgit · y waveKick · z bankGain · w churn
  impulses: array<vec4f, 8>,    // xyz origin · w start time (<0 inactive)
  imp_meta: array<vec4f, 8>,    // x strength
  taps: array<vec4f, 16>,       // 64 Drive taps, 0..maxDelay
  wanderers: array<vec4f, 4>,   // x birdIndex · yzw steer target (turnover)
  wmeta: array<vec4f, 4>,       // x steer strength (<=0 inactive)
  modes: vec4f,                 // x medium (0=air/gravity · 1=water/neutral) · y K · z tempo · w ignite (ZigPhase)
  pace: vec4f,                  // x performer phase · y pull (Pacemaker) · z waveLife s (0=golden 3.5) · w VOICE (1=dancer · 0=resonator: no light/agitation of its own, rings only when struck)
  avatarA: vec4f,               // AVATAR law: x agent index (<0 = off) · yzw steer target
  avatarB: vec4f,               // x steer strength · y flash-now (note-on frame) · z agit burn · w charisma
  morph: vec4f,                 // WARDROBE: x letter index · y letterB · z per-agent mix toward B (0..1) · w free
};
const EXT: f32 = ${EXT}.0;
const EXTY: f32 = ${EXTY}.0;
const CELL: f32 = ${CELL}.0;
const GX: i32 = ${GX}; const GY: i32 = ${GY}; const GZ: i32 = ${GZ};
const CELLS: u32 = ${CELLS}u; const CAP: u32 = ${CAP}u;
fn cellCoord(p: vec3f) -> vec3i {
  return vec3i(
    clamp(i32((p.x + EXT) / CELL), 0, GX - 1),
    clamp(i32(p.y / CELL), 0, GY - 1),
    clamp(i32((p.z + EXT) / CELL), 0, GZ - 1));
}
fn cellIndex(c: vec3i) -> u32 {
  return u32(c.x) + u32(c.y) * u32(GX) + u32(c.z) * u32(GX * GY);
}`;

    const GRID_WGSL = COMMON + `
@group(0) @binding(0) var<uniform> U: Sim;
@group(0) @binding(1) var<storage, read> posIn: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> gridCount: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> gridIdx: array<u32>;

@compute @workgroup_size(64)
fn clearGrid(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x < CELLS) { atomicStore(&gridCount[gid.x], 0u); }
}
@compute @workgroup_size(64)
fn build(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; if (i >= U.count) { return; }
  let ci = cellIndex(cellCoord(posIn[i].xyz));
  let slot = atomicAdd(&gridCount[ci], 1u);
  if (slot < CAP) { gridIdx[ci * CAP + slot] = i; }
}`;

    const STEP_WGSL = COMMON + `
@group(0) @binding(0) var<uniform> U: Sim;
@group(0) @binding(1) var<storage, read> posIn: array<vec4f>;
@group(0) @binding(2) var<storage, read> velIn: array<vec4f>;
@group(0) @binding(3) var<storage, read> gridCount: array<u32>;
@group(0) @binding(4) var<storage, read> gridIdx: array<u32>;
@group(0) @binding(5) var<storage, read_write> posOut: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> velOut: array<vec4f>;

const K: u32 = ${K}u;

fn tapAt(idx: u32) -> f32 {
  let i = min(idx, 63u);
  return U.taps[i >> 2u][i & 3u];
}

const SEP_CEIL: f32 = 1.0;      // per-pair overlap ceiling — replaced when opts.sepCap
const SEP_TOTAL: f32 = 999.0;   // total separation ceiling

@compute @workgroup_size(64)
fn step(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; if (i >= U.count) { return; }
  var p = posIn[i].xyz;
  var agit = posIn[i].w;
  var v = velIn[i].xyz;
  var bank = velIn[i].w;

  /* ---- topological K-nearest (rank, not radius — THE LAW) ---- */
  var nd: array<f32, K>;
  var ni: array<u32, K>;
  for (var k = 0u; k < K; k++) { nd[k] = 1e12; ni[k] = 0xffffffffu; }
  let c = cellCoord(p);
  for (var dz = -1; dz <= 1; dz++) {
  for (var dy = -1; dy <= 1; dy++) {
  for (var dx = -1; dx <= 1; dx++) {
    let cc = c + vec3i(dx, dy, dz);
    if (cc.x < 0 || cc.y < 0 || cc.z < 0 || cc.x >= GX || cc.y >= GY || cc.z >= GZ) { continue; }
    let ci = cellIndex(cc);
    let n = min(gridCount[ci], CAP);
    for (var s = 0u; s < n; s++) {
      let j = gridIdx[ci * CAP + s];
      if (j == i) { continue; }
      let q = posIn[j].xyz;
      let d2 = dot(q - p, q - p);
      if (d2 < nd[K - 1u]) {                 // insertion sort into top-K
        var k = K - 1u;
        loop {
          if (k > 0u && nd[k - 1u] > d2) { nd[k] = nd[k - 1u]; ni[k] = ni[k - 1u]; k--; }
          else { break; }
        }
        nd[k] = d2; ni[k] = j;
      }
    }
  }}}

  /* ---- the breath, read at THIS bird's own lag = the swell as a wave ---- */
  let maxDelay = max(U.refpt.w, 0.1);
  let lag = clamp(distance(p, U.refpt.xyz) / max(U.waveSpeed, 1.0), 0.0, maxDelay);
  let localBreath = tapAt(u32(lag / maxDelay * 63.0));

  /* ---- flock forces over the K neighbors ---- */
  var sep = vec3f(0.0); var ali = vec3f(0.0); var coh = vec3f(0.0);
  var nAgit = 0.0; var cnt = 0.0;
  let sepR = U.knobsA.y;
  let sepSum0 = 0.0;
  for (var k = 0u; k < K; k++) {
    if (ni[k] == 0xffffffffu) { continue; }
    let j = ni[k];
    let q = posIn[j].xyz;
    let d = max(sqrt(nd[k]), 0.001);
    /* SEPARATION, BOUNDED. The term (sepR-d)/sepR reaches 1 as two agents
       coincide, and it SUMS over every neighbour — so a shard buried in twenty
       others receives twenty times the kick. Measured: 59 to 223 depending on
       SPREAD, against a field speed ceiling of 4 to 12. Embedded groups were not
       more agitated by degree, they were in an entirely different force regime,
       which is exactly what Bill saw. Real bodies cannot embed at all, so an
       unbounded overlap force is modelling a situation that should not arise;
       capping the per-pair contribution is what a solid contact does anyway. */
    if (d < sepR) { sep += (p - q) / d * min((sepR - d) / sepR, SEP_CEIL); }
    ali += velIn[j].xyz;
    coh += q;
    nAgit = max(nAgit, posIn[j].w);
    cnt += 1.0;
  }
  var accel = vec3f(0.0);
  if (cnt > 0.0) {
    ali = ali / cnt - v;
    coh = coh / cnt - p;
    // breath binds the cloud: cohesion swells with the LOCAL (lagged) breath
    accel += coh * U.coh_w * (0.35 + 1.9 * localBreath);
    accel += ali * U.wind.w * (1.0 + 1.5 * agit);
    /* and a TOTAL ceiling, because even bounded per-pair terms sum: twenty
       neighbours at the cap still exceed anything else in the world. */
    let sepMag = length(sep);
    if (sepMag > SEP_TOTAL) { sep = sep / sepMag * SEP_TOTAL; }
    accel += sep * U.sep_w;
  }

  /* ---- contagion: agitation spreads one neighbor-hop per step ----
     (this IS the social wave — it outruns any bird)                  */
  agit = max(agit * exp(-1.6 * U.dt), nAgit * U.knobsA.x);

  /* ---- impulse wavefronts (the falcon strike · the thrown stone) ----
     WLIFE: species-set wave lifetime (pace.z). Default reproduces the golden
     3.5s / 0.7 decay EXACTLY (2.45/3.5 = 0.7) — water remembers longer. */
  let WLIFE = select(3.5, U.pace.z, U.pace.z > 0.1);
  let surface = select(0.0, 1.0, U.modes.x > 1.5);
  for (var m = 0u; m < 8u; m++) {
    let im = U.impulses[m];
    if (im.w < 0.0) { continue; }
    let age = U.time - im.w;
    if (age < 0.0 || age > WLIFE) { continue; }
    let r = distance(p, im.xyz);
    let front = U.waveSpeed * age;
    let x = abs(r - front);
    let w = max(U.waveWidth, 1.0);
    let f = exp(-x * x / (2.0 * w * w)) * U.imp_meta[m].x * exp(-age * (2.45 / WLIFE));
    if (f > 0.003) {
      /* per-impulse KICK SCALE (imp_meta.y): a falcon strike shoves (1.0); a
         NOTE-IMPULSE flares the same but barely pushes (~0.2) — a nerve pulse
         through the tissue, not a blow. Flare (agit) is untouched by the scale. */
      let kick = U.knobsB.y * U.imp_meta[m].y;
      if (surface > 0.5) {
        /* SURFACE: the front is a CREST — it lifts the skin as it passes,
           with only a whisper of outward slosh. Rings, not shoves. */
        accel.y += f * kick * 0.85;
        let aw = normalize(vec2f(p.x - im.x, p.z - im.z) + vec2f(0.001, 0.0));
        accel.x += aw.x * f * kick * 0.12;
        accel.z += aw.y * f * kick * 0.12;
      } else {
        let away = normalize(p - im.xyz + vec3f(0.0, 0.001, 0.0));
        accel += away * f * kick;
        // AIR: the band dives as it banks (collapse). WATER: pure radial vortex — the
        // bait-ball opens around the lunge and closes behind it, no downward bias.
        accel.y -= f * kick * 0.33 * (1.0 - min(U.modes.x, 1.0));
      }
      agit = max(agit, f);
    }
  }

  /* ---- global shepherding (anchor · altitude · wind · lean) ---- */
  let anchor = U.anchor.xyz;
  var toA = anchor - p; toA.y = 0.0;
  let dA = length(toA);
  /* SURFACE: a lake is WIDE — the homeward pull drops to a whisper so the
     skin stays spread instead of contracting into a puddle */
  if (dA > 1.0) { accel += toA / dA * min(dA * 0.02, 1.0) * 3.0 * mix(1.0, 0.15, surface); }
  let targetY = anchor.y + U.breath * U.anchor.w;
  let dy = targetY - p.y;
  let water = min(U.modes.x, 1.0);
  /* SURFACE (medium 2): the SKIN — spring to the lake level with damping,
     so crests bob and settle like water, not foam */
  if (surface > 0.5) {
    accel.y += (U.anchor.y - p.y) * 3.2 - v.y * 2.0;
  }
  // AIR: asymmetric fall (the pour to roost) + silence stills the vertical.
  // WATER: neutral buoyancy — symmetric gentle centering, no roost, no pour.
  let climb = select(0.045, 0.095, dy < 0.0);
  accel.y += dy * mix(climb, 0.05, water);
  accel.y -= v.y * (1.0 - U.breath) * 0.35 * (1.0 - water);   // air only
  accel += U.wind.xyz;
  accel.x += U.bend * 14.0;             // pitch-bend: the whole cloud LEANS
  // gentle churn so the cloud never crystallizes
  accel += vec3f(
    sin(p.z * 0.021 + U.time * 0.31), sin(p.x * 0.017 - U.time * 0.23) * 0.6,
    sin(p.y * 0.025 + U.time * 0.27)) * (0.5 + 2.5 * U.agit_amb) * U.knobsB.w;

  /* ---- turnover: a few anonymous birds quietly leave & rejoin ----
     A wandering bird steers to a far target with its agitation suppressed,
     so it peels away calmly (never a focal event — leaderless preserved).
     On release the slot goes inactive and normal cohesion re-flocks it.   */
  for (var wi = 0u; wi < 4u; wi++) {
    if (U.wmeta[wi].x > 0.0 && u32(U.wanderers[wi].x) == i) {
      let toW = U.wanderers[wi].yzw - p;
      let steer = normalize(toW + vec3f(0.0, 0.001, 0.0)) * 20.0;
      accel = mix(accel, steer, U.wmeta[wi].x);
      agit = min(agit, 0.04);
    }
  }

  /* ---- AVATAR: the performer embodied (idx < 0 = law dormant) ----
     Steered like a wanderer but NEVER calmed — the avatar BURNS, and its
     agitation spreads outward through ordinary contagion, one neighbor-hop
     per step. Influence travels at the speed of relationship. */
  if (U.avatarA.x >= 0.0 && i32(U.avatarA.x) == i32(i)) {
    let toV = U.avatarA.yzw - p;
    let dV = length(toV);
    if (dV > 0.5) {
      let steerV = toV / dV * (12.0 + 30.0 * U.breath);   // breath drives the body
      accel = mix(accel, steerV, U.avatarB.x);
    }
    agit = max(agit, U.avatarB.z);
  }

  /* ---- integrate with speed band ---- */
  v += accel * U.dt;
  v *= (1.0 - U.dt * 0.9 * min(U.modes.x, 1.0));   // WATER/SURFACE: viscous drag (glide to rest)
  let sp = length(v);
  let vmin = U.knobsA.z; let vmax = U.knobsA.w + U.knobsB.x * agit + 6.0 * localBreath;
  if (sp > 0.0001) { v = v / sp * clamp(sp, vmin, vmax); }

  /* ---- soft world bounds ---- */
  if (p.x >  EXT - 25.0) { v.x -= (p.x - (EXT - 25.0)) * 0.12; }
  if (p.x < -EXT + 25.0) { v.x -= (p.x + (EXT - 25.0)) * 0.12; }
  if (p.z >  EXT - 25.0) { v.z -= (p.z - (EXT - 25.0)) * 0.12; }
  if (p.z < -EXT + 25.0) { v.z -= (p.z + (EXT - 25.0)) * 0.12; }
  if (p.y >  EXTY - 15.0) { v.y -= (p.y - (EXTY - 15.0)) * 0.2; }
  if (p.y < 3.0)          { v.y += (3.0 - p.y) * 0.6; }

  p += v * U.dt;

  /* ---- banking → the shimmer. Lateral accel rolls the bird; a rolled
         bird shows its BROADSIDE → the dark band, purely emergent. ---- */
  let fwd = v / max(length(v), 0.001);
  let side = normalize(cross(fwd, vec3f(0.0, 1.0, 0.0)) + vec3f(0.0, 0.0001, 0.0));
  let latA = dot(accel, side);
  let targetBank = clamp(latA * U.knobsB.z, -1.25, 1.25);
  bank += (targetBank - bank) * min(1.0, U.dt * 5.0);

  posOut[i] = vec4f(p, min(agit, 1.5));
  velOut[i] = vec4f(v, bank);
}`;

    const RENDER_WGSL = `
struct View {
  viewProj: mat4x4f,
  camPos: vec4f,      // w = time
  camRight: vec4f,    // w = aspect
  camUp: vec4f,       // w = tan(fov/2)
  camFwd: vec4f,
  sunDir: vec4f,      // w = sun intensity
  skyTop: vec4f,
  skyMid: vec4f,
  horizon: vec4f,
  ground: vec4f,
  sunCol: vec4f,
  birdDark: vec4f,    // w = agent size
  birdLight: vec4f,   // w = fog density
  render: vec4f,      // x renderMode(0=bird,1=fish) · y swimHz · z swimAmp · w swimWave
  render2: vec4f,     // x flashGain · y godRays · z caustics · w waterDepthShift
  render3: vec4f,     // x surfaceY · y depthRange · (zw free)  — underwater light
  render4: vec4f,     // x = CHIAROSCURO amount (live, view[76]) · y memHue · z memGlow · w memBack
  render5: vec4f,     // x = RIM strength (live, view[80]) · y = RIM sharpness (view[81]) · z = THE BEE's note hue 0..1 (view[82]) · w = how far her flash is pushed to it (view[83])e
  noteBands: array<vec4f, 6>,   // MELODIC STRATA (view[84..107]): each note = (worldY, hue, energy, 0) — a band of light at the note's pitch-height, its pitch-class colour, fading over time
  render6: vec4f,     // NOTE FLASH (view[108..111]): x = interior hue · y = exterior hue · z = flash amount · w free. DECLARED LAST so nothing already indexed by hand shifts.
};
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read> vel: array<vec4f>;

/* ---------------- sky ---------------- */
struct SkyOut { @builtin(position) cp: vec4f, @location(0) uv: vec2f };
@vertex
fn skyVs(@builtin(vertex_index) vi: u32) -> SkyOut {
  var o: SkyOut;
  let xy = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  o.cp = vec4f(xy, 0.9999, 1.0);
  o.uv = xy;
  return o;
}
fn skyColor(dir: vec3f) -> vec3f {
  let y = dir.y;
  var col = mix(V.horizon.rgb, V.skyMid.rgb, smoothstep(-0.02, 0.28, y));
  col = mix(col, V.skyTop.rgb, smoothstep(0.22, 0.85, y));
  let s = max(dot(dir, normalize(V.sunDir.xyz)), 0.0);
  col += V.sunCol.rgb * (pow(s, 350.0) * 1.4 + pow(s, 24.0) * 0.35) * V.sunDir.w;
  if (y < 0.0) { col = mix(col, V.ground.rgb, smoothstep(0.0, -0.06, y)); }
  return col;
}
/* MARINE SNOW — faint particulate sinking through the column; the "we're
   underwater" cue (stolen from Kelp WebGL 036). Drifts DOWN over time. */
fn marineSnow(dir: vec3f) -> vec3f {
  let sp = dir.xy * 70.0 + vec2f(0.0, V.camPos.w * 0.5);
  let cell = floor(sp);
  let hh = fract(sin(dot(cell, vec2f(19.73, 83.11))) * 3571.31);
  let d = fract(sp) - 0.5;
  let mote = smoothstep(0.13, 0.0, length(d)) * step(0.86, hh);
  return vec3f(0.55, 0.62, 0.60) * mote * (0.35 + 0.65 * max(dir.y, 0.0));
}
/* ---- underwater: depth-graded column, Snell's window, sun, god rays ---- */
fn waterColor(dir: vec3f) -> vec3f {
  let y = dir.y;                       // +1 = straight up toward surface
  let deep = V.skyTop.rgb;             // darkest (down / far)
  let mid  = V.skyMid.rgb;
  let surf = V.horizon.rgb;            // brightest (surface)
  var col = mix(mid, deep, smoothstep(0.0, -0.75, y));   // looking down → the deep
  col = mix(col, surf, smoothstep(0.05, 0.85, y));       // looking up → the surface
  let sd = normalize(V.sunDir.xyz);
  let s = max(dot(dir, sd), 0.0);
  // Snell's window — the bright disc of the world compressed straight overhead
  let snell = smoothstep(0.82, 0.995, y);
  col = mix(col, surf * 1.5 + V.sunCol.rgb * 0.35, snell);
  col += V.sunCol.rgb * pow(s, 90.0) * 0.6 * V.sunDir.w;
  // GOD RAYS — shafts raking down from the surface, broken by an angular ripple
  let ang = atan2(dir.x, dir.z);
  let ripple = 0.55 + 0.45 * sin(ang * 16.0 + V.camPos.w * 0.35) * sin(ang * 6.3 - V.camPos.w * 0.21);
  let shaft = pow(max(y, 0.0), 1.4) * pow(s, 2.5);
  col += V.sunCol.rgb * shaft * ripple * V.render2.y;
  // PLANKTON (night / Act III): a faint sea of drifting cold-blue stars
  if (V.render3.w > 0.01) {
    let cell = floor(dir.xy * 190.0);
    let hh = fract(sin(dot(cell, vec2f(12.99, 78.23))) * 43758.5453);
    let tw = smoothstep(0.9975, 1.0, fract(hh + V.camPos.w * 0.03)) * (0.4 + 0.6 * hh);
    col += vec3f(0.18, 0.62, 0.95) * tw * V.render3.w * 0.7;
  }
  col += marineSnow(dir) * V.ground.w;    // drifting particulate (stolen from WebGL 036)
  return col;
}
@fragment
fn skyFs(inp: SkyOut) -> @location(0) vec4f {
  let aspect = V.camRight.w; let tf = V.camUp.w;
  let dir = normalize(V.camFwd.xyz + V.camRight.xyz * inp.uv.x * tf * aspect + V.camUp.xyz * inp.uv.y * tf);
  if (V.render.x > 0.5) { return vec4f(waterColor(dir), 1.0); }
  return vec4f(skyColor(dir), 1.0);
}
/* ---- caustics — the dancing net of light (surface ripples as lenses) ---- */
fn caustic(p: vec2f, t: f32) -> f32 {
  let q = p * 0.14;
  var v = sin(q.x * 1.3 + t * 0.6) * sin(q.y * 1.1 - t * 0.5);
  v += 0.5 * sin(q.x * 2.7 - t * 0.42 + 1.3) * sin(q.y * 2.3 + t * 0.7);
  v += 0.25 * sin((q.x + q.y) * 3.9 + t * 0.9);
  return pow(clamp(v * 0.5 + 0.5, 0.0, 1.0), 3.0);
}

/* ---------------- starlings ----------------
   A starling, not a delta-wing: pointed head · chunky torso · short fan
   tail · swept POINTED wings that hinge at the shoulder. 7 triangles.   */
const STARLING: array<vec3f, 21> = array<vec3f, 21>(
  // head (beak tip → shoulders)
  vec3f( 0.85, 0.0,  0.00), vec3f( 0.24, 0.0,  0.18), vec3f( 0.24, 0.0, -0.18),
  // torso (shoulders → hips)
  vec3f( 0.24, 0.0,  0.18), vec3f(-0.55, 0.0,  0.12), vec3f( 0.24, 0.0, -0.18),
  vec3f(-0.55, 0.0,  0.12), vec3f(-0.55, 0.0, -0.12), vec3f( 0.24, 0.0, -0.18),
  // tail (short fan)
  vec3f(-0.55, 0.0,  0.12), vec3f(-1.05, 0.0,  0.22), vec3f(-0.55, 0.0, -0.12),
  vec3f(-1.05, 0.0,  0.22), vec3f(-1.05, 0.0, -0.22), vec3f(-0.55, 0.0, -0.12),
  // wings — swept, pointed, rooted at the shoulder
  vec3f( 0.20, 0.0,  0.15), vec3f(-0.45, 0.0,  1.35), vec3f(-0.42, 0.0,  0.18),
  vec3f( 0.20, 0.0, -0.15), vec3f(-0.45, 0.0, -1.35), vec3f(-0.42, 0.0, -0.18));

/* ---------------- fish (3D body) ----------------
   A real fusiform body: diamond cross-section spindle (volume, not a card),
   forked caudal fin, dorsal + anal fins. 25 triangles (75 verts). Positions
   in object space fwd(x)/up(y)/lateral(z); FISH_NRM carries per-face normals
   so the mirror flash and iridescence play correctly over the curved flanks. */
const FISH_POS: array<vec3f, 249> = array<vec3f, 249>(
  vec3f(1.090,0.000,0.000), vec3f(1.050,0.020,0.000), vec3f(1.050,0.010,-0.013),
  vec3f(1.090,0.000,0.000), vec3f(1.050,0.010,-0.013), vec3f(1.050,-0.010,-0.013),
  vec3f(1.090,0.000,0.000), vec3f(1.050,-0.010,-0.013), vec3f(1.050,-0.020,-0.000),
  vec3f(1.090,0.000,0.000), vec3f(1.050,-0.020,-0.000), vec3f(1.050,-0.010,0.013),
  vec3f(1.090,0.000,0.000), vec3f(1.050,-0.010,0.013), vec3f(1.050,0.010,0.013),
  vec3f(1.090,0.000,0.000), vec3f(1.050,0.010,0.013), vec3f(1.050,0.020,0.000),
  vec3f(1.050,0.020,0.000), vec3f(0.600,0.190,0.000), vec3f(0.600,0.095,-0.074),
  vec3f(1.050,0.020,0.000), vec3f(0.600,0.095,-0.074), vec3f(1.050,0.010,-0.013),
  vec3f(1.050,0.010,-0.013), vec3f(0.600,0.095,-0.074), vec3f(0.600,-0.095,-0.074),
  vec3f(1.050,0.010,-0.013), vec3f(0.600,-0.095,-0.074), vec3f(1.050,-0.010,-0.013),
  vec3f(1.050,-0.010,-0.013), vec3f(0.600,-0.095,-0.074), vec3f(0.600,-0.190,-0.000),
  vec3f(1.050,-0.010,-0.013), vec3f(0.600,-0.190,-0.000), vec3f(1.050,-0.020,-0.000),
  vec3f(1.050,-0.020,-0.000), vec3f(0.600,-0.190,-0.000), vec3f(0.600,-0.095,0.074),
  vec3f(1.050,-0.020,-0.000), vec3f(0.600,-0.095,0.074), vec3f(1.050,-0.010,0.013),
  vec3f(1.050,-0.010,0.013), vec3f(0.600,-0.095,0.074), vec3f(0.600,0.095,0.074),
  vec3f(1.050,-0.010,0.013), vec3f(0.600,0.095,0.074), vec3f(1.050,0.010,0.013),
  vec3f(1.050,0.010,0.013), vec3f(0.600,0.095,0.074), vec3f(0.600,0.190,0.000),
  vec3f(1.050,0.010,0.013), vec3f(0.600,0.190,0.000), vec3f(1.050,0.020,0.000),
  vec3f(0.600,0.190,0.000), vec3f(0.220,0.270,0.000), vec3f(0.220,0.135,-0.087),
  vec3f(0.600,0.190,0.000), vec3f(0.220,0.135,-0.087), vec3f(0.600,0.095,-0.074),
  vec3f(0.600,0.095,-0.074), vec3f(0.220,0.135,-0.087), vec3f(0.220,-0.135,-0.087),
  vec3f(0.600,0.095,-0.074), vec3f(0.220,-0.135,-0.087), vec3f(0.600,-0.095,-0.074),
  vec3f(0.600,-0.095,-0.074), vec3f(0.220,-0.135,-0.087), vec3f(0.220,-0.270,-0.000),
  vec3f(0.600,-0.095,-0.074), vec3f(0.220,-0.270,-0.000), vec3f(0.600,-0.190,-0.000),
  vec3f(0.600,-0.190,-0.000), vec3f(0.220,-0.270,-0.000), vec3f(0.220,-0.135,0.087),
  vec3f(0.600,-0.190,-0.000), vec3f(0.220,-0.135,0.087), vec3f(0.600,-0.095,0.074),
  vec3f(0.600,-0.095,0.074), vec3f(0.220,-0.135,0.087), vec3f(0.220,0.135,0.087),
  vec3f(0.600,-0.095,0.074), vec3f(0.220,0.135,0.087), vec3f(0.600,0.095,0.074),
  vec3f(0.600,0.095,0.074), vec3f(0.220,0.135,0.087), vec3f(0.220,0.270,0.000),
  vec3f(0.600,0.095,0.074), vec3f(0.220,0.270,0.000), vec3f(0.600,0.190,0.000),
  vec3f(0.220,0.270,0.000), vec3f(-0.100,0.270,0.000), vec3f(-0.100,0.135,-0.082),
  vec3f(0.220,0.270,0.000), vec3f(-0.100,0.135,-0.082), vec3f(0.220,0.135,-0.087),
  vec3f(0.220,0.135,-0.087), vec3f(-0.100,0.135,-0.082), vec3f(-0.100,-0.135,-0.082),
  vec3f(0.220,0.135,-0.087), vec3f(-0.100,-0.135,-0.082), vec3f(0.220,-0.135,-0.087),
  vec3f(0.220,-0.135,-0.087), vec3f(-0.100,-0.135,-0.082), vec3f(-0.100,-0.270,-0.000),
  vec3f(0.220,-0.135,-0.087), vec3f(-0.100,-0.270,-0.000), vec3f(0.220,-0.270,-0.000),
  vec3f(0.220,-0.270,-0.000), vec3f(-0.100,-0.270,-0.000), vec3f(-0.100,-0.135,0.082),
  vec3f(0.220,-0.270,-0.000), vec3f(-0.100,-0.135,0.082), vec3f(0.220,-0.135,0.087),
  vec3f(0.220,-0.135,0.087), vec3f(-0.100,-0.135,0.082), vec3f(-0.100,0.135,0.082),
  vec3f(0.220,-0.135,0.087), vec3f(-0.100,0.135,0.082), vec3f(0.220,0.135,0.087),
  vec3f(0.220,0.135,0.087), vec3f(-0.100,0.135,0.082), vec3f(-0.100,0.270,0.000),
  vec3f(0.220,0.135,0.087), vec3f(-0.100,0.270,0.000), vec3f(0.220,0.270,0.000),
  vec3f(-0.100,0.270,0.000), vec3f(-0.400,0.210,0.000), vec3f(-0.400,0.105,-0.061),
  vec3f(-0.100,0.270,0.000), vec3f(-0.400,0.105,-0.061), vec3f(-0.100,0.135,-0.082),
  vec3f(-0.100,0.135,-0.082), vec3f(-0.400,0.105,-0.061), vec3f(-0.400,-0.105,-0.061),
  vec3f(-0.100,0.135,-0.082), vec3f(-0.400,-0.105,-0.061), vec3f(-0.100,-0.135,-0.082),
  vec3f(-0.100,-0.135,-0.082), vec3f(-0.400,-0.105,-0.061), vec3f(-0.400,-0.210,-0.000),
  vec3f(-0.100,-0.135,-0.082), vec3f(-0.400,-0.210,-0.000), vec3f(-0.100,-0.270,-0.000),
  vec3f(-0.100,-0.270,-0.000), vec3f(-0.400,-0.210,-0.000), vec3f(-0.400,-0.105,0.061),
  vec3f(-0.100,-0.270,-0.000), vec3f(-0.400,-0.105,0.061), vec3f(-0.100,-0.135,0.082),
  vec3f(-0.100,-0.135,0.082), vec3f(-0.400,-0.105,0.061), vec3f(-0.400,0.105,0.061),
  vec3f(-0.100,-0.135,0.082), vec3f(-0.400,0.105,0.061), vec3f(-0.100,0.135,0.082),
  vec3f(-0.100,0.135,0.082), vec3f(-0.400,0.105,0.061), vec3f(-0.400,0.210,0.000),
  vec3f(-0.100,0.135,0.082), vec3f(-0.400,0.210,0.000), vec3f(-0.100,0.270,0.000),
  vec3f(-0.400,0.210,0.000), vec3f(-0.640,0.120,0.000), vec3f(-0.640,0.060,-0.035),
  vec3f(-0.400,0.210,0.000), vec3f(-0.640,0.060,-0.035), vec3f(-0.400,0.105,-0.061),
  vec3f(-0.400,0.105,-0.061), vec3f(-0.640,0.060,-0.035), vec3f(-0.640,-0.060,-0.035),
  vec3f(-0.400,0.105,-0.061), vec3f(-0.640,-0.060,-0.035), vec3f(-0.400,-0.105,-0.061),
  vec3f(-0.400,-0.105,-0.061), vec3f(-0.640,-0.060,-0.035), vec3f(-0.640,-0.120,-0.000),
  vec3f(-0.400,-0.105,-0.061), vec3f(-0.640,-0.120,-0.000), vec3f(-0.400,-0.210,-0.000),
  vec3f(-0.400,-0.210,-0.000), vec3f(-0.640,-0.120,-0.000), vec3f(-0.640,-0.060,0.035),
  vec3f(-0.400,-0.210,-0.000), vec3f(-0.640,-0.060,0.035), vec3f(-0.400,-0.105,0.061),
  vec3f(-0.400,-0.105,0.061), vec3f(-0.640,-0.060,0.035), vec3f(-0.640,0.060,0.035),
  vec3f(-0.400,-0.105,0.061), vec3f(-0.640,0.060,0.035), vec3f(-0.400,0.105,0.061),
  vec3f(-0.400,0.105,0.061), vec3f(-0.640,0.060,0.035), vec3f(-0.640,0.120,0.000),
  vec3f(-0.400,0.105,0.061), vec3f(-0.640,0.120,0.000), vec3f(-0.400,0.210,0.000),
  vec3f(-0.640,0.120,0.000), vec3f(-0.850,0.050,0.000), vec3f(-0.850,0.025,-0.017),
  vec3f(-0.640,0.120,0.000), vec3f(-0.850,0.025,-0.017), vec3f(-0.640,0.060,-0.035),
  vec3f(-0.640,0.060,-0.035), vec3f(-0.850,0.025,-0.017), vec3f(-0.850,-0.025,-0.017),
  vec3f(-0.640,0.060,-0.035), vec3f(-0.850,-0.025,-0.017), vec3f(-0.640,-0.060,-0.035),
  vec3f(-0.640,-0.060,-0.035), vec3f(-0.850,-0.025,-0.017), vec3f(-0.850,-0.050,-0.000),
  vec3f(-0.640,-0.060,-0.035), vec3f(-0.850,-0.050,-0.000), vec3f(-0.640,-0.120,-0.000),
  vec3f(-0.640,-0.120,-0.000), vec3f(-0.850,-0.050,-0.000), vec3f(-0.850,-0.025,0.017),
  vec3f(-0.640,-0.120,-0.000), vec3f(-0.850,-0.025,0.017), vec3f(-0.640,-0.060,0.035),
  vec3f(-0.640,-0.060,0.035), vec3f(-0.850,-0.025,0.017), vec3f(-0.850,0.025,0.017),
  vec3f(-0.640,-0.060,0.035), vec3f(-0.850,0.025,0.017), vec3f(-0.640,0.060,0.035),
  vec3f(-0.640,0.060,0.035), vec3f(-0.850,0.025,0.017), vec3f(-0.850,0.050,0.000),
  vec3f(-0.640,0.060,0.035), vec3f(-0.850,0.050,0.000), vec3f(-0.640,0.120,0.000),
  vec3f(-0.850,0.090,0.000), vec3f(-1.280,0.420,0.000), vec3f(-1.050,0.000,0.000),
  vec3f(-0.850,0.090,0.000), vec3f(-1.050,0.000,0.000), vec3f(-0.850,-0.090,0.000),
  vec3f(-0.850,-0.090,0.000), vec3f(-1.050,0.000,0.000), vec3f(-1.280,-0.420,0.000),
  vec3f(0.020,0.270,0.000), vec3f(-0.240,0.560,0.000), vec3f(-0.400,0.190,0.000),
  vec3f(-0.400,-0.190,0.000), vec3f(-0.620,-0.400,0.000), vec3f(-0.640,-0.180,0.000));

const FISH_NRM: array<vec3f, 249> = array<vec3f, 249>(
  vec3f(-1.000,0.000,0.000), vec3f(-0.372,-0.907,0.197), vec3f(-0.259,-0.334,0.906),
  vec3f(-1.000,0.000,0.000), vec3f(-0.259,-0.334,0.906), vec3f(-0.286,0.456,0.842),
  vec3f(-1.000,0.000,0.000), vec3f(-0.286,0.456,0.842), vec3f(-0.372,0.907,-0.197),
  vec3f(-1.000,0.000,0.000), vec3f(-0.372,0.907,-0.197), vec3f(-0.259,0.334,-0.906),
  vec3f(-1.000,0.000,0.000), vec3f(-0.259,0.334,-0.906), vec3f(-0.286,-0.456,-0.842),
  vec3f(-1.000,0.000,0.000), vec3f(-0.286,-0.456,-0.842), vec3f(-0.372,-0.907,0.197),
  vec3f(-0.372,-0.907,0.197), vec3f(-0.275,-0.959,0.066), vec3f(-0.134,-0.356,0.925),
  vec3f(-0.372,-0.907,0.197), vec3f(-0.134,-0.356,0.925), vec3f(-0.259,-0.334,0.906),
  vec3f(-0.259,-0.334,0.906), vec3f(-0.134,-0.356,0.925), vec3f(-0.128,0.306,0.943),
  vec3f(-0.259,-0.334,0.906), vec3f(-0.128,0.306,0.943), vec3f(-0.286,0.456,0.842),
  vec3f(-0.286,0.456,0.842), vec3f(-0.128,0.306,0.943), vec3f(-0.275,0.959,-0.066),
  vec3f(-0.286,0.456,0.842), vec3f(-0.275,0.959,-0.066), vec3f(-0.372,0.907,-0.197),
  vec3f(-0.372,0.907,-0.197), vec3f(-0.275,0.959,-0.066), vec3f(-0.134,0.356,-0.925),
  vec3f(-0.372,0.907,-0.197), vec3f(-0.134,0.356,-0.925), vec3f(-0.259,0.334,-0.906),
  vec3f(-0.259,0.334,-0.906), vec3f(-0.134,0.356,-0.925), vec3f(-0.128,-0.306,-0.943),
  vec3f(-0.259,0.334,-0.906), vec3f(-0.128,-0.306,-0.943), vec3f(-0.286,-0.456,-0.842),
  vec3f(-0.286,-0.456,-0.842), vec3f(-0.128,-0.306,-0.943), vec3f(-0.275,-0.959,0.066),
  vec3f(-0.286,-0.456,-0.842), vec3f(-0.275,-0.959,0.066), vec3f(-0.372,-0.907,0.197),
  vec3f(-0.275,-0.959,0.066), vec3f(-0.095,-0.995,0.020), vec3f(-0.035,-0.295,0.955),
  vec3f(-0.275,-0.959,0.066), vec3f(-0.035,-0.295,0.955), vec3f(-0.134,-0.356,0.925),
  vec3f(-0.134,-0.356,0.925), vec3f(-0.035,-0.295,0.955), vec3f(-0.022,0.277,0.960),
  vec3f(-0.134,-0.356,0.925), vec3f(-0.022,0.277,0.960), vec3f(-0.128,0.306,0.943),
  vec3f(-0.128,0.306,0.943), vec3f(-0.022,0.277,0.960), vec3f(-0.095,0.995,-0.020),
  vec3f(-0.128,0.306,0.943), vec3f(-0.095,0.995,-0.020), vec3f(-0.275,0.959,-0.066),
  vec3f(-0.275,0.959,-0.066), vec3f(-0.095,0.995,-0.020), vec3f(-0.035,0.295,-0.955),
  vec3f(-0.275,0.959,-0.066), vec3f(-0.035,0.295,-0.955), vec3f(-0.134,0.356,-0.925),
  vec3f(-0.134,0.356,-0.925), vec3f(-0.035,0.295,-0.955), vec3f(-0.022,-0.277,-0.960),
  vec3f(-0.134,0.356,-0.925), vec3f(-0.022,-0.277,-0.960), vec3f(-0.128,-0.306,-0.943),
  vec3f(-0.128,-0.306,-0.943), vec3f(-0.022,-0.277,-0.960), vec3f(-0.095,-0.995,0.020),
  vec3f(-0.128,-0.306,-0.943), vec3f(-0.095,-0.995,0.020), vec3f(-0.275,-0.959,0.066),
  vec3f(-0.095,-0.995,0.020), vec3f(0.105,-0.994,0.006), vec3f(0.049,-0.274,0.961),
  vec3f(-0.095,-0.995,0.020), vec3f(0.049,-0.274,0.961), vec3f(-0.035,-0.295,0.955),
  vec3f(-0.035,-0.295,0.955), vec3f(0.049,-0.274,0.961), vec3f(0.056,0.266,0.962),
  vec3f(-0.035,-0.295,0.955), vec3f(0.056,0.266,0.962), vec3f(-0.022,0.277,0.960),
  vec3f(-0.022,0.277,0.960), vec3f(0.056,0.266,0.962), vec3f(0.105,0.994,-0.006),
  vec3f(-0.022,0.277,0.960), vec3f(0.105,0.994,-0.006), vec3f(-0.095,0.995,-0.020),
  vec3f(-0.095,0.995,-0.020), vec3f(0.105,0.994,-0.006), vec3f(0.049,0.274,-0.961),
  vec3f(-0.095,0.995,-0.020), vec3f(0.049,0.274,-0.961), vec3f(-0.035,0.295,-0.955),
  vec3f(-0.035,0.295,-0.955), vec3f(0.049,0.274,-0.961), vec3f(0.056,-0.266,-0.962),
  vec3f(-0.035,0.295,-0.955), vec3f(0.056,-0.266,-0.962), vec3f(-0.022,-0.277,-0.960),
  vec3f(-0.022,-0.277,-0.960), vec3f(0.056,-0.266,-0.962), vec3f(0.105,-0.994,0.006),
  vec3f(-0.022,-0.277,-0.960), vec3f(0.105,-0.994,0.006), vec3f(-0.095,-0.995,0.020),
  vec3f(0.105,-0.994,0.006), vec3f(0.279,-0.960,0.001), vec3f(0.118,-0.260,0.958),
  vec3f(0.105,-0.994,0.006), vec3f(0.118,-0.260,0.958), vec3f(0.049,-0.274,0.961),
  vec3f(0.049,-0.274,0.961), vec3f(0.118,-0.260,0.958), vec3f(0.126,0.255,0.959),
  vec3f(0.049,-0.274,0.961), vec3f(0.126,0.255,0.959), vec3f(0.056,0.266,0.962),
  vec3f(0.056,0.266,0.962), vec3f(0.126,0.255,0.959), vec3f(0.279,0.960,-0.001),
  vec3f(0.056,0.266,0.962), vec3f(0.279,0.960,-0.001), vec3f(0.105,0.994,-0.006),
  vec3f(0.105,0.994,-0.006), vec3f(0.279,0.960,-0.001), vec3f(0.118,0.260,-0.958),
  vec3f(0.105,0.994,-0.006), vec3f(0.118,0.260,-0.958), vec3f(0.049,0.274,-0.961),
  vec3f(0.049,0.274,-0.961), vec3f(0.118,0.260,-0.958), vec3f(0.126,-0.255,-0.959),
  vec3f(0.049,0.274,-0.961), vec3f(0.126,-0.255,-0.959), vec3f(0.056,-0.266,-0.962),
  vec3f(0.056,-0.266,-0.962), vec3f(0.126,-0.255,-0.959), vec3f(0.279,-0.960,0.001),
  vec3f(0.056,-0.266,-0.962), vec3f(0.279,-0.960,0.001), vec3f(0.105,-0.994,0.006),
  vec3f(0.279,-0.960,0.001), vec3f(0.330,-0.944,-0.013), vec3f(0.137,-0.255,0.957),
  vec3f(0.279,-0.960,0.001), vec3f(0.137,-0.255,0.957), vec3f(0.118,-0.260,0.958),
  vec3f(0.118,-0.260,0.958), vec3f(0.137,-0.255,0.957), vec3f(0.140,0.268,0.953),
  vec3f(0.118,-0.260,0.958), vec3f(0.140,0.268,0.953), vec3f(0.126,0.255,0.959),
  vec3f(0.126,0.255,0.959), vec3f(0.140,0.268,0.953), vec3f(0.330,0.944,0.013),
  vec3f(0.126,0.255,0.959), vec3f(0.330,0.944,0.013), vec3f(0.279,0.960,-0.001),
  vec3f(0.279,0.960,-0.001), vec3f(0.330,0.944,0.013), vec3f(0.137,0.255,-0.957),
  vec3f(0.279,0.960,-0.001), vec3f(0.137,0.255,-0.957), vec3f(0.118,0.260,-0.958),
  vec3f(0.118,0.260,-0.958), vec3f(0.137,0.255,-0.957), vec3f(0.140,-0.268,-0.953),
  vec3f(0.118,0.260,-0.958), vec3f(0.140,-0.268,-0.953), vec3f(0.126,-0.255,-0.959),
  vec3f(0.126,-0.255,-0.959), vec3f(0.140,-0.268,-0.953), vec3f(0.330,-0.944,-0.013),
  vec3f(0.126,-0.255,-0.959), vec3f(0.330,-0.944,-0.013), vec3f(0.279,-0.960,0.001),
  vec3f(0.330,-0.944,-0.013), vec3f(0.269,-0.850,-0.452), vec3f(0.146,-0.364,0.920),
  vec3f(0.330,-0.944,-0.013), vec3f(0.146,-0.364,0.920), vec3f(0.137,-0.255,0.957),
  vec3f(0.137,-0.255,0.957), vec3f(0.146,-0.364,0.920), vec3f(0.113,0.195,0.974),
  vec3f(0.137,-0.255,0.957), vec3f(0.113,0.195,0.974), vec3f(0.140,0.268,0.953),
  vec3f(0.140,0.268,0.953), vec3f(0.113,0.195,0.974), vec3f(0.269,0.850,0.452),
  vec3f(0.140,0.268,0.953), vec3f(0.269,0.850,0.452), vec3f(0.330,0.944,0.013),
  vec3f(0.330,0.944,0.013), vec3f(0.269,0.850,0.452), vec3f(0.146,0.364,-0.920),
  vec3f(0.330,0.944,0.013), vec3f(0.146,0.364,-0.920), vec3f(0.137,0.255,-0.957),
  vec3f(0.137,0.255,-0.957), vec3f(0.146,0.364,-0.920), vec3f(0.113,-0.195,-0.974),
  vec3f(0.137,0.255,-0.957), vec3f(0.113,-0.195,-0.974), vec3f(0.140,-0.268,-0.953),
  vec3f(0.140,-0.268,-0.953), vec3f(0.113,-0.195,-0.974), vec3f(0.269,-0.850,-0.452),
  vec3f(0.140,-0.268,-0.953), vec3f(0.269,-0.850,-0.452), vec3f(0.330,-0.944,-0.013),
  vec3f(0.000,0.000,1.000), vec3f(0.000,0.000,1.000), vec3f(0.000,0.000,1.000),
  vec3f(0.000,0.000,1.000), vec3f(0.000,0.000,1.000), vec3f(0.000,0.000,1.000),
  vec3f(0.000,0.000,1.000), vec3f(0.000,0.000,1.000), vec3f(0.000,0.000,1.000),
  vec3f(0.000,0.000,1.000), vec3f(0.000,0.000,1.000), vec3f(0.000,0.000,1.000),
  vec3f(0.000,0.000,-1.000), vec3f(0.000,0.000,-1.000), vec3f(0.000,0.000,-1.000));
struct BirdOut {
  @builtin(position) cp: vec4f,
  @location(0) shade: f32,     // bird: broadside-ness · fish: specular flash
  @location(1) fog: f32,
  @location(2) agit: f32,
  @location(3) dv: f32,        // fish dorsoventral (−belly..+back) for countershading
  @location(4) tone: f32,      // per-individual tone jitter
  @location(5) depth: f32,     // 0 surface .. 1 deep (underwater light grading)
  @location(6) wpos: vec3f,    // world position (caustics)
  @location(7) iri: f32,       // iridescence phase (thin-film sheen)
  @location(8) obj: vec3f,     // object-space position (fish eye placement)
  @location(9) near: f32,      // 1 = very close to camera .. 0 = far (eye LOD)
};
const UNSEEN_FRAC: f32 = 0.0;   // UNSEEN: replaced by the host when opts.unseen > 0
const BEE_SIZE: f32 = 1.0;      // THE BEE: agent #0's size multiplier — replaced when opts.bee > 0

@vertex
fn birdVs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> BirdOut {
  var o: BirdOut;
  let P = pos[ii]; let Vl = vel[ii];
  let p = P.xyz; let bank = Vl.w;
  var fwd = Vl.xyz;
  let fl = length(fwd);
  if (fl < 0.001) { fwd = vec3f(1.0, 0.0, 0.0); } else { fwd = fwd / fl; }
  var side = cross(fwd, vec3f(0.0, 1.0, 0.0));
  let sl = length(side);
  if (sl < 0.001) { side = vec3f(0.0, 0.0, 1.0); } else { side = side / sl; }
  let up = cross(side, fwd);
  let wing = side * cos(bank) + up * sin(bank);
  let nBird = normalize(cross(fwd, wing));
  var size = V.birdDark.w;
  let h = fract(sin(f32(ii) * 127.1) * 43758.5453);
  let h2 = fract(sin(f32(ii) * 71.7 + 3.1) * 24634.6345);
  /* UNSEEN: present to the physics, absent to the eye. Collapsing the instance to
     zero size costs one compare and leaves every force, neighbour count and
     contagion hop exactly as it was — the shards you see are moved by neighbours
     you cannot. */
  if (h < UNSEEN_FRAC) { size = 0.0; }
  /* THE BEE — agent #0 is the same letterform as every other shard, only LARGER.
     A queen is the same species as her workers; if she were a different shape she
     would read as a cursor pointing at the world instead of a visitor in it.
     Tested on the INSTANCE INDEX rather than a uniform. The compute uniform block
     does not exist in this shader, and reaching for its avatar field here failed
     to compile and blanked the ENTIRE render pass while the flock ran on at
     100fps behind it — a silent, total blackout with a healthy HUD. The avatar is
     always agent #0, so an index test is both correct and free.
     Never hidden by UNSEEN. */
  if (ii == 0u) { size = V.birdDark.w * BEE_SIZE; }
  let t = V.camPos.w;
  let agit = P.w;
  let fish = V.render.x;                 // 0 = bird · 1 = fish

  var wp: vec3f;
  var nFace: vec3f;
  o.dv = 0.0; o.tone = 1.0; o.obj = vec3f(0.0);
  if (fish > 0.5) {
    /* ---- FISH: vertical-lens body, swimming undulation, mirror flank --
       Body in fwd(x)/up(y); the flank normal is LATERAL (sideR). The tail
       sweeps side-to-side (undulation along sideR). Per-fish size jitter.
         render.y = swimHz · render.z = swimAmp · render.w = swimWave     */
    let cb = cos(bank); let sb = sin(bank);
    let upR = up * cb + side * sb;       // dorsoventral axis (roll-tilted)
    let sideR = side * cb - up * sb;     // lateral axis
    let fsize = size * (0.82 + 0.36 * h); // fish are not clones
    let l = FISH_POS[vi];
    let no = FISH_NRM[vi];
    // carangiform swim (biomechanically correct): the body wave STARTS AT THE
    // HEAD with ~zero amplitude and travels BACK to the tail, growing as it goes
    // (Undulatory Swimming, SMU). The '+ t' term makes the crest move nose→tail;
    // the smooth envelope grows the amplitude toward the tail — head barely moves.
    let tailF = smoothstep(0.72, -0.85, l.x);
    let u = sin(l.x * V.render.w + t * V.render.y * 6.2831 * (0.8 + 0.9 * agit) + h * 6.2831);
    let sway = u * V.render.z * tailF;
    wp = p + (fwd * l.x + upR * l.y + sideR * (l.z + sway)) * fsize;
    nFace = normalize(no.x * fwd + no.y * upR + no.z * sideR);   // true surface normal
    o.dv = clamp(l.y * 3.3, -1.0, 1.0);   // −belly .. +back
    o.tone = 0.86 + 0.28 * h2;
    o.obj = l;                            // object-space position for the eye
  } else {
    /* ---- BIRD: flap-glide (unchanged) --------------------------------
         skyTop.w = flapHz · skyMid.w = flapAmp · horizon.w = glideMix    */
    let l = STARLING[vi];
    let ph = (t * V.skyTop.w * (0.85 + 0.7 * agit) + h * 7.0) * 6.2831;
    let glideOsc = sin(t * (0.22 + h * 0.35) + h * 41.0);
    let gliding = select(0.0, 1.0, glideOsc < (V.horizon.w * 2.0 - 1.0)) * (1.0 - min(agit * 2.0, 1.0));
    let flap = sin(ph) * V.skyMid.w * (1.0 - gliding) + 0.22 * gliding;
    let reach = max(abs(l.z) - 0.25, 0.0);          // 0 on body & tail — wings only
    let tipY = flap * reach * 1.1;
    let span = 1.0 - 0.22 * max(flap, 0.0) * (1.0 - gliding);
    let zf = select(l.z, l.z * span, abs(l.z) > 0.3);
    wp = p + (fwd * l.x + wing * zf + nBird * tipY) * size;
    nFace = nBird;
  }
  o.cp = V.viewProj * vec4f(wp, 1.0);
  let toCam = normalize(V.camPos.xyz - wp);
  if (fish > 0.5) {
    /* SPECULAR MIRROR FLASH (guanine flanks): a glint from the half-vector
       between the sun and the eye against the flank, boosted by agitation so
       the flash BAND travels with the wave. Real fish-silver, not a tint.   */
    let face = nFace * sign(dot(nFace, toCam) + 1e-4);      // flank toward camera
    let half = normalize(normalize(V.sunDir.xyz) + toCam);
    let spec = pow(max(dot(face, half), 0.0), 22.0);
    o.shade = spec * (0.32 + 0.68 * min(agit * 2.0, 1.0)) * V.render2.x;
    // IRIDESCENCE PHASE — thin-film sheen grows toward grazing view of the
    // flank; a small per-fish offset varies the hue. Coloured in the fragment.
    o.iri = (1.0 - max(dot(face, toCam), 0.0)) * 2.4 + h * 0.5;
  } else {
    o.shade = abs(dot(toCam, nBird));    // bird broadside-ness (unchanged)
    o.iri = 0.0;
  }
  let d = distance(V.camPos.xyz, wp);
  o.fog = 1.0 - exp(-d * V.birdLight.w);
  o.agit = P.w;
  o.wpos = wp;
  o.depth = clamp((V.render3.x - wp.y) / max(V.render3.y, 1.0), 0.0, 1.0);   // surface→deep
  o.near = clamp(1.0 - d / 55.0, 0.0, 1.0);   // eyes only resolve up close (LOD fade)
  return o;
}
@fragment
fn birdFs(inp: BirdOut) -> @location(0) vec4f {
  var col: vec3f;
  if (V.render.x > 0.5) {
    /* ---- FISH: countershading + the SILVER FLASH WAVE ----------------
       COUNTERSHADING: dark dorsal → silver flank → pale ventral (a fish is
       never one colour).  THE FLASH: the specular mirror glint (computed in
       the vertex from sun+eye against the flank) lights the flank to silver;
       boosted by agitation so a bright band travels with the wave. birdDark =
       flank body · birdLight = silver · sunCol tints the caught light.       */
    let back  = V.birdDark.rgb * 0.55;                          // dark back
    let flank = V.birdDark.rgb;                                 // mid flank
    let belly = mix(V.birdDark.rgb, vec3f(0.55, 0.60, 0.66), 0.75); // pale underside
    var body = mix(flank, back, smoothstep(0.15, 0.9, inp.dv));
    body = mix(body, belly, smoothstep(-0.15, -0.9, inp.dv));
    body *= inp.tone;
    // CAUSTICS: the dancing surface-light net plays over the flank, strongest
    // near the surface and fading into the deep.
    let caus = caustic(inp.wpos.xz + inp.wpos.y * 0.3, V.camPos.w) * (1.0 - inp.depth);
    body += V.sunCol.rgb * caus * V.render2.z;
    let flash = clamp(inp.shade, 0.0, 1.0);
    col = mix(body, V.birdLight.rgb, flash);                    // the mirror lights up
    col += V.sunCol.rgb * flash * 0.5;                          // the caught glint
    // IRIDESCENCE — thin-film structural colour: a shifting blue/green/violet/
    // rose sheen at grazing angles, strongest where light is already catching.
    let hue = 0.5 + 0.5 * cos(6.2831 * (inp.iri + vec3f(0.0, 0.33, 0.66)));
    let sheen = pow(clamp(inp.iri, 0.0, 1.0), 1.6) * (0.35 + 0.65 * flash);
    col += hue * sheen * V.render3.z;
    // BIOLUMINESCENCE (Act III / night): the school glows cold blue where it
    // MOVES — a gentle base breathing glow, punched up by agitation, so the
    // wave itself becomes a travelling light. render3.w = biolum gain.
    col += vec3f(0.13, 0.72, 0.98) * (0.20 + 0.80 * min(inp.agit * 1.5, 1.0)) * V.render3.w;
    // DEPTH-SHIFT: fish fade toward the water colour at their own depth —
    // shallow fish stay silver-bright, deep fish sink into blue.
    let waterAtDepth = mix(V.horizon.rgb, V.skyTop.rgb, inp.depth);
    col = mix(col, waterAtDepth, inp.depth * V.render2.w);
    // EYE — a dark spot on each flank near the head, LOD-faded so it only
    // resolves up close (at flock distance the ball stays one organism).
    // camFwd.w = eyeGain. object eye centre ≈ (0.52, 0.09) on the flank.
    let ex = (inp.obj.x - 0.52) * 1.3; let ey = inp.obj.y - 0.09;
    let ed = sqrt(ex * ex + ey * ey);
    let onFlank = smoothstep(0.03, 0.06, abs(inp.obj.z));    // only on the sides, not the spine
    let eye = smoothstep(0.085, 0.03, ed) * inp.near * onFlank * V.camFwd.w;
    col = mix(col, vec3f(0.02, 0.02, 0.03), clamp(eye, 0.0, 1.0));
    col += vec3f(0.7, 0.75, 0.8) * smoothstep(0.03, 0.0, length(vec2f(ex + 0.02, ey - 0.02))) * inp.near * onFlank * V.camFwd.w * 0.6;  // catchlight
  } else {
    // broadside = dark silhouette · edge-on = catches the dusk light
    col = mix(V.birdLight.rgb, V.birdDark.rgb, pow(inp.shade, 0.65));
    col += V.sunCol.rgb * (1.0 - inp.shade) * 0.18;             // rim of low sun on edge-on wings
  }
  col = mix(col, V.skyMid.rgb, clamp(inp.fog, 0.0, 0.92));      // aerial/aquatic haze
  return vec4f(col, 1.0);
}

/* ---------------- DEBRIS — suspended particulate that reads the WAVE ----------
   Real particles in the water (not a backdrop): they drift on the current and
   are SHOVED by the same pressure front that hits the ball, then resettle. The
   scene-wide pressure made visible. Built camera-facing on the CPU.           */
struct DOut { @builtin(position) cp: vec4f, @location(0) uv: vec2f, @location(1) depth: f32, @location(2) bright: f32, @location(3) agit: f32, @location(4) kind: f32 };
@vertex fn debrisVs(@location(0) aPos: vec3f, @location(1) aUV: vec2f, @location(2) aB: vec2f, @location(3) aK: f32) -> DOut {
  var o: DOut; o.cp = V.viewProj * vec4f(aPos, 1.0); o.uv = aUV;
  o.depth = clamp((V.render3.x - aPos.y) / max(V.render3.y, 1.0), 0.0, 1.0);
  o.bright = aB.x; o.agit = aB.y; o.kind = aK; return o;
}
@fragment fn debrisFs(inp: DOut) -> @location(0) vec4f {
  let r = length(inp.uv);
  var col: vec3f; var a: f32;
  if (inp.kind < 0.5) {
    // BUBBLE — a rising ring: bright silver rim, translucent centre, catchlight
    let rim = smoothstep(0.55, 0.92, r) * smoothstep(1.0, 0.9, r);
    let fill = smoothstep(0.9, 0.0, r) * 0.14;
    col = mix(V.horizon.rgb, vec3f(0.9, 0.95, 1.0), 0.6);
    let glint = smoothstep(0.22, 0.0, length(inp.uv - vec2f(-0.32, 0.32)));
    a = (rim * 0.8 + fill + glint * 0.7) * inp.bright * (0.5 + 0.5 * inp.depth);
  } else if (inp.kind < 1.5) {
    // PLANKTON — a tiny crisp bright speck (and faint cold glow at night)
    let p = smoothstep(0.45, 0.0, r);
    col = mix(vec3f(0.75, 0.82, 0.80), vec3f(0.13, 0.72, 0.98), inp.agit * V.render3.w);
    a = p * inp.bright * (0.5 + 0.5 * inp.depth);
  } else if (inp.kind < 2.5) {
    // MARINE SNOW — a small soft irregular tan-white fleck, slow-sinking
    let s = smoothstep(0.7, 0.05, r) * (0.7 + 0.3 * sin(inp.uv.x * 9.0 + inp.uv.y * 7.0));
    col = vec3f(0.62, 0.62, 0.56);
    a = s * inp.bright * 0.7 * (0.4 + 0.6 * inp.depth);
  } else {
    // FISH SCALE — a guanine flake torn loose by a strike; silver with a thin-film
    // tint, FLASHING as it tumbles face-on (inp.bright carries the flash + fade,
    // inp.agit = how broadside it is right now).
    let core = smoothstep(0.55, 0.0, r);                 // a tight sparkle, not a soft blob
    let irid = vec3f(0.80 + 0.18 * sin(inp.uv.y * 6.0), 0.90, 0.86 + 0.14 * cos(inp.uv.x * 6.0));
    col = mix(vec3f(0.52, 0.62, 0.80), vec3f(0.92, 0.98, 1.0), inp.agit);
    col = mix(col, irid, 0.3);
    a = core * inp.bright * 0.92;
  }
  col += V.sunCol.rgb * inp.agit * 0.35;                            // everything catches light when the wave shoves it
  return vec4f(col, clamp(a, 0.0, 1.0));
}`;

    /* ---- buffers -------------------------------------------------------- */
    const f4 = 16;
    /* COPY_SRC so the positions can be MEASURED. A camera that holds its subject
       has to know how big the subject is, and nothing else in the engine can tell
       it: the world's declared extent is 130 while the organism actually occupies
       a fraction of that, so framing from the declaration puts the camera six
       times too far away. The flag costs nothing; the readback is deliberately
       OCCASIONAL and asynchronous, so the hot path never waits on it. */
    const bufOpts = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
    const posA = device.createBuffer({ size: MAX * f4, usage: bufOpts });
    const posB = device.createBuffer({ size: MAX * f4, usage: bufOpts });
    const velA = device.createBuffer({ size: MAX * f4, usage: bufOpts });
    const velB = device.createBuffer({ size: MAX * f4, usage: bufOpts });
    /* ZIGLIFE per-agent state (ping-ponged like pos/vel): life = (arousal,
       fatigue, age, spare). Only allocated when opts.rest — arousal starts
       awake (1); silence lets the field sleep. */
    let lifeA = null, lifeB = null;
    if (LIFE) {
      lifeA = device.createBuffer({ size: MAX * f4, usage: bufOpts });
      lifeB = device.createBuffer({ size: MAX * f4, usage: bufOpts });
      const linit = new Float32Array(MAX * 4);
      for (let n = 0; n < MAX; n++) { linit[n * 4] = REST_INIT; linit[n * 4 + 1] = 1.0; linit[n * 4 + 2] = (n * 0.6180339887) % 1; }   // .x arousal · .y energy · .z age (golden-ratio spread → mixed generations from the start) · .w bond 0
      device.queue.writeBuffer(lifeA, 0, linit); device.queue.writeBuffer(lifeB, 0, linit);
    }
    /* ZIGSEEK: a tiny uniform of world targets — seek (attractor) + avoid
       (repulsor) + cfg(reach). Its own buffer (not the packed Sim) → the Sim
       layout stays untouched and every non-seek world is byte-identical. */
    let seekBuf = null, seekArr = null;
    if (SEEK) {
      seekBuf = device.createBuffer({ size: 12 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      seekArr = new Float32Array(12);
    }
    /* ZIGATTACH: a one-value uniform — the global attach signal (0 free → 1
       bound). Per-agent bond lives in the shared life buffer's .w channel. */
    let attachBuf = null, attachArr = null;
    if (ATTACH) {
      attachBuf = device.createBuffer({ size: 4 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      attachArr = new Float32Array(4);
    }
    const gridCount = device.createBuffer({ size: CELLS * 4, usage: GPUBufferUsage.STORAGE });
    const gridIdx = device.createBuffer({ size: CELLS * CAP * 4, usage: GPUBufferUsage.STORAGE });
    const SIMF = 212;                                    // floats in Sim (+ modes + pace + avatar + morph/wardrobe)
    const VIEWF = 112;                                   // floats in View (+ render..render5 + noteBands[6] + render6) — render4.x chiaroscuro (v0.26) · render5.x rim (v0.31) · view[84..107] melodic strata (v0.32) · view[108..111] NOTE FLASH (v0.43). MUST match the View struct: the struct is declared in several shaders and the buffer is sized HERE — a mismatch fails the pipeline silently and the canvas goes black.
    const simBuf = device.createBuffer({ size: SIMF * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const viewBuf = device.createBuffer({ size: VIEWF * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const simArr = new Float32Array(SIMF);
    const simU32 = new Uint32Array(simArr.buffer);

    /* ---- seed the cloud (deterministic) --------------------------------- */
    const seedBirds = (anchor) => {
      const rng = (global.ZigCore ? global.ZigCore.rng : null);
      const r = rng ? rng(SEED) : Math.random;
      const P = new Float32Array(MAX * 4), Vv = new Float32Array(MAX * 4);
      for (let i = 0; i < MAX; i++) {
        const th = r() * 6.283, ph = Math.acos(2 * r() - 1), rad = 12 + 46 * Math.cbrt(r());
        P[i * 4] = anchor[0] + Math.sin(ph) * Math.cos(th) * rad;
        P[i * 4 + 1] = Math.max(6, anchor[1] + Math.cos(ph) * rad * 0.55);
        P[i * 4 + 2] = anchor[2] + Math.sin(ph) * Math.sin(th) * rad;
        P[i * 4 + 3] = 0;
        const va = r() * 6.283;
        Vv[i * 4] = Math.cos(va) * 10; Vv[i * 4 + 1] = (r() - 0.5) * 3; Vv[i * 4 + 2] = Math.sin(va) * 10;
        Vv[i * 4 + 3] = 0;
      }
      device.queue.writeBuffer(posA, 0, P); device.queue.writeBuffer(posB, 0, P);
      device.queue.writeBuffer(velA, 0, Vv); device.queue.writeBuffer(velB, 0, Vv);
    };

    /* ---- ZigMesh integration (additive · promoted during the Fireflies/
       Sickle build, 2026-07). When a species supplies opts.mesh, the letter-
       form is baked into the render WGSL as private arrays and the shard
       vertex/fragment paths are spliced in (V.render.x = 2). With NO mesh,
       the source below is exactly the golden string — Murmuration and School
       compile the same shaders they always did.                             */
    let RENDER_SRC = RENDER_WGSL;
    /* The varying must exist whenever ANYTHING references it. NOTE FLASH reads
       inp.bee to keep the flash hers alone, so turning the BEE off while FLASH
       was on left the fragment stage referencing a varying that was never
       declared — compile failure, black canvas. A splice must be conditioned on
       every consumer, not just its own dial. */
    if (BEE > 1 || NOTEFLASH) {
      /* THE BEE varying — declared by SPLICE, not in the struct text, because
         MATERIAL appends its own @location(10) snw by anchoring on the last
         struct line plus the closing brace. Writing a varying into that text
         directly BREAKS that anchor and collides on slot 10 — which is exactly
         what blanked the canvas. Location 11 leaves the anchor byte-identical. */
      /* INSERT BEFORE the `near` line, never between it and the closing brace.
         MATERIAL anchors on `near ... };` as one string, so anything placed
         BETWEEN them destroys that anchor no matter which slot it claims — that
         is what blanked the canvas twice. Going in ABOVE `near` leaves
         MATERIAL's anchor byte-identical whichever splice runs first. */
      const bA = "  @location(9) near: f32,";
      const bI = "  o.near = clamp(1.0 - d / 55.0, 0.0, 1.0);";
      if (RENDER_SRC.indexOf(bA) < 0 || RENDER_SRC.indexOf(bI) < 0)
        throw new Error("BEE varying anchor missing in render kernel");
      RENDER_SRC = RENDER_SRC
        .replace(bA, "  @location(11) bee: f32,      // 1 = THE BEE (agent #0) — the note flash is hers alone\n" + bA)
        .replace(bI, "  o.bee = select(0.0, 1.0, ii == 0u);\n" + bI);
    }
    if (UNSEEN > 0) {
      /* UNSEEN is a RENDER-side splice only — the compute kernel is untouched, so
         the hidden agents keep flocking, colliding, carrying contagion and being
         counted as neighbours exactly as before. Replaces a lone `const` line that
         nothing else claims. */
      const u1 = "const UNSEEN_FRAC: f32 = 0.0;";
      if (RENDER_SRC.indexOf(u1) < 0) throw new Error("UNSEEN splice anchor missing in render kernel");
      RENDER_SRC = RENDER_SRC.replace(u1, "const UNSEEN_FRAC: f32 = " + (+UNSEEN).toFixed(4) + ";");
    }
    if (BEE > 1) {
      const b1 = "const BEE_SIZE: f32 = 1.0;";
      if (RENDER_SRC.indexOf(b1) < 0) throw new Error("BEE splice anchor missing in render kernel");
      RENDER_SRC = RENDER_SRC.replace(b1, "const BEE_SIZE: f32 = " + (+BEE).toFixed(3) + ";");
    }
    if (MESH) {
      const ZM = global.ZigMesh;
      if (!ZM || !ZM.toWGSL) throw new Error("opts.mesh requires zigmesh.js to be loaded");
      /* FORM FIELD driver → the per-agent signal (0..1) that picks the letter
         from the rack. "biome" = a born hash (a fixed random form each — a mixed
         field); "age"/"energy" read the life buffer so FORM EXPRESSES STATE
         (young→old walks the rack; the exhausted collapse to later forms). */
      let FORM_SIG = "0.0";
      if (FORMFIELD === "biome") FORM_SIG = "fract(sin(f32(ii) * 34.71 + 5.3) * 92677.13)";
      else if (FORMFIELD === "age") { if (!LIFE) throw new Error("formField 'age' needs a life behavior (aging) for the life buffer"); FORM_SIG = "lifeR[ii].z"; }
      else if (FORMFIELD === "energy") { if (!LIFE) throw new Error("formField 'energy' needs a life behavior (fatigue) for the life buffer"); FORM_SIG = "1.0 - lifeR[ii].y"; }
      else if (FORMFIELD) throw new Error("unknown formField driver: " + FORMFIELD);
      const SHARD_VS = `
  if (V.render.x > 1.5) {
    /* SHARD (ZigMesh letterform) — roll-tilted like fish; x=length ·
       y=camber-normal · z=lateral. Early return: fully self-shaded. */
    let cb = cos(bank); let sb = sin(bank);
    let upR = up * cb + side * sb;
    let sideR = side * cb - up * sb;
    var ssize = size * (0.78 + 0.44 * h);
    let isAvatar = V.render2.x >= 0.0 && i32(V.render2.x) == i32(ii);
    /* mark gain (render2.y): 0 = truly incognito · ~1 = subtle ember ·
       ~3 = BEACON (study mode — the lead petal cannot be missed) */
    if (isAvatar) { ssize *= 1.0 + 0.32 * min(V.render2.y, 3.0); }
    ${WARD ? `/* WARDROBE / FORM FIELD — which letter this agent wears.
       Smaller letters clamp tail indices → whole triangles collapse to zero area. */
    ${FORMFIELD ? `/* FORM FIELD (${FORMFIELD}): a per-agent signal picks the letter from the rack — form expresses state. */
    let fsig = ${FORM_SIG};
    var li = min(u32(clamp(fsig, 0.0, 0.9999) * f32(SHARD_N)), SHARD_N - 1u);` : `/* WARDROBE: U.morph picks it globally, or per-agent mix to letterB (metamorphosis). */
    var li = min(u32(max(S.morph.x, 0.0) + 0.5), SHARD_N - 1u);
    if (S.morph.z > 0.001 && fract(sin(f32(ii) * 12.9898) * 43758.547) < S.morph.z) {
      li = min(u32(max(S.morph.y, 0.0) + 0.5), SHARD_N - 1u);
    }`}
    let cnt = SHARD_CNT[li];
    ${REVEAL ? `/* REVEAL WINDOW (the blend): render only a base→frontier FRAGMENT — a
       per-agent amount (its identity, rvHash) that UNFURLS with motion/breath (P.w =
       agit). Reuses the tail-collapse: verts past the frontier pile on it → zero area,
       no spikes. Rest = scattered fragments · play = the letters draw themselves. */
    let rvHash = fract(sin(f32(ii) * 91.17 + 12.3) * 47251.7);
    /* low render.w = a per-agent DRIFT of fragments (each unfurls its own amount);
       high render.w = every agent shows the WHOLE letter UNIFORMLY, so the field
       actually assembles into the shape and the N switch reads. The 'whole' ramp
       overrides the per-agent scatter once reveal is pushed up (5/6 · N-preview). */
    let frag = clamp(V.render.w * (0.42 + 0.9 * rvHash) + 0.75 * P.w, 0.12, 1.0);
    let whole = clamp((V.render.w - 0.9) / 0.7, 0.0, 1.0);   // 0 at render.w≤0.9 → 1 (all verts) at render.w≥1.6
    let reveal = max(frag, whole);
    let vcap = min(u32(max(reveal * f32(cnt - 1u), 1.0)), cnt - 1u);` : `let vcap = cnt - 1u;`}
    let vv = SHARD_OFS[li] + min(vi, vcap);` : ""}
    let l = SHARD_POS[${WARD ? "vv" : "vi"}];
    let no = SHARD_NRM[${WARD ? "vv" : "vi"}];
    let aux = SHARD_AUX[${WARD ? "vv" : "vi"}];
    /* FLUID SMEAR (render2.w gain): petals stretch along their motion —
       fast water becomes brushstrokes, still water stays petals */
    let smear = 1.0 + V.render2.w * min(fl * 0.18, 2.4);
    var swp = p + (fwd * (l.x * smear) + upR * l.y + sideR * (l.z / sqrt(smear))) * ssize;
    let sn = normalize(no.x * fwd + no.y * upR + no.z * sideR);
    ${BREATHE > 0 ? `/* MICRO-MEMBRANE: this letter is a film with its own pulse —
       it swells along its normal on a private clock, deeper when agitated */
    swp += sn * ssize * ${BREATHE.toFixed(3)} * sin(V.camPos.w * (1.6 + h * 1.2) + h2 * 6.2831 + l.x * 2.6)
           * (0.55 + 1.5 * min(P.w * 1.5, 1.0));` : ""}
    o.cp = V.viewProj * vec4f(swp, 1.0);
    let toCam = normalize(V.camPos.xyz - swp);
    let wrap = clamp(dot(sn, normalize(V.sunDir.xyz)) * 0.5 + 0.5, 0.0, 1.0);
    o.shade = wrap * wrap;                                  // moon wrap-light
    o.iri = pow(1.0 - abs(dot(sn, toCam)), 2.4);            // mid-turn grazing
    o.dv = aux.x;                                           // edge (−1..1)
    /* GLINT: true half-vector sparkle — lights only where tilt bisects
       moon↔eye. On a wavy field this draws the MOONPATH, and every passing
       crest shatters and reassembles it. Gain = V.render2.z (species dial). */
    let hvec = normalize(normalize(V.sunDir.xyz) + toCam);
    ${SHEEN ? `/* ANISOTROPIC SHEEN (Kajiya-Kay): the highlight runs ACROSS the blade and
       sweeps ALONG its length as it twists — silk / petal-grain, not a round dot.
       T = fwd (the blade's length axis); the band lives where H ⟂ T. */
    let sheenTH = dot(fwd, hvec);
    var glint = pow(sqrt(max(1.0 - sheenTH * sheenTH, 0.0)), 44.0);` : `var glint = pow(max(dot(sn, hvec), 0.0), 26.0);   // broad lobe — twisted petals still catch it`}
    /* THE LANE: concentrate the sparkle into the corridor between eye and
       moon azimuth — a moonPATH, not an even frost */
    let pdir = normalize(swp.xz - V.camPos.xz + vec2f(0.001, 0.0));
    let mdir = normalize(V.sunDir.xz + vec2f(0.001, 0.0));
    glint *= 0.25 + 2.4 * pow(max(dot(pdir, mdir), 0.0), 9.0);
    o.obj = vec3f(aux.y, glint, select(0.0, V.render2.y, isAvatar));   // u · glint · ember
    o.tone = 0.85 + 0.30 * h2;
    let sd = distance(V.camPos.xyz, swp);
    o.fog = 1.0 - exp(-sd * V.birdLight.w);
    o.agit = P.w;
    o.wpos = swp;
    ${TRANSMIT ? `/* LUMINESCENCE: forward-scatter lobe — strong where the moon sits
       BEHIND the blade pointing at the eye (light transmits through). Distort the
       light dir by the normal so the glow wraps the thin body. Carried in depth
       (unused by the shard FS) into the fragment. */
    let sunD3 = normalize(V.sunDir.xyz);
    let vlt = sunD3 + sn * 0.4;
    o.depth = pow(clamp(dot(toCam, -vlt), 0.0, 1.0), 3.0);` : `o.depth = 0.0;`}
    ${PHASE ? `let sph = ph[ii].x / 6.28318;
    o.near = smoothstep(0.0, 0.07, sph) * exp(-max(sph - 0.07, 0.0) * 5.5);   // ZigPhase pulse rides in 'near'` : `o.near = 0.0;`}
    return o;
  }
`;
      /* GRAIN-THROUGH-COLOUR strength (v0.24): derived from the skin's grain depth so
         even a smooth skin (nacre) shows some texture and a rough one shows a lot. */
      const GTHRU = MAT ? Math.min(0.9, Math.max(0.15, ((MAT.tex && MAT.tex[2]) || 0) * 2.5)) : 0;
      /* CHIAROSCURO shading builder (v0.26): the ambient + shadow-floor scale by (1 − V.render4.x),
         LIVE via the new render4.x slot. At render4.x = 0 this is arithmetically the original
         soft lighting (×1.0), so every other demo is unchanged; toward 1 only the light-facing
         side lights and the rest falls to black. One builder feeds the non-material line, the
         material-splice anchor, and the material block so they stay identical. */
      const SHADE = (sv) => `base * (vec3f(0.05, 0.07, 0.11) * (1.0 - V.render4.x) + V.sunCol.rgb * (0.22 * (1.0 - V.render4.x) + 0.95 * ${sv}))`;
      const SHARD_FS = `
  if (V.render.x > 1.5) {
    /* SHARD: two-tone dome/hollow — the flip IS the letter. birdDark = moss
       dome · birdLight = bone hollow · mid-turn iridescence rides agitation,
       so the WAVEFRONT itself glows a hue the settled field lacks. */
    let moss = V.birdDark.rgb;
    let bone = V.birdLight.rgb;
    var base = select(bone, moss, ff) * inp.tone;
${(SPECTRUM && MAT) ? `    var matGrain = 0.5;                                    // MATERIAL grain height (set by the material law) — lets texture read THROUGH the spectrum
` : ``}    var c = ${SHADE("inp.shade")};
    if (!ff) { c += bone * 0.05; }                          // the hollow holds its own light
    ${PHASE ? `c *= 0.35 + 1.5 * inp.near;                  // the heartbeat lifts the body` : ""}
    /* the rainbow: thin-film hue · gain = V.render3.z (species-controlled ink,
       same dial as fish iridescence). Per-agent phase (tone) + along-length
       drift spread the SPECTRUM across the field instead of one hue ×6000;
       agitation nearly doubles it, so the wave rolls through as color. */
    ${SPECTRUM ? `/* ZIGSPECTRUM: thin-film hue mapped ALONG the letter (spU 0=base → 1=tip).
       render3.x rotates which colors land where · render3.y spans how much of the
       wheel runs base→tip · a whisper of tone breaks the decal. THE LIGHTING SHOWS
       PORTIONS: the color rides pow(iri) — only the grazing/turning parts of each
       blade catch it, the rest falls to shadow, so with every blade pointing a
       different way the field is a drift of lit FRAGMENTS, never 100% of a letter. */
    let spU = inp.obj.x;
    /* SPREAD (V.render.z · 7/8 keys): per-agent hue scatter. 0 = one coherent band the whole
       field shares (Q sweeps it through a single dominant hue) → up = each shard takes its own
       place on the wheel, so the WHOLE SPECTRUM blooms across the field at once. */
    let spPh = V.render3.x + spU * V.render3.y + inp.tone * (0.10 + V.render.z);
    let hue = 0.5 + 0.5 * cos(6.2831 * (spPh + vec3f(0.0, 0.33, 0.66)));
    /* COMPOSE (v0.23): the spectrum TINTS the material body — so it reads on PALE skins too,
       not only dark ones — plus a glow. Scaled by ink (render3.z = I/K) × grazing × agit:
       ink 0 = pure material solid · ink up = the rainbow blooms over the pigment. */
    let sw = pow(inp.iri, 0.72) * V.render3.z * (0.50 + 0.85 * min(inp.agit * 1.6, 1.0))${PHASE ? ` * (0.40 + 2.0 * inp.near)` : ``};
    let lum = dot(c, vec3f(0.33, 0.5, 0.17));
    c = mix(c, hue * (0.25 + 1.6 * lum), clamp(sw, 0.0, 0.9)) + hue * sw * 0.30;` : `let hue = 0.5 + 0.5 * cos(6.2831 * (inp.iri * 1.15 + inp.obj.x * 0.35 + inp.tone * 1.7 + vec3f(0.0, 0.33, 0.66)));
    c += hue * pow(inp.iri, 0.72) * V.render3.z * (0.50 + 0.85 * min(inp.agit * 1.6, 1.0))${PHASE ? `
         * (0.40 + 2.0 * inp.near);                         // flash = a surge of RAINBOW` : ";"}`}
    /* SHADOW COMPLEMENT (V.render.y · 9/0 keys): the dark side takes the COMPLEMENT of the
       current SPECTRUM hue — always a real colour even on a grey/pale skin (gold wheel → blue
       shadow), and it follows Q around the wheel. Value-preserving: (max+min)−hue. Weighted to
       the shadow side (1−shade) so lit areas keep the primary. 0 = classic dark. */
    let shue = vec3f(max(hue.r, max(hue.g, hue.b)) + min(hue.r, min(hue.g, hue.b))) - hue;
    c += shue * V.render.y * (1.0 - inp.shade) * 0.85;
    ${(SPECTRUM && MAT) ? `/* GRAIN THROUGH COLOUR (v0.24): the skin's grain corrugates the spectrum too, so the
       surface texture survives even at full ink — texture is a permanent property of the
       material, not something the colour instrument erases. matGrain = the filtered grain
       height the relief uses; strength scales with how much spectrum is present (sw). */
    c *= mix(1.0, 0.62 + 0.76 * matGrain, ${GTHRU.toFixed(3)} * clamp(sw, 0.0, 1.0));
    ` : ``}${PHASE ? `c += vec3f(1.0, 1.0, 0.92) * pow(inp.near, 2.0) * pow(inp.iri, 0.5) * 0.20;   // white-hot at the peak` : ""}
    ${TRANSMIT ? `/* LUMINESCENCE (backlit transmission): a thin petal between you and
       the moon stops reflecting and GLOWS FROM WITHIN — moonlight passes through it,
       carrying the blade's own colour (body + a breath of its spectrum) out to the
       eye. inp.depth is the forward-scatter lobe from the VS. Living matter, not paint. */
    let trans = inp.depth;
    c += (base * 0.9 + hue * 0.7) * (V.sunCol.rgb + vec3f(0.10)) * trans * ${TRANSMIT.toFixed(2)};` : ""}
    c += V.sunCol.rgb * pow(inp.iri, 2.2) * 0.32;           // moon rim
    /* THE MOONPATH: glitter where the water's tilt agrees with the sky */
    c += V.sunCol.rgb * inp.obj.y * V.render2.z * (0.45 + 1.55 * min(inp.agit * 1.5, 1.0));   // MOVING petals blaze
    /* the avatar's subtle ember — a warmth its kin don't carry (obj.z gain) */
    c += vec3f(1.0, 0.58, 0.20) * inp.obj.z * (0.16 + 0.55 * inp.near + 0.30 * inp.agit);
    /* THE RESONATOR (S.pace.w voice, 2026-07-20): a voice-0 stratum is the
       instrument BODY, not a second dancer. It holds NO light of its own —
       moon, moonpath, rainbow, everything is gated to zero — and glows only
       where a wave is passing (agit) or a toll is ringing (near). The color
       it shows is the strike's own shading, borrowed, then drained slowly. */
    if (S.pace.w < 0.5) {
      let rung = max(min(inp.agit * 1.25, 1.0), inp.near);
      c *= mix(0.04, 1.0, rung * rung);
    }
    ${(BACKFAB && MAT) ? fabricBlock(BACKFAB) : ``}
    ${MEMBACK ? `if (!ff && V.render4.w > 0.001) {
      /* MEMORY UNDERSIDE (v0.27): the back doesn't show the present colour — it glows with
         a lingering GHOST of the recent phrase. render4.y = the remembered hue (a slow lag
         of what you've played) · render4.z = how strongly it still burns (rises as you play,
         fades over seconds of silence) · render4.w = live on/off amount (Shift+M). The front
         is where you ARE; the back is where you've BEEN — the turning field flashes it. */
      let mh = V.render4.y;
      let mcol = 0.5 + 0.5 * cos(6.2831 * (mh + vec3f(0.0, 0.33, 0.66)));
      /* TINT the already-TEXTURED back (grain/relief/specular survive) toward the memory
         hue, preserving its light-and-dark so the surface still reads — then a soft inner
         burn. Texture first, memory as its colour. */
      let lumc = dot(c, vec3f(0.33, 0.5, 0.17));
      let memC = mix(c, mcol * (0.35 + 1.5 * lumc), 0.7) + mcol * V.render4.z * 0.35;
      c = mix(c, memC, V.render4.w);
    }` : ``}
    ${NOTEFLASH ? `if (inp.bee > 0.5 && V.render6.z > 0.001) {
      /* NOTE FLASH (v0.43, Bill) — THE BEE's two faces answer a note DIFFERENTLY.
         Her cupped INTERIOR takes the pitch-class hue, the same (pitch mod 12)/12
         wheel MELODIC STRATA already uses; her OUTSIDE takes one fixed colour
         whatever is played. As she turns she alternates between a constant skin
         and an interior that is different for every pitch.
         HERS ALONE (v0.43.1): the first version lit every shard's cup, which made
         the whole field answer the note and lost her entirely — the point is that
         SHE is the one carrying it, a single lit interior among a thousand dark
         ones. The bee varying gates it.
         render6.x = interior hue · render6.y = exterior hue ·
         render6.z = flash amount, rising on a note and decaying. Zero = off. */
      let nf = V.render6.z;
      let hh = select(V.render6.y, V.render6.x, !ff);        // inside = the note · outside = one colour
      let ncol = 0.5 + 0.5 * cos(6.2831 * (hh + vec3f(0.0, 0.33, 0.66)));
      let lumn = dot(c, vec3f(0.33, 0.5, 0.17));
      /* tint the already-textured face so grain, relief and specular survive,
         then add a soft inner burn — the flash lights the surface, not over it. */
      c = mix(c, ncol * (0.30 + 1.6 * lumn), nf * 0.80) + ncol * nf * 0.30;
    }` : ``}
    ${(GEM && MAT) ? gemBlock(GEM, GEMCOND) : ``}
    c *= 0.82 + 0.18 * (1.0 - abs(inp.dv));                 // edge occlusion
    /* SILHOUETTE RIM (v0.31 · live V.render5.x): a fresnel edge RE-DRAWS each
       letter's outline against the void — legible under ANY material (gem,
       fabric, bare skin) and on EITHER face. It depends on NOTHING but wpos —
       the geometric normal is recovered from screen-space derivatives, so every
       mesh organism inherits it whether or not it wears a material. The branch
       is on a UNIFORM (render5.x), so the derivatives are in uniform control
       flow — legal. abs(dot) makes it face-independent: the silhouette is where
       the surface turns perpendicular to the eye, front OR concave back.
       render5.y = sharpness (thin↔wide edge). Zero at render5.x = 0. */
    if (V.render5.x > 0.001) {
      let rToCam = normalize(V.camPos.xyz - inp.wpos);
      let rNgeo = normalize(cross(dpdx(inp.wpos), dpdy(inp.wpos)));
      let rimF = pow(1.0 - clamp(abs(dot(rNgeo, rToCam)), 0.0, 1.0), max(V.render5.y, 0.25));
      let rimCol = mix(vec3f(0.86, 0.91, 1.0), V.sunCol.rgb, 0.35);   // cool moon-white, warmed toward the scene light
      c += rimCol * rimF * V.render5.x;
    }
    /* MELODIC STRATA (v0.32): the MELODY written onto the body's vertical axis — as LIGHT,
       not colour (colour is owned by the spectrum/gem/Q). Each note is a band at
       V.noteBands[i] = (worldY, _, energy, _): where a shard's world height is near the band,
       it BRIGHTENS — the body's OWN colour lit up, plus a neutral grazing glow — scaled by the
       band's fading energy. A phrase leaves a trail of light climbing and falling the body;
       play fast and the bands overlap into a slow luminous tapestry. Zero when silent. */
    for (var nb: i32 = 0; nb < 6; nb = nb + 1) {
      let band = V.noteBands[nb];
      if (band.z > 0.004) {
        let prox = smoothstep(7.0, 0.0, abs(inp.wpos.y - band.x));         // 7-unit band half-height falloff
        let bl = band.z * prox;
        c = c * (1.0 + 1.1 * bl) + V.sunCol.rgb * (0.30 * bl) * (0.5 + 0.9 * inp.iri);   // brighten the body + a neutral grazing glow (no new hue)
      }
    }
    col = mix(c, V.skyMid.rgb, clamp(inp.fog, 0.0, 0.92));
    return vec4f(col, 1.0);
  }
`;
      RENDER_SRC = RENDER_SRC
        .replace("struct View {", (WARD ? ZM.toWGSLMany(MESHES, "SHARD") : ZM.toWGSL(MESH, "SHARD")) + "\nstruct View {")
        .replace("@group(0) @binding(2) var<storage, read> vel: array<vec4f>;",
                 "@group(0) @binding(2) var<storage, read> vel: array<vec4f>;" +
                 (PHASE ? "\n@group(0) @binding(3) var<storage, read> ph: array<vec2f>;" : "") +
                 /* VOICE: the shard FS reads the flock's own Sim uniform (same
                    buffer as compute) through a thin mirror — pace lands at
                    vec4 #49 of the 52-vec4 layout (208 floats).             */
                 "\nstruct SimR { blk: array<vec4f, 49u>, pace: vec4f, avA: vec4f, avB: vec4f, morph: vec4f };" +
                 "\n@group(0) @binding(4) var<uniform> S: SimR;")
        .replace("fn birdFs(inp: BirdOut) -> @location(0) vec4f {",
                 "fn birdFs(inp: BirdOut, @builtin(front_facing) ff: bool) -> @location(0) vec4f {")
        .replace("var col: vec3f;\n  if (V.render.x > 0.5) {",
                 "var col: vec3f;\n" + SHARD_FS + "  if (V.render.x > 0.5) {")
        .replace("var wp: vec3f;\n  var nFace: vec3f;",
                 SHARD_VS + "  var wp: vec3f;\n  var nFace: vec3f;");

      /* GEM: the sky sampler the refraction/reflection read (analytic sky + moon). Declared
         after V's binding so it can read the View uniform. */
      if (GEM) RENDER_SRC = RENDER_SRC.replace(
        "@fragment\nfn birdFs(inp: BirdOut, @builtin(front_facing) ff: bool) -> @location(0) vec4f {",
        "fn gemHueRot(c: vec3f, a: f32) -> vec3f {\n" +   // rotate a colour's HUE around the grey axis (Q drives 'a'), preserving its depth
        "  let k = vec3f(0.57735027);\n  let ca = cos(a);\n  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);\n}\n" +
        "fn gemSky(d: vec3f) -> vec3f {\n" +
        "  let t = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);\n" +
        "  var s = mix(V.horizon.rgb, V.skyTop.rgb, t) * 1.5 + vec3f(0.07, 0.08, 0.11);\n" +   // brighter sky + ambient so the stones aren't refracting pure black
        "  let md = normalize(V.sunDir.xyz);\n" +
        "  s = s + V.sunCol.rgb * pow(max(dot(d, md), 0.0), 28.0) * 4.5;\n" +                    // the moon — a strong catch-light
        "  s = s + vec3f(0.85, 0.92, 1.0) * pow(max(dot(d, normalize(vec3f(-0.55, 0.35, -0.55))), 0.0), 16.0) * 1.8;\n" +   // cool fill (a display-case light)
        "  s = s + vec3f(1.0, 0.86, 0.6) * pow(max(dot(d, normalize(vec3f(0.5, -0.15, 0.6))), 0.0), 20.0) * 1.4;\n" +   // warm kick
        "  return s;\n}\n" +
        "@fragment\nfn birdFs(inp: BirdOut, @builtin(front_facing) ff: bool) -> @location(0) vec4f {");

      /* BIOME splices — per-agent born color + companion metal on the edge */
      if (BIOME) {
        const fb = (x) => { const s = (Math.round(x * 10000) / 10000).toString(); return s.indexOf(".") < 0 && s.indexOf("e") < 0 ? s + ".0" : s; };
        const K = BIOME.notes.length;
        const row = (key) => BIOME.notes.map((n) => "vec3f(" + n[key].map(fb).join(",") + ")").join(",");
        const a1 = "o.wpos = swp;\n    o.depth = 0.0;";
        const a2 = "let moss = V.birdDark.rgb;\n    let bone = V.birdLight.rgb;";
        const a3 = "c *= 0.82 + 0.18 * (1.0 - abs(inp.dv));";
        if (RENDER_SRC.indexOf(a1) < 0 || RENDER_SRC.indexOf(a2) < 0 || RENDER_SRC.indexOf(a3) < 0)
          throw new Error("BIOME splice anchor missing in shard render");
        RENDER_SRC = RENDER_SRC
          .replace("struct View {",
            "const BIOME_K: u32 = " + K + "u;\n" +
            "const BIOME_D = array<vec3f, " + K + ">(" + row("dark") + ");\n" +
            "const BIOME_L = array<vec3f, " + K + ">(" + row("light") + ");\n" +
            "struct View {")
          .replace(a1, "o.wpos = swp;\n    o.depth = f32(ii);   // BIOME: who I am — my born color rides this")
          .replace(a2,
            `/* THE ORCHARD LAW: every letter is born ONE note of the family —
       no gradients; from afar, one enormous living organism; up close,
       thousands of individuals. morph.w drifts the whole population
       through the family so slowly nobody sees anyone change. */
    let bseed = fract(sin(inp.depth * 7.1313) * 3711.73);
    let bi = u32(bseed * f32(BIOME_K) + S.morph.w) % BIOME_K;
    let moss = BIOME_D[bi];
    let bone = BIOME_L[bi];`)
          .replace(a3,
            `/* COMPANION METAL: the leading edge catches burnished copper —
       breath-gated (V.render3.w). Not bright. Just enough: precious. */
    c += vec3f(0.98, 0.46, 0.13) * pow(clamp(abs(inp.dv), 0.0, 1.0), 6.0) * V.render3.w * (0.30 + 0.70 * min(inp.agit * 1.4, 1.0));
    ` + a3);
      }

      /* MATERIAL splice (v0.10.2 · normal-RELIEF): the composition profile —
         fractal grain + weathering + subsurface — in the letter's OWN uv
         (obj.x = u along the length, dv = across the width). The grain is now a
         HEIGHT FIELD: we carry the geometric normal to the fragment (snw) and
         perturb it per-pixel by the grain's screen-space gradient (derivative
         bump — no precomputed tangents), so the surface CATCHES AND LOSES LIGHT
         in its own grain and resolves at every zoom. All changes live inside
         this block → byte-identical without opts.material. */
      if (MAT) {
        const t = MAT.tex || [0, 0, 0, 30, 0, 0, 0, 0];
        const fmt = (x) => { const s = (Math.round(x * 10000) / 10000).toString(); return s.indexOf(".") < 0 && s.indexOf("e") < 0 ? s + ".0" : s; };
        const gsc = Math.max(t[1], 1);
        const sample = (t[0] === 2)                       // fiber → grain runs ALONG the letter (anisotropic)
          ? `vec2f(muv.y * ${fmt(gsc)}, muv.x * ${fmt(gsc * 0.14)})`
          : `(muv * ${fmt(gsc)})`;
        const helpers =
          "fn hvM(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }\n" +
          "fn vnM(p: vec2f) -> f32 { let i = floor(p); let f = fract(p); let u = f*f*(3.0-2.0*f); return mix(mix(hvM(i), hvM(i+vec2f(1.0,0.0)), u.x), mix(hvM(i+vec2f(0.0,1.0)), hvM(i+vec2f(1.0,1.0)), u.x), u.y); }\n" +
          /* FOOTPRINT-AWARE fbm: each octave fades toward its mean (0.5) once its
             period drops below the pixel footprint w — analytic mipmapping, so
             the grain resolves close and averages out far instead of aliasing. */
          "fn fbmMf(p: vec2f, w: f32) -> f32 { var v = 0.0; var a = 0.5; var q = p; var fr = 1.0; for (var i = 0; i < 5; i = i + 1) { let fade = clamp(1.0 - w * fr * 1.5, 0.0, 1.0); v = v + a * mix(0.5, vnM(q), fade); q = q * 2.03 + vec2f(11.3, 7.7); a = a * 0.5; fr = fr * 2.03; } return v; }\n";
        const consts =
          "const MAT_DEPTH: f32 = " + fmt(t[2]) + ";\nconst MAT_WEATHER: f32 = " + fmt(t[7]) + ";\nconst MAT_SSS: f32 = " + fmt(t[6]) + ";\n" +
          "const MAT_RELIEF: f32 = " + fmt(Math.min(0.9, t[2] * 1.6)) + ";\n" +   // relief strength from grain depth
          "const MAT_SPECPOW: f32 = " + fmt(Math.max(2, t[3] || 26)) + ";\nconst MAT_SPECGAIN: f32 = " + fmt(t[4] || 0) + ";\n";   // STUDIO SPECULAR: the material's highlight power/gain (6 velvet · 140 glass)
        const aBird = "@location(9) near: f32,      // 1 = very close to camera .. 0 = far (eye LOD)\n};";
        const aInit = "o.dv = 0.0; o.tone = 1.0; o.obj = vec3f(0.0);";
        const aSn = "let sn = normalize(no.x * fwd + no.y * upR + no.z * sideR);";
        const aM = "    var c = " + SHADE("inp.shade") + ";";
        if (RENDER_SRC.indexOf(aBird) < 0) throw new Error("MATERIAL relief anchor (BirdOut) missing");
        if (RENDER_SRC.indexOf(aInit) < 0) throw new Error("MATERIAL relief anchor (VS init) missing");
        if (RENDER_SRC.indexOf(aSn) < 0) throw new Error("MATERIAL relief anchor (shard normal) missing");
        if (RENDER_SRC.indexOf(aM) < 0) throw new Error("MATERIAL splice anchor missing in shard render");
        RENDER_SRC = RENDER_SRC
          .replace("struct View {", helpers + consts + "struct View {")
          /* carry the geometric world normal to the fragment (new varying) */
          .replace(aBird, "@location(9) near: f32,      // 1 = very close to camera .. 0 = far (eye LOD)\n  @location(10) snw: vec3f,     // MATERIAL: geometric world normal — per-pixel relief\n};")
          .replace(aInit, aInit + " o.snw = vec3f(0.0, 1.0, 0.0);")   // bird/fish paths: harmless default
          .replace(aSn, aSn + "\n    o.snw = sn;")                    // shard path: the real normal
          .replace(aM, `
    /* THE MATERIAL LAW in the field — composition WITH RELIEF, FOOTPRINT-AWARE.
       The grain is a height field, filtered by its on-screen footprint so it
       resolves close, softens far, and stops sparkling/crawling. The bump uses
       the SAME filtered height, so relief auto-eases with distance. obj.x = u
       along length · dv = across the width. */
    let muv = vec2f(inp.obj.x, inp.dv * 0.5 + 0.5);
    let sc = ${sample};                                  // grain sample coord
    let scw = max(fwidth(sc).x, fwidth(sc).y);           // footprint: noise units per pixel
    let gh = mix(fbmMf(sc, scw), fbmMf(sc * 3.1 + vec2f(2.3, 7.1), scw * 3.1), 0.5);
    var Ng = normalize(inp.snw);${MEMBACK ? `
    if (!ff) { Ng = -Ng; }   // UNDERSIDE: flip the normal so the back's grain, relief & specular are lit correctly — texture reads on the underside as it turns to the light` : ``}
    let dpx = dpdx(inp.wpos); let dpy = dpdy(inp.wpos);
    let r1 = cross(dpy, Ng); let r2 = cross(Ng, dpx);
    let det = dot(dpx, r1);
    let idet = sign(det) / max(abs(det), 1e-6);          // det==0 → idet 0 → no perturbation
    let sg = (dpdx(gh) * r1 + dpdy(gh) * r2) * idet;      // world-space gradient of the FILTERED grain
    let reliefF = clamp(1.0 - scw * 0.5, 0.15, 1.0);      // ease relief as the grain shrinks on screen
    let reliefAmt = select(MAT_RELIEF, MAT_RELIEF * 0.35, !ff);   // BUFF the interior (v0.34): soften the relief on the BACK so the mesh facet seams stop catching as hard straight lines — the cut still reads, the grid softens (front keeps its full crisp relief · feeds the gem too, which shares Nr)
    let Nr = normalize(Ng - reliefAmt * reliefF * sg);
    let mshade0 = clamp(dot(Nr, normalize(V.sunDir.xyz)) * 0.5 + 0.5, 0.0, 1.0);
    let matShade = mshade0 * mshade0;                     // reduces to inp.shade when grain is flat
    var c = ${SHADE("matShade")};
    let wuv = muv * 2.4 + vec2f(5.0, 9.0);
    c *= mix(1.0, 0.68 + 0.7 * gh, MAT_DEPTH * 0.55);     // gentle tonal grain (relief carries the depth)
    c *= mix(1.0, 0.6 + 0.8 * fbmMf(wuv, max(fwidth(wuv).x, fwidth(wuv).y)), MAT_WEATHER);
    c += bone * vec3f(1.0, 0.86, 0.76) * (MAT_SSS * 0.14 * (1.0 - matShade));
    /* STUDIO SPECULAR (v0.26 · rides the light dial render4.x): the material's own
       highlight from the single light, per-pixel over the relief normal — it SWEEPS
       across the form as the shard turns, the way the one letter acts in the Studio.
       Scaled by chiaro so it's byte-identical when the light dial is at 0. */
    let toCamM = normalize(V.camPos.xyz - inp.wpos);
    let Hm = normalize(normalize(V.sunDir.xyz) + toCamM);
    let mSpecP = select(MAT_SPECPOW, MAT_SPECPOW * 0.4, !ff);    // BUFF the interior: broader (softer) highlight on the back so facet creases don't flash as thin bright lines
    let mSpecG = select(MAT_SPECGAIN, MAT_SPECGAIN * 0.5, !ff);   // and dimmer on the back
    c += V.sunCol.rgb * pow(max(dot(Nr, Hm), 0.0), mSpecP) * mSpecG * (V.render4.x * 1.7);${SPECTRUM ? "\n    matGrain = gh;                                        // hand the grain to the colour instrument (v0.24) so texture survives high ink" : ""}`);
      }
    }

    /* ==== RADIANCE 0.1.0 — the first Canon law ================================
       THE SECOND LIGHT. Every optical law before this one modelled light inside
       the world. This one models the source that is NOT in the world: the room.
       Ambient light lands on the panel and reflects to the eye, adding a
       constant to every pixel. Perceived = displayed + veil. A linear delta
       survives that addition; a RATIO does not — two near-blacks at 0.00 and
       0.05 are infinite contrast in a dark room and 1.25:1 in a lit one. The
       modelling does not dim, it DISAPPEARS, which is why the summit's bright
       classroom flattened a field that reads beautifully on eyeZ at night.

       MECHANISM. Remap outgoing LUMINANCE, then scale the colour by the ratio,
       so hue and saturation are untouched and every skin/gem/spectrum Bill has
       tuned by eye survives intact:
           x  = max((L - black) / (1 - black), 0)     drop the drowned region
           x  = pow(x * gain, 1/gamma)                expose, then expand shadows
           L' = x / (1 + max(x - knee, 0))            soft shoulder, never flat white
           c' = c * mix(1, L'/L, V.render6.w)         the LIVE dial

       Transcribed from ZigCore.Radiance.tone(); test/law_radiance_ref.mjs proves
       the two agree to 1e-6 across the range and at every room.

       TWO GUARANTEES, which is the whole point of the Canon contract:
         · opts.radiance ABSENT → not one character below is emitted. The shader
           is byte-identical to the pre-law shader.
         · opts.radiance PRESENT but the dial at 0 → mix(1.0, k, 0.0) = 1.0, so
           c is multiplied by exactly one. Arithmetic identity, mid-frame,
           which is what lets Bill A/B the law against itself on one keypress
           instead of against a memory of a different build.

       METAL: no arrays, no var<private>, no mutable locals, no derivatives, and
       nothing reachable from a vertex function. Fragment-only scalar math. */
    if (RAD) {
      const rf = (x) => { const s = (Math.round((+x) * 1e6) / 1e6).toString();
        return (s.indexOf(".") < 0 && s.indexOf("e") < 0 && s.indexOf("E") < 0) ? s + ".0" : s; };
      const RAD_HELPERS =
        "/* RADIANCE " + (RAD.version || "0.1.0") + (RAD.preset ? " · room \"" + RAD.preset + "\"" : "") + " */\n" +
        "const RAD_BLACK: f32 = " + rf(RAD.black) + ";\n" +
        "const RAD_GAIN:  f32 = " + rf(RAD.gain) + ";\n" +
        "const RAD_INVG:  f32 = " + rf(1 / (+RAD.gamma || 1)) + ";\n" +
        "const RAD_KNEE:  f32 = " + rf(RAD.knee === undefined ? 1e9 : RAD.knee) + ";\n" +
        "fn radTone(L: f32) -> f32 {\n" +
        "  var x = max((L - RAD_BLACK) / (1.0 - RAD_BLACK), 0.0);\n" +
        "  x = pow(x * RAD_GAIN, RAD_INVG);\n" +
        "  return x / (1.0 + max(x - RAD_KNEE, 0.0));\n" +
        "}\n" +
        "fn radiance(c: vec3f, amt: f32) -> vec3f {\n" +
        "  let L = dot(c, vec3f(0.2126, 0.7152, 0.0722));\n" +
        "  if (L <= 1e-5) { return c; }\n" +          // black stays black — the floor is the room's, not ours
        "  return c * mix(1.0, radTone(L) / L, amt);\n" +
        "}\n";
      const rShard = "    col = mix(c, V.skyMid.rgb, clamp(inp.fog, 0.0, 0.92));";
      const rBird  = "  col = mix(col, V.skyMid.rgb, clamp(inp.fog, 0.0, 0.92));      // aerial/aquatic haze";
      if (RENDER_SRC.indexOf(rShard) < 0 && RENDER_SRC.indexOf(rBird) < 0)
        throw new Error("RADIANCE splice anchor missing in render kernel");

      /* THE ORDERING CONTRACT (Canon.Order 1.0.0) — RADIANCE DOES NOT SPLICE
         ITSELF. It files a claim at station "tone" on the `frame.light` rail
         and the rail emits every claim once, in station order, at this one
         insertion point. Two consequences, and the second is the reason:

           · The append inversion cannot happen here. There is no `A + block`
             vs `block + A` choice left to make, so no law's position can be
             decided by which idiom its author reached for.
           · When AMBIENCE lands at station "medium" it will be emitted BEFORE
             this line without a single character of this block changing. Its
             scattering therefore reaches the tone remap, which is the whole
             Ambience-vs-Radiance question, settled in the rail rather than
             re-litigated in every build.

         `render()` reproduces the hand-written house style exactly — statement
         at the local indent, note aligned to column 43 — so the emitted shader
         does not advertise which of its lines a machine wrote. */
      const Order = global.ZigCore && global.ZigCore.Canon && global.ZigCore.Canon.Order;
      if (!Order) throw new Error("RADIANCE requires ZigCore.Canon.Order (the ordering contract) \u2014 zigcore.js is too old");
      Order.reset("frame.light");
      Order.claim("frame.light", {
        id: "radiance", since: RAD.version || "0.1.0",
        station: "tone", mode: "modulate", face: "both",
        wgsl: "col = radiance(col, V.render6.w);",
        note: "// RADIANCE: the room is a light source too"
      });
      RENDER_SRC = RENDER_SRC
        .replace("struct View {", RAD_HELPERS + "struct View {")
        .replace(rShard, rShard + "\n" + Order.render("frame.light", { indent: "    ", noteCol: 43 }))
        .replace(rBird,  rBird  + "\n" + Order.render("frame.light", { indent: "  ",   noteCol: 43 }));
    }

    /* ---- ZigPhase (additive · the TIME law, promoted during the Fireflies
       build 2026-07). Each agent carries a phase oscillator (blink cycle) +
       natural frequency. Every step it is pulled toward its 7 nearest
       neighbors' phases — Kuramoto over the SAME topological graph the flock
       flies on. U.modes.y = coupling K (chaos → lock) · U.modes.z = tempo
       bias · U.modes.w = ignition kick (impulse fronts yank phase toward the
       flash). Emergent result: waves of synchronized ignition.              */
    const PHASE_WGSL = !PHASE ? "" : COMMON + `
@group(0) @binding(0) var<uniform> U: Sim;
@group(0) @binding(1) var<storage, read> posIn: array<vec4f>;
@group(0) @binding(2) var<storage, read> gridCount: array<u32>;
@group(0) @binding(3) var<storage, read> gridIdx: array<u32>;
@group(0) @binding(4) var<storage, read> phIn: array<vec2f>;
@group(0) @binding(5) var<storage, read_write> phOut: array<vec2f>;
const K: u32 = 7u;

@compute @workgroup_size(64)
fn phase(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; if (i >= U.count) { return; }
  let p = posIn[i].xyz;
  var th = phIn[i].x;
  let om = phIn[i].y;

  /* topological 7-NN — the same law the wings obey, now heard by the clock */
  var nd: array<f32, K>;
  var ni: array<u32, K>;
  for (var k = 0u; k < K; k++) { nd[k] = 1e12; ni[k] = 0xffffffffu; }
  let c = cellCoord(p);
  for (var dz = -1; dz <= 1; dz++) {
  for (var dy = -1; dy <= 1; dy++) {
  for (var dx = -1; dx <= 1; dx++) {
    let cc = c + vec3i(dx, dy, dz);
    if (cc.x < 0 || cc.y < 0 || cc.z < 0 || cc.x >= GX || cc.y >= GY || cc.z >= GZ) { continue; }
    let ci = cellIndex(cc);
    let n = min(gridCount[ci], CAP);
    for (var s = 0u; s < n; s++) {
      let j = gridIdx[ci * CAP + s];
      if (j == i) { continue; }
      let q = posIn[j].xyz;
      let d2 = dot(q - p, q - p);
      if (d2 < nd[K - 1u]) {
        var k = K - 1u;
        loop {
          if (k > 0u && nd[k - 1u] > d2) { nd[k] = nd[k - 1u]; ni[k] = ni[k - 1u]; k--; }
          else { break; }
        }
        nd[k] = d2; ni[k] = j;
      }
    }
  }}}

  /* Kuramoto pull toward the neighbors' phases. CHARISMA: when one of your
     seven neighbors is the avatar, its voice weighs more — persuasive, not
     dictatorial. */
  var pull = 0.0; var cnt = 0.0;
  for (var k = 0u; k < K; k++) {
    if (ni[k] == 0xffffffffu) { continue; }
    let w = select(1.0, max(U.avatarB.w, 1.0),
                   U.avatarA.x >= 0.0 && i32(ni[k]) == i32(U.avatarA.x));
    pull += w * sin(phIn[ni[k]].x - th); cnt += w;
  }
  var dth = om * U.modes.z;                                   // own clock × tempo bias
  if (cnt > 0.0) { dth += U.modes.y * pull / cnt; }           // K decides chaos → lock

  /* PACEMAKER — the performer is one more oscillator in the graph. The pull
     is gated by earned confidence: steady playing entrains the field to
     YOUR beat; sloppiness lets it slip back to its own. */
  dth += U.pace.y * sin(U.pace.x - th);

  /* ignition wavefront: a strike yanks phase toward the flash moment (0) */
  let WLIFE = select(3.5, U.pace.z, U.pace.z > 0.1);
  for (var m = 0u; m < 8u; m++) {
    let im = U.impulses[m];
    if (im.w < 0.0) { continue; }
    let age = U.time - im.w;
    if (age < 0.0 || age > WLIFE) { continue; }
    let r = distance(p, im.xyz);
    let front = U.waveSpeed * age;
    let x = abs(r - front);
    let w = max(U.waveWidth, 1.0);
    let f = exp(-x * x / (2.0 * w * w)) * U.imp_meta[m].x * exp(-age * (2.45 / WLIFE));
    dth += f * U.modes.w * sin(-th);
  }

  th += dth * U.dt;
  th -= 6.28318 * floor(th / 6.28318);

  /* AVATAR: a note-on flashes the performer's body NOW — the rhythm enters
     the field as a real event in a real place, then spreads by law */
  if (U.avatarA.x >= 0.0 && i32(U.avatarA.x) == i32(i) && U.avatarB.y > 0.5) {
    th = 0.075;                                   // just past the flash-point: full lantern
  }
  phOut[i] = vec2f(th, om);
}`;

    /* Lantern render — points of additive light on the dark. Brightness is a
       PULSE of the phase (fast rise, slow decay — a real firefly's lantern,
       not a sine). birdLight.rgb = lantern color · birdDark.w = size.       */
    const LANTERN_WGSL = !PHASE ? "" : `
struct View {
  viewProj: mat4x4f, camPos: vec4f, camRight: vec4f, camUp: vec4f, camFwd: vec4f,
  sunDir: vec4f, skyTop: vec4f, skyMid: vec4f, horizon: vec4f, ground: vec4f,
  sunCol: vec4f, birdDark: vec4f, birdLight: vec4f,
  render: vec4f, render2: vec4f, render3: vec4f, render4: vec4f,
  /* the lantern's View is a TRUNCATED copy of the bird's — it only needs the
     first few members, and a WGSL struct may stop short of the buffer bound to
     it. But it must reach EVERY member it actually reads: the note-flash block
     reads render5, and stopping at render4 gave Metal "struct member render5 not
     found" and killed the whole render pipeline. nvidia tolerated it. A
     truncated struct is a promise about what you will read, and this one lied. */
  render5: vec4f, noteBands: array<vec4f, 6>, render6: vec4f,
};
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read> ph: array<vec2f>;
const LANTERN_BEE: f32 = 1.0;   // THE BEE's lantern multiplier — replaced when opts.bee > 0

struct LOut { @builtin(position) cp: vec4f, @location(0) uv: vec2f, @location(1) b: f32, @location(2) agit: f32, @location(3) bee: f32 };
@vertex
fn lanternVs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> LOut {
  /* the quad's corners COMPUTED, not tabled. A mutable local array must be
     placed on the vertex function's stack, and Metal's is small enough that six
     vec2f overflowed it: "Vertex function exceeds available stack space".
     nvidia kept it in registers and never complained.
     Two triangles from an index: bit 0 and bit 1 of a remapped vertex id give
     the corner directly, no storage at all. */
  /* two triangles, corners 0,1,3 and 0,3,2 in (bit0 = x, bit1 = y) numbering.
     Verified against the original table index by index — same quad, no storage. */
  let ci = select(select(3u, 2u, vi == 5u), select(0u, 1u, vi == 1u), vi == 0u || vi == 1u || vi == 3u);
  let corner = vec2f(select(-1.0, 1.0, (ci & 1u) != 0u),
                     select(-1.0, 1.0, (ci & 2u) != 0u));
  let P = pos[ii];
  let s = ph[ii].x / 6.28318;
  let b = smoothstep(0.0, 0.07, s) * exp(-max(s - 0.07, 0.0) * 5.5);   // rise fast, fade slow
  let h = fract(sin(f32(ii) * 127.1) * 43758.5453);
  /* THE BEE's lantern is larger, because her flash is an EVENT in the field
     rather than one firefly among thousands.
     The lantern carries its OWN multiplier: it is a SEPARATE SHADER MODULE from the
     bird, and a constant declared in one does not exist in the other. nvidia's
     compiler let the dangling reference through; Metal correctly refused it and
     the whole render pipeline failed to build — a black canvas with a healthy
     HUD, sixty fps and a working compute pass. Found on a MacBook Air, on a
     backend this engine had never once been run on. */
  let beeF = select(0.0, 1.0, ii == 0u && LANTERN_BEE > 1.0);
  let size = V.birdDark.w * (0.7 + 0.5 * h) * (0.75 + 0.9 * b) * (1.0 + 1.7 * beeF);
  let c = corner;
  let wp = P.xyz + (V.camRight.xyz * c.x + V.camUp.xyz * c.y) * size;
  var o: LOut;
  o.cp = V.viewProj * vec4f(wp, 1.0);
  o.uv = c; o.b = b; o.agit = P.w; o.bee = beeF;
  return o;
}
@fragment
fn lanternFs(inp: LOut) -> @location(0) vec4f {
  let r2 = dot(inp.uv, inp.uv);
  let core = exp(-r2 * 9.0);
  let halo = exp(-r2 * 2.2) * 0.30;
  /* GLOW (v0.10.2): birdLight.w = per-lantern light budget. Additive light
     STACKS — 6000 overlapping lanterns burn to white unless each is dimmed.
     Low glow = crisp SPECKS in the dark; high glow = the blazing cloud. */
  let glow = select(1.0, V.birdLight.w, V.birdLight.w > 0.001);
  let bb = (0.05 + inp.b * (0.6 + 0.55 * min(inp.agit * 1.5, 1.0))) * glow;   // unlit = barely-there ember
  var lc = V.birdLight.rgb;
  var heart = vec3f(1.0, 1.0, 0.9);
  /* THE BEE FLASHES IN THE COLOUR OF THE NOTE. (Bill, 2026-08-09)
     render5.z carries the pitch-class hue 0..1 — the SAME mapping MELODIC STRATA
     already uses, (pitch modulo 12) / 12, so a C is always the same colour
     whether it lands as a band on the body or as her lantern. Twelve pitch
     classes around the wheel: the melody becomes legible as colour, and a
     returning note is recognisable before you have named it.
     render5.w is how far her flash is pushed toward that hue, so the field's own
     lantern colour is untouched and this is byte-identical when zero. */
  if (inp.bee > 0.5 && V.render5.w > 0.001) {
    let hv = V.render5.z * 6.0;
    let seg = floor(hv);
    let f = hv - seg;
    let noteCol = select(
      select(
        select(vec3f(0.0, 1.0, f), vec3f(0.0, 1.0 - f, 1.0), seg < 3.5),
        select(vec3f(f, 0.0, 1.0), vec3f(1.0, 0.0, 1.0 - f), seg < 5.5),
        seg > 3.5),
      select(vec3f(1.0, f, 0.0), vec3f(1.0 - f, 1.0, 0.0), seg > 0.5),
      seg < 1.5);
    lc = mix(lc, noteCol, V.render5.w);
    heart = mix(heart, mix(noteCol, vec3f(1.0), 0.45), V.render5.w);
  }
  var col = lc * (core + halo) * bb;
  col += heart * core * inp.b * 0.55;                                 // white-hot heart at the flash
  return vec4f(col, 1.0);
}`;

    /* ---- pipelines ------------------------------------------------------ */
    const gridMod = device.createShaderModule({ code: GRID_WGSL });
    /* VOICE splice (mesh flocks only — the golden meshless string is byte-
       identical): a voice-0 resonator drains agitation 5× slower, so a strike
       RINGS through it and fades like a struck body, not a blink. voice=1
       compiles to the exact golden constant via select().                   */
    let STEP_SRC = STEP_WGSL;
    if (MESH) {
      const g = "agit = max(agit * exp(-1.6 * U.dt), nAgit * U.knobsA.x);";
      if (STEP_WGSL.indexOf(g) < 0) throw new Error("VOICE splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC.replace(g,
        "agit = max(agit * exp(-select(1.6, 0.30, U.pace.w < 0.5) * U.dt), nAgit * U.knobsA.x);");
    }
    /* ZIGFLOW splice (flow flocks only — golden string untouched elsewhere):
       bind the world's shared current grid + lean every wing into the wind. */
    if (FLOW) {
      const a1 = "@group(0) @binding(6) var<storage, read_write> velOut: array<vec4f>;";
      const a2 = "let vmin = U.knobsA.z;";
      if (STEP_SRC.indexOf(a1) < 0 || STEP_SRC.indexOf(a2) < 0) throw new Error("FLOW splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC
        .replace(a1, a1 + `
@group(0) @binding(7) var<storage, read> flowS: array<vec4f>;
struct FlowU { dim: vec4f, org: vec4f, par: vec4f };
@group(0) @binding(8) var<uniform> FL: FlowU;
fn flowAt(pw: vec3f) -> vec3f {
  let g = (pw - FL.org.xyz) / FL.dim.w - vec3f(0.5);
  let gf = clamp(g, vec3f(0.0), vec3f(FL.dim.x - 1.001, FL.dim.y - 1.001, FL.dim.z - 1.001));
  let i0 = vec3u(floor(gf));
  let f = gf - floor(gf);
  let nx = u32(FL.dim.x); let nxy = nx * u32(FL.dim.y);
  let b = i0.x + i0.y * nx + i0.z * nxy;
  let v00 = mix(flowS[b].xyz, flowS[b + 1u].xyz, f.x);
  let v10 = mix(flowS[b + nx].xyz, flowS[b + nx + 1u].xyz, f.x);
  let v01 = mix(flowS[b + nxy].xyz, flowS[b + nxy + 1u].xyz, f.x);
  let v11 = mix(flowS[b + nx + nxy].xyz, flowS[b + nx + nxy + 1u].xyz, f.x);
  return mix(mix(v00, v10, f.y), mix(v01, v11, f.y), f.z);
}`)
        .replace(a2,
          "/* FLOW LAW: the medium carries currents — every wing leans toward the wind */\n  accel += (flowAt(p) - v) * FL.par.w;\n  " + a2);
    }
    /* MEMBRANE splice (skin flocks only): sample the elastic field at my
       bearing → inherit its surface (soft shell spring), its motion (radial
       velocity), and its STRESS (curvature becomes light — iridescence only
       where the surface strains, exactly like a real soap film). */
    if (SKIN) {
      const s1 = "@group(0) @binding(6) var<storage, read_write> velOut: array<vec4f>;";
      const s2 = "let vmin = U.knobsA.z;";
      if (STEP_SRC.indexOf(s1) < 0 || STEP_SRC.indexOf(s2) < 0) throw new Error("SKIN splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC
        .replace(s1, s1 + `
@group(0) @binding(9) var<storage, read> skinS: array<vec4f>;
struct SkinU { cr: vec4f, dim: vec4f, par: vec4f };
@group(0) @binding(10) var<uniform> SK: SkinU;`)
        .replace(s2, `/* THE MEMBRANE: inherit the field's local geometry */
  {
    let sd = p - SK.cr.xyz;
    let sr = max(length(sd), 0.001);
    let sn = sd / sr;
    let th = acos(clamp(sn.y, -1.0, 1.0));
    let phh = atan2(sn.z, sn.x);
    let nt = u32(SK.dim.x); let np = u32(SK.dim.y);
    let ct = min(nt - 1u, u32(th / 3.14159265 * f32(nt)));
    let cp = u32(fract((phh + 3.14159265) / 6.2831853) * f32(np)) % np;
    let mu = skinS[ct * np + cp];
    let rs = SK.cr.w + mu.x;                                  // where the surface IS, here
    accel += sn * (rs - sr) * SK.dim.z;                       // inherit the surface
    accel += sn * mu.y * SK.dim.w;                            // inherit its motion
    agit = max(agit, min(abs(mu.z) * SK.par.x, 1.2));         // stress becomes light
  }
  ` + s2);
    }
    /* ZIGSEEK splice (seek/avoid flocks only): a world attractor + repulsor.
       Agents steer TOWARD the attractor and AWAY from the repulsor with a
       smooth distance falloff (strong near, fading past its reach) — a target
       is a REGION of interest, not an infinite pull. The base for foraging,
       attachment, and predator-flight. Its own uniform (binding 13) →
       byte-identical without opts.seek. Placed BEFORE the arousal splice so a
       sleeping agent seeks less (rest scales the assembled accel). */
    /* ---- KERNEL HOOK · PRE_INTEGRATE ---------------------------------------
       The one injection point in the step kernel: every accel modifier (SEEK,
       arousal, aging, fatigue, FORCES, CURRENT, …) prepends its block immediately
       BEFORE this line via `.replace(K_PREINT, block + K_PREINT)`. Named ONCE here
       so the anchor lives in a single place — change the kernel line, edit only
       this constant, and each splice's own guard still names the capability that
       would break. Ordering is by insertion order below (last spliced sits closest
       to the integrate); the modifiers all *add to* accel, so order is commutative. */
    if (SEPCAP) {
      const c1 = "const SEP_CEIL: f32 = 1.0;";
      const c2 = "const SEP_TOTAL: f32 = 999.0;";
      if (STEP_SRC.indexOf(c1) < 0 || STEP_SRC.indexOf(c2) < 0)
        throw new Error("SEPCAP splice anchors missing in step kernel");
      STEP_SRC = STEP_SRC
        .replace(c1, "const SEP_CEIL: f32 = " + (+SEPCAP.pair).toFixed(4) + ";")
        .replace(c2, "const SEP_TOTAL: f32 = " + (+SEPCAP.total).toFixed(4) + ";");
    }
    const K_PREINT = "  /* ---- integrate with speed band ---- */";
    if (ONSET > 0) {
      /* ---- ONSET: agitation swells instead of snapping --------------------
         BRACKETS the contagion line rather than replacing it, because VOICE
         already claims that exact text (it swaps the decay constant for a
         resonator). Two comment anchors nobody else claims: capture agit before,
         limit its RISE after. Decay is untouched, so a struck body still rings
         out exactly as before — only the attack is softened, and only for the
         crowd's contagion. A performer's strike (`agit = max(agit, f)` from an
         impulse) stays sharp, which is the right distinction: the note is an
         event, the gossip is a swell. */
      const g1 = "  /* ---- contagion: agitation spreads one neighbor-hop per step ----";
      const g2 = "  /* ---- impulse wavefronts (the falcon strike · the thrown stone) ----";
      if (STEP_SRC.indexOf(g1) < 0 || STEP_SRC.indexOf(g2) < 0)
        throw new Error("ONSET splice anchors missing in step kernel");
      const RS = (+ONSET).toFixed(4);
      STEP_SRC = STEP_SRC
        .replace(g1, "  let agitPrev = agit;   /* ONSET: remember it before contagion touches it */" + "\n" + g1)
        .replace(g2, `  /* ONSET: agitation may only RISE this fast — decay is left alone */
  {
    let rise = 1.0 - exp(-U.dt / ${RS});
    if (agit > agitPrev) { agit = agitPrev + (agit - agitPrev) * rise; }
  }
` + g2);
    }

    if (CONTACT) {
      /* ---- CONTACT: matter that OCCUPIES SPACE (ZigCore.Contact 0.16+) --------
         PREPEND-ONLY at K_PREINT — never replaces the anchor, and never touches
         the `let vmin = …` line, which MEDIUM and three other capabilities all
         claim. (Learned the hard way on 2026-08-08: a splice that rewrote that
         line made MEDIUM throw at boot.)

         SCATTER → GATHER, as with STRUCTURE. On the CPU a pair is resolved once
         and pushed both ways. A compute thread may only write its own slot, so
         every pair is computed TWICE here — once from each side — and each thread
         keeps its own half. That is why the 0.5 is kept: it makes this numerically
         identical to `ZigCore.Contact.self`, which is what the parity harness
         checks.

         Rides the flock's existing 3x3x3 grid walk. Contact radius must be ≤ the
         cell size or a neighbour could sit outside the searched cells. */
      const q1 = "@group(0) @binding(6) var<storage, read_write> velOut: array<vec4f>;";
      if (STEP_SRC.indexOf(q1) < 0 || STEP_SRC.indexOf(K_PREINT) < 0)
        throw new Error("CONTACT splice anchor missing in step kernel");
      const CR = (+CONTACT.r).toFixed(4), CK = (+CONTACT.k).toFixed(3),
            CD = (+CONTACT.damp).toFixed(3), CM = (+CONTACT.max).toFixed(3);
      STEP_SRC = STEP_SRC
        .replace(q1, q1 + `
const CT_R: f32 = ${CR};
const CT_K: f32 = ${CK};
const CT_DAMP: f32 = ${CD};
const CT_MAX: f32 = ${CM};`)
        .replace(K_PREINT, `  /* ---- CONTACT: no two agents may be in the same place ---- */
  {
    let ctD = CT_R * 2.0;
    var ctF = vec3f(0.0);
    let cc0 = cellCoord(p);
    for (var dz = -1; dz <= 1; dz++) {
    for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let cc = cc0 + vec3i(dx, dy, dz);
      if (cc.x < 0 || cc.y < 0 || cc.z < 0 || cc.x >= GX || cc.y >= GY || cc.z >= GZ) { continue; }
      let ci = cellIndex(cc);
      let nn = min(gridCount[ci], CAP);
      for (var s = 0u; s < nn; s++) {
        let j = gridIdx[ci * CAP + s];
        if (j == i) { continue; }
        let dvec = p - posIn[j].xyz;                 /* points from j toward me */
        let d2 = dot(dvec, dvec);
        if (d2 >= ctD * ctD || d2 < 1e-12) { continue; }
        let dist = sqrt(d2);
        let nrm = dvec / dist;
        var f = (ctD - dist) * CT_K;
        let rv = v - velIn[j].xyz;                   /* bleed the approach, not the slide */
        let vn = dot(rv, nrm);
        if (vn < 0.0) { f -= vn * CT_DAMP; }
        f = min(f, CT_MAX);                          /* PER-PAIR ceiling — both sides clamp identically, so the pair stays equal and opposite */
        ctF += nrm * f * 0.5;                        /* the pair is computed from both sides */
      }
    }}}
    accel += ctF;
  }
` + K_PREINT);
    }

    if (STRUCT) {
      /* ---- STRUCTURE: matter that is JOINED (ZigCore 0.13+) ------------------
         SCATTER→GATHER. The CPU reference walks each bond once and writes force to
         three agents. Here each agent instead asks "which bonds am I in, and in
         which role?" For a chain with par[i] = i-1 the answer is always: bond i
         (as the child), bond i+1 (as the parent), bond i+2 (as the grandparent).
         Three reads, no atomics, no write hazards — and numerically identical to
         the scatter, which is what the parity harness checks.

         bondForce() returns the three vectors a single bond applies, in the same
         order and with the same terms as ZigCore.Structure.accel: spring to rest,
         damping ALONG the link only, and a bending moment projected PERPENDICULAR
         to the link whose reaction is split between the grandparent (mirrored lever
         arm about the parent) and the parent (the remainder) so that BOTH linear
         and angular momentum are conserved. Getting that split wrong on the CPU
         produced a phantom torque of -208 and a body that swam without a wave;
         the same mistake here would be invisible on the glass. */
      const CH = (STRUCT.chain && STRUCT.chain.length) ? STRUCT.chain : [{ from: 0, count: 0 }];
      const spans = CH.map((c) => `SpanEntry(${(c.from|0)}u, ${((c.from|0) + (c.count|0))}u)`).join(", ");
      const q1 = "@group(0) @binding(6) var<storage, read_write> velOut: array<vec4f>;";
      const q2 = K_PREINT;
      if (STEP_SRC.indexOf(q1) < 0 || STEP_SRC.indexOf(q2) < 0)
        throw new Error("STRUCTURE splice anchor missing in step kernel");
      const R = (+STRUCT.rest || 1).toFixed(5);
      const KK = (+STRUCT.k || 26).toFixed(5);
      const DP = (+STRUCT.damp === undefined ? 3 : +STRUCT.damp).toFixed(5);
      const BD = (+STRUCT.bend || 0).toFixed(5);
      const NS = CH.length;
      STEP_SRC = STEP_SRC
        .replace(q1, q1 + `
struct SpanEntry { lo: u32, hi: u32 };
const ST_REST: f32 = ${R};
const ST_K: f32 = ${KK};
const ST_DAMP: f32 = ${DP};
const ST_BEND: f32 = ${BD};
const ST_NSPAN: u32 = ${NS}u;
const ST_SPANS = array<SpanEntry, ${NS}>(${spans});

/* is agent i inside a declared chain, and does it have a predecessor? */
fn stParent(i: u32) -> i32 {
  for (var s: u32 = 0u; s < ST_NSPAN; s = s + 1u) {
    let e = ST_SPANS[s];
    if (i > e.lo && i < e.hi) { return i32(i) - 1; }
  }
  return -1;
}

/* the three forces one bond applies: .a on the child, .b on the parent, .c on the
   grandparent. Mirrors ZigCore.Structure.accel term for term. */
struct BondF { a: vec3f, b: vec3f, c: vec3f };
fn bondForce(i: u32) -> BondF {
  var o: BondF;
  o.a = vec3f(0.0); o.b = vec3f(0.0); o.c = vec3f(0.0);
  let p = stParent(i);
  if (p < 0) { return o; }
  let pu = u32(p);
  let pi = posIn[i].xyz;   let pp = posIn[pu].xyz;
  let vi = velIn[i].xyz;   let vp = velIn[pu].xyz;
  let d = pi - pp;
  let L = max(length(d), 1e-6);
  let u = d / L;

  /* 1 - spring · 2 - damping along the link only */
  let rv = vi - vp;
  let alongV = dot(rv, u);
  let sMag = -(L - ST_REST) * ST_K - alongV * ST_DAMP;
  var ax = u * sMag;

  /* 3 - bending, if there is a grandparent */
  if (ST_BEND > 0.0) {
    let g = stParent(pu);
    if (g >= 0) {
      let pg = posIn[u32(g)].xyz;
      let w = pp - pg;
      let BL = max(length(w), 1e-6);
      var e = pp + (w / BL) * ST_REST - pi;
      e = e - dot(e, u) * u;                       /* strip the radial part */
      var b = e * (ST_BEND * ST_K);
      b = b - (rv - alongV * u) * (ST_BEND * ST_DAMP);   /* lateral damping */
      /* balance the couple: g takes a force perpendicular to the g->p link with
         the lever arm about p that cancels b's moment; p absorbs the remainder. */
      let n = cross(u, b);
      let nl = length(n);
      var gf = vec3f(0.0);
      if (nl > 1e-12) {
        let nh = n / nl;
        gf = cross(nh, w / BL) * ((L / BL) * length(b));
      }
      o.a = o.a + b;
      o.c = o.c + gf;
      o.b = o.b - (b + gf);
    }
  }
  o.a = o.a + ax;
  o.b = o.b - ax;                                  /* Newton's third */
  return o;
}`)
        .replace(q2, `  /* ---- STRUCTURE: matter that is JOINED (gathered, not scattered) ---- */
  {
    let f0 = bondForce(i);                         /* this agent's own bond */
    let f1 = bondForce(i + 1u);                    /* the bond of its child */
    let f2 = bondForce(i + 2u);                    /* the bond of its grandchild */
    accel += f0.a + f1.b + f2.c;
  }
` + q2);
    }
    if (SEEK) {
      const q1 = "@group(0) @binding(6) var<storage, read_write> velOut: array<vec4f>;";
      const q2 = K_PREINT;
      if (STEP_SRC.indexOf(q1) < 0 || STEP_SRC.indexOf(q2) < 0)
        throw new Error("ZIGSEEK splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC
        .replace(q1, q1 + `
struct SeekU { seek: vec4f, avoid: vec4f, cfg: vec4f };
@group(0) @binding(13) var<uniform> SK2: SeekU;`)
        .replace(q2, `  /* ---- ZIGSEEK: toward the attractor, away from the repulsor ---- */
  if (SK2.seek.w > 0.001) {
    let to = SK2.seek.xyz - p;
    let d = length(to) + 1e-3;
    let rr = max(SK2.cfg.x, 1.0);
    accel += (to / d) * SK2.seek.w / (1.0 + (d / rr) * (d / rr));
  }
  if (SK2.avoid.w > 0.001) {
    let aw = p - SK2.avoid.xyz;
    let d = length(aw) + 1e-3;
    let rr = max(SK2.cfg.y, 1.0);
    accel += (aw / d) * SK2.avoid.w / (1.0 + (d / rr) * (d / rr));
  }
` + q2);
    }
    /* ZIGLIFE SUBSTRATE (any life behavior): ONE per-agent buffer
       life=(arousal, fatigue, age, bond), bound once with a single shared read
       (`lifeS`) and a single shared write. Each behavior below modifies only
       its own channel of `lifeS` — so rest, attach (and later fatigue/age)
       coexist in one buffer instead of each growing its own. Byte-identical
       without any life behavior. */
    if (LIFE) {
      const l1 = "@group(0) @binding(6) var<storage, read_write> velOut: array<vec4f>;";
      const l2 = "  var bank = velIn[i].w;";
      const l3 = "  posOut[i] = vec4f(p, min(agit, 1.5));";
      if (STEP_SRC.indexOf(l1) < 0 || STEP_SRC.indexOf(l2) < 0 || STEP_SRC.indexOf(l3) < 0)
        throw new Error("ZIGLIFE substrate splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC
        .replace(l1, l1 + `
@group(0) @binding(11) var<storage, read> lifeIn: array<vec4f>;
@group(0) @binding(12) var<storage, read_write> lifeOut: array<vec4f>;`)
        .replace(l2, l2 + "\n  var lifeS = lifeIn[i];   // ZIGLIFE: (arousal, fatigue, age, bond) — modified per-behavior, written once")
        .replace(l3, "lifeOut[i] = lifeS;\n  " + l3);
    }
    /* ZIGLIFE AROUSAL (rest/wake): breath OR a passing disturbance wakes an
       organism; silence lets it drift to sleep — wake fast, sleep slow. A
       sleeping agent withdraws from the flock, stills, settles. Channel .x. */
    if (REST) {
      const r2 = K_PREINT;
      const r3 = "let vmax = U.knobsA.w + U.knobsB.x * agit + 6.0 * localBreath;";
      if (STEP_SRC.indexOf(r2) < 0 || STEP_SRC.indexOf(r3) < 0)
        throw new Error("ZIGLIFE (rest) splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC
        .replace(r2, `  /* ---- ZIGLIFE AROUSAL: rest / wake (per-agent slow state, channel .x) ---- */
  var restWake = 1.0;
  {
    let ar = lifeS.x;
    let hh = fract(sin(f32(i) * 12.9898) * 43758.5453);
    let stim = clamp(max(U.breath * 1.45, agit) - 0.12 * hh, 0.0, 1.0);
    let rate = select(0.30, 2.4, stim > ar);
    let arOut = clamp(ar + (stim - ar) * clamp(rate * U.dt, 0.0, 1.0), 0.0, 1.0);
    lifeS.x = arOut;
    restWake = arOut;
    let sleep = 1.0 - restWake;
    accel *= 0.22 + 0.78 * restWake;
    accel.y -= sleep * 0.6 * (1.0 - min(U.modes.x, 1.0));
    v *= 1.0 - sleep * min(U.dt * 1.6, 0.9);
    agit *= 0.25 + 0.75 * restWake;
  }
` + r2)
        .replace(r3, "let vmax = (U.knobsA.w + U.knobsB.x * agit + 6.0 * localBreath) * (0.16 + 0.84 * restWake);");
    }
    /* ZIGATTACH (bind-in-place / release): a global attach signal (AT.p.x)
       sweeps the field; each agent crosses its OWN staggered threshold, so the
       freeze/melt travels as a wave. A bonded agent holds position — forces
       ignored, motion damped, its speed floor released so it can truly stop —
       then melts back when the signal falls. Bond lives in channel .w. */
    if (ATTACH) {
      const a1 = "@group(0) @binding(6) var<storage, read_write> velOut: array<vec4f>;";
      const a2 = K_PREINT;
      const a3 = "let vmin = U.knobsA.z;";
      if (STEP_SRC.indexOf(a1) < 0 || STEP_SRC.indexOf(a2) < 0 || STEP_SRC.indexOf(a3) < 0)
        throw new Error("ZIGATTACH splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC
        .replace(a1, a1 + `
struct AttachU { p: vec4f };
@group(0) @binding(14) var<uniform> AT: AttachU;`)
        .replace(a2, `  /* ---- ZIGATTACH: bind in place / release (per-agent bond, channel .w) ---- */
  var attachBond = 0.0;
  {
    let hh = fract(sin(f32(i) * 78.233 + 1.7) * 21758.135);
    let thr = 0.35 + 0.30 * hh;                                   // tighter spread → a CRISP freeze with a hint of wave
    let want = select(0.0, 1.0, AT.p.x > thr);
    let bond = clamp(lifeS.w + (want - lifeS.w) * clamp(U.dt * select(1.1, 8.0, want > lifeS.w), 0.0, 1.0), 0.0, 1.0);   // attach FAST (freeze before cohesion collapses it), release slow
    lifeS.w = bond;
    attachBond = bond;
    accel *= 1.0 - bond;                                          // bonded = ALL forces off — hold the SHAPE, don't collapse to a mound
    v *= 1.0 - bond;                                              // bonded = velocity zeroed — truly still
    agit *= 1.0 - 0.9 * bond;                                     // bonded = calm (no blaze) — reads as frozen, not active
  }
` + a2)
        .replace(a3, "let vmin = U.knobsA.z * (1.0 - 0.97 * attachBond);");
    }
    /* ZIGMETABOLISM splice (fatigue / recover · energy channel .y): EFFORT
       drains energy (activity costs), and it refills from REST (low effort),
       CALM BREATH (the performer feeding the field), and HUDDLE (dense
       neighbors share/conserve). An exhausted agent can't drive or blaze — it
       slows, dims, and droops, which forces it to rest and recover: a stamina
       loop you play at the edge of. Placed LAST so it reads agit AFTER rest/
       attach damp it (a sleeping/frozen agent recovers). Per-agent stamina
       varies. Rides the shared life buffer — NO new bindings. Byte-identical
       without opts.fatigue. */
    if (FATIGUE) {
      const f2 = K_PREINT;
      if (STEP_SRC.indexOf(f2) < 0) throw new Error("ZIGMETABOLISM splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC.replace(f2, `  /* ---- ZIGMETABOLISM: fatigue / recover (energy channel .y) ---- */
  {
    let hs = fract(sin(f32(i) * 45.164 + 4.1) * 13733.19);     // per-agent stamina — some tire faster
    var energy = lifeS.y;                                       // var (mutable) — reassigned below
    let effort = clamp(agit, 0.0, 1.0);                         // exertion proxy — activity / excitement / chasing
    let huddle = clamp(cnt / f32(K), 0.0, 1.0);                 // dense neighbors share & conserve
    let drain = (0.22 + 0.16 * hs) * effort;                    // effort costs (staggered per agent) — steep enough to feel
    let recover = 0.035 + 0.11 * U.breath + 0.05 * huddle;      // rest floor · the performer's breath · the huddle
    energy = clamp(energy + (recover - drain) * U.dt, 0.0, 1.0);
    lifeS.y = energy;
    let spent = 1.0 - energy;
    accel *= 0.40 + 0.60 * energy;                             // exhausted = weaker drive → forced to slow and rest
    agit *= 0.35 + 0.65 * energy;                              // exhausted = can't blaze
    accel.y -= spent * 0.40 * (1.0 - min(U.modes.x, 1.0));     // the tired DROOP — an exhausted thing visibly sags (air only)
  }
` + f2);
    }
    /* ZIGAGE splice (aging · lifespan channel .z): a slow per-agent clock —
       born (0) → prime → old → renew (wraps to 0: a new generation in place).
       Old agents gently mellow (slower, calmer). The VISUAL life-arc (fade in
       when young, glow in prime, fade out in old age) is the render tell below.
       Per-agent lifespans vary. Rides the shared life buffer — NO new bindings.
       Byte-identical without opts.aging. */
    if (AGING) {
      const g2 = K_PREINT;
      if (STEP_SRC.indexOf(g2) < 0) throw new Error("ZIGAGE splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC.replace(g2, `  /* ---- ZIGAGE: the lifespan clock (age channel .z) ---- */
  {
    let lh = fract(sin(f32(i) * 92.31 + 2.7) * 51234.9);       // per-agent lifespan — some live longer
    let ageRate = 0.010 + 0.014 * lh;                          // ~ 42..100 s lifespans, staggered
    let age = fract(lifeS.z + ageRate * U.dt);                 // 0 → 1 → renew (a new generation in place)
    lifeS.z = age;
    let old = smoothstep(0.72, 1.0, age);
    accel *= 1.0 - 0.35 * old;                                 // old = gently slower
    agit *= 1.0 - 0.40 * old;                                  // old = calmer
  }
` + g2);
    }
    if (FORCES) {
      /* ---- ENVIRONMENT · FORCES: gravity / buoyancy (Phase 2, pillar 2) ---------
         The world pulls the matter DOWN (sink → settle into a mound), UP (float →
         gather at a ceiling), or holds it (suspend → hang weightless). A constant
         vertical accel + a soft floor/ceiling that catches it in view + vertical
         damping. Added BEFORE the integrate so it composes with MEDIUM's drag:
         honey+sink settles slowly, air+sink falls fast. Byte-identical off. */
      const g = (+FORCES.g || 0).toFixed(2), damp = (+FORCES.damp || 0).toFixed(2);
      let settle = "";
      if (FORCES.floor !== undefined) { const lv = (+FORCES.floor).toFixed(2);
        settle = `\n  if (p.y < U.anchor.y + ${lv}) { accel.y += (U.anchor.y + ${lv} - p.y) * 2.6; }   // soft FLOOR: settle & pile`; }
      else if (FORCES.ceil !== undefined) { const lv = (+FORCES.ceil).toFixed(2);
        settle = `\n  if (p.y > U.anchor.y + ${lv}) { accel.y += (U.anchor.y + ${lv} - p.y) * 2.6; }   // soft CEILING: gather`; }
      const fBlock = `  /* ---- ENVIRONMENT · FORCES: gravity / buoyancy ---- */
  accel.y += ${g};${settle}
  accel.y -= v.y * ${damp};
`;
      const fAnchor = K_PREINT;
      if (STEP_SRC.indexOf(fAnchor) < 0) throw new Error("FORCES splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC.replace(fAnchor, fBlock + fAnchor);
    }
    if (CURRENT) {
      /* ---- ENVIRONMENT · CURRENT: the world's flow (Phase 2, pillar 3) ---------
         The matter RIDES a flow the world imposes — a DRIFT it leans/streams into,
         and a GYRE it circulates within (tangential rotation around the anchor's
         vertical axis, mean-zero so the mass stays framed while it visibly turns).
         Added before the integrate so it composes with MEDIUM (honey+gyre = slow
         majestic rotation, air+gyre = fast spin) and FORCES (gyre+sink = a draining
         whirlpool). Byte-identical off. */
      const d = CURRENT.d || [0, 0, 0], gyre = (+CURRENT.gyre || 0).toFixed(4);
      /* GYRE AXIS: the mass circulates AROUND a chosen axis (mean-zero tangential spin). "y"
         is the default upright turn (byte-identical). "x" rolls it around its length like a
         rotisserie — a horizontal cigar keeps presenting its full width instead of swinging
         end-on; "z" rolls it depthwise. Each pose spinning around its OWN long axis. */
      const gax = CURRENT.axis || "y";
      const gvec = gax === "x" ? "vec3f(0.0, -crel.z, crel.y)"
                 : gax === "z" ? "vec3f(-crel.y, crel.x, 0.0)"
                 : "vec3f(-crel.z, 0.0, crel.x)";
      const cBlock = `  /* ---- ENVIRONMENT · CURRENT: the world's flow (drift + gyre) ---- */
  let crel = p - U.anchor.xyz;
  accel += vec3f(${(+d[0]).toFixed(2)}, ${(+d[1]).toFixed(2)}, ${(+d[2]).toFixed(2)});
  accel += ${gvec} * ${gyre};
`;
      const cAnchor = K_PREINT;
      if (STEP_SRC.indexOf(cAnchor) < 0) throw new Error("CURRENT splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC.replace(cAnchor, cBlock + cAnchor);
    }
    if (BOUNDARY) {
      /* ---- ENVIRONMENT · BOUNDARY: the world's SHAPE (Phase 2, pillar 4) ---------
         A soft surface that HOLDS the matter inside a volume. Where forces pull and
         currents push, a boundary contains — so a place is somewhere the matter IS,
         and a world can't slowly drift out of frame over an all-day run. Restoring
         accel added before the integrate; mirrors boundary_ref exactly. Byte-identical
         off. cylinder = a radial wall (± floor/ceiling) → bowl / chimney; sphere = a
         rounded vessel on every side. Each `let` is single-assignment (WGSL-strict). */
      const k = (+BOUNDARY.k || 2.6).toFixed(2), r = (+BOUNDARY.r || 0).toFixed(2);
      let body;
      if (BOUNDARY.shape === "sphere") {
        body = `    let bd = length(brel);
    if (bd > ${r}) { accel += (-brel / max(bd, 1e-3)) * (bd - ${r}) * ${k}; }`;
      } else if (BOUNDARY.shape === "ellipsoid") {
        // per-axis radii → a squashed sphere. Work in unit-sphere space (divide by each radius);
        // outside the unit shell, push back along the ellipsoid's own gradient (inward normal),
        // scaled by the mean radius so the restoring force stays world-scaled like the sphere.
        const rx = (+BOUNDARY.rx || 0).toFixed(2), ry = (+BOUNDARY.ry || 0).toFixed(2), rz = (+BOUNDARY.rz || 0).toFixed(2);
        const kEff = ((+BOUNDARY.k || 2.6) * ((+BOUNDARY.rx + +BOUNDARY.ry + +BOUNDARY.rz) / 3)).toFixed(2);
        body = `    let bs = vec3f(brel.x / ${rx}, brel.y / ${ry}, brel.z / ${rz});
    let bd = length(bs);
    if (bd > 1.0) { let bdir = normalize(vec3f(bs.x / ${rx}, bs.y / ${ry}, bs.z / ${rz})); accel -= bdir * (bd - 1.0) * ${kEff}; }`;
      } else {   // cylinder — radial wall (± cap) around a free AXIS. axis "y" = upright chimney
                 // (byte-identical to before); "x" = a horizontal tube matter runs wide along (cigar);
                 // "z" = depthwise. cap = the free axis; r1/r2 = the two squeezed radial components.
        const ax = BOUNDARY.axis || "y";
        const cap = ax, r1 = (ax === "x" ? "y" : "x"), r2 = (ax === "z" ? "y" : "z");
        let vert = "";
        if (BOUNDARY.lo !== undefined) vert += `
    if (brel.${cap} < ${(+BOUNDARY.lo).toFixed(2)}) { accel.${cap} += (${(+BOUNDARY.lo).toFixed(2)} - brel.${cap}) * ${k}; }`;
        if (BOUNDARY.hi !== undefined) vert += `
    if (brel.${cap} > ${(+BOUNDARY.hi).toFixed(2)}) { accel.${cap} += (${(+BOUNDARY.hi).toFixed(2)} - brel.${cap}) * ${k}; }`;
        body = `    let brad = length(vec2f(brel.${r1}, brel.${r2}));
    if (brad > ${r}) { let bn = vec2f(brel.${r1}, brel.${r2}) / max(brad, 1e-3); let bpush = (brad - ${r}) * ${k}; accel.${r1} -= bn.x * bpush; accel.${r2} -= bn.y * bpush; }${vert}`;
      }
      const bBlock = `  /* ---- ENVIRONMENT · BOUNDARY: the world's shape holds the matter in ---- */
  {
    let brel = p - U.anchor.xyz;
${body}
  }
`;
      if (STEP_SRC.indexOf(K_PREINT) < 0) throw new Error("BOUNDARY splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC.replace(K_PREINT, bBlock + K_PREINT);
    }
    if (MEDIUM) {
      /* ---- ENVIRONMENT · MEDIUM: the density/viscosity of the world -------------
         The SAME organism moves differently by what it swims through — thin air
         (coast, dart), resistant water (glide), thick honey (labor, settle). We
         replace the built-in water-drag coefficient with the medium's viscosity
         and scale the speed cap, so motion labors and slows as the world thickens.
         Buoyancy stays neutral here (that's the next pillar). Byte-identical off. */
      const mDrag = "  v *= (1.0 - U.dt * 0.9 * min(U.modes.x, 1.0));   // WATER/SURFACE: viscous drag (glide to rest)";
      const mCap  = "  let vmin = U.knobsA.z; let vmax = U.knobsA.w + U.knobsB.x * agit + 6.0 * localBreath;";
      if (STEP_SRC.indexOf(mDrag) < 0 || STEP_SRC.indexOf(mCap) < 0) throw new Error("MEDIUM splice anchor missing in step kernel");
      STEP_SRC = STEP_SRC
        .replace(mDrag, "  v *= (1.0 - U.dt * " + (+MEDIUM.drag).toFixed(3) + ");   // MEDIUM: the world's viscosity (thin air ⟶ thick honey)")
        .replace(mCap,  "  let vmin = U.knobsA.z; let vmax = (U.knobsA.w + U.knobsB.x * agit + 6.0 * localBreath) * " + (+MEDIUM.vmax).toFixed(3) + ";   // MEDIUM: thick media cap the top speed");
    }
    const stepMod = device.createShaderModule({ code: STEP_SRC });
    /* ZIGLIFE render tell (rest worlds · mesh): arousal SHRINKS a sleeping
       letter (it withdraws into itself) and blooms it awake — the reusable
       "state becomes visible" channel, bound at render binding 5. Guarded →
       byte-identical without opts.rest. */
    if (LIFE && MESH) {
      const vA = "@group(0) @binding(2) var<storage, read> vel: array<vec4f>;";
      if (RENDER_SRC.indexOf(vA) < 0) throw new Error("ZIGLIFE render tell anchor (vel) missing");
      RENDER_SRC = RENDER_SRC.replace(vA, vA + "\n@group(0) @binding(5) var<storage, read> lifeR: array<vec4f>;");
      if (REST) {   // AROUSAL → withdraw: asleep = small (shrunk) · awake = bloomed
        const sA = "var ssize = size * (0.78 + 0.44 * h);";
        if (RENDER_SRC.indexOf(sA) < 0) throw new Error("ZIGLIFE render tell anchor (ssize) missing");
        RENDER_SRC = RENDER_SRC.replace(sA, sA + "\n    let arouR = lifeR[ii].x;\n    ssize *= 0.30 + 0.70 * arouR;");
      }
      if (FATIGUE || AGING) {   // the base tone carries life-state — energy (fatigue) drains the light; the age life-arc fades the young-born and the old
        const tA = "o.tone = 0.85 + 0.30 * h2;";
        if (RENDER_SRC.indexOf(tA) < 0) throw new Error("ZIGLIFE render tell anchor (tone) missing");
        let f = "1.0";
        if (FATIGUE) f += " * (0.20 + 0.80 * lifeR[ii].y)";   // tired = dark
        if (AGING)   f += " * (0.25 + 0.75 * smoothstep(0.0, 0.12, lifeR[ii].z) * (1.0 - smoothstep(0.72, 1.0, lifeR[ii].z)))";   // born dim → prime vivid → old fades
        RENDER_SRC = RENDER_SRC.replace(tA, "o.tone = (0.85 + 0.30 * h2) * (" + f + ");");
      }
    }
    const rendMod = device.createShaderModule({ code: RENDER_SRC });

    const clearPipe = device.createComputePipeline({ layout: "auto", compute: { module: gridMod, entryPoint: "clearGrid" } });
    const buildPipe = device.createComputePipeline({ layout: "auto", compute: { module: gridMod, entryPoint: "build" } });
    const stepPipe = device.createComputePipeline({ layout: "auto", compute: { module: stepMod, entryPoint: "step" } });

    /* ---- ZigPhase buffers + pipelines (only when a species asks) --------- */
    let phA = null, phB = null, phasePipe = null, lanternPipe = null;
    if (PHASE) {
      phA = device.createBuffer({ size: MAX * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      phB = device.createBuffer({ size: MAX * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      const phMod = device.createShaderModule({ code: PHASE_WGSL });
      phasePipe = device.createComputePipeline({ layout: "auto", compute: { module: phMod, entryPoint: "phase" } });
      /* the lantern is a SEPARATE MODULE and cannot see the bird's constants, so
         it carries its own copy of the bee multiplier */
      const LANTERN_SRC = (BEE > 1)
        ? LANTERN_WGSL.replace("const LANTERN_BEE: f32 = 1.0;", "const LANTERN_BEE: f32 = " + (+BEE).toFixed(3) + ";")
        : LANTERN_WGSL;
      const lMod = device.createShaderModule({ code: LANTERN_SRC });
      lanternPipe = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: lMod, entryPoint: "lanternVs" },
        fragment: { module: lMod, entryPoint: "lanternFs", targets: [{ format: gpu.format, blend: {
          color: { srcFactor: "one", dstFactor: "one" },                 // ADDITIVE — light adds to light
          alpha: { srcFactor: "one", dstFactor: "one" } } }] },
        primitive: { topology: "triangle-list" },
        depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less" },
        multisample: { count: gpu.sampleCount }
      });
    }

    const skyPipe = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: rendMod, entryPoint: "skyVs" },
      fragment: { module: rendMod, entryPoint: "skyFs", targets: [{ format: gpu.format }] },
      primitive: { topology: "triangle-list" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "always" },
      multisample: { count: gpu.sampleCount }
    });
    const birdPipe = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: rendMod, entryPoint: "birdVs" },
      fragment: { module: rendMod, entryPoint: "birdFs", targets: [{ format: gpu.format }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
      multisample: { count: gpu.sampleCount }
    });

    /* ---- DEBRIS (suspended particulate that reads the wave) -------------- */
    const DMAX = opts.debris || 0;
    let debris = null;
    if (DMAX > 0) {
      const dpos = new Float32Array(DMAX * 3), dvel = new Float32Array(DMAX * 3), dagit = new Float32Array(DMAX);
      const dkind = new Float32Array(DMAX);   // 0 bubble (rises) · 1 plankton (drifts) · 2 marine snow (sinks) · 3 shed scale (event)
      const dlife = new Float32Array(DMAX);   // scale slots only: 1→0 lifetime (0 = dormant, invisible)
      const dspin = new Float32Array(DMAX), dphase = new Float32Array(DMAX);
      const drng = (global.ZigCore ? global.ZigCore.rng(SEED ^ 0xD3) : Math.random);
      const EXTD = EXT * 0.9, EXTYD = EXTY;
      // Reserve the top slots of the pool for SHED SCALES — guanine flakes torn
      // loose when a predator strike lands, fluttering down and catching light.
      // Event-driven (spawned on impulse), so they're a reusable "shed on impact"
      // capability any organism can inherit, not fish-specific scenery.
      const SCMAX = Math.max(0, Math.min(260, Math.floor(DMAX * 0.07)));
      const SC0 = DMAX - SCMAX;                // first scale slot index
      let scalePtr = SC0, impT0 = null;
      for (let i = 0; i < DMAX; i++) {
        dpos[i * 3] = (drng() - 0.5) * 2 * EXTD; dpos[i * 3 + 1] = drng() * EXTYD; dpos[i * 3 + 2] = (drng() - 0.5) * 2 * EXTD;
        if (i >= SC0) { dkind[i] = 3; dlife[i] = 0; dspin[i] = (drng() * 2 - 1) * 4; dphase[i] = drng() * 6.283; }
        else { const rt = drng(); dkind[i] = rt < 0.22 ? 0 : (rt < 0.60 ? 1 : 2); }   // ~22% bubbles · 38% plankton · 40% marine snow
      }
      const dv = new Float32Array(DMAX * 6 * 6);   // 6 verts · (pos3 + uv2 + bright/agit 2 → but 6 floats: pos3,uv2,bright... pack pos3,uv2,packedB1? use 6: x,y,z,u,v,B) → agit shared
      const dQuad = new Float32Array(DMAX * 6 * 8); // 6 verts · 8 floats (pos3, uv2, bright, agit, pad)
      const dbuf = device.createBuffer({ size: dQuad.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      const debrisPipe = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: rendMod, entryPoint: "debrisVs", buffers: [{ arrayStride: 32, attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x2" },
          { shaderLocation: 2, offset: 20, format: "float32x2" },
          { shaderLocation: 3, offset: 28, format: "float32" }] }] },
        fragment: { module: rendMod, entryPoint: "debrisFs", targets: [{ format: gpu.format, blend: {
          color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } } }] },
        primitive: { topology: "triangle-list" },
        depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less" },
        multisample: { count: gpu.sampleCount }
      });
      const CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]], TRI = [0, 1, 2, 0, 2, 3];
      debris = {
        pipe: debrisPipe, buf: dbuf, quad: dQuad, count: DMAX, size: opts.debrisSize || 1.4,
        bg: null,
        update(state, eye) {
          const dt = Math.min(state.dt, 0.05), cur = state.wind, t = state.time;
          const imp = state.impulses, ws = state.waveSpeed, wwd = Math.max(state.waveWidth, 1) * 2.2;
          // BREATH → water pressure: a swell inflates the medium. We use breath's
          // RATE OF CHANGE so a crescendo pushes the water OUT from the ball and a
          // decrescendo draws it back — the water breathes with the performer,
          // continuously, not just on strikes. (state.breathPush scales it.)
          const breath = state.breath || 0, bpush = state.breathPush || 0;
          const ctr = state.center || [0, 90, 0];
          const dB = (breath - (this._pb || 0)) / Math.max(dt, 1e-3); this._pb = breath;
          const swell = Math.max(-2, Math.min(2, dB)) * bpush;      // signed swell strength
          // camera-facing basis
          let rx = eye[2], ry = 0, rz = -eye[0]; const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; rz /= rl;
          const sz = this.size;
          // SHED SCALES: a fresh strike tears a burst of guanine flakes loose at
          // its origin. We detect a new impulse per slot by its changed t0, then
          // fill dormant scale slots with an outward-then-sinking flake.
          const shedOn = (state.shedScales === undefined) ? 1 : state.shedScales;
          if (SCMAX > 0 && shedOn > 0.5) {
            if (!impT0) impT0 = new Float32Array(imp.length);
            for (let m = 0; m < imp.length; m++) {
              const im = imp[m]; if (!im || im.t0 < 0) continue;
              if (im.t0 !== impT0[m]) {
                impT0[m] = im.t0;
                const nsc = Math.min(SCMAX, 3 + Math.floor((im.strength || 0.5) * 5));   // a FEW flakes, not a bouquet
                for (let k = 0; k < nsc; k++) {
                  const s = scalePtr++; if (scalePtr >= DMAX) scalePtr = SC0;
                  const a = drng() * 6.283, el = (drng() * 2 - 1), sp = 11 + drng() * 18;  // fling WIDE so they scatter, not clump
                  dpos[s * 3]     = im.o[0] + (drng() - 0.5) * 14;
                  dpos[s * 3 + 1] = im.o[1] + (drng() - 0.5) * 14;
                  dpos[s * 3 + 2] = im.o[2] + (drng() - 0.5) * 14;
                  dvel[s * 3]     = Math.cos(a) * sp;
                  dvel[s * 3 + 1] = el * sp * 0.4 + 1;       // some fly up, some down — then all sink
                  dvel[s * 3 + 2] = Math.sin(a) * sp;
                  dlife[s] = 1; dspin[s] = (drng() * 2 - 1) * 5.5; dphase[s] = drng() * 6.283;
                }
              }
            }
          }
          for (let i = 0; i < DMAX; i++) {
            let x = dpos[i * 3], y = dpos[i * 3 + 1], z = dpos[i * 3 + 2];
            let vx = dvel[i * 3], vy = dvel[i * 3 + 1], vz = dvel[i * 3 + 2];
            const kind = dkind[i];
            // SHED SCALE — event particle: sinks, flutters, and FLASHES silver as
            // it tumbles face-on, then fades over ~3.5s. Dormant slots park unseen.
            if (kind > 2.5) {
              const life = dlife[i];
              if (life <= 0) {
                for (let n = 0; n < 6; n++) { const o = (i * 6 + n) * 8; dQuad[o + 5] = 0; dQuad[o + 7] = 3; }
                continue;
              }
              vx += (cur[0] * 3 - vx) * Math.min(1, dt * 0.9);
              vz += (cur[2] * 3 - vz) * Math.min(1, dt * 0.9);
              vy += (-6.0 + cur[1] * 2 - vy) * Math.min(1, dt * 0.5);      // guanine flake sinks
              vx += Math.sin(t * 3.4 + dphase[i]) * 2.4 * dt;             // flutter side-to-side
              vz += Math.cos(t * 2.9 + dphase[i]) * 2.4 * dt;
              vx *= (1 - dt * 0.9); vy *= (1 - dt * 0.6); vz *= (1 - dt * 0.9);   // travel a bit before settling
              x += vx * dt; y += vy * dt; z += vz * dt;
              dlife[i] = life - dt * 0.42;                                 // ~2.4s — no accumulating bouquets
              dpos[i * 3] = x; dpos[i * 3 + 1] = y; dpos[i * 3 + 2] = z;
              dvel[i * 3] = vx; dvel[i * 3 + 1] = vy; dvel[i * 3 + 2] = vz;
              const rot = t * dspin[i] + dphase[i];
              const face = Math.abs(Math.sin(rot));                        // 1 broadside flash · 0 edge-on
              const br = Math.min(1, life * 1.4) * (0.12 + 0.72 * face);   // dim between flashes — a sparkle, not a lamp
              const psz = sz * (0.09 + 0.13 * face);                       // SMALL: ~a quarter of a fish, not a petal
              const cr = Math.cos(rot * 0.5), sr = Math.sin(rot * 0.5);
              for (let n = 0; n < 6; n++) {
                const c = CORN[TRI[n]], o = (i * 6 + n) * 8;
                const qx = c[0] * 0.5, qy = c[1] * 1.25;                   // a thin flake, then rotate in view plane
                const rxq = qx * cr - qy * sr, ryq = qx * sr + qy * cr;
                dQuad[o] = x + rx * rxq * psz; dQuad[o + 1] = y + ryq * psz; dQuad[o + 2] = z + rz * rxq * psz;
                dQuad[o + 3] = c[0]; dQuad[o + 4] = c[1]; dQuad[o + 5] = br; dQuad[o + 6] = face; dQuad[o + 7] = 3;
              }
              continue;
            }
            // each type moves as it should: bubbles RISE, snow SINKS, plankton drifts.
            const riseV = kind < 0.5 ? 7.0 : (kind < 1.5 ? -0.2 : -1.4);   // bubble up · plankton ~neutral · snow down
            // all ride the tide (breath current), streaming visibly when playing
            vx += (cur[0] * 4.5 - vx) * Math.min(1, dt * 0.8);
            vz += (cur[2] * 4.5 - vz) * Math.min(1, dt * 0.8);
            vy += (riseV + cur[1] * 3 - vy) * Math.min(1, dt * 0.5);
            if (kind < 0.5) { vx += Math.sin(t * 3 + i) * 1.2 * dt; vz += Math.cos(t * 2.6 + i) * 1.2 * dt; }  // bubble wobble
            // the breath swell — radial push from the ball, falling off with distance
            const bdx = x - ctr[0], bdy = y - ctr[1], bdz = z - ctr[2];
            const bdl = Math.hypot(bdx, bdy, bdz) || 1;
            const infl = swell * 26 * Math.exp(-bdl / 150);
            vx += bdx / bdl * infl * dt; vy += bdy / bdl * infl * 0.55 * dt; vz += bdz / bdl * infl * dt;
            // THE WAVE: each active impulse front shoves the particle outward as it passes
            let hit = 0;
            for (let m = 0; m < imp.length; m++) {
              const im = imp[m]; if (!im || im.t0 < 0) continue;
              const age = t - im.t0; if (age < 0 || age > 3.5) continue;
              const dx = x - im.o[0], dy = y - im.o[1], dz = z - im.o[2];
              const r = Math.hypot(dx, dy, dz) || 1e-3;
              const front = ws * age, band = Math.abs(r - front);
              const f = Math.exp(-(band * band) / (2 * wwd * wwd)) * im.strength * Math.exp(-age * 0.7);
              if (f > 0.02) {
                const k = f * 90 * dt;
                vx += dx / r * k; vy += dy / r * k * 0.5; vz += dz / r * k;
                hit = Math.max(hit, f);
              }
            }
            hit = Math.max(hit, Math.abs(swell) * 0.35 * Math.exp(-bdl / 150));   // breath swell lights the water too
            vx *= (1 - dt * 0.8); vy *= (1 - dt * 0.8); vz *= (1 - dt * 0.8);   // water damping
            x += vx * dt; y += vy * dt; z += vz * dt;
            // wrap the volume
            if (y < 2) { y = EXTYD; x = (drng() - 0.5) * 2 * EXTD; z = (drng() - 0.5) * 2 * EXTD; vx = vy = vz = 0; }
            if (x > EXTD) x -= 2 * EXTD; else if (x < -EXTD) x += 2 * EXTD;
            if (z > EXTD) z -= 2 * EXTD; else if (z < -EXTD) z += 2 * EXTD;
            dpos[i * 3] = x; dpos[i * 3 + 1] = y; dpos[i * 3 + 2] = z;
            dvel[i * 3] = vx; dvel[i * 3 + 1] = vy; dvel[i * 3 + 2] = vz;
            dagit[i] += (hit - dagit[i]) * Math.min(1, dt * 3);
            // emit a camera-facing quad — each TYPE has its own size + shape so
            // the water reads as a mix of real matter, not uniform specks:
            //   bubble  → medium, round, bright rim (the shader draws the ring)
            //   plankton→ tiny bright speck
            //   snow    → small, slightly elongated tan flake
            const hs = (i * 0.6180339) % 1, hs2 = (i * 0.3129) % 1;
            let psz, aspY, br;
            if (kind < 0.5) {            // bubble
              psz = sz * (0.9 + 0.7 * hs); aspY = 1.0; br = 0.8 + 0.2 * hs2;
            } else if (kind < 1.5) {     // plankton
              psz = sz * (0.28 + 0.22 * hs); aspY = 1.0; br = 0.6 + 0.4 * hs2;
            } else {                     // marine snow
              psz = sz * (0.5 + 0.7 * hs); aspY = 0.6 + 1.1 * hs2; br = 0.35 + 0.45 * hs2;
            }
            const ag = dagit[i];
            for (let n = 0; n < 6; n++) {
              const c = CORN[TRI[n]], o = (i * 6 + n) * 8;
              dQuad[o] = x + rx * c[0] * psz; dQuad[o + 1] = y + c[1] * psz * aspY; dQuad[o + 2] = z + rz * c[0] * psz;
              dQuad[o + 3] = c[0]; dQuad[o + 4] = c[1]; dQuad[o + 5] = br; dQuad[o + 6] = ag; dQuad[o + 7] = kind;
            }
          }
          device.queue.writeBuffer(dbuf, 0, dQuad);
        }
      };
      debris.bg = device.createBindGroup({ layout: debrisPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: viewBuf } }] });
      debris.setView = (vb) => { debris.bg = device.createBindGroup({ layout: debrisPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: vb } }] }); };
    }

    /* ---- MELODIC RIBBON (opt-in · opts.ribbon = max spine points) ----------
       A reusable note→form drawable: the species feeds a polyline of spine points
       (world pos + rgba, built from the note-history) and the engine draws it as a
       camera-facing triangle-list ribbon INSIDE the field pass, so it shares depth +
       MSAA + resolve. The note-twin of the breath→life binding — any signal history
       can grow a ribbon. Byte-identical (absent) when opts.ribbon is 0. */
    let ribbon = null;
    const RIBMAX = opts.ribbon || 0;
    if (RIBMAX > 0) {
      const ribMod = device.createShaderModule({ code: `
struct RV { vp: mat4x4f };
@group(0) @binding(0) var<uniform> V: RV;
struct RIn { @location(0) pos: vec3f, @location(1) col: vec4f, @location(2) e: f32 };
struct ROut { @builtin(position) cp: vec4f, @location(0) col: vec4f, @location(1) e: f32 };
@vertex fn ribVs(i: RIn) -> ROut { var o: ROut; o.cp = V.vp * vec4f(i.pos, 1.0); o.col = i.col; o.e = i.e; return o; }
@fragment fn ribFs(inp: ROut) -> @location(0) vec4f {
  let f = 1.0 - abs(inp.e);                 // soft edge across the ribbon width
  return vec4f(inp.col.rgb, inp.col.a * f * f);   // bright core → feathered edges (a glowing streamer, not a slab)
}
` });
      const ribArr = new Float32Array((RIBMAX - 1) * 6 * 8);   // 2 tris/segment · 8 floats/vert (pos3 + rgba4 + edge1)
      const ribBuf = device.createBuffer({ size: ribArr.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      const ribPipe = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: ribMod, entryPoint: "ribVs", buffers: [{ arrayStride: 32, attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x4" },
          { shaderLocation: 2, offset: 28, format: "float32" }] }] },
        fragment: { module: ribMod, entryPoint: "ribFs", targets: [{ format: gpu.format, blend: {
          color: { srcFactor: "src-alpha", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } } }] },
        primitive: { topology: "triangle-list" },
        depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less" },
        multisample: { count: gpu.sampleCount }
      });
      ribbon = {
        pipe: ribPipe, buf: ribBuf, arr: ribArr, cap: RIBMAX, count: 0,
        bg: device.createBindGroup({ layout: ribPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: viewBuf } }] }),
        setView(vb) { this.bg = device.createBindGroup({ layout: ribPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: vb } }] }); },
        /* build from spine points [{x,y,z,w,r,g,b,a}] using the camera eye — width
           runs ⟂ the segment and toward the eye (camera-facing). e = ±1 across the
           width → the FS feathers the edges. Sets count for draw. */
        build(pts, eye) {
          const n = pts.length; let v = 0;
          const put = (P, c, e) => { const o = v * 8; this.arr[o] = P[0]; this.arr[o + 1] = P[1]; this.arr[o + 2] = P[2];
            this.arr[o + 3] = c.r; this.arr[o + 4] = c.g; this.arr[o + 5] = c.b; this.arr[o + 6] = c.a; this.arr[o + 7] = e; v++; };
          for (let i = 0; i < n - 1 && i < this.cap - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            const sx = b.x - a.x, sy = b.y - a.y, sz = b.z - a.z;
            const mx = (a.x + b.x) * 0.5, my = (a.y + b.y) * 0.5, mz = (a.z + b.z) * 0.5;
            const vx = eye[0] - mx, vy = eye[1] - my, vz = eye[2] - mz;
            let px = sy * vz - sz * vy, py = sz * vx - sx * vz, pz = sx * vy - sy * vx;
            const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl;
            const A0 = [a.x + px * a.w, a.y + py * a.w, a.z + pz * a.w], A1 = [a.x - px * a.w, a.y - py * a.w, a.z - pz * a.w];
            const B0 = [b.x + px * b.w, b.y + py * b.w, b.z + pz * b.w], B1 = [b.x - px * b.w, b.y - py * b.w, b.z - pz * b.w];
            put(A0, a, 1); put(B0, b, 1); put(B1, b, -1);
            put(A0, a, 1); put(B1, b, -1); put(A1, a, -1);
          }
          this.count = v;
          if (v > 0) device.queue.writeBuffer(this.buf, 0, this.arr, 0, v * 8);
        }
      };
    }

    /* ---- SMOKE / FOG (opt-in · opts.smoke = particle count) ----------------
       Luminous drifting puffs the performance ANIMATES: breath LIFTS and BILLOWS
       them, each note PUFFS a burst, silence lets them thin to nothing. Camera-
       facing soft billboards drawn in the field pass (shares depth → the smoke
       weaves THROUGH the body, occluded behind blades). A reusable atmosphere any
       world can breathe. Byte-identical (absent) when opts.smoke is 0. */
    let smoke = null;
    const SMOKEMAX = opts.smoke || 0;
    if (SMOKEMAX > 0) {
      const smMod = device.createShaderModule({ code: `
struct SV { vp: mat4x4f };
@group(0) @binding(0) var<uniform> V: SV;
struct SIn { @location(0) pos: vec3f, @location(1) uv: vec2f, @location(2) col: vec4f };
struct SOut { @builtin(position) cp: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f };
@vertex fn smVs(i: SIn) -> SOut { var o: SOut; o.cp = V.vp * vec4f(i.pos, 1.0); o.uv = i.uv; o.col = i.col; return o; }
@fragment fn smFs(inp: SOut) -> @location(0) vec4f {
  let a = inp.col.a * smoothstep(1.0, 0.0, length(inp.uv));   // soft round puff
  return vec4f(inp.col.rgb * a, a);                            // premultiplied → additive glow
}
` });
      const smArr = new Float32Array(SMOKEMAX * 6 * 9);   // 6 verts/quad · 9 floats (pos3 + uv2 + rgba4)
      const smBuf = device.createBuffer({ size: smArr.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      const smPipe = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: smMod, entryPoint: "smVs", buffers: [{ arrayStride: 36, attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x2" },
          { shaderLocation: 2, offset: 20, format: "float32x4" }] }] },
        fragment: { module: smMod, entryPoint: "smFs", targets: [{ format: gpu.format, blend: {
          color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } } }] },
        primitive: { topology: "triangle-list" },
        depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less" },
        multisample: { count: gpu.sampleCount }
      });
      const SN = SMOKEMAX;
      const spx = new Float32Array(SN), spy = new Float32Array(SN), spz = new Float32Array(SN);
      const svx = new Float32Array(SN), svy = new Float32Array(SN), svz = new Float32Array(SN);
      const slife = new Float32Array(SN), sseed = new Float32Array(SN), shue = new Float32Array(SN);
      const srng = (global.ZigCore ? global.ZigCore.rng(SEED ^ 0x5A0E) : Math.random);
      for (let i = 0; i < SN; i++) { slife[i] = srng(); sseed[i] = srng(); }
      const SCORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]], STRI = [0, 1, 2, 0, 2, 3];
      smoke = {
        pipe: smPipe, buf: smBuf, arr: smArr, count: 0, N: SN, _ptr: 0,
        bg: device.createBindGroup({ layout: smPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: viewBuf } }] }),
        setView(vb) { this.bg = device.createBindGroup({ layout: smPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: vb } }] }); },
        /* puff: a note injects a rising burst at (x,y,z), tinted by note hue h */
        puff(x, y, z, strength, h) {
          const nn = Math.min(this.N, Math.max(3, Math.round(7 * strength)));
          for (let k = 0; k < nn; k++) {
            const i = this._ptr; this._ptr = (this._ptr + 1) % this.N;
            const a = srng() * 6.283, r = srng() * 3, sp = 5 + 11 * strength;
            spx[i] = x + Math.cos(a) * r; spy[i] = y + (srng() - 0.3) * 2; spz[i] = z + Math.sin(a) * r;
            svx[i] = Math.cos(a) * sp * 0.4; svy[i] = 3 + srng() * sp; svz[i] = Math.sin(a) * sp * 0.4;
            slife[i] = 1; shue[i] = h;
          }
        },
        /* frame: drift + breath-lift, build camera-facing quads. env = {dt,time,breath,cen[3],eye[3],baseHue,size} */
        frame(env) {
          const dt = Math.min(env.dt, 0.05), br = env.breath || 0, cen = env.cen, eye = env.eye, tm = env.time || 0;
          let rx = eye[2], rz = -eye[0]; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;   // horizontal camera-right · up = world Y
          const lift = 2 + 14 * br, billow = 0.4 + 1.6 * br, sz = env.size || 7;
          let v = 0;
          for (let i = 0; i < this.N; i++) {
            if (slife[i] <= 0) {
              if (br < 0.03 && srng() > 0.02) continue;                 // at rest, let the fog thin out
              const a = srng() * 6.283, rr = srng() * 34;
              spx[i] = cen[0] + Math.cos(a) * rr; spy[i] = cen[1] - 10 + srng() * 30; spz[i] = cen[2] + Math.sin(a) * rr;
              svx[i] = 0; svy[i] = 0; svz[i] = 0; slife[i] = 0.5 + srng() * 0.5; shue[i] = env.baseHue;
            }
            svy[i] += lift * dt;
            const s = sseed[i] * 6.283;
            svx[i] += Math.sin(tm * 0.3 + s) * billow * dt; svz[i] += Math.cos(tm * 0.27 + s * 1.3) * billow * dt;
            svx[i] *= 0.96; svy[i] *= 0.97; svz[i] *= 0.96;
            spx[i] += svx[i] * dt; spy[i] += svy[i] * dt; spz[i] += svz[i] * dt;
            slife[i] -= dt * (0.10 + 0.06 * br);
            if (slife[i] <= 0) continue;
            const l = slife[i], fade = Math.min(1, l * 2) * Math.min(1, (1 - l) * 4 + 0.3);
            const rad = sz * (0.5 + 1.3 * (1 - l)) * (0.7 + 0.6 * br);
            const h = shue[i], cr = 0.5 + 0.5 * Math.cos(6.283 * h), cg = 0.5 + 0.5 * Math.cos(6.283 * (h + 0.33)), cb = 0.5 + 0.5 * Math.cos(6.283 * (h + 0.66));
            const al = (0.05 + 0.11 * fade) * (0.35 + 0.95 * br);
            for (let n = 0; n < 6; n++) {
              const cc = SCORN[STRI[n]], o = v * 9;
              this.arr[o] = spx[i] + rx * cc[0] * rad; this.arr[o + 1] = spy[i] + cc[1] * rad; this.arr[o + 2] = spz[i] + rz * cc[0] * rad;
              this.arr[o + 3] = cc[0]; this.arr[o + 4] = cc[1];
              this.arr[o + 5] = cr; this.arr[o + 6] = cg; this.arr[o + 7] = cb; this.arr[o + 8] = al;
              v++;
            }
          }
          this.count = v;
          if (v > 0) device.queue.writeBuffer(this.buf, 0, this.arr, 0, v * 9);
        }
      };
    }

    /* ---- WEB (opt-in · opts.web) — CONNECTIVE FILAMENTS ---------------------
       Threads drawn between neighbouring agents. A compute pass reads the flock's
       OWN spatial grid — the same topology the flock flies on — to find each
       agent's K nearest neighbours, then a thin camera-facing quad is drawn from
       each agent to each neighbour. A living web that forms and breaks as the
       field moves: taut short threads read bright, stretched ones fade, and the
       whole web brightens with BREATH (vitality strings it together). Reusable
       connective tissue — any species inherits it. Byte-identical when absent. */
    let web = null;
    if (WEB) {
      const WK = WEB.k;
      const webIdx = device.createBuffer({ size: MAX * WK * 4, usage: GPUBufferUsage.STORAGE });
      const webBuf = device.createBuffer({ size: 4 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const webArr = new Float32Array(4);   // x gain · y halfWidth · z hue · w breath
      /* ENERGY CHANNEL (v0.25) — a per-agent scalar that DIFFUSES along the web
         filaments each frame (energy flows to the exact neighbours the threads
         connect), decays, and is fed by note injections. A note poured at a point
         conducts OUTWARD across the membrane as a wavefront of light — the web as
         a nervous system. Double-buffered alongside the main flip. */
      const energyA = device.createBuffer({ size: MAX * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      const energyB = device.createBuffer({ size: MAX * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      { const z = new Float32Array(MAX); device.queue.writeBuffer(energyA, 0, z); device.queue.writeBuffer(energyB, 0, z); }   // start dark
      const injBuf = device.createBuffer({ size: 8 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const injArr = new Float32Array(8);   // seed: x y z strength · cfg: radius² decay diffuse injGain
      injArr[4] = (WEB.radius * 0.8) * (WEB.radius * 0.8);   // injection radius²
      injArr[5] = 0.955;   // per-frame decay (how long a pulse lingers)
      injArr[6] = 0.16;    // diffusion rate (how fast energy spreads to neighbours)
      injArr[7] = 0.9;     // injection gain
      device.queue.writeBuffer(injBuf, 0, injArr);

      /* neighbour-find: mirrors the ZigPhase 7-NN, reusing the grid buffers. */
      const webNNmod = device.createShaderModule({ code: COMMON + `
@group(0) @binding(0) var<uniform> U: Sim;
@group(0) @binding(1) var<storage, read> posIn: array<vec4f>;
@group(0) @binding(2) var<storage, read> gridCount: array<u32>;
@group(0) @binding(3) var<storage, read> gridIdx: array<u32>;
@group(0) @binding(4) var<storage, read_write> webOut: array<u32>;
const WK: u32 = ${WK}u;
const WR2: f32 = ${(WEB.radius * WEB.radius).toFixed(1)};
@compute @workgroup_size(64)
fn webnn(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; if (i >= U.count) { return; }
  let p = posIn[i].xyz;
  var nd: array<f32, WK>; var ni: array<u32, WK>;
  for (var k = 0u; k < WK; k++) { nd[k] = 1e12; ni[k] = 0xffffffffu; }
  let c = cellCoord(p);
  for (var dz = -1; dz <= 1; dz++) {
  for (var dy = -1; dy <= 1; dy++) {
  for (var dx = -1; dx <= 1; dx++) {
    let cc = c + vec3i(dx, dy, dz);
    if (cc.x < 0 || cc.y < 0 || cc.z < 0 || cc.x >= GX || cc.y >= GY || cc.z >= GZ) { continue; }
    let ci = cellIndex(cc);
    let n = min(gridCount[ci], CAP);
    for (var s = 0u; s < n; s++) {
      let j = gridIdx[ci * CAP + s];
      if (j == i) { continue; }
      let dpv = posIn[j].xyz - p;
      let d2 = dot(dpv, dpv);
      if (d2 < WR2 && d2 < nd[WK - 1u]) {
        var k = WK - 1u;
        loop {
          if (k > 0u && nd[k - 1u] > d2) { nd[k] = nd[k - 1u]; ni[k] = ni[k - 1u]; k = k - 1u; }
          else { break; }
        }
        nd[k] = d2; ni[k] = j;
      }
    }
  }}}
  for (var k = 0u; k < WK; k++) { webOut[i * WK + k] = ni[k]; }
}
` });
      const webNNpipe = device.createComputePipeline({ layout: "auto", compute: { module: webNNmod, entryPoint: "webnn" } });

      /* energy diffusion: energy flows to the SAME K neighbours the threads draw,
         so a note poured at a point spreads visibly ALONG the filaments. Laplacian
         diffusion (spread to neighbours) + decay + point injection near the seed. */
      const webEmod = device.createShaderModule({ code: `
struct Inj { seed: vec4f, cfg: vec4f };   // seed xyz + strength · cfg: radius² decay diffuse injGain
@group(0) @binding(0) var<storage, read> pos: array<vec4f>;
@group(0) @binding(1) var<storage, read> webIdx: array<u32>;
@group(0) @binding(2) var<storage, read> eIn: array<f32>;
@group(0) @binding(3) var<storage, read_write> eOut: array<f32>;
@group(0) @binding(4) var<uniform> J: Inj;
const WK: u32 = ${WK}u;
const WCOUNT: u32 = ${MAX}u;
@compute @workgroup_size(64)
fn webenergy(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x; if (i >= WCOUNT) { return; }
  let e = eIn[i];
  var sum = 0.0; var cnt = 0.0;
  for (var k = 0u; k < WK; k++) {
    let j = webIdx[i * WK + k];
    if (j != 0xffffffffu) { sum = sum + eIn[j]; cnt = cnt + 1.0; }
  }
  var ne = e;
  if (cnt > 0.0) { ne = e + J.cfg.z * (sum - cnt * e); }   // Laplacian spread along the threads
  ne = ne * J.cfg.y;                                        // decay
  let dpv = pos[i].xyz - J.seed.xyz;                        // point injection (a note poured here)
  let d2 = dot(dpv, dpv);
  if (d2 < J.cfg.x && J.seed.w > 0.0) { ne = ne + J.seed.w * J.cfg.w * (1.0 - d2 / J.cfg.x); }
  eOut[i] = clamp(ne, 0.0, 8.0);
}
` });
      const webEpipe = device.createComputePipeline({ layout: "auto", compute: { module: webEmod, entryPoint: "webenergy" } });

      /* thread render: instanced camera-facing quads, one per (agent × neighbour).
         Instance count = count·K (JS-bounded), so agent index is always in range;
         a missing neighbour (0xffffffff) is pushed behind the near plane → clipped. */
      const webRmod = device.createShaderModule({ code: `
struct View { viewProj: mat4x4f, camPos: vec4f, camRight: vec4f, camUp: vec4f, camFwd: vec4f,
  sunDir: vec4f, skyTop: vec4f, skyMid: vec4f, horizon: vec4f, ground: vec4f,
  sunCol: vec4f, birdDark: vec4f, birdLight: vec4f, render: vec4f, render2: vec4f, render3: vec4f };
struct WebU { p: vec4f };   // x gain · y halfWidth · z hue · w breath
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read> webIdx: array<u32>;
@group(0) @binding(3) var<uniform> W: WebU;
@group(0) @binding(4) var<storage, read> energy: array<f32>;
const WK: u32 = ${WK}u;
const WRAD: f32 = ${WEB.radius.toFixed(1)};
struct WOut { @builtin(position) cp: vec4f, @location(0) e: f32, @location(1) fade: f32, @location(2) en: f32 };
@vertex
fn webVs(@builtin(vertex_index) vi: u32, @builtin(instance_index) inst: u32) -> WOut {
  var o: WOut;
  let i = inst / WK;
  let j = webIdx[inst];
  if (j == 0xffffffffu) { o.cp = vec4f(0.0, 0.0, -2.0, 1.0); o.e = 0.0; o.fade = 0.0; o.en = 0.0; return o; }
  let a = pos[i].xyz;
  let b = pos[j].xyz;
  let seg = b - a;
  let L = length(seg);
  let lf = clamp(1.0 - L / WRAD, 0.0, 1.0);          // taut = bright, stretched = faint
  let mid = (a + b) * 0.5;
  let toEye = V.camPos.xyz - mid;
  var side = cross(seg, toEye);
  let sl = length(side);
  if (sl < 1e-5 || L < 1e-4) { o.cp = vec4f(0.0, 0.0, -2.0, 1.0); o.e = 0.0; o.fade = 0.0; o.en = 0.0; return o; }
  side = side / sl;
  /* computed, not tabled — a mutable local array spills onto Metal's small
     vertex stack. Same quad (0,1,3 then 0,3,2), x running 0..1 for a ribbon. */
  let ci = select(select(3u, 2u, vi == 5u), select(0u, 1u, vi == 1u), vi == 0u || vi == 1u || vi == 3u);
  let cc = vec2f(select(0.0, 1.0, (ci & 1u) != 0u), select(-1.0, 1.0, (ci & 2u) != 0u));
  let ew = 1.0 + 0.9 * max(energy[i], energy[j]);     // energised threads swell slightly
  let wp = a + seg * cc.x + side * (W.p.y * ew * cc.y);
  o.cp = V.viewProj * vec4f(wp, 1.0);
  o.e = cc.y;
  o.fade = lf;
  o.en = 0.5 * (energy[i] + energy[j]);               // the pulse carried by this filament
  return o;
}
@fragment
fn webFs(inp: WOut) -> @location(0) vec4f {
  let edge = 1.0 - abs(inp.e);                        // feather across the filament
  let hue = W.p.z;
  let col = vec3f(0.5 + 0.5 * cos(6.2831 * hue),
                  0.5 + 0.5 * cos(6.2831 * (hue + 0.33)),
                  0.5 + 0.5 * cos(6.2831 * (hue + 0.66)));
  let base = W.p.x * (0.22 + 0.95 * W.p.w) * inp.fade;                 // resting web (breath-strung)
  let pulse = clamp(inp.en, 0.0, 4.0);
  let hot = mix(col, vec3f(1.0, 0.85, 0.55), clamp(pulse * 0.5, 0.0, 0.8));   // energy runs white-hot
  let a = (base + pulse * 1.15) * edge * edge;
  return vec4f(hot * a, a);                           // premultiplied
}
` });
      const webRpipe = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: webRmod, entryPoint: "webVs" },
        fragment: { module: webRmod, entryPoint: "webFs", targets: [{ format: gpu.format, blend: {
          color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } } }] },
        primitive: { topology: "triangle-list", cullMode: "none" },
        depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less" },
        multisample: { count: gpu.sampleCount }
      });

      const mkWebNN = (pcur) => device.createBindGroup({ layout: webNNpipe.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: simBuf } }, { binding: 1, resource: { buffer: pcur } },
        { binding: 2, resource: { buffer: gridCount } }, { binding: 3, resource: { buffer: gridIdx } },
        { binding: 4, resource: { buffer: webIdx } }] });
      const mkWebE = (pcur, ein, eout) => device.createBindGroup({ layout: webEpipe.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: pcur } }, { binding: 1, resource: { buffer: webIdx } },
        { binding: 2, resource: { buffer: ein } }, { binding: 3, resource: { buffer: eout } },
        { binding: 4, resource: { buffer: injBuf } }] });
      const mkWebR = (pcur, vb, ecur) => device.createBindGroup({ layout: webRpipe.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: vb } }, { binding: 1, resource: { buffer: pcur } },
        { binding: 2, resource: { buffer: webIdx } }, { binding: 3, resource: { buffer: webBuf } },
        { binding: 4, resource: { buffer: ecur } }] });
      web = {
        nnPipe: webNNpipe, ePipe: webEpipe, rPipe: webRpipe, k: WK, arr: webArr,
        nnBG: [mkWebNN(posB), mkWebNN(posA)],                       // flip 0 ranks/draws posB (the rendered buffer), flip 1 posA
        eBG:  [mkWebE(posB, energyA, energyB), mkWebE(posA, energyB, energyA)],   // flip 0: energy A→B · flip 1: B→A
        rBG:  [mkWebR(posB, viewBuf, energyB), mkWebR(posA, viewBuf, energyA)],   // render reads the just-written energy
        /* live controls, written each frame by the species. breath strings the web. */
        ctrl(gain, halfWidth, hue, breath) {
          webArr[0] = gain; webArr[1] = halfWidth; webArr[2] = hue; webArr[3] = breath;
          device.queue.writeBuffer(webBuf, 0, webArr);
        },
        /* pour energy at a world point (a note). strength 0 = no injection this frame;
           held notes keep feeding the seed → a fountain that diffuses outward. */
        inject(x, y, z, strength) {
          injArr[0] = x; injArr[1] = y; injArr[2] = z; injArr[3] = strength;
          device.queue.writeBuffer(injBuf, 0, injArr, 0, 4);
        },
        setView(vb) { this.rBG = [mkWebR(posB, vb, energyB), mkWebR(posA, vb, energyA)]; }
      };
      web.ctrl(0, WEB.width, 0.58, 0);   // dark until the species drives it
    }

    /* ---- STAGE / THE VITRINE (opt-in · opts.stage) --------------------------
       The specimen's SETTING: a world-space floor plane carrying a soft radial
       POOL of light directly beneath the organism, fading to black. It gives the
       held mass a ground to rest on and a lit space to inhabit — so the viewer
       reads it as a specimen on a plinth in a dark room and becomes a voyeur
       looking IN, rather than watching weather drift by. Drawn after the sky,
       before the shards (they composite over it). A reusable staging capability
       any world/species can be displayed in. Byte-identical when absent. */
    let stage = null;
    if (STAGE) {
      const fy = (+STAGE.y || 0).toFixed(2), cx = (+STAGE.x || 0).toFixed(2), cz = (+STAGE.z || 0).toFixed(2);
      const R = (+STAGE.r || 120).toFixed(2), PR = (+STAGE.pool || 40).toFixed(2), gain = (+STAGE.gain || 1).toFixed(3);
      const col = STAGE.color || [0.16, 0.22, 0.34];
      const stMod = device.createShaderModule({ code: `
struct SV { vp: mat4x4f };
@group(0) @binding(0) var<uniform> V: SV;
struct StOut { @builtin(position) cp: vec4f, @location(0) wp: vec2f };
@vertex fn stVs(@builtin(vertex_index) vi: u32) -> StOut {
  /* corners computed, not tabled — a mutable local array lands on Metal's small
     vertex stack and overflows it. Same quad: 0,1,3 then 0,3,2. */
  let ci = select(select(3u, 2u, vi == 5u), select(0u, 1u, vi == 1u), vi == 0u || vi == 1u || vi == 3u);
  let c = vec2f(select(-1.0, 1.0, (ci & 1u) != 0u), select(-1.0, 1.0, (ci & 2u) != 0u));
  let wx = ${cx} + c.x * ${R};
  let wz = ${cz} + c.y * ${R};
  var o: StOut;
  o.cp = V.vp * vec4f(wx, ${fy}, wz, 1.0);
  o.wp = vec2f(wx - ${cx}, wz - ${cz});
  return o;
}
@fragment fn stFs(inp: StOut) -> @location(0) vec4f {
  let d = length(inp.wp);
  let pool = pow(clamp(1.0 - d / ${PR}, 0.0, 1.0), 1.9);   // soft radial pool of light on the floor
  let c = vec3f(${(+col[0]).toFixed(3)}, ${(+col[1]).toFixed(3)}, ${(+col[2]).toFixed(3)}) * pool * ${gain};
  return vec4f(c, pool);                                    // premultiplied → additive glow on the black floor
}
` });
      const stPipe = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: stMod, entryPoint: "stVs" },
        fragment: { module: stMod, entryPoint: "stFs", targets: [{ format: gpu.format, blend: {
          color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } } }] },
        primitive: { topology: "triangle-list" },
        depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less-equal" },
        multisample: { count: gpu.sampleCount }
      });
      stage = {
        pipe: stPipe,
        bg: device.createBindGroup({ layout: stPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: viewBuf } }] }),
        setView(vb) { this.bg = device.createBindGroup({ layout: stPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: vb } }] }); }
      };
    }

    /* ---- bind groups (double-buffered A→B, B→A) -------------------------- */
    const mkGridBG = (pin) => device.createBindGroup({
      layout: buildPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: simBuf } },
        { binding: 1, resource: { buffer: pin } },
        { binding: 2, resource: { buffer: gridCount } },
        { binding: 3, resource: { buffer: gridIdx } }]
    });
    // clearGrid only touches gridCount — auto layout exposes just that binding
    const clearBG = device.createBindGroup({
      layout: clearPipe.getBindGroupLayout(0),
      entries: [{ binding: 2, resource: { buffer: gridCount } }]
    });
    const mkStepBG = (pin, vin, pout, vout, lin, lout) => {
      const entries = [
        { binding: 0, resource: { buffer: simBuf } },
        { binding: 1, resource: { buffer: pin } },
        { binding: 2, resource: { buffer: vin } },
        { binding: 3, resource: { buffer: gridCount } },
        { binding: 4, resource: { buffer: gridIdx } },
        { binding: 5, resource: { buffer: pout } },
        { binding: 6, resource: { buffer: vout } }];
      if (FLOW) {
        entries.push({ binding: 7, resource: { buffer: FLOW.buf } });    // ZIGFLOW: the shared air
        entries.push({ binding: 8, resource: { buffer: FLOW.ubuf } });
      }
      if (SKIN) {
        entries.push({ binding: 9, resource: { buffer: SKIN.buf } });    // MEMBRANE: elastic space
        entries.push({ binding: 10, resource: { buffer: SKIN.ubuf } });
      }
      if (LIFE) {
        entries.push({ binding: 11, resource: { buffer: lin } });        // ZIGLIFE: state in
        entries.push({ binding: 12, resource: { buffer: lout } });       // ZIGLIFE: state out
      }
      if (SEEK) entries.push({ binding: 13, resource: { buffer: seekBuf } });     // ZIGSEEK: world targets
      if (ATTACH) entries.push({ binding: 14, resource: { buffer: attachBuf } }); // ZIGATTACH: global attach signal
      return device.createBindGroup({ layout: stepPipe.getBindGroupLayout(0), entries });
    };
    const mkDrawBG = (pcur, vcur, phcur, lcur) => {
      const entries = [
        { binding: 0, resource: { buffer: viewBuf } },
        { binding: 1, resource: { buffer: pcur } },
        { binding: 2, resource: { buffer: vcur } }];
      if (MESH && PHASE) entries.push({ binding: 3, resource: { buffer: phcur } });   // pulse-shards
      if (MESH) entries.push({ binding: 4, resource: { buffer: simBuf } });           // VOICE: FS reads pace.w
      if (LIFE && MESH) entries.push({ binding: 5, resource: { buffer: lcur } });     // ZIGLIFE: state → visible (arousal shrink / energy dim)
      return device.createBindGroup({ layout: birdPipe.getBindGroupLayout(0), entries });
    };
    // sky only reads the View uniform
    const skyBG = device.createBindGroup({
      layout: skyPipe.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: viewBuf } }]
    });
    const mkPhaseBG = (pin, phin, phout) => !PHASE ? null : device.createBindGroup({
      layout: phasePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: simBuf } },
        { binding: 1, resource: { buffer: pin } },
        { binding: 2, resource: { buffer: gridCount } },
        { binding: 3, resource: { buffer: gridIdx } },
        { binding: 4, resource: { buffer: phin } },
        { binding: 5, resource: { buffer: phout } }]
    });
    const mkLanternBG = (pcur, phcur) => !PHASE ? null : device.createBindGroup({
      layout: lanternPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: viewBuf } },
        { binding: 1, resource: { buffer: pcur } },
        { binding: 2, resource: { buffer: phcur } }]
    });
    const sets = [
      { grid: mkGridBG(posA), step: mkStepBG(posA, velA, posB, velB, lifeA, lifeB), draw: mkDrawBG(posB, velB, phB, lifeB),
        phase: mkPhaseBG(posA, phA, phB), lantern: mkLanternBG(posB, phB) },
      { grid: mkGridBG(posB), step: mkStepBG(posB, velB, posA, velA, lifeB, lifeA), draw: mkDrawBG(posA, velA, phA, lifeA),
        phase: mkPhaseBG(posB, phB, phA), lantern: mkLanternBG(posA, phA) }
    ];
    let flip = 0;

    /* ---- the per-frame call --------------------------------------------- */
    const flock = {
      MAX, EXT, EXTY,
      count: Math.min(opts.count || 30000, MAX),
      vertsPerAgent: MESHES ? MAXV : (opts.verts || 21),   // bird = 21 · fish = 33 · shard = largest letter in the wardrobe
      seed: seedBirds,
      /* Surface seeding — petals spread uniformly across the whole membrane
         (a lake skin, an ocean top), not balled like a flock. */
      seedSurface(level, ext) {
        const rng = (global.ZigCore ? global.ZigCore.rng : null);
        const r = rng ? rng(SEED ^ 0x5F1A) : Math.random;
        const P = new Float32Array(MAX * 4), Vv = new Float32Array(MAX * 4);
        for (let i = 0; i < MAX; i++) {
          P[i * 4]     = (r() * 2 - 1) * ext;
          P[i * 4 + 1] = level + (r() - 0.5) * 1.6;
          P[i * 4 + 2] = (r() * 2 - 1) * ext;
          P[i * 4 + 3] = 0;
          const va = r() * 6.283;
          Vv[i * 4] = Math.cos(va) * 0.6; Vv[i * 4 + 1] = 0; Vv[i * 4 + 2] = Math.sin(va) * 0.6; Vv[i * 4 + 3] = 0;
        }
        device.queue.writeBuffer(posA, 0, P); device.queue.writeBuffer(posB, 0, P);
        device.queue.writeBuffer(velA, 0, Vv); device.queue.writeBuffer(velB, 0, Vv);
      },
      /* ZigPhase: deterministic phase + natural-frequency seeding.
         baseOmega rad/s (≈0.7 Hz → 4.4) · spread = ±fraction of base. */
      seedPhase(baseOmega, spread) {
        if (!PHASE) return;
        const om0 = baseOmega || 4.4, sp = (spread === undefined ? 0.25 : spread);
        const rng = (global.ZigCore ? global.ZigCore.rng : null);
        const r = rng ? rng(SEED ^ 0x9A5E) : Math.random;
        const ph = new Float32Array(MAX * 2);
        for (let i = 0; i < MAX; i++) {
          ph[i * 2] = r() * 6.28318;                            // phase: anywhere in the cycle
          ph[i * 2 + 1] = om0 * (1 - sp + 2 * sp * r());        // its own clock
        }
        device.queue.writeBuffer(phA, 0, ph);
        device.queue.writeBuffer(phB, 0, ph);
      },
      // pack the per-frame Sim uniforms (shared by frame() and computeInto())
      _packSim(state) {
        simArr[0] = state.dt; simArr[1] = state.time; simArr[2] = state.breath; simArr[3] = state.bend;
        simArr[4] = state.attack; simArr[5] = state.waveSpeed; simArr[6] = state.waveWidth; simArr[7] = state.energy;
        simU32[8] = this.count; simArr[9] = state.agitAmbient || 0; simArr[10] = state.cohW; simArr[11] = state.sepW;
        simArr.set(state.anchor, 12);          // vec4
        simArr.set(state.refpt, 16);           // vec4
        simArr[20] = state.wind[0]; simArr[21] = state.wind[1]; simArr[22] = state.wind[2]; simArr[23] = state.aliW;
        simArr.set(state.knobsA, 24);          // contagion · sepRadius · vmin · vmaxBase
        simArr.set(state.knobsB, 28);          // vmaxAgit · waveKick · bankGain · churn
        for (let m = 0; m < 8; m++) {
          const im = state.impulses[m];
          const o = 32 + m * 4, o2 = 64 + m * 4;
          if (im && im.t0 >= 0) {
            simArr[o] = im.o[0]; simArr[o + 1] = im.o[1]; simArr[o + 2] = im.o[2]; simArr[o + 3] = im.t0;
            simArr[o2] = im.strength; simArr[o2 + 1] = (im.kick !== undefined ? im.kick : 1); simArr[o2 + 2] = 0; simArr[o2 + 3] = 0;
          } else { simArr[o + 3] = -1; simArr[o2] = 0; }
        }
        simArr.set(state.taps, 96);            // 64 floats
        if (state.wanderers) simArr.set(state.wanderers, 160); else for (let k = 0; k < 16; k++) simArr[160 + k] = (k % 4 === 0 ? -1 : 0);
        if (state.wmeta) simArr.set(state.wmeta, 176); else simArr.fill(0, 176, 192);
        simArr[192] = state.medium || 0;       // 0 air · 1 water
        simArr[193] = state.K || 0;            // ZigPhase: Kuramoto coupling (chaos → lock)
        simArr[194] = state.tempo === undefined ? 1 : state.tempo;   // tempo bias (bend)
        simArr[195] = state.ignite || 0;       // ignition-wave phase kick (strike)
        simArr[196] = state.pacePhase || 0;    // Pacemaker: the performer's beat phase
        simArr[197] = state.pacePull || 0;     // Pacemaker: entrainment strength (earned, not set)
        simArr[198] = state.waveLife || 0;     // Surface: ring lifetime s (0 = golden 3.5)
        /* VOICE (the resonator law, 2026-07-20): 1 = full dancer (default —
           every existing species) · 0 = instrument body: the flock holds no
           light and no restlessness of its own, glows only where a wave has
           just passed, and its agitation drains 5× slower so the ring FADES
           instead of stopping. Read by the step kernel + shard FS (mesh). */
        simArr[199] = state.voice === undefined ? 1 : state.voice;
        /* AVATAR — the performer embodied as ONE agent; influence spreads
           only through the local laws (neighbors, contagion, phase) */
        if (state.avatarA) { simArr.set(state.avatarA, 200); simArr.set(state.avatarB, 204); }
        else { simArr[200] = -1; simArr.fill(0, 201, 208); }
        /* WARDROBE — which letter the flock wears this frame. letter/letterB
           index the baked wardrobe; mix = fraction of agents wearing B
           (per-agent, deterministic hash — the METAMORPHOSIS dial). */
        simArr[208] = state.letter || 0;
        simArr[209] = state.letterB || 0;
        simArr[210] = state.mix || 0;
        simArr[211] = state.drift || 0;   // BIOME temperature drift (in notes — the orchard's slow season)
        if (SEEK) {
          const sk = state.seek || [0, 0, 0, 0], av = state.avoid || [0, 0, 0, 0], cf = state.seekcfg || [30, 30, 0, 0];
          seekArr[0] = sk[0]; seekArr[1] = sk[1]; seekArr[2] = sk[2]; seekArr[3] = sk[3];
          seekArr[4] = av[0]; seekArr[5] = av[1]; seekArr[6] = av[2]; seekArr[7] = av[3];
          seekArr[8] = cf[0]; seekArr[9] = cf[1]; seekArr[10] = cf[2] || 0; seekArr[11] = cf[3] || 0;
          device.queue.writeBuffer(seekBuf, 0, seekArr);
        }
        if (ATTACH) { attachArr[0] = state.attach || 0; device.queue.writeBuffer(attachBuf, 0, attachArr); }
        device.queue.writeBuffer(simBuf, 0, simArr);
      },
      /* ---- SCENE MODE — attach to a shared world (multi-species) ----------
         attachScene(scene) once; then each frame:
           flock.computeInto(encoder, state)   // records its compute pass
           ... scene draws sky ...
           flock.recordInto(renderPass)         // draws its agents (shared depth)
         The flock binds the SCENE's view uniform, so every species shares one
         camera; each keeps its own sim/grid buffers. Standalone frame() below
         is untouched — Murmuration keeps its proven path.                    */
      _sceneDraw: null, _scene: null,
      attachScene(scene) {
        this._scene = scene;
        const sceneEntries = (pcur, vcur, phcur, lcur) => {
          const e = [
            { binding: 0, resource: { buffer: scene.viewBuf } },
            { binding: 1, resource: { buffer: pcur } },
            { binding: 2, resource: { buffer: vcur } }];
          if (MESH && PHASE) e.push({ binding: 3, resource: { buffer: phcur } });
          if (MESH) e.push({ binding: 4, resource: { buffer: simBuf } });   // VOICE: FS reads pace.w
          if (LIFE && MESH) e.push({ binding: 5, resource: { buffer: lcur } });   // ZIGLIFE: state → visible (arousal shrink / energy dim)
          return e;
        };
        this._sceneDraw = [
          device.createBindGroup({ layout: birdPipe.getBindGroupLayout(0), entries: sceneEntries(posB, velB, phB, lifeB) }),
          device.createBindGroup({ layout: birdPipe.getBindGroupLayout(0), entries: sceneEntries(posA, velA, phA, lifeA) })
        ];
        if (debris) debris.setView(scene.viewBuf);
        if (ribbon) ribbon.setView(scene.viewBuf);
        if (smoke) smoke.setView(scene.viewBuf);
        if (web) web.setView(scene.viewBuf);
        return this;
      },
      debris,
      ribbon,
      smoke,
      web,
      computeInto(enc, state) {
        this._packSim(state);
        const va = this._scene && this._scene._viewArr;
        if (debris) debris.update(state, va ? [va[16], va[17], va[18]] : [0, 90, 300]);
        gpu.ensureTargets();
        const s = sets[flip];
        const cp = enc.beginComputePass();
        cp.setPipeline(clearPipe); cp.setBindGroup(0, clearBG); cp.dispatchWorkgroups(Math.ceil(CELLS / 64));
        cp.setPipeline(buildPipe); cp.setBindGroup(0, s.grid); cp.dispatchWorkgroups(Math.ceil(this.count / 64));
        cp.setPipeline(stepPipe); cp.setBindGroup(0, s.step); cp.dispatchWorkgroups(Math.ceil(this.count / 64));
        if (PHASE) { cp.setPipeline(phasePipe); cp.setBindGroup(0, s.phase); cp.dispatchWorkgroups(Math.ceil(this.count / 64)); }
        if (web) {
          cp.setPipeline(web.nnPipe); cp.setBindGroup(0, web.nnBG[flip]); cp.dispatchWorkgroups(Math.ceil(this.count / 64));
          cp.setPipeline(web.ePipe); cp.setBindGroup(0, web.eBG[flip]); cp.dispatchWorkgroups(Math.ceil(this.count / 64));
        }
        cp.end();
      },
      recordInto(pass) {
        if (lanternPipe && !MESH) { pass.setPipeline(lanternPipe); pass.setBindGroup(0, sets[flip].lantern); pass.draw(6, this.count); flip ^= 1; if (debris) { pass.setPipeline(debris.pipe); pass.setBindGroup(0, debris.bg); pass.setVertexBuffer(0, debris.buf); pass.draw(debris.count * 6); } return; }
        pass.setPipeline(birdPipe); pass.setBindGroup(0, this._sceneDraw[flip]); pass.draw(this.vertsPerAgent, this.count);
        if (web) { pass.setPipeline(web.rPipe); pass.setBindGroup(0, web.rBG[flip]); pass.draw(6, this.count * web.k); }
        if (debris) { pass.setPipeline(debris.pipe); pass.setBindGroup(0, debris.bg); pass.setVertexBuffer(0, debris.buf); pass.draw(debris.count * 6); }
        flip ^= 1;
      },
      frame(state, viewArr) {
        this._packSim(state);
        device.queue.writeBuffer(viewBuf, 0, viewArr);
        if (debris) debris.update(state, [viewArr[16], viewArr[17], viewArr[18]]);

        gpu.ensureTargets();
        const s = sets[flip];
        const enc = device.createCommandEncoder();
        const cp = enc.beginComputePass();
        cp.setPipeline(clearPipe); cp.setBindGroup(0, clearBG); cp.dispatchWorkgroups(Math.ceil(CELLS / 64));
        cp.setPipeline(buildPipe); cp.setBindGroup(0, s.grid); cp.dispatchWorkgroups(Math.ceil(this.count / 64));
        cp.setPipeline(stepPipe); cp.setBindGroup(0, s.step); cp.dispatchWorkgroups(Math.ceil(this.count / 64));
        if (PHASE) { cp.setPipeline(phasePipe); cp.setBindGroup(0, s.phase); cp.dispatchWorkgroups(Math.ceil(this.count / 64)); }
        if (web) {
          cp.setPipeline(web.nnPipe); cp.setBindGroup(0, web.nnBG[flip]); cp.dispatchWorkgroups(Math.ceil(this.count / 64));   // WEB: find each agent's K nearest on the freshly-stepped positions
          cp.setPipeline(web.ePipe); cp.setBindGroup(0, web.eBG[flip]); cp.dispatchWorkgroups(Math.ceil(this.count / 64));            // WEB ENERGY: diffuse the note-pulse along the filaments + decay + inject
        }
        cp.end();

        const swapTex = gpu.context.getCurrentTexture();
        const swapView = swapTex.createView();
        const target = this._after ? this._after.sceneView() : swapView;   // MEMORY GLASS (opt-in)
        const rp = enc.beginRenderPass({
          colorAttachments: [{
            view: gpu.sampleCount > 1 ? gpu.msaaTex.createView() : target,
            resolveTarget: gpu.sampleCount > 1 ? target : undefined,
            clearValue: SELFCLEAR, loadOp: "clear", storeOp: gpu.sampleCount > 1 ? "discard" : "store"
          }],
          depthStencilAttachment: {
            view: gpu.depthTex.createView(),
            depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "discard"
          }
        });
        rp.setPipeline(skyPipe); rp.setBindGroup(0, skyBG); rp.draw(3);
        if (stage) { rp.setPipeline(stage.pipe); rp.setBindGroup(0, stage.bg); rp.draw(6); }   // THE VITRINE: the lit floor beneath the specimen (after sky, before shards)
        if (lanternPipe && !MESH) {
          /* Fireflies mode: points of additive light, not silhouettes */
          rp.setPipeline(lanternPipe); rp.setBindGroup(0, s.lantern); rp.draw(6, this.count);
        } else {
          rp.setPipeline(birdPipe); rp.setBindGroup(0, s.draw); rp.draw(this.vertsPerAgent, this.count);
        }
        if (web) { rp.setPipeline(web.rPipe); rp.setBindGroup(0, web.rBG[flip]); rp.draw(6, this.count * web.k); }   // WEB: connective filaments (after the shards → occluded behind nearer blades, weaving through the body)
        if (debris) { rp.setPipeline(debris.pipe); rp.setBindGroup(0, debris.bg); rp.setVertexBuffer(0, debris.buf); rp.draw(debris.count * 6); }
        if (ribbon && ribbon.count > 0) { rp.setPipeline(ribbon.pipe); rp.setBindGroup(0, ribbon.bg); rp.setVertexBuffer(0, ribbon.buf); rp.draw(ribbon.count); }
        if (smoke && smoke.count > 0) { rp.setPipeline(smoke.pipe); rp.setBindGroup(0, smoke.bg); rp.setVertexBuffer(0, smoke.buf); rp.draw(smoke.count); }
        rp.end();
        if (this._after) this._after.run(enc, swapView, state.dt);   // MEMORY GLASS: trail fold + blit, before capture

        /* frame readback — export capture / verification (one frame on request) */
        let cap = null;
        if (this._capResolve) {
          const w = gpu.w, h = gpu.h, bpr = Math.ceil(w * 4 / 256) * 256;
          const buf = device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
          enc.copyTextureToBuffer({ texture: swapTex }, { buffer: buf, bytesPerRow: bpr, rowsPerImage: h }, [w, h, 1]);
          cap = { buf, bpr, w, h, resolve: this._capResolve };
          this._capResolve = null;
        }
        device.queue.submit([enc.finish()]);
        if (cap) {
          cap.buf.mapAsync(GPUMapMode.READ).then(() => {
            const data = new Uint8Array(cap.buf.getMappedRange());
            const out = new Uint8ClampedArray(cap.w * cap.h * 4);
            for (let y = 0; y < cap.h; y++) out.set(data.subarray(y * cap.bpr, y * cap.bpr + cap.w * 4), y * cap.w * 4);
            cap.buf.unmap(); cap.buf.destroy();
            cap.resolve({ width: cap.w, height: cap.h, pixels: out, format: gpu.format });
          }).catch(e => cap.resolve({ error: String(e) }));
        }
        flip ^= 1;
      },
      _capResolve: null,
      _after: null,
      attachAfterimage(a) { this._after = a; return this; },   // MEMORY GLASS (standalone path)
      capture() { return new Promise((res) => { this._capResolve = res; }); },

      /* MEASURE — the flock's own centroid and radius, so a camera can frame
         itself. Reads a SUBSAMPLE of the rendered position buffer
         ASYNCHRONOUSLY: the caller gets last frame's answer and the hot path
         never waits. A camera eases anyway, so a measurement a few frames old is
         invisible. Returns false while a read is already in flight.

         The radius is the 93rd PERCENTILE, not the maximum — a handful of
         stragglers should not pull the camera back and shrink everything.

         (First written onto the wrong object entirely: it landed on the filament
         renderer's internals, so `flock.measure` never existed and the guard
         `flock && flock.measure` skipped it silently every frame. The HUD read
         `cam 48` with no arrow and nothing else complained. A method on the wrong
         object is invisible in exactly the way a typo is not.) */
      measure(cb, stride) {
        if (this._measuring) return false;
        this._measuring = true;
        const st = Math.max(1, (stride | 0) || 7);
        const n = Math.min(this.count || MAX, MAX);
        const bytes = n * 16;
        if (!this._mbuf || this._mbuf.size < bytes) {
          if (this._mbuf) this._mbuf.destroy();
          this._mbuf = device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        }
        const enc = device.createCommandEncoder();
        enc.copyBufferToBuffer(posB, 0, this._mbuf, 0, bytes);
        device.queue.submit([enc.finish()]);
        this._mbuf.mapAsync(GPUMapMode.READ).then(() => {
          const P = new Float32Array(this._mbuf.getMappedRange());
          let cx = 0, cy = 0, cz = 0, m = 0;
          for (let i = 0; i < n; i += st) { cx += P[i*4]; cy += P[i*4+1]; cz += P[i*4+2]; m++; }
          if (m) { cx /= m; cy /= m; cz /= m; }
          const ds = [];
          for (let i = 0; i < n; i += st) ds.push(Math.hypot(P[i*4]-cx, P[i*4+1]-cy, P[i*4+2]-cz));
          ds.sort((a, b) => a - b);
          const r = ds.length ? ds[Math.min(ds.length - 1, Math.floor(ds.length * 0.93))] : 0;
          this._mbuf.unmap();
          this._measuring = false;
          if (isFinite(r)) cb({ cx, cy, cz, r, n: m });
        }).catch(() => { this._measuring = false; });
        return true;
      }
    };
    return flock;
  };

  /* ========================================================================
     FOREST — the ROOTED archetype (the second great primitive).
     GPU-instanced anchored strands: each holdfast roots a tapering stipe that
     bends under a CURRENT vector — stiff at the base, loose at the tip. The
     sway is pure vertex work (no sim); the strand is a camera-facing ribbon so
     it always reads. Inherits the underwater light (depth-shift · caustics ·
     bioluminescent tips) straight from the shared View uniform, so a kelp
     forest is lit by the same god rays as the school. Reusable for seagrass,
     anemones, and grasses-in-wind (same system, air current).
     Instance data (vec4 per strand): rootX · rootZ · height · phase.
     ===================================================================== */
  /* ========================================================================
     FOREST v2 — the ROOTED archetype, ARTICULATED (movement ported from
     Kelp WebGL 036). The mesh is rebuilt on the CPU every frame: each stipe
     and blade is a segment chain whose direction accumulates from a stack of
     forces — upright stiffness, current lean, travelling-swell wave (breath by
     DELAY via Drive.tap), micro-eddies, buoyancy, surge, drape, carry — each
     clamped per segment. Blades TWIST (width narrows edge-on, widens flat) so a
     flat ribbon reads as a 3D being turning in the water. Floats (pneumatocysts),
     holdfast roots, and wear/aging included. Inherits the underwater light.
     ===================================================================== */
  const FOREST_WGSL = `
struct View {
  viewProj: mat4x4f, camPos: vec4f, camRight: vec4f, camUp: vec4f, camFwd: vec4f,
  sunDir: vec4f, skyTop: vec4f, skyMid: vec4f, horizon: vec4f, ground: vec4f,
  sunCol: vec4f, birdDark: vec4f, birdLight: vec4f, render: vec4f, render2: vec4f, render3: vec4f,
};
struct Forest { colStipe: vec4f, colBladeLo: vec4f, colBladeHi: vec4f, colFloat: vec4f };
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<uniform> F: Forest;

fn marineSnow(dir: vec3f) -> vec3f {
  let sp = dir.xy * 70.0 + vec2f(0.0, V.camPos.w * 0.5);
  let cell = floor(sp); let hh = fract(sin(dot(cell, vec2f(19.73, 83.11))) * 3571.31);
  let d = fract(sp) - 0.5; let mote = smoothstep(0.13, 0.0, length(d)) * step(0.86, hh);
  return vec3f(0.55, 0.62, 0.60) * mote * (0.35 + 0.65 * max(dir.y, 0.0));
}
fn waterColor(dir: vec3f) -> vec3f {
  let y = dir.y; let deep = V.skyTop.rgb; let mid = V.skyMid.rgb; let surf = V.horizon.rgb;
  var col = mix(mid, deep, smoothstep(0.0, -0.75, y));
  col = mix(col, surf, smoothstep(0.05, 0.85, y));
  let sd = normalize(V.sunDir.xyz); let s = max(dot(dir, sd), 0.0);
  col = mix(col, surf * 1.5 + V.sunCol.rgb * 0.35, smoothstep(0.82, 0.995, y));
  col += V.sunCol.rgb * pow(s, 90.0) * 0.6 * V.sunDir.w;
  let ang = atan2(dir.x, dir.z);
  let ripple = 0.55 + 0.45 * sin(ang * 16.0 + V.camPos.w * 0.35) * sin(ang * 6.3 - V.camPos.w * 0.21);
  col += V.sunCol.rgb * pow(max(y, 0.0), 1.4) * pow(s, 2.5) * ripple * V.render2.y;
  col += marineSnow(dir) * V.ground.w;
  return col;
}
fn caustic(p: vec2f, t: f32) -> f32 {
  let q = p * 0.14;
  var v = sin(q.x * 1.3 + t * 0.6) * sin(q.y * 1.1 - t * 0.5);
  v += 0.5 * sin(q.x * 2.7 - t * 0.42 + 1.3) * sin(q.y * 2.3 + t * 0.7);
  v += 0.25 * sin((q.x + q.y) * 3.9 + t * 0.9);
  return pow(clamp(v * 0.5 + 0.5, 0.0, 1.0), 3.0);
}
struct SkyOut { @builtin(position) cp: vec4f, @location(0) uv: vec2f };
@vertex fn skyVs(@builtin(vertex_index) vi: u32) -> SkyOut {
  var o: SkyOut; let xy = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  o.cp = vec4f(xy, 0.9999, 1.0); o.uv = xy; return o;
}
@fragment fn skyFs(inp: SkyOut) -> @location(0) vec4f {
  let dir = normalize(V.camFwd.xyz + V.camRight.xyz * inp.uv.x * V.camUp.w * V.camRight.w + V.camUp.xyz * inp.uv.y * V.camUp.w);
  return vec4f(waterColor(dir), 1.0);
}
struct KOut {
  @builtin(position) cp: vec4f,
  @location(0) t: f32, @location(1) light: f32, @location(2) kind: f32,
  @location(3) wear: f32, @location(4) depth: f32, @location(5) wpos: vec3f, @location(6) side: f32,
};
@vertex fn kelpVs(@location(0) aPos: vec3f, @location(1) aParam: vec4f, @location(2) aWear: f32) -> KOut {
  var o: KOut; o.cp = V.viewProj * vec4f(aPos, 1.0);
  o.t = aParam.x; o.side = aParam.y; o.light = aParam.z; o.kind = aParam.w; o.wear = aWear; o.wpos = aPos;
  o.depth = clamp((V.render3.x - aPos.y) / max(V.render3.y, 1.0), 0.0, 1.0);
  return o;
}
@fragment fn kelpFs(inp: KOut) -> @location(0) vec4f {
  let across = 1.0 - abs(inp.side);
  var col: vec3f; var alpha: f32;
  if (inp.kind < 0.5) {                       // STIPE
    col = mix(F.colStipe.rgb * 0.65, F.colStipe.rgb, inp.light);
    alpha = smoothstep(0.0, 0.30, across) * (0.85 + 0.15 * inp.depth);
  } else if (inp.kind < 1.5) {                // BLADE
    col = mix(F.colBladeLo.rgb, F.colBladeHi.rgb, inp.light);
    col = mix(col, vec3f(0.60, 0.47, 0.13), clamp(inp.wear, 0.0, 1.0) * 0.78);   // WEAR bleach
    alpha = smoothstep(0.0, 0.30, across) * (0.80 + 0.20 * inp.depth) * (1.0 - inp.wear * 0.30);
  } else if (inp.kind < 2.5) {                // FLOAT (pneumatocyst) — soft
    col = F.colFloat.rgb; alpha = across * across * (0.5 + 0.3 * inp.depth);
  } else {                                    // HOLDFAST — dark root
    col = vec3f(0.05, 0.07, 0.045) * (0.6 + 0.8 * inp.depth);
    alpha = smoothstep(0.0, 0.32, across) * (0.9 + 0.1 * inp.depth);
  }
  if (inp.kind < 1.5) {                        // light plays on stipe + blades
    let caus = caustic(inp.wpos.xz + inp.wpos.y * 0.3, V.camPos.w) * (1.0 - inp.depth);
    col += V.sunCol.rgb * caus * V.render2.z * 0.7;
    col += vec3f(0.13, 0.72, 0.98) * smoothstep(0.6, 1.0, inp.t) * V.render3.w * 0.9;   // biolum tips at night
  }
  let waterAtDepth = mix(V.horizon.rgb, V.skyTop.rgb, inp.depth);
  col = mix(col, waterAtDepth, inp.depth * V.render2.w);
  return vec4f(col, alpha);
}`;

  ZigWebGPU.createForest = function (gpu, opts) {
    opts = opts || {};
    /* GROUND 0.1.0 — same as createFlock: its own closure, its own resolution. */
    const SELFCLEAR = (function () {
      const Z = global.ZigCore && global.ZigCore.Ground;
      const g = opts.ground ? (typeof opts.ground === "string" ? (Z ? Z.resolve(opts.ground) : null) : opts.ground) : null;
      return (g && g.sky && g.lift > 0)
        ? { r: g.sky.mid[0], g: g.sky.mid[1], b: g.sky.mid[2], a: 1 }
        : { r: 0, g: 0, b: 0, a: 1 };
    })();
    const device = gpu.device;
    const G = global.ZigCore;
    const rng = G ? G.rng(opts.seed || 0xC0FFEE) : Math.random;
    const cfg = { TWIST: 0.7, LIFT_GAIN: 1.7, WAVE_AMP: 0.16, WAVE_FREQ: 1.1, EDDY: 0.13,
      MICRO: 0.17, MSCALE: 12.6, STIPE_STIFF: 0.35, STIPE_LEAN: 0.11, STIPE_FLEX: 1.2,
      BUOY: 0.13, DRAPE: 0.18, SURGE: 0.6, CARRY: 0.55, BLADE_LAG: 0.10, STIPE_LAG: 0.07 };
    const STSEG = 14, BLSEG = 8, HFSEG = 5;
    const floorY = opts.floorY != null ? opts.floorY : 8;
    const spread = opts.spread || 130;
    const hMin = opts.heightMin || 120, hMax = opts.heightMax || 168;

    /* ---- build the persistent plant structures (once) ---- */
    const NP = Math.min(opts.count || 34, opts.max || 400);
    const plants = [];
    for (let i = 0; i < NP; i++) {
      const scl = 0.7 + 0.6 * rng();
      const nB = (opts.blades || 12) + Math.floor(rng() * 5) - 2;
      const blades = [];
      for (let k = 0; k < nB; k++) {
        blades.push({ tA: 0.10 + 0.86 * (k / Math.max(1, nB - 1)) + (rng() - 0.5) * 0.05,
          az: rng() * 6.283, elev: 0.5 + rng() * 0.7, len: (18 + 10 * rng()) * scl,
          baseW: (1.1 + 0.6 * rng()) * scl, wf: 0.9 + rng() * 0.8, phase: rng() * 6.283,
          twp: rng() * 6.283, buoy: 0.4 + rng() * 0.6, delayF: (2 + rng() * 45) / 60,
          wear: rng() < 0.3 ? 0.3 + rng() * 0.5 : 0, elder: false });
      }
      const nSp = 4 + Math.floor(rng() * 4);       // sporophylls at base
      for (let s = 0; s < nSp; s++)
        blades.push({ tA: 0.03 + rng() * 0.10, az: rng() * 6.283, elev: 0.3 + rng() * 0.5,
          len: (7 + 4 * rng()) * scl, baseW: 0.9 * scl, wf: 0.9 + rng() * 0.7, phase: rng() * 6.283,
          twp: rng() * 6.283, buoy: 0.15, delayF: (2 + rng() * 45) / 60, wear: 0, elder: false });
      const haptera = [];
      const nn = 7 + Math.floor(rng() * 5);
      for (let n = 0; n < nn; n++) haptera.push({ az: rng() * 6.283, dip: -0.2 - rng() * 1.1,
        len: (5 + 6 * rng()) * scl, w: 0.6 + 0.5 * rng(), curl: (rng() - 0.5) * 1.6 });
      // few towers → deliberate framing placement (sides); many → scattered forest
      let rootX, rootZ;
      if (NP <= 3) { rootX = (i - (NP - 1) / 2) * spread * 1.5 + (rng() - 0.5) * 12; rootZ = (rng() - 0.5) * 30 - 15; }
      else { rootX = (rng() - 0.5) * 2 * spread; rootZ = (rng() - 0.5) * 2 * spread; }
      plants.push({ rootX, rootZ,
        height: (hMin + rng() * (hMax - hMin)), stipeW: (1.3 + 0.6 * rng()) * scl,
        rest: (rng() * 2 - 1) * 0.2, wf: 0.4 + rng() * 0.4, phase: rng() * 6.283,
        leanGain: 0.6 + rng() * 0.5, delayF: (2 + rng() * 40) / 60, scl, blades, haptera });
    }
    for (let e = 0; e < Math.min(3, NP); e++) {   // elder fronds: dark, torn, late
      const p = plants[Math.floor(rng() * NP)]; if (!p.blades.length) continue;
      const b = p.blades[Math.floor(rng() * p.blades.length)];
      b.elder = true; b.wear = 0.85; b.baseW *= 1.4; b.delayF += 70 / 60;
    }

    /* ---- GPU buffers ---- */
    const maxVerts = NP * (STSEG * 6 + 20 * (BLSEG * 6 + 6) + 12 * HFSEG * 6) + 512;
    const vbuf = new Float32Array(maxVerts * 8);
    const vertBuf = device.createBuffer({ size: vbuf.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    const viewBuf = device.createBuffer({  size: 112 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });   // 112: +noteBands[6] strata (v0.32) +render6 note flash (v0.43) — a flock may bind this scene's view
    const forestBuf = device.createBuffer({ size: 16 * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const fp = new Float32Array(16);
    const mod = device.createShaderModule({ code: FOREST_WGSL });
    const skyPipe = device.createRenderPipeline({ layout: "auto",
      vertex: { module: mod, entryPoint: "skyVs" },
      fragment: { module: mod, entryPoint: "skyFs", targets: [{ format: gpu.format }] },
      primitive: { topology: "triangle-list" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "always" },
      multisample: { count: gpu.sampleCount } });
    const kelpPipe = device.createRenderPipeline({ layout: "auto",
      vertex: { module: mod, entryPoint: "kelpVs", buffers: [{ arrayStride: 32, attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x4" },
        { shaderLocation: 2, offset: 28, format: "float32" }] }] },
      fragment: { module: mod, entryPoint: "kelpFs", targets: [{ format: gpu.format }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
      multisample: { count: gpu.sampleCount, alphaToCoverageEnabled: gpu.sampleCount > 1 } });
    const skyBG = device.createBindGroup({ layout: skyPipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: viewBuf } }] });
    const mkKelpBG = (vb) => device.createBindGroup({ layout: kelpPipe.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: vb } }, { binding: 1, resource: { buffer: forestBuf } }] });
    let kelpBG = mkKelpBG(viewBuf);

    /* ---- CPU articulation (ported from 036, into 3D) ---- */
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const micro = (x, y, seed, t) => Math.sin(x * cfg.MSCALE + y * cfg.MSCALE * 0.7 + t * 1.7 + seed)
      + 0.55 * Math.sin(x * cfg.MSCALE * 1.9 - y * cfg.MSCALE * 1.3 + t * 2.6 + seed * 1.7);
    let vi = 0;
    const P = []; const LI = []; const WI = []; const WA = [];  // spine pts · light · width · real-3D width axis
    function push(x, y, z, t, side, light, kind, wear) {
      const o = vi * 8; vbuf[o] = x; vbuf[o + 1] = y; vbuf[o + 2] = z;
      vbuf[o + 3] = t; vbuf[o + 4] = side; vbuf[o + 5] = light; vbuf[o + 6] = kind; vbuf[o + 7] = wear; vi++;
    }
    /* ribbon: if `real3d`, use the precomputed 3D twisting width axes in WA[]
       (blades read as genuine 3D straps — orbit reveals flat↔edge); else the
       axis is camera-facing (fine for the ~cylindrical stipe & holdfast). */
    function ribbon(N, kind, wear, eye, real3d) {
      for (let i = 0; i < N; i++) {
        const a = P[i], b = P[i + 1];
        let wx, wy, wz;
        if (real3d) {
          const A0 = WA[i], A1 = WA[i + 1] || WA[i];
          // per-vertex axis; use i's axis for the a-end, i+1's for the b-end below
          wx = A0[0]; wy = A0[1]; wz = A0[2];
          var wx1 = A1[0], wy1 = A1[1], wz1 = A1[2];
        } else {
          let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
          const mx = (a[0] + b[0]) * 0.5, my = (a[1] + b[1]) * 0.5, mz = (a[2] + b[2]) * 0.5;
          let cx = eye[0] - mx, cy = eye[1] - my, cz = eye[2] - mz;
          wx = dy * cz - dz * cy; wy = dz * cx - dx * cz; wz = dx * cy - dy * cx;
          const wl = Math.hypot(wx, wy, wz) || 1; wx /= wl; wy /= wl; wz /= wl;
          var wx1 = wx, wy1 = wy, wz1 = wz;
        }
        const w0 = WI[i], w1 = WI[i + 1], l0 = LI[i], l1 = LI[i + 1], t0 = i / N, t1 = (i + 1) / N;
        const L0 = [a[0] + wx * w0, a[1] + wy * w0, a[2] + wz * w0], R0 = [a[0] - wx * w0, a[1] - wy * w0, a[2] - wz * w0];
        const L1 = [b[0] + wx1 * w1, b[1] + wy1 * w1, b[2] + wz1 * w1], R1 = [b[0] - wx1 * w1, b[1] - wy1 * w1, b[2] - wz1 * w1];
        push(L0[0], L0[1], L0[2], t0, -1, l0, kind, wear); push(R0[0], R0[1], R0[2], t0, 1, l0, kind, wear); push(L1[0], L1[1], L1[2], t1, -1, l1, kind, wear);
        push(R0[0], R0[1], R0[2], t0, 1, l0, kind, wear); push(R1[0], R1[1], R1[2], t1, 1, l1, kind, wear); push(L1[0], L1[1], L1[2], t1, -1, l1, kind, wear);
      }
    }
    function quad(cx, cy, cz, r, kind, eye) {       // camera-facing soft quad (floats)
      let ex = eye[0] - cx, ey = eye[1] - cy, ez = eye[2] - cz;
      const el = Math.hypot(ex, ey, ez) || 1; ex /= el; ey /= el; ez /= el;
      let rx = ey * 0 - ez * 0, ry = ez * 1 - ex * 0, rz = ex * 0 - ey * 1;  // up=(0,1,0)
      rx = ey * 0 - ez * 1; ry = ez * 0 - ex * 0; rz = ex * 1 - ey * 0;      // cross(toCam,up)
      const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
      const ux = ey * rz - ez * ry, uy = ez * rx - ex * rz, uz = ex * ry - ey * rx;
      const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]], I = [0, 1, 2, 0, 2, 3];
      for (let n = 0; n < 6; n++) { const u = C[I[n]][0], w = C[I[n]][1];
        push(cx + (rx * u + ux * w) * r, cy + (ry * u + uy * w) * r, cz + (rz * u + uz * w) * r, 0.5, u, 0.6, kind, 0); }
    }

    const forest = {
      MAX: opts.max || 400, count: NP, plants,
      _build(state, viewArr) {
        vi = 0;
        const eye = [viewArr[16], viewArr[17], viewArr[18]], t = viewArr[19];
        const cx = state.current[0], cz = state.current[1];
        const hMag = Math.hypot(cx, cz); const hx = hMag > 1e-4 ? cx / hMag : 1, hz = hMag > 1e-4 ? cz / hMag : 0;
        const tap = (G && G.Drive) ? (s) => G.Drive.tap(s) : () => 0.3;
        for (const p of plants) {
          const rx = p.rootX, rz = p.rootZ;
          /* holdfast */
          for (const g of p.haptera) {
            const gx = Math.cos(g.az), gz = Math.sin(g.az); let px = rx, py = floorY, pz = rz, ang = g.dip;
            for (let k = 0; k <= HFSEG; k++) { P[k] = [px, py, pz]; LI[k] = 0.2 + 0.3 * p.scl; WI[k] = g.w * (1 - k / HFSEG * 0.85);
              ang += g.curl * 0.09; const step = g.len / HFSEG; px += gx * Math.cos(ang) * step; py += Math.sin(ang) * step; pz += gz * Math.cos(ang) * step; }
            ribbon(HFSEG, 3, 0, eye);
          }
          /* stipe — articulated chain in the current's vertical plane */
          let X = 0, Y = 0, ang = Math.PI / 2 + p.rest * 0.25;
          const flex = cfg.STIPE_FLEX, stiff = cfg.STIPE_STIFF / flex;
          const seg = p.height / STSEG;
          for (let i = 0; i <= STSEG; i++) {
            const wx = rx + hx * X, wy = floorY + Y, wz = rz + hz * X;
            P[i] = [wx, wy, wz];
            const sw = tap(p.delayF + i * cfg.STIPE_LAG);
            const lift = Math.min(1, sw * cfg.LIFT_GAIN);
            LI[i] = Math.min(1, 0.22 + 0.6 * sw + 0.35 * p.scl * 0.5); WI[i] = p.stipeW * (1 - 0.5 * i / STSEG);
            const tn = i / STSEG;
            const upright = Math.sin(Math.PI / 2 - ang) * stiff * (1 - 0.6 * tn);
            const lean = (p.rest + hMag * (0.4 + 0.9 * lift) * p.leanGain) * cfg.STIPE_LEAN * flex;
            const wave = Math.sin(t * p.wf + p.phase - i * 0.6) * (0.04 + 0.16 * lift) * flex;
            const mic = micro(wx * 0.01, wy * 0.01, p.phase + 2, t) * cfg.MICRO * 0.13 * flex;
            let dA = upright + lean + wave + mic; dA = clamp(dA, -0.42, 0.42); ang += dA;
            X += Math.cos(ang) * seg; Y += Math.sin(ang) * seg;
          }
          ribbon(STSEG, 0, 0, eye);
          /* blades — each flows out on its own azimuth, sways + twists */
          for (const b of p.blades) {
            const ia = Math.min(STSEG - 1, Math.floor(b.tA * STSEG)), fr = b.tA * STSEG - ia;
            const A = [P[ia][0] + (P[ia + 1][0] - P[ia][0]) * fr, P[ia][1] + (P[ia + 1][1] - P[ia][1]) * fr, P[ia][2] + (P[ia + 1][2] - P[ia][2]) * fr];
            const bx = Math.cos(b.az), bz = Math.sin(b.az);
            const perp = [-Math.sin(b.az), 0, Math.cos(b.az)];   // horizontal, ⟂ to the blade's plane
            let bX = 0, bY = 0, ang2 = b.elev;
            const wr = Math.min(1.2, b.wear), bLen = b.len * (1 - Math.min(0.6, wr) * 0.3), bseg = bLen / BLSEG;
            for (let k = 0; k <= BLSEG; k++) {
              const carry = hMag * cfg.CARRY * (0.3 + 0.7 * k / BLSEG);
              const wpx = A[0] + bx * bX + hx * carry, wpy = A[1] + bY, wpz = A[2] + bz * bX + hz * carry;
              P[k] = [wpx, wpy, wpz];
              const sw = tap(b.delayF + k * cfg.BLADE_LAG + b.tA * 0.16);
              const eddy = Math.sin(t * b.wf + b.phase + k * 0.6) * cfg.EDDY;
              const water = Math.max(0, sw + eddy), lift = Math.min(1, water * cfg.LIFT_GAIN);
              const buoyR = Math.sin(b.elev - ang2) * cfg.BUOY * (0.6 + 0.8 * b.buoy);
              const drape = Math.sin(-1.5708 - ang2) * cfg.DRAPE * (k / BLSEG) * (1 - lift);
              const surge = Math.sin(1.5708 - ang2) * (0.75 * lift + 0.25) * cfg.SURGE * (0.5 + 0.9 * b.buoy);
              const wave = Math.sin(t * cfg.WAVE_FREQ + b.phase - k * 0.8) * lift * cfg.WAVE_AMP;
              const mic = micro(wpx * 0.01, wpy * 0.01, b.phase, t) * cfg.MICRO * 0.09 * (0.5 + lift);
              let dA = buoyR + drape + surge + wave + mic; dA = clamp(dA, -0.42, 0.42); ang2 += dA;
              let lg = Math.min(1, 0.24 + 0.6 * lift + 0.26 * p.scl * 0.5); if (b.elder) lg *= 0.55;
              LI[k] = lg;
              const tn = k / BLSEG;
              // REAL 3D TWIST: rotate the strap's width axis around its long axis.
              // long axis ≈ the blade direction in its plane (cos·[bx,0,bz] + sin·up)
              const ca = Math.cos(ang2), sa = Math.sin(ang2);
              const lx = bx * ca, ly = sa, lz = bz * ca;                     // blade forward
              // n = normalize(cross(long, perp)) — the strap's other face axis
              let nx = ly * perp[2] - lz * perp[1], ny = lz * perp[0] - lx * perp[2], nz = lx * perp[1] - ly * perp[0];
              const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
              const tw = b.twp + t * 0.4 + k * 0.34 + micro(wpx * 0.01, wpy * 0.01, b.phase + 7, t) * 0.5;
              const ct = Math.cos(tw), st = Math.sin(tw);
              WA[k] = [perp[0] * ct + nx * st, perp[1] * ct + ny * st, perp[2] * ct + nz * st];
              const taper = Math.sin(Math.pow(tn, 0.7) * Math.PI) * 1.1 + 0.12;
              let w = b.baseW * taper;                                       // constant strap; the TWIST is real rotation now
              if (wr > 0) w *= (1 - Math.min(0.85, wr) * 0.6 * tn * tn);
              WI[k] = w;
              bX += Math.cos(ang2) * bseg; bY += Math.sin(ang2) * bseg;
            }
            ribbon(BLSEG, 1, wr, eye, true);   // real-3D twisting strap
            if (!b.elder && b.buoy > 0.3) quad(A[0], A[1], A[2], b.buoy * 1.2 * p.scl, 2, eye);   // float at base
          }
        }
        return vi;
      },
      _packForest(s) {
        fp.set(s.colStipe, 0); fp.set(s.colBladeLo, 4); fp.set(s.colBladeHi, 8); fp.set(s.colFloat, 12);
        device.queue.writeBuffer(forestBuf, 0, fp);
      },
      _scene: null,
      attachScene(scene) { this._scene = scene; kelpBG = mkKelpBG(scene.viewBuf); return this; },
      computeInto(enc, state) {           // rooted — rebuild the mesh against the shared view + upload
        this._packForest(state);
        const va = this._scene ? this._scene._viewArr : null;
        if (va) { const n = this._build(state, va); device.queue.writeBuffer(vertBuf, 0, vbuf, 0, n * 8); }
      },
      recordInto(pass) { pass.setPipeline(kelpPipe); pass.setBindGroup(0, kelpBG); pass.setVertexBuffer(0, vertBuf); pass.draw(vi); },
      frame(state, viewArr) {
        this._packForest(state);
        device.queue.writeBuffer(viewBuf, 0, viewArr);
        const n = this._build(state, viewArr);
        device.queue.writeBuffer(vertBuf, 0, vbuf, 0, n * 8);
        gpu.ensureTargets();
        const enc = device.createCommandEncoder();
        const swapView = gpu.context.getCurrentTexture().createView();
        const rp = enc.beginRenderPass({
          colorAttachments: [{
            view: gpu.sampleCount > 1 ? gpu.msaaTex.createView() : swapView,
            resolveTarget: gpu.sampleCount > 1 ? swapView : undefined,
            clearValue: SELFCLEAR, loadOp: "clear", storeOp: gpu.sampleCount > 1 ? "discard" : "store"
          }],
          depthStencilAttachment: { view: gpu.depthTex.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "discard" }
        });
        rp.setPipeline(skyPipe); rp.setBindGroup(0, skyBG); rp.draw(3);
        rp.setPipeline(kelpPipe); rp.setBindGroup(0, kelpBG); rp.setVertexBuffer(0, vertBuf); rp.draw(n);
        rp.end();
        device.queue.submit([enc.finish()]);
      }
    };
    return forest;
  };

})(typeof window !== "undefined" ? window : globalThis);

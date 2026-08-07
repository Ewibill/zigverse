/* =============================================================================
   ZigMesh — parametric agent geometry (ENGINE module, additive)
   v0.1 · classic script · exposes a global `ZigMesh`
   Load anywhere after zigcore.js; zero DOM, zero GPU — pure arrays.

   THE IDEA (Fireflies build, 2026-07): stop hand-carving agent meshes.
   Bird and fish were hardcoded WGSL arrays; every new silhouette meant new
   engineering. ZigMesh makes agent SHAPE a set of numbers, so species pick a
   point in shape-space and the pareidolia becomes tunable:
     · length/width — the stroke's proportions
     · curve        — crescent bow of the spine (sickle-ness)
     · twist        — total roll along the length; sweeps highlights as it turns
     · taper        — tip asymmetry: 0 = blunt/blunt … 1 = blunt/drawn-out
     · camber       — cross-section cup: dome one side, hollow the other
   One generator → sickle-petal, ribbon, ember-ish blob, moth wing, and the
   old bird/fish registers are all presets, not projects.

   Output is renderer-ready, non-indexed triangles:
     ZigMesh.shard(opts) → { pos: Float32Array(v*3), nrm: Float32Array(v*3),
                             side: Float32Array(v),  u: Float32Array(v),
                             verts: v }
     side ∈ [-1..1] across the width (edge shading) · u ∈ [0..1] along length.
   Winding: counter-clockwise seen from the dome (+normal) side, so
   front_facing in a shader = the dorsal face.
   ========================================================================== */
(function (global) {
  "use strict";
  const ZigMesh = global.ZigMesh || (global.ZigMesh = {});
  ZigMesh.VERSION = "0.6.0";   // 0.3: SECOND ALPHABET · 0.3.1: MINT · 0.4: WARDROBE · 0.5: SHELL · 0.6: THIRD SET (thorn·plume·drop·crook·scallop·burr — 20 letterforms)

  const V3 = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    scl: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1e-9; return [a[0] / l, a[1] / l, a[2] / l]; }
  };

  ZigMesh.shard = function (opts) {
    const o = Object.assign({
      segs: 14, length: 1.8, width: 0.42,
      curve: 0.34, twist: 1.35, taper: 0.72, camber: 0.30
    }, opts || {});
    const S = Math.max(3, o.segs | 0);

    /* width profile — a beta-ish lobe. taper skews it: one tip blunt, the
       other drawn long (asymmetry is what makes every orientation legible). */
    const ta = 0.38 + 0.34 * (1 - o.taper);        // start-tip fullness
    const tb = 0.85 + 1.75 * o.taper;              // end-tip draw
    const wRaw = (u) => Math.pow(Math.max(u, 0), ta) * Math.pow(Math.max(1 - u, 0), tb);
    let wMax = 1e-9;
    for (let i = 0; i <= 64; i++) wMax = Math.max(wMax, wRaw(i / 64));
    const halfW = (u) => o.width * wRaw(u) / wMax;

    /* spine — bowed in z (the sickle), param along x */
    const spine = (u) => [(u - 0.5) * o.length, 0, o.curve * Math.sin(Math.PI * u)];

    /* THICKNESS — o.thickness>0 adds a BACK centre that dips below the edges, closing
       the cross-section into a thin solid LENS (thick in the middle, sharp at the edges)
       so the blade reads as matter, not foil. 0 = the original single cambered sheet. */
    const TH = Math.max(0, o.thickness || 0);
    /* back-centre offset along the face normal: CONVEX (default) bulges the back AWAY
       (−TH → a biconvex lens) · HOLLOW curves it the SAME way as the front, just shy of
       the front dome (a thin cupped SHELL, concave underside). */
    const backOff = o.hollow ? Math.min(TH, o.camber * 0.9) : -TH;

    /* stations: local frame + rows (edge+ · front centre · edge− · back centre) */
    const P = [], N = [], SD = [], UU = [];
    const rows = [];
    for (let s = 0; s <= S; s++) {
      const u = s / S;
      const eps = 0.5 / S;
      const T = V3.norm(V3.sub(spine(Math.min(u + eps, 1)), spine(Math.max(u - eps, 0))));
      let lat0 = V3.norm(V3.cross([0, 1, 0], T));   // lateral, ⊥ spine, ~z-ish
      const th = o.twist * (u - 0.5);
      /* Rodrigues about T (lat0 ⊥ T): lat = lat0·cosθ + (T×lat0)·sinθ */
      const lat = V3.norm(V3.add(V3.scl(lat0, Math.cos(th)), V3.scl(V3.cross(T, lat0), Math.sin(th))));
      const n0 = V3.norm(V3.cross(T, lat));         // face normal (dome side)
      const h = halfW(u), c = spine(u);
      const tilt = 1.25 * o.camber;                 // edge normals lean outward on the dome
      const nb0 = V3.scl(n0, -1);
      rows.push({
        eP: V3.add(c, V3.scl(lat, h)),                    // edge +
        cF: V3.add(c, V3.scl(n0, o.camber * h)),          // front (cambered) centre
        eM: V3.sub(c, V3.scl(lat, h)),                    // edge −
        cB: V3.add(c, V3.scl(n0, backOff * h)),           // back centre — convex (−TH, bulges back) or hollow (toward front, a cup)
        nEPf: V3.norm(V3.add(n0, V3.scl(lat, tilt))), nCf: n0, nEMf: V3.norm(V3.sub(n0, V3.scl(lat, tilt))),
        nEPb: V3.norm(V3.add(nb0, V3.scl(lat, tilt))), nCb: nb0, nEMb: V3.norm(V3.sub(nb0, V3.scl(lat, tilt))),
        u
      });
    }

    const pv = (p, n, sd, uu) => { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); SD.push(sd); UU.push(uu); };
    const quad = (A, B, C, D) => { pv(...A); pv(...B); pv(...C); pv(...A); pv(...C); pv(...D); };   // tris ABC · ACD
    for (let s = 0; s < S; s++) {
      const r0 = rows[s], r1 = rows[s + 1];
      /* FRONT dome (CCW from the dome side) — edge+→centre, centre→edge− */
      quad([r0.eP, r0.nEPf, 1, r0.u], [r0.cF, r0.nCf, 0, r0.u], [r1.cF, r1.nCf, 0, r1.u], [r1.eP, r1.nEPf, 1, r1.u]);
      quad([r0.cF, r0.nCf, 0, r0.u], [r0.eM, r0.nEMf, -1, r0.u], [r1.eM, r1.nEMf, -1, r1.u], [r1.cF, r1.nCf, 0, r1.u]);
      if (TH > 0) {
        /* BACK dome (reverse winding so it faces the other way) — edge−→back, back→edge+ */
        quad([r1.eM, r1.nEMb, -1, r1.u], [r1.cB, r1.nCb, 0, r1.u], [r0.cB, r0.nCb, 0, r0.u], [r0.eM, r0.nEMb, -1, r0.u]);
        quad([r1.cB, r1.nCb, 0, r1.u], [r1.eP, r1.nEPb, 1, r1.u], [r0.eP, r0.nEPb, 1, r0.u], [r0.cB, r0.nCb, 0, r0.u]);
      }
    }

    return {
      pos: new Float32Array(P), nrm: new Float32Array(N),
      side: new Float32Array(SD), u: new Float32Array(UU),
      verts: SD.length, params: o
    };
  };

  /* ---- arc — the second generator: a ribbon swept along a CIRCULAR arc ----
     One new dial (sweep) covers a family: 0.7 rad = a petal · π = a crescent
     moon · 5.5 rad = the HALO, a broken ring. The hole is the feature:
     transmission, lace, moiré — the first letter light passes THROUGH.      */
  ZigMesh.arc = function (opts) {
    const o = Object.assign({
      gen: "arc", segs: 18, radius: 0.72, sweep: 5.5, width: 0.20,
      twist: 0.8, taper: 0.6, camber: 0.35
    }, opts || {});
    const S = Math.max(4, o.segs | 0);
    const ta = 0.38 + 0.34 * (1 - o.taper), tb = 0.85 + 1.75 * o.taper;
    const wRaw = (u) => Math.pow(Math.max(u, 0), ta) * Math.pow(Math.max(1 - u, 0), tb);
    let wMax = 1e-9;
    for (let i = 0; i <= 64; i++) wMax = Math.max(wMax, wRaw(i / 64));
    const halfW = (u) => o.width * wRaw(u) / wMax;

    const rows = [];
    for (let s = 0; s <= S; s++) {
      const u = s / S;
      const a = (u - 0.5) * o.sweep;
      const c = [Math.cos(a) * o.radius, 0, Math.sin(a) * o.radius];
      const T = [-Math.sin(a), 0, Math.cos(a)];
      const lat0 = [Math.cos(a), 0, Math.sin(a)];      // radial, ⊥ tangent
      const th = o.twist * (u - 0.5);
      const lat = V3.norm(V3.add(V3.scl(lat0, Math.cos(th)), V3.scl(V3.cross(T, lat0), Math.sin(th))));
      const n0 = V3.norm(V3.cross(T, lat));
      const h = halfW(u), tilt = 1.25 * o.camber;
      rows.push({
        p: [V3.add(c, V3.scl(lat, h)), V3.add(c, V3.scl(n0, o.camber * h)), V3.sub(c, V3.scl(lat, h))],
        n: [V3.norm(V3.add(n0, V3.scl(lat, tilt))), n0, V3.norm(V3.sub(n0, V3.scl(lat, tilt)))],
        u
      });
    }
    const P = [], N = [], SD = [], UU = [];
    const emit = (r0, r1, a2, b2) => {
      const q = [[r0, a2], [r0, b2], [r1, b2], [r0, a2], [r1, b2], [r1, a2]];
      for (const [r, ccol] of q) {
        const R = rows[r];
        P.push(...R.p[ccol]); N.push(...R.n[ccol]);
        SD.push(ccol === 0 ? 1 : (ccol === 1 ? 0 : -1)); UU.push(R.u);
      }
    };
    for (let s = 0; s < S; s++) { emit(s, s + 1, 0, 1); emit(s, s + 1, 1, 2); }
    return { pos: new Float32Array(P), nrm: new Float32Array(N),
             side: new Float32Array(SD), u: new Float32Array(UU),
             verts: SD.length, params: o };
  };

  /* ---- shell — the THIRD generator (v0.5, 2026-07-22): closed forms -------
     A spherical cap — the bubble phylum. The mouth is the feature (a fully
     closed shell reads as a bead; the opening keeps it FILM): both faces
     stay visible, light enters, the flip survives. squash makes it oblate,
     swirl twists the columns like soap currents, and breathe (carried on
     params) lets the engine give each letter its own micro-membrane pulse.
     One generator = bubbles, domes, jellyfish bells, mushroom caps.        */
  ZigMesh.shell = function (opts) {
    const o = Object.assign({
      gen: "shell", segs: 8, rings: 14, radius: 0.62, sweep: 2.25,
      squash: 0.92, swirl: 0.7, breathe: 0
    }, opts || {});
    const S = Math.max(3, o.segs | 0), R = Math.max(6, o.rings | 0);
    const b2 = Math.max(o.squash * o.squash, 1e-6);
    const st = (t, p) => {
      const u = t / S;
      const th = 0.05 + (o.sweep - 0.05) * u;            // whisper of a pole hole — no degenerate fan
      const ph = (p / R) * 6.283185307 + o.swirl * u;    // soap swirl
      const sx = Math.sin(th) * Math.cos(ph), sy = Math.cos(th), sz = Math.sin(th) * Math.sin(ph);
      return {
        p: [o.radius * sx, o.radius * o.squash * sy, o.radius * sz],
        n: V3.norm([sx, sy / b2 * o.squash, sz]),        // ellipsoid gradient
        u, sd: u * 2 - 1                                 // the rim is the EDGE (occlusion + copper live there)
      };
    };
    const P = [], N = [], SD = [], UU = [];
    const push = (v) => { P.push(...v.p); N.push(...v.n); SD.push(v.sd); UU.push(v.u); };
    for (let t = 0; t < S; t++) {
      for (let p = 0; p < R; p++) {
        const a = st(t, p), b = st(t, p + 1), c = st(t + 1, p + 1), d = st(t + 1, p);
        push(a); push(c); push(d); push(a); push(b); push(c);   // CCW from outside — dome face out
      }
    }
    return { pos: new Float32Array(P), nrm: new Float32Array(N),
             side: new Float32Array(SD), u: new Float32Array(UU),
             verts: SD.length, params: o };
  };

  /* ---- make — one door for every generator ------------------------------- */
  /* gen:"merge" (v0.3, Scout's second alphabet): COMPOSITE presets — a spec
     whose parts are themselves specs (with pos/rotY/scale). One body, many
     voices: a bell with its ember, a seed of two almost-mirrored shards.
     opts.refine (v0.3.1, THE MINT): multiply station count without touching
     the DNA — ×1 cut gem · ×2 polished · ×3 blown glass. Same letter, finer
     cloth. Recurses through composites. Capped at 48 stations per part.    */
  ZigMesh.make = function (spec, opts) {
    const s = spec || {};
    const rf = Math.max(1, Math.floor((opts && opts.refine) || 1));
    if (s.gen === "merge") {
      return ZigMesh.merge(s.parts.map((p) => ({
        mesh: ZigMesh.make(p.spec, opts), pos: p.pos, rotY: p.rotY, rotX: p.rotX, scale: p.scale
      })));
    }
    const s2 = Object.assign({}, s, rf === 1 ? {} : { segs: Math.min(48, (s.segs || 14) * rf) });
    if (opts && opts.thickness != null && s2.thickness == null) s2.thickness = opts.thickness;   // global THICKNESS unless the preset sets its own
    if (opts && opts.hollow != null && s2.hollow == null) s2.hollow = opts.hollow;               // HOLLOW: back curves as a concave shell instead of a convex lens
    if (s2.gen === "shell") return ZigMesh.shell(s2);
    return s2.gen === "arc" ? ZigMesh.arc(s2) : ZigMesh.shard(s2);
  };

  /* ---- merge — compose shards into COMPOUND letters (twigs, crosses…) ----- */
  ZigMesh.merge = function (parts) {
    const P = [], N = [], SD = [], UU = [];
    for (const part of parts) {
      const m = part.mesh, ry = part.rotY || 0, rx = part.rotX || 0, sc = part.scale || 1, off = part.pos || [0, 0, 0];
      const c = Math.cos(ry), s = Math.sin(ry);
      const cx = Math.cos(rx), sx = Math.sin(rx);
      for (let i = 0; i < m.verts; i++) {
        let x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2];
        let y2 = y * cx - z * sx, z2 = y * sx + z * cx; y = y2; z = z2;   // rotX first (the orb needs crossed rings)
        P.push((x * c + z * s) * sc + off[0], y * sc + off[1], (-x * s + z * c) * sc + off[2]);
        let nx = m.nrm[i * 3], ny = m.nrm[i * 3 + 1], nz = m.nrm[i * 3 + 2];
        const ny2 = ny * cx - nz * sx, nz2 = ny * sx + nz * cx; ny = ny2; nz = nz2;
        N.push(nx * c + nz * s, ny, -nx * s + nz * c);
        SD.push(m.side[i]); UU.push(m.u[i]);
      }
    }
    return { pos: new Float32Array(P), nrm: new Float32Array(N),
             side: new Float32Array(SD), u: new Float32Array(UU), verts: SD.length };
  };

  /* ---- toWGSL — bake a mesh into shader-source private arrays -------------
     The flock kernel splices this in when a species supplies opts.mesh:
       <NAME>_POS array<vec3f,N> · <NAME>_NRM array<vec3f,N> ·
       <NAME>_AUX array<vec2f,N>  (x = side −1..1 · y = u along length)      */
  ZigMesh.toWGSL = function (m, name) {
    const nm = name || "SHARD";
    const f = (x) => {
      const s = (Math.round(x * 10000) / 10000).toString();
      return s.indexOf(".") < 0 && s.indexOf("e") < 0 ? s + ".0" : s;
    };
    let pos = "", nrm = "", aux = "";
    for (let i = 0; i < m.verts; i++) {
      pos += "vec3f(" + f(m.pos[i*3]) + "," + f(m.pos[i*3+1]) + "," + f(m.pos[i*3+2]) + "),";
      nrm += "vec3f(" + f(m.nrm[i*3]) + "," + f(m.nrm[i*3+1]) + "," + f(m.nrm[i*3+2]) + "),";
      aux += "vec2f(" + f(m.side[i]) + "," + f(m.u[i]) + "),";
    }
    const N = m.verts;
    return "var<private> " + nm + "_POS: array<vec3f, " + N + "> = array<vec3f, " + N + ">(" + pos.slice(0, -1) + ");\n" +
           "var<private> " + nm + "_NRM: array<vec3f, " + N + "> = array<vec3f, " + N + ">(" + nrm.slice(0, -1) + ");\n" +
           "var<private> " + nm + "_AUX: array<vec2f, " + N + "> = array<vec2f, " + N + ">(" + aux.slice(0, -1) + ");\n";
  };

  /* ---- toWGSLMany — THE WARDROBE (v0.4, 2026-07-21) ------------------------
     Bake SEVERAL letterforms into ONE plate: concatenated POS/NRM/AUX plus
     offset/count tables. The kernel picks a letter per frame — or per AGENT —
     via a uniform: the flock keeps its life and changes its body. Vertex
     budget = the largest letter; smaller letters clamp their tail indices to
     the last vertex → zero-area triangles (verts are always multiples of 3,
     so whole triangles collapse — no slivers). */
  ZigMesh.toWGSLMany = function (meshes, name) {
    const nm = name || "SHARD";
    const merged = ZigMesh.merge(meshes.map((m) => ({ mesh: m })));
    const ofs = [], cnt = [];
    let o = 0;
    for (const m of meshes) { ofs.push(o); cnt.push(m.verts); o += m.verts; }
    const K = meshes.length;
    return ZigMesh.toWGSL(merged, nm) +
      "const " + nm + "_N: u32 = " + K + "u;\n" +
      "const " + nm + "_OFS = array<u32, " + K + ">(" + ofs.map((v) => v + "u").join(",") + ");\n" +
      "const " + nm + "_CNT = array<u32, " + K + ">(" + cnt.map((v) => v + "u").join(",") + ");\n";
  };

  /* ---- presets — points in shape-space, named ---------------------------- */
  ZigMesh.presets = {
    /* the letterform: crescent blade, quarter-ish twist, long drawn tip,
       cupped cross-section. Edge-on a calligraphic line, broadside a lobe,
       and the twist sweeps a highlight as it turns. */
    sicklePetal: { segs: 14, length: 1.8, width: 0.42, curve: 0.34, twist: 1.35, taper: 0.72, camber: 0.30 },
    /* long thin twisted strip — the swarm becomes flowing script */
    ribbon:      { segs: 18, length: 2.6, width: 0.16, curve: 0.10, twist: 2.6,  taper: 0.5,  camber: 0.10 },
    /* soft blunt lobe — nearly tonal-only, the gentlest register */
    ember:       { segs: 10, length: 1.1, width: 0.55, curve: 0.08, twist: 0.25, taper: 0.35, camber: 0.55 },
    /* WOOD BLOCK (Bill, 2026-07-20): mass, not calligraphy — short, wide,
       deep-cupped, barely twisted. Reads as solid matter; tumbles heavy. */
    woodblock:   { segs: 8,  length: 1.0, width: 0.60, curve: 0.12, twist: 0.35, taper: 0.45, camber: 0.60 },
    /* THE HALO (letter two, 2026-07-20): a broken ring — transmission,
       lace, moiré. Face-on an O, edge-on a stroke, every angle between an
       opening eye. Water made of rings, ringed by rings. */
    halo:        { gen: "arc", segs: 18, radius: 0.72, sweep: 5.5, width: 0.20, twist: 0.8, taper: 0.6, camber: 0.35 },

    /* ================= THE SECOND ALPHABET (Scout, 2026-07-21) =================
       "The first alphabet answered: what does a body look like?
        The second answers: what ROLE does a body play?"
       Roles, not shapes — the engine supplies the life; these decide how the
       life becomes visible. Names and DNA are Scout's; baked verbatim.       */

    /* WHISPER — barely exists until it turns; edge-on nothing, broadside a
       white flash. Thousands = dry grass catching moonlight.
       Seeds: Morning Fog · Memory · First Snow */
    whisper:     { segs: 16, length: 2.2, width: 0.16, curve: 0.21, twist: 2.45, taper: 0.88, camber: 0.12 },

    /* COMPASS — the opening becomes directional; every broken ring quietly
       points somewhere. Halos were bells; these are QUESTIONS.
       Seeds: Migration · Jimmy · Homecoming */
    compass:     { gen: "arc", segs: 17, radius: 0.58, sweep: 4.3, width: 0.24, twist: 0.55, taper: 0.70, camber: 0.25 },

    /* SAIL — membrane, not blade. Waves shouldn't tumble these; they should
       BANK — leaves in wind, mantas. The theater is slow commitment. */
    sail:        { segs: 13, length: 1.9, width: 0.54, curve: 0.16, twist: 0.90, taper: 0.48, camber: 0.72 },

    /* CHIME — one body, two voices: a tiny ember suspended inside a halo
       shell. In a phase flash the ember lights first, the shell answers.
       A bell whose sound is visible. */
    chime: { gen: "merge", parts: [
      { spec: { gen: "arc", segs: 18, radius: 0.78, sweep: 5.85, width: 0.18, twist: 0.70, taper: 0.58, camber: 0.24 } },
      { spec: { segs: 8, length: 0.42, width: 0.11, curve: 0.08, twist: 1.90, taper: 0.60, camber: 0.52 } }
    ] },

    /* SEED — two opposing shards, almost mirrored, never fully open.
       Anticipation as geometry. Pollen · spores · beginnings. */
    seed: { gen: "merge", parts: [
      { spec: { segs: 12, length: 1.20, width: 0.34, curve: 0.38, twist: 1.10, taper: 0.82, camber: 0.45 } },
      { spec: { segs: 12, length: 1.08, width: 0.30, curve: -0.26, twist: 0.82, taper: 0.55, camber: 0.60 },
        pos: [0, 0, 0.05], rotY: 0.21 }
    ] },

    /* ECHO — very thin half-ring, huge twist: disappears, then reappears.
       Not objects. EVENTS — sound reflecting off canyon walls. */
    echo:        { gen: "arc", segs: 20, radius: 0.92, sweep: 3.2, width: 0.12, twist: 1.70, taper: 0.90, camber: 0.10 },

    /* KITE — a ribbon out front, a woodblock's weight behind. Every turn
       develops inertia: the front wants to go, the back wants to stay.
       Dragonflies · kites · birds in crosswinds. */
    kite: { gen: "merge", parts: [
      { spec: { segs: 16, length: 1.7, width: 0.15, curve: 0.12, twist: 2.2, taper: 0.5, camber: 0.10 },
        pos: [0.42, 0, 0] },
      { spec: { segs: 8, length: 0.62, width: 0.40, curve: 0.10, twist: 0.30, taper: 0.45, camber: 0.60 },
        pos: [-0.55, 0, 0] }
    ] },

    /* ============ THE CLOSED PHYLUM (Bill's ask, 2026-07-22) ============ */

    /* BUBBLE — a spherical cap with an open mouth: film, not bead. Oblate,
       soap-swirled, and BREATHING (each one swells and dimples on its own
       clock — the micro-membrane). The rim is its edge: copper lives there. */
    bubble: { gen: "shell", segs: 8, rings: 14, radius: 0.62, sweep: 2.25, squash: 0.92, swirl: 0.7, breathe: 0.11 },

    /* ORB — a bubble drawn in absence: three broken rings crossed at right
       angles. Silhouettes as a sphere from EVERY angle, yet light passes
       through everywhere. The halo's lesson, cubed. */
    orb: { gen: "merge", parts: [
      { spec: { gen: "arc", segs: 14, radius: 0.60, sweep: 5.9, width: 0.13, twist: 0.5, taper: 0.55, camber: 0.30 } },
      { spec: { gen: "arc", segs: 14, radius: 0.60, sweep: 5.9, width: 0.13, twist: 0.5, taper: 0.55, camber: 0.30 },
        rotX: 1.5708 },
      { spec: { gen: "arc", segs: 14, radius: 0.60, sweep: 5.9, width: 0.13, twist: 0.5, taper: 0.55, camber: 0.30 },
        rotX: 1.5708, rotY: 1.5708 }
    ] },

    /* ================= THE THIRD SET (Glyph, 2026-07-31) =======================
       The first alphabet asked what a body looks like; the second, what role it
       plays. The third fills the silhouettes the first two left open — the hard,
       the curling, the plumed, the plump, the shelled, the tangled. Same three
       generators, new corners of shape-space. */

    /* THORN — rigid, straight, drawn to a needle. Edge-on a line, broadside a
       slim dagger; unlike the whisper it does NOT soften as it turns — it holds
       its point. Defense · quill · ice-needle · the hard stroke. */
    thorn:       { segs: 12, length: 2.4, width: 0.14, curve: 0.03, twist: 0.15, taper: 0.96, camber: 0.15 },

    /* PLUME — a feather that flutters: fuller than the ribbon, gently bowed,
       high twist so the highlight flickers all along its length. Flight ·
       quill-in-air · the trailing flourish. */
    plume:       { segs: 18, length: 2.3, width: 0.30, curve: 0.24, twist: 2.05, taper: 0.86, camber: 0.16 },

    /* DROP — a plump teardrop: broad and deep-cupped at the base, drawn to a
       single point. Rounder than the ember, pointed where the ember is blunt.
       Water · ripeness · the held bead. */
    drop:        { segs: 12, length: 1.25, width: 0.50, curve: 0.10, twist: 0.30, taper: 0.90, camber: 0.72 },

    /* CROOK — a tight hook that turns back on itself: a shepherd's crook, a
       fiddlehead, a question mark. Recursion · memory folding over · the
       gesture that returns. (arc, small radius, partial sweep.) */
    crook:       { gen: "arc", segs: 18, radius: 0.40, sweep: 3.6, width: 0.20, twist: 1.10, taper: 0.50, camber: 0.28 },

    /* SCALLOP — a shallow, wide-mouthed cap, pressed flat: a fish-scale, a
       petal-cup, a dish. The bubble laid open. Armor · overlap · tessera ·
       the plate. (shell, low squash, wide mouth.) */
    scallop: { gen: "shell", segs: 7, rings: 14, radius: 0.66, sweep: 1.5, squash: 0.55, swirl: 0.25, breathe: 0.04 },

    /* BURR — two short blades crossed, NOT mirrored: where the seed opens, the
       burr tangles. A caltrop, a knot, a snag. Catch · anchor · the thing that
       holds. (merge, crossed ~1.15 rad.) */
    burr: { gen: "merge", parts: [
      { spec: { segs: 10, length: 1.40, width: 0.20, curve: 0.16, twist: 0.60, taper: 0.80, camber: 0.35 } },
      { spec: { segs: 10, length: 1.25, width: 0.18, curve: -0.12, twist: 0.50, taper: 0.80, camber: 0.35 },
        rotY: 1.15 }
    ] }
  };

})(typeof window !== "undefined" ? window : globalThis);

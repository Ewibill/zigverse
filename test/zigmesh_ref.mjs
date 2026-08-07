/* =============================================================================
   test/zigmesh_ref.mjs — CPU reference checks for the ZigMesh shard generator
   (run: node test/zigmesh_ref.mjs) — no GPU needed; pure geometry truth.
   ========================================================================== */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
new Function(readFileSync(path.join(root, "engine/zigmesh.js"), "utf8"))();   // defines globalThis.ZigMesh
const ZigMesh = globalThis.ZigMesh;

let failures = 0;
const say = (ok, msg) => { console.log((ok ? "  ✓ " : "  ✗ ") + msg); if (!ok) failures++; };

for (const [name, preset] of Object.entries(ZigMesh.presets)) {
  console.log("[" + name + "]");
  const m = ZigMesh.make(preset);

  const expVerts = preset.gen === "merge"
    ? preset.parts.reduce((s, p) => s + p.spec.segs * 4 * 3, 0)
    : preset.gen === "shell"
    ? preset.segs * preset.rings * 6
    : preset.segs * 4 * 3;
  say(m.verts === expVerts, "vertex count " + m.verts + " = " + (preset.gen === "merge" ? "Σ parts" : "segs·4·3"));

  let nan = 0;
  for (const arr of [m.pos, m.nrm, m.side, m.u]) for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) nan++;
  say(nan === 0, nan === 0 ? "no NaN/Inf anywhere" : nan + " non-finite values");

  let badN = 0;
  for (let i = 0; i < m.verts; i++) {
    const l = Math.hypot(m.nrm[i * 3], m.nrm[i * 3 + 1], m.nrm[i * 3 + 2]);
    if (Math.abs(l - 1) > 1e-4) badN++;
  }
  say(badN === 0, badN === 0 ? "all normals unit length" : badN + " non-unit normals");

  if (preset.gen !== "merge" && preset.gen !== "shell") {
    /* asymmetry: taper must skew the width lobe — widest station off-center */
    let wMax = 0, uAt = 0.5;
    for (let i = 0; i < m.verts; i++) {
      const w = Math.abs(m.pos[i * 3 + 2]);   // lateral reach proxy
      if (w > wMax) { wMax = w; uAt = m.u[i]; }
    }
    if (preset.taper > 0.55) say(uAt < 0.5, "taper " + preset.taper + " skews the lobe (widest at u=" + uAt.toFixed(2) + ")");

    /* bilateral difference: with twist+curve, no mirror symmetry across length */
    const a = ZigMesh.make(Object.assign({}, preset, { taper: 0.9 }));
    const b = ZigMesh.make(Object.assign({}, preset, { taper: 0.1 }));
    let diff = 0;
    for (let i = 0; i < a.pos.length; i++) diff += Math.abs(a.pos[i] - b.pos[i]);
    say(diff > 1, "taper actually reshapes the mesh (Σ|Δ| = " + diff.toFixed(1) + ")");
  }
}

/* the SECOND ALPHABET — role guarantees */
{
  console.log("[second alphabet roles]");
  const P = ZigMesh.presets;
  const chime = ZigMesh.make(P.chime);
  say(chime.verts === (18 + 8) * 4 * 3, "chime is ONE body with TWO voices (" + chime.verts + " verts)");
  const seedA = ZigMesh.make(P.seed.parts[0].spec), seedB = ZigMesh.make(P.seed.parts[1].spec);
  let d = 0;
  for (let i = 0; i < Math.min(seedA.pos.length, seedB.pos.length); i++) d += Math.abs(seedA.pos[i] - seedB.pos[i]);
  say(d > 1, "seed halves are ALMOST mirrored, never identical (Σ|Δ| = " + d.toFixed(1) + ")");
  const eo = P.echo, ho = P.halo;
  const gap = (p) => Math.hypot(p.radius * (Math.cos(-0.5 * p.sweep) - Math.cos(0.5 * p.sweep)),
                                p.radius * (Math.sin(-0.5 * p.sweep) - Math.sin(0.5 * p.sweep)));
  say(gap(eo) > gap(ho), "echo opens wider than halo (event, not object: " + gap(eo).toFixed(2) + " vs " + gap(ho).toFixed(2) + ")");
  const kite = P.kite;
  say(kite.parts[0].pos[0] > 0 && kite.parts[1].pos[0] < 0, "kite: the front wants to go, the back wants to stay");

  /* THE MINT — refine multiplies stations, never touches DNA */
  const m1 = ZigMesh.make(P.sicklePetal), m2 = ZigMesh.make(P.sicklePetal, { refine: 2 });
  say(m2.verts === m1.verts * 2, "mint ×2 doubles the cloth (" + m1.verts + " → " + m2.verts + " verts)");
  const c2 = ZigMesh.make(P.chime, { refine: 2 });
  say(c2.verts === (36 + 16) * 4 * 3, "mint recurses through composites (chime ×2 = " + c2.verts + " verts)");
  let nan2 = 0;
  const m3 = ZigMesh.make(P.whisper, { refine: 3 });
  for (let i = 0; i < m3.pos.length; i++) if (!Number.isFinite(m3.pos[i])) nan2++;
  say(nan2 === 0 && m3.verts === 48 * 4 * 3, "blown glass ×3 clean (whisper: " + m3.verts + " verts, capped at 48 stations)");

  /* THE WARDROBE — many letters, one plate */
  const wm = [ZigMesh.make(P.seed), ZigMesh.make(P.whisper), ZigMesh.make(P.halo)];
  const w = ZigMesh.toWGSLMany(wm, "TEST");
  say(w.indexOf("TEST_N: u32 = 3u") >= 0, "wardrobe bakes 3 letters into one plate");
  const total = wm[0].verts + wm[1].verts + wm[2].verts;
  say(w.indexOf("array<vec3f, " + total + ">") >= 0, "concatenation carries every vertex (" + total + ")");
  say(w.indexOf("TEST_OFS = array<u32, 3>(0u," + wm[0].verts + "u," + (wm[0].verts + wm[1].verts) + "u)") >= 0,
    "offsets land letter-perfect");
  say(wm.every((m) => m.verts % 3 === 0), "every letter is whole triangles — tail-clamping can never sliver");
}


/* THE CLOSED PHYLUM — bubble & orb guarantees */
{
  console.log("[closed phylum]");
  const P = ZigMesh.presets;
  const b = ZigMesh.make(P.bubble);
  say(P.bubble.sweep < 3.14, "the bubble has a MOUTH (sweep " + P.bubble.sweep + " < π) — film, not bead");
  /* winding sanity: geometric triangle normals agree with vertex normals
     (front face = outside the dome) for the overwhelming majority */
  let agree = 0, tris = b.verts / 3;
  for (let t = 0; t < tris; t++) {
    const i0 = t * 9, i1 = i0 + 3, i2 = i0 + 6;
    const e1 = [b.pos[i1] - b.pos[i0], b.pos[i1 + 1] - b.pos[i0 + 1], b.pos[i1 + 2] - b.pos[i0 + 2]];
    const e2 = [b.pos[i2] - b.pos[i0], b.pos[i2 + 1] - b.pos[i0 + 1], b.pos[i2 + 2] - b.pos[i0 + 2]];
    const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (g[0] * b.nrm[i0] + g[1] * b.nrm[i0 + 1] + g[2] * b.nrm[i0 + 2] > 0) agree++;
  }
  say(agree / tris > 0.95, "dome faces OUT: " + agree + "/" + tris + " triangles wound with the film");
  say(!!(b.params && b.params.breathe > 0), "the bubble carries its own pulse (breathe " + b.params.breathe + ")");
  const o = ZigMesh.make(P.orb);
  say(o.verts === 3 * 14 * 4 * 3, "the orb is three crossed rings (" + o.verts + " verts)");
  /* the crossed rings truly occupy three planes: spread in all axes */
  let mx = [0, 0, 0];
  for (let i = 0; i < o.verts; i++) for (let a = 0; a < 3; a++) mx[a] = Math.max(mx[a], Math.abs(o.pos[i * 3 + a]));
  say(mx[0] > 0.5 && mx[1] > 0.5 && mx[2] > 0.5, "it silhouettes as a SPHERE from every angle (reach " +
    mx.map((v) => v.toFixed(2)).join("/") + ")");
  const b2 = ZigMesh.make(P.bubble, { refine: 2 });
  say(b2.verts === 16 * 14 * 6, "the mint refines the film too (" + b.verts + " → " + b2.verts + " verts)");
}

/* halo: the ring must be BROKEN, and merge must compose cleanly */
{
  console.log("[halo split + merge]");
  const hp = ZigMesh.presets.halo;
  const h = ZigMesh.make(hp);
  const a0 = -0.5 * hp.sweep, a1 = 0.5 * hp.sweep;
  const gap = Math.hypot(hp.radius * (Math.cos(a0) - Math.cos(a1)), hp.radius * (Math.sin(a0) - Math.sin(a1)));
  say(gap > 0.15, "the ring is broken (opening " + gap.toFixed(2) + ")");
  const sp = ZigMesh.make(ZigMesh.presets.sicklePetal);
  const two = ZigMesh.merge([{ mesh: sp }, { mesh: h, pos: [2, 0, 0], rotY: 1.2, scale: 0.8 }]);
  say(two.verts === sp.verts + h.verts, "merge concatenates (" + two.verts + " verts)");
  let nan = 0;
  for (let i = 0; i < two.pos.length; i++) if (!Number.isFinite(two.pos[i])) nan++;
  say(nan === 0, "merged mesh clean");
}

console.log(failures === 0 ? "\nZIGMESH REF: PASS" : "\nZIGMESH REF: FAIL (" + failures + ")");
process.exit(failures === 0 ? 0 : 1);

// web_ref.mjs — CPU proof of the WEB capability (engine v0.25).
// Threads connect each agent to its K nearest neighbours WITHIN a radius, found via the
// flock's own spatial grid. This mirrors the webnn compute (insertion-sorted K-NN) and the
// thread render's length-fade + breath-gain, so the drawn web is verified without a GPU.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const WK = 4, RAD = 15, RAD2 = RAD * RAD;

// ---- the K-NN the compute shader does (insertion sort, within radius, no self) ----
function knn(i, pts) {
  const p = pts[i];
  const nd = new Array(WK).fill(1e12), ni = new Array(WK).fill(-1);   // -1 = 0xffffffff (none)
  for (let j = 0; j < pts.length; j++) {
    if (j === i) continue;
    const q = pts[j], dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < RAD2 && d2 < nd[WK - 1]) {
      let k = WK - 1;
      while (k > 0 && nd[k - 1] > d2) { nd[k] = nd[k - 1]; ni[k] = ni[k - 1]; k--; }
      nd[k] = d2; ni[k] = j;
    }
  }
  return { nd, ni };
}
// the thread's drawn strength: fades with length (taut = bright), lifts with breath.
const threadAlpha = (len, gain, breath) => gain * (0.22 + 0.95 * clamp(breath, 0, 1)) * clamp(1 - len / RAD, 0, 1);

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("  FAIL:", m); fail++; } };

// a small deterministic cloud: a tight clump of 5 + one far outlier
const pts = [
  [0, 0, 0], [1, 0, 0], [0, 1.5, 0], [-1, 0, 1], [0.5, -1, 0.5],   // clump within radius of each other
  [100, 100, 100],                                                  // outlier — beyond radius of everyone
];

// 1) NEAREST-FIRST ordering: neighbour list is sorted by increasing distance.
{
  const { nd, ni } = knn(0, pts);
  let sorted = true; for (let k = 1; k < WK; k++) if (ni[k] >= 0 && nd[k] < nd[k - 1] - 1e-9) sorted = false;
  ok(sorted, "neighbours are ordered nearest-first");
  ok(ni[0] === 1, `closest to agent0 is agent1 (got ${ni[0]})`);
}

// 2) RADIUS gate: the outlier connects to NOBODY, and nobody connects to it.
{
  const outlier = knn(5, pts);
  ok(outlier.ni.every((x) => x === -1), "an isolated agent has no threads (all neighbours beyond radius)");
  let anyoneLinksOutlier = false;
  for (let i = 0; i < 5; i++) if (knn(i, pts).ni.includes(5)) anyoneLinksOutlier = true;
  ok(!anyoneLinksOutlier, "no thread reaches across the radius to the outlier");
}

// 3) NO self-links, and at most K neighbours.
for (let i = 0; i < pts.length; i++) {
  const { ni } = knn(i, pts);
  ok(!ni.includes(i), `agent ${i} never links to itself`);
  ok(ni.filter((x) => x >= 0).length <= WK, `agent ${i} has at most K threads`);
}

// 4) THREAD FADE: a taut (short) thread is brighter than a stretched one; length ≥ radius → invisible.
ok(threadAlpha(2, 1, 1) > threadAlpha(12, 1, 1), "short taut thread is brighter than a stretched one");
ok(Math.abs(threadAlpha(RAD, 1, 1)) < 1e-9, "a thread at the radius has faded to nothing");

// 5) BREATH strings the web: more breath = brighter threads, and it never fully dies at rest.
ok(threadAlpha(3, 1, 1) > threadAlpha(3, 1, 0), "breath brightens the web (vitality strings it)");
ok(threadAlpha(3, 1, 0) > 0, "a faint resting web survives in silence");

// ---- ENERGY CONDUCTION (v0.25): the pulse diffuses along the web filaments ----
// Mirrors the webenergy compute: e' = (e + DIFFUSE·Σ(neighbour−e))·DECAY + injection.
const DECAY = 0.955, DIFFUSE = 0.16, INJG = 0.9, INJ_R2 = (RAD * 0.8) * (RAD * 0.8);
function stepEnergy(E, pts, seed, strength) {
  const out = new Float32Array(E.length);
  for (let i = 0; i < pts.length; i++) {
    const { ni } = knn(i, pts);
    let sum = 0, cnt = 0;
    for (const j of ni) if (j >= 0) { sum += E[j]; cnt++; }
    let ne = cnt > 0 ? E[i] + DIFFUSE * (sum - cnt * E[i]) : E[i];
    ne *= DECAY;
    if (seed) { const dx = pts[i][0]-seed[0], dy = pts[i][1]-seed[1], dz = pts[i][2]-seed[2]; const d2 = dx*dx+dy*dy+dz*dz;
      if (d2 < INJ_R2 && strength > 0) ne += strength * INJG * (1 - d2 / INJ_R2); }
    out[i] = Math.max(0, Math.min(8, ne));
  }
  return out;
}
// A tight line of 5 agents so energy has somewhere to travel: 0—1—2—3—4 spaced 3 apart.
const line = [[0,0,0],[3,0,0],[6,0,0],[9,0,0],[12,0,0]];
{
  // inject at agent 0 for one frame, then let it conduct with no further input.
  let E = new Float32Array(5);
  E = stepEnergy(E, line, line[0], 3.0);                 // the note poured at end 0
  ok(E[0] > E[4], "energy starts concentrated at the injection point");
  const farBefore = E[4];
  for (let f = 0; f < 8; f++) E = stepEnergy(E, line, null, 0);   // release → conduct + decay, no new input
  ok(E[4] > farBefore, "the pulse has TRAVELLED toward the far end (conduction along the web)");
}
{
  // decay: with no injection the whole web fades toward nothing.
  let E = new Float32Array(5).fill(2.0);
  const total0 = E.reduce((a,b)=>a+b,0);
  for (let f = 0; f < 45; f++) E = stepEnergy(E, line, null, 0);   // ~2s at 60fps of pure decay
  const total1 = E.reduce((a,b)=>a+b,0);
  ok(total1 < total0 * 0.2, "with no note, the web relaxes back toward its resting lattice");
}
{
  // a HELD note (sustained injection) keeps the web energised above rest.
  let E = new Float32Array(5);
  for (let f = 0; f < 20; f++) E = stepEnergy(E, line, line[2], 1.0);   // sustained feed at the middle
  ok(E[2] > 0.5, "a held note sustains a fountain of energy at the source");
  ok(E[0] > 0.05 && E[4] > 0.05, "and it spreads through the membrane to both ends");
}

console.log(fail ? `\nWEB REF: FAIL (${fail})` : "\nWEB REF: PASS");
process.exit(fail ? 1 : 0);

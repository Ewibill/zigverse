# ZigMesh — Brief for Scout
*From Glyph · 2026-07-19 · re: the sickle-petal / letterform study*

Your read is correct, and you got there blind. Confirmation and grounding below, then the three calls I want your strategy on.

## What you were holding

`Shard_Turntable_SicklePetal_v0.1.html` — the first artifact of **ZigMesh**, a new engine module (`engine/zigmesh.js`, additive, golden kernel untouched). Agent geometry stopped being hand-carved WGSL and became **six numbers**: length, width, curve (crescent bow), twist, taper (tip asymmetry), camber (cup). One generator; sickle-petal, ribbon, and ember exist today as presets. Bird and fish become points in the same space when we integrate. CPU reference tests pass (clean geometry, unit normals, taper provably reshapes the mesh); shaders validated on a real WebGPU device headless.

## Where it came from — this matters for the record

Not designed as a design language. **Derived from a performance observation.** Bill played the EWI into the Fireflies shell wearing the old starling geometry and saw *faces* — new ones with every breath. Diagnosis: 7-NN alignment makes orientation patches; banking flips their tone; sharp edges draw the boundaries; the audience's eye does the rest (pareidolia is a channel, not a bug). Inverting that gave a constraint set — maximum distinguishable appearances per orientation → asymmetry, curvature + sharp silhouette, twist, two-tone dome/hollow, iridescence at the mid-turn state. The sickle-petal is what the constraints force. Discovery, not invention — which is why it converges with the willow leaf, the feather, the brushstroke, and (Bill's catch) Stan Tenen's Kabbalistic flame letter: one twisted form whose orientation-space is an alphabet. Note the consequence for performance: the *wavefront* — every agent mid-turn — carries an iridescent hue the settled field lacks. The breath becomes visible as color rolling through the swarm.

## Where you're right

- **Vocabulary, not organism.** Agreed. Tier-2 placement (Biological Construction, between engine laws and experiences) is the correct slot and I'm adopting your tiering.
- **"Grow, don't store."** This is the real insight, and note it's already in your own Law Ledger: the Grow/Branch law (ZigBranch). ZigMesh v0.1 stores a *form*; v0.2 should store a *development* — same algorithm, parameters as genome, the mesh as the outcome of growth. That also unlocks the living logo exactly as you describe: not animated, *grown and relaxing*.
- **Morphological language as the invisible brand.** Endorsed. The mechanism already exists: presets are points in one shape-space, so kelp blades, fin edges, wing terminations, and crystal tips can all be sickle-petal variations without a logo ever appearing.

## One correction

Don't skip that ZigMesh is worthless without the *shading half*: countershading, specular flash, thin-film iridescence — all already engine (fish path). ZigMesh feeds it. Geometry is the letter; the light model is the ink. Judge them together.

## Three calls I want from you

1. **Sequence.** Fireflies M2 (lantern glow — the ZigGlow 004 mandate) vs. shard-swarm integration (`createFlock` accepts ZigMesh output — the face-swarm Bill saw). Both are one integration step from done. Which first, and why?
2. **Growth rules.** If ZigMesh v0.2 is developmental (grow → relax → settle), does it live inside ZigMesh or promote to a ZigCore law beside ZigBranch? Where does it enter the Law Ledger?
3. **ZigGlyph.** You named a fifth pillar (visual language). Define its boundary against ZigMesh before we build toward it — one sentence each will do.

Bill judges every letterform on eyez; current approved workflow is he reads us the six numbers off the turntable HUD when a shape gives him the feeling. Nothing prints at 6,000 until the letter earns it at 1.

— Glyph

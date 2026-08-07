# Handoff → Fable-Glyph
*Written by Opus-Glyph (stand-in), 2026-07-27. Read this, then the tail of Session_Log.md, then build. Bill is flipping the model here on purpose: the runway ahead is law-grade.*

## Where the engine is right now
- `engine/zigcore.js` **v0.7.0** — laws-as-data + shared registries: Perf, Drive, Climate, Temperament, Turnover, Pacemaker, Timbre, **Materials (19)**, Mood, Reserve, **Canon** (22 laws, four pillars).
- `engine/zigwebgpu.js` **v0.10.1** — the field kernel: spatial hash, topological 7-NN boids, impulse waves, VOICE, Memory Glass, ZigFlow, the letter-swap (`U.morph`/`ZIG_WARDROBE`/N), Biome, **Material as a COLOR-ONLY texture pass**, Membrane.
- `engine/zigmesh.js` — **14 letters** in three alphabets (see counts below).
- `engine/zigmidi.js` — WebMIDI.
- Species: `sickleswarm.js` v0.17.0 (the Field family), `lake.js` v0.7.0, `fireflies.js` v0.4.1.
- `ZigKeys.html` — current and comprehensive (refreshed 2026-07-27).

## The vocabulary correction (Bill, this session) — IMPORTANT
Bill has been saying **"wardrobe"** to mean **the MATERIAL — the cover on the letter.** The letter is the body; the material is what it *wears*. The engine's current internal "wardrobe" (the `ZIG_WARDROBE` / `U.morph` / `N`-key letter-swap) is actually a **body-swap**, which should be called **Metamorphosis**.

**Pending Bill's bless:** rename so the code matches his intuition —
- **Wardrobe** = the material/cover (what a body wears).
- **Metamorphosis** = the letter/body-swap (`N`, `U.morph`, the `ZIG_WARDROBE` global → e.g. `ZIG_METAMORPH`).
Small rename: one global, some HUD strings, comments. Do NOT do it silently — confirm with Bill first; he may want the global name kept for back-compat.

## The counts (get these right in any doc)
- **14 letters** — first alphabet (shapes): sicklePetal, ribbon, ember, woodblock, halo (5). Second alphabet (roles, Scout): whisper, compass, sail, chime, seed, echo, kite (7). Closed phylum: bubble, orb (2).
- **19 materials**: pearl, bone, obsidian, ice, copper, moonstone, moss, smoke, volcanic, crystal, nacre, wood, coral, ceramic, chitin, glass, tissue, botanical, mineral.
- Letters × materials = 266 body/cover pairings already, before environments.

## The architecture target — FOUR SHELVES + AN ASSEMBLER
Working backwards from the finish line (a dozen organisms, a cover for each, a library of environments, all mix-and-match): the engine must stop being configured by scattered `window.ZIG_*` globals and become a **composition system fed by registries**. Author a world by picking one from each shelf:
`world({ organism, environment, material /*=wardrobe*/, metamorphosis })`.
- **ZigPhysics** — forces/laws. Mostly built.
- **ZigHabitat** — the **Environment registry**. THE next build. Our thinnest pillar.
- **ZigLife** — Organisms (formalize a species contract) + Materials (built) + the letter alphabet (built).
- **ZigExperience** — the manifest/composition system + a shared HUD + a shared input map (the core keys B/Space/+/−/[/]/C/,. are duplicated across every species today — lift them to the engine, species register only extras).

## Queued rungs, recommended order (Bill sequences)
1. **The wardrobe's DEPTH — normal-relief in the field.** This is why Bill sees the material as "too subtle": the field material is a color-only texture pass, no relief. Add a normal varying to `BirdOut` + per-pixel lighting so grain reads carved on the field (the turntable already looks dramatic; the field doesn't — that gap IS this rung). Fixes the subtle-cover complaint; feeds commercial-quality + high-res export. **Law-grade: full CPU proof + headless + isolated getCompilationInfo.**
2. **Environment registry + one coupling hook.** `ZigCore.Environments` beside `Materials`. The "formative worlds" (Ocean/Fire/Forest/Body/Cold), each a *coherent preset bundle* of ambient forces (gravity, medium/buoyancy, current, pressure-with-depth, light-filtering, temperature) + a light register. ONE point in the compute kernel applies every force to every agent ("environment acts on Life"); its twin is weathering in the fragment ("environment acts on Material over time"). Ships as designed presets, NOT a slider board — Load discipline; emergence from a few coupled forces.
3. **Composition/manifest refactor.** Normalize the scattered globals into one world spec + a boot self-check that reports what's mounted (organism · wardrobe · metamorphosis · environment) + the shared input map dedup. Pay this down now while it's 3 species, not 12.

Discipline: promote a behavior to the engine on its **second** use, not the first. Aesthetic choices (camera, palette, which letter, mood) stay per-world — engine offers shelves, the piece picks.

## Verification stack (unchanged — hold the line)
`node --check` → CPU `test/*_ref.mjs` proofs (green before AND after) → headless SwiftShader Chromium (filter the known present artifact "A valid external Instance reference no longer exists") → isolated WGSL `getCompilationInfo()` for shader edits → Bill's eye for aesthetics. **Golden discipline:** opt-in splices must be byte-identical when the feature is off (anchor-guarded, `throw` if anchor missing). **Only bundles to chat** via `node tools/bundle.mjs page.html dist/Name.html`; commit sources to `C:\Users\billy\Zigverse`.

## Still-open earlier threads (independent of the above)
- Murmuration sweet-spot verdict (MURMUR %) + which letter is the murmuration voice.
- The collective self-awareness LAW (step 2 of the murmuration blend — density/edge → letterform).
- ZigCollection (presets/capture/print-export) — Bill to bless the Codex design-question + pick first rung.
- Audio campaign: ZigScope captures → Timbre calibration → duet split.
- RC-600 ↔ MOTU UltraLite model (mk4/mk5?) still unknown for exact routing clicks.

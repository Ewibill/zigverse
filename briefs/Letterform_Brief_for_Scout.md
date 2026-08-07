# Letterform Brief — for Scout
*From Glyph · 2026-07-21 · engine v0.8, ZigMesh v0.2*

## What a letterform is

The objects you see flocking by the thousands in a ZigFlight piece are **letterforms** — the ZigGlyph alphabet. A letterform is NOT a 3-D model. It is a small set of numbers handed to ZigMesh, which grows the shape the way a genome grows a leaf. Six thousand copies of one letterform, obeying the flock/phase/wave/flow laws, become a performance piece with its own character — the way each Peter Gabriel or Laurie Anderson song was its own theater.

Your job: **imagine new DNA.** My job: bake it. Bill's job: judge it on the turntable and on the glass.

## The two generators

**shard** — a curved strip with a spine down its length:

| param | what it does | sicklePetal |
|---|---|---|
| segs | resolution along the length (12–18 typical) | 14 |
| length | tip-to-tip size | 1.8 |
| width | lateral reach | 0.42 |
| curve | how much the spine bows (the "sickle") | 0.34 |
| twist | rotation along the length — THE key to iridescence | 1.35 |
| taper | skews the width lobe off-center (asymmetry = organic) | 0.72 |
| camber | cross-section cupping (dome vs flat) | 0.30 |

Other shard presets: ribbon (long, narrow, low camber — the koi), ember (small, hot), woodblock (short, wide, blunt: segs 8, length 1.0, width 0.60, curve 0.12, twist 0.35, taper 0.45, camber 0.60 — the resonator body).

**arc** — the spine bends around a circle instead of running straight:

| param | what it does | halo |
|---|---|---|
| segs | resolution around the arc | 18 |
| radius | ring size | 0.72 |
| sweep | how much of the circle (radians; < 2π = a BROKEN ring — the gap is a door) | 5.5 |
| width / twist / taper / camber | as in shard | 0.20 / 0.8 / 0.6 / 0.35 |

**merge** — letterforms can be composed: parts with position, rotation, scale (a clapper inside a bell; a seed inside a husk). Composite letterforms are legal DNA.

## How the engine will light your design (why behavior beats appearance)

- The two faces are shaded differently (moss dome / bone hollow) — **the flip IS the letter.** Designs that read differently front vs back give the field its shimmer of faces.
- Iridescence lives at grazing angles; **twist** decides how much rainbow a turning body throws.
- The moonpath glints where a surface's tilt bisects moon and eye — **camber and curve** decide whether your form catches lanes of light.
- Waves roll bodies over; **taper/asymmetry** decides whether they tumble like coins or bank like wings.
- In the Halo Field, a phase-flash lifts the whole body — slender forms toll like bells, blunt forms knock like wood.

## The ask

Propose **3–7 new letterforms** as DNA, each with:

1. A name.
2. The generator (shard / arc / merge) and its parameter numbers.
3. One sentence of *behavioral intent*: what should this DO when it turns, flocks, tolls, and rides the currents? ("Theater? Instrument? Both?")
4. Optionally: what piece it seeds — the journey, in one line (e.g., "halo → gong temple; this one → ___").

Constraints: parameters roughly within 2× of the ranges above bake safely; wildly long/thin forms alias at distance; segs beyond ~20 cost fill-rate at 6000+ copies. Asymmetry is a virtue. The gap in the halo taught us: **absence is a feature.**

Every keeper inherits, for free: ZigPhase sync, the Pacemaker, the Avatar, wave physics, the resonator law, the memory glass, ZigFlow currents, and ZigTimbre's ears. You design the letter; the engine gives it a life.

— Glyph

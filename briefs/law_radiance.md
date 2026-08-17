# RADIANCE — Canon law 0.1.0

> *Light has a source and a falloff.*
> The first light Zigverse ever modelled that is **not inside the world**.

Engine: `zigwebgpu 0.45.0` · `ZigCore 0.13.0` · probe: `test/law_radiance_ref.mjs`
Registered: `ZigCore.Canon.registry.radiance` · Implementation: `ZigCore.Radiance`

---

## 1 · The problem, stated as physics

The summit ran in a lit classroom and the field flattened. That was read at the
time as a resolution or a brightness problem. It is neither.

A panel in a room shows

```
perceived = displayed + veil
```

where `veil` is the room's ambient light reflected off the glass, as a fraction
of the panel's peak white. It is **additive**, it is **uniform across the whole
screen**, and it has **no falloff**, because its source is behind you.

A linear difference survives that addition. **A ratio does not.** Two near-blacks
at 0.00 and 0.05 are infinite contrast in a dark studio and 1.25:1 in a lit room.
The arithmetic insists nothing was lost — the delta is still 0.05 — while the eye,
which works in ratios, sees two identical greys. The organism's modelling does not
dim. It *disappears*.

Measured in ΔL\* (CIE lightness) across the organism's shadow ramp, per step:

| veil | mean ΔL\* per step |
|---|---|
| 0.00 (dark studio) | 4.125 |
| 0.06 (a lit room) | 2.180 |
| 0.14 (the summit classroom) | 1.524 |
| 0.26 (a window in frame) | 1.095 |

That is the whole commercial problem in one column. A spa lobby, a hotel wall, a
projection in daylight — every install worth having is in the bottom three rows.

---

## 2 · What the law does — the mechanism

Radiance remaps **outgoing luminance only**, then scales the colour by the ratio.
Applied at the end of both fragment paths (shard and bird/fish), after fog:

```wgsl
fn radTone(L: f32) -> f32 {
  var x = max((L - RAD_BLACK) / (1.0 - RAD_BLACK), 0.0);   // drop the drowned region
  x = pow(x * RAD_GAIN, RAD_INVG);                          // expose, then expand shadows
  return x / (1.0 + max(x - RAD_KNEE, 0.0));                // soft shoulder, never flat white
}
fn radiance(c: vec3f, amt: f32) -> vec3f {
  let L = dot(c, vec3f(0.2126, 0.7152, 0.0722));
  if (L <= 1e-5) { return c; }
  return c * mix(1.0, radTone(L) / L, amt);
}
```

`RAD_INVG` is emitted as **1/gamma**, so the shader raises to the reciprocal.
`amt` is `V.render6.w` — a previously unused View slot, so **View did not grow.**

**It multiplies luminance and nothing else.** Channel ratios are preserved exactly
(proved to 1e-12 in the probe), so nacre, garnet, gem-face, spectrum, memory
underside and note flash all survive untouched. Every colour decision Bill has
made by eye is unaffected; only the tonal envelope moves.

**What it cannot do: make black blacker.** `tone(0) = 0` in every room. The floor
is set by the room and the panel, not by us. Every honest move this law makes is
therefore a move of the *organism* relative to an unmovable floor.

### The two opposite instincts

| | mechanism | buys | costs |
|---|---|---|---|
| **EXPAND** (`gain`, `gamma`) | stretch shadows apart so their differences are large enough in display units to survive the veil | shadow detail in a lit room | highlight headroom |
| **CUT** (`black`) | refuse to spend range on values the room will drown; rescale the survivors | separation, contrast | the faintest matter, deliberately |

Both are real. Which one is right is a question about the piece and the room, and
it is **Bill's eye that answers it**, not this document.

---

## 3 · The rooms

`ZigCore.Radiance.rooms` — the presets ARE platform; a host names a room, it does
not copy four numbers.

| room | black | gain | gamma | knee | for |
|---|---|---|---|---|---|
| `dark` | 0 | 1.00 | 1.00 | ∞ | the black-box theatre — **the identity element, never activates** |
| `lit` | 0 | 1.35 | 1.45 | 0.85 | a normally lit room |
| `bright` | 0 | 1.70 | 1.90 | 0.75 | the summit classroom · a spa in daylight |
| `sunlit` | 0 | 2.10 | 2.40 | 0.65 | worst case — a window in frame |
| `cut` | 0.06 | 1.50 | 1.00 | 0.85 | the opposite instinct |
| `white` | 0 | 0.55 | 0.62 | ∞ | **background inversion** — a dark organism against a bright floor |

Measured effect on shadow separation, mean ΔL\* per step, at each room's design veil:

| room | veil | off | on | |
|---|---|---|---|---|
| `lit` | 0.06 | 2.180 | 3.483 | ×1.60 |
| `bright` | 0.14 | 1.524 | 3.317 | ×2.18 |
| `sunlit` | 0.26 | 1.095 | 2.979 | ×2.72 |

**There is no free lunch, and the probe forces that out.** In a *dark* room the
`bright` curve still separates the ramp (4.125 → 6.520) — it simply spends
highlight headroom to do it. A law that helped everywhere would be suspicious.
This is why Radiance ships OFF and why the room is a decision, not a default.

`white` is the strategic one: the projection / spa inversion is not a new law, it
is this same arithmetic with gain below 1. Note that the **floor** itself is a
separate change (VITRINE / stage); `white` handles the organism's half only.

---

## 4 · How to use it

**In a host** — one line, before the engine scripts:

```html
<script>
  window.ZIG_LAWS = { radiance: { room: "bright" } };
</script>
```

**In the URL** — overrides the host, so a configuration is A/B-able without a rebuild:

```
#radiance=bright      #radiance=cut      #radiance=off
```

**Live** — `Shift+R` toggles the law's amount between 1 and 0. The shader is
identical in both states; at 0 it multiplies by exactly one. **You are comparing
the law against itself in the same frame, not against a memory of a different
build.** Verified at the uniform: 90 frames at exactly 1.0, 88 at exactly 0.0,
then back.

The room's four numbers are **compiled constants**, not uniforms — changing room
reloads. That was deliberate: growing the View uniform is the single most
black-canvas-prone edit in this engine (three separate incidents in the log), and
this law refused to pay that price for a dial that changes once per venue.

**Host:** `Zigverse_Engine_v4_0_Radiance_host.html` — a `LIGHT` dropdown listing
every room, persisted in the hash alongside the rest of the configuration.

---

## 5 · Contract compliance (CANON.md §2)

| obligation | how it is met |
|---|---|
| 1 · defaults are the identity | `tone(L, defaults) === L` exactly, 1001 samples, max deviation **0**. `dark` resolves to the identity and therefore **never activates** — `Canon.stamp()` reports "no laws". |
| 2 · spliced, not branched | `tools/byte_identity.mjs`: 0.45.0 with the law absent hashes **identically** to 0.44.6 across all 3 WGSL modules (70,322 chars, sha256 `ddf1738e214b5b46`). With `room=bright` the shader differs by exactly **665 chars**. |
| 3 · probe is mandatory | `test/law_radiance_ref.mjs` — 47 checks, all PASS. |
| 4 · doc states the mechanism | this file, §2. |
| 5 · versions independently | `ZigWebGPU 0.45.0 + radiance 0.1.0`; `Canon.stamp()` emits it. |

**The Metal clause.** The law emits no `var<private>`, no mutable local array, no
derivative, and nothing reachable from a vertex stage. Fragment-only scalar math,
asserted by the probe against the emitted source. Nine shader audits PASS, and the
audit output is **byte-identical between 0.44.6 and 0.45.0**.

---

## 6 · What 0.1.0 deliberately does NOT do

**Falloff — the first light's half of the law.** Today `V.sunDir` is a direction at
infinity: every agent is lit identically regardless of where it stands. Giving the
source a position and an inverse-square attenuation would model the near and far
sides of the body and is the obvious depth-cue win.

It is not here because it needs the source position and the flock radius in the
View uniform, and View is at 112 of 112 floats. Growing it means editing three
hand-maintained sizes plus every species' `Float32Array`, and that edit has caused
a black canvas three times. **0.1.0 ships the half that needs no new uniform, no
species change, and no View growth.** Falloff is 0.2.0, and it should be built
immediately after `ZIG_BOUNDSCALE` or alongside a proper View-growth helper.

**Surfaces not yet covered.** The splice reaches the shard and bird/fish fragment
paths. The sky, floor/vitrine, debris, ribbon, smoke, web and lantern modules are
untouched. For the signatures this is close to the whole frame — and the sky is
pure black, which the law would not change anyway (`tone(0) = 0`). But **the bee's
lantern is currently exempt**, so at high gain she will read relatively dimmer
against a lifted field than she does today. Worth Bill's eye; a one-line splice
into `LANTERN_WGSL` fixes it if it reads wrong.

**Not verified here:** that the WGSL runs on Metal. SwiftShader is permissive in
exactly the way NVIDIA is. `tools/metal_gate.mjs` on the Air is that gate.

# GROUND — `ZigCore.Ground` 0.1.0
### A world has a ground of being · 2026-08-18

> Every world so far has been black, and black was never a decision.

**Status: WIRED and confirmed on screen (2026-08-19).** A declared ground now sets the sky
triple, the three scene clear values, the afterimage's compositing, and the Radiance room —
from one word. Bill confirmed `mist` and `paper` render on eyeZ at 165fps: pale field, dark
organism, holding its shape.

---

## 1 · What was actually there

Bill asked for a white background on 2026-08-17. Three answers were given before the right
one, and the wrong ones are instructive:

| claim | verdict |
|---|---|
| "the background is hardcoded black in five places" | **wrong.** Five `clearValue` sites exist, but **two are the trail accumulation buffer**, where black means *zero*. A lit colour there floods the echo feedback rather than lighting the world. |
| "only the clear colour is genuinely hardcoded" | **wrong, and more misleading.** The clear colour isn't the background at all. |
| the measurement | the sky is a **fullscreen triangle**, `depthWriteEnabled:false`, `depthCompare:"always"`, drawn before any agent. It paints over every pixel. **The clear colour is invisible in every build ever shipped** — it is the background only when `sky:false`. |

And the sky triple — `skyTop`, `skyMid`, `horizon` — are **already View uniforms**, authored
near-black by the species at `[0.007, 0.011, 0.024]`. There was never any plumbing to lay.

> **The engine has always been able to paint a lit world. Nobody has ever asked it to.**

`skyMid` is also the haze the fragment fogs toward — the source says so outright — so
lifting the sky lifts the medium for free. Two thirds of the pairing was already wired.

All of the above is measured by `tools/ground_gap.mjs`, not asserted.

---

## 2 · Why a law, and not a preset

Because of the finding nobody had named:

### The afterimage assumes a dark world, in its arithmetic

It composites with `max()`. Correct when light accumulates upward out of black. Invert the
world — a dark organism on a bright ground, which is exactly what `radiance=white` is *for*
— and the sky's own memory outranks the body:

```
DARK world   (void)     body 0.6000 → reaches the glass at 0.6000   survives
LIT world  + rise       body 0.2500 → reaches the glass at 0.8359   ERASED
LIT world  + signed     body 0.2500 → reaches the glass at 0.2500   survives
```

The creature is erased by its own afterimage, in a shader that reports no error. The memory
**gate** is inverted too: a luminance floor keeps the empty sky at 1.000 and the organism at
0.000. The world remembers its own emptiness and forgets what crossed it.

A preset can set a colour. Only a law can say that four capabilities must agree — sky, haze,
tone curve, compositing — and **refuse** the combinations that don't.

---

## 3 · The grounds

| ground | lift | compose | room | is |
|---|---|---|---|---|
| `void` | 0.000 | `rise` | — | no ground at all — light accumulates upward out of nothing. **IDENTITY** |
| `dusk` | 0.055 | `rise` | — | the hour before the sun; the floor has lifted but light still rises |
| `mist` | 0.620 | `signed` | `white` | a pale fog with no horizon — the medium *is* the ground |
| `paper` | 0.880 | `signed` | `white` | a white field — print, projection onto a pale wall, a gallery |

Every lit ground pairs `signed` compositing **and** an inverted room. No half-declarations —
that pairing is what `radiance=white` was missing on its own.

---

## 4 · The four operations

Each is the same operation measured from `lift` instead of from zero, and each reduces
**exactly** to the existing arithmetic when `lift = 0`. That identity is what keeps `void`
byte-identical, and it is proven across the whole unit square rather than argued.

```js
compose(mode, scene, trail, lift)      // furthest-from-ground wins, not brightest
decay  (mode, trail, lift, k, eps)     // memory fades TO the ground, and stops there
gate   (mode, L, lift, at, width)      // remember by DISTANCE, not by brightness
gated  (mode, scene, lift, at, width)  // an ungated pixel falls back to the GROUND
```

The last two exist because of design errors the probe caught — see §6.

---

## 5 · The refusals

Three, declared on the law itself rather than buried in a tool:

- **lit ground + `rise`** — the sky's memory outranks a dark body; `max()` erases the organism.
- **lit ground + no room** — the body stays bright against a bright floor and sinks. *This is
  what Bill saw on 2026-08-17.*
- **dark ground + `signed`** — legal but pointless; it reduces to `max()` and only costs clarity.

The 8/17 composition now trips **two** of them at build time.

---

## 6 · Three errors this law made, and what caught them

None of these were found by reading. All three were found by probes, and two would have
shipped as a screen full of darkness that was never drawn.

1. **Memory faded toward black, not toward the ground.** `trail * decay - eps` fades every
   memory to zero — right only when zero *is* the ground. On a pale field a decaying trail slid
   **past** the floor into negative luminance, and under signed compositing a negative value is
   the furthest thing from the ground there is, so a spent memory outranked everything. The
   glass returned `-0.1388`.
2. **An ungated pixel contributed zero.** The same error one level down. `scene * keep` means
   "not worth remembering, contribute nothing" — and nothing is the floor only in a dark world.
   On a pale ground it contributes *pure black*, maximal departure, so ungated pixels won
   everything.
3. **The probe refused its own author's claim.** `ground_gap` reported the body *surviving* at
   0.2500, because it simulated one frame from an empty trail buffer. A trail buffer in a lit
   world is never empty — the bright sky passes the gate at every pixel, every frame. Warm the
   buffer and the erasure appears immediately. **The claim was right and the measurement was
   wrong** — the same failure as `grep -c 'var<private>'` (8/16) and the View-struct regex
   (8/17). Four sessions running.

---

## 7 · The wiring, and the fault it cost

One word now sets four things. `#ground=mist` lifts the sky from 0.007 to **0.695**
luminance (the haze follows for free — same uniform), switches the afterimage to **signed**
compositing, changes the memory gate from a luminance floor to a distance-from-ground, and
pulls in Radiance's `white` room without anyone asking. Measured live:

| ground | sky luminance | compositing | radiance | fps (eyeZ) |
|---|---|---|---|---|
| `void` | *(untouched)* | rise | — | 165 |
| `dusk` | 0.055 | rise | — | — |
| `mist` | 0.695 | **signed** | gain 0.55 | 165 |
| `paper` | 0.898 | **signed** | gain 0.55 | 165 |

### THE BIND GROUP FAULT — a full day, one conditional entry

The base `blitFs` is `max(s, t)` and **never touches the uniform**, so `layout: "auto"`
derived a **two-entry** layout and its bind group matched. GROUND's signed `blitFs` calls
`gndFarther(s, t, A.lift)` — it now uses binding 0, the layout became **three** entries, and
every bind group was rejected:

```
Number of entries (2) did not match the expected number of entries (3)
for [BindGroupLayoutInternal (unlabeled)]
```

**1,240 of those per run on Bill's RTX**, cascading into invalid command buffers and a black
screen — while the loop reported 165fps.

> **A shader splice that changes WHICH BINDINGS A STAGE USES changes its auto-derived
> layout.** Byte-identity cannot see it: the `void` text is unchanged. A boot gate that only
> watches whether the loop ticks cannot see it either.

Nothing in the stack could catch this until `tools/boot_gate.mjs` 2.0 counted driver errors.
It then found it in **a single run**, after a day of guessing from a sandbox whose Chrome
accepts what a real GPU refuses.

### Also wired

- **`createFlock` and `createForest` resolve their own ground.** `scene` is only built when
  `ZIG_UNDERROW` is set, so the default build has no sky pass at all and the background is
  the flock's clear. Wiring only `createScene` lit nothing.
- **The trail buffer clears to the GROUND**, not to black — black is *zero*, which is the
  floor only in a dark world. On a pale field a freshly-cleared trail is maximally far from
  the ground and wins the whole frame.
- **`LIGHT` defaults to `dark`** in the host dropdowns, which counted as an explicit
  declaration and overruled the pairing. Real bug, found by reading the HUD.

---

## 8 · Open

- **A lit ground probably wants its own RIM and SHADOW.** On a dark ground shards separate by
  brightness; on a pale one only the edge distinguishes a shard from its neighbour, and rim is
  tuned at 0.40/3.0 for the opposite world. The interior currently reads as a mass rather than
  as thousands of individuals. Bill's call whether that is muddy or moody.
- The sceneless path gives a **flat** pale field, not a gradient. It matches the fog reference,
  but by accident rather than design.

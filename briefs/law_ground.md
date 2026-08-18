# GROUND — `ZigCore.Ground` 0.1.0
### A world has a ground of being · 2026-08-18

> Every world so far has been black, and black was never a decision.

**Status: declared, not yet consulted.** The law exists in the Canon, its arithmetic is
proven, and the engine does not read it yet. `mist` and `paper` do nothing on screen until
the wiring lands. This is deliberate — the law alone is byte-identical, so it commits as a
clean bisect point before the risky half.

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

## 7 · Not done

The engine does not consult this law yet. Still to wire:

- the **sky triple** from the declared ground
- the **three live clear values** (and only three — the trail's two stay black)
- the **afterimage's compositing, decay and gate** to `compose` / `decay` / `gate` / `gated`
- the **Radiance room** pulled from the ground rather than set separately

Byte-identical at `void` is the obligation, proven across the option matrix. Then the boot
gate across all four grounds — and then Bill's eye, which is the only test that matters for
`mist`.

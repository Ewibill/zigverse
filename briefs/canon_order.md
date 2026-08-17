# The Ordering Contract — `ZigCore.Canon.Order` 1.0.0
### Composition order is declared, not inherited from build history · 2026-08-17

> A law says what the world does. The ordering contract says **in what order the world does it.**
> Until now that was decided by which `if (LAW)` block sat higher in `createFlock`.

---

## 1 · The two collisions this was built for

Both were measured against the shipped 0.45.0 engine by `tools/order_collisions.mjs`
**before** any of it was changed. Neither is an argument from reading the source.

### The append inversion (Ambience vs Radiance)

The engine splices with two idioms that have **opposite ordering semantics**:

| idiom | the last-applied block ends up |
|---|---|
| `.replace(A, A + block)` | **first** in the emitted shader |
| `.replace(A, block + A)` | **last** |

Both are in use. Radiance appends after the fog line. Ambience must scatter **before**
Radiance's tone remap, or the veil compensation never reaches the medium's own glow —
so with the append idiom, getting the right answer requires applying **Radiance first**,
which is the counter-intuitive order and which nothing enforced. Measured:

```
applied radiance THEN ambience   → executes: ambience → radiance
applied ambience THEN radiance   → executes: radiance → ambience
```

A law's position in the light's path was a property of the idiom its author reached for.

### The four-owner underside

Four capabilities write the back face's colour `c`. Emitted order, read out of the WGSL:

```
1. fabric     (since 0.29)  REPLACE
2. memory     (since 0.27)  TINT
3. noteflash  (since 0.43)  TINT
4. gem        (since 0.33)  REPLACE
```

That is **0.29 → 0.27 → 0.43 → 0.33** — not version order, not any order. It is where
each author's cursor happened to be inside one template literal. The gem `REPLACE`s and
lands last, so with `gemFace="inside"` the **fabric, the memory and the note flash are
all computed and thrown away.** The shader is valid, the frame renders at sixty a second,
and three shipped capabilities are dead. Proven to be composition rather than the laws:
memory alone survives; memory plus an inside gem does not.

---

## 2 · The mechanism

A law **does not splice itself.** It files a claim naming a **rail** and a **station**,
and the rail emits every claim once, in station order, at one insertion point.

```js
ZigCore.Canon.Order.claim("frame.light", {
  id: "radiance", since: "0.1.0",
  station: "tone",          // WHERE on the rail — the only ordering input
  mode: "modulate",         // replace · tint · add · modulate
  face: "both",             // both · front · back
  wgsl: "col = radiance(col, V.render6.w);",
  note: "// RADIANCE: the room is a light source too"
});
```

Because emission happens once, in one place, **there is no anchor and no idiom left to
choose** — the inversion is not guarded against, it is structurally impossible.

### The rails

Stations are ordered because the **physics** is ordered. This is the Canon's prime law
(*Inevitability*) applied to composition itself: Radiance sits last not because it was
built last, but because the room is the only thing that happens **after the light has
left the screen**. Nothing can legally follow it.

**`shard.face`** — the colour of one face of a body:

| station | what belongs here |
|---|---|
| `surface` | what the face IS — geometric normal, relief, interior buff. Writes normals, not colour. |
| `pigment` | what colour the material HAS — base shade, spectrum, iridescence |
| `lining` | what LINES this face — a skin that REPLACES the pigment (fabric, gem) |
| `tint` | what STAINS it — an event or a memory colouring what is already there (memory underside, note flash) |
| `edge` | what its RIM does — silhouette, edge occlusion. Last because it is geometry, not skin. |

**`frame.light`** — the journey of the finished colour to the eye:

| station | what belongs here |
|---|---|
| `body` | the colour as the body emitted it |
| `medium` | what the space between body and eye does — haze, scatter, glow (**Ambience**) |
| `tone` | what the ROOM does to the display — the veil (**Radiance**) |

Adding a **station** is a Canon-level edit. Adding a **law** is not.

---

## 3 · The four refusals

All at build time, all mechanical.

| fault | when | why it is a fault |
|---|---|---|
| unknown rail / station | a claim names something that does not exist | a typo is not a law; the refusal prints the stations that DO exist |
| **AMBIGUOUS** | two claims, one station, one face, neither declares `after` | their order is undeclared — this silence is exactly how the underside got its order |
| **CONTESTED** | two `replace` claims share a face | they do not compose *at any order*; one is invisible either way. `yieldsTo` makes the loss a decision on the record |
| **DEAD** | a write that a later `replace` on the same face discards | computed and thrown away. **This one had been running in production for four months.** |

`emit()` refuses a faulted rail; `emit({strict:false})` still emits so an audit can
*report* faults without blocking a diagnosis. The fault is counted either way, never
suppressed.

---

## 4 · How a law joins

1. Pick the station by asking **where in the physics** the law acts — not when it was built.
2. Declare it in the law's `Canon.register({ splice: { rail, station, mode, face } })`.
3. File the claim where the WGSL is assembled. Do not call `.replace()`.
4. Run `test/canon_order_ref.mjs` and `tools/byte_identity.mjs <baseline>`.

If a new law is byte-identical when off, its rail claim costs nothing when absent.

---

## 5 · The gate

`tools/splice_anchors.mjs` check 11 forbids the condition that caused the collision:
**an anchor inside a function may be written by at most one capability.**

Two refinements were needed before it could be trusted, and both are the same lesson this
project has now learned three times:

- **Measure the anchor, not the variable.** The first version counted anchor variable
  *names* and reported `a1` as contested — it is not, `a1` is declared separately in three
  blocks holding a different string in each. Each anchor is now resolved to its literal
  **value**.
- **Order is only semantics inside a function.** The `velOut` binding line is appended at
  by **seven** capabilities, and that is safe: WGSL places no ordering requirement on
  module-scope declarations, and each inserts its own distinct binding. Reporting it as a
  fault would put a permanent red line in the audit that everyone learns to scroll past.
  Declaration anchors are reported as order-free; **statement** anchors fail.

Verified by negative test: a hand-spliced Ambience at Radiance's fog anchor is caught,
with both claimants named.

---

## 6 · What is NOT done

**The underside is diagnosed, not migrated.** The four owners still compose by template
position; `Canon.Order` can now *describe* and *refuse* that composition, and
`test/canon_order_ref.mjs` §8 replays it and finds the same three dead writers the WGSL
measurement found — but the shard fragment still emits them in the old order.

This is deliberate. Re-stationing them (`fabric → gem` at `lining`, `memory → flash` at
`tint`) would make the fabric and the memory reach the eye in configurations where they
have been silently dead — **which changes what Bill sees**, including possibly in the
approved Signatures. That is a taste decision, not an engineering one, and it is his.

The contract as shipped is byte-identical across the whole option matrix.

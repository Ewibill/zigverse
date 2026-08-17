# The Canon — Zigverse Natural Law
### Architecture, contract, and ledger · v1.0

> A law is not a feature. A feature is something *this* organism does.
> A law is something the *world* does, which every organism is subject to whether it knows or not.

---

## 1 · What qualifies as a law

Four tests. All four must pass.

| Test | Meaning |
|---|---|
| **Species-agnostic** | Rootwhale, Kelp, Zigpede and the sickleswarm are all subject to it. Nothing in the law names a species. |
| **Environmental** | It lives in the world, not in the body. Bodies *respond* to it. |
| **Nameable as a verb or a rule** | "the swell travels," "shed-on-impact," "motion origin = perceived agency." If you can't say it in five words, it isn't a law yet. |
| **Byte-identical when off** | At default, the frame must be bit-for-bit what it was before the law existed. This is what makes laws safe to add to judged builds. |

If it fails any test, it belongs in `species/` — not here.

---

## 2 · The law contract

Every law registers into `ZigCore.Canon` with the same shape:

```js
ZigCore.Canon.register({
  id:       'radiance',
  version:  '0.1.0',
  defaults: { ambient: 0.0, floor: 0.0, gamma: 1.0 },   // OFF = identity
  cpu:      (state, env, dt) => { /* logic-tier effect, or null */ },
  splice:   { stage: 'fragment', wgsl: '...' },          // opt-in shader splice, or null
  probe:    'test/law_radiance_ref.mjs',                 // numeric proof it does what it claims
  doc:      'briefs/law_radiance.md'
});
```

Five obligations, no exceptions:

1. **`defaults` must be the identity element.** Off means unchanged, provably.
2. **`splice` is spliced, not branched.** When the law is off, the WGSL is not emitted at all —
   no dead uniform, no `if (0.0)`. The shader is byte-identical to the pre-law shader.
3. **`probe` is mandatory.** A law with no numeric test is an opinion. I cannot see the canvas;
   the probe is the only thing standing between a claim and a guess.
4. **`doc` states the mechanism**, not the intent — what it multiplies, what it adds, what it reads.
5. **Version independently.** Laws version separately from the engine so a build can say
   *"0.45.0 + radiance 0.1.0"* and mean something precise.

### The Metal clause
Any law emitting WGSL is checked for `var<private>` arrays reachable from a vertex function
before it lands. SwiftShader and NVIDIA both silently hoist these to constant memory; **Metal
does not, and overflows the vertex stack.** The headless gate structurally cannot catch this.
Lint it, don't test it.

---

## 3 · Inheritance — how prior builds gain laws

This is the part that answers *"let prior builds leverage appropriate laws."*

**Bundles are frozen.** `Signature___Horizontal_8.html`, the summit `0.44.5` — these are
self-contained snapshots. Nothing can be retrofitted into a file that already exists. Editing
one forks the engine, which is the thing we never do.

So the mechanism is: **prior builds are re-bundled from source with the law opted in.** One line
in the host page, no change to `species/`, no change to the signature's approved look:

```html
<script>
  window.ZIG_LAWS = { radiance: { ambient: 0.18, floor: 0.06 } };
</script>
```

The host declares which laws apply and at what strength. `zigcore.js` reads `ZIG_LAWS` at boot
and activates only the named ones. Omit the object entirely and the build is byte-identical to
its pre-Canon self — which means **an approved signature can be re-bundled onto a newer engine
and still be the same creature.** That is the whole point.

Practical consequence: every law ships with a **hash override** too (`#radiance=0.18`) so you
can A/B it live on eyeZ without me rebuilding anything.

Naming for a re-bundled prior build: `Signature_Horizontal_radiance-0.45.0.html`. The pose is
unchanged; the world it stands in is not.

---

## 4 · The ledger

Ten candidates were named post-summit. Status as of this document:

| Law | Says | Status | Why / blocked on |
|---|---|---|---|
| **Radiance** | light has a source and a falloff | **next** | The bright-room problem. Ambient light lifts the black floor and kills the pop — that's physics, not resolution. Same law decides whether white-background inversion works for spa/projection installs. Commercially load-bearing. |
| **Ambience** | the medium itself glows, scatters, occludes | queued | Pairs with Radiance; spec exists (`Ambience_Spec` on Drive). Build second so Radiance defines the light Ambience scatters. |
| **Stigmergy** | agents leave traces the field remembers | queued | The first *memory* law. Unlocks trails, paths, wear — and is the cheapest route to "the organism has been somewhere." |
| **Sounding** | sound propagates and is felt | candidate | The summit's real finding: it read as *more alive* when the sax was audible, because the breath→organism chain became legible. Strategically large. |
| **Terrain** | the world has surfaces and gradients | candidate | Would give `basin` and `vessel` something to be. |
| **Perception** | agents sense before they respond | candidate | |
| **Lineage** | agents inherit from predecessors | candidate | |
| **Trophic** | energy is consumed and transferred | candidate | |
| **Diurnal** | the world has a clock | candidate | |
| **Habituation** | repeated stimulus loses force | candidate | Directly relevant to long-form performance — the field currently never tires of you. |

**Named gaps that are not laws but block law work:**
- `ZigCore.Session` — performance capsule on stop. Without it, every law is tuned against guesses instead of your breath.
- `test/*_ref.mjs` — the reference suite has never been located. The gate has been running on an unverified base.
- `ZIG_BOUNDSCALE` — proposed, never built. `basin` and `vessel` still never touch the body at any murmur setting; they are open space with extra steps.

---

## 5 · The standing question

Not *"what should this organism do?"* but:

> **What capability should the Zigverse gain?**

Answerable to every downstream inheritor — Rootwhale, Kelp, Zigpede, Natural Conduct, LA28 /
BREATHFIRE, ZigGlow installations — and to every output target: live HTML, 4K export,
TouchDesigner, projection, breathskin geometry, physical installation.

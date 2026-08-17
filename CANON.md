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

## 2b · The ordering contract — `Canon.Order` 1.0.0 (2026-08-17)

§2 says a splice is *spliced, not branched*. It did not say **where**. Until this
version, two laws touching the same pixel composed in whatever order their `if (LAW)`
blocks happened to sit in `createFlock`. `tools/order_collisions.mjs` measured what that
cost, against the shipped 0.45.0 engine:

- **The append inversion.** `.replace(A, A + block)` emits the *last-applied* block
  **first**; `.replace(A, block + A)` emits it **last**. Both idioms are in use. So the
  correct Ambience-before-Radiance order required applying **Radiance first** — the
  counter-intuitive one — and nothing enforced it. A law's place in the light's path was
  a property of the idiom its author reached for.
- **The four-owner underside.** Fabric (0.29), Memory (0.27), Note Flash (0.43) and Gem
  (0.33) all write the back face, emitted in that order — which is template position, not
  version order and not any order. The gem `REPLACE`s and lands last, so with
  `gemFace="inside"` **three shipped capabilities are computed and thrown away.** Valid
  shader, sixty frames a second, three dead laws.

**A law no longer splices itself.** It files a claim naming a **rail** and a **station**;
the rail emits every claim once, in station order, at one insertion point. There is no
anchor and no idiom left to choose, so the inversion is not guarded against — it is
structurally impossible.

Stations are ordered because the **physics** is. This is the prime law (*Inevitability*)
applied to composition: Radiance holds `tone` not by seniority but because the room is
the only thing that happens after the light leaves the screen.

| rail | stations |
|---|---|
| `shard.face` — one face of a body | `surface` → `pigment` → `lining` → `tint` → `edge` |
| `frame.light` — the colour's journey to the eye | `body` → `medium` → `tone` |

Adding a **station** is a Canon-level edit. Adding a **law** is not.

**Four refusals, at build time:** unknown rail/station · **AMBIGUOUS** (two claims, one
station, one face, no `after`) · **CONTESTED** (two `replace` claims share a face — they
do not compose at *any* order) · **DEAD** (a write a later `replace` discards). The last
had been running in production for four months.

Enforced by `test/canon_order_ref.mjs` (30 checks) and by `tools/splice_anchors.mjs`
check 11, which forbids two capabilities appending at one **statement** anchor. Module-
scope declaration anchors are exempt and reported as order-free: the `velOut` binding line
is shared by seven capabilities, and WGSL imposes no order on module-scope declarations,
so failing it would put a permanent red line in the audit that everyone learns to scroll
past. Full mechanism in `briefs/canon_order.md`.

**Not done: the underside is diagnosed, not migrated.** Re-stationing those four laws
would make the fabric and the memory reach the eye in configurations where they have been
silently dead — which changes what Bill *sees*, possibly including the approved
Signatures. That is a taste decision, and it is his. The contract as shipped is
byte-identical across the whole option matrix.

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
| **Radiance** | light has a source and a falloff | **0.1.0 SHIPPED** (2026-08-17) | The veil half is built: the room is a light source with no falloff, and the response is a hue-preserving luminance remap. Six named rooms incl. `white` for the projection/spa inversion. **FALLOFF is deferred to 0.2.0** — it needs the source position + flock radius in View, and View is full at 112/112. See `briefs/law_radiance.md` §6. |
| **Ambience** | the medium itself glows, scatters, occludes | **next** | Pairs with Radiance; spec exists (`Ambience_Spec` on Drive). Radiance now defines the light Ambience scatters. ~~Note the ordering caveat…~~ **The caveat is now a contract**: Ambience claims station `medium` on the `frame.light` rail, Radiance holds `tone`, and the rail emits in that order whatever sequence the two blocks are written in. See §2b. |
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
- ~~`test/*_ref.mjs` — the reference suite has never been located.~~ **CLOSED** — 40 refs present and passing as of 2026-08-17 (39 inherited + `law_radiance_ref`).
- `ZIG_BOUNDSCALE` — proposed, never built. `basin` and `vessel` still never touch the body at any murmur setting; they are open space with extra steps.

---

## 4b · The runtime, as built (2026-08-17)

The contract in §2 was a specification. `ZigCore.Canon` now implements it:

```js
Canon.register(law)          // refuses a law with no id / version / defaults / probe
Canon.resolve(id, cfg)       // defaults ← named preset ← explicit fields; never mutates either
Canon.isIdentity(id, cfg)    // a law resolved to its defaults is OFF, not "on but flat"
Canon.activate(decl, hash)   // window.ZIG_LAWS, overridden by #law=preset
Canon.law(id) / Canon.stamp()
```

Three behaviours worth stating because they are the ones that keep a judged build safe:

1. **Identity is off, not flat.** `#radiance=dark` resolves to the identity element and the
   law is never activated at all — `Canon.stamp()` reports "no laws" and the shader is
   byte-identical. A law that is *on but neutral* would still have emitted WGSL.
2. **An unknown preset name is OFF, never a guess.** `#radiance=nonesuch` does not fall back
   to a default room. A typo in a venue's URL gets the approved look, not a surprise.
3. **`activate()` mutates neither the host's declaration nor the law's defaults**, so two
   flocks in one page cannot poison each other.

Enforcement is mechanical, not remembered. `tools/byte_identity.mjs` loads two engine
versions in **separate vm contexts** (they are classic scripts binding to `globalThis`; a
shared realm lets one silently overwrite the other and every comparison passes for the wrong
reason), drives `createFlock` with identical opts against a stub device, and hashes every
WGSL string handed to `createShaderModule`. It asserts both directions: the law absent must
MATCH the baseline, and the law declared must DIFFER. A law that is off when it should be off
and also off when it should be on passes a one-sided identity test perfectly.

## 5 · The standing question

Not *"what should this organism do?"* but:

> **What capability should the Zigverse gain?**

Answerable to every downstream inheritor — Rootwhale, Kelp, Zigpede, Natural Conduct, LA28 /
BREATHFIRE, ZigGlow installations — and to every output target: live HTML, 4K export,
TouchDesigner, projection, breathskin geometry, physical installation.

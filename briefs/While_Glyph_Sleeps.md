# While Glyph Sleeps — the momentum playbook
*Open this when the Fable limit hits. Everything here needs zero AI and becomes fuel the moment Glyph wakes.*

## 1 · Play. Seriously — this is the work.
Every world in the Zigverse folder runs offline forever. Fly the fields, learn the keymap (ZigKeys.html), find the sweet spots. The instrument only becomes an instrument in your hands. Twenty minutes a day in the Membrane or the Lake teaches you things no build session can.

## 2 · Stockpile ZigScope captures (the calibration gold)
Open ZigScope, press A (or 2 for split once the RC-600 SUB routing is in), and run the seven-movement Session Score — press **C** during each movement. Every capture downloads a JSON. Do it on different days, different instruments, different moods. A folder of 10–20 captures is a *better* calibration corpus than 3. Name nothing, organize nothing — just drag them all into the chat when Glyph is back.

## 3 · Keep the Verdict Journal
A plain text file (Zigverse\verdicts.txt). Whenever something on the glass delights or bothers you, write one line: **world · the HUD's engine line (just read the numbers off the screen) · what you felt.** Example: `Halo v0.6.4 · mem 2.2s wind 1.8 ink 1.4 · tolling feels like church — KEEP` or `Orchard · season COPPER · drift too slow, I got impatient at 6 min`. The HUD exists precisely so your taste can be written down as numbers. Ten lines of verdicts = a full build session's worth of direction.

## 4 · Screenshot & record the keepers
Win+Alt+PrtScn or your capture tool of choice. Sweet spots, faces in the field, moments with Sky's reaction. These are the Cosm reel, the gallery pitch, and Glyph's regression targets all at once.

## 5 · Work Scout
Scout is a separate conversation — Scout's limits are not Glyph's. Queue design work: new letterform DNA, the next piece's journey, audio-mapping philosophy, names. Paste the whole stack to Glyph later; Scout's briefs have always compiled cleanly into engine law.

## 6 · Do the hardware (no AI required)
- RC-600: MENU → OUTPUT → ROUTING → TRACK: all tracks MAIN off / SUB1 on (add SUB2 if loops land on only one UltraLite channel). INPUT/RHYTHM page: live inputs MAIN on, SUB off.
- Verify with ZigScope split mode: loop alone moves L only; live horn alone moves R only.
- UltraLite CueMix: 7/8 into the main mix for ears + mono send → M2 in 1; live bus mono send → M2 in 2.
- Hunt for Jimmy recordings — cleaner or longer takes. Any format. The extractor is ready.

## 7 · Continuing with another Claude model (Bill keeps non-Fable access)
Glyph is a role, not a brain. To seat a stand-in Glyph on another model:
1. New Cowork chat, **Zigverse folder connected**, first message = paste `briefs/ZigRig_Audio_Kickoff.md` in full, plus: *"You are Glyph. Fable-Glyph is resting; you're the stand-in. Read the brief, honor the conventions, and log everything you change in briefs/Session_Log.md."*
2. **The iron rules for any stand-in** (they're in the brief, but repeat them): run the test suites (`node test/<name>_ref.mjs`, all of them) BEFORE and AFTER any change — green in, green out. Chat delivers ONLY single-file bundles built with `tools/bundle.mjs`. Commit sources + bundles to the Zigverse folder. Never reshuffle existing keys. New behavior = opt-in page config, never a change to a shipped world's defaults without a Bill verdict.
3. **Good stand-in work**: analyzing ZigScope captures (tools/timbre_extract.py is the pattern), dial/default tuning from your verdict journal, new page configs (a new material world, a wardrobe combo), Scout-brief letterform baking (ZigMesh DNA is well-guarded by tests), Session Score analysis, the UltraLite/routing verification loop.
4. **Save for Fable-Glyph**: new engine LAWS (WGSL kernel changes, new compute passes, Sim struct growth) — not because a stand-in can't, but because laws deserve the deepest reasoning and the proofs that come with it.
5. Ask the stand-in to end each session by appending to `briefs/Session_Log.md`: what changed, what passed, what's open. Fable-Glyph resyncs from that file in one read.

## When Glyph wakes
Drop in one message: the capture JSONs · verdicts.txt · screenshots worth keeping · Scout's briefs · what the routing test showed. That single message restarts the engine at full speed — no warm-up lost.

*The engine is committed, tested, and deterministic. Nothing rots while you're away. — Glyph*

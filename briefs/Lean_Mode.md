# Lean Mode — running the Zigverse light
*Same engine, fewer tokens, smaller footprint. The principle: spend heavy turns on LAWS, spend nothing on everything else.*

## Bill's side (free — costs zero tokens)
- **Play offline.** Every bundle runs forever without AI. Practice IS progress.
- **Batch, don't trickle.** One message with ten verdicts beats ten messages with one. Each turn reloads the whole project's context — the overhead dominates small asks.
- **Journal instead of asking.** verdicts.txt lines ("Lake · smear 2.0 wind 1.4 · keeper") batch into one cheap tuning turn later.
- **Edit page configs yourself.** Any world variant is just the `window.ZIG_*` block at the top of its .html — open in Notepad, change `ZIG_LETTER`/`ZIG_MATERIAL`/`ZIG_ECOLOGY`/`ZIG_CAM`, save, double-click. A new world for zero tokens. (Only bundles need Glyph; sources in the folder run as-is.)
- **Text over screenshots when possible.** Reading HUD numbers aloud ("mem 2.2 · wind 1.8") is cheaper than an image and usually says more.
- **Don't ask for re-delivery.** Everything ever built is already in the folder.

## Glyph's side — turn weights (say the word, Glyph obeys)
- **"lean:"** prefix on a request → minimal mode: touch one file, run only the suites that guard it, ONE bundle, batch the commit. No rebundling untouched worlds.
- **"tune:"** → dial/default changes only, from your verdicts. No new capability, no new tests needed.
- **default** → normal rigor.
- **"law:"** → full orchestra (CPU proofs, headless, all suites, docs). Never lean on laws — skipped rigor is debt that costs triple later. This is the one place tokens are always well spent.
- End-of-session single batch commit instead of per-turn commits, when asked.

## Division of labor (with 20x + Opus both available)
- Fable-Glyph: new laws, WGSL, architecture, anything touching the golden kernel.
- Opus-Glyph (stand-in protocol in Handoff brief): capture analysis, verdict tuning, page configs, letterform baking, session logging.

## The footprint truth
The honest big lever is fewer redundant heavy turns, not smaller thinking on the hard ones. A law built rigorously once beats a law built cheaply three times — in tokens, in carbon, and in goosebumps.

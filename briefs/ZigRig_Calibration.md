# ZigRig Calibration & Routing — production SOP
*The last 5%. Getting clean, separated, correctly-leveled signal from the RC-600 through the two MOTUs into the eyeZ. ZigScope is the meter — open `ZigScope_v0.1.1.html` and calibrate against it. Do the stages in order.*

## The signal map (confirm this first)
```
EWI5000 ──MIDI(USB)────────────────────────────────► eyeZ (Chrome / WebMIDI)   [the live BODY]
EWI5000 ─► Logic+SWAM (MacBook) ─► Mission pedal ─► RC-600 ─┬─ MAIN L/R ─► UltraLite  (LIVE / presence)
                                                            └─ SUB  L/R ─► UltraLite 7/8 (LOOPS / history)
UltraLite ─(bus A = live)──────► M2 IN 2   ─┐
UltraLite ─(bus B = loops)─────► M2 IN 1   ─┴─USB─► eyeZ   [the AUDIO — the whole room, incl. history]
UltraLite MAIN OUT ─► monitors / PA / your ears   (full stereo blend — unchanged by any of this)
```
Two truths this rig runs on: **MIDI = your live body only** (pacemaker, avatar, strikes). **Audio = the whole room including your loops = your history.** The split (M2 In1 = history, In2 = presence) is what lets a world tell your past from your present.

## Stage 0 — RC-600 routing (the separation seam)
System-level, set once. On the RC-600: **MENU → OUTPUT → ROUTING**
- **TRACK page:** every track 1–6 → **MAIN off, SUB1 on** (turn the knob to pick the track, press to toggle). If loops later show on only one UltraLite channel, also turn **SUB2 on**.
- **INPUT/RHYTHM page:** your live inputs (INST/MIC carrying the horn) → **MAIN on, SUB off**. (Rhythm, if you use it, → SUB with the loops — a backing pulse is history-side.)
Result: MAIN jacks = live/presence, SUB jacks = loops/history.

## Stage 1 — Silence (the floor)
Everything on, loops stopped, horn down. In ZigScope press **A**.
- **Target:** floor < ~1%, body idles at 0. (Your rig already measured **0.01%** — excellent; re-confirm in the production patch.)
- If body idles above ~0.05: a channel is turned up on nothing (pull unused UltraLite input trims down) or a ground loop (try the RC-600/UltraLite on the same power strip; a ground-lift adapter is a last resort).

## Stage 2 — Separation (prove the seam)
Press **2** in ZigScope (split mode — L = In1/history, R = In2/presence).
- Play live, **no loop** → **R moves, L stays flat.**
- Record a loop, **hands off the horn** → **L moves, R stays flat.**
- If live bleeds onto L (history): either the loop track was recorded with input-thru baked in (RC-600 record setting), or the UltraLite is summing both buses into both M2 inputs — keep the two UltraLite output buses **discrete**, one per M2 input.

## Stage 3 — Gain staging (the actual calibration)
Set levels **source → outward**, each stage healthy before the next:
1. **RC-600 output** at nominal/unity.
2. **UltraLite input trim** for the RC-600 so its meters peak around **−12 to −6 dBFS** (never hitting 0).
3. **UltraLite → M2 bus outputs** at unity. The M2 inputs are receiving **line level** from the UltraLite — set the M2 combo inputs to line, and keep the **M2 front gain knobs modest** (you're trimming a line signal, not amplifying a mic).
4. **M2 gain = the final trim.** Watch ZigScope: play your **loudest** real passage (full breath + hard tongue) and set M2 gain so **body peaks ~0.85–0.90** and the **CLIP flag never fires** (headroom stays >~10%).
5. Then play your **softest** real passage — body should still move clearly above the floor. If pp is too faint, nudge gain up and re-check the ff peak. Iterate until your **whole dynamic range (pp→ff) maps into 0→~0.9** without pinning or clipping.

## Stage 4 — Per-instrument pass (the tone ladder)
SWAM patches differ in level. Play bass clarinet, then tenor, each low/mid/high, soft→full (Session Score movement 2). If one patch is much hotter/quieter, even them in **Logic's per-track output** (preferred) or the UltraLite input trim, so a "full breath" reads the same body regardless of voice. Shine should climb with register — that's correct, don't fight it.

## Stage 5 — The Mission pedal
Confirm what it controls (volume / expression) and calibrate with it at your **normal playing position**, not heel-down — so your gain staging assumes real use. Whatever ZigScope meter moves when you sweep it (Session Score movement 6) is a **new live visual dial** the MIDI rig never had; note which one.

## Stage 6 — Capture (close the loop)
Run the full 7-movement Session Score, press **C** on each movement, save every JSON. These both **prove** the calibration and become the **fixtures** to tune Timbre to this exact rig (the way Jimmy's recording set the room floor). Drag them into the chat when done.

## Stage 7 — Lock it
Record the final settings so the production patch is reproducible: RC-600 output, UltraLite trims + routing, **M2 gain knob positions** (photograph them), Mission-pedal norm. A known-good state you can return to before any show.

## Vendors & resources
- **Sweetwater** (sweetwater.com / SweetCare) — cables, TS/TRS adapters, and genuinely good *free* phone support from engineers; our documentation source throughout. RC-600 outs are unbalanced instrument/line — plain 1/4" TS cables are correct; TRS works too.
- **MOTU** (motu.com) — drivers + routing. UltraLite **mk4/mk5** route in **"MOTU Pro Audio Control"** (browser-based mixer at the device); older UltraLites use **CueMix FX**. The **M2** is class-compliant (no driver on Mac; Windows uses the MOTU driver), gain on the front knobs, monitor/loopback in the MOTU app. *(Tell Glyph your UltraLite model — mk4 or mk5 — for exact click-by-click routing of the two buses to the M2.)*
- **Roland/BOSS** (roland.com support) — RC-600 owner's + parameter manuals for the routing pages above.

## Done when
Silence reads ~0 · live moves only R, loops only L (split mode) · loudest playing peaks body ~0.9 with no clip · softest playing still reads · all seven captures saved. Then the ZigRig is at 100% and production begins.

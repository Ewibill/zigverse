#!/usr/bin/env python3
"""
tools/timbre_extract.py — offline ZigTimbre: run the ENGINE'S EXACT analysis
over an audio file, producing the same telemetry the browser would see live.

Mirrors the browser AnalyserNode semantics faithfully:
  · fftSize 2048, Blackman window (WebAudio's window)
  · magnitude → dB → byte mapping over [minDecibels −100, maxDecibels −30]
  · freq bins normalized 0..1 exactly like _fNorm = byte/255
  · frames at 60 Hz (hop = sampleRate/60)
then applies ZigCore.Timbre._analyze term-for-term:
  · body       = min(1, rms(time) · 3.2)
  · brightness = log2(centroid/200) / log2(8000/200), clamped 0..1
  · flux       = Σ(Δ>0.04) / (Σprev + 2.0), clamped 0..1
and the same dual envelopes update() applies (rise 22 / fall 6 · bright 9 ·
flux drain τ 0.35). Output: JSON telemetry + phrase/onset structure.

usage: python3 tools/timbre_extract.py in.wav out.json "Label"
"""
import json, struct, sys, wave
import numpy as np

src, dst, label = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else "performer")

w = wave.open(src, "rb")
sr, n = w.getframerate(), w.getnframes()
raw = w.readframes(n)
w.close()
x = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0

FFT = 2048
BINS = FFT // 2
HOP = int(round(sr / 60.0))
win = np.blackman(FFT)
winGain = win.sum() / FFT  # window coherent gain, for honest dB

frames = max(0, (len(x) - FFT) // HOP)
body_r, bright_r, flux_r = [], [], []
body_s = bright_s = flux_s = 0.0
body_e, bright_e, flux_e = [], [], []
prev = None
dt = HOP / sr

for f in range(frames):
    seg = x[f * HOP: f * HOP + FFT]
    # time-domain body — engine uses the analyser's raw samples
    rms = np.sqrt(np.mean(seg * seg))
    body = min(1.0, rms * 3.2)

    mag = np.abs(np.fft.rfft(seg * win))[:BINS] / (FFT * winGain / 2.0)
    db = 20.0 * np.log10(np.maximum(mag, 1e-12))
    byte = np.clip((db - (-100.0)) / ((-30.0) - (-100.0)), 0.0, 1.0)  # getByteFrequencyData law

    hz = np.arange(BINS) * (sr / 2.0 / BINS)
    wgt = np.maximum(byte[1:] - 0.45, 0.0)   # room-floor centroid (ZigCore 0.5.2)
    mSum = wgt.sum()
    if mSum > 1e-4:
        centroid = (wgt * hz[1:]).sum() / mSum
        brightness = min(1.0, max(0.0, np.log2(max(centroid, 200.0) / 200.0) / np.log2(8000.0 / 200.0)))
    else:
        brightness = 0.0

    if prev is not None:
        d = byte[1:] - prev[1:]
        rise = d[d > 0.04].sum()
        flux = min(1.0, rise / (prev[1:].sum() + 2.0))
    else:
        flux = 0.0
    prev = byte

    # the engine's envelopes (update())
    body_s += (body - body_s) * min(1.0, dt * (22 if body > body_s else 6))
    bright_s += (brightness - bright_s) * min(1.0, dt * 9)
    flux_s = max(flux, flux_s * np.exp(-dt / 0.35))

    body_r.append(body); bright_r.append(brightness); flux_r.append(flux)
    body_e.append(body_s); bright_e.append(bright_s); flux_e.append(flux_s)

body_e = np.array(body_e); bright_e = np.array(bright_e); flux_e = np.array(flux_e)
t = np.arange(frames) * dt

# strikes: the species law — flux > 0.55, 0.25 s cooldown
strikes, last = [], -9.0
for i in range(frames):
    if flux_e[i] > 0.55 and t[i] - last > 0.25:
        strikes.append(round(float(t[i]), 3)); last = t[i]

# phrases: sound vs rest on the smoothed body (hysteresis)
PH_ON, PH_OFF = 0.14, 0.09
phrases, cur = [], None
for i in range(frames):
    if cur is None and body_e[i] > PH_ON:
        cur = [t[i], t[i], float(body_e[i])]
    elif cur is not None:
        if body_e[i] > PH_OFF:
            cur[1] = t[i]; cur[2] = max(cur[2], float(body_e[i]))
        elif t[i] - cur[1] > 0.35:
            phrases.append({"t0": round(cur[0], 2), "t1": round(cur[1], 2), "peak": round(cur[2], 3)})
            cur = None
if cur: phrases.append({"t0": round(cur[0], 2), "t1": round(cur[1], 2), "peak": round(cur[2], 3)})

active = body_e > PH_OFF
stats = {
    "label": label, "duration": round(float(t[-1]), 2), "fps": 60,
    "body":   {"mean": round(float(body_e[active].mean()), 3) if active.any() else 0,
               "p95": round(float(np.percentile(body_e, 95)), 3),
               "max": round(float(body_e.max()), 3)},
    "brightness": {"mean": round(float(bright_e[active].mean()), 3) if active.any() else 0,
                   "p05": round(float(np.percentile(bright_e[active], 5)), 3) if active.any() else 0,
                   "p95": round(float(np.percentile(bright_e[active], 95)), 3) if active.any() else 0},
    "flux":   {"p95": round(float(np.percentile(flux_e, 95)), 3),
               "max": round(float(flux_e.max()), 3)},
    "strikes": len(strikes),
    "phrases": len(phrases),
    "longestPhrase": round(max((p["t1"] - p["t0"] for p in phrases), default=0), 2),
    "silenceShare": round(float(1.0 - active.mean()), 3),
}

out = {
    "meta": stats,
    "strikes": strikes,
    "phrases": phrases,
    # 10 Hz downsampled envelopes — compact enough to commit, dense enough to drive a world
    "t10": [round(float(v), 2) for v in t[::6]],
    "body10": [round(float(v), 3) for v in body_e[::6]],
    "bright10": [round(float(v), 3) for v in bright_e[::6]],
    "flux10": [round(float(v), 3) for v in flux_e[::6]],
}
with open(dst, "w") as fh:
    json.dump(out, fh)
print(json.dumps(stats, indent=1))

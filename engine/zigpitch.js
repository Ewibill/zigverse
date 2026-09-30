/* =============================================================================
   ZigPitch 0.1.0 — what note is the room singing?
   (classic script · exposes global `ZigPitch` · pure, no DOM)

   ZigCore.Timbre hears HOW (loud, bright, breathy, struck). It never heard
   WHICH NOTE - so on a phone, where there is no MIDI, pitch was lost. This is
   the missing ear: a normalised-difference autocorrelation (the NSDF of
   McLeod & Wyvill, 2005) over the analyser's time buffer.
     detect(time, sampleRate, opts) -> { hz, note, clarity }
       time      Float32Array of samples (Timbre._time is 2048 long)
       clarity   0..1 - how periodic the sound is. A horn or a voice reads
                 ~0.9; breath noise and a room read low. Callers gate on it.
       note      MIDI note number (fractional - 69 = A4 = 440 Hz)
   Cost: the buffer is decimated by 2 and lags cover 55..1500 Hz (G1..F#6), so one call is
   ~0.4 M multiply-adds - fine at 60 fps on a phone, and only run while listening.
   ========================================================================== */
(function (global) {
  "use strict";
  const ZigPitch = {
    VERSION: "0.1.0",
    _buf: null, _nsdf: null,
    noteOf(hz) { return 69 + 12 * Math.log2(hz / 440); },
    detect(time, sampleRate, opts) {
      const o = opts || {}, fmin = o.fmin || 55, fmax = o.fmax || 1500, dec = o.decimate || 2;
      const L = Math.floor(time.length / dec), sr = sampleRate / dec;
      if (!this._buf || this._buf.length !== L) { this._buf = new Float32Array(L); this._nsdf = new Float32Array(L); }
      const b = this._buf, nsdf = this._nsdf;
      let mean = 0;
      for (let i = 0; i < L; i++) { let v = 0; for (let j = 0; j < dec; j++) v += time[i * dec + j]; b[i] = v / dec; mean += b[i]; }
      mean /= L; let energy = 0;
      for (let i = 0; i < L; i++) { b[i] -= mean; energy += b[i] * b[i]; }
      if (energy / L < 1e-7) return { hz: 0, note: 0, clarity: 0 };
      const tMin = Math.max(2, Math.floor(sr / fmax)), tMax = Math.min(L - 2, Math.ceil(sr / fmin));
      for (let t = 1; t <= tMax; t++) {                            // from lag 1, so the zero-lag lobe is really crossed
        let ac = 0, m = 0;
        for (let i = 0; i + t < L; i++) { ac += b[i] * b[i + t]; m += b[i] * b[i] + b[i + t] * b[i + t]; }
        nsdf[t] = m > 0 ? 2 * ac / m : 0;
      }
      /* McLeod's pick: the first key maximum within 90% of the highest one (avoids octave errors) */
      let maxV = -1; const peaks = [];
      let t = 1; while (t <= tMax && nsdf[t] > 0) t++;             // skip the zero-lag lobe (it starts at lag 0, not at tMin)
      for (; t <= tMax; t++) {
        if (nsdf[t] > 0) {
          let best = t; while (t <= tMax && nsdf[t] > 0) { if (nsdf[t] > nsdf[best]) best = t; t++; }
          if (best >= tMin) { peaks.push(best); if (nsdf[best] > maxV) maxV = nsdf[best]; }   // above fmax: not a pitch we accept
        }
      }
      if (!peaks.length || maxV <= 0) return { hz: 0, note: 0, clarity: 0 };
      const pk = peaks.find((p) => nsdf[p] >= 0.9 * maxV);
      /* parabolic interpolation for a sub-sample lag */
      const a = nsdf[pk - 1] || 0, c = nsdf[pk] || 0, d = nsdf[pk + 1] || 0, den = a - 2 * c + d;
      const shift = den !== 0 ? 0.5 * (a - d) / den : 0;
      const hz = sr / (pk + shift);
      return { hz, note: this.noteOf(hz), clarity: Math.max(0, Math.min(1, c)) };
    }
  };
  global.ZigPitch = ZigPitch;
})(typeof window !== "undefined" ? window : globalThis);

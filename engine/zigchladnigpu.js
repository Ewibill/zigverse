/* =============================================================================
   ZigChladniGPU 0.1.0 — the singing plate's sand, moved on the graphics card
   (classic script · exposes global `ZigChladniGPU` · needs WebGL2 + ZigShardGL)

   The SAME law as engine/zigchladni.js (ZigChladni.step + orient), mirrored in
   a vertex shader and run with transform feedback, so a big screen can carry
   150,000 grains instead of the ~40,000 a CPU can move. Nothing new is decided
   here: shake in proportion to |u| (+ a floor), a gentle slide down the slope
   of u^2, hops that gravity brings down, reflection at the plate edge, long
   grains turning to lie along the line, silence = nothing moves. Any change to
   the law belongs in zigchladni.js FIRST, then here; test/chladni_ref.mjs
   holds the law, test/_chladniboot.mjs [GPU] holds this mirror to it.

   State per grain (two vec4, double-buffered):
     A = (x, y, h, vh)    plate coords -1..1, hop height, hop speed
     B = (a, seed, spin, 0)   lying angle, seed 0..1, tumble angle

     const G = ZigChladniGPU.create(gl, N, { segments })   // null if unsupported
     G.scatter(rnd)                       // a clean plate
     G.step({ n, m, s, prev, w, E, dt, shake, floor, slide, hop, hopRate, align })
     G.draw({ vp, eye, sun, size, iri, hue, plate, tilt, aligned })
     G.sample(count) -> { x, y, h, a }    // a read-back of the first grains (tests) - WAITS for the GPU
     G.peek(count)   -> sample | null     // the same, never waits: asks once, answers a few frames
                                          // later (fence) - so a HUD reading never stalls the show
   ========================================================================== */
(function (global) {
  "use strict";
  const SIM_VS = `#version 300 es
  precision highp float;
  layout(location=0) in vec4 aA;
  layout(location=1) in vec4 aB;
  uniform vec3 uMode; uniform vec3 uPrev; uniform float uW;
  uniform float uE, uDt, uShake, uFloor, uSlide, uHop, uHopRate, uAlign, uFrame;
  out vec4 vA; out vec4 vB;
  const float PI = 3.14159265;
  float hash(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return float(x) / 4294967296.0; }
  void ug(vec3 md, vec2 p, out float u, out vec2 g) {
    float X = PI * (p.x + 1.0) * 0.5, Y = PI * (p.y + 1.0) * 0.5, h = PI * 0.5, n = md.x, m = md.y, s = md.z;
    float cnX = cos(n * X), snX = sin(n * X), cmX = cos(m * X), smX = sin(m * X);
    float cnY = cos(n * Y), snY = sin(n * Y), cmY = cos(m * Y), smY = sin(m * Y);
    u = cnX * cmY + s * cmX * cnY;
    g = h * vec2(-n * snX * cmY - s * m * smX * cnY, -m * cnX * smY - s * n * cmX * snY);
  }
  void main() {
    vec2 p = aA.xy; float h = aA.z, vh = aA.w, a = aB.x, spin = aB.z;
    float u; vec2 g; ug(uMode, p, u, g);
    if (uW < 1.0) { float u0; vec2 g0; ug(uPrev, p, u0, g0); u = mix(u0, u, uW); g = mix(g0, g, uW); }
    float amp = abs(u);
    uint base = uint(gl_VertexID) * 4u + uint(uFrame) * 2654435761u;
    float r1 = max(1e-7, hash(base + 1u)), r2 = hash(base + 2u), r3 = hash(base + 3u), r4 = hash(base + 4u);
    if (uE > 0.0) {
      float k = uShake * sqrt(uDt) * uE * (amp + uFloor), R = sqrt(-2.0 * log(r1)), sl = uSlide * uE * uDt;
      p += k * R * vec2(cos(6.2831853 * r2), sin(6.2831853 * r2)) - sl * 2.0 * u * g;
      if (p.x > 1.0) p.x = 2.0 - p.x; else if (p.x < -1.0) p.x = -2.0 - p.x;
      if (p.y > 1.0) p.y = 2.0 - p.y; else if (p.y < -1.0) p.y = -2.0 - p.y;
      p = clamp(p, -1.0, 1.0);
      if (h <= 0.0 && r3 < amp * uE * uDt * uHopRate) vh = (0.25 + 0.75 * r4) * amp * uE * uHop;
      if (uAlign > 0.0 && h <= 0.0) {                       // long grains turn to lie along the line
        float u2; vec2 g2; ug(uMode, p, u2, g2);
        if (dot(g2, g2) > 1e-6) { float d2 = 2.0 * (atan(g2.y, g2.x) + PI * 0.5 - a); a += 0.5 * atan(sin(d2), cos(d2)) * min(1.0, uAlign * uE * uDt); }
      }
    }
    if (h > 0.0 || vh > 0.0) {
      vh -= 9.0 * uDt; h += vh * uDt;
      if (h <= 0.0) { h = 0.0; vh = 0.0; }
    }
    if (h > 0.0) { spin += uDt * 9.0; a += uDt * 9.0; }       // a grain in the air tumbles
    vA = vec4(p, h, vh); vB = vec4(a, aB.y, spin, 0.0);
  }`;
  const SIM_FS = `#version 300 es
  precision highp float; out vec4 o; void main() { o = vec4(0.0); }`;
  const DRAW_VS = `#version 300 es
  layout(location=0) in vec2 aL;
  layout(location=1) in vec4 aA;
  layout(location=2) in vec4 aB;
  uniform mat4 uVP; uniform float uSize, uPlate, uTilt, uAligned;
  out vec3 vN; out vec3 vW; out float vS; out float vU;
  float hs(float x) { return fract(sin(x * 12.9898) * 43758.5453); }
  void main() {
    float seed = aB.y, h = aA.z, tb = uTilt * (1.0 + 3.0 * h);
    vec3 n = normalize(vec3((hs(seed * 7.13 + 1.0) - 0.5) * tb, -1.0, (hs(seed * 3.31 + 2.0) - 0.5) * tb));   // face down: the pale side
    float th = uAligned > 0.5 ? aB.x : aB.z; vec3 T = vec3(cos(th), 0.0, sin(th));
    vec3 t = normalize(T - n * dot(T, n)), b = cross(n, t);
    float sz = uSize * (0.75 + 0.5 * seed);
    vec3 P = vec3(aA.x * uPlate, h * 0.9 + 0.004, aA.y * uPlate);
    vec3 w = P + (t * aL.x + b * aL.y) * sz + n * (1.0 - aL.x * aL.x) * sz * 0.10;
    vN = n; vW = w; vS = seed; vU = aL.x;
    gl_Position = uVP * vec4(w, 1.0);
  }`;

  const ZigChladniGPU = {
    VERSION: "0.1.0",
    create(gl, N, opts) {
      const o = opts || {}, SG = global.ZigShardGL;
      if (!gl || !SG || !SG.program) return null;
      let sim, draw;
      try { sim = SG.program(gl, SIM_VS, SIM_FS, ["vA", "vB"]); draw = SG.program(gl, DRAW_VS, SG.FS); } catch (e) { global.console && console.warn("ZigChladniGPU:", e.message); return null; }
      const U = (p, names) => { const r = {}; names.forEach((n) => { r[n] = gl.getUniformLocation(p, n); }); return r; };
      const US = U(sim, ["uMode", "uPrev", "uW", "uE", "uDt", "uShake", "uFloor", "uSlide", "uHop", "uHopRate", "uAlign", "uFrame"]);
      const UD = U(draw, ["uVP", "uEye", "uSun", "uSize", "uIri", "uHue", "uPlate", "uTilt", "uAligned"]);
      const SH = SG.lens(o.segments || 10), VERTS = SH.length / 2;
      const bLens = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bLens); gl.bufferData(gl.ARRAY_BUFFER, SH, gl.STATIC_DRAW);
      const bA = [gl.createBuffer(), gl.createBuffer()], bB = [gl.createBuffer(), gl.createBuffer()];
      for (let i = 0; i < 2; i++) for (const b of [bA[i], bB[i]]) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, N * 16, gl.DYNAMIC_COPY); }
      const simVAO = [], drawVAO = [], tf = [];
      for (let i = 0; i < 2; i++) {
        simVAO[i] = gl.createVertexArray(); gl.bindVertexArray(simVAO[i]);
        gl.bindBuffer(gl.ARRAY_BUFFER, bA[i]); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, bB[i]); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
        drawVAO[i] = gl.createVertexArray(); gl.bindVertexArray(drawVAO[i]);
        gl.bindBuffer(gl.ARRAY_BUFFER, bLens); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, bA[i]); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(1, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, bB[i]); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(2, 1);
        tf[i] = gl.createTransformFeedback();                  // reads buffer i, writes buffer 1-i
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf[i]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bA[1 - i]); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, bB[1 - i]);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      }
      gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
      let cur = 0, frame = 1;
      const G = {
        N, gl,
        scatter(rnd) {
          const A = new Float32Array(4 * N), B = new Float32Array(4 * N);
          for (let i = 0; i < N; i++) { A[4 * i] = rnd() * 2 - 1; A[4 * i + 1] = rnd() * 2 - 1; const r = rnd() * 6.2832; B[4 * i] = r; B[4 * i + 1] = rnd(); B[4 * i + 2] = r; }
          gl.bindBuffer(gl.ARRAY_BUFFER, bA[cur]); gl.bufferSubData(gl.ARRAY_BUFFER, 0, A);
          gl.bindBuffer(gl.ARRAY_BUFFER, bB[cur]); gl.bufferSubData(gl.ARRAY_BUFFER, 0, B);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
        },
        step(p) {
          gl.useProgram(sim); gl.bindVertexArray(simVAO[cur]);
          gl.uniform3f(US.uMode, p.n, p.m, p.s);
          const pv = p.prev || p; gl.uniform3f(US.uPrev, pv.n, pv.m, pv.s); gl.uniform1f(US.uW, p.prev ? (p.w == null ? 1 : p.w) : 1);
          gl.uniform1f(US.uE, p.E); gl.uniform1f(US.uDt, p.dt);
          gl.uniform1f(US.uShake, p.shake == null ? 0.16 : p.shake); gl.uniform1f(US.uFloor, p.floor == null ? 0.07 : p.floor);
          gl.uniform1f(US.uSlide, p.slide == null ? 0.0012 : p.slide); gl.uniform1f(US.uHop, p.hop == null ? 0.9 : p.hop);
          gl.uniform1f(US.uHopRate, p.hopRate == null ? 6 : p.hopRate); gl.uniform1f(US.uAlign, p.align || 0);
          gl.uniform1f(US.uFrame, (frame = (frame + 1) % 16777216));
          gl.enable(gl.RASTERIZER_DISCARD);
          gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf[cur]);
          gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, N); gl.endTransformFeedback();
          gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
          gl.disable(gl.RASTERIZER_DISCARD); gl.bindVertexArray(null);
          cur = 1 - cur;
        },
        draw(p) {
          gl.useProgram(draw); gl.bindVertexArray(drawVAO[cur]);
          gl.uniformMatrix4fv(UD.uVP, false, p.vp); gl.uniform3fv(UD.uEye, p.eye); gl.uniform3fv(UD.uSun, p.sun || [0.25, 0.92, -0.30]);
          gl.uniform1f(UD.uSize, p.size); gl.uniform1f(UD.uIri, p.iri); gl.uniform1f(UD.uHue, p.hue);
          gl.uniform1f(UD.uPlate, p.plate || 2.0); gl.uniform1f(UD.uTilt, p.tilt == null ? 1.7 : p.tilt); gl.uniform1f(UD.uAligned, p.aligned ? 1 : 0);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, VERTS, N);
          gl.bindVertexArray(null);
        },
        sample(count) {
          const c = Math.min(N, count || N), A = new Float32Array(4 * c), B = new Float32Array(4 * c);
          gl.bindBuffer(gl.ARRAY_BUFFER, bA[cur]); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, A);
          gl.bindBuffer(gl.ARRAY_BUFFER, bB[cur]); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, B);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
          const out = { x: new Float32Array(c), y: new Float32Array(c), h: new Float32Array(c), a: new Float32Array(c) };
          for (let i = 0; i < c; i++) { out.x[i] = A[4 * i]; out.y[i] = A[4 * i + 1]; out.h[i] = A[4 * i + 2]; out.a[i] = B[4 * i]; }
          return out;
        },
        _pk: null,
        peek(count) {                                   // non-blocking: copy -> fence -> read when the GPU says it is done
          const c = Math.min(N, count || 3000), k = this._pk;
          if (k && k.sync) {
            const st = gl.getSyncParameter(k.sync, gl.SYNC_STATUS);
            if (st !== gl.SIGNALED) return null;
            gl.deleteSync(k.sync); k.sync = null;
            const A = new Float32Array(4 * k.c), B = new Float32Array(4 * k.c);
            gl.bindBuffer(gl.COPY_READ_BUFFER, k.ra); gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, A);
            gl.bindBuffer(gl.COPY_READ_BUFFER, k.rb); gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, B);
            gl.bindBuffer(gl.COPY_READ_BUFFER, null);
            const out = { x: new Float32Array(k.c), y: new Float32Array(k.c), h: new Float32Array(k.c), a: new Float32Array(k.c) };
            for (let i = 0; i < k.c; i++) { out.x[i] = A[4 * i]; out.y[i] = A[4 * i + 1]; out.h[i] = A[4 * i + 2]; out.a[i] = B[4 * i]; }
            return out;
          }
          if (!k || k.c !== c) { if (k) { gl.deleteBuffer(k.ra); gl.deleteBuffer(k.rb); }
            this._pk = { c, ra: gl.createBuffer(), rb: gl.createBuffer(), sync: null };
            for (const b of [this._pk.ra, this._pk.rb]) { gl.bindBuffer(gl.COPY_WRITE_BUFFER, b); gl.bufferData(gl.COPY_WRITE_BUFFER, c * 16, gl.STREAM_READ); } }
          const q = this._pk;
          gl.bindBuffer(gl.COPY_READ_BUFFER, bA[cur]); gl.bindBuffer(gl.COPY_WRITE_BUFFER, q.ra); gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, c * 16);
          gl.bindBuffer(gl.COPY_READ_BUFFER, bB[cur]); gl.bindBuffer(gl.COPY_WRITE_BUFFER, q.rb); gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, c * 16);
          gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
          q.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
          return null;
        },
        dispose() { [bLens, ...bA, ...bB].forEach((b) => gl.deleteBuffer(b)); simVAO.concat(drawVAO).forEach((v) => gl.deleteVertexArray(v)); tf.forEach((t) => gl.deleteTransformFeedback(t));
          if (this._pk) { if (this._pk.sync) gl.deleteSync(this._pk.sync); gl.deleteBuffer(this._pk.ra); gl.deleteBuffer(this._pk.rb); } }
      };
      return G;
    }
  };
  global.ZigChladniGPU = ZigChladniGPU;
})(typeof window !== "undefined" ? window : globalThis);

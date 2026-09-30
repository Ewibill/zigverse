/* =============================================================================
   ZigShardGL 0.1.0 — the Zigverse shard, drawn with WebGL2
   (classic script · exposes global `ZigShardGL`)

   The WebGPU engine draws the organisms; the STUDIES (Calabi-Yau, Chladni, the
   shapes to come) need something smaller that runs on any phone. This is the
   Calabi-Yau study's renderer lifted out so every shape study shares one
   shard: a cupped lens, two-tone (moss front / bone back), a firm SOLID
   terminator, thin-film iridescence at the turning edge, a specular glint, fog.

     const R = ZigShardGL.create(canvas, { preserve })   // null if no WebGL2
     R.alloc(N)                                          // instance capacity
     R.inst                                              // Float32Array(10*N):
        per shard: pos xyz · normal xyz · tangent xyz · seed (0..1)
     R.frame(dpr) -> [w, h]                              // size + clear
     R.draw(N, { vp, eye, sun, size, iri, hue })
     ZigShardGL.persp / look / mul                       // camera matrices

   The Calabi-Yau study (calabi_study.html v0.4) still carries its own copy of
   this code - it is published and in videos, so it stays frozen; new studies
   use this file.
   ========================================================================== */
(function (global) {
  "use strict";
  const VS = `#version 300 es
  layout(location=0) in vec2 aL;
  layout(location=1) in vec3 aP; layout(location=2) in vec3 aN; layout(location=3) in vec3 aT; layout(location=4) in float aS;
  uniform mat4 uVP; uniform float uSize;
  out vec3 vN; out vec3 vW; out float vS; out float vU;
  void main() {
    vec3 n = normalize(aN), t = normalize(aT - n * dot(aT, n)), b = cross(n, t);
    float sz = uSize * (0.75 + 0.5 * aS);
    vec3 w = aP + (t * aL.x + b * aL.y) * sz + n * (1.0 - aL.x * aL.x) * sz * 0.10;   // a slight cup
    vN = n; vW = w; vS = aS; vU = aL.x;
    gl_Position = uVP * vec4(w, 1.0);
  }`;
  const FS = `#version 300 es
  precision highp float;
  in vec3 vN; in vec3 vW; in float vS; in float vU;
  uniform vec3 uEye; uniform vec3 uSun; uniform float uIri; uniform float uHue;
  out vec4 o;
  void main() {
    vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(uEye - vW);
    float d = dot(n, normalize(uSun));
    float lit = smoothstep(-0.08, 0.45, d);                          // a firm terminator (SOLID)
    vec3 moss = vec3(0.10, 0.12, 0.13), bone = vec3(0.86, 0.84, 0.80);
    vec3 base = gl_FrontFacing ? moss : bone;
    vec3 c = base * (0.05 + 1.05 * lit) * vec3(0.72, 0.78, 0.95);
    float graze = pow(1.0 - abs(dot(n, v)), 1.6);
    vec3 hue = 0.5 + 0.5 * cos(6.2831 * (uHue + graze * 0.9 + vU * 0.25 + vS * 0.12 + vec3(0.0, 0.33, 0.66)));
    c += hue * graze * uIri;                                         // thin-film at the turning edge
    vec3 h = normalize(v + normalize(uSun));
    c += vec3(0.9, 0.92, 1.0) * pow(max(dot(n, h), 0.0), 60.0) * 0.6 * lit;
    float fog = exp(-0.018 * length(uEye - vW) * length(uEye - vW) * 0.02);
    o = vec4(mix(vec3(0.012, 0.014, 0.02), c, fog), 1.0);
  }`;

  function lens(SEG) {
    const SH = [];
    for (let k = 0; k < SEG; k++) {
      const a0 = Math.PI * k / SEG, a1 = Math.PI * (k + 1) / SEG;
      const pt = (a, side) => [Math.cos(a), side * 0.34 * Math.sin(a)];
      const u0 = pt(a0, 1), u1 = pt(a1, 1), d0 = pt(a0, -1), d1 = pt(a1, -1);
      SH.push(0, 0, u0[0], u0[1], u1[0], u1[1], 0, 0, d1[0], d1[1], d0[0], d0[1]);
    }
    return new Float32Array(SH);
  }

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  const ZigShardGL = {
    VERSION: "0.1.0",
    persp(f, a, nr, fr) { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fr + nr) / (nr - fr), -1, 0, 0, 2 * fr * nr / (nr - fr), 0]; },
    look(e, c) { const z = norm(sub(e, c)), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; },
    mul(a, b) { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return r; },

    create(canvas, opts) {
      const o = opts || {};
      const gl = canvas.getContext("webgl2", { antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: !!o.preserve });
      if (!gl) return null;
      const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
      const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const U = {}; ["uVP", "uEye", "uSun", "uSize", "uIri", "uHue"].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const SH = lens(10);
      const bShape = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bShape); gl.bufferData(gl.ARRAY_BUFFER, SH, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const bInst = gl.createBuffer();
      const R = {
        gl, canvas, inst: null, cap: 0,
        alloc(N) {
          this.cap = N; this.inst = new Float32Array(10 * N);
          gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, bInst); gl.bufferData(gl.ARRAY_BUFFER, this.inst.byteLength, gl.DYNAMIC_DRAW);
          [[1, 3, 0], [2, 3, 12], [3, 3, 24], [4, 1, 36]].forEach(([loc, sz, off]) => {
            gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, sz, gl.FLOAT, false, 40, off); gl.vertexAttribDivisor(loc, 1); });
          return this.inst;
        },
        frame(dpr) {
          const w = canvas.clientWidth * dpr | 0, h = canvas.clientHeight * dpr | 0;
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
          gl.viewport(0, 0, w, h); gl.clearColor(0.012, 0.014, 0.02, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
          return [w, h];
        },
        draw(N, p) {
          gl.useProgram(prog); gl.bindVertexArray(vao);
          gl.uniformMatrix4fv(U.uVP, false, p.vp); gl.uniform3fv(U.uEye, p.eye); gl.uniform3fv(U.uSun, p.sun || [0.35, 0.62, -0.30]);
          gl.uniform1f(U.uSize, p.size); gl.uniform1f(U.uIri, p.iri); gl.uniform1f(U.uHue, p.hue);
          gl.bindBuffer(gl.ARRAY_BUFFER, bInst); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.inst, 0, 10 * N);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, SH.length / 2, N);
        }
      };
      return R;
    }
  };
  global.ZigShardGL = ZigShardGL;
})(typeof window !== "undefined" ? window : globalThis);

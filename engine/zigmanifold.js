/* =============================================================================
   ZigManifold 0.1.0 — a shape with more dimensions than the room it is drawn in
   (classic script · exposes global `ZigManifold` · pure maths, no GPU)

   Steve's Calabi-Yau. What is ESTABLISHED: the mathematics. The Fermat surface
   z1^n + z2^n = 1 in two complex dimensions (four real ones) is the standard
   2D slice used for the famous Calabi-Yau images (A. Hanson's parametrisation).
   What is NOT: any claim that this is the shape of our universe's hidden
   dimensions - that is string theory, and untested. Here it is geometry only.

   The capability is the PROJECTION. The surface lives in four real dimensions;
   a 3D view keeps three of them and mixes the fourth in by an angle alpha:
       P = ( Re z1, Re z2, cos(alpha) Im z1 + sin(alpha) Im z2 )
   Turning alpha rotates the shape THROUGH a dimension the room does not have,
   so it transforms in ways no 3D object can - petals trade places, the body
   turns inside out. Performed, alpha is pitch-bend.

   Parametrisation (per patch k1, k2 in 0..n-1, z = x + i y,
   x in [-a, a], y in [0, pi/2]):
       z1 = e^(2 pi i k1 / n) * cosh(z)^(2/n)
       z2 = e^(2 pi i k2 / n) * (-i sinh(z))^(2/n)
   so z1^n + z2^n = cosh^2 - sinh^2 = 1 exactly (test/manifold_ref.mjs).
   ========================================================================== */
(function (global) {
  "use strict";
  const C = {
    mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    pow: (a, p) => { const r = Math.hypot(a[0], a[1]), t = Math.atan2(a[1], a[0]); if (r === 0) return [0, 0]; const R = Math.pow(r, p); return [R * Math.cos(p * t), R * Math.sin(p * t)]; },
    exp_i: (t) => [Math.cos(t), Math.sin(t)],
    cosh: (x, y) => [Math.cosh(x) * Math.cos(y), Math.sinh(x) * Math.sin(y)],
    sinh: (x, y) => [Math.sinh(x) * Math.cos(y), Math.cosh(x) * Math.sin(y)]
  };

  const ZigManifold = {
    VERSION: "0.1.0",
    C,
    /* the point on the Fermat surface of degree n for patch (k1, k2) at (x, y) */
    point(n, k1, k2, x, y) {
      const z1 = C.mul(C.exp_i(2 * Math.PI * k1 / n), C.pow(C.cosh(x, y), 2 / n));
      const s = C.sinh(x, y), mis = [s[1], -s[0]];                    // -i * sinh(z)
      const z2 = C.mul(C.exp_i(2 * Math.PI * k2 / n), C.pow(mis, 2 / n));
      return [z1[0], z1[1], z2[0], z2[1]];                            // Re z1, Im z1, Re z2, Im z2
    },
    /* project a 4D point into the room at angle alpha */
    project(q, alpha) { return [q[0], q[2], Math.cos(alpha) * q[1] + Math.sin(alpha) * q[3]]; },
    /* sample `count` points spread evenly over all n^2 patches, with a little
       deterministic jitter so the lattice never reads as a grid. Returns
       { n, count, q: Float64Array(4*count), qx, qy (4D tangents for normals) } */
    sample(n, count, a) {
      a = a || 1.0;
      const patches = n * n, per = Math.max(4, Math.floor(count / patches)), side = Math.max(2, Math.round(Math.sqrt(per)));
      const total = patches * side * side;
      const q = new Float64Array(4 * total), qx = new Float64Array(4 * total), qy = new Float64Array(4 * total);
      let h = 1234567, i = 0;
      const rnd = () => { h = (h * 16807) % 2147483647; return h / 2147483647; };
      const e = 1e-4;
      for (let k1 = 0; k1 < n; k1++) for (let k2 = 0; k2 < n; k2++)
        for (let u = 0; u < side; u++) for (let v = 0; v < side; v++) {
          const x = -a + 2 * a * (u + 0.2 + 0.6 * rnd()) / side, y = (Math.PI / 2) * (v + 0.2 + 0.6 * rnd()) / side;
          const p = this.point(n, k1, k2, x, y), px = this.point(n, k1, k2, x + e, y), py = this.point(n, k1, k2, x, y + e);
          for (let c = 0; c < 4; c++) { q[4 * i + c] = p[c]; qx[4 * i + c] = (px[c] - p[c]) / e; qy[4 * i + c] = (py[c] - p[c]) / e; }
          i++;
        }
      return { n, count: total, q, qx, qy };
    },
    /* positions + unit normals of a sample at angle alpha, scaled */
    frame(S, alpha, scale, outP, outN) {
      const ca = Math.cos(alpha), sa = Math.sin(alpha);
      for (let i = 0; i < S.count; i++) {
        const o = 4 * i;
        const P = [S.q[o], S.q[o + 2], ca * S.q[o + 1] + sa * S.q[o + 3]];
        const U = [S.qx[o], S.qx[o + 2], ca * S.qx[o + 1] + sa * S.qx[o + 3]];
        const V = [S.qy[o], S.qy[o + 2], ca * S.qy[o + 1] + sa * S.qy[o + 3]];
        let nx = U[1] * V[2] - U[2] * V[1], ny = U[2] * V[0] - U[0] * V[2], nz = U[0] * V[1] - U[1] * V[0];
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        outP[3 * i] = P[0] * scale; outP[3 * i + 1] = P[1] * scale; outP[3 * i + 2] = P[2] * scale;
        outN[3 * i] = nx; outN[3 * i + 1] = ny; outN[3 * i + 2] = nz;
      }
    }
  };
  global.ZigManifold = ZigManifold;
})(typeof window !== "undefined" ? window : globalThis);

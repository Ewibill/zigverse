// Emergent-shape proof: the SAME boundary law (bAccel) + cohesion + damping.
// Does the free axis actually end up the LONG one? capsule → wide (X), column → tall (Y).
import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
const ZC = globalThis.ZigCore, H = 20;
const AX = { x:0, y:1, z:2 };
function bAccel(b, rel){ const a=[0,0,0];
  if(b.shape==="cylinder"){ const cap=AX[b.axis||"y"],r1=(b.axis==="x"?AX.y:AX.x),r2=(b.axis==="z"?AX.y:AX.z);
    const rad=Math.hypot(rel[r1],rel[r2]);
    if(rad>b.r){const s=(rad-b.r)*b.k;a[r1]-=rel[r1]/rad*s;a[r2]-=rel[r2]/rad*s;}
    if(b.lo!==undefined&&rel[cap]<b.lo)a[cap]+=(b.lo-rel[cap])*b.k;
    if(b.hi!==undefined&&rel[cap]>b.hi)a[cap]+=(b.hi-rel[cap])*b.k; }
  return a; }
// deterministic PRNG (no Math.random)
let seed=12345; const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
function settle(name){
  const b=ZC.Env.boundary(name,H), N=6000, dt=1/60, damp=2.2, coh=0.6;
  const P=[],V=[];
  for(let i=0;i<N;i++){ P.push([(rnd()-.5)*H*4,(rnd()-.5)*H*4,(rnd()-.5)*H*4]); V.push([0,0,0]); }
  for(let t=0;t<600;t++){
    const c=[0,0,0]; for(const p of P){c[0]+=p[0];c[1]+=p[1];c[2]+=p[2];} c[0]/=N;c[1]/=N;c[2]/=N;
    for(let i=0;i<N;i++){ const p=P[i],v=V[i]; const a=bAccel(b,p);
      for(let k=0;k<3;k++) a[k]+=(c[k]-p[k])*coh;                 // gentle cohesion to a shared body
      for(let k=0;k<3;k++){ v[k]+=a[k]*dt; v[k]*=(1-dt*damp); p[k]+=v[k]*dt; } }
  }
  const ext=k=>{let lo=1e9,hi=-1e9;for(const p of P){lo=Math.min(lo,p[k]);hi=Math.max(hi,p[k]);}return hi-lo;};
  return { x:ext(0), y:ext(1), z:ext(2) };
}
const cap=settle("capsule"), col=settle("column");
console.log(`capsule  X=${cap.x.toFixed(1)}  Y=${cap.y.toFixed(1)}  Z=${cap.z.toFixed(1)}   (X/Y aspect ${(cap.x/cap.y).toFixed(2)})`);
console.log(`column   X=${col.x.toFixed(1)}  Y=${col.y.toFixed(1)}  Z=${col.z.toFixed(1)}   (Y/X aspect ${(col.y/col.x).toFixed(2)})`);
let fail=0; const ok=(c,m)=>{if(!c){console.log("  FAIL:",m);fail++;}};
ok(cap.x > cap.y*1.5, "capsule runs WIDE — X clearly the long axis (a cigar lying down)");
ok(col.y > col.x*1.5, "column runs TALL — Y clearly the long axis (a cigar stood up)");
ok(Math.abs(cap.y-cap.z)<cap.x*0.5 && Math.abs(col.x-col.z)<col.y*0.5, "each has a round cross-section (a true tube, not a slab)");
console.log(fail?`\nCIGAR SHAPE: FAIL (${fail})`:"\nCIGAR SHAPE: PASS — the free axis emerges as the long axis, mirror poses");
process.exit(fail?1:0);

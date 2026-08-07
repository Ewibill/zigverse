// Does the lens (short-Y ellipsoid) actually spread the mass WIDER than a round ball?
// Needs SEPARATION (agents resist overlap) so squeezing Y conserves volume into X/Z.
import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
const ZC = globalThis.ZigCore, H = 20;
function bAccel(b, rel){ const a=[0,0,0];
  if(b.shape==="sphere"){ const d=Math.hypot(...rel); if(d>b.r){const s=(d-b.r)*b.k;for(let k=0;k<3;k++)a[k]-=rel[k]/d*s;} }
  else if(b.shape==="ellipsoid"){ const R=[b.rx,b.ry,b.rz],s=rel.map((v,k)=>v/R[k]),bd=Math.hypot(...s);
    if(bd>1){const g=s.map((v,k)=>v/R[k]),gn=Math.hypot(...g),kEff=b.k*(R[0]+R[1]+R[2])/3;for(let k=0;k<3;k++)a[k]-=g[k]/gn*(bd-1)*kEff;} }
  return a; }
let seed=99; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
function settle(bnd){
  const b=ZC.Env.boundary(bnd,H),N=900,dt=1/60,damp=2.4,coh=0.5,sep=9.0,sr=3.2;
  const P=[],V=[];
  for(let i=0;i<N;i++){P.push([(rnd()-.5)*H*3,(rnd()-.5)*H*3,(rnd()-.5)*H*3]);V.push([0,0,0]);}
  // uniform grid for separation
  for(let t=0;t<260;t++){
    const c=[0,0,0];for(const p of P){c[0]+=p[0];c[1]+=p[1];c[2]+=p[2];}c[0]/=N;c[1]/=N;c[2]/=N;
    const cell=sr,grid=new Map(),key=p=>`${Math.floor(p[0]/cell)},${Math.floor(p[1]/cell)},${Math.floor(p[2]/cell)}`;
    P.forEach((p,i)=>{const k=key(p);(grid.get(k)||grid.set(k,[]).get(k)).push(i);});
    for(let i=0;i<N;i++){const p=P[i],v=V[i],a=bAccel(b,p);
      for(let k=0;k<3;k++)a[k]+=(c[k]-p[k])*coh;                     // cohesion
      const gx=Math.floor(p[0]/cell),gy=Math.floor(p[1]/cell),gz=Math.floor(p[2]/cell);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
        const nb=grid.get(`${gx+dx},${gy+dy},${gz+dz}`);if(!nb)continue;
        for(const j of nb){if(j===i)continue;const d=[p[0]-P[j][0],p[1]-P[j][1],p[2]-P[j][2]],dd=Math.hypot(...d);
          if(dd>1e-4&&dd<sr){const f=sep*(1-dd/sr)/dd;for(let k=0;k<3;k++)a[k]+=d[k]*f;}}}   // separation
      for(let k=0;k<3;k++){v[k]+=a[k]*dt;v[k]*=(1-dt*damp);p[k]+=v[k]*dt;}}
  }
  const ext=k=>{let lo=1e9,hi=-1e9;for(const p of P){lo=Math.min(lo,p[k]);hi=Math.max(hi,p[k]);}return hi-lo;};
  return {x:ext(0),y:ext(1),z:ext(2)};
}
const sph=settle("vessel"), lens=settle("lens");
console.log(`sphere(vessel)  X=${sph.x.toFixed(1)}  Y=${sph.y.toFixed(1)}   (X/Y ${(sph.x/sph.y).toFixed(2)})`);
console.log(`lens            X=${lens.x.toFixed(1)}  Y=${lens.y.toFixed(1)}   (X/Y ${(lens.x/lens.y).toFixed(2)})`);
console.log(`→ lens is ${(lens.x/sph.x*100-100).toFixed(0)}% wider in X and ${(100-lens.y/sph.y*100).toFixed(0)}% shorter in Y than the round ball`);
let fail=0;const ok=(c,m)=>{if(!c){console.log("  FAIL:",m);fail++;}};
ok(lens.x/lens.y > 1.8, "lens reads as a squashed circle — clearly wider than tall");
ok(lens.x > sph.x, "the Y-squeeze pushes the mass WIDER than a round ball (fills the sides)");
ok(lens.y < sph.y, "the lens is shorter than the round ball (flattened top & bottom)");
ok(Math.abs(lens.x-lens.z) < lens.x*0.35, "lens stays symmetric in the horizontal plane (round when spun on the vertical → consistent wide silhouette)");
console.log(fail?`\nLENS SHAPE: FAIL (${fail})`:"\nLENS SHAPE: PASS — the squeeze spreads it into a wide, consistent squashed circle");
process.exit(fail?1:0);

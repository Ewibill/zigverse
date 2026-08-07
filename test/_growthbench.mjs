// _growthbench.mjs — boot probe for growth_bench.html. Replicates the page's exact
// simulation loop in node and proves the PERFORMED BODY behaves, since the canvas
// cannot be seen from here. Also records the law's current honest limit.
import { readFileSync } from "fs";
(0, eval)(readFileSync(new URL("../engine/zigcore.js", import.meta.url), "utf8"));
const S = globalThis.ZigCore.Structure, ZC = globalThis.ZigCore, H = 20, CAP = 900;

function run(bn, notes, cur, settle, fpn) {
  const bond = ZC.Env.bond(bn, H);
  const st = { n: 1, pos: new Float64Array(CAP*3), vel: new Float64Array(CAP*3), par: new Int32Array(CAP).fill(-1) };
  const acc = new Float64Array(CAP*3); let hd = [0,1,0];
  const step = (dt) => { const sub=4, h=dt/sub;
    for (let s=0;s<sub;s++){ acc.fill(0,0,st.n*3); S.accel(bond, st.pos, st.vel, st.par, st.n, acc);
      for(let i=0;i<st.n;i++){acc[i*3]+=cur; acc[i*3+1]-=1.6; acc[i*3]-=st.vel[i*3]*0.9; acc[i*3+1]-=st.vel[i*3+1]*0.9;}
      for(let i=0;i<st.n;i++){ if(bond.anchor&&st.par[i]<0){st.vel[i*3]=st.vel[i*3+1]=0;continue;}
        for(let k=0;k<2;k++){st.vel[i*3+k]+=acc[i*3+k]*h; st.pos[i*3+k]+=st.vel[i*3+k]*h;} } } };
  /* straightness = chord / CONTOUR (sum of actual link lengths). Bounded 0..1:
     1.0 is a straight body, lower is curled. Dividing by nominal length instead
     lets stretch masquerade as straightness — it can exceed 1 and means nothing. */
  const straight = () => { let c=0; for(let i=1;i<st.n;i++) c+=Math.hypot(st.pos[i*3]-st.pos[st.par[i]*3], st.pos[i*3+1]-st.pos[st.par[i]*3+1]);
    return c>0 ? Math.hypot(st.pos[(st.n-1)*3]-st.pos[0], st.pos[(st.n-1)*3+1]-st.pos[1]) / c : 1; };
  for (const sm of notes) {
    const th=sm*0.13, c=Math.cos(th), sn=Math.sin(th);
    const hx=hd[0]*c-hd[1]*sn, hy=hd[0]*sn+hd[1]*c, L=Math.hypot(hx,hy)||1; hd=[hx/L,hy/L,0];
    const i=S.grow(st,bond,hd); st.vel[i*3]=hd[0]*1.7; st.vel[i*3+1]=hd[1]*1.7;
    for(let f=0;f<(fpn===undefined?8:fpn);f++) step(1/60);
  }
  const atGrowth = straight();
  for(let f=0;f<(settle===undefined?240:settle);f++) step(1/60);
  return { st, bond, atGrowth, settled: straight() };
}
const dist=(p,a,b)=>Math.hypot(p[a*3]-p[b*3], p[a*3+1]-p[b*3+1]);
let fail=0; const ok=(c,m)=>{ if(!c){console.log("  FAIL:",m); fail++;} };

// 1) a played stream builds a body that holds together
{
  const notes=[]; for(let i=0;i<40;i++) notes.push(0);
  const {st,bond}=run("spine",notes,0.8);
  ok(st.n===41, `40 notes → ${st.n} segments`);
  let mx=0,mn=1e9; for(let i=1;i<st.n;i++){const d=dist(st.pos,i,st.par[i]); mx=Math.max(mx,d); mn=Math.min(mn,d);}
  ok(mx<bond.rest*1.25 && mn>bond.rest*0.8, `body holds together (links ${mn.toFixed(2)}–${mx.toFixed(2)} vs rest ${bond.rest})`);
}
// 2) age is the history channel
{
  const notes=[]; for(let i=0;i<24;i++) notes.push(1);
  const {st}=run("chain",notes,0.4); const d=Math.max(1,st.n-1);
  ok(S.age(st.par,0,d)===0 && Math.abs(S.age(st.par,st.n-1,d)-1)<1e-9, "age spans 0 (root) → 1 (tail)");
  let mono=true; for(let i=1;i<st.n;i++) if(S.age(st.par,i,d)<=S.age(st.par,i-1,d)) mono=false;
  ok(mono, "age strictly monotonic — position along the body IS time-since-played");
}
// 3) interval genuinely bends the growth: the contour EXISTS at the moment it is drawn
{
  const rise=[], flat=[]; for(let i=0;i<20;i++){ rise.push(2); flat.push(0); }
  // fpn=0 → pure growth geometry, no relaxation between notes
  const a=run("chain",rise,0,0,0), b=run("chain",flat,0,0,0);
  ok(a.atGrowth < b.atGrowth*0.7, `interval draws a curve (rising ${a.atGrowth.toFixed(2)} vs flat ${b.atGrowth.toFixed(2)})`);
  ok(b.atGrowth > 0.98, `a flat line draws straight (${b.atGrowth.toFixed(3)})`);
}
// 4) BEND IS THE MEMORY DIAL — how much of the played shape the body keeps.
//    A rope has no opinion and keeps the contour it was drawn with; a spine has
//    its own idea of straight and argues with the melody. Same stream, two creatures.
{
  const rise=[]; for(let i=0;i<20;i++) rise.push(2);
  const drawn = run("chain",rise,0,0,0).atGrowth;              // pure growth geometry
  const rope  = run("chain",rise,0.4).settled;
  const spine = run("spine",rise,0.4).settled;
  ok(drawn < 0.35, `interval draws a strong curve (${drawn.toFixed(2)})`);
  ok(rope < drawn*1.2, `a ROPE keeps the shape it was played (${drawn.toFixed(2)} → ${rope.toFixed(2)})`);
  ok(spine > rope*1.8, `a SPINE argues back toward straight (${drawn.toFixed(2)} → ${spine.toFixed(2)})`);
  ok(spine < 0.9, "…but never fully wins — the performance still marks the body");
}
// 5) anchored stalk, and stability under a long stream
{
  const notes=[]; for(let i=0;i<20;i++) notes.push(0);
  const {st}=run("stalk",notes,3.0);
  ok(Math.hypot(st.pos[0],st.pos[1])<1e-9, "stalk holdfast never moves under current");
  ok(st.pos[(st.n-1)*3]>1, `tip streams downstream (x ${st.pos[(st.n-1)*3].toFixed(2)})`);
  const long=[]; for(let i=0;i<200;i++) long.push((i%7)-3);
  const L=run("spine",long,4.0);
  let finite=true; for(let i=0;i<L.st.n*3;i++) if(!Number.isFinite(L.st.pos[i])) finite=false;
  ok(finite && L.st.n===201, `200 notes at high current: ${L.st.n} segments, all finite — stable`);
}
console.log(fail?`_growthbench: ${fail} FAIL`:"_growthbench: PASS");
process.exit(fail?1:0);

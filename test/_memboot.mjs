import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(f,fn){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+f); await p.waitForTimeout(2600);
  let extra={}; if(fn) extra=await fn(p);
  const eng=await p.evaluate(()=>((document.getElementById("engine")||{}).textContent||""));
  const err=e.filter(x=>!KNOWN.test(x)); await p.close(); return {f,eng,err,...extra}; }
// memory file: mem-back shows; hold breath (B) → memGlow rises
const m=await boot("dist/Environment_v2.5_memory.html", async(p)=>{
  const g0=(await p.evaluate(()=>((document.getElementById("engine")||{}).textContent||"").match(/mem-back (\d+)%/)?.[1]));
  await p.keyboard.down("KeyB"); await p.waitForTimeout(900); const gHi=(await p.evaluate(()=>((document.getElementById("engine")||{}).textContent||"").match(/mem-back (\d+)%/)?.[1]));
  await p.keyboard.up("KeyB"); await p.waitForTimeout(1500); const gLo=(await p.evaluate(()=>((document.getElementById("engine")||{}).textContent||"").match(/mem-back (\d+)%/)?.[1]));
  return {g0,gHi,gLo}; });
// regression: demos without memback must stay clean
const demos=["zigmedium.html","lake.html","fireflies.html","sickleswarm.html","zigmaterialfield.html","zigmurmuration.html","halofield.html"];
let anyfail=m.err.length>0;
for(const f of demos){ const r=await boot(f); if(r.err.length){anyfail=true;console.log("FAIL",f,r.err[0].slice(0,100));} else console.log("ok  ",f); }
console.log("memory file: mem-back rest",m.g0,"→ breath",m.gHi,"→ after release",m.gLo," hard:",m.err.length);
await b.close();
const ok=!anyfail && m.g0 && parseInt(m.gHi)>parseInt(m.g0) && parseInt(m.gLo)<parseInt(m.gHi);
console.log(ok?"\nMEMORY: PASS":"\nMEMORY: FAIL"); process.exit(ok?0:1);

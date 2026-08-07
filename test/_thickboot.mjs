import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(f){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+f); await p.waitForTimeout(2800);
  const st=await p.evaluate(()=>((document.getElementById("status")||{}).textContent||"").slice(0,60));
  const err=e.filter(x=>!KNOWN.test(x)); await p.close(); return {f,st,err}; }
const t=await boot("dist/Environment_v2.8_thickness.html");
const demos=["zigmedium.html","zigmaterialfield.html","lake.html","sickleswarm.html","zigmurmuration.html"];
let anyfail=t.err.length>0;
for(const f of demos){ const r=await boot(f); if(r.err.length){anyfail=true;console.log("FAIL",f,r.err[0].slice(0,90));} else console.log("ok  ",f); }
console.log("thick file:",JSON.stringify(t.st),"hard:",t.err.length);
await b.close();
console.log(anyfail?"\nTHICK: FAIL":"\nTHICK: PASS"); process.exit(anyfail?1:0);

import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(f,keys=[]){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+f); await p.waitForTimeout(2500);
  for(const k of keys){await p.keyboard.press(k);await p.waitForTimeout(90);}
  await p.waitForTimeout(250);
  const eng=await p.evaluate(()=>((document.getElementById("engine")||{}).textContent||""));
  const err=e.filter(x=>!KNOWN.test(x)); await p.close(); return {f,eng,err}; }
const files=["dist/Environment_v2.3_studio6000.html","zigmaterialfield.html","zigmedium.html","lake.html","fireflies.html","zigmurmuration.html","sickleswarm.html","halofield.html"];
let anyfail=false;
for(const f of files){ const r=await boot(f); if(r.err.length){anyfail=true;console.log("FAIL",f,"("+r.err.length+")",r.err[0].slice(0,110));} else console.log("ok  ",f); }
const c=await boot("dist/Environment_v2.3_studio6000.html",["Digit2","Digit2"]);
console.log("studio file light after 2×'2':",(c.eng.match(/light ([0-9.]+)/)||[])[1]);
await b.close();
console.log(anyfail?"\nSTUDIO: FAIL":"\nSTUDIO: PASS"); process.exit(anyfail?1:0);

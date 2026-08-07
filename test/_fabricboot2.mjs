import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(url){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+url); await p.waitForTimeout(2400);
  const err=e.filter(x=>!KNOWN.test(x)); await p.close(); return err; }
let anyfail=false;
for(const f of ["wool","cashmere","burlap","tweed","taffeta"]){ const e=await boot("dist/Environment_v3.0_fabrics.html#fabric="+f); if(e.length){anyfail=true;console.log("FAIL",f,e[0].slice(0,80));} else console.log("ok  ",f); }
for(const d of ["zigmedium.html","zigmaterialfield.html","sickleswarm.html","dist/Environment_v2.8_thickness.html"]){ const e=await boot(d); if(e.length){anyfail=true;console.log("FAIL",d,e[0].slice(0,80));} else console.log("ok  ",d); }
await b.close();
console.log(anyfail?"\nFABRIC2: FAIL":"\nFABRIC2: PASS"); process.exit(anyfail?1:0);

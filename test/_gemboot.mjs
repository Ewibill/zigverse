import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(url){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+url); await p.waitForTimeout(2400);
  const st=await p.evaluate(()=>((document.getElementById("status")||{}).textContent||"").slice(0,40));
  const err=e.filter(x=>!KNOWN.test(x)); await p.close(); return {url,st,err}; }
let anyfail=false;
for(const g of ["diamond","ruby","sapphire","emerald","amethyst","topaz","aquamarine","garnet","citrine","peridot"]){ const r=await boot("dist/Environment_v3.1_gems.html#gem="+g); if(r.err.length){anyfail=true;console.log("FAIL",g,r.err[0].slice(0,90));} else console.log("ok  ",g,"·",r.st.slice(0,20)); }
for(const d of ["zigmedium.html","zigmaterialfield.html","sickleswarm.html","dist/Environment_v3.0_fabrics.html"]){ const r=await boot(d); if(r.err.length){anyfail=true;console.log("FAIL",d,r.err[0].slice(0,90));} else console.log("ok  ",d); }
await b.close();
console.log(anyfail?"\nGEM: FAIL":"\nGEM: PASS"); process.exit(anyfail?1:0);

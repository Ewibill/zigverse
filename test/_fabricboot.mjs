import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(fab){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/dist/Environment_v3.0_fabrics.html"+(fab?("#fabric="+fab):"")); await p.waitForTimeout(2400);
  const nfab=await p.evaluate(()=>window.SickleField?1:0);
  const err=e.filter(x=>!KNOWN.test(x)); await p.close(); return {fab:fab||"default",err}; }
// cover every weave+sheen family
const fabs=["velvet","silk","satin","denim","linen","suede","felt","corduroy","leather","lame","herringbone","organza","brocade","chiffon","canvas"];
let anyfail=false;
for(const f of fabs){ const r=await boot(f); if(r.err.length){anyfail=true;console.log("FAIL",f,"·",r.err[0].slice(0,90));} else console.log("ok  ",f); }
await b.close();
console.log(anyfail?"\nFABRIC: FAIL":"\nFABRIC: PASS"); process.exit(anyfail?1:0);

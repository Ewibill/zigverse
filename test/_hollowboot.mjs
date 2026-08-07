import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(f){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+f); await p.waitForTimeout(2700);
  const st=await p.evaluate(()=>((document.getElementById("status")||{}).textContent||"").slice(0,45));
  const err=e.filter(x=>!KNOWN.test(x)); await p.close(); return {f,st,err}; }
const concave=await boot("dist/Environment_v2.8_concave.html");
const convex=await boot("dist/Environment_v2.8_thickness.html");
console.log("concave:",JSON.stringify(concave.st),"hard",concave.err.length);
console.log("convex :",JSON.stringify(convex.st),"hard",convex.err.length);
await b.close();
const ok=concave.err.length===0&&convex.err.length===0;
console.log(ok?"\nHOLLOW: PASS":"\nHOLLOW: FAIL"); process.exit(ok?0:1);

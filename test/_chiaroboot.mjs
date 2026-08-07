import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(f){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+f); await p.waitForTimeout(2600);
  const st=await p.evaluate(()=>((document.getElementById("status")||{}).textContent||"").slice(0,60));
  const hard=e.filter(x=>!KNOWN.test(x)).length; await p.close(); return {f,st,hard}; }
const chiaro=await boot("dist/Environment_v2.1_shapes_chiaro.html");   // CHIARO 0.85 + material(nacre)
const plain=await boot("zigmurmuration.html");                          // no chiaro → must stay clean
console.log("chiaro build:",JSON.stringify(chiaro.st),"hard",chiaro.hard);
console.log("no-chiaro demo:",JSON.stringify(plain.st),"hard",plain.hard);
await b.close();
const ok=chiaro.hard===0 && plain.hard===0 && /fps|letterforms/i.test(chiaro.st);
console.log(ok?"\nCHIARO BOOT: PASS":"\nCHIARO BOOT: FAIL"); process.exit(ok?0:1);

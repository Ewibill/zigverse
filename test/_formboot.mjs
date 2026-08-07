import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(f){const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});await p.goto("file:///home/claude/zigverse/"+f);await p.waitForTimeout(3200);await p.keyboard.press("KeyB");await p.waitForTimeout(400);const s=await p.evaluate(()=>(document.getElementById("status")||{}).textContent||"");await p.close();return{f,s:s.slice(0,46),h:e.filter(x=>!KNOWN.test(x))}}
const r=[];for(const f of ["dist/Age_To_Form_v0.1.html","dist/Form_Mix_v0.1.html","zigaging.html","dist/The_Alphabet_v0.1.html","zigmurmuration.html"]) r.push(await boot(f));
for(const x of r) console.log(x.f, JSON.stringify(x.s), "hard:", x.h.length, x.h.map(z=>z.slice(0,130)).join(" | "));
await b.close();const ok=r.every(x=>x.h.length===0&&/fps|letterforms/i.test(x.s));console.log(ok?"FORM BOOT: PASS":"FORM BOOT: FAIL");process.exit(ok?0:1);

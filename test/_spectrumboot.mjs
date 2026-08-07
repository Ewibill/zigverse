import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(f,keys){const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});await p.goto("file:///home/claude/zigverse/"+f);await p.waitForTimeout(3200);await p.keyboard.press("KeyB");await p.waitForTimeout(300);for(const k of (keys||[])){await p.keyboard.press(k);await p.waitForTimeout(180);}const s=await p.evaluate(()=>(document.getElementById("status")||{}).textContent||"");const eng=await p.evaluate(()=>(document.getElementById("engine")||{}).textContent||"");await p.close();return{f,s:s.slice(0,60),eng:eng.slice(0,60),h:e.filter(x=>!KNOWN.test(x))}}
const r=[];
// spectrum world: exercise Q (rotate) + N (letter toggle)
r.push(await boot("zigspectrum.html",["KeyQ","KeyQ","KeyN","KeyI"]));
// regression: SPECTRUM off must still boot clean (byte-identical path)
r.push(await boot("zigaging.html",[]));
r.push(await boot("dist/Age_To_Form_v0.1.html",[]));
for(const x of r) console.log(x.f, "status:", JSON.stringify(x.s), "| engine:", JSON.stringify(x.eng), "| hard:", x.h.length, x.h.map(z=>z.slice(0,140)).join(" || "));
await b.close();
const ok=r.every(x=>x.h.length===0 && /fps|letterform|alive|spectrum|re-dress|wardrobe/i.test(x.s+" "+x.eng));
console.log(ok?"SPECTRUM BOOT: PASS":"SPECTRUM BOOT: FAIL");process.exit(ok?0:1);

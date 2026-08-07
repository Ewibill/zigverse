import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Spectrum_v0.15_surfacepicker.html");await p.waitForTimeout(3200);await p.keyboard.press("KeyB");await p.waitForTimeout(300);await p.keyboard.press("KeyQ");await p.waitForTimeout(200);await p.keyboard.press("KeyN");await p.waitForTimeout(200);
const s=await p.evaluate(()=>(document.getElementById("status")||{}).textContent||"");
const hard=e.filter(x=>!KNOWN.test(x));
console.log("BUNDLE status:",JSON.stringify(s.slice(0,60)),"hard:",hard.length,hard.map(z=>z.slice(0,140)).join(" || "));
await b.close();process.exit(hard.length===0 && /fps|letterform/i.test(s)?0:1);

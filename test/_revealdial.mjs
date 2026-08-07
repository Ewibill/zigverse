import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v1.1_wardrobe.html#world=custom&mat=nacre");
await p.waitForTimeout(3000);
const get=async(re)=>{const t=await p.evaluate(()=>(document.getElementById("hud")||{}).innerText||"");const m=t.match(re);return m?m[1]:"?";};
const let0=await get(/× ([A-Z]+)/), rev0=await get(/reveal ([0-9.]+)/);
await p.keyboard.press("KeyN");await p.waitForTimeout(250);
const let1=await get(/× ([A-Z]+)/);
for(let k=0;k<6;k++){await p.keyboard.press("Digit6");await p.waitForTimeout(70);}
const rev1=await get(/reveal ([0-9.]+)/);
console.log("letter:",let0,"→ N →",let1);
console.log("reveal:",rev0,"→ 6×6 →",rev1);
console.log("live:",/fps/.test(await p.evaluate(()=>(document.getElementById("status")||{}).textContent||"")),"hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();

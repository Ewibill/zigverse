import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v1.0_spectrum.html#world=custom&mat=nacre");
await p.waitForTimeout(3000);
const g=async(re)=>{const t=await p.evaluate(()=>(document.getElementById("hud")||{}).innerText||"");const m=t.match(re);return m?m[1]:"(none)";};
const s0=await g(/spread ([0-9.]+)/);
for(let k=0;k<6;k++){await p.keyboard.press("Digit8");await p.waitForTimeout(70);}
const s1=await g(/spread ([0-9.]+)/);
console.log("spread @default:",s0,"| after 6×8:",s1);
console.log("live:",/fps/.test(await p.evaluate(()=>(document.getElementById("status")||{}).textContent||"")),"hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();

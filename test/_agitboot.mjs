import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v0.6_vitrine.html#world=tidepool&stage=soft");
await p.waitForTimeout(2800);
const hud0=await p.evaluate(()=>(document.getElementById("engine")||document.getElementById("hud")||{}).textContent||"");
// press ';' four times → calmer
for(let k=0;k<4;k++){await p.keyboard.press("Semicolon");await p.waitForTimeout(60);}
const hudCalm=await p.evaluate(()=>(document.getElementById("hud")||{}).innerText||"");
// press ''' twice → busier
for(let k=0;k<2;k++){await p.keyboard.press("Quote");await p.waitForTimeout(60);}
const hudBusy=await p.evaluate(()=>(document.getElementById("hud")||{}).innerText||"");
const live=await p.evaluate(()=>/fps/.test((document.getElementById("status")||{}).textContent||""));
const g=(s)=>{const m=s.match(/agit ([0-9.]+)/);return m?m[1]:"?";};
console.log("agit after 4×';' (want ~0.6):",g(hudCalm));
console.log("agit after +2×\"'\" (want ~0.8):",g(hudBusy));
console.log("live:",live,"hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();

import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v0.8_compose.html#world=custom&med=water&force=neutral&cur=neutral&mat=nacre");
await p.waitForTimeout(3000);
const st=await p.evaluate(()=>(document.getElementById("status")||{}).textContent||"");
// bump ink up with I to see spectrum bloom
for(let k=0;k<6;k++){await p.keyboard.press("KeyI");await p.waitForTimeout(60);}
const hud=await p.evaluate(()=>(document.getElementById("hud")||{}).innerText||"");
const inkm=hud.match(/ink ([0-9.]+)/);
console.log("status:",st.slice(0,40));
console.log("ink after 6×I:",inkm?inkm[1]:"?");
console.log("hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();

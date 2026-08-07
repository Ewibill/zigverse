import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Material_Studio.html");
await p.waitForTimeout(2500);
const seen=[];
// walk left from sicklePetal → wraps to burr, scallop, crook, drop, plume, thorn (the six new, reverse order)
for(let k=0;k<6;k++){await p.keyboard.press("ArrowLeft");await p.waitForTimeout(150);seen.push(await p.evaluate(()=>(document.getElementById("params")||{}).textContent.split(" in ")[0]||""));}
console.log("stepped to:",seen.join(" · "));
console.log("hard errors:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();

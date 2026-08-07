import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v2.6_memory.html"); await p.waitForTimeout(2600);
const mem=async()=>await p.evaluate(()=>{const t=(document.getElementById("engine")||{}).textContent||"";return (t.match(/mem-back ([^·]+)/)||[])[1]?.trim();});
const on0=await mem();
// Shift+M → off
await p.keyboard.down("ShiftLeft"); await p.keyboard.press("KeyM"); await p.keyboard.up("ShiftLeft"); await p.waitForTimeout(150);
const off=await mem();
// Shift+M → on
await p.keyboard.down("ShiftLeft"); await p.keyboard.press("KeyM"); await p.keyboard.up("ShiftLeft"); await p.waitForTimeout(150);
const on1=await mem();
// plain M should NOT toggle (it's Kmax); mem stays on
await p.keyboard.press("KeyM"); await p.waitForTimeout(120);
const afterPlainM=await mem();
console.log("mem at boot:",on0," after Shift+M:",off," after Shift+M again:",on1," after plain M:",afterPlainM);
console.log("hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();
const ok = on0 && on0!=="off" && off==="off" && on1!=="off" && afterPlainM!=="off" && e.filter(x=>!KNOWN.test(x)).length===0;
console.log(ok?"\nMEMTOGGLE: PASS":"\nMEMTOGGLE: FAIL"); process.exit(ok?0:1);

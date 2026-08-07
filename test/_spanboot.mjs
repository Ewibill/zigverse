import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function fresh(){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/dist/Environment_v2.4_studio6000.html"); await p.waitForTimeout(2600); return {p,e}; }
const rd=async(p,re)=>await p.evaluate((r)=>{const t=(document.getElementById("engine")||{}).textContent||"";const m=t.match(new RegExp(r));return m?m[1]:null;},re);
// A: default span
let {p,e}=await fresh(); const s0=await rd(p,"span ([0-9.]+)"); await p.close();
// B: plain 8 → spread up, span UNCHANGED
({p,e}=await fresh()); const spanB0=await rd(p,"span ([0-9.]+)"), sprB0=await rd(p,"spread ([0-9.]+)");
for(let i=0;i<3;i++){await p.keyboard.press("Digit8");await p.waitForTimeout(100);}
const spanB1=await rd(p,"span ([0-9.]+)"), sprB1=await rd(p,"spread ([0-9.]+)"); await p.close();
// C: Shift+8 → span up
({p,e}=await fresh()); 
for(let i=0;i<3;i++){await p.keyboard.down("ShiftLeft");await p.keyboard.press("Digit8");await p.keyboard.up("ShiftLeft");await p.waitForTimeout(100);}
const spanC=await rd(p,"span ([0-9.]+)"); const hard=e.filter(x=>!KNOWN.test(x)).length; await p.close();
await b.close();
console.log("A default span:",s0);
console.log("B plain-8: span",spanB0,"→",spanB1," spread",sprB0,"→",sprB1);
console.log("C Shift+8×3: span",spanB0,"→",spanC);
const ok = s0==="0.35" && spanB1===spanB0 && parseFloat(sprB1)>parseFloat(sprB0) && parseFloat(spanC)>parseFloat(spanB0) && hard===0;
console.log(ok?"\nSPAN: PASS":"\nSPAN: FAIL"); process.exit(ok?0:1);

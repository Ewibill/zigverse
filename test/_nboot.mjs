import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v1.6_reveal.html");
await p.waitForTimeout(2800);
const rd=async()=>await p.evaluate(()=>{const t=(document.getElementById("engine")||{}).textContent||"";return{letter:(t.match(/wardrobe (\w+)/)||[])[1]||(t.match(/× (\w+)/)||[])[1], reveal:parseFloat((t.match(/reveal ([0-9.]+)/)||[])[1])};});
const idle=await rd();                       // resting (EWI armed, no note) — reveal should NOT be pinned to 0.22
await p.keyboard.press("KeyN"); await p.waitForTimeout(120);
const justAfterN=await rd();                 // N pressed → preview bloom should raise reveal
const l1=justAfterN.letter;
await p.keyboard.press("KeyN"); await p.waitForTimeout(120);
const l2=(await rd()).letter;
await p.waitForTimeout(1600);                 // let the preview ease out
const settled=await rd();
console.log("idle:",JSON.stringify(idle));
console.log("after N #1:",JSON.stringify(justAfterN));
console.log("letter N#1 → N#2:",l1,"→",l2);
console.log("settled reveal after preview:",settled.reveal);
console.log("hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();
const nameChanged = l1 && l2 && l1!==l2;
const previewBloomed = justAfterN.reveal > idle.reveal + 0.4;
const easedBack = settled.reveal < justAfterN.reveal - 0.2;
const ok = nameChanged && previewBloomed && easedBack && e.filter(x=>!KNOWN.test(x)).length===0;
console.log("  name changes on N:",nameChanged,"· preview blooms:",previewBloomed,"· eases back:",easedBack);
console.log(ok?"\nN-REVEAL BOOT: PASS":"\nN-REVEAL BOOT: FAIL");
process.exit(ok?0:1);

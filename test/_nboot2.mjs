import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v1.6_reveal.html");
await p.waitForTimeout(2800);
const letter=async()=>await p.evaluate(()=>{const t=(document.getElementById("engine")||{}).textContent||"";const m=t.match(/wardrobe (\w+)/);return m?m[1]:"?";});
const seq=[await letter()];
for(let i=0;i<4;i++){ await p.keyboard.press("KeyN"); await p.waitForTimeout(450); seq.push(await letter()); }
console.log("N sequence:",seq.join(" → "));
console.log("hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();
const distinct=new Set(seq).size;
const ok=distinct>=4 && e.filter(x=>!KNOWN.test(x)).length===0;
console.log("distinct letters seen:",distinct);
console.log(ok?"\nN-ADVANCE: PASS":"\nN-ADVANCE: FAIL");
process.exit(ok?0:1);

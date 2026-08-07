import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v2.0_shapes6000.html");
await p.waitForTimeout(2800);
const info=await p.evaluate(()=>({count:window.SickleField.flock.count, avatar0:window.SickleField.flock?0:0}));
// read avatar index + mark via the state through a peek: not exposed; instead confirm no beacon by reading view? Fallback: just count + N + errors.
const cnt=await p.evaluate(()=>window.SickleField.flock.count);
const rd=async()=>await p.evaluate(()=>((document.getElementById("engine")||{}).textContent||"").match(/wardrobe (\w+)/)?.[1]);
const seq=[await rd()];
for(let i=0;i<6;i++){ await p.keyboard.press("KeyN"); await p.waitForTimeout(320); seq.push(await rd()); }
console.log("count:",cnt);
console.log("N:",seq.join(" → "));
console.log("hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();
const ok=cnt===6000 && new Set(seq).size>=6 && e.filter(x=>!KNOWN.test(x)).length===0;
console.log(ok?"\nSHAPES6K: PASS":"\nSHAPES6K: FAIL");
process.exit(ok?0:1);

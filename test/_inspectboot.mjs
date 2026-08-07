import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v1.9_shape_inspector.html");
await p.waitForTimeout(2800);
const info=await p.evaluate(()=>({count:window.SickleField.flock.count,web:!!window.SickleField.flock.web}));
const rd=async()=>await p.evaluate(()=>((document.getElementById("engine")||{}).textContent||"").match(/wardrobe (\w+)/)?.[1]);
const seq=[await rd()];
for(let i=0;i<6;i++){ await p.keyboard.press("KeyN"); await p.waitForTimeout(350); seq.push(await rd()); }
console.log("count:",info.count," web:",info.web);
console.log("N:",seq.join(" → "));
console.log("hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();
const ok=info.count===24&&!info.web&&new Set(seq).size>=6&&e.filter(x=>!KNOWN.test(x)).length===0;
console.log(ok?"\nINSPECTOR: PASS":"\nINSPECTOR: FAIL");
process.exit(ok?0:1);

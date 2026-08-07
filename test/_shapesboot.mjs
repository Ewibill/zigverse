import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v1.7_shapes.html");
await p.waitForTimeout(2800);
const rd=async()=>await p.evaluate(()=>{const t=(document.getElementById("engine")||{}).textContent||"";return{letter:(t.match(/wardrobe (\w+)/)||[])[1],reveal:parseFloat((t.match(/reveal ([0-9.]+)/)||[])[1]),hasWeb:/· web /.test(t)};});
const webObj=await p.evaluate(()=>!!(window.SickleField&&window.SickleField.flock&&window.SickleField.flock.web));
const idle=await rd();
const seq=[idle.letter];
for(let i=0;i<4;i++){ await p.keyboard.press("KeyN"); await p.waitForTimeout(400); seq.push((await rd()).letter); }
console.log("web object:",webObj," HUD web:",idle.hasWeb," idle reveal:",idle.reveal,"(whole letters if ≥1.5)");
console.log("N sequence:",seq.join(" → "));
console.log("hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();
const ok=!webObj && !idle.hasWeb && idle.reveal>=1.5 && new Set(seq).size>=4 && e.filter(x=>!KNOWN.test(x)).length===0;
console.log(ok?"\nSHAPES BOOT: PASS":"\nSHAPES BOOT: FAIL");
process.exit(ok?0:1);

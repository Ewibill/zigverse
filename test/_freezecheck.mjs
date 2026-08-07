import { chromium } from "playwright";
const KNOWN = /valid external Instance reference no longer exists/i;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"] });
const p = await b.newPage();
const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
await p.goto("file:///home/claude/zigverse/dist/Attach_And_Detach_v0.2.html");
await p.waitForTimeout(3000);
// measure motion before freeze, then press Z, then measure motion after (via a probe on the page? we can't read GPU pos).
// Instead: confirm boot clean + Z toggles without error, and status stays alive.
await p.keyboard.press("KeyB"); await p.waitForTimeout(400);
await p.keyboard.press("KeyZ"); await p.waitForTimeout(1500);   // freeze
const s1 = await p.evaluate(()=>(document.getElementById("status")||{}).textContent||"");
await p.keyboard.press("KeyZ"); await p.waitForTimeout(1500);   // melt
const hard = errs.filter(e=>!KNOWN.test(e));
console.log("status after freeze:", JSON.stringify(s1.slice(0,60)));
console.log("hard errors:", hard.length);
await b.close();
process.exit(hard.length===0 && /fps|letterforms/i.test(s1) ? 0 : 1);

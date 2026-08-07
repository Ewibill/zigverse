import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
// fake media → getUserMedia returns a synthetic tone, so we can exercise the LIVE path headless
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:[
  "--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox",
  "--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]});
const ctx=await b.newContext({permissions:["microphone"]});
const p=await ctx.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/zigambience.html");await p.waitForTimeout(2600);
const before=await p.evaluate(()=>({src:ZigCore.Ambience.src,atau:+SickleField.after.tau.toFixed(3)}));
await p.keyboard.press("KeyA");                       // go LIVE — open the (fake) M2
await p.waitForTimeout(2500);
const after=await p.evaluate(()=>({src:ZigCore.Ambience.src, live:ZigCore.Timbre.live, energy:+ZigCore.Ambience.energy.toFixed(3),
  temp:+ZigCore.AmbienceMap.lev.temp.toFixed(2), atau:+SickleField.after.tau.toFixed(3), dev:ZigCore.Timbre.device}));
const hard=e.filter(x=>!KNOWN.test(x));
console.log("before A:",JSON.stringify(before));
console.log("after  A:",JSON.stringify(after));
console.log("hard errors:",hard.length,hard[0]||"");
await b.close();
const ok = hard.length===0 && before.src==="synth" && after.src==="live" && after.live===true && after.energy>0 && after.atau<0.02;
console.log(ok?"\nAMBIENCE LIVE BOOT: PASS":"\nAMBIENCE LIVE BOOT: FAIL");process.exit(ok?0:1);

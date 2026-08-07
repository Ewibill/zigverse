import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage({viewport:{width:1400,height:900}});const e=[];p.on("pageerror",x=>e.push(x.message));
await p.goto("file:///home/claude/zigverse/zigspectrum.html");await p.waitForTimeout(3600);
await p.screenshot({path:"/tmp/spec_idle.png"});
// sustain breath via the sim envelope, let motion build so smear shows
await p.evaluate(()=>window.ZigCore.Perf.sim(0.9));
await p.waitForTimeout(1800);
await p.screenshot({path:"/tmp/spec_blow.png"});
await p.evaluate(()=>window.ZigCore.Perf.sim(0.9));
await p.waitForTimeout(1400);
await p.screenshot({path:"/tmp/spec_blow2.png"});
console.log("hard errors:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();

import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/zigspectrum.html");await p.waitForTimeout(3400);
// sim breath + feed a couple of notes so avPitch moves and the ribbon populates
const before=await p.evaluate(()=>window.SickleField.flock.ribbon.count);
await p.evaluate(()=>{ window.ZigCore.Perf.sim(0.85); });
await p.waitForTimeout(700);
await p.evaluate(()=>{ if(window.ZigCore.Perf.heldT) window.ZigCore.Perf.heldT.set(80, performance.now()); });
await p.waitForTimeout(700);
const after=await p.evaluate(()=>window.SickleField.flock.ribbon.count);
const hard=e.filter(x=>!KNOWN.test(x));
console.log("ribbon verts before:",before,"after playing:",after,"| hard errors:",hard.length, hard.slice(0,2).join(" || "));
await b.close();process.exit(hard.length===0 && after>0 ?0:1);

import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/zigspectrum.html");await p.waitForTimeout(3400);
// simulate playing + a few note onsets
await p.evaluate(()=>window.ZigCore.Perf.sim(0.8));
for(const n of [60,67,72,64]){ await p.evaluate((nn)=>{ if(window.ZigCore.Perf.heldT) window.ZigCore.Perf.heldT.set(nn, performance.now()); }, n); await p.waitForTimeout(250); }
await p.waitForTimeout(800);
const hard=e.filter(x=>!KNOWN.test(x));
console.log("note onsets fired · hard errors:",hard.length, hard.slice(0,2).join(" || "));
await b.close();process.exit(hard.length===0?0:1);

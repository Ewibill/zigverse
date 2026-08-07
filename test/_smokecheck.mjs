import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/zigspectrum.html");await p.waitForTimeout(3400);
const rest=await p.evaluate(()=>window.SickleField.flock.smoke.count);
await p.evaluate(()=>window.ZigCore.Perf.sim(0.9));   // breath on → smoke should billow
await p.waitForTimeout(1200);
const blow=await p.evaluate(()=>window.SickleField.flock.smoke.count);
await p.evaluate(()=>{ if(window.ZigCore.Perf.heldT) window.ZigCore.Perf.heldT.set(72, performance.now()); });  // a note → puff
await p.waitForTimeout(400);
const puff=await p.evaluate(()=>window.SickleField.flock.smoke.count);
const hard=e.filter(x=>!KNOWN.test(x));
console.log("smoke verts — rest:",rest," blowing:",blow," after note:",puff," | hard errors:",hard.length, hard.slice(0,2).join(" || "));
await b.close();process.exit(hard.length===0 && blow>0 ?0:1);

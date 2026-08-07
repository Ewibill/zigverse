import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));
await p.goto("file:///home/claude/zigverse/dist/Environment_v0.2_forces.html#force=sink&med=honey&mat=nacre");await p.waitForTimeout(3200);
const s=await p.evaluate(()=>({f:window.ZIG_FORCES,m:window.ZIG_MEDIUM,st:(document.getElementById("status")||{}).textContent||""}));
console.log("bundle sink/honey →",s.f,s.m,/fps/.test(s.st)?"live":"DEAD","hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();

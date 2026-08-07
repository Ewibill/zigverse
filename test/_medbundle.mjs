import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));
await p.goto("file:///home/claude/zigverse/dist/Medium_v0.1.html#med=honey");await p.waitForTimeout(3400);
const s=await p.evaluate(()=>({m:window.ZIG_MEDIUM,st:(document.getElementById("status")||{}).textContent||""}));
console.log("bundle #med=honey →",s.m,JSON.stringify(s.st.slice(0,30)),"hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();

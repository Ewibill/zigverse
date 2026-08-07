import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(hash){const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});await p.goto("file:///home/claude/zigverse/zigmedium.html"+hash);await p.waitForTimeout(3400);const s=await p.evaluate(()=>({m:window.ZIG_MEDIUM, st:(document.getElementById("status")||{}).textContent||""}));await p.close();return{hash,m:s.m,st:s.st.slice(0,30),h:e.filter(x=>!KNOWN.test(x))};}
for(const hz of ["#med=air","#med=water","#med=honey"]){const r=await boot(hz);console.log(hz,"→",r.m,"|",JSON.stringify(r.st),"hard:",r.h.length, r.h.slice(0,1).join(""));}
await b.close();

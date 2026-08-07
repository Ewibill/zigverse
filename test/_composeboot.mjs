import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(hash){const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});await p.goto("file:///home/claude/zigverse/dist/Environment_v0.8_compose.html"+hash);await p.waitForTimeout(3000);const s=await p.evaluate(()=>({mat:window.ZIG_MATERIAL,live:/fps/.test((document.getElementById("status")||{}).textContent||"")}));await p.close();return{hash,mat:s.mat,live:s.live,h:e.filter(x=>!KNOWN.test(x))};}
for(const hz of ["#world=custom&mat=copper","#world=custom&mat=glass","#world=amber","#world=deep"]){const r=await boot(hz);console.log((hz+"                      ").slice(0,26),"mat:",(String(r.mat)+"        ").slice(0,9),r.live?"live":"DEAD","hard:",r.h.length);}
await b.close();

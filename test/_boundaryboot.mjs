import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(hash){const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});await p.goto("file:///home/claude/zigverse/dist/_btest.html"+hash);await p.waitForTimeout(3000);const s=await p.evaluate(()=>{const w=window.ZIG_WORLD,pl=window.ZigCore.Worlds.places[w];return{w,bound:pl?pl.bound:"(custom)",live:/fps/.test((document.getElementById("status")||{}).textContent||"")};});await p.close();return{hash,w:s.w,bound:s.bound,live:s.live,h:e.filter(x=>!KNOWN.test(x))};}
for(const hz of ["#world=tidepool","#world=thermal","#world=deep","#world=amber","#world=open","#world=whirlpool","#world=lakebed"]){const r=await boot(hz);console.log((r.w+"          ").slice(0,10),"shape:",(r.bound+"        ").slice(0,8),r.live?"live":"DEAD","hard:",r.h.length,r.h.slice(0,1).join("").slice(0,90));}
await b.close();

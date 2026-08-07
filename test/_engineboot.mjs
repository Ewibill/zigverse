import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/zigengine.html");await p.waitForTimeout(2800);
const ids=["worldpick","medpick","forcepick","curpick","boundpick","matpick","gempick","fabpick","stagepick","breathpick"];
const counts=await p.evaluate((ids)=>{const o={};for(const id of ids){const el=document.getElementById(id);o[id]=el?el.options.length:0;}
  o._src=window.ZigCore&&ZigCore.Ambience?ZigCore.Ambience.src:"?"; o._rim=window.ZIG_RIM; return o;},ids);
console.log("picker option counts:",JSON.stringify(counts));
const st=await p.evaluate(()=>((document.getElementById("status")||{}).textContent||"").slice(0,50));
// switch to a gem → reload into it
await p.selectOption("#gempick","ruby");await p.waitForTimeout(2800);
const g=await p.evaluate(()=>({gem:window.ZIG_GEM,hash:location.hash,src:ZigCore.Ambience.src}));
// then a fabric on top → reload into both
await p.selectOption("#fabpick","velvet");await p.waitForTimeout(2800);
const gf=await p.evaluate(()=>({gem:window.ZIG_GEM,fab:window.ZIG_BACKMAT,hash:location.hash}));
const hard=e.filter(x=>!KNOWN.test(x));
console.log("status:",JSON.stringify(st));
console.log("after gem=ruby:",JSON.stringify(g));
console.log("after +fab=velvet:",JSON.stringify(gf));
console.log("hard errors:",hard.length,hard[0]||"");
await b.close();
const allFilled=ids.every(id=>counts[id]>0);
const ok=hard.length===0 && allFilled && counts._src==="off" && g.gem==="ruby" && gf.gem==="ruby" && gf.fab==="velvet";
console.log(ok?"\nENGINE SHOWCASE: PASS":"\nENGINE SHOWCASE: FAIL");process.exit(ok?0:1);

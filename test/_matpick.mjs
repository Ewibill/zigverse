import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/zigspectrum.html");await p.waitForTimeout(3200);
const opts=await p.evaluate(()=>({n:document.getElementById("matpick").options.length, cur:window.ZIG_MATERIAL}));
// mimic the picker: set hash + real reload
await p.evaluate(()=>{ location.hash="mat=tissue"; });
await p.reload();await p.waitForTimeout(3200);
const after=await p.evaluate(()=>({mat:window.ZIG_MATERIAL, sel:document.getElementById("matpick").value, status:(document.getElementById("status")||{}).textContent}));
console.log("picker options:",opts.n,"default:",opts.cur,"| after reload w/ #mat=tissue → ZIG_MATERIAL:",after.mat,"picker shows:",after.sel);
console.log("booted status:",JSON.stringify((after.status||"").slice(0,34)),"hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();process.exit(e.filter(x=>!KNOWN.test(x)).length===0 && opts.n>10 && after.mat==="tissue" && after.sel==="tissue"?0:1);

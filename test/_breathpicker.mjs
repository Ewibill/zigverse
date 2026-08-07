import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v0.3_current.html#breath=firm&med=water");
await p.waitForTimeout(3000);
// starts at 'firm' from hash → gain 1.0
const g0=await p.evaluate(()=>window.ZigCore.Perf._opts.gain+"/"+window.ZigCore.Perf._opts.curve);
// change the breath dropdown to 'feather' and confirm it applies LIVE (no reload)
const applied=await p.evaluate(()=>{const s=document.getElementById("breathpick");s.value="feather";s.dispatchEvent(new Event("change"));return window.ZigCore.Perf._opts.gain+"/"+window.ZigCore.Perf._opts.curve;});
const reloaded=await p.evaluate(()=>performance.getEntriesByType("navigation")[0].type); // 'navigate' = no reload happened
// press backtick → panel hidden
const picksShown=await p.evaluate(()=>getComputedStyle(document.getElementById("picks")).display);
await p.keyboard.press("Backquote");
const picksHidden=await p.evaluate(()=>document.getElementById("picks").style.display+"|"+document.getElementById("hud").style.display+"|"+document.getElementById("hint").style.display);
await p.keyboard.press("Backquote");
const picksBack=await p.evaluate(()=>document.getElementById("picks").style.display||"(shown)");
const hard=e.filter(x=>!KNOWN.test(x));
console.log("start gain/curve (firm):",g0);
console.log("after picking feather  :",applied,"  navType:",reloaded,"(navigate = applied live, no reload)");
console.log("picks display initially:",picksShown);
console.log("after ` (hidden)       :",picksHidden);
console.log("after ` again (shown)  :",picksBack);
console.log("hard errors:",hard.length);hard.slice(0,2).forEach(x=>console.log("  ",x.slice(0,150)));
await b.close();
process.exit(hard.length===0 && g0==="1/1" && applied==="2/0.5" && reloaded==="navigate" && picksHidden==="none|none|none"?0:1);

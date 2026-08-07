import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push("P:"+x.message));p.on("console",m=>{if(m.type()==="error")e.push("C:"+m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v0.7_alphabet.html#world=tidepool");
await p.waitForTimeout(3500);
const s0=await p.evaluate(()=>(document.getElementById("status")||{}).textContent||"");
// step N a few times through the new tail of the alphabet
const seen=[];for(let k=0;k<4;k++){await p.keyboard.press("KeyN");await p.waitForTimeout(200);seen.push(await p.evaluate(()=>{const t=(document.getElementById("status")||{}).textContent||"";const m=t.match(/× ([A-Z]+)/);return m?m[1]:"?";}));}
const hard=e.filter(x=>!KNOWN.test(x));
console.log("status:",s0.slice(0,50));
console.log("N steps →:",seen.join(" · "));
console.log("hard:",hard.length);hard.slice(0,3).forEach(x=>console.log("  ",x.slice(0,160)));
await b.close();

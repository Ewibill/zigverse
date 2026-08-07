import { chromium } from "playwright";
const KNOWN = /valid external Instance reference no longer exists/i;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"] });
const p = await b.newPage();
const errors=[]; p.on("pageerror",e=>errors.push("pageerror: "+e.message));
p.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});
await p.goto("file:///home/claude/zigverse/dist/Rest_And_Wake_v0.2.html");
await p.waitForTimeout(2600);
for (const k of ["KeyB","Equal","Equal","KeyB"]) { await p.keyboard.press(k); await p.waitForTimeout(150); }
const r = await p.evaluate(()=>({status:(document.getElementById("status")||{}).textContent||"", engine:(document.getElementById("engine")||{}).textContent||""}));
const hard = errors.filter(e=>!KNOWN.test(e));
console.log("status:", JSON.stringify(r.status.slice(0,80)));
console.log("engine:", JSON.stringify(r.engine.slice(0,80)));
console.log("hard errors:", hard.length); hard.forEach(e=>console.log("  ",e.slice(0,180)));
await b.close();
process.exit(hard.length===0 && /fps|letterforms/i.test(r.status) ? 0 : 1);

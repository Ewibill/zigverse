import { chromium } from "playwright";
const KNOWN = /valid external Instance reference no longer exists/i;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"] });
const p = await b.newPage();
const errors=[]; p.on("pageerror",e=>errors.push("pageerror: "+e.message));
p.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});
await p.goto("file:///home/claude/zigverse/dist/Letterforms_Turntable_v0.7_OrganicFractals.html");
await p.waitForTimeout(2500);
// walk to a pore material (fractal-heavy) and a fiber one; simulate zoom
for(let i=0;i<9;i++) await p.keyboard.press("KeyM");
await p.mouse.wheel(0,-300); await p.mouse.wheel(0,-300);   // zoom in
await p.waitForTimeout(600);
const r = await p.evaluate(()=>({
  probe: document.getElementById("probe").innerText.slice(0,40),
  params: document.getElementById("params").textContent.slice(0,60)
})).catch(e=>({err:String(e)}));
const hard = errors.filter(e=>!KNOWN.test(e));
console.log("probe:", JSON.stringify(r.probe));
console.log("HUD:", JSON.stringify(r.params));
console.log("hard errors:", hard.length); hard.forEach(e=>console.log("  ",e.slice(0,200)));
await b.close();
process.exit(!/RED/.test(r.probe||"RED") && hard.length===0 ? 0 : 1);

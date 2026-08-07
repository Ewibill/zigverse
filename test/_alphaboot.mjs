import { chromium } from "playwright";
const KNOWN = /valid external Instance reference no longer exists/i;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"] });
const p = await b.newPage();
const errors=[]; p.on("pageerror",e=>errors.push("pageerror: "+e.message));
p.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});
await p.goto("file:///home/claude/zigverse/zigalphabet.html");
await p.waitForTimeout(3200);
const seen = [];
for (let i=0;i<5;i++){
  const eng = await p.evaluate(()=>(document.getElementById("engine")||{}).textContent||"");
  const m = /wardrobe\s+(\w+)/.exec(eng); seen.push(m?m[1]:"?");
  await p.keyboard.press("KeyN"); await p.waitForTimeout(500);
}
const st = await p.evaluate(()=>(document.getElementById("status")||{}).textContent||"");
const hard = errors.filter(e=>!KNOWN.test(e));
console.log("status:", JSON.stringify(st.slice(0,60)));
console.log("letters seen stepping N:", seen.join(" → "));
console.log("hard errors:", hard.length); hard.forEach(e=>console.log("  ",e.slice(0,180)));
await b.close();
const ok = hard.length===0 && /fps|letterforms/i.test(st) && new Set(seen).size >= 3;
console.log(ok ? "\nALPHABET BOOT: PASS" : "\nALPHABET BOOT: FAIL");
process.exit(ok?0:1);

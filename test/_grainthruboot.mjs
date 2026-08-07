import { chromium } from "playwright";
const KNOWN = /valid external Instance reference no longer exists/i;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"] });

async function boot(file, keys=[]) {
  const p = await b.newPage();
  const errors=[]; p.on("pageerror",e=>errors.push("pageerror: "+e.message));
  p.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});
  await p.goto("file:///home/claude/zigverse/"+file);
  await p.waitForTimeout(2600);
  for (const k of keys) { await p.keyboard.press(k); await p.waitForTimeout(120); }
  await p.waitForTimeout(500);
  const r = await p.evaluate(()=>({
    status: (document.getElementById("status")||{}).textContent||"",
    engine: (document.getElementById("engine")||{}).textContent||""
  })).catch(e=>({err:String(e)}));
  const hard = errors.filter(e=>!KNOWN.test(e));
  await p.close();
  return { file, status:(r.status||"").slice(0,120), engine:(r.engine||"").slice(0,160), hard };
}

// zigmedium: nacre material + spectrum on. Push ink UP (I) so grain-through-colour is exercised,
// then toggle NOTE→FORM off with the / key (Slash) and confirm the HUD flips.
const r = await boot("zigmedium.html", ["KeyB","KeyI","KeyI","KeyI","KeyI","KeyI","KeyB","Slash"]);
console.log("=== "+r.file+" ===");
console.log("  status:", JSON.stringify(r.status));
console.log("  engine:", JSON.stringify(r.engine));
console.log("  hard errors:", r.hard.length); r.hard.forEach(e=>console.log("    ",e.slice(0,200)));
await b.close();

const compiles = r.hard.length === 0;
const slashWorks = /NOTE→FORM OFF/i.test(r.status) || /EWI off/i.test(r.engine);
console.log("  shader compiles (ink up, grain-thru active):", compiles);
console.log("  / toggled EWI off:", slashWorks);
console.log((compiles && slashWorks) ? "\nGRAINTHRU BOOT: PASS" : "\nGRAINTHRU BOOT: FAIL");
process.exit((compiles && slashWorks) ? 0 : 1);

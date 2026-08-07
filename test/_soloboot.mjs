import { chromium } from "playwright";
const KNOWN = /valid external Instance reference no longer exists/i;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"] });
async function boot(file, keys=[]) {
  const p = await b.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
  await p.goto("file:///home/claude/zigverse/"+file);
  await p.waitForTimeout(3000);
  for (const k of keys){ await p.keyboard.press(k); await p.waitForTimeout(500); }
  const s = await p.evaluate(()=>(document.getElementById("status")||{}).textContent||"");
  const hard = errs.filter(e=>!KNOWN.test(e));
  await p.close(); return { file, status:s.slice(0,70), hard };
}
const solo  = await boot("dist/Solo_v0.2.html", ["KeyB","KeyU","KeyB","KeyU"]);  // breathe, toggle Alive, breathe, back to Solo
const plain = await boot("zigmurmuration.html", ["KeyB"]);                        // regression (no solo)
for (const r of [solo,plain]) { console.log("=== "+r.file+" ===  ", JSON.stringify(r.status), " hard:", r.hard.length); r.hard.forEach(e=>console.log("   ",e.slice(0,160))); }
await b.close();
const ok = [solo,plain].every(r => r.hard.length===0 && /fps|letterforms|SOLO|ALIVE/i.test(r.status));
console.log(ok ? "\nSOLO BOOT: PASS" : "\nSOLO BOOT: FAIL"); process.exit(ok?0:1);

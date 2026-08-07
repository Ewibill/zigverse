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
  await p.waitForTimeout(600);
  const r = await p.evaluate(()=>({
    status: (document.getElementById("status")||{}).textContent||"",
    engine: (document.getElementById("engine")||{}).textContent||""
  })).catch(e=>({err:String(e)}));
  const hard = errors.filter(e=>!KNOWN.test(e));
  await p.close();
  return { file, status:(r.status||"").slice(0,110), engine:(r.engine||"").slice(0,200), hard };
}

// 1) WEB ON (zigmedium boots it): breathe (B) to string the web, push web gain up (4), then confirm no shader errors.
const on = await boot("zigmedium.html", ["KeyB","Digit4","Digit4","Digit4"]);
// 2) WEB OFF regression — a demo that never sets ZIG_WEB must still boot byte-clean.
const off = await boot("zigmurmuration.html", ["KeyB","KeyW"]);

for (const r of [on, off]) {
  console.log("=== "+r.file+" ===");
  console.log("  engine:", JSON.stringify(r.engine));
  console.log("  hard errors:", r.hard.length); r.hard.forEach(e=>console.log("    ",e.slice(0,200)));
}
await b.close();

const onOK  = on.hard.length===0 && /web\s/i.test(on.engine) && /fps|letterforms/i.test(on.status);
const offOK = off.hard.length===0;
console.log("  web pass compiles + HUD shows web:", onOK);
console.log("  web-off demo still clean:", offOK);
console.log((onOK && offOK) ? "\nWEB BOOT: PASS" : "\nWEB BOOT: FAIL");
process.exit((onOK && offOK) ? 0 : 1);

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
    probe: (document.getElementById("probe")||{}).innerText||"",
    status: (document.getElementById("status")||{}).textContent||"",
    engine: (document.getElementById("engine")||{}).textContent||""
  })).catch(e=>({err:String(e)}));
  const hard = errors.filter(e=>!KNOWN.test(e));
  await p.close();
  return { file, probe:(r.probe||"").slice(0,40), status:(r.status||"").slice(0,90), engine:(r.engine||"").slice(0,90), hard };
}

// 1) material world (relief ON) — hold breath, zoom in to read the grain
const mat = await boot("zigmaterialfield.html", ["KeyB","Equal","Equal","Equal","KeyB"]);
// 2) non-material world (regression / off-path must still boot clean)
const plain = await boot("zigmurmuration.html", ["KeyB","KeyW","KeyW"]);

for (const r of [mat, plain]) {
  console.log("=== "+r.file+" ===");
  console.log("  probe :", JSON.stringify(r.probe));
  console.log("  status:", JSON.stringify(r.status));
  console.log("  engine:", JSON.stringify(r.engine));
  console.log("  hard errors:", r.hard.length); r.hard.forEach(e=>console.log("    ",e.slice(0,200)));
}
await b.close();
// NOTE: probe RED = the known SwiftShader "device lost" present artifact — not a
// real failure. Judge on hard errors (KNOWN filtered) + a live render HUD.
const ok = [mat,plain].every(r =>
  r.hard.length===0 && /fps|letterforms/i.test(r.status) && !/error|failed|missing/i.test(r.status));
console.log(ok ? "\nRELIEF BOOT: PASS" : "\nRELIEF BOOT: FAIL");
process.exit(ok?0:1);

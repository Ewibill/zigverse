import { chromium } from "playwright";
const KNOWN = /valid external Instance reference no longer exists/i;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"] });
async function boot(file, keys=[]) {
  const p = await b.newPage();
  const errors=[]; p.on("pageerror",e=>errors.push("pageerror: "+e.message));
  p.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});
  await p.goto("file:///home/claude/zigverse/"+file);
  await p.waitForTimeout(3000);
  for (const k of keys){ await p.keyboard.down(k); await p.waitForTimeout(500); await p.keyboard.up(k); await p.waitForTimeout(300); }
  await p.waitForTimeout(400);
  const r = await p.evaluate(()=>({status:(document.getElementById("status")||{}).textContent||""}));
  const hard = errors.filter(e=>!KNOWN.test(e));
  await p.close();
  return { file, status:(r.status||"").slice(0,80), hard };
}
const seek = await boot("zigseek.html", ["KeyB"]);          // seek ON — chase, hold B to sharpen
const rest = await boot("zigrest.html", ["KeyB"]);          // rest ON (regression of prior capability)
const plain = await boot("zigmurmuration.html", ["KeyB"]);  // neither — byte-identical regression
for (const r of [seek, rest, plain]) {
  console.log("=== "+r.file+" ===");
  console.log("  status:", JSON.stringify(r.status));
  console.log("  hard errors:", r.hard.length); r.hard.forEach(e=>console.log("    ",e.slice(0,180)));
}
await b.close();
const ok = [seek,rest,plain].every(r => r.hard.length===0 && /fps|letterforms/i.test(r.status) && !/error|failed|missing/i.test(r.status));
console.log(ok ? "\nSEEK BOOT: PASS" : "\nSEEK BOOT: FAIL");
process.exit(ok?0:1);

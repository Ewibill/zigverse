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
  for (const k of keys){ await p.keyboard.press(k); await p.waitForTimeout(600); }
  await p.waitForTimeout(400);
  const r = await p.evaluate(()=>({status:(document.getElementById("status")||{}).textContent||""}));
  const hard = errors.filter(e=>!KNOWN.test(e));
  await p.close();
  return { file, status:(r.status||"").slice(0,70), hard };
}
const attach = await boot("zigattach.html", ["KeyZ","KeyB","KeyZ"]);  // freeze, breathe, melt
const rest   = await boot("zigrest.html", ["KeyB"]);                  // REST regression (refactored buffer)
const seek   = await boot("zigseek.html", ["KeyB"]);                  // seek regression
const plain  = await boot("zigmurmuration.html", ["KeyB"]);          // byte-identical off-path
for (const r of [attach,rest,seek,plain]) {
  console.log("=== "+r.file+" ===  ", JSON.stringify(r.status), " hard:", r.hard.length);
  r.hard.forEach(e=>console.log("    ",e.slice(0,170)));
}
await b.close();
const ok = [attach,rest,seek,plain].every(r => r.hard.length===0 && /fps|letterforms/i.test(r.status) && !/error|failed|missing/i.test(r.status));
console.log(ok ? "\nATTACH BOOT: PASS" : "\nATTACH BOOT: FAIL");
process.exit(ok?0:1);

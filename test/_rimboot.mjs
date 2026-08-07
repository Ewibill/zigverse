import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(url, keys){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+url); await p.waitForTimeout(2400);
  if(keys){ for(let i=0;i<keys.n;i++){ await p.keyboard.press(keys.k); } await p.waitForTimeout(1200); }   // drive the RIM dial up → the if(V.render5.x>0) branch runs live
  const st=await p.evaluate(()=>((document.getElementById("status")||{}).textContent||"").slice(0,80));
  const hard=e.filter(x=>!KNOWN.test(x)); await p.close(); return {url,st,hard}; }
// 1) live source, full GEM+MAT+SPECTRUM shard shader compiles WITH render5, then rim branch runs live
const gem  = await boot("zigem.html", {k:"ArrowUp", n:8});               // ↑ ×8 → rim stronger
// 2) sharpness path (←/→) also executes
const sharp= await boot("zigem.html", {k:"ArrowRight", n:6});            // → ×6 → rimSharp path
// 3) non-mesh golden path still compiles with the grown View struct
const plain= await boot("zigmurmuration.html", null);
console.log("gem+rim :", JSON.stringify(gem.st),  "hard", gem.hard.length,  gem.hard[0]?("  "+gem.hard[0].slice(0,90)):"");
console.log("sharp   :", JSON.stringify(sharp.st),"hard", sharp.hard.length,sharp.hard[0]?("  "+sharp.hard[0].slice(0,90)):"");
console.log("no-mesh :", JSON.stringify(plain.st),"hard", plain.hard.length,plain.hard[0]?("  "+plain.hard[0].slice(0,90)):"");
await b.close();
const ok = gem.hard.length===0 && sharp.hard.length===0 && plain.hard.length===0
  && /fps/i.test(gem.st) && /fps/i.test(plain.st);
console.log(ok?"\nRIM BOOT: PASS":"\nRIM BOOT: FAIL"); process.exit(ok?0:1);

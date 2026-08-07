import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(f,keys=[]){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+f); await p.waitForTimeout(2500);
  for(const k of keys){ if(k.shift){await p.keyboard.down("ShiftLeft");await p.keyboard.press(k.k);await p.keyboard.up("ShiftLeft");} else await p.keyboard.press(k); await p.waitForTimeout(100); }
  const eng=await p.evaluate(()=>((document.getElementById("engine")||{}).textContent||""));
  const err=e.filter(x=>!KNOWN.test(x)); await p.close(); return {f,eng,err}; }
const mem=await boot("dist/Environment_v2.7_underside_texture.html",[{shift:true,k:"KeyM"},{shift:true,k:"KeyM"}]);  // toggle off then on
const demos=["zigmedium.html","zigmaterialfield.html","lake.html","sickleswarm.html","zigmurmuration.html","halofield.html"];
let anyfail=mem.err.length>0;
for(const f of demos){ const r=await boot(f); if(r.err.length){anyfail=true;console.log("FAIL",f,r.err[0].slice(0,100));} else console.log("ok  ",f); }
console.log("memory/underside file hard:",mem.err.length," HUD mem:",(mem.eng.match(/mem-back [^·]+/)||[])[0]);
await b.close();
console.log(anyfail?"\nUNDERTEX: FAIL":"\nUNDERTEX: PASS"); process.exit(anyfail?1:0);

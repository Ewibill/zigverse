import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(f,keys=[]){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+f); await p.waitForTimeout(2500);
  for(const k of keys){await p.keyboard.press(k);await p.waitForTimeout(90);}
  await p.waitForTimeout(250);
  const eng=await p.evaluate(()=>((document.getElementById("engine")||{}).textContent||""));
  const err=e.filter(x=>!KNOWN.test(x)); await p.close(); return {f,eng,err}; }
const files=[["dist/Environment_v2.2_shapes_livelight.html",[]],["lake.html",[]],["fireflies.html",[]],["zigmurmuration.html",[]],["halofield.html",[]],["sickleswarm.html",[]],["zigmedium.html",[]]];
let anyfail=false;
for(const [f,k] of files){ const r=await boot(f,k); const n=r.err.length;
  if(n>0){anyfail=true; console.log("FAIL",f,"("+n+")",r.err[0].slice(0,120)); } else console.log("ok  ",f); }
// live-light check on the chiaro file
const lo=await boot("dist/Environment_v2.2_shapes_livelight.html",["Digit1","Digit1","Digit1","Digit1","Digit1"]);
const hi=await boot("dist/Environment_v2.2_shapes_livelight.html",["Digit2","Digit2"]);
const lv=(s)=>(s.match(/light ([0-9.]+)/)||[])[1];
console.log("light after 5×'1':",lv(lo.eng)," after 2×'2' from 0.85:",lv(hi.eng));
await b.close();
console.log((!anyfail)?"\nREGRESS: PASS":"\nREGRESS: FAIL");
process.exit(anyfail?1:0);

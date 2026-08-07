import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(f,keys=[]){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+f); await p.waitForTimeout(2500);
  for(const k of keys){await p.keyboard.press(k);await p.waitForTimeout(90);}
  await p.waitForTimeout(300);
  const eng=await p.evaluate(()=>((document.getElementById("engine")||{}).textContent||""));
  const st=await p.evaluate(()=>((document.getElementById("status")||{}).textContent||"").slice(0,40));
  const hard=e.filter(x=>!KNOWN.test(x)).length; await p.close(); return {f,eng,st,hard}; }
// 1) chiaro shapes file: dial light up with 2 → HUD "light" should appear/rise; live, no errors
const c1=await boot("dist/Environment_v2.2_shapes_livelight.html");           // boots at 0.85
const c2=await boot("dist/Environment_v2.2_shapes_livelight.html",["Digit1","Digit1","Digit1"]); // dial DOWN
const light1=(c1.eng.match(/light ([0-9.]+)/)||[])[1];
const light2=(c2.eng.match(/light ([0-9.]+)/)||[])[1];
// 2) regression: species that write 76-float view arrays (grew buffer to 80)
const fire=await boot("fireflies.html");
const lake=await boot("lake.html");
const murm=await boot("zigmurmuration.html");
const halo=await boot("halofield.html");   // scene/underrow-ish
console.log("chiaro boot light:",light1," after 3×'1':",light2," hard:",c1.hard,c2.hard);
console.log("fireflies hard:",fire.hard," | lake hard:",lake.hard," | murm hard:",murm.hard," | halo hard:",halo.hard);
await b.close();
const ok = c1.hard===0&&c2.hard===0&&fire.hard===0&&lake.hard===0&&murm.hard===0&&halo.hard===0
  && light1 && light2 && parseFloat(light2) < parseFloat(light1);
console.log(ok?"\nLIVELIGHT: PASS":"\nLIVELIGHT: FAIL");
process.exit(ok?0:1);

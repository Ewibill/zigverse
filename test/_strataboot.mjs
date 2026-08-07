import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(url,ms){const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+url);await p.waitForTimeout(ms);
  const info=await p.evaluate(()=>({bands:ZigCore.NoteField?ZigCore.NoteField.bands.length:-1,
    band0:ZigCore.NoteField&&ZigCore.NoteField.bands[0]?{y:+ZigCore.NoteField.bands[0].y.toFixed(1),hue:+ZigCore.NoteField.bands[0].hue.toFixed(2),e:+ZigCore.NoteField.bands[0].e.toFixed(2)}:null,
    st:(document.getElementById("status")||{}).textContent.slice(0,34)}));
  const hard=e.filter(x=>!KNOWN.test(x));await p.close();return{url,info,hard};}
const strata=await boot("zigstrata.html",3200);          // synth melody should have deposited several bands
const plain=await boot("zigmurmuration.html",2600);      // no strata → grown View must still compile clean
console.log("strata:",JSON.stringify(strata.info),"hard",strata.hard.length,strata.hard[0]||"");
console.log("plain :",JSON.stringify(plain.info),"hard",plain.hard.length,plain.hard[0]||"");
await b.close();
const ok=strata.hard.length===0 && plain.hard.length===0 && strata.info.bands>0 && /fps/i.test(strata.info.st) && /fps/i.test(plain.info.st);
console.log(ok?"\nSTRATA BOOT: PASS":"\nSTRATA BOOT: FAIL");process.exit(ok?0:1);

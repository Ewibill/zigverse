import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function boot(url, ms){ const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+url); await p.waitForTimeout(ms||2600);
  // sample the ambience levers over time to prove the environment is actually moving
  const probe=await p.evaluate(()=>{ const A=window.ZigCore&&ZigCore.Ambience, M=window.ZigCore&&ZigCore.AmbienceMap, S=window.SickleField;
    return A? {src:A.src, tail:A.tail, energy:A.energy, temp:M.lev.temp, mist:M.lev.mist, glow:M.lev.glow, atau:(S&&S.after?S.after.tau:-1)}:null; });
  const st=await p.evaluate(()=>((document.getElementById("status")||{}).textContent||"").slice(0,60));
  const hard=e.filter(x=>!KNOWN.test(x)); await p.close(); return {url,st,hard,probe}; }
const amb1=await boot("zigambience.html", 2600);
await new Promise(r=>setTimeout(r,50));
const amb2=await boot("zigambience.html", 6000);   // later in the phrase — levers should differ
const plain=await boot("zigmurmuration.html", 2600);
console.log("ambience @2.6s:", JSON.stringify(amb1.probe), "hard", amb1.hard.length, amb1.hard[0]||"");
console.log("ambience @6.0s:", JSON.stringify(amb2.probe), "hard", amb2.hard.length);
console.log("plain (no amb):", JSON.stringify(plain.probe), "hard", plain.hard.length, "·", plain.st.slice(0,30));
await b.close();
const moved = amb1.probe && amb1.probe.src==="synth" && (Math.abs(amb1.probe.temp-amb2.probe.temp)>0.001 || Math.abs(amb1.probe.glow-amb2.probe.glow)>0.001);
const noTrail = amb1.probe && amb1.probe.atau < 0.02 && amb2.probe.atau < 0.02;   // afterimage OFF → crisp organism, no contrails
console.log("afterimage tau:", amb1.probe&&amb1.probe.atau, "/", amb2.probe&&amb2.probe.atau, noTrail?"(off — crisp)":"(ON — CONTRAILS!)");
const ok = amb1.hard.length===0 && amb2.hard.length===0 && plain.hard.length===0 && moved && noTrail && plain.probe.src==="off";
console.log(ok?"\nAMBIENCE BOOT: PASS":"\nAMBIENCE BOOT: FAIL"+(moved?"":" (levers static)"));
process.exit(ok?0:1);

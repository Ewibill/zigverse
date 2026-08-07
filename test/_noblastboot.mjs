import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
async function run(file){
  const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
  await p.goto("file:///home/claude/zigverse/"+file);
  await p.waitForTimeout(2800);
  // hold a note → in the blast build energy is injected; probe web.inject strength via a spy
  const injectedMax = await p.evaluate(async()=>{
    const P=window.ZigCore.Perf, F=window.SickleField.flock;
    let maxStr=0; const orig=F.web.inject.bind(F.web);
    F.web.inject=(x,y,z,s)=>{ if(s>maxStr) maxStr=s; return orig(x,y,z,s); };
    P.live=true; P.held.add(72); P.heldT&&P.heldT.set(72,1e12); P.attack=0.9;
    await new Promise(r=>setTimeout(r,900));
    P.held.clear();
    return maxStr;
  });
  const hard=e.filter(x=>!KNOWN.test(x)).length;
  await p.close();
  return {file, injectedMax, hard};
}
const blast = await run("dist/Environment_v1.6_reveal.html");     // energy ON (control)
const clean = await run("dist/Environment_v1.6_shapes_noblast.html"); // energy OFF
console.log("BLAST build  — max energy injected on a note:", blast.injectedMax.toFixed(2), "hard:", blast.hard);
console.log("NOBLAST build — max energy injected on a note:", clean.injectedMax.toFixed(2), "hard:", clean.hard);
await b.close();
const ok = blast.injectedMax > 0.5 && clean.injectedMax === 0 && blast.hard===0 && clean.hard===0;
console.log(ok?"\nNO-BLAST: PASS":"\nNO-BLAST: FAIL");
process.exit(ok?0:1);

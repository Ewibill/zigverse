import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v1.7_shapes.html");
await p.waitForTimeout(3000);
// grab a capture via the engine's own readback (avoids the blank-screenshot issue)
const cap = async ()=> await p.evaluate(async()=>{
  const f=window.SickleField.flock; if(!f||!f.capture) return null;
  const r=await f.capture();
  if(!r||r.error||!r.pixels) return {err:r&&r.error};
  // downsample to a checksum grid to keep it small
  let s=0,n=0; const px=r.pixels; for(let i=0;i<px.length;i+=4){ s+=px[i]+px[i+1]+px[i+2]; n++; }
  // also a coarse per-tile signature
  return {mean:s/n, len:px.length, w:r.width, h:r.height};
});
// letter reported by HUD
const letter=async()=>await p.evaluate(()=>((document.getElementById("engine")||{}).textContent||"").match(/wardrobe (\w+)/)?.[1]);
const cA1=await cap(); const lA=await letter();
// switch letter several times to a very different shape (woodblock/halo), let it settle
for(let i=0;i<3;i++){ await p.keyboard.press("KeyN"); await p.waitForTimeout(500); }
const cB=await cap(); const lB=await letter();
// control: same letter, two captures a moment apart (motion-only baseline)
const cA2=await cap();
console.log("capture A:",JSON.stringify(cA1),"letter",lA);
console.log("capture B:",JSON.stringify(cB),"letter",lB);
console.log("capture A2 (same letter as B):",JSON.stringify(cA2));
if(cA1&&cB&&cA1.mean!=null&&cB.mean!=null){
  console.log("mean brightness  A:",cA1.mean?.toFixed(2)," B:",cB.mean?.toFixed(2)," Δ:",Math.abs(cA1.mean-cB.mean).toFixed(3));
}
console.log("hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();

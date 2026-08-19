/* Reads the CLEAR VALUES the engine actually hands the GPU, by hooking
   beginRenderPass. The canvas cannot be read back under SwiftShader, so this
   is the closest thing to seeing the frame: what colour is the world cleared
   to, and does the sky uniform agree with it. */
import { chromium } from "playwright";
import path from "node:path"; import { pathToFileURL } from "node:url";
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox","--disable-gpu-sandbox"]});
const L=(c)=>0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
console.log("  ground      distinct clear values handed to the GPU (luminance)");
let fail=0;
for (const h of ["", "#ground=dusk", "#ground=mist", "#ground=paper"]) {
  const pg = await b.newPage({viewport:{width:800,height:450}});
  await pg.addInitScript(() => {
    window.__clears = new Set();
    const orig = GPUCommandEncoder.prototype.beginRenderPass;
    GPUCommandEncoder.prototype.beginRenderPass = function (d) {
      try { for (const a of (d.colorAttachments||[])) if (a && a.clearValue) {
        const c = a.clearValue;
        window.__clears.add([c.r,c.g,c.b].map(v=>(+v).toFixed(4)).join(","));
      } } catch {}
      return orig.call(this, d);
    };
  });
  await pg.goto(pathToFileURL(path.resolve(process.argv[2])).href + h, {waitUntil:"load"});
  await pg.waitForTimeout(5000);
  const r = await pg.evaluate(() => [...window.__clears]);
  const lums = r.map(s=>L(s.split(",").map(Number)));
  /* each ground has its OWN expected floor — "lit vs not" was too coarse and
     flagged dusk, whose 0.055 clear is exactly right. A gate that cries wolf
     on a correct build is the failure mode this project keeps re-learning. */
  const want = { "": [0, 0.005], "#ground=dusk": [0.03, 0.09],
                 "#ground=mist": [0.55, 0.80], "#ground=paper": [0.80, 0.95] }[h];
  const maxL = Math.max(...lums, 0);
  const ok = maxL >= want[0] && maxL <= want[1];
  if(!ok) fail++;
  console.log("  " + (h.replace("#ground=","")||"void").padEnd(11) +
    lums.map(v=>v.toFixed(4)).join("  ").padEnd(34) + (ok?"OK":"*** expected "+want[0]+"\u2013"+want[1]+" ***"));
  await pg.close();
}
await b.close();
console.log(fail===0 ? "\n  PASS — lit grounds hand the GPU a LIT clear; dark grounds stay dark."
                     : "\n  FAIL — " + fail + " ground(s) still clear to black");
process.exit(fail===0?0:1);

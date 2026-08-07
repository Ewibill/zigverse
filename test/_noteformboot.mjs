import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push(x.message));p.on("console",m=>{if(m.type()==="error")e.push(m.text())});
await p.goto("file:///home/claude/zigverse/dist/Environment_v1.2_noteform.html#world=custom&mat=nacre");
await p.waitForTimeout(3000);
const get=async(re)=>{const t=await p.evaluate(()=>(document.getElementById("hud")||{}).innerText||"");const m=t.match(re);return m?m[1]:"?";};
const on0=await p.evaluate(()=>/NOTE→FORM/.test((document.getElementById("hud")||{}).innerText||""));
// SIMULATE a held high note (84 → light form): inject into ZC.Perf
await p.evaluate(()=>{const P=window.ZigCore.Perf; P.live=true; P.held.add(84); P.heldT.set(84, 1e12); P.attack=0.8;});
await p.waitForTimeout(700);
const revHeld=await get(/reveal ([0-9.]+)/), letHeld=await get(/× ([A-Z]+)/);
// RELEASE
await p.evaluate(()=>{const P=window.ZigCore.Perf; P.held.clear();});
await p.waitForTimeout(1600);
const revRel=await get(/reveal ([0-9.]+)/);
console.log("NOTE→FORM shown:",on0);
console.log("held note 84 → letter:",letHeld," reveal(bloom):",revHeld);
console.log("released → reveal(dissolve):",revRel);
console.log("hard:",e.filter(x=>!KNOWN.test(x)).length);
await b.close();

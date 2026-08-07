import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();await p.setViewportSize({width:1600,height:820});
const e=[];p.on("pageerror",x=>e.push("P:"+x.message));p.on("console",m=>{if(m.type()==="error")e.push("C:"+m.text())});
await p.goto("file:///home/claude/zigverse/dist/Shape_Sheet.html");
await p.waitForTimeout(3000);
const labs=await p.evaluate(()=>Array.from(document.getElementById("labels").children).map(x=>x.textContent).join(","));
const skin0=await p.evaluate(()=>(document.getElementById("skin")||{}).textContent||"");
await p.keyboard.press("KeyM");await p.waitForTimeout(200);
const skin1=await p.evaluate(()=>(document.getElementById("skin")||{}).textContent||"");
const hard=e.filter(x=>!KNOWN.test(x));
console.log("labels("+labs.split(",").length+"):",labs);
console.log("skin0:",skin0,"| after M:",skin1);
console.log("hard:",hard.length);hard.slice(0,2).forEach(x=>console.log("  ",x.slice(0,160)));
try{await p.screenshot({path:"/tmp/shapesheet.png"});}catch(x){}
await b.close();

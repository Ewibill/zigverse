import { chromium } from "playwright";
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();await p.setViewportSize({width:1600,height:820});
await p.goto("file:///home/claude/zigverse/dist/Material_Sheet.html");
await p.waitForTimeout(3200);
try{await p.screenshot({path:"/tmp/sheet.png"});console.log("shot ok");}catch(x){console.log("shot failed:",x.message.slice(0,60));}
await b.close();

import { chromium } from "playwright";
const KNOWN=/valid external Instance reference no longer exists/i;
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium",args:["--enable-unsafe-webgpu","--enable-features=Vulkan","--use-angle=vulkan","--use-vulkan=swiftshader","--no-sandbox"]});
const p=await b.newPage();const e=[];p.on("pageerror",x=>e.push("PAGEERR: "+x.message));p.on("console",m=>{if(m.type()==="error")e.push("CONSOLE: "+m.text())});
await p.goto("file:///home/claude/zigverse/dist/Material_Sheet.html");
await p.waitForTimeout(3000);
e.filter(x=>!KNOWN.test(x)).forEach(x=>console.log(x.slice(0,300)));
console.log("(total non-known:",e.filter(x=>!KNOWN.test(x)).length,")");
await b.close();

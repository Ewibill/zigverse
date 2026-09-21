/* =============================================================================
   test/gem2_ref.mjs — DUAL GEM (v0.47), PROVED ON THE CPU
   run: node test/gem2_ref.mjs

   opts.gem2 puts a SECOND stone on the cupped interior while opts.gem keeps the
   shell. gemBlock was already parameterised by stone AND face condition, so the
   whole law is a second invocation at the same splice point — no new bindings,
   no new varyings, nothing that can change an auto-derived layout.

   Case C is why this file exists. The gem helper declarations (gemHueRot,
   gemSky) were gated on GEM alone. A second stone with no first would have
   emitted a block calling undeclared functions — nvidia tolerates a dangling
   reference, Metal refuses it and the whole pipeline fails to build: a black
   canvas with a healthy HUD at 165fps. That is 0.44.1 exactly, and it would
   have shipped invisibly on eyeZ.

   Byte-identity when gem2 is absent is tools/byte_identity.mjs's job, not this
   one. This proves the law is PRESENT and correct when it is declared.
   ========================================================================== */
import { readFileSync } from "fs"; import vm from "node:vm";
import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STUB=`globalThis.__shaders=[];globalThis.__err='';
globalThis.GPUBufferUsage={UNIFORM:64,COPY_DST:8,STORAGE:128,COPY_SRC:4,VERTEX:32,INDEX:16,INDIRECT:256,MAP_READ:1};
globalThis.GPUTextureUsage={RENDER_ATTACHMENT:16,TEXTURE_BINDING:4,COPY_DST:2,COPY_SRC:1,STORAGE_BINDING:8};
globalThis.GPUShaderStage={VERTEX:1,FRAGMENT:2,COMPUTE:4};globalThis.GPUMapMode={READ:1,WRITE:2};
globalThis.__mkGpu=function(){const nul=()=>({destroy(){},createView:()=>({})});const pipe=()=>({getBindGroupLayout:()=>({})});
return{device:{createBuffer:nul,createTexture:nul,createSampler:()=>({}),createShaderModule:(d)=>{globalThis.__shaders.push(d.code);return{}},
createBindGroupLayout:()=>({}),createPipelineLayout:()=>({}),createComputePipeline:pipe,createRenderPipeline:pipe,
createBindGroup:()=>({}),createCommandEncoder:()=>({}),queue:{writeBuffer(){},submit(){},writeTexture(){}},
limits:{},features:{has:()=>false},destroy(){}},format:"bgra8unorm",canvas:{width:1920,height:1080},ctx:{},configure(){},aspect:16/9}};`;
function run(extra){
  const ctx=vm.createContext({console,Math,JSON,Float32Array,Uint32Array,Int32Array,Uint8Array,ArrayBuffer,Object,Array,String,Number,Boolean,Error,TypeError,Map,Set,isNaN,parseInt,parseFloat,performance,Date});
  vm.runInContext(STUB,ctx);
  for(const f of["zigcore.js","zigmesh.js","zigwebgpu.js"]) vm.runInContext(readFileSync(ROOT+"/engine/"+f,"utf8"),ctx,{filename:f});
  vm.runInContext(`const OPTS={max:20000,count:6000,seed:1234,extent:60,extentY:30,cell:12,debris:0,mesh:ZigMesh.make(ZigMesh.presets.sicklePetal,{refine:1})};
  Object.assign(OPTS,${JSON.stringify(extra||{})});
  try{ZigWebGPU.createFlock(__mkGpu(),OPTS)}catch(e){globalThis.__err=String(e).slice(0,140)}`,ctx);
  return{src:vm.runInContext("__shaders",ctx).join("\n"),err:vm.runInContext("__err||''",ctx)};
}
const NACRE={dark:[0.12,0.115,0.13],light:[0.92,0.90,0.88],moon:[0.55,0.58,0.72],iriBase:0.55,iriBurst:2.9,tex:[2,18,0.16,26,0.5,0.15,0.65,0]};
const DIAMOND={col:[0.93,0.96,1.00],ior:2.42,disp:0.045,facet:1.00,spark:1.00};
const EMERALD={col:[0.05,0.70,0.50],ior:1.58,disp:0.014,facet:0.52,spark:0.42};
const T=(n,c)=>console.log((c?"  OK   ":"  FAIL ")+n);
let bad=0; const chk=(n,c)=>{T(n,c); if(!c)bad++;};

console.log("A — gem alone (shell only)");
let a=run({material:NACRE,gem:DIAMOND});
chk("no error", !a.err); if(a.err)console.log("     "+a.err);
chk("one gem block", (a.src.match(/Q rotates the stone/g)||[]).length===1);

console.log("\nB — DUAL GEM: diamond shell + emerald interior");
let b=run({material:NACRE,gem:DIAMOND,gem2:EMERALD});
chk("no error", !b.err); if(b.err)console.log("     "+b.err);
chk("TWO gem blocks", (b.src.match(/Q rotates the stone/g)||[]).length===2);
chk("shell guarded by ff", b.src.includes("if (ff) {"));
chk("interior guarded by !ff", b.src.includes("if (!ff) {"));
chk("diamond ior present (eta 0.41322)", b.src.includes("0.41322"));
chk("emerald ior present (eta 0.63291)", b.src.includes("0.63291"));
chk("longer than single-gem", b.src.length > a.src.length);

console.log("\nC — the 0.44.1 trap: gem2 with NO gem");
let c=run({material:NACRE,gem2:EMERALD});
chk("no error", !c.err); if(c.err)console.log("     "+c.err);
chk("gemHueRot IS declared", c.src.includes("fn gemHueRot"));
chk("gemSky IS declared", c.src.includes("fn gemSky"));
chk("exactly one gem block", (c.src.match(/Q rotates the stone/g)||[]).length===1);

console.log("\nD — hue offset");
let d=run({material:NACRE,gem:DIAMOND,gem2:EMERALD,gem2Hue:0.5});
chk("offset constant emitted", d.src.includes("V.render3.x * 6.2831 + 3.14155"));
chk("shell UNoffset", d.src.includes("), V.render3.x * 6.2831);"));

console.log("\nE — gemBuff");
let e=run({material:NACRE,gem:DIAMOND,gem2:EMERALD,gemBuff:1.0});
chk("buff 1.0 emitted", e.src.includes("select(1.0, 1.0, !ff)"));
chk("default is 0.5", b.src.includes("select(1.0, 0.5, !ff)"));

console.log("\n"+(bad?`FAIL — ${bad} check(s)`:"PASS — all checks"));
process.exit(bad?1:0);

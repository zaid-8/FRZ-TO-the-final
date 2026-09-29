import {MATERIALS} from './geometry.js';
import {meshVertex,meshFragment,glassFragment,skyVertex,skyFragment,depthFragment} from './shaders.js';
import {model,lookAt,ortho,matmul} from './math.js';
const neutralLight=()=>({tint:[1,1,1],exposure:1,night:0,luma:.22});
const bounded=(value,low,high)=>Math.max(low,Math.min(high,value));
export function estimatePhotoLight(pixels,width,height){
 if(!pixels?.length||!width||!height)return neutralLight();
 const sum=[0,0,0];let total=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,alpha=pixels[i+3]/255;if(alpha<.2)continue;
  const rgb=[0,1,2].map(c=>{const s=pixels[i+c]/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4);});
  const weight=alpha*(y<height*.45?1.35:1);total+=weight;for(let c=0;c<3;c++)sum[c]+=rgb[c]*weight;
 }
 if(!total)return neutralLight();
 const average=sum.map(c=>c/total),luma=average[0]*.2126+average[1]*.7152+average[2]*.0722;
 const level=bounded((Math.sqrt(luma)-.11)/.47,0,1),day=bounded((luma-.025)/.14,0,1);
 const tint=average.map(c=>bounded(1+(c/Math.max(luma,.025)-1)*.16,.86,1.12));
 return {tint,exposure:.78+.34*level,night:1-day*day*(3-2*day),luma};
}
export async function loadCabin(url,onProgress){
 const response=await fetch(url);if(!response.ok)throw new Error('Cabin asset unavailable: '+response.status);
 const size=Number(response.headers.get('content-length'));let data;
 if(response.body){const reader=response.body.getReader(),chunks=[];let n=0;for(;;){let {done,value}=await reader.read();if(done)break;chunks.push(value);n+=value.length;onProgress?.(size?n/size:null);}let bytes=new Uint8Array(n),o=0;for(let c of chunks){bytes.set(c,o);o+=c.length;}data=bytes.buffer;}else data=await response.arrayBuffer();
 return parseGLB(data);
}
export function parseGLB(data){const v=new DataView(data);if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2)throw new Error('Invalid GLB 2 asset');const jl=v.getUint32(12,true),doc=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,jl))),bo=20+jl+8;function read(i){const a=doc.accessors[i],b=doc.bufferViews[a.bufferView];if(a.componentType!==5126||a.type!=='VEC3')throw new Error('Unsupported GLB accessor');return new Float32Array(data,bo+(b.byteOffset||0)+(a.byteOffset||0),a.count*3);}
 const meshes=[];for(let mesh of doc.meshes)for(let p of mesh.primitives){let ps=read(p.attributes.POSITION),ns=read(p.attributes.NORMAL),packed=new Float32Array(ps.length*2);for(let i=0;i<ps.length/3;i++){packed.set(ps.subarray(i*3,i*3+3),i*6);packed.set(ns.subarray(i*3,i*3+3),i*6+3);}meshes.push({material:doc.materials[p.material].name,data:packed});}return {meshes,anchor:doc.extras.ropeAnchor,document:doc};}
export class Renderer {
 constructor(canvas){
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,powerPreference:'high-performance'});if(!gl)throw new Error('WebGL2 is unavailable');
  this.main=this.program(meshVertex,meshFragment);this.glass=this.program(meshVertex,glassFragment);this.depth=this.program(meshVertex,depthFragment);this.sky=this.program(skyVertex,skyFragment);this.empty=gl.createVertexArray();this.environment=this.createEnvironment();
  this.sceneTexture=this.texture(1,1);this.sceneDepth=gl.createRenderbuffer();this.sceneFbo=gl.createFramebuffer();
  this.compositionTexture=this.texture(1,1);this.compositionFbo=gl.createFramebuffer();this.targetsReady=false;
  this.transparentTexture=this.texture(1,1);this.photoCache=new Map();this.photoClock=0;this.photoProtected=new Set();this.disposed=false;this.maxPhotoSize=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE));
  this.shadowTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.shadowTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,1024,1024,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);for(let p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);for(let p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);this.shadowFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.shadowTexture,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);this.dpr=Math.min(devicePixelRatio||1,1.65);this.frames=0;this.metrics={frames:0,frameMs:0,scale:this.dpr};
 }
 program(vs,fs){const gl=this.gl,p=gl.createProgram();for(let [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return {p,loc:new Map()};}
 uni(program,name,value){const gl=this.gl;let l=program.loc.get(name);if(l===undefined){l=gl.getUniformLocation(program.p,name);program.loc.set(name,l);}if(l===null)return;if(typeof value==='number')gl.uniform1f(l,value);else if(value.length===16)gl.uniformMatrix4fv(l,false,value);else if(value.length===3)gl.uniform3fv(l,value);else if(value.length===2)gl.uniform2fv(l,value);}
 sampler(p,name,texture,unit,cube=false){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(cube?gl.TEXTURE_CUBE_MAP:gl.TEXTURE_2D,texture);const l=gl.getUniformLocation(p.p,name);if(l!==null)gl.uniform1i(l,unit);}
 texture(w,h){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
 createEnvironment(){const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_CUBE_MAP,t);const size=32;for(let f=0;f<6;f++){let pixels=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){let v=y/(size-1)*2-1,dy=f===2?1:f===3?-1:-v,sky=Math.max(0,Math.min(1,(dy+1)/2)),i=(y*size+x)*4;let lower=[.28,.34,.39],upper=[.68,.77,.85];for(let c=0;c<3;c++)pixels[i+c]=(lower[c]*(1-sky)+upper[c]*sky)*255;pixels[i+3]=255;}gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+f,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);}gl.generateMipmap(gl.TEXTURE_CUBE_MAP);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);return t;}
 releasePhoto(entry){if(entry.image){entry.image.onload=null;entry.image.onerror=null;entry.image.src='';entry.image=null;}if(entry.texture){this.gl.deleteTexture(entry.texture);entry.texture=null;}entry.ready=false;}
 trimPhotos(){while(this.photoCache.size>4){let oldest=null;for(const [src,entry] of this.photoCache)if(!this.photoProtected.has(src)&&(!oldest||entry.used<oldest[1].used))oldest=[src,entry];if(!oldest)break;this.releasePhoto(oldest[1]);this.photoCache.delete(oldest[0]);}}
 requestPhoto(src){
  if(!src||this.disposed)return null;
  let entry=this.photoCache.get(src);if(entry){entry.used=++this.photoClock;return entry;}
  const gl=this.gl,image=new Image();entry={src,image,texture:null,aspect:1,ready:false,failed:false,light:neutralLight(),used:++this.photoClock};this.photoCache.set(src,entry);this.trimPhotos();
  const active=()=>!this.disposed&&this.photoCache.get(src)===entry;
  const finish=()=>{image.onload=null;image.onerror=null;entry.image=null;if(active())this.onTextureReady?.();};
  image.crossOrigin='anonymous';image.decoding='async';
  image.onload=()=>{
   if(!active())return;
   let texture=null;
   try{
    const width=image.naturalWidth,height=image.naturalHeight;if(!width||!height)throw new Error('Empty photograph');
    let source=image;const scale=Math.min(1,this.maxPhotoSize/Math.max(width,height));
    if(scale<1){const reduced=document.createElement('canvas');reduced.width=Math.max(1,Math.round(width*scale));reduced.height=Math.max(1,Math.round(height*scale));const ctx=reduced.getContext('2d');if(!ctx)throw new Error('Photograph resize unavailable');ctx.drawImage(image,0,0,reduced.width,reduced.height);source=reduced;}
    try{const probe=this.photoProbe||(this.photoProbe=document.createElement('canvas'));probe.width=32;probe.height=24;const ctx=probe.getContext('2d',{willReadFrequently:true});if(ctx){ctx.drawImage(source,0,0,32,24);entry.light=estimatePhotoLight(ctx.getImageData(0,0,32,24).data,32,24);}}catch{entry.light=neutralLight();}
    gl.activeTexture(gl.TEXTURE0);texture=this.texture(1,1);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,source);entry.texture=texture;entry.aspect=width/height;entry.ready=true;
   }catch(error){if(texture)gl.deleteTexture(texture);entry.failed=true;entry.error=String(error.message||error);}
   finally{gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.bindTexture(gl.TEXTURE_2D,null);finish();}
  };
  image.onerror=()=>{if(!active())return;entry.failed=true;finish();};image.src=src;return entry;
 }
 preparePhotos(state){
  const specs=[state.photoA,state.photoB];this.photoProtected=new Set(specs.map(p=>p?.src).filter(src=>typeof src==='string'&&src));
  const entries=specs.map(p=>this.requestPhoto(typeof p?.src==='string'?p.src:null));this.trimPhotos();
  const fraction=(value,fallback=.5)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
  const mix=fraction(state.photoMix,0),drift=fraction(state.photoDrift,0),lights=entries.map(e=>e?.ready?e.light:neutralLight());
  const blend=key=>lights[0][key]*(1-mix)+lights[1][key]*mix;
  const light={tint:lights[0].tint.map((c,i)=>c*(1-mix)+lights[1].tint[i]*mix),exposure:blend('exposure'),night:blend('night'),luma:blend('luma')};
  const scale=Number.isFinite(state.photoScale)?bounded(state.photoScale,1,1.08):1+.035*drift,pan=[0,1].map(i=>Number.isFinite(state.photoPan?.[i])?bounded(state.photoPan[i],-.01,.01):0);
  return {entries,positions:specs.map(p=>[fraction(p?.position?.[0]),fraction(p?.position?.[1])]),mix,drift,scale,pan,light};
 }
 bindPhotos(program,photos,w,h){
  const [a,b]=photos.entries;this.sampler(program,'uPhotoA',a?.ready?a.texture:this.transparentTexture,4);this.sampler(program,'uPhotoB',b?.ready?b.texture:this.transparentTexture,5);
  for(const [name,value] of Object.entries({uResolution:[w,h],uPhotoReady:[a?.ready?1:0,b?.ready?1:0],uPhotoAspect:[a?.aspect||1,b?.aspect||1],uPhotoPositionA:photos.positions[0],uPhotoPositionB:photos.positions[1],uPhotoMix:photos.mix,uPhotoDrift:photos.drift,uPhotoScale:photos.scale,uPhotoPan:photos.pan,uLightTint:photos.light.tint,uExposure:photos.light.exposure,uNight:photos.light.night}))this.uni(program,name,value);
 }
 upload(mesh){const gl=this.gl,vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindVertexArray(null);return {vao,buffer,count:mesh.data.length/6,material:mesh.material};}
 disposeMesh(m){this.gl.deleteBuffer(m.buffer);this.gl.deleteVertexArray(m.vao);}
 resize(){
  const gl=this.gl,w=Math.max(1,Math.round(this.canvas.clientWidth*this.dpr)),h=Math.max(1,Math.round(this.canvas.clientHeight*this.dpr));
  if(this.targetsReady&&w===this.canvas.width&&h===this.canvas.height)return;
  this.targetsReady=false;this.canvas.width=w;this.canvas.height=h;
  gl.activeTexture(gl.TEXTURE0);gl.bindRenderbuffer(gl.RENDERBUFFER,this.sceneDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);
  try{
   for(const [name,fbo,texture] of [['scene',this.sceneFbo,this.sceneTexture],['composition',this.compositionFbo,this.compositionTexture]]){
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);

    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.sceneDepth);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);gl.readBuffer(gl.COLOR_ATTACHMENT0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Incomplete '+name+' framebuffer');
   }
   this.targetsReady=true;
  }finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);}
 }
 drawMeshes(p,items,glass){const gl=this.gl;for(let item of items){this.uni(p,'uModel',item.matrix||model());for(let m of item.meshes){if((m.material==='glass')!==glass)continue;const mat=MATERIALS[m.material]||MATERIALS.stone;this.uni(p,'uColor',mat.color);this.uni(p,'uMetal',mat.metal);this.uni(p,'uRough',mat.rough);this.uni(p,'uKind',mat.kind);gl.bindVertexArray(m.vao);gl.drawArrays(gl.TRIANGLES,0,m.count);}}}
 draw(items,state){
  this.resize();let gl=this.gl,w=this.canvas.width,h=this.canvas.height;const photos=this.preparePhotos(state),routeX=Number.isFinite(state.routeX)?state.routeX:0;let shadowCenter=[routeX,5,-25];let lightVP=matmul(ortho(-100,100,-100,100,1,350),lookAt([routeX-100,140,80],shadowCenter));this.lightVP=lightVP;
  gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.depthMask(true);gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadowFbo);gl.viewport(0,0,1024,1024);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(this.depth.p);this.uni(this.depth,'uVP',lightVP);this.uni(this.depth,'uLightVP',lightVP);this.drawMeshes(this.depth,items,false);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.sceneFbo);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.useProgram(this.sky.p);this.bindPhotos(this.sky,photos,w,h);gl.bindVertexArray(this.empty);gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
  gl.useProgram(this.main.p);for(let [k,v] of Object.entries({uVP:state.vp,uLightVP:lightVP,uEye:state.eye,uFog:state.fog||[.58,.65,.72],uGround:state.ground||[.47,.49,.31],uLightTint:photos.light.tint,uExposure:photos.light.exposure,uNight:photos.light.night}))this.uni(this.main,k,v);this.sampler(this.main,'uShadow',this.shadowTexture,0);this.sampler(this.main,'uEnvironment',this.environment,1,true);this.drawMeshes(this.main,items,false);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.compositionFbo);gl.clear(gl.COLOR_BUFFER_BIT);

  gl.depthFunc(gl.LEQUAL);this.drawMeshes(this.main,items,false);gl.depthFunc(gl.LESS);
  gl.useProgram(this.glass.p);for(let [k,v] of Object.entries({uVP:state.vp,uLightVP:lightVP,uEye:state.eye,uResolution:[w,h]}))this.uni(this.glass,k,v);this.sampler(this.glass,'uScene',this.sceneTexture,2);this.bindPhotos(this.glass,photos,w,h);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);this.drawMeshes(this.glass,items,true);gl.depthMask(true);gl.disable(gl.BLEND);

  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.compositionFbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
  gl.blitFramebuffer(0,0,w,h,0,0,w,h,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindVertexArray(null);
  if(this.frames<2){const error=gl.getError();this.metrics.glError=error;if(error!==gl.NO_ERROR)throw new Error('WebGL presentation error '+error);}
  this.frames++;
 }
 dispose(){this.disposed=true;const gl=this.gl;for(const entry of this.photoCache.values())this.releasePhoto(entry);this.photoCache.clear();this.photoProtected.clear();if(this.photoProbe){this.photoProbe.width=0;this.photoProbe.height=0;this.photoProbe=null;}for(let p of [this.main,this.glass,this.depth,this.sky])gl.deleteProgram(p.p);for(let t of [this.environment,this.sceneTexture,this.compositionTexture,this.shadowTexture,this.transparentTexture])gl.deleteTexture(t);gl.deleteFramebuffer(this.sceneFbo);gl.deleteFramebuffer(this.compositionFbo);gl.deleteFramebuffer(this.shadowFbo);gl.deleteRenderbuffer(this.sceneDepth);gl.deleteVertexArray(this.empty);this.targetsReady=false;}
}

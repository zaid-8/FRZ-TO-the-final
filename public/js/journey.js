import {DATA} from './destinations.js';
import {Builder} from './geometry.js';
import {clamp,smooth,norm,cross,vadd,vsub,mul,perspective,lookAt,matmul,model,project} from './math.js';
import {Renderer,loadCabin} from './render.js';
import {buildStation} from './station.js';

export const SPACING=24,DEPARTURE=.8,LAST_STATION=Math.max(0,DATA.length-1),TRAVEL=LAST_STATION+DEPARTURE;
export const ropeHeight=x=>{const z=Math.max(0,x-3.6);return 2.7658-.14*(z-3*(1-Math.exp(-z/3)))-.26*(1-Math.cos(z*Math.PI*2/SPACING))*smooth(z/6);};
export const progressForStation=index=>index<=0?0:(clamp(index,0,LAST_STATION)+DEPARTURE)/TRAVEL;
export function evaluateJourney(progress,width,height){
 const p=clamp(progress),travel=p*TRAVEL,q=clamp(travel-DEPARTURE,0,LAST_STATION),i=Math.min(Math.max(0,LAST_STATION-1),Math.floor(q)),t=q-i;
 const mobile=width<=720,aspect=Math.max(1,width)/Math.max(1,height),routeX=travel*SPACING;
 const departure=clamp(travel/DEPARTURE),yaw=.38+.025*Math.sin(travel*.5),anchor=[routeX,ropeHeight(routeX),0];
 const center=[anchor[0]+.12*Math.cos(yaw),anchor[1]-2.7658,anchor[2]-.12*Math.sin(yaw)];
 const fov=(mobile?50:43)*Math.PI/180,fraction=mobile?Math.min(height<=740?.33:.435,.275*Math.max(1,height)*3.02/(Math.max(1,width)*4.35)):Math.min(.212,.54*Math.max(1,height)*3.02/(Math.max(1,width)*4.35)),distance=3.02/(2*Math.tan(fov/2)*aspect*fraction);
 const forward=norm([0,-.035,-1]),right=[1,0,0],up=cross(right,forward);
 const ndc=[mobile?-.24:-.48,.64-2.7658/(distance*Math.tan(fov/2))-.04*p+.012*Math.sin(travel*Math.PI*2)];
 const eye=vsub(vsub(vsub(center,mul(forward,distance)),mul(right,ndc[0]*distance*Math.tan(fov/2)*aspect)),mul(up,ndc[1]*distance*Math.tan(fov/2)));
 const target=vadd(eye,mul(forward,10)),vp=matmul(perspective(fov,aspect,.1,500),lookAt(eye,target));

 const photoMix=smooth((t-.23)/.54),photoA=DATA[i]?.photo,photoB=DATA[Math.min(i+1,LAST_STATION)]?.photo;
 const photoDrift=.5-.5*Math.cos(travel*Math.PI/1.6),photoScale=1.025+.025*photoDrift;
 const photoPan=[.0035*Math.sin(travel*.7),.0025*Math.sin(travel*.51)];
 return {p,q,i,t,travel,departure,mobile,eye,target,vp,routeX,center,yaw,matrix:model(center,yaw),anchor,cabinNdc:project(center,vp),photoA,photoB,photoMix,photoDrift,photoScale,photoPan,ground:[.42,.49,.34],fog:[.55,.64,.69]};
}

export function cableMeshes(){
 const b=new Builder(),points=[];
 const start=-160,end=Math.ceil(TRAVEL*SPACING+160);
 for(let x=start;x<=end;x++)points.push([x,ropeHeight(x),0]);
 b.tube(points,.026,'cable',8);return b.finish();
}
export class Journey {
 constructor({canvas,section,onUpdate,onLoad,onFailure,reduced=false,scrollDriven=true,scrollInset=0}){Object.assign(this,{canvas,section,onUpdate,onLoad,onFailure,reduced,scrollDriven,scrollInset});this.target=0;this.current=0;this.chapters=new Map();this.raf=0;this.ready=false;this.lastTime=0;this.lastDraw=-1;this.poorFrames=0;this.contextLost=false;}
 async init(initialIndex=null){try{
  this.renderer=new Renderer(this.canvas);this.renderer.onTextureReady=()=>{this.lastDraw=-1;this.wake();};
  this.cabin=await loadCabin('assets/models/darb-cabin.glb',this.onLoad);this.cabinMeshes=this.cabin.meshes.map(m=>this.renderer.upload(m));
  this.station=buildStation().map(m=>this.renderer.upload(m));this.cable=cableMeshes().map(m=>this.renderer.upload(m));
  this.ready=true;this.resize();if(initialIndex===null){this.current=this.target;this.lastDraw=-1;}else this.go(initialIndex,true);this.onLoad?.(1);
  this.canvas.addEventListener('webglcontextlost',this.onContextLost=e=>{e.preventDefault();this.contextLost=true;this.stop();this.onFailure?.('context');});this.stop();this.tick(performance.now());
 }catch(e){this.failureReason=e.message;this.onFailure?.(e.message);}}
 resize(){this.top=this.section.getBoundingClientRect().top+scrollY-this.scrollInset;this.length=Math.max(1,this.section.offsetHeight-this.canvas.clientHeight);this.readScroll();this.lastDraw=-1;this.wake();}
 readScroll(){if(this.reduced||!this.scrollDriven)return;this.target=clamp((scrollY-this.top)/this.length);this.wake();}
 moveTo(p,instant=false){this.target=clamp(p);if(this.reduced||instant){this.current=this.target;this.lastDraw=-1;this.wake();if(this.reduced)return;}if(this.scrollDriven)window.scrollTo({top:this.top+this.length*this.target,behavior:instant||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});else this.wake();}
 go(index,instant=false){this.moveTo(progressForStation(index),instant);}
 depart(){this.moveTo(DEPARTURE/TRAVEL);}
 wake(){if(this.ready&&!this.raf&&!document.hidden&&!this.contextLost)this.raf=requestAnimationFrame(t=>this.tick(t));}
 tick(time){
  this.raf=0;if(!this.ready||this.contextLost)return;const dt=Math.min(.05,Math.max(.001,(time-(this.lastTime||time-16))/1000));this.lastTime=time;
  this.current=this.reduced?this.target:this.current+(this.target-this.current)*(1-Math.exp(-dt/.055));
  if(Math.abs(this.current-this.target)<.000008)this.current=this.target;
  if(this.lastDraw!==this.current){
   const begin=performance.now(),state=evaluateJourney(this.current,this.canvas.clientWidth,this.canvas.clientHeight);
   const items=[{meshes:this.cabinMeshes,matrix:state.matrix},{meshes:this.cable}];if(state.routeX<60)items.unshift({meshes:this.station});
   try{this.renderer.draw(items,state);}catch(e){this.failureReason=e.message;this.ready=false;this.stop();this.onFailure?.(e.message);return;}
   this.state=state;this.onUpdate?.(state);this.lastDraw=this.current;
   const ms=performance.now()-begin;this.renderer.metrics.frameMs=ms;this.renderer.metrics.frames++;
   this.poorFrames=ms>34?this.poorFrames+1:Math.max(0,this.poorFrames-1);
   if(this.poorFrames>18&&this.renderer.dpr>1){this.renderer.dpr=Math.max(1,this.renderer.dpr-.25);this.renderer.metrics.scale=this.renderer.dpr;this.poorFrames=0;this.lastDraw=-1;}
  }if(this.current!==this.target||this.lastDraw<0)this.wake();
 }
 stop(){cancelAnimationFrame(this.raf);this.raf=0;}
 destroy(){this.stop();if(this.renderer){this.renderer.onTextureReady=null;for(let m of [...this.cabinMeshes||[],...this.station||[],...this.cable||[]])this.renderer.disposeMesh(m);this.renderer.dispose();}if(this.onContextLost)this.canvas.removeEventListener('webglcontextlost',this.onContextLost);}
}

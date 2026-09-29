import {clamp,mix,mercator,scenicViewport} from './scenic-map-core.js';

const polygons=geometry=>geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
export class ScenicAtlas{
 constructor(canvas,geography,journey){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw new Error('Canvas map unavailable.');this.geo=geography;this.journey=journey;this.width=1;this.height=1;this.dpr=1;this.state=journey.state(0);this.resize(canvas.clientWidth||1,canvas.clientHeight||1);
 }
 resize(width,height,dpr=globalThis.devicePixelRatio||1){
  this.width=Math.max(1,width);this.height=Math.max(1,height);this.dpr=clamp(dpr,1,1.75);
  this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.canvas.style.width=this.width+'px';this.canvas.style.height=this.height+'px';
 }
 setup(state){
  this.state=state;this.center=mercator(state.coord);const viewport=scenicViewport(this.width,this.height);this.origin=viewport.origin;
  this.scale=512*2**Math.min(state.zoom,viewport.mobile?8.1:8.7)*(viewport.mobile?.73:1);this.angle=-state.bearing*Math.PI/180;this.pitch=Math.min(state.pitch,52)*Math.PI/180;
 }
 project(coord){
  if(!this.center)this.setup(this.state);
  const p=mercator(coord),dx=(p[0]-this.center[0])*this.scale,dy=(p[1]-this.center[1])*this.scale,x=dx*Math.cos(this.angle)-dy*Math.sin(this.angle),z=dx*Math.sin(this.angle)+dy*Math.cos(this.angle),perspective=clamp(1+z*Math.sin(this.pitch)/(this.height*1.65),.3,5);
  return {x:this.origin[0]+x/perspective,y:this.origin[1]+z*Math.cos(this.pitch)/perspective};
 }
 path(points,close=false,begin=true){const c=this.ctx;if(begin)c.beginPath();points.forEach((point,index)=>{const p=this.project(point);if(index)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);});if(close)c.closePath();}
 geometry(geometry){this.ctx.beginPath();for(const polygon of polygons(geometry))for(const ring of polygon)this.path(ring,true,false);}
 draw(state){
  if(!this.ctx)return;this.setup(state);const c=this.ctx,w=this.width,h=this.height;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);
  const background=c.createLinearGradient(0,0,w,h);background.addColorStop(0,'#070e19');background.addColorStop(.65,state.light>.6?'#17282e':'#101f2b');background.addColorStop(1,'#080e1b');c.fillStyle=background;c.fillRect(0,0,w,h);
  c.strokeStyle='rgba(175,191,198,.055)';c.lineWidth=.6;
  for(let lng=29;lng<=44;lng+=.5){this.path([[lng,25],[lng,38]]);c.stroke();}
  for(let lat=25;lat<=38;lat+=.5){this.path([[29,lat],[44,lat]]);c.stroke();}
  const land=c.createLinearGradient(0,0,w,h);land.addColorStop(0,'#34434b');land.addColorStop(.5,state.light>.6?'#575448':'#304451');land.addColorStop(1,'#293c43');
  for(const f of this.geo.country?.features||[]){this.geometry(f.geometry);c.fillStyle=land;c.fill('evenodd');c.strokeStyle='rgba(218,194,137,.72)';c.lineWidth=1.2;c.stroke();}
  const activeISO=state.arrival?this.journey.stops[state.index]?.governorateISO:null;
  for(const f of this.geo.administrative?.features||[]){this.geometry(f.geometry);if(activeISO&&f.properties?.ISO===activeISO){c.fillStyle='rgba(229,203,135,.14)';c.fill('evenodd');}c.strokeStyle='rgba(204,213,199,.35)';c.lineWidth=.85;c.stroke();}
  if(this.journey.route.length>1){this.path(this.journey.route);c.setLineDash([2,6]);c.strokeStyle='rgba(233,202,129,.24)';c.lineWidth=1;c.stroke();c.setLineDash([]);}
  if(state.routeIndex>.01){this.path(this.journey.routeAt(state));c.strokeStyle='rgba(237,199,104,.15)';c.lineWidth=8;c.stroke();c.strokeStyle='#e7c875';c.lineWidth=1.6;c.shadowColor='#ffdfa1';c.shadowBlur=8;c.stroke();c.shadowBlur=0;}
  for(let index=0;index<this.journey.stops.length;index++){
   const p=this.project(this.journey.stops[index].coord),active=state.arrival===1&&state.index===index;if(p.x<-20||p.x>w+20||p.y<-20||p.y>h+20)continue;
   if(active){c.beginPath();c.arc(p.x,p.y,12,0,Math.PI*2);c.fillStyle='rgba(238,205,130,.13)';c.fill();c.strokeStyle='rgba(238,205,130,.48)';c.lineWidth=1;c.stroke();}
   c.beginPath();c.arc(p.x,p.y,active?4:2.2,0,Math.PI*2);c.fillStyle=active?'#fff4cd':index<=state.index?'#e7c875':'#7e999d';c.fill();
  }
  if(state.p>.03&&state.p<.96){const head=this.project(state.head);c.beginPath();c.arc(head.x,head.y,3,0,Math.PI*2);c.fillStyle='#fff4d7';c.shadowColor='#ffe0a3';c.shadowBlur=12;c.fill();c.shadowBlur=0;}
  if(state.intro>.1||state.end>.2){const p=this.project([37.5,31.55]);c.font='10px DarbSans, sans-serif';c.textAlign='center';c.fillStyle='rgba(219,224,219,.6)';c.fillText(state.locale==='en'?'J O R D A N':'الأردن',p.x,p.y);}
 }
 destroy(){this.ctx?.clearRect(0,0,this.canvas.width,this.canvas.height);this.ctx=null;}
}

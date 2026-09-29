export const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
export const mix=(a,b,t)=>a+(b-a)*t;
export const ease=value=>{const t=clamp(value);return t*t*t*(t*(t*6-15)+10);};
export const mercator=([lng,lat])=>[(lng+180)/360,(1-Math.asinh(Math.tan(clamp(lat,-85,85)*Math.PI/180))/Math.PI)/2];
export const lngLat=([x,y])=>[x*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI];
export const headingMix=(a,b,t)=>a+((((b-a)%360)+540)%360-180)*t;
export const distance=(a,b)=>{const r=Math.PI/180,dlat=(b[1]-a[1])*r,dlng=(b[0]-a[0])*r,q=Math.sin(dlat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dlng/2)**2;return 12742*Math.atan2(Math.sqrt(q),Math.sqrt(Math.max(0,1-q)));};
export function scenicViewport(width,height){
 const w=Math.max(1,width),h=Math.max(1,height),mobile=w<=760;
 const padding=mobile?{left:30,right:30,top:Math.min(40,h*.12),bottom:Math.min(35,h*.1)}:{left:Math.min(w*.4,Math.max(340,w*.33)),right:Math.min(80,w*.08),top:Math.min(100,h*.18),bottom:Math.min(150,h*.23)};
 return {mobile,padding,origin:[(w+padding.left-padding.right)/2,(h+padding.top-padding.bottom)/2]};
}
function curve(points,index,t){
 const p=points[index],q=points[index+1],a=points[Math.max(0,index-1)],b=points[Math.min(points.length-1,index+2)],length=Math.hypot(q[0]-p[0],q[1]-p[1]),u=1-t;
 const control=(base,start,end,sign)=>{const dx=end[0]-start[0],dy=end[1]-start[1],norm=Math.hypot(dx,dy)||1;return [base[0]+sign*dx/norm*length*.16,base[1]+sign*dy/norm*length*.16];};
 const c=control(p,a,q,1),d=control(q,p,b,-1);
 return [0,1].map(k=>u*u*u*p[k]+3*u*u*t*c[k]+3*u*t*t*d[k]+t*t*t*q[k]);
}
export function createScenicJourney(input){
 if(!Array.isArray(input)||!input.length||input.some(stop=>!stop?.id||!Array.isArray(stop.coord)||stop.coord.length!==2||!stop.coord.every(Number.isFinite)||Math.abs(stop.coord[0])>180||Math.abs(stop.coord[1])>85)||new Set(input.map(stop=>stop.id)).size!==input.length)throw new TypeError('Scenic stops require unique IDs and valid longitude/latitude coordinates.');
 const stops=input.map(stop=>({...stop,coord:[...stop.coord],zoom:clamp(stop.zoom??10.6,5,14),pitch:clamp(stop.pitch??62,0,74),bearing:Number.isFinite(stop.bearing)?stop.bearing:0}));
 const overview={coord:[36.6,31.22],zoom:6.35,pitch:49,bearing:-13,light:.12};
 const count=stops.length,step=count>1?.82/(count-1):.82,hold=Math.min(.032,step*.43),arrivals=stops.map((_,index)=>.07+index*step),holds=arrivals.map((arrival,index)=>count===1?.92:arrival+hold);
 const frames=stops.map((stop,index)=>({...stop,light:mix(.16,.8,count>1?index/(count-1):0)})),projected=stops.map(stop=>mercator(stop.coord)),route=[[...stops[0].coord]],offsets=[0];
 for(let index=0;index<count-1;index++){
  for(let sample=1;sample<=72;sample++)route.push(sample===72?[...stops[index+1].coord]:lngLat(curve(projected,index,sample/72)));
  offsets.push(route.length-1);
 }
 const routePoint=position=>{const at=clamp(position,0,route.length-1),a=Math.floor(at),b=Math.min(a+1,route.length-1);return route[a].map((value,k)=>mix(value,route[b][k],at-a));};
 function between(a,b,t,position){
  const u=ease(t),arc=Math.sin(Math.PI*u)**2,d=distance(a.coord,b.coord),baseZoom=mix(a.zoom,b.zoom,u),flightZoom=d>1?Math.min(a.zoom,b.zoom,12-Math.log2(Math.max(d,1)/3)):Math.min(a.zoom,b.zoom),pa=mercator(a.coord),pb=mercator(b.coord);
  const coord=t<=0?[...a.coord]:t>=1?[...b.coord]:position===undefined?lngLat(pa.map((value,k)=>mix(value,pb[k],u))):routePoint(position);
  return {coord,zoom:baseZoom-(baseZoom-flightZoom)*arc,pitch:clamp(mix(a.pitch,b.pitch,u)-arc*19,0,74),bearing:headingMix(a.bearing,b.bearing,u),light:mix(a.light,b.light,u)};
 }
 function state(progress){
  const p=clamp(progress),last=count-1;
  let camera,index=0,arrival=0,routeIndex=0;
  if(p<arrivals[0])camera=between(overview,frames[0],clamp((p-.008)/(arrivals[0]-.008)));
  else if(p>holds[last]){index=last;routeIndex=route.length-1;camera=between(frames[last],overview,clamp((p-holds[last])/(1-holds[last])));}
  else{
   while(index<last&&p>=arrivals[index+1])index++;
   routeIndex=offsets[index];
   if(p<=holds[index]){const t=ease((p-arrivals[index])/(holds[index]-arrivals[index]));camera={...frames[index],coord:[...frames[index].coord],bearing:frames[index].bearing+2.4*Math.sin(Math.PI*t)**2};arrival=1;}
   else{const t=clamp((p-holds[index])/(arrivals[index+1]-holds[index]));routeIndex=mix(offsets[index],offsets[index+1],ease(t));camera=between(frames[index],frames[index+1],t,routeIndex);if(t>=.5)index++;}
  }
  return {p,coord:camera.coord,zoom:camera.zoom,pitch:camera.pitch,bearing:camera.bearing,light:camera.light,index,arrival,head:routePoint(routeIndex),routeIndex,intro:1-ease(p/.05),end:ease((p-.96)/.04)};
 }
 return {stops,route,overview,arrivals,holds,offsets,state,stopProgress:index=>{const i=Math.round(clamp(index,0,count-1));return (arrivals[i]+holds[i])/2;},routeAt:current=>{const s=typeof current==='number'?state(current):current;return route.slice(0,Math.floor(clamp(s.routeIndex,0,route.length-1))+1).concat([[...s.head]]);}};
}

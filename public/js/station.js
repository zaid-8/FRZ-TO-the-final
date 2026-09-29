import {Builder} from './geometry.js';


export function buildStation(){
 const b=new Builder(),TAU=Math.PI*2;
 const concrete='stationConcrete',paint='stationPaint';
 const add=(a,c)=>a.map((v,i)=>v+c[i]);
 const scale=(a,s)=>a.map(v=>v*s);
 const ring=(cx,cy,cz,outer,inner,height,mat,segments=64)=>{
  const point=(angle,r,y)=>[cx+Math.cos(angle)*r,y,cz+Math.sin(angle)*r];
  for(let i=0;i<segments;i++){
   const a=TAU*i/segments,c=TAU*(i+1)/segments,top=cy+height/2,low=cy-height/2;
   b.quad(point(a,outer,low),point(a,outer,top),point(c,outer,top),point(c,outer,low),mat);
   b.quad(point(c,inner,low),point(c,inner,top),point(a,inner,top),point(a,inner,low),mat);
   b.quad(point(a,inner,top),point(c,inner,top),point(c,outer,top),point(a,outer,top),mat);
   b.quad(point(a,outer,low),point(c,outer,low),point(c,inner,low),point(a,inner,low),mat);
  }
 };


 const axlePart=(center,axis,profile,mat,segments=16)=>{
  const up=[0,1,0],side=[-axis[2],0,axis[0]];
  const p=(t,r,a)=>add(add(center,scale(axis,t)),add(scale(up,Math.cos(a)*r),scale(side,Math.sin(a)*r)));
  for(let k=0;k<profile.length-1;k++)for(let i=0;i<segments;i++){
   const a=TAU*i/segments,c=TAU*(i+1)/segments;
   if(profile[k][1]===0)b.triangle(p(...profile[k],a),p(...profile[k+1],c),p(...profile[k+1],a),mat);
   else if(profile[k+1][1]===0)b.triangle(p(...profile[k],a),p(...profile[k],c),p(...profile[k+1],a),mat);
   else b.quad(p(...profile[k],a),p(...profile[k],c),p(...profile[k+1],c),p(...profile[k+1],a),mat);
  }
 };


 b.box(-1.35,-1.67,-.38,6.7,.24,4.48,concrete);
 b.box(-1.35,-1.79,-.38,6.9,.10,4.68,paint);
 for(const x of [-3.6,-2.0,-.4,1.2])b.box(x,-1.548,-.38,.008,.004,4.44,'dark');
 for(const z of [-1.65,-.20,1.25])b.box(-1.35,-1.548,z,6.65,.004,.008,'dark');
 b.box(-1.35,-1.54,-2.58,6.7,.045,.07,'steel');
 b.box(-1.35,-1.54,1.82,6.7,.045,.07,'steel');


 for(const x of [-4.55,-.78]){
  b.box(x,-1.46,-2.34,.45,.16,.44,concrete);
  b.box(x,-1.365,-2.34,.36,.03,.34,'steel');
  b.box(x,1.49,-2.34,.19,5.70,.19,paint);
  for(const dx of [-.12,.12])for(const dz of [-.11,.11])b.cylinder(x+dx,-1.337,-2.34+dz,.021,.021,.03,'steel',6);
  b.tube([[x,3.34,-2.34],[x+.72,4.34,-2.34]],.047,'steel',6);
  b.tube([[x,3.34,-2.34],[x,4.34,-1.34]],.047,'steel',6);
 }
 b.box(-2.35,4.37,-2.34,6.14,.20,.18,paint);
 b.box(-2.35,4.37,.91,6.14,.18,.13,paint);
 for(let x=-5.05;x<=.42;x+=.78){
  b.box(x,4.39,-.71,.075,.19,3.61,paint);
  b.box(x,4.31,-.71,.16,.028,3.61,'steel');
 }
 b.box(-2.35,4.535,-1.82,6.15,.065,1.23,concrete);
 b.box(-2.35,4.535,.83,6.15,.065,.24,paint);


 const cx=-3,cz=-.30;
 ring(cx,3.19,cz,1.98,1.82,.41,paint);
 ring(cx,3.435,cz,2.035,1.79,.075,'steel');
 ring(cx,2.967,cz,1.982,1.84,.055,'steel');
 b.cylinder(cx,2.727,cz,1.84,1.02,.45,paint,64);
 b.cylinder(cx,2.475,cz,1.02,1.02,.055,'steel',48);
 b.cylinder(cx,3.50,cz,.31,.31,.82,paint,32);
 ring(cx,3.93,cz,.43,.23,.08,'steel',32);
 b.box(cx,4.11,cz,.34,.37,.34,paint);
 for(let i=0;i<8;i++){
  const a=TAU*i/8;
  b.box(cx+Math.cos(a)*1.01,3.58,cz+Math.sin(a)*1.01,1.55,.10,.115,'steel',-a);
 }
 for(let i=0;i<23;i++){
  const a=TAU*(i+.2)/23,axis=[Math.cos(a),0,Math.sin(a)];
  const center=[cx+axis[0]*1.97,3.72,cz+axis[2]*1.97];
  axlePart(center,axis,[[-.115,0],[-.115,.135],[-.082,.165],[.065,.165],[.10,.135],[.10,0]],'rubber');
  axlePart(add(center,scale(axis,.107)),axis,[[-.025,0],[-.025,.088],[.025,.088],[.025,0]],'steel',12);
  axlePart(add(center,scale(axis,.14)),axis,[[-.021,0],[-.021,.032],[.022,.032],[.022,0]],'dark',8);
  b.box(center[0],3.55,center[2],.075,.20,.075,'steel');
 }

 for(let i=0;i<12;i++){
  const a=TAU*i/12;
  b.box(cx+Math.cos(a)*1.991,3.19,cz+Math.sin(a)*1.991,.035,.29,.14,'steel',-a);
 }


 for(const z of [-.18,.18]){
  b.box(.10,2.90,z,3.16,.10,.055,'steel');
  b.box(.10,2.965,z,3.16,.025,.105,paint);
 }
 for(const x of [-1.26,-.50,.31,1.12]){
  b.box(x,3.04,0,.07,.045,.48,paint);
  b.tube([[x,3.04,-.21],[x-.13,3.52,-.36]],.025,'steel',6);
 }
 b.box(-.36,3.57,-.37,2.83,.14,.11,paint);
 b.tube([[-1.76,3.57,-.37],[-2.29,3.93,-.30]],.055,'steel',8);
 b.tube([[.73,3.57,-.37],[.36,4.30,-.37]],.055,'steel',8);


 for(const x of [-4.35,-3.25,-2.15,-1.05,.05,1.15])b.tube([[x,-1.53,-2.28],[x,-.57,-2.28]],.026,'steel',8);
 for(const y of [-.57,-1.05])b.tube([[-4.35,y,-2.28],[1.15,y,-2.28]],.025,'steel',8);
 b.box(-4.95,-1.83,.68,.60,.15,1.23,concrete);
 b.box(-5.20,-1.95,.68,.90,.12,1.23,concrete);
 return b.finish();
}

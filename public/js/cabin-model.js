import {Builder} from './geometry.js';

const TAU=Math.PI*2;
const ROOF=1.39,FLOOR=-1.39;


function crossSection(y,a,offset=0){
 const t=(y+.06)/1.50,waist=1-.285*t*t-.018*Math.pow(t,4);
 const power=v=>Math.sign(v)*Math.pow(Math.abs(v),.68);
 return [power(Math.sin(a))*(1.43*waist+offset),y,power(Math.cos(a))*(1.12*waist+offset)];
}
function ring(y,offset=0,steps=96){return Array.from({length:steps+1},(_,i)=>crossSection(y,TAU*i/steps,offset));}
function upright(a,from=FLOOR,to=ROOF,offset=0,steps=36){return Array.from({length:steps+1},(_,i)=>crossSection(from+(to-from)*i/steps,a,offset));}


function roundedBox(b,x,y,z,w,h,d,r,material,yaw=0,segments=7){
 const half=[w/2,h/2,d/2],core=half.map(v=>v-r),c=Math.cos(yaw),s=Math.sin(yaw);
 const faces=[(u,v)=>[half[0],u*half[1],v*half[2]],(u,v)=>[-half[0],v*half[1],u*half[2]],
  (u,v)=>[v*half[0],half[1],u*half[2]],(u,v)=>[u*half[0],-half[1],v*half[2]],
  (u,v)=>[u*half[0],v*half[1],half[2]],(u,v)=>[v*half[0],u*half[1],-half[2]]];
 for(const face of faces)b.surface((u,v)=>{
  const p=face(u*2-1,v*2-1),q=p.map((a,k)=>Math.max(-core[k],Math.min(core[k],a))),n=p.map((a,k)=>a-q[k]),length=Math.hypot(...n);
  const p0=q.map((a,k)=>a+n[k]/length*r);
  return [x+p0[0]*c+p0[2]*s,y+p0[1],z-p0[0]*s+p0[2]*c];
 },segments,segments,material);
}
function disc(b,x,y,z,r,depth,material,segments=20,yaw=0){
 const c=Math.cos(yaw),s=Math.sin(yaw),p=(a,t)=>[x+Math.cos(a)*r*c+t*s,y+Math.sin(a)*r,z-Math.cos(a)*r*s+t*c];
 b.surface((u,v)=>p(u*TAU,(v-.5)*depth),segments,1,material);
 for(let i=0;i<segments;i++){
  const a=TAU*i/segments,z0=TAU*(i+1)/segments;
  b.triangle([x+depth/2*s,y,z+depth/2*c],p(a,depth/2),p(z0,depth/2),material);
  b.triangle([x-depth/2*s,y,z-depth/2*c],p(z0,-depth/2),p(a,-depth/2),material);
 }
}
function rim(b,x,y,z,r,t,material){
 b.surface((u,v)=>{const a=TAU*u,q=TAU*v,k=r+t*Math.cos(q);return[x+k*Math.cos(a),y+k*Math.sin(a),z+t*Math.sin(q)];},24,6,material);
}
function plate(b,outline,z,depth,material){
 const signed=outline.reduce((n,p,i)=>{const q=outline[(i+1)%outline.length];return n+p[0]*q[1]-q[0]*p[1];},0);
 if(signed<0)outline=outline.slice().reverse();
 const centre=outline.reduce((p,q)=>[p[0]+q[0]/outline.length,p[1]+q[1]/outline.length],[0,0]);
 for(let i=0;i<outline.length;i++){
  const a=outline[i],c=outline[(i+1)%outline.length],p=(q,s)=>[q[0],q[1],z+s*depth/2];
  b.triangle(p(centre,1),p(a,1),p(c,1),material);b.triangle(p(centre,-1),p(c,-1),p(a,-1),material);
  b.quad(p(a,-1),p(c,-1),p(c,1),p(a,1),material);
 }
}
function bezier(points,steps=32){return Array.from({length:steps+1},(_,i)=>{const t=i/steps,s=1-t;return points[0].map((_,k)=>s*s*s*points[0][k]+3*s*s*t*points[1][k]+3*s*t*t*points[2][k]+t*t*t*points[3][k]);});}


function strap(b,points,width,depth,material){
 const rings=points.map((p,i)=>{
  const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
  const dx=after[0]-before[0],dy=after[1]-before[1],length=Math.hypot(dx,dy)||1;
  const nx=dy/length*width/2,ny=-dx/length*width/2;
  return [[p[0]+nx,p[1]+ny,p[2]+depth/2],[p[0]-nx,p[1]-ny,p[2]+depth/2],
   [p[0]-nx,p[1]-ny,p[2]-depth/2],[p[0]+nx,p[1]+ny,p[2]-depth/2]];
 });
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<4;j++)b.quad(rings[i][(j+1)%4],rings[i][j],rings[i+1][j],rings[i+1][(j+1)%4],material);
 b.quad(...rings[0],material);b.quad(...rings.at(-1).slice().reverse(),material);
}

export function buildCabin(){
 const b=new Builder();

 for(let k=0;k<4;k++){
  const centre=k*Math.PI/2,a=centre-Math.PI/4+.065,z=centre+Math.PI/4-.065;
  b.surface((u,v)=>crossSection(-1.28+2.58*v,a+(z-a)*u,.007),28,32,'glass');
  const perimeter=[];
  for(let i=0;i<=28;i++)perimeter.push(crossSection(-1.29,a+(z-a)*i/28,.020));
  for(let i=1;i<=32;i++)perimeter.push(crossSection(-1.29+2.60*i/32,z,.020));
  for(let i=1;i<=28;i++)perimeter.push(crossSection(1.31,z-(z-a)*i/28,.020));
  for(let i=1;i<=32;i++)perimeter.push(crossSection(1.31-2.60*i/32,a,.020));
  b.tube(perimeter,.022,'cabinRubber',8);
  const corner=centre+Math.PI/4,halfWidth=y=>.072+.027*Math.cos((y+.12)*1.2);
  b.surface((u,v)=>{const y=FLOOR+(ROOF-FLOOR)*v;return crossSection(y,corner+(u*2-1)*halfWidth(y),.052);},10,44,'cabinRed');
  for(const edge of [-1,1]){
   b.surface((u,v)=>{const y=FLOOR+(ROOF-FLOOR)*v;return crossSection(y,corner+edge*halfWidth(y),.014+.038*u);},1,44,'cabinRedDark',edge<0);
   const lip=Array.from({length:45},(_,i)=>{const y=FLOOR+(ROOF-FLOOR)*i/44;return crossSection(y,corner+edge*halfWidth(y),.053);});
   b.tube(lip,.009,'cabinRed',6);
  }
 }

 b.surface((u,v)=>crossSection(1.29+.12*v,u*TAU,.028),96,5,'cabinRed');
 b.surface((u,v)=>crossSection(-1.41+.095*v,u*TAU,.023),96,5,'cabinRed');
 b.surface((u,v)=>{const p=crossSection(1.385,u*TAU);return [p[0]*v,1.475-.09*v*v,p[2]*v];},72,10,'cabinGraphite',true);
 b.ellipsoid(0,-1.405,0,1.13,.085,.87,'cabinGraphite',48,10);
 b.tube(ring(-1.32,.028),.018,'cabinRubber',8);
 b.tube(ring(1.285,.042),.023,'cabinRubber',8);


 for(const a of [0,Math.PI])for(const y of [.80,1.06]){
  b.surface((u,v)=>crossSection(y+v*.040,a+(u-.5)*1.36,.026),32,2,'cabinGraphite');
  for(const edge of [-1,1]){
   const p=crossSection(y, a+edge*.59,.044);
   roundedBox(b,...p,.055,.072,.038,.012,'cabinMetal',a,3);
  }
 }
 for(const a of [0,Math.PI])b.tube(upright(a,-1.27,1.28,.022),.023,'cabinRubber',10);
 for(const a of [Math.PI/2,Math.PI*1.5])b.tube(upright(a,-1.27,1.28,.020),.013,'cabinGraphite',8);
 for(let k=0;k<4;k++){
  const a=k*Math.PI/2-Math.PI/4+.093,z=(k+1)*Math.PI/2-Math.PI/4-.093;
  b.surface((u,v)=>crossSection(-.43+.092*v,a+(z-a)*u,.029),28,3,'cabinRubber');
  b.surface((u,v)=>crossSection(-1.075+.045*v,a+(z-a)*u,.021),28,2,'cabinGraphite');
  const corner=Math.PI/4+k*Math.PI/2,p=crossSection(-.31,corner,.102);
  roundedBox(b,...p,.238,.60,.155,.066,'cabinRubber',corner,8);
  for(const dy of [-.14,.14])disc(b,p[0]+.081*Math.sin(corner),p[1]+dy,p[2]+.081*Math.cos(corner),.020,.009,'cabinGraphite',10,corner);
 }

 b.box(0,-1.285,0,1.97,.08,1.40,'cabinGraphite');
 for(const side of [-1,1]){
  roundedBox(b,0,-.76,side*.56,1.99,.125,.42,.05,'cabinSeat',0,8);
  roundedBox(b,0,-.505,side*.716,2.015,.40,.112,.043,'cabinSeat',0,8);
  b.tube([[-.96,-.292,side*.716],[.96,-.292,side*.716]],.017,'cabinGraphite',10);
  b.box(0,-.86,side*.59,1.88,.12,.31,'cabinGraphite');
  for(const x of [-.74,.74]){
   b.tube([[x,-.87,side*.59],[x,-1.23,side*.65]],.026,'cabinMetal',10);
   b.tube([[x,-.86,side*.46],[x,-1.23,side*.65]],.017,'cabinGraphite',8);
  }
  for(const x of [-1.015,1.015])b.tube([[x,-.71,side*.40],[x,-.51,side*.41],[x,-.44,side*.49],[x,-.44,side*.70]],.015,'cabinMetal',10);
  const p=crossSection(-.46,side*.081,.042);
  b.tube([[p[0],-.53,p[2]],[p[0],-.31,p[2]+.012]],.014,'cabinMetal',10);
 }
 b.box(0,-1.385,.88,1.45,.054,.17,'cabinMetal');
 b.tube(ring(-1.42,.13,88),.021,'cabinMetal',10);
 for(const z of [-.56,.56])b.box(0,-1.465,z,1.66,.085,.095,'cabinGraphite');

 for(const x of [-.80,.80])b.box(x,1.477,0,.13,.082,1.16,'cabinGraphite');
 for(const z of [-.55,.55]){
  plate(b,[[-.96,1.485],[.96,1.485],[.96,1.59],[.84,1.63],[.65,1.625],[.45,1.58],[-.45,1.58],[-.65,1.625],[-.84,1.63],[-.96,1.59]],z,.075,'cabinMetal');
  for(const x of [-.96,.96]){
   b.cylinder(x,1.568,z,.059,.065,.19,'cabinMetal',18);
   b.cylinder(x,1.674,z,.045,.045,.023,'cabinMetalEdge',6);
   b.cylinder(x,1.694,z,.023,.023,.016,'cabinGraphite',12);
  }
 }
 for(const x of [-.55,.55])b.box(x,1.545,0,.085,.11,1.18,'cabinMetal');
 b.box(0,1.535,0,.70,.13,.58,'cabinGraphite');b.box(0,1.63,0,.56,.13,.52,'cabinMetal');
 for(const z of [-.225,.225]){
  strap(b,[[-.44,1.63,z],[-.39,1.81,z]],.074,.063,'cabinMetal');
  strap(b,[[.32,1.63,z],[-.24,1.84,z]],.074,.063,'cabinMetal');
  plate(b,[[-.47,1.755],[-.22,1.755],[-.16,1.87],[-.40,1.91],[-.49,1.84]],z,.065,'cabinMetal');
  for(const x of [-.43,.30])disc(b,x,1.642,z+Math.sign(z)*.040,.023,.014,'cabinMetalEdge',6);
 }
 disc(b,-.35,1.81,0,.065,.63,'cabinGraphite',24);
 for(const z of [-.335,.335]){
  disc(b,-.35,1.81,z,.078,.022,'cabinMetalEdge',24);
  disc(b,-.35,1.81,z+Math.sign(z)*.018,.038,.015,'cabinMetal',6);
 }
 const hanger=bezier([[-.35,1.81,0],[-.08,1.82,0],[-.145,2.26,0],[-.12,2.645,0]],36);
 strap(b,hanger,.172,.108,'cabinMetal');
 for(const edge of [-1,1]){
  const bevel=hanger.map((p,i)=>{
   const a=hanger[Math.max(0,i-1)],z=hanger[Math.min(hanger.length-1,i+1)],dx=z[0]-a[0],dy=z[1]-a[1],len=Math.hypot(dx,dy);
   return [p[0]+dy/len*.075*edge,p[1]-dx/len*.075*edge,.055];
  });
  b.tube(bevel,.007,'cabinMetalEdge',6);
 }
 for(const p of [hanger[2],hanger[17],hanger[34]])for(const z of [-.062,.062]){
  disc(b,p[0],p[1],z,.041,.012,'cabinMetalEdge',18);
  disc(b,p[0],p[1],z+Math.sign(z)*.012,.020,.012,'cabinGraphite',6);
 }
 b.tube([[-.12,2.655,-.215],[-.12,2.655,.215]],.055,'cabinGraphite',16);
 b.box(-.12,2.699,0,.48,.104,.29,'cabinMetal');

 for(const z of [-.047,.047])b.box(-.12,2.7448,z,.65,.042,.05,'cabinGraphite');
 for(const x of [-.385,.145]){
  b.tube([[x,2.652,-.272],[x,2.652,.272]],.030,'cabinMetal',12);
  for(const z of [-.225,.225]){
   disc(b,x,2.652,z,.109,.062,'cabinRubber',28);
   const face=z+Math.sign(z)*.034;
   disc(b,x,2.652,face,.087,.008,'cabinMetal',24);
   rim(b,x,2.652,face+Math.sign(z)*.005,.078,.011,'cabinMetalEdge');
   disc(b,x,2.652,face+Math.sign(z)*.012,.039,.015,'cabinGraphite',20);
   disc(b,x,2.652,face+Math.sign(z)*.024,.022,.015,'cabinMetalEdge',6);
  }
 }
 for(const z of [-.205,.205])plate(b,[[-.49,2.695],[-.49,2.728],[.245,2.728],[.245,2.695],[.14,2.678],[-.385,2.678]],z,.026,'cabinMetal');


 return b.finish().map(mesh=>{
  const clean=[];
  for(let i=0;i<mesh.data.length;i+=18){
   const a=mesh.data.slice(i,i+3),c=mesh.data.slice(i+6,i+9),d=mesh.data.slice(i+12,i+15);
   const u=c.map((v,k)=>v-a[k]),v=d.map((v,k)=>v-a[k]);
   const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],area=Math.hypot(...n);
   if(area<1e-10)continue;
   for(let j=0;j<3;j++){
    const vertex=Array.from(mesh.data.slice(i+j*6,i+j*6+6));
    if(Math.hypot(...vertex.slice(3))<.1)for(let k=0;k<3;k++)vertex[k+3]=n[k]/area;
    clean.push(...vertex);
   }
  }
  return {...mesh,data:new Float32Array(clean)};
 });
}

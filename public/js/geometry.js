import {cross,norm,vsub,mix} from './math.js';
export class Builder {
 constructor(){this.groups=new Map();}
 triangle(a,b,c,mat,ns){let g=this.groups.get(mat);if(!g){g=[];this.groups.set(mat,g);}const n=norm(cross(vsub(b,a),vsub(c,a)));[a,b,c].forEach((v,i)=>g.push(...v,...(ns?ns[i]:n)));}
 quad(a,b,c,d,mat){this.triangle(a,b,c,mat);this.triangle(a,c,d,mat);}
 box(x,y,z,w,h,d,mat,yaw=0){const c=Math.cos(yaw),s=Math.sin(yaw),p=(i,j,k)=>[x+i*w/2*c+k*d/2*s,y+j*h/2,z-i*w/2*s+k*d/2*c];const faces=[[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],[[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]],[[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],[[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]];for(const f of faces)this.quad(...f.map(v=>p(...v)),mat);}
 surface(fn,nu,nv,mat,flip=false){const normal=(u,v)=>{const e=.0002,du=vsub(fn(u+e,v),fn(u-e,v)),dv=vsub(fn(u,v+e),fn(u,v-e));let n=norm(cross(du,dv));return flip?n.map(x=>-x):n;};for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){let uv=[[i/nu,j/nv],[(i+1)/nu,j/nv],[(i+1)/nu,(j+1)/nv],[i/nu,(j+1)/nv]];let ps=uv.map(v=>fn(...v)),ns=uv.map(v=>normal(...v));for(let ids of (flip?[[0,2,1],[0,3,2]]:[[0,1,2],[0,2,3]]))this.triangle(...ids.map(k=>ps[k]),mat,ids.map(k=>ns[k]));}}
 ellipsoid(x,y,z,rx,ry,rz,mat,n=16,m=10,rough=0){this.surface((u,v)=>{const a=u*Math.PI*2,b=(v-.5)*Math.PI,r=1+rough*Math.sin(a*3+b*5)*Math.sin(b*5-a*2);return[x+Math.cos(b)*Math.sin(a)*rx*r,y+Math.sin(b)*ry*r,z+Math.cos(b)*Math.cos(a)*rz*r];},n,m,mat);}
 tube(points,r,mat,sides=10){for(let i=0;i<points.length-1;i++){let a=points[i],b=points[i+1],axis=norm(vsub(b,a)),right=norm(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),up=cross(axis,right);for(let j=0;j<sides;j++){const p=(v,t)=>v.map((q,k)=>q+r*(right[k]*Math.cos(t)+up[k]*Math.sin(t))),t=j/sides*Math.PI*2,t2=(j+1)/sides*Math.PI*2;let p1=p(a,t),p2=p(a,t2),p3=p(b,t2),p4=p(b,t),n1=norm(vsub(p1,a)),n2=norm(vsub(p2,a));this.triangle(p1,p2,p3,mat,[n1,n2,n2]);this.triangle(p1,p3,p4,mat,[n1,n2,n1]);}}
 }
 cylinder(x,y,z,rt,rb,h,mat,n=20){this.surface((u,v)=>{let a=u*Math.PI*2,r=mix(rb,rt,v);return[x+r*Math.sin(a),y+(v-.5)*h,z+r*Math.cos(a)];},n,1,mat);for(let j=0;j<n;j++){let a=j/n*Math.PI*2,b=(j+1)/n*Math.PI*2;this.triangle([x,y+h/2,z],[x+rt*Math.sin(a),y+h/2,z+rt*Math.cos(a)],[x+rt*Math.sin(b),y+h/2,z+rt*Math.cos(b)],mat);this.triangle([x,y-h/2,z],[x+rb*Math.sin(b),y-h/2,z+rb*Math.cos(b)],[x+rb*Math.sin(a),y-h/2,z+rb*Math.cos(a)],mat);}}
 finish(){return [...this.groups].map(([material,data])=>({material,data:new Float32Array(data)}));}
}
export const MATERIALS={
 stationConcrete:{color:[.76,.78,.76],metal:0,rough:.93,kind:0},stationPaint:{color:[.78,.81,.80],metal:.28,rough:.5,kind:0},cable:{color:[.095,.115,.13],metal:.50,rough:.54,kind:0},
 cabinRed:{color:[.91,.023,.065],metal:.20,rough:.25,kind:0},cabinRedDark:{color:[.56,.017,.041],metal:.30,rough:.31,kind:0},
 cabinGraphite:{color:[.10,.125,.15],metal:.48,rough:.34,kind:0},cabinMetal:{color:[.73,.77,.80],metal:.78,rough:.30,kind:0},
 cabinMetalEdge:{color:[.86,.88,.89],metal:.84,rough:.23,kind:0},
 cabinRubber:{color:[.043,.050,.060],metal:.02,rough:.72,kind:0},cabinSeat:{color:[.13,.17,.19],metal:0,rough:.72,kind:0},
 orange:{color:[.93,.36,.075],metal:.22,rough:.29,kind:0},orangeDark:{color:[.58,.16,.026],metal:.45,rough:.34,kind:0},
 steel:{color:[.65,.70,.69],metal:.92,rough:.26,kind:0},rubber:{color:[.024,.035,.031],metal:.03,rough:.68,kind:0},
 dark:{color:[.07,.085,.075],metal:.5,rough:.5,kind:0},seat:{color:[.30,.20,.115],metal:0,rough:.78,kind:0},glass:{color:[.85,.98,.94],metal:0,rough:.08,kind:4},
 stone:{color:[.69,.61,.46],metal:0,rough:.92,kind:1},stoneLight:{color:[.83,.74,.57],metal:0,rough:.94,kind:1},basalt:{color:[.25,.25,.21],metal:0,rough:.98,kind:1},sandstone:{color:[.72,.42,.28],metal:0,rough:.95,kind:5},
 foliage:{color:[.18,.27,.13],metal:0,rough:.98,kind:2},foliageLight:{color:[.31,.38,.20],metal:0,rough:.95,kind:2},trunk:{color:[.22,.18,.12],metal:0,rough:.95,kind:1},ground:{color:[.47,.49,.31],metal:0,rough:.95,kind:3},water:{color:[.32,.47,.49],metal:.3,rough:.25,kind:0}
};

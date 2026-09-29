export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
export const vadd=(a,b)=>a.map((n,i)=>n+b[i]);
export const vsub=(a,b)=>a.map((n,i)=>n-b[i]);
export const mul=(a,n)=>a.map(x=>x*n);
export const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>mul(a,1/(Math.hypot(...a)||1));
export function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),r=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*r,-1,0,0,2*far*near*r,0]);}
export function lookAt(eye,target,up=[0,1,0]){const z=norm(vsub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
export function matmul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
export function ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);}
export function model(pos=[0,0,0],yaw=0,scale=1){let c=Math.cos(yaw)*scale,s=Math.sin(yaw)*scale;return new Float32Array([c,0,-s,0,0,scale,0,0,s,0,c,0,...pos,1]);}
export function project(p,m){const q=[...p,1],o=[0,0,0,0];for(let r=0;r<4;r++)for(let c=0;c<4;c++)o[r]+=m[c*4+r]*q[c];return o.slice(0,3).map(n=>n/o[3]);}
export function seedRand(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export const rgb=hex=>hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255);

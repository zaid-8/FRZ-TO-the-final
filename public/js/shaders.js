export const meshVertex=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;
uniform mat4 uModel,uVP,uLightVP;
out vec3 vWorld,vNormal;out vec4 vShadow;
void main(){vec4 p=uModel*vec4(aPosition,1.);vWorld=p.xyz;vNormal=normalize(mat3(uModel)*aNormal);vShadow=uLightVP*p;gl_Position=uVP*p;}`;
export const meshFragment=`#version 300 es
precision highp float;
in vec3 vWorld,vNormal;in vec4 vShadow;out vec4 frag;
uniform vec3 uEye,uColor,uFog,uGround,uLightTint;uniform float uMetal,uRough,uKind,uExposure,uNight;
uniform sampler2D uShadow;uniform samplerCube uEnvironment;
const vec3 L=vec3(-.48,.72,.49);
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float shadow(vec3 n){vec3 p=vShadow.xyz/vShadow.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return 1.;float d=0.,bias=max(.0035*(1.-dot(n,L)),.0018);for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float z=texture(uShadow,p.xy+vec2(x,y)/1024.).r;d+=p.z-bias>z?.43:1.;}return d/9.;}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec3 N=normalize(vNormal),V=normalize(uEye-vWorld),H=normalize(V+L);vec3 color=uColor;
 if(uKind>2.5&&uKind<3.5){float detail=noise(vWorld*.23)*.22+noise(vWorld*1.8)*.08;color=uGround*(.73+detail);color=mix(color,vec3(.46,.41,.31),(1.-smoothstep(.40,.82,N.y))*.40);}
 else if(uKind>.5&&uKind<1.5){float grain=noise(vWorld*14.);color*=.83+.24*grain;vec2 uv=abs(N.y)>.8?vWorld.xz:vWorld.xy+vWorld.zy*.31;uv.x+=mod(floor(uv.y/.43),2.)*.41;vec2 f=fract(uv/vec2(.87,.43));float edge=min(min(f.x,1.-f.x),min(f.y,1.-f.y));color*=mix(.80,1.,smoothstep(.008,.04,edge));}
 else if(uKind>4.5){color*=.77+.18*noise(vWorld*1.7)+.06*sin(vWorld.y*9.);}
 else if(uKind>1.5){color*=.78+.25*noise(vWorld*8.);}
 color=pow(max(color,vec3(0.)),vec3(2.2));
 if(uKind<.5&&uMetal>.3)color=max(color,vec3(.017,.020,.024));
 float nl=max(dot(N,L),0.),nv=max(dot(N,V),.001),nh=max(dot(N,H),0.),vh=max(dot(V,H),0.);float a=max(.08,uRough*uRough),a2=a*a,den=nh*nh*(a2-1.)+1.;float D=a2/(3.14159*den*den);float k=(uRough+1.)*(uRough+1.)/8.;float G=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);vec3 f0=mix(vec3(.04),color,uMetal),F=f0+(1.-f0)*pow(1.-vh,5.);vec3 spec=D*G*F/max(.001,4.*nl*nv);vec3 ambient=mix(vec3(.29,.34,.39),vec3(.63,.72,.80),clamp(N.y*.5+.5,0.,1.));
 float key=mix(1.,.62,uNight),shade=uKind<.5?1.:shadow(N);
 vec3 env=pow(texture(uEnvironment,reflect(-V,N)).rgb,vec3(2.2));
 vec3 light=color*(ambient*mix(.83,.92,uNight)+(1.-uMetal)*nl*shade*vec3(1.48,1.42,1.32)*key)+spec*nl*shade*1.6*key+env*F*(1.-uRough)*.52;
 float paint=uKind<.5&&uColor.r>uColor.g*1.8&&uColor.r>uColor.b*1.6&&uRough<.45?1.:0.;
 light+=vec3(pow(nh,80.)*.055*paint*key);
 light*=uLightTint*uExposure;
 float fog=1.-exp(-pow(length(uEye-vWorld)*.0037,1.7));vec3 final=mix(aces(light),uFog,fog);frag=vec4(pow(final,vec3(1./2.2)),1.);}`;
const photoSampling=`
uniform sampler2D uPhotoA,uPhotoB;
uniform vec2 uResolution,uPhotoReady,uPhotoAspect,uPhotoPositionA,uPhotoPositionB,uPhotoPan;
uniform float uPhotoMix,uPhotoDrift,uPhotoScale;
vec3 coveredPhoto(sampler2D photo,vec2 coord,float aspect,vec2 focus){
 float viewportAspect=uResolution.x/max(uResolution.y,1.);
 vec2 crop=aspect>viewportAspect?vec2(viewportAspect/aspect,1.):vec2(1.,aspect/viewportAspect);
 crop/=uPhotoScale;
 vec2 origin=(1.-crop)*vec2(focus.x,1.-focus.y);
 coord-=vec2(uPhotoPan.x,-uPhotoPan.y);
 return texture(photo,clamp(origin+coord*crop,vec2(.0001),vec2(.9999))).rgb;
}
vec4 backdrop(vec2 coord){
 float a=(1.-uPhotoMix)*uPhotoReady.x,b=uPhotoMix*uPhotoReady.y;
 vec3 color=coveredPhoto(uPhotoA,coord,uPhotoAspect.x,uPhotoPositionA)*a+coveredPhoto(uPhotoB,coord,uPhotoAspect.y,uPhotoPositionB)*b;
 return vec4(color,a+b);
}`;
export const glassFragment=`#version 300 es
precision highp float;
in vec3 vWorld,vNormal;in vec4 vShadow;out vec4 frag;
uniform vec3 uEye,uLightTint;uniform float uExposure,uNight;uniform sampler2D uScene;
${photoSampling}
void main(){
 vec3 N=normalize(vNormal),V=normalize(uEye-vWorld);float ndv=abs(dot(N,V));float fresnel=.045+.955*pow(1.-ndv,5.);
 vec2 uv=gl_FragCoord.xy/uResolution,bend=N.xy*.0024*(1.-ndv);
 vec4 scene=texture(uScene,clamp(uv+bend,vec2(.001),vec2(.999)));
 vec3 through=scene.rgb/max(scene.a,.001)*vec3(.75,.83,.90);
 vec2 reflectedUV=vec2(1.-uv.x+N.x*.08,clamp(.67+N.y*.20+(uv.y-.5)*.16,.04,.96));
 vec4 photoReflection=backdrop(reflectedUV)*.5+backdrop(reflectedUV+vec2(.013,.005))*.25+backdrop(reflectedUV-vec2(.013,.005))*.25;
 vec3 neutral=vec3(.33,.43,.51)*uLightTint*(.78+.22*uExposure);
 vec3 reflection=mix(neutral,photoReflection.rgb/max(photoReflection.a,.001),photoReflection.a*.74);
 reflection=max(reflection*vec3(.94,.98,1.),mix(vec3(.12,.16,.20),vec3(.07,.09,.12),uNight));
 float highlight=pow(max(dot(reflect(normalize(vec3(.48,-.72,-.49)),N),V),0.),72.);
 float reflectionWeight=clamp(.22+fresnel*.44,.22,.66);
 vec3 result=mix(reflection,mix(through,reflection,reflectionWeight),scene.a)+vec3(.87,.94,1.)*highlight*.13*mix(1.,.65,uNight);
 float alpha=mix(.32+fresnel*.14,1.,clamp(scene.a,0.,1.));
 frag=vec4(clamp(result,vec3(0.),vec3(1.)),alpha);
}`;
export const skyVertex=`#version 300 es
precision highp float;
out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,.9999,1.);}`;
export const skyFragment=`#version 300 es
precision highp float;in vec2 uv;out vec4 frag;
${photoSampling}
void main(){frag=backdrop(uv);}`;
export const depthFragment=`#version 300 es
precision highp float;void main(){}`;

import {clamp,mix,mercator,scenicViewport} from './scenic-map-core.js';

const LIBRARY='https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js';
const STYLES='https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css';
const IMAGERY='https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg';
const ELEVATION='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const feature=(type,coordinates,properties={})=>({type:'Feature',properties,geometry:{type,coordinates}});
const collection=features=>({type:'FeatureCollection',features});
let libraryPromise;
function loadLibrary(){
 if(globalThis.maplibregl?.version==='5.6.1')return Promise.resolve(globalThis.maplibregl);
 if(libraryPromise)return libraryPromise;
 libraryPromise=new Promise((resolve,reject)=>{
  let css=document.querySelector('link[data-darb-scenic-map]');
  if(!css){css=document.createElement('link');css.dataset.darbScenicMap='';css.rel='stylesheet';css.href=STYLES;document.head.append(css);}
  const script=document.createElement('script');script.src=LIBRARY;script.async=true;script.crossOrigin='anonymous';
  let timer,settled=false;
  const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);script.onload=null;script.onerror=null;if(error){script.remove();reject(error);}else resolve(globalThis.maplibregl);};
  script.onload=()=>finish(globalThis.maplibregl?.version==='5.6.1'?null:new Error('library'));
  script.onerror=()=>finish(new Error('library'));timer=setTimeout(()=>finish(new Error('timeout')),10000);document.head.append(script);
 }).catch(error=>{libraryPromise=null;throw error;});
 return libraryPromise;
}
function countryMask(country){
 const outer=[[20,15],[50,15],[50,45],[20,45],[20,15]],area=ring=>ring.reduce((sum,p,index)=>{const q=ring[(index+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0),holes=[];
 for(const f of country.features||[]){const polygons=f.geometry?.type==='Polygon'?[f.geometry.coordinates]:f.geometry?.type==='MultiPolygon'?f.geometry.coordinates:[];for(const polygon of polygons){const ring=polygon[0];holes.push(area(ring)*area(outer)>0?[...ring].reverse():ring);}}
 return feature('Polygon',[outer,...holes]);
}
function mapStyle(geo,journey){
 const line=[journey.route[0],journey.route[0]],bounds=[34.4,28.5,39.6,34.1];
 return {version:8,sources:{
  imagery:{type:'raster',tiles:[IMAGERY],tileSize:256,maxzoom:14,bounds,attribution:'<a href="https://s2maps.eu/">Sentinel-2 cloudless 2020 by EOX IT Services GmbH</a> · Contains modified Copernicus Sentinel data 2020 · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>'},
  dem:{type:'raster-dem',tiles:[ELEVATION],tileSize:256,maxzoom:14,bounds,encoding:'terrarium',attribution:'<a href="https://registry.opendata.aws/terrain-tiles/">Mapzen / Tilezen · USGS SRTM / GMTED2010 · NOAA ETOPO1</a>'},
  shading:{type:'raster-dem',tiles:[ELEVATION],tileSize:256,maxzoom:14,bounds,encoding:'terrarium'},
  country:{type:'geojson',data:geo.country},
  governorates:{type:'geojson',data:geo.administrative},
  outside:{type:'geojson',data:countryMask(geo.country)},
  complete:{type:'geojson',data:feature('LineString',journey.route.length>1?journey.route:line)},
  trail:{type:'geojson',data:feature('LineString',line)},
  places:{type:'geojson',data:collection(journey.stops.map((stop,index)=>feature('Point',stop.coord,{id:stop.id,index})))},
  head:{type:'geojson',data:feature('Point',journey.route[0])}
 },layers:[
  {id:'background',type:'background',paint:{'background-color':'#263440'}},
  {id:'imagery',type:'raster',source:'imagery',paint:{'raster-fade-duration':0,'raster-saturation':-.16,'raster-contrast':.08}},
  {id:'relief',type:'hillshade',source:'shading',paint:{'hillshade-exaggeration':.42,'hillshade-shadow-color':'#15202e','hillshade-highlight-color':'#e8d2ad','hillshade-accent-color':'#4b4d48','hillshade-illumination-direction':295,'hillshade-illumination-anchor':'map'}},
  {id:'outside',type:'fill',source:'outside',paint:{'fill-color':'#050d20','fill-opacity':.4}},
  {id:'country-glow',type:'line',source:'country',paint:{'line-color':'#e6d2a0','line-width':3,'line-blur':3,'line-opacity':.3}},
  {id:'country-edge',type:'line',source:'country',paint:{'line-color':'#e6d2a0','line-width':.9,'line-opacity':.65}},
  {id:'governorate-fill',type:'fill',source:'governorates',filter:['==','ISO',''],paint:{'fill-color':'#e5c980','fill-opacity':.09}},
  {id:'governorate-boundaries',type:'line',source:'governorates',paint:{'line-color':'#c7cdbb','line-width':.7,'line-opacity':.38}},
  {id:'complete-route',type:'line',source:'complete',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#d5bb77','line-width':.8,'line-opacity':.25,'line-dasharray':[1,5]}},
  {id:'route-halo',type:'line',source:'trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#edbb46','line-width':9,'line-blur':7,'line-opacity':.55}},
  {id:'route-gold',type:'line',source:'trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#e5c56b','line-width':2.1}},
  {id:'route-core',type:'line',source:'trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fff0c5','line-width':.65}},
  {id:'stops',type:'circle',source:'places',paint:{'circle-radius':2.8,'circle-color':'#f0d49a','circle-stroke-width':1,'circle-stroke-color':'#5e5437'}},
  {id:'head-glow',type:'circle',source:'head',paint:{'circle-radius':10,'circle-color':'#e5c56b','circle-blur':.7,'circle-opacity':.8}},
  {id:'head-core',type:'circle',source:'head',paint:{'circle-radius':2.4,'circle-color':'#fff8e1'}}
 ],terrain:{source:'dem',exaggeration:1.25},sky:{'sky-color':'#101a31','horizon-color':'#827c76','fog-color':'#3c4957','sky-horizon-blend':.6,'horizon-fog-blend':.8,'fog-ground-blend':.65}};
}
export class ScenicTerrain{
 constructor(container,geography,journey,{onStatus=()=>{},active=true}={}){
  this.container=container;this.geo=geography;this.journey=journey;this.onStatus=onStatus;this.active=active;this.ready=false;this.loaded=false;this.map=null;this.destroyed=false;this.failure=null;this.latest=journey.state(0);this.width=container.clientWidth||1;this.height=container.clientHeight||1;this.preloaded=new Set();this.prefetchControllers=new Set();this.revision=0;this.renderRevision=-1;this.lastRoute=-1;this.lastMood=-1;this.lastISO=null;this.container.style.opacity='0';this.container.setAttribute('aria-hidden','true');
 }
 status(mode,reason){
  if(this.destroyed)return;this.ready=mode==='terrain'||mode==='satellite';this.container.style.opacity=this.ready?'1':'0';
  const key=mode+':'+(reason||'');if(key===this.lastStatus)return;this.lastStatus=key;
  try{this.onStatus({mode,ready:this.ready,...(reason?{reason}:{})});}catch{}
 }
 async start(){
  if(this.destroyed)return false;if(this.startPromise)return this.startPromise;
  this.startPromise=(async()=>{
   this.status('loading');
   try{
    const lib=await loadLibrary();if(this.destroyed)return false;
    if(this.map){this.map.remove();this.map=null;}
    this.failure=null;this.timedOut=false;this.loaded=false;this.ready=false;this.lastRoute=-1;this.lastMood=-1;this.lastISO=null;this.renderRevision=-1;
    const viewport=scenicViewport(this.width,this.height),s=this.latest;
    this.map=new lib.Map({container:this.container,style:mapStyle(this.geo,this.journey),center:s.coord,zoom:s.zoom-(viewport.mobile?.75:0),pitch:s.pitch,bearing:s.bearing,padding:viewport.padding,interactive:false,scrollZoom:false,dragPan:false,dragRotate:false,keyboard:false,doubleClickZoom:false,touchZoomRotate:false,touchPitch:false,attributionControl:false,maxPitch:76,maxZoom:14,renderWorldCopies:false,fadeDuration:0,maxTileCacheSize:viewport.mobile?64:128,maxTileCacheZoomLevels:3,pixelRatio:Math.min(globalThis.devicePixelRatio||1,viewport.mobile?1.25:1.6),preserveDrawingBuffer:false,trackResize:false});
    this.map.repaint=false;this.map.addControl(new lib.AttributionControl({compact:true}),'bottom-right');
    this.map.on('load',()=>{if(this.destroyed)return;this.loaded=true;if(this.active)this.apply(this.latest,true);this.checkReady();});
    this.map.on('render',()=>{if(this.destroyed||this.failure)return;this.renderRevision=this.revision;this.checkReady();});
    this.map.on('idle',()=>this.checkReady());
    this.map.on('sourcedataloading',event=>{if(['imagery','dem','shading'].includes(event.sourceId))this.status(this.failure||this.timedOut?'offline':'loading',this.failure||(this.timedOut?'timeout':undefined));});
    this.map.on('error',event=>{if(this.destroyed)return;const source=event.sourceId;if(!source||['imagery','dem','shading'].includes(source)){this.failure='network';this.status('offline','network');clearTimeout(this.deadline);}});
    this.map.on('webglcontextlost',()=>{if(this.destroyed)return;this.failure='webgl';this.status('offline','webgl');clearTimeout(this.deadline);});
    this.map.on('webglcontextrestored',()=>{if(this.destroyed)return;this.failure=null;this.renderRevision=-1;this.status('loading');if(this.active)this.apply(this.latest,true);this.armDeadline();});
    this.armDeadline();return true;
   }catch(error){if(!this.destroyed){this.failure=error?.message==='timeout'?'timeout':'library';this.status('offline',this.failure);}return false;}
  })();
  const result=await this.startPromise;this.startPromise=null;return result;
 }
 armDeadline(){clearTimeout(this.deadline);this.timedOut=false;this.deadline=setTimeout(()=>{if(!this.ready&&!this.destroyed){this.timedOut=true;this.status('offline','timeout');}},16000);}
 checkReady(){
  if(this.destroyed||!this.map||this.failure||!this.loaded||this.renderRevision!==this.revision)return;
  try{
   if(this.map.isStyleLoaded()&&this.map.areTilesLoaded()&&['imagery','dem','shading'].every(id=>this.map.isSourceLoaded(id))){clearTimeout(this.deadline);this.timedOut=false;this.status('terrain');this.preload(this.latest.index);}
   else this.status(this.timedOut?'offline':'loading',this.timedOut?'timeout':undefined);
  }catch{this.failure='network';this.status('offline','network');}
 }
 update(state){this.latest=state;if(this.active)this.apply(state);}
 apply(state,force=false){
  if(this.destroyed||!this.map||!this.loaded||this.failure)return;
  const key=[state.coord[0],state.coord[1],state.zoom,state.pitch,state.bearing,state.light,state.routeIndex,state.index,state.arrival,this.width,this.height].join(':');
  if(!force&&key===this.lastCamera)return;
  this.lastCamera=key;this.revision++;if(!this.ready)this.status(this.timedOut?'offline':'loading',this.timedOut?'timeout':undefined);
  const viewport=scenicViewport(this.width,this.height),a=clamp(1-state.intro-state.end);
  this.map.jumpTo({center:state.coord,zoom:state.zoom-(viewport.mobile?.75:0),pitch:state.pitch,bearing:state.bearing,padding:viewport.padding});
  if(!this.map.areTilesLoaded())this.status(this.timedOut?'offline':'loading',this.timedOut?'timeout':undefined);
  if(force||Math.abs(state.routeIndex-this.lastRoute)>.1){const trail=this.journey.routeAt(state);this.map.getSource('trail')?.setData(feature('LineString',trail.length<2?[trail[0],trail[0]]:trail));this.map.getSource('head')?.setData(feature('Point',state.head));this.lastRoute=state.routeIndex;}
  const iso=state.arrival?this.journey.stops[state.index]?.governorateISO||'':'';if(force||iso!==this.lastISO){this.map.setFilter('governorate-fill',['==','ISO',iso]);this.lastISO=iso;}
  if(force||Math.abs(state.light-this.lastMood)>.025){const rgb=(from,to)=>'rgb('+from.map((value,k)=>Math.round(mix(value,to[k],state.light))).join(',')+')';this.map.setSky({'sky-color':rgb([8,15,33],[52,96,124]),'horizon-color':rgb([60,64,85],[214,184,134]),'fog-color':rgb([25,36,57],[151,161,162]),'sky-horizon-blend':.65,'horizon-fog-blend':.75,'fog-ground-blend':.65});this.map.setPaintProperty('outside','fill-opacity',mix(.5,.2,a));this.lastMood=state.light;}
 }
 setActive(active){if(this.destroyed)return;const next=Boolean(active);if(next===this.active)return;this.active=next;if(this.active){this.map?.resize();this.apply(this.latest,true);}else{this.map?.stop();for(const control of this.prefetchControllers)control.abort();this.prefetchControllers.clear();}}
 resize(width=this.container.clientWidth,height=this.container.clientHeight){this.width=Math.max(1,width);this.height=Math.max(1,height);if(this.map&&this.active){this.map.resize();this.apply(this.latest,true);}}
 project(coord){if(!this.map)return {x:NaN,y:NaN};return this.map.project(coord);}
 preload(index){
  if(this.destroyed||!this.active||this.failure||!this.ready||globalThis.navigator?.connection?.saveData)return;
  const adjacent=[index-1,index+1].filter(i=>i>=0&&i<this.journey.stops.length);
  for(const at of adjacent){if(this.preloaded.has(at)||this.prefetchControllers.size+2>4)continue;this.preloaded.add(at);const point=mercator(this.journey.stops[at].coord),z=Math.min(11,Math.floor(this.journey.stops[at].zoom)),n=2**z,x=Math.floor(point[0]*n),y=Math.floor(point[1]*n);
   for(const template of [IMAGERY,ELEVATION]){const control=new AbortController();this.prefetchControllers.add(control);const timer=setTimeout(()=>control.abort(),6000),url=template.replace('{z}',z).replace('{x}',x).replace('{y}',y);
    fetch(url,{signal:control.signal,mode:'cors',credentials:'omit',cache:'force-cache'}).then(response=>{if(response.ok)return response.arrayBuffer();}).catch(()=>{}).finally(()=>{clearTimeout(timer);this.prefetchControllers.delete(control);});
   }
  }
 }
 destroy(){if(this.destroyed)return;this.destroyed=true;clearTimeout(this.deadline);for(const control of this.prefetchControllers)control.abort();this.prefetchControllers.clear();this.map?.remove();this.map=null;this.ready=false;this.container.style.opacity='0';}
}

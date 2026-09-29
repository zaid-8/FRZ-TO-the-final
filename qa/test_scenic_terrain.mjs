import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SCENIC_STOPS} from '../public/js/scenic-map-data.js';
import {createScenicJourney} from '../public/js/scenic-map-core.js';
import {ScenicTerrain} from '../public/js/scenic-map-terrain.js';

function fixture(){
 const maps=[],statuses=[],requests=[],journey=createScenicJourney(SCENIC_STOPS);
 class Map{
  constructor(options){this.options=options;this.events={};this.jumps=[];this.skies=[];this.resizeCount=0;this.removed=false;this.styleLoaded=true;this.tilesLoaded=true;this.sourcesLoaded=true;this.sources=Object.fromEntries(Object.entries(options.style.sources).map(([id,source])=>[id,{...source,setData(data){this.data=data;}}]));maps.push(this);}
  on(type,callback){(this.events[type]??=[]).push(callback);}
  emit(type,extra={}){for(const callback of this.events[type]||[])callback(extra);}
  addControl(){}getSource(id){return this.sources[id];}setFilter(){}setPaintProperty(){}setSky(value){this.skies.push(value);}
  jumpTo(value){this.jumps.push(value);}resize(){this.resizeCount++;}stop(){}remove(){this.removed=true;}
  isStyleLoaded(){return this.styleLoaded;}areTilesLoaded(){return this.tilesLoaded;}isSourceLoaded(){return this.sourcesLoaded;}
  project(){return {x:600,y:300};}
 }
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'maplibregl');Object.defineProperty(globalThis,'maplibregl',{configurable:true,writable:true,value:{version:'5.6.1',Map,AttributionControl:class{}}});
 const previousFetch=Object.getOwnPropertyDescriptor(globalThis,'fetch');Object.defineProperty(globalThis,'fetch',{configurable:true,writable:true,value:(url,options)=>{requests.push({url,options});return Promise.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});}});
 const container={clientWidth:1280,clientHeight:760,style:{},setAttribute(){}},terrain=new ScenicTerrain(container,{country:{features:[]},administrative:{features:[]}},journey,{onStatus:state=>statuses.push(state)});
 return {terrain,container,journey,maps,statuses,requests,cleanup(){terrain.destroy();if(descriptor)Object.defineProperty(globalThis,'maplibregl',descriptor);else delete globalThis.maplibregl;if(previousFetch)Object.defineProperty(globalThis,'fetch',previousFetch);else delete globalThis.fetch;}};
}

test('terrain readiness requires a rendered current viewport with every required source loaded',async()=>{
 const f=fixture();try{await f.terrain.start();const map=f.maps[0];assert.equal(f.terrain.ready,false);map.emit('load');assert.equal(f.terrain.ready,false);map.tilesLoaded=false;map.emit('render');assert.equal(f.terrain.ready,false);map.tilesLoaded=true;map.sourcesLoaded=false;map.emit('render');assert.equal(f.terrain.ready,false);map.sourcesLoaded=true;map.emit('render');assert.equal(f.terrain.ready,true);assert.equal(f.container.style.opacity,'1');
  const revision=f.terrain.revision,jumps=map.jumps.length,resizes=map.resizeCount;f.terrain.setActive(true);f.terrain.setActive(true);assert.equal(f.terrain.ready,true);assert.equal(f.terrain.revision,revision);assert.equal(map.jumps.length,jumps);assert.equal(map.resizeCount,resizes);
  f.terrain.update(f.journey.state(f.journey.stopProgress(3)));assert.equal(f.terrain.ready,true);assert.equal(f.container.style.opacity,'1');
  map.tilesLoaded=false;map.emit('sourcedataloading',{sourceId:'imagery'});assert.equal(f.terrain.ready,false);assert.equal(f.container.style.opacity,'0');map.emit('render');assert.equal(f.terrain.ready,false);map.tilesLoaded=true;map.emit('render');assert.equal(f.terrain.ready,true);
  map.emit('error',{sourceId:'dem'});assert.equal(f.terrain.ready,false);map.emit('render');assert.equal(f.terrain.ready,false);assert.equal(f.statuses.at(-1).mode,'offline');
 }finally{f.cleanup();}
});

test('inactive and destroyed renderers ignore late load work until explicitly reactivated',async()=>{
 const f=fixture();try{await f.terrain.start();const map=f.maps[0];f.terrain.setActive(false);map.emit('load');assert.equal(map.jumps.length,0);f.terrain.update(f.journey.state(f.journey.stopProgress(10)));assert.equal(map.jumps.length,0);f.terrain.setActive(true);assert.equal(map.jumps.length,1);assert.deepEqual(map.jumps[0].center,SCENIC_STOPS[10].coord);const count=f.statuses.length;f.terrain.destroy();map.emit('render');map.emit('load');map.emit('error',{sourceId:'imagery'});assert.equal(f.statuses.length,count);assert.equal(map.removed,true);}finally{f.cleanup();}
 const pending=fixture();try{const work=pending.terrain.start();pending.terrain.destroy();await work;assert.equal(pending.maps.length,0);}finally{pending.cleanup();}
});

test('stationary lighting changes and replay from final overview still update the renderer',async()=>{
 const f=fixture();try{await f.terrain.start();const map=f.maps[0];map.emit('load');map.emit('render');const state=f.journey.state(f.journey.stopProgress(5));f.terrain.update(state);const skyCount=map.skies.length;f.terrain.update({...state,light:1});assert.equal(map.skies.length,skyCount+1);
  f.terrain.update(f.journey.state(1));assert.ok(map.getSource('trail').data.geometry.coordinates.length>18);f.terrain.update(f.journey.state(0));assert.equal(map.getSource('trail').data.geometry.coordinates.length,2);assert.deepEqual(map.getSource('head').data.geometry.coordinates,SCENIC_STOPS[0].coord);
 }finally{f.cleanup();}
});

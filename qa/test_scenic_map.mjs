import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CATALOG} from '../public/js/catalog.js';
import {SCENIC_STOPS,SCENIC_STOPS_BY_ID} from '../public/js/scenic-map-data.js';
import {createScenicJourney,distance,mercator,lngLat,scenicViewport} from '../public/js/scenic-map-core.js';
import {ScenicAtlas} from '../public/js/scenic-map-atlas.js';

const angularDistance=(a,b)=>Math.abs((((b-a)%360)+540)%360-180);
const near=(a,b,epsilon=1e-8)=>a.forEach((value,index)=>assert.ok(Math.abs(value-b[index])<epsilon,`${a} != ${b}`));
const journey=createScenicJourney(SCENIC_STOPS);

test('the scenic map uses every catalog destination once in the original order',()=>{
 assert.equal(SCENIC_STOPS.length,18);assert.deepEqual(SCENIC_STOPS.map(stop=>stop.id),CATALOG.map(place=>place.id));assert.equal(new Set(SCENIC_STOPS.map(stop=>stop.id)).size,18);
 for(const stop of SCENIC_STOPS){assert.equal(SCENIC_STOPS_BY_ID[stop.id],stop);assert.ok(stop.focus.ar&&stop.focus.en&&stop.governorate.ar&&stop.governorate.en);assert.match(stop.governorateISO,/^JO-[A-Z]{2}$/);assert.match(stop.source,/^https:\/\//);assert.ok(stop.coord[0]>34&&stop.coord[0]<40&&stop.coord[1]>28&&stop.coord[1]<34);}
});

test('Petra, Madaba and Aqaba focus on the documented places instead of neighboring destinations',()=>{
 const byId=Object.fromEntries(SCENIC_STOPS.map(stop=>[stop.id,stop]));
 near(byId.petra.coord,[35.45175,30.32214],.00002);near(byId.madaba.coord,[35.79544,31.71606],.00002);
 assert.match(byId.petra.focus.en,/treasury|khazneh/i);assert.match(byId.madaba.focus.en,/park/i);assert.ok(distance(byId.aqaba.coord,[35.008,29.526])<8);assert.ok(distance(byId.aqaba.coord,byId.rum.coord)>35);
 assert.equal(byId.kharana.governorateISO,'JO-AM');assert.notDeepEqual(byId.amman.coord,byId.citadel.coord);
});

test('each of the eighteen arrival holds centers the camera and route head on the exact stop',()=>{
 const progress=[];
 for(let index=0;index<SCENIC_STOPS.length;index++){
  const p=journey.stopProgress(index),state=journey.state(p);progress.push(p);assert.equal(state.index,index);assert.equal(state.arrival,1);near(state.coord,SCENIC_STOPS[index].coord);near(state.head,SCENIC_STOPS[index].coord);near(journey.routeAt(state).at(-1),SCENIC_STOPS[index].coord);assert.ok(p>0&&p<1);
 }
 assert.deepEqual(progress,[...progress].sort((a,b)=>a-b));assert.equal(new Set(progress).size,18);
});

test('scrolling forward and backward is deterministic, finite and continuous at every camera transition',()=>{
 let routeIndex=-1;const arrived=new Set(),forward=[];
 for(let index=0;index<=2048;index++){
  const state=journey.state(index/2048);forward.push(state);assert.ok(state.coord.every(Number.isFinite)&&state.head.every(Number.isFinite));for(const key of ['zoom','pitch','bearing','light','intro','end','routeIndex'])assert.ok(Number.isFinite(state[key]),key);assert.ok(Number.isInteger(state.index)&&state.index>=0&&state.index<18);assert.ok(state.pitch>=0&&state.pitch<=74);assert.ok(state.zoom>=3&&state.zoom<=14);assert.ok(state.routeIndex>=routeIndex);routeIndex=state.routeIndex;if(state.arrival)arrived.add(state.index);
 }
 assert.equal(arrived.size,18);for(let index=2048;index>=0;index--)assert.deepEqual(journey.state(index/2048),forward[index]);
 for(const boundary of [...journey.arrivals,...journey.holds]){const before=journey.state(boundary-1e-8),after=journey.state(boundary+1e-8);assert.ok(distance(before.coord,after.coord)<.005);assert.ok(Math.abs(before.zoom-after.zoom)<.01);assert.ok(Math.abs(before.pitch-after.pitch)<.01);assert.ok(angularDistance(before.bearing,after.bearing)<.01);}
 assert.deepEqual(journey.state(-1),journey.state(0));assert.deepEqual(journey.state(2),journey.state(1));
});

test('route timing derives from the stop count and never mutates supplied destination coordinates',()=>{
 for(const count of [1,3,7,18]){const input=SCENIC_STOPS.slice(0,count).map(stop=>Object.freeze({...stop,coord:Object.freeze([...stop.coord])})),before=JSON.stringify(input),custom=createScenicJourney(Object.freeze(input));assert.equal(custom.stops.length,count);assert.equal(custom.arrivals.length,count);for(let index=0;index<count;index++){const state=custom.state(custom.stopProgress(index));assert.equal(state.index,index);near(state.coord,input[index].coord);}assert.equal(JSON.stringify(input),before);}
 for(const input of [[],[{id:'x',coord:[NaN,31]}],[{id:'x',coord:[35,91]}],[{id:'x',coord:[181,31]}],[{id:'x',coord:[35,31]},{id:'x',coord:[36,32]}]])assert.throws(()=>createScenicJourney(input),TypeError);
});

test('projection remains reversible and arrival coordinates stay inside the usable mobile and desktop frame',()=>{
 for(const coord of SCENIC_STOPS.map(stop=>stop.coord))near(lngLat(mercator(coord)),coord);
 const noop=()=>{},context=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(target,key)=>target[key]??noop,set:(target,key,value)=>(target[key]=value,true)}),canvas={clientWidth:1280,clientHeight:760,style:{},getContext:()=>context};
 const atlas=new ScenicAtlas(canvas,{country:{features:[]},administrative:{features:[]}},journey);
 try{for(const [width,height] of [[360,440],[390,640],[760,580],[1280,760],[1920,1080]]){atlas.resize(width,height,3);assert.ok(canvas.width<=Math.ceil(width*1.75));const viewport=scenicViewport(width,height);for(let index=0;index<18;index++){atlas.draw(journey.state(journey.stopProgress(index)));const point=atlas.project(SCENIC_STOPS[index].coord);near([point.x,point.y],viewport.origin);assert.ok(point.x>0&&point.x<width&&point.y>0&&point.y<height);}}}finally{atlas.destroy();}assert.equal(atlas.ctx,null);
});

import assert from 'node:assert/strict';
import {projectMercator,unprojectMercator,directionsLinks} from '../public/js/route-map.js';
import {DATA} from '../public/js/destinations.js';

const checks=[];
function check(name,run){run();checks.push(name);}
const point=(id,day=1)=>({id,day,name:`المحطة ${id}`,lat:29+id*.12,lng:35+id*.018});
const read=url=>new URL(url).searchParams;

check('Equator and prime meridian map to the centre of the world tile',()=>{
 assert.deepEqual(projectMercator(0,0,0),{x:128,y:128});
});
check('Jordan and global coordinates round-trip at all supported zoom scales',()=>{
 for(const [lat,lng] of [[32.33,35.75],[31.95,35.93],[29.53,35.01],[0,0],[-70,-150],[70,150]])for(const zoom of [0,4,8,12,16]){
  const projected=projectMercator(lat,lng,zoom),original=unprojectMercator(projected.x,projected.y,zoom);
  assert.ok(Math.abs(original.lat-lat)<1e-9);assert.ok(Math.abs(original.lng-lng)<1e-9);
 }
});
check('Poles remain finite and north is above south',()=>{
 assert.ok(Number.isFinite(projectMercator(90,0,16).y));assert.ok(Number.isFinite(projectMercator(-90,0,16).y));
 assert.ok(projectMercator(32.33,35.75,8).y<projectMercator(29.53,35.01,8).y);
});
check('Every catalog destination produces an external coordinate link',()=>{
 assert.equal(directionsLinks(DATA.map((p,i)=>({id:p.id,lat:p.lat,lng:p.lng,name:p.ar,day:i+1}))).length,DATA.length);
});
check('Large routes preserve every stop while limiting intermediate waypoints',()=>{
 const points=Array.from({length:22},(_,i)=>point(i,i<17?1:2)),links=directionsLinks(points),covered=new Set();
 assert.equal(links.length,5);
 for(const link of links){
  const url=new URL(link.url),query=url.searchParams,waypoints=query.get('waypoints')?.split('|')||[];
  assert.equal(url.origin,'https://www.google.com');assert.equal(query.get('travelmode'),'driving');assert.ok(waypoints.length<=3);assert.ok(url.href.length<2048);
  for(const item of [query.get('origin'),...waypoints,query.get('destination')])covered.add(item);
 }
 for(const p of points)assert.ok(covered.has(`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`));
});
check('Adjacent link segments share their boundary stop',()=>{
 const links=directionsLinks(Array.from({length:11},(_,i)=>point(i)));
 for(let i=1;i<links.length;i++)assert.equal(read(links[i-1].url).get('destination'),read(links[i].url).get('origin'));
});
check('Repeated overnight coordinates remain the origin of the following day',()=>{
 const overnight=point(2),route=[point(0),point(1),overnight,{...overnight,day:2},point(3,2),point(4,2)],links=directionsLinks(route);
 assert.equal(links.length,2);assert.equal(links[0].day,'1');assert.equal(links[1].day,'2');
 assert.equal(read(links[0].url).get('destination'),read(links[1].url).get('origin'));
});
check('Single stops use Google Maps place search, not empty driving directions',()=>{
 const query=read(directionsLinks([point(1)])[0].url);assert.ok(query.get('query'));assert.equal(query.has('origin'),false);
});
check('Invalid and absent coordinates do not become accidental map locations',()=>{
 assert.deepEqual(directionsLinks([{lat:'',lng:35},{lat:null,lng:35},{lat:NaN,lng:35},{lat:32,lng:999},{lat:91,lng:35}]),[]);
 assert.deepEqual(directionsLinks([]),[]);
});
check('Both documented route input shapes yield the same links',()=>{
 const points=[point(0),point(1)];assert.deepEqual(directionsLinks(points),directionsLinks({points}));
});
check('Direction labels translate without changing route coordinates or URLs',()=>{
 const route=[...Array.from({length:7},(_,i)=>point(i)),point(8,2)],arabic=directionsLinks(route,{locale:'ar'}),english=directionsLinks(route,{locale:'en'});
 assert.deepEqual(arabic.map(link=>link.url),english.map(link=>link.url));assert.match(english[0].label,/Day 1 · Part 1/);assert.match(english.at(-1).label,/Day 2 · Open stop location/);assert.match(arabic[0].label,/اليوم 1 · الجزء 1/);
});

console.log(`PASS: ${checks.length} map projection and external-direction checks. Pure logic only; no browser, DOM, network, or tile-render verification.`);

import assert from 'node:assert/strict';
import {test,mock} from 'node:test';
import {renderRouteMap} from '../public/js/route-map.js';
import {setLocale} from '../public/js/i18n.js';

class Element{
 constructor(tag,document){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.parentElement=null;this.dataset={};this.attributes={};this.listeners=new Map();this.style={};this.className='';this.hidden=false;this.disabled=false;this._text='';this.clientWidth=640;this.clientHeight=360;this.namespaceURI='http://www.w3.org/2000/svg';
  this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(x=>!names.includes(x)).join(' ');},toggle:(name,force)=>{const value=force??!this.classList.contains(name);value?this.classList.add(name):this.classList.remove(name);return value;}};
 }
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 set textContent(value){this._text=String(value);this.replaceChildren();}
 append(...children){for(const child of children){child.remove();child.parentElement=this;this.children.push(child);}}
 replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
 remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name]??null;}
 removeAttribute(name){delete this.attributes[name];}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==fn));}
 dispatch(type,extra={}){const event={target:this,preventDefault(){},stopPropagation(){},...extra};for(const listener of this.listeners.get(type)||[])listener(event);return event;}
 click(){if(!this.disabled)this.dispatch('click');}
 focus(){this.ownerDocument.activeElement=this;}
 *descendants(){for(const child of this.children){yield child;yield*child.descendants();}}
 matches(selector){if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));const attr=selector.match(/^(\w+)?\[data-([a-z-]+)\]$/);if(attr){const key=attr[2].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return (!attr[1]||this.tagName===attr[1].toUpperCase())&&Object.hasOwn(this.dataset,key);}return this.tagName===selector.toUpperCase();}
 querySelectorAll(selector){return [...this.descendants()].filter(child=>child.matches(selector));}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 closest(selector){for(let el=this;el;el=el.parentElement)if(selector.split(',').some(part=>el.matches(part)))return el;return null;}
}
function createDocument(){const doc={activeElement:null,createElement(tag){return new Element(tag,this);},createElementNS(ns,tag){return this.createElement(tag);},querySelectorAll(selector){return [...this.head.querySelectorAll(selector),...this.body.querySelectorAll(selector)];},querySelector(selector){return this.querySelectorAll(selector)[0]||null;}};doc.documentElement={};doc.head=doc.createElement('head');doc.body=doc.createElement('body');return doc;}
const route=()=>Object.freeze([Object.freeze({id:'amman',name:'عمّان',lat:31.95,lng:35.91,day:1}),Object.freeze({id:'ajloun',name:'عجلون',lat:32.33,lng:35.75,day:1})]);
const position=(lat=40.7128,lng=-74.006,accuracy=25)=>({coords:{latitude:lat,longitude:lng,accuracy}});
function fixture({geolocation=true,interactive=true,points=route()}={}){
 setLocale('ar');const document=createDocument(),requests=[],writes=[],frames=new Map(),windowListeners=new Map();let frameId=0;
 const window={addEventListener(type,fn){windowListeners.set(type,[...(windowListeners.get(type)||[]),fn]);},removeEventListener(type,fn){windowListeners.set(type,(windowListeners.get(type)||[]).filter(value=>value!==fn));},dispatchEvent(event){for(const fn of windowListeners.get(event.type)||[])fn(event);}};
 const globals={document,window,navigator:{geolocation:geolocation?{getCurrentPosition(success,error,options){requests.push({success,error,options});}}:undefined},isSecureContext:true,localStorage:{getItem(){return null;},setItem(key,value){writes.push({key,value});}},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:undefined,IntersectionObserver:undefined,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
 const before=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const container=document.createElement('div');document.body.append(container);const cleanupMap=renderRouteMap(container,points,{interactive});
 const draw=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};draw();
 const select=selector=>{const el=container.querySelector(selector);assert.ok(el,`Missing ${selector}`);return el;};
 return {document,container,requests,writes,frames,points,draw,select,cleanupMap,cleanup(){cleanupMap();setLocale('ar');for(const[key,descriptor]of before)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];}};
}

test('location requires an explicit action and preserves the immutable trip origin',()=>{
 const f=fixture();try{assert.equal(f.requests.length,0);assert.equal(f.select('.darb-route-map__my-location').hidden,true);const button=f.select('.darb-route-map__locate');assert.equal(button.textContent,'موقعي الحالي');button.click();assert.equal(f.requests.length,1);assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-busy'),'true');assert.equal(f.select('.darb-route-map__location-bar').dataset.locationState,'pending');button.click();assert.equal(f.requests.length,1);assert.deepEqual(f.requests[0].options,{enableHighAccuracy:true,timeout:10000,maximumAge:0});
  f.requests[0].success(position());f.draw();const marker=f.select('.darb-route-map__my-location');assert.equal(marker.hidden,false);assert.equal(marker.style.left,'320.00px');assert.equal(marker.style.top,'180.00px');assert.match(marker.getAttribute('aria-label'),/40.71280, -74.00600/);assert.match(f.select('.darb-route-map__location-status').textContent,/25/);assert.equal(button.disabled,false);assert.deepEqual(f.points,route());assert.deepEqual(f.writes,[]);
  const path=f.select('.darb-route-map__line').getAttribute('d');assert.ok(path);const tiles=f.container.querySelectorAll('.darb-route-map__tile');assert.ok(tiles.length);assert.ok(tiles.every(tile=>tile.src.startsWith('https://tile.openstreetmap.org/')));const fit=f.select('.darb-route-map__controls').children[2];fit.click();f.draw();assert.equal(f.select('.darb-route-map__my-location').hidden,true);assert.equal(f.select('.darb-route-map__pin').hidden,false);assert.deepEqual(f.points,route());
 }finally{f.cleanup();}
});

test('permission denied, unavailable and timeout have distinct recoverable states',()=>{
 for(const [code,state] of [[1,'denied'],[2,'unavailable'],[3,'timeout']]){const f=fixture();try{const button=f.select('.darb-route-map__locate');button.click();f.requests[0].error({code,message:'provider detail must not be displayed'});assert.equal(f.select('.darb-route-map__location-bar').dataset.locationState,state);assert.equal(button.disabled,false);assert.equal(f.select('.darb-route-map__my-location').hidden,true);assert.ok(!f.container.textContent.includes('provider detail'));button.click();assert.equal(f.requests.length,2);f.requests[1].success(position(31.95,35.91));assert.equal(f.select('.darb-route-map__location-bar').dataset.locationState,'success');}finally{f.cleanup();}}
});

test('late callbacks after an error cannot overwrite a newer location attempt',()=>{
 const f=fixture();try{f.select('.darb-route-map__locate').click();const old=f.requests[0];old.error({code:1});f.select('.darb-route-map__locate').click();old.success(position());old.error({code:2});f.draw();assert.equal(f.select('.darb-route-map__location-bar').dataset.locationState,'pending');assert.equal(f.select('.darb-route-map__my-location').hidden,true);f.requests[1].success(position(48.8566,2.3522));f.draw();assert.match(f.select('.darb-route-map__my-location').getAttribute('aria-label'),/48.85660, 2.35220/);}finally{f.cleanup();}
});

test('the location deadline releases a stalled permission prompt and ignores its late answer',()=>{
 mock.timers.enable({apis:['setTimeout']});const f=fixture();try{f.select('.darb-route-map__locate').click();mock.timers.tick(15000);assert.equal(f.select('.darb-route-map__location-bar').dataset.locationState,'timeout');assert.equal(f.select('.darb-route-map__locate').disabled,false);f.requests[0].success(position());f.draw();assert.equal(f.select('.darb-route-map__my-location').hidden,true);}finally{f.cleanup();mock.timers.reset();}
});

test('missing geolocation support and malformed coordinates never invent a location',()=>{
 const unsupported=fixture({geolocation:false});try{unsupported.select('.darb-route-map__locate').click();assert.equal(unsupported.select('.darb-route-map__location-bar').dataset.locationState,'unsupported');assert.equal(unsupported.requests.length,0);}finally{unsupported.cleanup();}
 for(const value of [position(NaN,35),position(91,35),position(32,181),{coords:{}},null]){const f=fixture();try{f.select('.darb-route-map__locate').click();f.requests[0].success(value);f.draw();assert.equal(f.select('.darb-route-map__location-bar').dataset.locationState,'unavailable');assert.equal(f.select('.darb-route-map__my-location').hidden,true);}finally{f.cleanup();}}
});

test('language changes update map labels without losing selection, current location or zoom',()=>{
 const f=fixture();try{const pin=f.select('.darb-route-map__pin');pin.click();f.select('.darb-route-map__locate').click();f.requests[0].success(position());f.draw();const marker=f.select('.darb-route-map__my-location'),coords={...marker.style},path=f.select('.darb-route-map__line').getAttribute('d');setLocale('en');f.draw();assert.equal(f.select('.darb-route-map').dir,'ltr');assert.equal(f.select('.darb-route-map__locate').textContent,'My location');assert.match(f.select('.darb-route-map__location-status').textContent,/shown in blue/);assert.match(f.select('.darb-route-map__selection').textContent,/Amman/);assert.equal(pin.getAttribute('aria-expanded'),'true');assert.deepEqual(marker.style,coords);assert.equal(f.select('.darb-route-map__line').getAttribute('d'),path);assert.match(f.select('.darb-route-map__directions').textContent,/Driving directions/);assert.equal(f.requests.length,1);setLocale('ar');assert.equal(f.select('.darb-route-map').dir,'rtl');assert.equal(f.select('.darb-route-map__locate').textContent,'موقعي الحالي');}finally{f.cleanup();}
});

test('cleanup and replacing a map ignore pending location callbacks and remove language listeners',()=>{
 const f=fixture();try{f.select('.darb-route-map__locate').click();const old=f.requests[0];const replacement=renderRouteMap(f.container,route());try{assert.equal(f.container.children.length,1);old.success(position());old.error({code:1});f.draw();assert.equal(f.select('.darb-route-map__my-location').hidden,true);replacement();old.success(position());setLocale('en');assert.equal(f.container.children.length,0);assert.equal(f.frames.size,0);}finally{replacement();}}finally{f.cleanup();}
});

test('empty maps can locate the user and static maps never request their location',()=>{
 const empty=fixture({points:[]});try{empty.select('.darb-route-map__locate').click();empty.requests[0].success(position());empty.draw();assert.equal(empty.select('.darb-route-map__my-location').hidden,false);assert.equal(empty.select('.darb-route-map__controls').children[2].disabled,true);}finally{empty.cleanup();}
 const staticMap=fixture({interactive:false});try{assert.equal(staticMap.select('.darb-route-map__location-bar').hidden,true);staticMap.select('.darb-route-map__locate').click();assert.equal(staticMap.requests.length,0);}finally{staticMap.cleanup();}
});

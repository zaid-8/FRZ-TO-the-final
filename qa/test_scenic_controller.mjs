import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {setLocale} from '../public/js/i18n.js';
import {SCENIC_STOPS} from '../public/js/scenic-map-data.js';

const sourceURL=new URL('../public/js/scenic-map.js',import.meta.url),moduleURL=value=>'data:text/javascript,'+encodeURIComponent(value);
const source=(await readFile(sourceURL,'utf8')).replace(/from ['"](.\/[^'"]+)['"]/g,(_,specifier)=>'from '+JSON.stringify(specifier==='./scenic-map-atlas.js'?moduleURL('export const ScenicAtlas=class{constructor(...args){return new globalThis.__scenicQA.Atlas(...args)}};'):specifier==='./scenic-map-terrain.js'?moduleURL('export const ScenicTerrain=class{constructor(...args){return new globalThis.__scenicQA.Terrain(...args)}};'):new URL(specifier,sourceURL).href)).replaceAll('import.meta.url',JSON.stringify(sourceURL.href));
const {initScenicMap,scenicScrollProgress}=await import(moduleURL(source));
const tick=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));};
class Element{
 constructor(tag,document){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.parentElement=null;this.dataset={};this.attributes={};this.listeners=new Map();this.style={setProperty(key,value){this[key]=value;}};this.className='';this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.open=false;this._text='';this.type='';this.name='';this.id='';this.validityMessage='';this.scrollHeight=0;
  this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(x=>!names.includes(x)).join(' ');},toggle:(name,force)=>{const value=force??!this.classList.contains(name);value?this.classList.add(name):this.classList.remove(name);return value;}};
 }
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 set textContent(value){this._text=String(value);this.replaceChildren();}
 get firstElementChild(){return this.children[0]||null;}
 get lastElementChild(){return this.children.at(-1)||null;}
 contains(element){return element===this||[...this.descendants()].includes(element);}
 get hidden(){return this._hidden||false;}
 set hidden(value){this._hidden=Boolean(value);if(value&&this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;}
 get disabled(){return this._disabled||false;}
 set disabled(value){this._disabled=Boolean(value);if(value&&this.ownerDocument.activeElement===this)this.ownerDocument.activeElement=this.ownerDocument.body;}
 get isConnected(){let element=this;while(element.parentElement)element=element.parentElement;return element===this.ownerDocument.body||element===this.ownerDocument.head;}
 append(...children){for(let child of children){if(typeof child==='string')child=this.ownerDocument.createTextNode(child);child.remove();child.parentElement=this;this.children.push(child);}}
 replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
 remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}}
 setAttribute(name,value){this.attributes[name]=String(value);if(name==='id')this.id=String(value);if(name==='class')this.className=String(value);}
 getAttribute(name){return this.attributes[name]??null;}
 removeAttribute(name){delete this.attributes[name];}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==fn));}
 dispatch(type,extra={}){const event={target:this,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;},...extra};for(let at=this;at;at=at.parentElement)for(const listener of at.listeners.get(type)||[])listener(event);return event;}
 click(){if(!this.disabled)this.dispatch('click');}
 focus(){if(this.disabled)return;for(let at=this;at;at=at.parentElement)if(at.hidden||at.tagName==='DIALOG'&&!at.open)return;this.ownerDocument.activeElement=this;}
 showModal(){this.open=true;}
 show(){this.open=true;}
 close(){this.open=false;this.dispatch('close');}
 setCustomValidity(message){this.validityMessage=message;}
 checkValidity(){return !this.validityMessage;}
 reportValidity(){return [this,...this.descendants()].every(e=>e.checkValidity());}
 getBoundingClientRect(){return this.ownerDocument.rectangle(this);}
 *descendants(){for(const child of this.children){yield child;yield*child.descendants();}}
 matches(selector){if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));if(selector.startsWith('#'))return this.id===selector.slice(1);const attr=selector.match(/^(\w+)?\[data-([a-z-]+)\]$/);if(attr){const key=attr[2].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return (!attr[1]||this.tagName===attr[1].toUpperCase())&&Object.hasOwn(this.dataset,key);}return this.tagName===selector.toUpperCase();}
 querySelectorAll(selector){return [...this.descendants()].filter(child=>child.matches(selector));}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 closest(selector){for(let el=this;el;el=el.parentElement)if(el.matches(selector))return el;return null;}
}
function createDocument(){const doc={activeElement:null,hidden:false,listeners:new Map(),createElement(tag){return new Element(tag,this);},createElementNS(ns,tag){return this.createElement(tag);},createTextNode(text){const el=this.createElement('#text');el.textContent=text;return el;},getElementById(id){return this.querySelector('#'+id);},querySelectorAll(selector){return [...this.head.querySelectorAll(selector),...this.body.querySelectorAll(selector)];},querySelector(selector){return this.querySelectorAll(selector)[0]||null;},addEventListener(type,fn){this.listeners.set(type,[...(this.listeners.get(type)||[]),fn]);},removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==fn));}};doc.head=doc.createElement('head');doc.body=doc.createElement('body');return doc;}
function fixture({reduced=false,initialScroll=1000}={}){
 setLocale('ar');const document=createDocument(),events=new Map(),mediaEvents=new Map(),frames=new Map(),scrolls=[],requests=[],atlases=[],terrains=[],observers=[],actions=[];let frameId=0,headerHeight=84;
 document.documentElement={dataset:{theme:'dark'}};
 const media={matches:reduced,addEventListener(type,fn){mediaEvents.set(type,fn);},removeEventListener(type){mediaEvents.delete(type);}};
 const window={scrollY:initialScroll,addEventListener(type,fn){events.set(type,[...(events.get(type)||[]),fn]);},removeEventListener(type,fn){events.set(type,(events.get(type)||[]).filter(value=>value!==fn));},dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event);},scrollTo(options){scrolls.push(options);this.scrollY=options.top;this.dispatchEvent({type:'scroll'});}};
 const header=document.createElement('header');header.className='site-header';const section=document.createElement('section');section.id='scenic-map';const explore=document.createElement('section');explore.id='explore';document.body.append(header,section,explore);
 const sectionHeight=()=>section.classList.contains('is-collapsed')?240:section.classList.contains('is-reduced')?900:11000;
 document.rectangle=node=>{let top=0,height=640,width=1280;if(node===header){height=headerHeight;}else if(node===section){top=1000-window.scrollY;height=sectionHeight();}else if(node===explore){top=1000+sectionHeight()+400-window.scrollY;height=900;}else if(node.classList.contains('scm-stage')){top=Math.min(Math.max(1000-window.scrollY,headerHeight),1000+sectionHeight()-window.scrollY-height);if(node.hidden){height=0;width=0;}}return {left:0,top,right:width,bottom:top+height,width,height};};
 class Observer{constructor(callback,options){this.callback=callback;this.options=options;this.disconnected=false;this.nodes=[];observers.push(this);}observe(node){this.nodes.push(node);}disconnect(){this.disconnected=true;}}
 class Atlas{constructor(){this.destroyed=false;this.draws=[];atlases.push(this);}resize(){}draw(state){this.draws.push(state);}project(){return {x:760,y:300};}destroy(){this.destroyed=true;}}
 class Terrain{constructor(host,geo,journey,options){this.options=options;this.active=options.active;this.destroyed=false;this.updates=[];this.starts=0;terrains.push(this);}async start(){this.starts++;return true;}setActive(value){this.active=value;}update(state){this.updates.push(state);}resize(){}preload(){}project(){return {x:760,y:300};}destroy(){this.destroyed=true;this.active=false;}}
 const globals={document,window,location:{href:'https://example.test/index.html'},innerHeight:900,devicePixelRatio:1,matchMedia:()=>media,localStorage:{getItem(){return null;},setItem(){}},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:Observer,IntersectionObserver:Observer,MutationObserver:undefined,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},fetch:(url,options)=>new Promise(resolve=>requests.push({url:String(url),options,resolve})),__scenicQA:{Atlas,Terrain}};
 const before=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const api=initScenicMap(section,{onDetails:id=>actions.push(['details',id]),onAdd:id=>actions.push(['add',id]),onNashmi:id=>actions.push(['nashmi',id])});
 const flush=()=>{let batches=0;while(frames.size){assert.ok(++batches<20,'The controller must settle without a permanent animation loop');const work=[...frames.values()];frames.clear();work.forEach(fn=>fn());}};
 const select=selector=>{const node=section.querySelector(selector);assert.ok(node,`Missing ${selector}`);return node;};
 return {api,document,window,section,explore,frames,scrolls,requests,atlases,terrains,actions,media,observers,select,flush,warm(){observers.find(observer=>observer.options?.rootMargin)?.callback([{isIntersecting:true}]);},resolveGeo(){for(const request of requests)request.resolve({ok:true,json:async()=>({type:'FeatureCollection',features:[]})});},scroll(top){window.scrollY=top;window.dispatchEvent({type:'scroll'});},header(value){headerHeight=value;observers.find(observer=>observer.nodes.includes(header)).callback([]);},visibility(hidden){document.hidden=hidden;for(const fn of document.listeners.get('visibilitychange')||[])fn({type:'visibilitychange'});},preference(value){media.matches=value;mediaEvents.get('change')?.({matches:value});},cleanup(){api.destroy();setLocale('ar');for(const[key,descriptor]of before)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];}};
}

test('scroll progress uses measured section and sticky-header geometry in both directions',()=>{
 const geometry={sectionTop:1000,sectionHeight:11000,stageHeight:640,headerHeight:84};assert.equal(scenicScrollProgress({...geometry,scrollY:916}),0);assert.equal(scenicScrollProgress({...geometry,scrollY:6096}),.5);assert.equal(scenicScrollProgress({...geometry,scrollY:11276}),1);assert.equal(scenicScrollProgress({...geometry,scrollY:0}),0);assert.equal(scenicScrollProgress({...geometry,scrollY:99999}),1);
});

test('skip during pending geography loading collapses before scrolling and late completion cannot start terrain or scroll again',async()=>{
 const f=fixture();try{f.flush();f.warm();assert.equal(f.requests.length,2);f.api.skip();assert.equal(f.api.getState().collapsed,true);assert.equal(f.select('.scm-stage').hidden,true);assert.equal(f.document.activeElement,f.explore);assert.equal(f.scrolls.at(-1).top,1000+240+400-84-12);const scrollCount=f.scrolls.length;f.resolveGeo();await tick();f.flush();assert.equal(f.scrolls.length,scrollCount);assert.equal(f.terrains.length,0);assert.equal(f.frames.size,0);assert.equal(f.api.getState().collapsed,true);
  f.api.replay();await tick();f.flush();assert.equal(f.api.getState().collapsed,false);assert.equal(f.select('.scm-stage').hidden,false);assert.equal(f.scrolls.at(-1).top,916);assert.equal(f.api.getState().progress,0);assert.equal(f.terrains.length,1);assert.equal(f.terrains[0].starts,1);
 }finally{f.cleanup();}
});

test('every actual destination is reachable and its details action keeps the exact catalog ID',async()=>{
 const f=fixture();try{f.warm();f.resolveGeo();await tick();f.flush();assert.equal(f.section.querySelectorAll('.scm-stop').length,18);assert.equal(f.api.getState().stops,18);
  for(const stop of SCENIC_STOPS){f.api.goTo(stop.id);f.flush();assert.equal(f.api.getState().activeId,stop.id);assert.equal(f.select('.scm-details').disabled,false);assert.equal(f.select('.scm-place-name').textContent,stop.focus.ar);f.select('.scm-details').click();assert.deepEqual(f.actions.at(-1),['details',stop.id]);assert.ok(!/^[IVXLCDM]+$/.test(f.select('.scm-place-tag').textContent));}
 }finally{f.cleanup();}
});

test('locale and header resize preserve the active destination and never force page scrolling',async()=>{
 const f=fixture();try{f.warm();f.resolveGeo();await tick();f.api.goTo('petra');f.flush();const before=f.api.getState(),scrollCount=f.scrolls.length;setLocale('en');f.flush();assert.equal(f.section.dir,'ltr');assert.equal(f.api.getState().activeId,'petra');assert.equal(f.api.getState().progress,before.progress);assert.equal(f.select('.scm-place-name').textContent,SCENIC_STOPS.find(stop=>stop.id==='petra').focus.en);assert.equal(f.scrolls.length,scrollCount);f.header(128);f.flush();assert.equal(f.scrolls.length,scrollCount);assert.equal(f.api.getState().activeId,'petra');assert.equal(f.section.style['--scm-header-offset'],'128px');}finally{f.cleanup();}
});

test('reduced-motion mode uses explicit station navigation without changing native page scroll',async()=>{
 const f=fixture({reduced:true});try{f.warm();f.resolveGeo();await tick();f.flush();assert.equal(f.api.getState().reduced,true);assert.equal(f.terrains.length,0);const scrollCount=f.scrolls.length;f.api.goTo('aqaba');f.flush();assert.equal(f.api.getState().activeId,'aqaba');assert.equal(f.scrolls.length,scrollCount);f.preference(false);f.flush();assert.equal(f.api.getState().reduced,false);f.select('.scm-enable-motion').click();f.flush();assert.equal(f.api.getState().reduced,true);f.api.skip();f.api.replay();await tick();f.flush();assert.equal(f.api.getState().reduced,true);}finally{f.cleanup();}
});

test('offscreen, backgrounded and destroyed scenes stop rendering and ignore late loads',async()=>{
 const f=fixture();try{f.warm();f.resolveGeo();await tick();f.flush();f.scroll(0);assert.equal(f.frames.size,0);assert.equal(f.terrains[0].active,false);f.scroll(1000);assert.equal(f.frames.size,1);f.visibility(true);assert.equal(f.frames.size,0);f.visibility(false);f.flush();assert.equal(f.frames.size,0);f.api.skip();assert.equal(f.terrains[0].destroyed,true);f.api.destroy();setLocale('en');f.window.dispatchEvent({type:'scroll'});assert.equal(f.frames.size,0);assert.equal(f.section.children.length,0);assert.ok(f.observers.every(observer=>observer.disconnected));}finally{f.cleanup();}
 const pending=fixture();try{pending.warm();pending.api.destroy();pending.resolveGeo();await tick();assert.equal(pending.terrains.length,0);assert.equal(pending.atlases.length,0);assert.equal(pending.frames.size,0);assert.ok(pending.requests.every(request=>request.options.signal.aborted));}finally{pending.cleanup();}
});

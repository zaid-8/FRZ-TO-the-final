import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {setLocale} from '../public/js/i18n.js';
import {cloudText,cloudSource} from '../public/js/cloud-copy.js';

const sourceURL=new URL('../public/js/cloud-ui.js',import.meta.url);
const dataModule=source=>'data:text/javascript,'+encodeURIComponent(source);
const methods=['getFirebaseContext','connectGuest','signInGoogle','signOutCloud','subscribeCloudState','getCloudState','saveCloudTrip','loadCloudTrip','deleteCloudTrip'];
const source=(await readFile(sourceURL,'utf8')).replace(/from ['"](.\/[^'"]+)['"]/g,(_,specifier)=>'from '+JSON.stringify(specifier==='./firebase-client.js'?dataModule(methods.map(name=>`export const ${name}=(...args)=>globalThis.__cloudUITestTransport.${name}(...args);`).join('\n')):new URL(specifier,sourceURL).href)).replaceAll('import.meta.url',JSON.stringify(sourceURL.href));
const {initCloudUI}=await import(dataModule(source));
const catalog=[{id:'amman',ar:'عمّان',en:'Amman',lat:31.95,lng:35.91,tags:['culture'],visitHours:2,activities:[]}];
const tick=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));};
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
class Element{
 constructor(tag,document){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.parentElement=null;this.dataset={};this.attributes={};this.listeners=new Map();this.style={setProperty(){}};this.className='';this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.open=false;this._text='';this.type='';this.name='';this.id='';this.validityMessage='';this.scrollHeight=0;
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
 getBoundingClientRect(){return {left:0,top:0,right:0,bottom:0,width:0,height:0};}
 *descendants(){for(const child of this.children){yield child;yield*child.descendants();}}
 matches(selector){if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));if(selector.startsWith('#'))return this.id===selector.slice(1);const attr=selector.match(/^(\w+)?\[data-([a-z-]+)\]$/);if(attr){const key=attr[2].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return (!attr[1]||this.tagName===attr[1].toUpperCase())&&Object.hasOwn(this.dataset,key);}return this.tagName===selector.toUpperCase();}
 querySelectorAll(selector){return [...this.descendants()].filter(child=>child.matches(selector));}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 closest(selector){for(let el=this;el;el=el.parentElement)if(el.matches(selector))return el;return null;}
}
function createDocument(){const doc={activeElement:null,hidden:false,listeners:new Map(),createElement(tag){return new Element(tag,this);},createElementNS(ns,tag){return this.createElement(tag);},createTextNode(text){const el=this.createElement('#text');el.textContent=text;return el;},getElementById(id){return this.querySelector('#'+id);},querySelectorAll(selector){return [...this.head.querySelectorAll(selector),...this.body.querySelectorAll(selector)];},querySelector(selector){return this.querySelectorAll(selector)[0]||null;},addEventListener(type,fn){this.listeners.set(type,[...(this.listeners.get(type)||[]),fn]);},removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==fn));}};doc.head=doc.createElement('head');doc.body=doc.createElement('body');return doc;}
function fixture({locale='ar',savedIds=['amman']}={}){
 setLocale('ar');const document=createDocument(),events=new Map(),subscribers=new Set(),saved=[],loaded=[],announcements=[];let state={phase:'ready',uid:'user-1',isAnonymous:true,writePending:false};
 const replies={save:async()=>({saved:true}),load:async()=>({version:1,savedIds:['amman'],tripStopIds:[],tripProfile:null,title:'My stored trip'}),remove:async()=>({deleted:true}),google:async()=>({}),guest:async()=>({})};
 const transport={getFirebaseContext:async()=>({}),getCloudState:()=>state,subscribeCloudState(fn){subscribers.add(fn);fn(state);return()=>subscribers.delete(fn);},connectGuest:()=>replies.guest(),signInGoogle:()=>replies.google(),signOutCloud:async()=>({}),saveCloudTrip:payload=>{saved.push(payload);return replies.save(payload);},loadCloudTrip:()=>replies.load(),deleteCloudTrip:()=>replies.remove()};
 const window={addEventListener(type,fn){events.set(type,[...(events.get(type)||[]),fn]);},removeEventListener(type,fn){events.set(type,(events.get(type)||[]).filter(value=>value!==fn));},dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event);}};
 const globals={document,window,localStorage:{getItem(){return null;},setItem(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},__cloudUITestTransport:transport};
 const before=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 setLocale(locale);const api=initCloudUI({catalog,getSavedIds:()=>savedIds,onLoadPlan:ids=>loaded.push(ids),onStatus:value=>announcements.push(value)});
 const select=selector=>{const el=document.querySelector(selector);assert.ok(el,`Missing ${selector}`);return el;};
 return {api,document,replies,saved,loaded,announcements,select,button(text){const result=document.querySelectorAll('button').find(button=>button.textContent===text);assert.ok(result,`Missing button ${text}`);return result;},emit(update){state={...state,...update};for(const fn of subscribers)fn(state);},cleanup(){api.destroy();setLocale('ar');for(const[key,descriptor]of before)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];}};
}

test('English cloud interface translates every static label and dynamic account state',async()=>{
 const f=fixture({locale:'en'});try{f.api.open();await tick();assert.equal(f.select('.cloud-dialog').dir,'ltr');assert.ok(!/[\u0600-\u06ff]/.test(f.select('.cloud-dialog').textContent));assert.equal(f.select('input').placeholder,'My journey through Jordan');
  for(const update of [{uid:null,phase:'idle'},{phase:'connecting'},{phase:'unconfigured'},{phase:'error'},{phase:'ready'},{uid:'guest',isAnonymous:true},{uid:'named-user',isAnonymous:false,displayName:'رحلة العائلة'},{writePending:true}]){f.emit(update);for(const name of ['.cloud-connection','.cloud-small'])assert.ok(!/[\u0600-\u06ff]/.test(f.select(name).textContent),name);}
  assert.equal(f.select('.cloud-account').querySelector('h3').textContent,'رحلة العائلة');
 }finally{f.cleanup();}
});

test('automatic default title localizes while every explicitly entered title remains unchanged',()=>{
 const f=fixture();try{const input=f.select('input');assert.equal(input.value,'رحلتي عبر الأردن');setLocale('en');assert.equal(input.value,'My journey through Jordan');setLocale('ar');assert.equal(input.value,'رحلتي عبر الأردن');
  for(const title of ['رحلتي عبر الأردن','My journey through Jordan','رحلة العائلة <img src=x onerror=alert(1)>','']){input.value=title;input.dispatch('input');setLocale('en');assert.equal(input.value,title);setLocale('ar');assert.equal(input.value,title);}
  input.value='رحلة عائلتي';input.dispatch('input');setLocale('en');f.button('Save current plan').click();assert.equal(f.saved[0].title,'رحلة عائلتي');assert.equal(f.saved[0].savedIds[0],'amman');
 }finally{f.cleanup();}
});

test('a loaded title matching translated default copy remains the saved user title',async()=>{
 const f=fixture();try{for(const title of ['رحلتي عبر الأردن','My journey through Jordan']){f.replies.load=async()=>({version:1,savedIds:['amman'],tripStopIds:[],tripProfile:null,title});f.button('استرجع خطتي').click();await tick();assert.equal(f.select('input').value,title);setLocale('en');assert.equal(f.select('input').value,title);setLocale('ar');assert.equal(f.select('input').value,title);}}
 finally{f.cleanup();}
});

test('changing language during a save preserves the operation and translates its pending and completion status',async()=>{
 const f=fixture();try{const pending=defer();f.replies.save=()=>pending.promise;f.button('احفظ الخطة الحالية').click();assert.equal(f.saved.length,1);assert.match(f.select('.cloud-action-status').textContent,/جارٍ حفظ/);setLocale('en');assert.equal(f.select('.cloud-action-status').textContent,'Saving your plan…');assert.equal(f.select('input').disabled,true);assert.equal(f.saved.length,1);pending.resolve({saved:true});await tick();assert.equal(f.select('.cloud-action-status').textContent,'Your plan was saved to your account.');assert.equal(f.select('input').disabled,false);assert.equal(f.select('.cloud-action-status').dataset.kind,'success');}finally{f.cleanup();}
});

test('invalid loaded destinations remain a translated error after a language change and never reach the plan',async()=>{
 const f=fixture();try{f.replies.load=async()=>({version:1,savedIds:['unavailable'],tripStopIds:[],tripProfile:null,title:'Old trip'});f.button('استرجع خطتي').click();await tick();assert.equal(f.select('.cloud-action-status').dataset.kind,'error');assert.match(f.select('.cloud-action-status').textContent,/[\u0600-\u06ff]/);setLocale('en');assert.ok(!/[\u0600-\u06ff]/.test(f.select('.cloud-action-status').textContent));assert.match(f.select('.cloud-action-status').textContent,/destination/i);assert.equal(f.loaded.length,0);}finally{f.cleanup();}
});

test('known provider failures and opaque diagnostics display safe translated cloud errors',async()=>{
 const f=fixture({locale:'en'});try{for(const error of [{code:'auth/popup-blocked'},{code:'auth/popup-closed-by-user'},{code:'firestore/permission-denied'},new Error('أنت غير متصل بالإنترنت. احفظ النسخة المحلية؛ لم يُرسل طلب إلى السحابة.'),new Error('secret-provider-token <script>bad()</script>')]){f.replies.save=async()=>{throw error;};f.button('Save current plan').click();await tick();const status=f.select('.cloud-action-status');assert.equal(status.dataset.kind,'error');assert.ok(!/[\u0600-\u06ff]/.test(status.textContent));assert.ok(!status.textContent.includes('secret-provider-token'));assert.ok(!status.textContent.includes('<script>'));}}
 finally{f.cleanup();}
});

test('unknown Arabic diagnostics use a safe error that can change language',async()=>{
 const f=fixture();try{f.replies.save=async()=>{throw new Error('بيانات داخلية secret-provider-token');};f.button('احفظ الخطة الحالية').click();await tick();assert.ok(!f.select('.cloud-action-status').textContent.includes('secret-provider-token'));setLocale('en');assert.ok(!/[\u0600-\u06ff]/.test(f.select('.cloud-action-status').textContent));assert.equal(f.select('.cloud-action-status').dataset.kind,'error');}finally{f.cleanup();}
});

test('all fixed Arabic messages in Firebase cloud providers have English dictionary entries',async()=>{
 setLocale('en');try{for(const name of ['firebase-client.js','cloud-model.js']){const text=await readFile(new URL('../public/js/'+name,import.meta.url),'utf8');const strings=[...text.matchAll(/'([^'\n]*[\u0600-\u06ff][^'\n]*)'/g)].map(match=>match[1]);assert.ok(strings.length>0);for(const value of strings){assert.ok(cloudSource(value),`${name}: ${value}`);assert.ok(!/[\u0600-\u06ff]/.test(cloudText(value)),value);}}}finally{setLocale('ar');}
});

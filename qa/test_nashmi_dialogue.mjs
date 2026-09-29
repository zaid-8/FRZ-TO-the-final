import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {normalizeProfile,buildItinerary} from '../public/js/itinerary.js';
import {setLocale,getLocale} from '../public/js/i18n.js';


const sourceURL=new URL('../public/js/nashmi.js',import.meta.url);
const dataModule=source=>'data:text/javascript,'+encodeURIComponent(source);
const source=(await readFile(sourceURL,'utf8'))
 .replace(/from ['"](.\/[^'"]+)['"]/g,(_,specifier)=>{
  const url=specifier==='./nashmi-ai.js'
   ?dataModule('export * from '+JSON.stringify(new URL(specifier,sourceURL).href)+'; export const createNashmiAI=()=>globalThis.__nashmiDialogueTransport;')
   :specifier==='./route-map.js'?dataModule('export const renderRouteMap=()=>()=>{};'):new URL(specifier,sourceURL).href;
  return 'from '+JSON.stringify(url);
 }).replaceAll('import.meta.url',JSON.stringify(sourceURL.href));
const {initNashmi}=await import(dataModule(source+'\n//# sourceURL=nashmi-dialogue-fixture.js\n'));
const catalog=[
 {id:'amman',ar:'عمّان',lat:31.95,lng:35.91,tags:['culture'],visitHours:2,activities:[]},
 {id:'ajloun',ar:'عجلون',lat:32.33,lng:35.75,tags:['nature'],visitHours:2,activities:[]},
 {id:'jerash',ar:'جرش',lat:32.28,lng:35.9,tags:['history'],visitHours:2,activities:[]}
];
const known=['days','people','originId','interests','budget','transport','nationality'];
const initial=()=>normalizeProfile({days:1,people:2,budget:100,originId:'amman',interests:['nature'],mustVisit:['ajloun']},catalog);
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};

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
 showModal(){throw new Error('Widget must remain nonmodal');}
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
async function fixture({available=true,locale='ar'}={}){
 const document=createDocument(),data=new Map(),requests=[],replies=[],pendingReplies=[];
 const transport={status:async()=>({aiConfigured:available}),reply(payload,options){requests.push({payload:structuredClone(payload),signal:options.signal});if(!replies.length)throw new Error('Test did not supply an AI response');return replies.shift()(payload,options);}};
 const globals={document,window:new EventTarget(),location:{href:'https://example.test/'},localStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)},matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}}),innerWidth:1200,innerHeight:900,requestAnimationFrame:()=>1,cancelAnimationFrame(){},__nashmiDialogueTransport:transport};
 const before=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 setLocale(locale);const api=initNashmi({catalog});await tick();
 const select=selector=>{const el=document.querySelector(selector);assert.ok(el,`Expected element ${selector}`);return el;};
 const send=async text=>{select('.nsh-chat-form').querySelector('textarea').value=text;select('.nsh-chat-form').dispatch('submit');await tick();};
 const change=(key,value)=>{const el=document.getElementById('nsh-'+key);assert.ok(el,`Expected field ${key}`);el.value=String(value);el.dispatch('change');};
 return {api,document,data,requests,replies,select,send,change,pending(){const p=defer();pendingReplies.push(p);return p;},button(text){const el=document.querySelectorAll('button').find(button=>button.textContent===text);assert.ok(el,`Expected button ${text}`);return el;},cleanup(){api.destroy();setLocale('ar');for(const pending of pendingReplies)pending.resolve(null);for(const[key,descriptor]of before)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];}};
}
function response(action,profile=initial(),extra={}){return {mode:'ai',action,reply:'اقتراح رد محادثة من الخدمة.',profile,knownFields:known,needs:[],trip:action==='plan'?buildItinerary(profile,catalog):null,...extra};}

test('AI greeting waits for the service and asks a question without inventing a trip or confirmed defaults',async()=>{
 const f=await fixture();try{const pending=f.pending();f.replies.push(()=>pending.promise);await f.send('مرحبا');assert.equal(f.requests.length,1);assert.deepEqual(f.requests[0].payload.knownFields,[]);assert.equal(f.api.getCurrentTrip(),null);assert.equal(f.document.querySelectorAll('.nsh-message-assistant').length,0);assert.equal(f.select('.nsh-send').disabled,true);
  pending.resolve(response('clarify',initial(),{reply:'أهلًا! بتحب طبيعة ولا بحر، وكم يوم معك؟',knownFields:[],needs:['interests','days']}));await tick();assert.equal(f.api.getCurrentTrip(),null);assert.match(f.select('.nsh-messages').textContent,/كم يوم معك/);assert.equal(f.select('.nsh-send').disabled,false);
 }finally{f.cleanup();}
});

test('discussion and clarification preserve an existing trip; only a complete plan replaces it',async()=>{
 const f=await fixture();try{f.api.loadTripProfile(initial(),['ajloun']);const saved=f.api.getCurrentTrip();f.replies.push(async()=>response('discuss',{...initial(),days:2},{reply:'عجلون أقرب للطبيعة، وجرش للآثار.'}));await f.send('قارن عجلون وجرش');assert.deepEqual(f.api.getCurrentTrip(),saved);
  f.replies.push(async()=>response('clarify',{...initial(),days:2},{needs:['budget'],knownFields:known.filter(k=>k!=='budget')}));await f.send('طيب لو يومين؟');assert.deepEqual(f.api.getCurrentTrip(),saved);
  f.replies.push(async()=>response('plan',{...initial(),days:2}));await f.send('الميزانية 100، اعمل الخطة');assert.equal(f.api.getCurrentTrip().profile.days,2);
 }finally{f.cleanup();}
});

test('editing a field confirms only that field and invalidates a pending old response',async()=>{
 const f=await fixture();try{f.change('days',2);const pending=f.pending();f.replies.push(()=>pending.promise);await f.send('بدي أرتب سفرة');assert.deepEqual(f.requests[0].payload.knownFields,['days']);f.change('people',4);assert.equal(f.requests[0].signal.aborted,true);pending.resolve(response('plan',{...initial(),people:2}));await tick();assert.equal(f.api.getCurrentTrip(),null);assert.equal(f.document.getElementById('nsh-people').value,'4');assert.equal(f.document.querySelectorAll('.nsh-message-assistant').length,0);
  f.replies.push(async()=>response('clarify',initial(),{knownFields:['days','people'],needs:['originId']}));await f.send('كمل معي');assert.deepEqual(new Set(f.requests[1].payload.knownFields),new Set(['days','people']));
 }finally{f.cleanup();}
});

test('cloud restore cancels an old response so it cannot overwrite the restored trip',async()=>{
 const f=await fixture();try{const pending=f.pending();f.replies.push(()=>pending.promise);await f.send('اعمل رحلة');const restored={...initial(),days:2,people:3};f.api.loadTripProfile(restored,['jerash']);const saved=f.api.getCurrentTrip();assert.equal(f.requests[0].signal.aborted,true);pending.resolve(response('plan',initial()));await tick();assert.deepEqual(f.api.getCurrentTrip(),saved);assert.equal(f.api.getCurrentTrip().profile.people,3);
 }finally{f.cleanup();}
});

test('typing in a field before blur cancels pending output without overwriting the typed value',async()=>{
 const f=await fixture();try{const pending=f.pending();f.replies.push(()=>pending.promise);await f.send('نرتب طلعة؟');const input=f.document.getElementById('nsh-people');input.value='5';input.dispatch('input');assert.equal(f.requests[0].signal.aborted,true);pending.resolve(response('plan'));await tick();assert.equal(input.value,'5');assert.equal(f.api.getCurrentTrip(),null);
 }finally{f.cleanup();}
});

test('failed AI requests do not silently substitute a local plan or a canned assistant answer',async()=>{
 const f=await fixture();try{f.replies.push(async()=>{throw new Error('اتصال الاختبار غير متاح.');});await f.send('رحلة يومين لأربعة أشخاص');assert.equal(f.requests.length,1);assert.equal(f.api.getCurrentTrip(),null);assert.equal(f.document.querySelectorAll('.nsh-message-assistant').length,0);assert.equal(f.select('.nsh-error').hidden,false);assert.equal(f.select('.nsh-send').disabled,false);
 }finally{f.cleanup();}
});

test('offline greeting does not masquerade as an AI answer; form planning remains an explicit action',async()=>{
 const f=await fixture({available:false});try{await f.send('مرحبا بدي أطلع');assert.equal(f.requests.length,0);assert.equal(f.api.getCurrentTrip(),null);assert.equal(f.document.querySelectorAll('.nsh-message-assistant').length,0);f.select('.nsh-profile-form').dispatch('submit');await tick();assert.ok(f.api.getCurrentTrip());assert.match(f.select('.nsh-trip-panel').textContent,/المخطط المحلي/);
 }finally{f.cleanup();}
});

test('closing the dialog discards a late model response and releases the pending state',async()=>{
 const f=await fixture();try{f.api.open();await tick();const pending=f.pending();f.replies.push(()=>pending.promise);await f.send('ساعدني أختار');f.api.close();assert.equal(f.requests[0].signal.aborted,true);pending.resolve(response('plan'));await tick();assert.equal(f.api.getCurrentTrip(),null);assert.equal(f.select('.nsh-send').disabled,false);assert.equal(f.document.querySelectorAll('.nsh-message-assistant').length,0);
 }finally{f.cleanup();}
});

test('launcher toggles a nonmodal widget and leaves the page interactive without scrolling or hiding it',async()=>{
 const f=await fixture();try{const outside=f.document.createElement('button');outside.textContent='Page control';f.document.body.append(outside);outside.focus();const launch=f.select('.nsh-launch'),dialog=f.select('.nsh-dialog');f.api.open();await tick();assert.equal(dialog.open,true);assert.equal(dialog.getAttribute('aria-modal'),'false');assert.equal(launch.hidden,false);assert.equal(launch.getAttribute('aria-expanded'),'true');assert.equal(f.document.body.className,'');
  let pageClicks=0;outside.addEventListener('click',()=>pageClicks++);outside.click();outside.focus();assert.equal(pageClicks,1);assert.equal(dialog.open,true);f.api.close();assert.equal(f.document.activeElement,outside);assert.equal(launch.getAttribute('aria-expanded'),'false');
  launch.focus();launch.click();assert.equal(dialog.open,true);const event=f.select('.nsh-close').dispatch('keydown',{key:'Escape'});assert.equal(event.defaultPrevented,true);assert.equal(dialog.open,false);assert.equal(f.document.activeElement,launch);
 }finally{f.cleanup();}
});

test('tabs expose one panel and keyboard navigation follows RTL without losing form values',async()=>{
 const f=await fixture();try{f.api.open();const chat=f.select('.nsh-conversation'),details=f.select('.nsh-profile-form'),trip=f.select('.nsh-trip-panel');assert.equal(chat.hidden,false);assert.equal(details.hidden,true);assert.equal(trip.hidden,true);assert.equal(f.select('#nsh-tab-chat').getAttribute('aria-selected'),'true');
  f.select('#nsh-tab-chat').dispatch('keydown',{key:'ArrowLeft'});assert.equal(chat.hidden,true);assert.equal(details.hidden,false);assert.equal(f.document.activeElement,f.select('#nsh-tab-details'));f.change('people',5);f.select('#nsh-tab-details').dispatch('keydown',{key:'End'});assert.equal(trip.hidden,false);assert.equal(details.hidden,true);f.select('#nsh-tab-trip').dispatch('keydown',{key:'Home'});assert.equal(chat.hidden,false);assert.equal(f.document.getElementById('nsh-people').value,'5');
 }finally{f.cleanup();}
});

test('AI plan stays with the conversation and offers a deliberate path to the itinerary tab',async()=>{
 const f=await fixture();try{f.api.open();await tick();f.replies.push(async()=>response('plan'));await f.send('اعملي الخطة');assert.ok(f.api.getCurrentTrip());assert.equal(f.select('.nsh-conversation').hidden,false);assert.equal(f.select('.nsh-trip-panel').hidden,true);f.select('.nsh-open-trip').focus();f.select('.nsh-open-trip').click();assert.equal(f.select('.nsh-trip-panel').hidden,false);assert.equal(f.document.activeElement,f.select('#nsh-tab-trip'));assert.equal(f.select('#nsh-tab-trip').getAttribute('aria-selected'),'true');
 }finally{f.cleanup();}
});

test('progress reflects transport retry, stopping cancels it, and late notifications cannot restart waiting',async()=>{
 const f=await fixture();try{f.api.open();await tick();const pending=f.pending();let notify;f.replies.push((payload,options)=>{notify=options.onProgress;notify('connecting');return pending.promise;});await f.send('ساعدني أختار');assert.match(f.select('.nsh-pending').textContent,/جارٍ الاتصال/);assert.equal(f.select('.nsh-stop').hidden,false);notify('retrying');assert.match(f.select('.nsh-pending').textContent,/الخدمة مشغولة/);f.select('.nsh-stop').click();assert.equal(f.requests[0].signal.aborted,true);assert.equal(f.select('.nsh-pending').hidden,true);assert.equal(f.select('.nsh-send').disabled,false);notify('generating');assert.equal(f.select('.nsh-pending').hidden,true);pending.resolve(response('plan'));await tick();assert.equal(f.api.getCurrentTrip(),null);assert.equal(f.document.querySelectorAll('.nsh-message-assistant').length,0);
 }finally{f.cleanup();}
});

test('an arriving reply does not take focus away from the visible main page',async()=>{
 const f=await fixture();try{f.api.open();await tick();const pending=f.pending();f.replies.push(()=>pending.promise);await f.send('كم وقت عجلون؟');const outside=f.document.createElement('button');outside.textContent='Explore destinations';f.document.body.append(outside);outside.focus();pending.resolve(response('discuss'));await tick();assert.equal(f.document.activeElement,outside);assert.equal(f.select('.nsh-dialog').open,true);
 }finally{f.cleanup();}
});

test('sending from the keyboard hands focus to Stop before controls blur and restores the composer on success or failure',async()=>{
 const f=await fixture();try{f.api.open();await tick();const input=f.select('.nsh-chat-form').querySelector('textarea'),send=f.select('.nsh-send'),stop=f.select('.nsh-stop');
  for(const [control,fail]of [[input,false],[send,true]]){const pending=f.pending();f.replies.push(()=>pending.promise);control.focus();assert.equal(f.document.activeElement,control);await f.send('ساعدني أختار وجهة');assert.equal(input.disabled,true);assert.equal(send.hidden,true);assert.equal(stop.hidden,false);assert.equal(f.document.activeElement,stop,'Focus survives disabling the composer and hiding Send');
   if(fail)pending.reject(new Error('تعذّر الاتصال في الاختبار.'));else pending.resolve(response('discuss'));await tick();assert.equal(input.disabled,false);assert.equal(stop.hidden,true);assert.equal(f.document.activeElement,input,'Focus returns before Stop is hidden');
  }
 }finally{f.cleanup();}
});

test('a sparse requested plan is shown with editable assumptions without confirming untouched defaults',async()=>{
 const f=await fixture();try{f.api.open();await tick();const assumed=['people','originId','interests','budget','transport','nationality'];f.replies.push(async()=>response('plan',initial(),{knownFields:['days'],assumedFields:assumed,suggestedIds:['ajloun'],provisional:true}));await f.send('اقترح رحلة يوم واحد');assert.ok(f.api.getCurrentTrip());assert.match(f.select('.nsh-provisional').textContent,/ليست معلومات أكّدتها/);assert.match(f.select('.nsh-provisional').textContent,/سيارة خاصة/);assert.match(f.select('.nsh-provisional').textContent,/فئة رسوم أردني/);
  f.replies.push(async()=>response('discuss',initial(),{knownFields:['days']}));await f.send('شو ممكن أغيّر؟');assert.deepEqual(f.requests[1].payload.knownFields,['days']);
 }finally{f.cleanup();}
});

test('discussion supplies useful destination actions without requiring pricing preferences',async()=>{
 const f=await fixture();try{f.api.open();await tick();f.replies.push(async()=>response('discuss',initial(),{reply:'عجلون للطبيعة وجرش للآثار، حسب جوّك.',knownFields:[],suggestedIds:['ajloun','jerash']}));await f.send('اقترح مكان قريب');assert.equal(f.api.getCurrentTrip(),null);const actions=f.select('.nsh-response-actions');assert.equal(actions.querySelectorAll('button').length,3);assert.match(actions.textContent,/رتّب لي اقتراح/);assert.deepEqual(f.requests[0].payload.knownFields,[]);
 }finally{f.cleanup();}
});

test('English covers the full widget and a locally generated itinerary without Arabic UI remnants',async()=>{
 const f=await fixture({locale:'en'});try{f.api.open();await tick();assert.equal(f.select('.nsh-dialog').dir,'ltr');assert.match(f.select('.nsh-launch').textContent,/Ask Nashmi/);assert.match(f.select('.nsh-profile-form').textContent,/Entry-fee category/);f.select('.nsh-profile-form').dispatch('submit');await tick();assert.ok(f.api.getCurrentTrip());assert.match(f.select('.nsh-provisional').textContent,/not preferences you confirmed/);assert.match(f.select('.nsh-trip-panel').textContent,/Estimated|estimated/);assert.doesNotMatch(f.select('.nsh-dialog').textContent,/[\u0600-\u06ff]/);
  for(const element of [f.select('.nsh-dialog'),...f.select('.nsh-dialog').descendants()])for(const key of ['placeholder','title'])if(element[key])assert.doesNotMatch(element[key],/[\u0600-\u06ff]/);for(const element of f.select('.nsh-dialog').descendants())for(const [key,value]of Object.entries(element.attributes))if(key.startsWith('aria-'))assert.doesNotMatch(value,/[\u0600-\u06ff]/);
 }finally{f.cleanup();}
});

test('changing language preserves typed content, history and the plan while cancelling a pending old-language reply',async()=>{
 const f=await fixture();try{f.api.open();await tick();f.api.loadTripProfile(initial(),['ajloun']);const before=f.api.getCurrentTrip();f.replies.push(async()=>response('discuss',initial(),{reply:'هذا الرد محفوظ من المحادثة السابقة.',knownFields:[]}));await f.send('قارن الخيارات');const pending=f.pending();f.replies.push(()=>pending.promise);await f.send('كمل معي');const originalDialog=f.select('.nsh-dialog'),outside=f.document.createElement('button');f.document.body.append(outside);outside.focus();setLocale('en');await tick();assert.equal(f.requests[1].signal.aborted,true);assert.notEqual(f.select('.nsh-dialog'),originalDialog);assert.equal(f.select('.nsh-dialog').open,true);assert.equal(f.document.activeElement,outside);assert.match(f.select('.nsh-messages').textContent,/هذا الرد محفوظ/);assert.equal(f.select('.nsh-chat-form').querySelector('textarea').value,'كمل معي');assert.deepEqual(f.api.getCurrentTrip().route.map(place=>place.id),before.route.map(place=>place.id));assert.deepEqual(f.api.getCurrentTrip().cost.total,before.cost.total);assert.match(f.api.getCurrentTrip().title,/from/);
  pending.resolve(response('plan',{...initial(),days:7}));await tick();assert.equal(f.api.getCurrentTrip().profile.days,1);assert.equal(f.document.querySelectorAll('.nsh-message-assistant').length,1);f.select('.nsh-chat-form').querySelector('textarea').value='Keep this unsent draft';setLocale('ar');await tick();assert.equal(f.select('.nsh-chat-form').querySelector('textarea').value,'Keep this unsent draft');assert.equal(f.select('.nsh-dialog').dir,'rtl');
 }finally{f.cleanup();}
});

test('the next AI request after a language switch uses the current locale and preserves earlier message text',async()=>{
 const f=await fixture();try{f.api.open();await tick();f.replies.push(async()=>response('discuss',initial(),{knownFields:[]}));await f.send('بدي مكان فيه طبيعة');setLocale('en');await tick();f.replies.push(async()=>response('discuss',initial(),{reply:'Ajloun is a good nature option.',knownFields:[],suggestedIds:['ajloun']}));await f.send('Tell me more');assert.equal(f.requests[1].payload.locale,'en');assert.ok(f.requests[1].payload.messages.some(message=>message.content==='بدي مكان فيه طبيعة'));assert.match(f.select('.nsh-messages').textContent,/Ajloun is a good/);assert.match(f.select('.nsh-response-actions').textContent,/Make a draft plan/);
 }finally{f.cleanup();}
});

test('the English downloaded plan keeps localized details and labels unconfirmed cost assumptions',async()=>{
 const f=await fixture({locale:'en'}),create=URL.createObjectURL;let blob;try{URL.createObjectURL=value=>{blob=value;return 'blob:nashmi-test';};f.api.open();await tick();f.select('.nsh-profile-form').dispatch('submit');await tick();f.button('Download plan').click();assert.ok(blob);const exported=JSON.parse(await blob.text());assert.equal(exported.planningAssumptions.locale,'en');assert.ok(exported.planningAssumptions.unconfirmedFields.includes('nationality'));assert.match(exported.planningAssumptions.notice,/conditional estimates/);assert.doesNotMatch(JSON.stringify(exported),/[\u0600-\u06ff]/);assert.deepEqual(exported.cost.total,f.api.getCurrentTrip().cost.total);
 }finally{URL.createObjectURL=create;f.cleanup();}
});

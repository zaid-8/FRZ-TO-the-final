import assert from 'node:assert/strict';
import {CATALOG} from '../public/js/catalog.js';
import {getLocale,setLocale,t,localizePlace,applyTranslations} from '../public/js/i18n.js';
import {CATALOG_EN,localizeCatalogPlace} from '../public/js/catalog-en.js';
import {placeHTML} from '../public/js/place-view.js';
const original=JSON.stringify(CATALOG);
assert.equal(getLocale(),'ar');
assert.equal(Object.keys(CATALOG_EN).length,18);
setLocale('en');
for(const place of CATALOG){
 const translated=localizePlace(place);
 for(const field of ['id','index','lat','lng','visitHours'])assert.equal(translated[field],place[field],`${place.id}: ${field} is preserved`);
 for(const field of ['jordanian','foreign','currency','source','checkedAt'])assert.equal(translated.entry[field],place.entry[field],`${place.id}: entry ${field} is unchanged`);
 assert.deepEqual(translated.entry.variants?.map(v=>v.amount),place.entry.variants?.map(v=>v.amount));
 assert.deepEqual(translated.activityFees?.map(f=>[f.id,f.jordanian,f.foreign,f.groupMin,f.groupMax]),place.activityFees?.map(f=>[f.id,f.jordanian,f.foreign,f.groupMin,f.groupMax]));
 for(const field of ['ar','tag','desc','small','place','time','caption','cat','about','terrain','best','before','history','hours','costNote'])assert(!/[\u0600-\u06ff]/.test(translated[field]),`${place.id}: ${field} is English`);
 assert(!/[\u0600-\u06ff]/.test(placeHTML(place).replace(/<[^>]*>/g,'')),`${place.id}: rendered details, conditional prices and optional activities are English`);
 assert.equal(localizeCatalogPlace(place,'ar'),place);
}
assert.equal(JSON.stringify(CATALOG),original,'Changing language never mutates source data');
const events=[];
globalThis.window={dispatchEvent:event=>events.push(event)};
globalThis.CustomEvent=class {constructor(type,{detail}){this.type=type;this.detail=detail;}};
const values=new Map();globalThis.localStorage={setItem:(k,v)=>values.set(k,v)};
function node(html,attributes){return {innerHTML:html,hasAttribute:key=>Object.hasOwn(attributes,key),getAttribute:key=>attributes[key],setAttribute:(key,value)=>attributes[key]=value,attributes};}
const heading=node('عنوان عربي',{'data-i18n-en':'English heading'}),input=node('',{'aria-label':'البحث','data-i18n-aria-label-en':'Search',placeholder:'مكان','data-i18n-placeholder-en':'Place'});
input.value='Petra';input.listener=()=>42;
globalThis.document={documentElement:{},querySelectorAll:()=>[heading,input]};
setLocale('ar');applyTranslations();
setLocale('en');
assert.equal(heading.innerHTML,'English heading');assert.equal(input.attributes['aria-label'],'Search');assert.equal(input.value,'Petra');assert.equal(input.listener(),42);
assert.equal(document.documentElement.dir,'ltr');assert.equal(document.documentElement.lang,'en');assert.equal(values.get('darb.language'),'en');assert.equal(events.at(-1).detail.locale,'en');assert.equal(events.at(-1).type,'darb:languagechange');
setLocale('ar');assert.equal(heading.innerHTML,'عنوان عربي');assert.equal(input.attributes.placeholder,'مكان');assert.equal(document.documentElement.dir,'rtl');assert.equal(t('عربي','English'),'عربي');
console.log('PASS: all 18 destinations render in English, exact fee values/variants/optional prices and raw catalog stay unchanged, explicit DOM labels switch both ways, input values/listeners are retained, locale persists and direction/event update. No browser rendering tested.');

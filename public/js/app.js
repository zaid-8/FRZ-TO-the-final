import {DATA,FILTERS,PLANS} from './destinations.js';
import {Journey} from './journey.js';
import {PhotoBackdrop,photoCredit} from './backdrop.js';
import {STORAGE_KEY,readPlan,moveStop,filterDestinations} from './plan.js';
import {clamp,smooth} from './math.js';
import {initNashmi} from './nashmi.js';
import {initCloudUI} from './cloud-ui.js';
import {renderRouteMap} from './route-map.js';
import {initScenicMap} from './scenic-map.js';
import {placeHTML,escapeHTML as e} from './place-view.js';
import './theme.js';
import {getLocale,t,setLocale,localizePlace,applyTranslations} from './i18n.js';
import {PLANS_EN} from './catalog-en.js';
applyTranslations();

const $=id=>document.getElementById(id),byId=id=>localizePlace(DATA.find(d=>d.id===id)),last=DATA.length-1;
const number=i=>String(i+1).padStart(2,'0'),backdrop=new PhotoBackdrop();
let storage;try{storage=localStorage;}catch{}
let plan=readPlan(storage,DATA.map(d=>d.id)),active=0,filter='all',expanded=false;
let staticMode=matchMedia('(prefers-reduced-motion: reduce)').matches,journey=null,toastTimer,planMapCleanup,detailMapCleanup,detailPlace,browseMapCleanup,lastState={q:0};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollTo=id=>$(id).scrollIntoView({behavior:reduced()?'instant':'smooth'});
const nashmi=initNashmi({catalog:DATA,onSaveTrip(trip){
  const ids=trip.days.flatMap(day=>day.stops.map(stop=>stop.id)).filter(id=>byId(id));
  plan=[...new Set([...plan,...ids])];save();toast(t('انحفظت الرحلة وانضافت محطاتها لرحلتي','Your journey was saved and its stops added to your plan'));
},onVisit(id){const d=byId(id);if(d)go(d.index);}});
const cloud=initCloudUI({catalog:DATA,getSavedIds:()=>[...plan],getCurrentTrip:()=>nashmi.getCurrentTrip(),onLoadTrip:(profile,ids)=>nashmi.loadTripProfile(profile,ids),onLoadPlan(ids){plan=[...ids];save();toast(t('تم استرجاع رحلتك من الحساب','Your journey was restored from your account'));}});

function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2700);}
function save(){try{storage.setItem(STORAGE_KEY,JSON.stringify(plan));}catch{$('storage-note').textContent=t('التخزين غير متاح بهذا المتصفح. نزّل خطتك للاحتفاظ فيها.','Browser storage is unavailable. Download your plan to keep a copy.');}renderPlan();refreshAdds();}
function toggleAdd(id){if(!byId(id))return;const exists=plan.includes(id);plan=exists?plan.filter(x=>x!==id):[...plan,id];save();toast(exists?t('انشالت ','Removed ')+byId(id).ar+t(' من خطتك',' from your plan'):t('انضافت ','Added ')+byId(id).ar+t(' لرحلتك',' to your journey'));}
function refreshAdds(){
 document.querySelectorAll('[data-add]').forEach(btn=>{const d=byId(btn.dataset.add);if(!d)return;const yes=plan.includes(d.id);btn.textContent=yes?'✓':'+';btn.setAttribute('aria-pressed',String(yes));btn.setAttribute('aria-label',(yes?t('إزالة ','Remove '):t('أضف ','Add '))+d.ar+(yes?t(' من رحلتي',' from my journey'):t(' لرحلتي',' to my journey')));});
 const d=localizePlace(DATA[active]),yes=plan.includes(d.id);$('hero-add').textContent=yes?'✓':'+';$('hero-add').setAttribute('aria-pressed',String(yes));$('hero-add').setAttribute('aria-label',(yes?t('إزالة ','Remove '):t('أضف ','Add '))+d.ar+(yes?t(' من رحلتي',' from my journey'):t(' لرحلتي',' to my journey')));
 $('plan-count').textContent=plan.length;$('saved-count').textContent=plan.length;
 const detail=$('detail-add');if(detail)detail.textContent=plan.includes(detail.dataset.id)?t('إزالة من رحلتي −','Remove from my journey −'):t('أضف لرحلتي +','Add to my journey +');
}
function renderPlan(preserveMap=false){
 const empty=plan.length===0;$('empty-plan').hidden=!empty;$('clear-plan').hidden=empty;$('export-plan').disabled=empty;
 $('saved-list').innerHTML=plan.map((id,i)=>{const d=byId(id);return `<li class="saved-item"><img src="${e(d.image)}" alt="" loading="lazy"><div><h4>${number(i)} · ${e(d.ar)}</h4><p>${e(d.time)} · ${t('وقت مقترح','suggested duration')}</p><button class="text-button" data-details="${id}">${t('تفاصيل المكان ↗','Place details ↗')}</button></div><div class="saved-actions"><button data-move="${id}" data-direction="-1" aria-label="${t('قدّم','Move up')} ${e(d.ar)}" ${i===0?'disabled':''}>↑</button><button data-move="${id}" data-direction="1" aria-label="${t('أخّر','Move down')} ${e(d.ar)}" ${i===plan.length-1?'disabled':''}>↓</button><button data-remove="${id}" aria-label="${t('إزالة','Remove')} ${e(d.ar)}">×</button></div></li>`;}).join('');
 if(preserveMap)return;
 planMapCleanup?.();planMapCleanup=null;$('saved-map-wrap').hidden=empty;
 if(!empty)planMapCleanup=renderRouteMap($('saved-map'),plan.map(id=>{const d=byId(id);return {id,lat:d.lat,lng:d.lng,name:d.ar};}),{interactive:true});
}
const entrySummary=d=>{const entry=d.entry||{},format=value=>new Intl.NumberFormat(getLocale()==='en'?'en-JO':'ar-JO',{maximumFractionDigits:2}).format(value);return Number.isFinite(entry.jordanian)&&Number.isFinite(entry.foreign)?`${t('أردني','Jordanian')} ${format(entry.jordanian)} · ${entry.foreignCondition?t('أجنبي مبيت (يوم واحد)','Foreign overnight visitor (1 day)'):t('أجنبي','Foreign')} ${format(entry.foreign)} ${t('د.أ','JOD')} — ${entry.scope}`:t('حسب التجربة وفئة الزائر؛ التفاصيل من الجهة المشغّلة','Depends on the experience and visitor category; confirm with the operator');};
function renderCards(){
 const results=filterDestinations(DATA,FILTERS,filter,$('search').value);
 const featured=['ajloun','petra','rum','aqaba'];
 const shown=expanded?results:filter==='all'&&!$('search').value.trim()?featured.map(byId):results.slice(0,4);
 $('destination-grid').innerHTML=shown.map(d=>localizePlace(d)).map(d=>`<article class="destination-card"><div class="card-visual"><div class="card-image"><button data-details="${d.id}" aria-label="${t('استكشف','Explore')} ${e(d.ar)}"><img src="${e(d.image)}" alt="${e(d.gallery[0]?.alt||d.ar)}" loading="lazy" width="800" height="600"></button><span class="card-counter" dir="ltr">${number(d.index)} / ${DATA.length}</span><span class="card-image-name" dir="ltr">${e(d.en)}</span></div>${photoCredit(d)}</div><div class="card-content"><div class="card-meta"><span>${e(d.place)}</span><span>${e(d.cat)}</span></div><div class="card-title"><h3>${e(d.ar)}</h3><button class="add-circle" data-add="${d.id}">+</button></div><p>${e(d.desc.replaceAll('\n',' '))}</p><dl class="card-facts"><div><dt><span aria-hidden="true">☀</span> ${t('أفضل وقت','Best time')}</dt><dd>${e(d.best)}</dd></div><div><dt><span aria-hidden="true">◷</span> ${t('وقت الزيارة','Visit duration')}</dt><dd>${e(d.time)} · ${t('وقت مقترح','suggested duration')}</dd></div><div><dt><span aria-hidden="true">↗</span> ${t('مواعيد الدخول','Opening hours')}</dt><dd>${e(d.hours||t('راجع الجهة المشغّلة قبل الزيارة.','Confirm with the operator before visiting.'))}</dd></div><div><dt><span aria-hidden="true">◇</span> ${t('رسوم المعلم','Admission')}</dt><dd>${e(entrySummary(d))}</dd></div></dl><div class="card-actions"><button class="text-button" data-details="${d.id}">${t('التفاصيل والرسوم ↗','Details and fees ↗')}</button><a class="text-button" href="${e(d.map)}" target="_blank" rel="noopener noreferrer">${t('الموقع على الخريطة ↗','View on the map ↗')}</a></div></div></article>`).join('');
 $('show-all').hidden=expanded||results.length<=4;$('empty-search').hidden=results.length!==0;$('result-count').textContent=t(`${results.length} وجهة مطابقة`,`${results.length} matching destinations`);refreshAdds();
}
function renderBrowseMap(id,preserveMap=false){
 const d=byId(id)||localizePlace(DATA[0]);if(!preserveMap)browseMapCleanup?.();
 $('browse-map-select').value=d.id;$('browse-map-region').textContent=d.place;$('browse-map-title').textContent=d.ar;$('browse-map-description').textContent=d.desc.replaceAll('\n',' ');$('browse-map-link').href=d.map;$('browse-map-details').onclick=()=>details(d.id);
 if(!preserveMap)browseMapCleanup=renderRouteMap($('browse-map'),[{id:d.id,name:d.ar,lat:d.lat,lng:d.lng}],{interactive:true});
 $('browse-map').querySelector('.darb-route-map__heading strong').textContent=t('موقع الوجهة','Destination location');
 $('browse-map').querySelector('.darb-route-map__note').textContent=t('حرّك الخريطة أو كبّرها لاستكشاف محيط المكان.','Move or zoom the map to explore the surrounding area.');
}
function setFilter(value){filter=value;expanded=true;document.querySelectorAll('[data-filter]').forEach(b=>{const yes=b.dataset.filter===value;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});renderCards();}
function details(id,preserveMap=false){
 const d=byId(id);if(!d)return;const retainedMap=preserveMap?$('place-map'):null;if(!preserveMap)detailMapCleanup?.();detailPlace=d;$('place-body').innerHTML=placeHTML(d);if(retainedMap)$('place-map').replaceWith(retainedMap);
 $('detail-add').onclick=()=>toggleAdd(d.id);$('detail-nashmi').onclick=()=>{$('place-dialog').close();nashmi.setActiveDestination(d.id);nashmi.open({mustVisit:[d.id]});};refreshAdds();
 if(!$('place-dialog').open)$('place-dialog').showModal();$('place-dialog').scrollTop=0;
 if(!preserveMap)detailMapCleanup=renderRouteMap($('place-map'),[{id:d.id,name:d.ar,lat:d.lat,lng:d.lng}],{interactive:true});
}
function update(state){
 lastState=state;backdrop.paint(state);const q=state.q,index=Math.max(0,Math.min(last,Math.round(q))),d=localizePlace(DATA[index]);
 if(index!==active||!$('hero-heading').dataset.initialized){
  active=index;$('hero-heading').dataset.initialized='true';$('hero-heading').innerHTML=index===0?t('اكتشف الأردن<br><span>من منظور جديد.</span>','Discover Jordan<br><span>From a new perspective.</span>'):e(d.ar);$('hero-copy').classList.toggle('is-destination',index!==0);
  $('chapter-tag').textContent=d.tag;$('hero-desc').textContent=index===0?t('طبيعة، تاريخ، ومغامرة. من خضرة عجلون لنجوم وادي رم، اختار دربك وخلّي الحكاية تبدأ.','Nature, history and adventure. From the green hills of Ajloun to the stars of Wadi Rum, choose your path and let the story begin.'):d.desc.replaceAll('\n',' ');
  $('chapter-number').textContent=number(index);$('chapter-name').textContent=d.ar;$('chapter-region').textContent=d.place.split('·')[1]||d.place;
  $('landmark-en').textContent=d.en;$('landmark-ar').textContent=index===0?t('عجلون، حيث تبدأ الحكاية','Ajloun, where your story begins'):d.tag;
  $('station-select').value=String(index);$('route-current').textContent=number(index);
  document.querySelectorAll('.station').forEach((b,i)=>i===index?b.setAttribute('aria-current','step'):b.removeAttribute('aria-current'));nashmi.setActiveDestination(d.id);refreshAdds();
 }
 $('start').innerHTML=!staticMode&&index===0&&(state.departure||0)<.99?t('ابدأ جولة التلفريك <span aria-hidden="true">←</span>','Start the cable car journey <span aria-hidden="true">→</span>'):index===last?t('كمّل على الخريطة <span aria-hidden="true">↓</span>','Continue on the map <span aria-hidden="true">↓</span>'):t('المحطة التالية <span aria-hidden="true">←</span>','Next stop <span aria-hidden="true">→</span>');
 const departureOpacity=index===0?1-smooth(((state.departure||0)-.15)/.6):0;$('station-reference').style.opacity=String(departureOpacity);$('departure-status').style.opacity=String(departureOpacity);
 const fade=staticMode?1:1-smooth((Math.abs(q-index)-.30)/.20);$('hero-copy').style.opacity=String(fade);$('hero-copy').style.transform=`translateY(${(1-fade)*8}px)`;$('hero-copy').inert=fade<.2;$('landmark-ar').parentElement.style.opacity=String(fade*.72);$('route-fill').style.width=(q/last*100)+'%';
 const showCue=!staticMode&&q===0&&(state.departure||0)<.15;$('scroll-cue').hidden=!showCue;$('scroll-cue').inert=!showCue;
}
function poster(d){$('fallback-image').src=d.image;$('fallback-image').alt=t('صورة فوتوغرافية لـ','Photograph of ')+d.ar;$('fallback-image').style.objectPosition='50% 50%';}
function go(index){index=clamp(Number(index)||0,0,last);if(staticMode){poster(localizePlace(DATA[index]));update({q:index});$('journey').scrollIntoView({behavior:'instant'});}else journey?.go(index);}
async function useStatic(value,reason=''){
 staticMode=value;if(journey)journey.reduced=value;document.body.classList.toggle('static-mode',value);$('motion-toggle').setAttribute('aria-pressed',String(value));$('motion-toggle').textContent=value?t('تفعيل الحركة ◒','Enable motion ◒'):t('عرض هادئ ◒','Quiet view ◒');$('fallback-note').hidden=!value;
 if(value){journey?.stop();$('loading').hidden=true;poster(localizePlace(DATA[active]));$('fallback-note').textContent=reason?t('العرض الهادئ متاح · اختار وجهتك من المحطات','Quiet view is available · Choose a destination from the stops'):t('عرض هادئ · اختار وجهتك من المحطات','Quiet view · Choose a destination from the stops');update({q:active});if(!reason)$('journey').scrollIntoView({behavior:'instant'});}
 else if(journey?.ready&&!journey.contextLost){document.body.classList.add('ready');journey.resize();journey.go(active,true);}else await initJourney(active);
}
async function initJourney(initialIndex=null){
 journey?.destroy();$('loading').hidden=false;journey=new Journey({canvas:$('scene'),section:$('journey'),scrollDriven:true,scrollInset:document.querySelector('.site-header').offsetHeight,onUpdate:state=>{if(!staticMode)update(state);},onLoad:p=>{$('loading-text').textContent=p===null?t('تحميل نموذج التلفريك…','Loading the cable car model…'):p<1?t(`تحميل التلفريك ${Math.round(p*100)}٪`,`Loading cable car ${Math.round(p*100)}%`):t('تحضير المشهد…','Preparing the scene…');},onFailure:()=>useStatic(true,'unavailable')});
 await journey.init(initialIndex);if(journey.ready){document.body.classList.add('ready');$('loading').hidden=true;journey.resize();}
}
$('journey').style.setProperty('--journey-height',`${(DATA.length+1)*110}svh`);
function renderNavigation(){
$('browse-map-select').innerHTML=DATA.map(d=>localizePlace(d)).map(d=>`<option value="${d.id}">${e(d.ar)}</option>`).join('');
$('route-total').textContent=DATA.length;$('destination-total').textContent=DATA.length+t(' وجهة. ألف حكاية.',' destinations. A thousand stories.');
$('station-select').innerHTML=DATA.map(d=>localizePlace(d)).map(d=>`<option value="${d.index}">${number(d.index)} · ${e(d.ar)}</option>`).join('');
$('route-track').querySelectorAll('.station').forEach(node=>node.remove());$('route-track').insertAdjacentHTML('beforeend',DATA.map(d=>localizePlace(d)).map(d=>`<button class="station" data-station="${d.index}" aria-label="${number(d.index)} ${e(d.ar)}"><span>${e(d.ar)}</span></button>`).join(''));
$('plan-presets').innerHTML=Object.entries(PLANS).map(([key,raw],i)=>{const p=getLocale()==='en'?{...raw,...PLANS_EN[key]}:raw;return `<article class="preset"><div class="preset-photo"><img src="${e(p.image)}" alt="${e(p.title)}" loading="lazy"><span class="preset-number" aria-hidden="true">0${i+1}</span></div><p class="eyebrow">${e(p.days)}</p><h3>${e(p.title)}</h3><p>${e(p.subtitle)}</p><p class="preset-route">${p.items.map(it=>e(byId(it[1]).ar)).join(t(' ← ',' → '))}</p><button class="text-button" data-preset="${key}">${t('احفظ الأماكن +','Save these places +')}</button></article>`;}).join('');

}
renderNavigation();$('browse-map-select').onchange=event=>renderBrowseMap(event.target.value);renderBrowseMap('ajloun');

document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.add)toggleAdd(b.dataset.add);if(b.dataset.details)details(b.dataset.details);
 if(b.dataset.station!==undefined)go(b.dataset.station);
 if(b.dataset.visit!==undefined){$('place-dialog').close();go(b.dataset.visit);}
 if(b.dataset.filter)setFilter(b.dataset.filter);if(b.hasAttribute('data-close'))b.closest('dialog').close();
 if(b.dataset.gallery!==undefined&&detailPlace){const p=detailPlace.gallery[Number(b.dataset.gallery)];if(p){$('place-main-photo').classList.remove('image-failed');$('place-main-photo').src=p.src;$('place-main-photo').alt=p.alt;document.querySelectorAll('[data-gallery]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));}}
 if(b.dataset.remove){plan=plan.filter(id=>id!==b.dataset.remove);save();toast(t('تم تحديث خطتك','Your plan was updated'));}
 if(b.dataset.move){plan=moveStop(plan,b.dataset.move,Number(b.dataset.direction));save();const same=document.querySelector(`[data-move="${b.dataset.move}"][data-direction="${b.dataset.direction}"]`);if(same&&!same.disabled)same.focus();}
 if(b.dataset.preset){plan=[...new Set([...plan,...PLANS[b.dataset.preset].items.map(i=>i[1])])];save();toast(t('انضافت الأماكن لخطتك','Places were added to your plan'));scrollTo('planner');}
});
$('search').addEventListener('input',()=>{expanded=true;renderCards();});$('show-all').onclick=()=>{expanded=true;renderCards();};
$('hero-add').onclick=()=>toggleAdd(DATA[active].id);$('detail').onclick=()=>details(DATA[active].id);
$('start').onclick=()=>active===last?scrollTo('scenic-map'):!staticMode&&active===0&&(journey?.state?.departure||0)<.99?journey?.depart():go(active+1);
$('scroll-cue').onclick=()=>staticMode?go(1):journey?.depart();$('station-select').onchange=event=>go(event.target.value);$('restart').onclick=()=>go(0);$('motion-toggle').onclick=()=>useStatic(!staticMode);
$('planner-nashmi').onclick=()=>nashmi.open({mustVisit:plan});
$('clear-plan').onclick=()=>{plan=[];save();toast(t('تم إفراغ الخطة','Your plan was cleared'));};
$('export-plan').onclick=()=>{
 const content=t('درب — لكل درب حكاية\nخطتي عبر الأردن\n\n','DARB — Every path, a story\nMy journey through Jordan\n\n')+plan.map((id,i)=>{const d=byId(id);return `${i+1}. ${d.ar} — ${d.time}\n${d.map}\n${t('المصدر','Source')}: ${d.source}\n${d.before}`;}).join('\n\n')+t('\n\nقائمة أماكن شخصية؛ ليست جدولًا محسوبًا أو حجزًا. اسأل نشمي لترتيب الأيام والتكاليف.\n','\n\nA personal list of places, not a timed itinerary or booking. Ask Nashmi to arrange days and costs.\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+content],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='DARB-My-Journey.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('place-dialog').addEventListener('close',()=>{detailMapCleanup?.();detailMapCleanup=null;});
$('place-dialog').addEventListener('click',event=>{const dialog=$('place-dialog');if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
window.addEventListener('scroll',()=>{if(!staticMode)journey?.readScroll();},{passive:true});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(journey){journey.scrollInset=document.querySelector('.site-header').offsetHeight;journey.resize();}},100);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)journey?.stop();else if(!staticMode)journey?.wake();});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){plan=readPlan(storage,DATA.map(d=>d.id));renderPlan();refreshAdds();}});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches)useStatic(true);});
document.addEventListener('keydown',event=>{if(event.target.closest?.('dialog[open]')||/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(event.target.tagName)||event.altKey||event.ctrlKey||event.metaKey)return;const r=$('stage').getBoundingClientRect(),headerBottom=document.querySelector('.site-header').getBoundingClientRect().bottom;if(r.bottom<innerHeight*.5||r.top>headerBottom+1)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();go(active+(event.key===(getLocale()==='ar'?'ArrowLeft':'ArrowRight')?1:-1));}});
document.addEventListener('error',event=>{if(event.target.tagName==='IMG'&&!event.target.classList.contains('darb-route-map__tile')){event.target.classList.add('image-failed');event.target.alt=t('تعذّر تحميل الصورة','Could not load this photo');const frame=event.target.closest('.card-image');if(frame)frame.dataset.imageError=t('تعذّر تحميل الصورة','Could not load this photo');}},true);
if(typeof IntersectionObserver!=='undefined'){const stageObserver=new IntersectionObserver(entries=>{document.body.classList.toggle('journey-visible',entries[0].isIntersecting);});stageObserver.observe($('stage'));}
window.addEventListener('pagehide',()=>journey?.stop());
const scenicMap=initScenicMap($('scenic-map'),{onDetails:id=>details(id),isAdded:id=>plan.includes(id),onAdd:id=>{toggleAdd(id);return plan.includes(id);},onNashmi:id=>{nashmi.setActiveDestination(id);nashmi.open({mustVisit:[id]});}});
renderCards();renderPlan();refreshAdds();update({q:0});if(staticMode)useStatic(true);else initJourney();
window.DARB={get status(){return {active:DATA[active].id,progress:journey?.current??active/last,staticMode,scrollTour:!staticMode,scenicMap:scenicMap?.getState(),plan:[...plan],renderer:journey?.renderer?.metrics,chapters:[...journey?.chapters.keys()||[]],cabinAnchor:journey?.state?.anchor};}};

function refreshLanguageButton(){$('motion-toggle').textContent=staticMode?t('تفعيل الحركة ◒','Enable motion ◒'):t('عرض هادئ ◒','Quiet view ◒');const button=$('language-toggle');button.textContent=getLocale()==='ar'?'EN':'عربي';button.lang=getLocale()==='ar'?'en':'ar';button.setAttribute('aria-label',getLocale()==='ar'?'Switch to English':'التبديل إلى العربية');}
$('language-toggle').onclick=()=>setLocale(getLocale()==='ar'?'en':'ar');refreshLanguageButton();
window.addEventListener('darb:languagechange',()=>{
 const mapId=$('browse-map-select').value,dialogOpen=$('place-dialog').open,dialogId=detailPlace?.id,dialogScroll=$('place-dialog').scrollTop,selectedPhoto=document.querySelector('[data-gallery][aria-pressed="true"]')?.dataset.gallery,openFees=[...document.querySelectorAll('.activity-fee[open]')].map(node=>node.dataset.fee);
 refreshLanguageButton();renderNavigation();renderCards();renderPlan(true);renderBrowseMap(mapId,true);
 delete $('hero-heading').dataset.initialized;update(lastState);
 $('motion-toggle').textContent=staticMode?t('تفعيل الحركة ◒','Enable motion ◒'):t('عرض هادئ ◒','Quiet view ◒');$('fallback-note').textContent=t('عرض هادئ · اختار وجهتك من المحطات','Quiet view · Choose a destination from the stops');
 if(staticMode)poster(localizePlace(DATA[active]));
 if(dialogOpen&&dialogId){details(dialogId,true);openFees.forEach(id=>document.querySelector(`[data-fee="${id}"]`)?.setAttribute('open',''));if(selectedPhoto)document.querySelector(`[data-gallery="${selectedPhoto}"]`)?.click();$('place-dialog').scrollTop=dialogScroll;}
 if(journey){journey.scrollInset=document.querySelector('.site-header').offsetHeight;journey.resize();}
});

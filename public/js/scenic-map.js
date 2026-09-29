import {CATALOG_BY_ID} from './catalog.js';
import {SCENIC_STOPS} from './scenic-map-data.js';
import {createScenicJourney} from './scenic-map-core.js';
import {ScenicAtlas} from './scenic-map-atlas.js';
import {ScenicTerrain} from './scenic-map-terrain.js';
import {getLocale,t,localizePlace} from './i18n.js';

const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
const make=(tag,className='',text)=>{const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=String(text);return node;};
const append=(parent,...children)=>{parent.append(...children.filter(Boolean));return parent;};
const button=(className,action)=>{const node=make('button',className);node.type='button';if(action)node.addEventListener('click',action);return node;};
const safeLink=value=>{try{const url=new URL(value,location.href);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}};
const link=(label,url)=>{const node=make('a','',label),href=safeLink(url);if(href){node.href=href;node.target='_blank';node.rel='noopener noreferrer';}return node;};
const copy=value=>typeof value==='string'?value:value?.[getLocale()]||value?.ar||'';
const placeNameFor=stop=>localizePlace(CATALOG_BY_ID[stop.id],getLocale()).ar;

export function scenicScrollProgress({scrollY,sectionTop,sectionHeight,stageHeight,headerHeight=0}){
 const distance=Math.max(1,sectionHeight-stageHeight);
 return clamp((scrollY-sectionTop+headerHeight)/distance);
}

export function initScenicMap(section,{onDetails=()=>{},onAdd=()=>{},onNashmi,isAdded=()=>false}={}){
 if(!section)return null;
 if(section.dataset.scmReady==='true')throw new Error('Scenic map is already initialized');
 section.dataset.scmReady='true';
 section.classList.add('scenic-map');
 const journey=createScenicJourney(SCENIC_STOPS),preference=matchMedia('(prefers-reduced-motion: reduce)');
 const listeners=[],labelNodes=[],stopButtons=[],aborter=new AbortController();
 let disposed=false,collapsed=false,motionOpted=false,forceCalm=false,reduced=preference.matches,visible=false,warm=false,raf=0,dirty=true,atlas=null,terrain=null,loading=null,terrainStarted=false,terrainActive=false,geographyData=null,status={mode:'loading',ready:false},manualProgress=0,currentProgress=0,currentState=journey.state(0),stableIndex=-1,cardIndex=-1,lastAnnounced=-1,width=1,height=1,headerHeight=0,theme=document.documentElement.dataset.theme||'dark';
 const stage=make('div','scm-stage');stage.setAttribute('tabindex','0');stage.setAttribute('role','group');
 const visual=make('div','scm-visual'),canvas=make('canvas','scm-atlas'),terrainHost=make('div','scm-terrain'),labels=make('div','scm-labels');
 canvas.setAttribute('aria-hidden','true');terrainHost.setAttribute('aria-hidden','true');labels.setAttribute('aria-hidden','true');append(visual,canvas,terrainHost,labels);
 const topbar=make('div','scm-topbar'),heading=make('div','scm-heading'),eyebrow=make('p','scm-eyebrow'),title=make('h2');title.id='scenic-map-title';const intro=make('p','scm-intro');append(heading,eyebrow,title,intro);
 const skipButton=button('scm-skip',skip),motionButton=button('scm-enable-motion',toggleMotion),topActions=append(make('div','scm-top-actions'),skipButton,motionButton);append(topbar,heading,topActions);
 const hud=make('div','scm-hud'),governorate=make('p','scm-governorate'),activeName=make('h3','scm-active-name'),flightNote=make('p','scm-flight-note');append(hud,governorate,activeName,flightNote);
 const card=make('article','scm-card'),figure=make('figure','scm-photo'),photo=make('img'),photoCredit=make('figcaption','scm-photo-credit');photo.loading='lazy';photo.decoding='async';photo.width=800;photo.height=600;append(figure,photo,photoCredit);
 const cardBody=make('div','scm-card-content'),placeTag=make('p','scm-place-tag'),placeName=make('h3','scm-place-name'),description=make('p','scm-place-description'),coordinateNote=make('p','scm-coordinate-note'),cardActions=make('div','scm-card-actions');
 const detailButton=button('scm-details',()=>act(onDetails)),addButton=button('scm-add',()=>{if(stableIndex<0)return;const id=SCENIC_STOPS[stableIndex].id,result=onAdd(id);updateAdd(typeof result==='boolean'?result:undefined);}),nashmiButton=typeof onNashmi==='function'?button('scm-nashmi',()=>act(onNashmi)):null;
 append(cardActions,detailButton,addButton,nashmiButton);append(cardBody,placeTag,placeName,description,coordinateNote,cardActions);append(card,figure,cardBody);card.hidden=true;
 const controls=make('div','scm-controls'),previous=button('scm-prev',()=>move(-1)),next=button('scm-next',()=>move(1)),overview=button('scm-overview',()=>go(0));
 const progress=make('input','scm-progress');progress.type='range';progress.min='0';progress.max='1000';progress.step='1';progress.value='0';append(controls,previous,progress,next);
 const picker=make('details','scm-picker'),pickerSummary=make('summary'),stops=make('nav','scm-stops');append(picker,pickerSummary,stops);
 for(const [index,stop]of SCENIC_STOPS.entries()){
  const option=button('scm-stop',()=>{pickerSummary.focus({preventScroll:true});picker.open=false;go(journey.stopProgress(index));});option.dataset.scmId=stop.id;stops.append(option);stopButtons.push(option);
  const label=make('div','scm-label');label.append(make('span'));labels.append(label);labelNodes.push(label);
 }
 const statusBox=make('div','scm-status'),statusText=make('span','scm-status-text'),retry=button('scm-retry',()=>{if(!disposed&&!collapsed){warm=true;ensureLoaded(true);}});append(statusBox,statusText,retry);
 const attribution=make('div','scm-attribution'),announcer=make('p','scm-announcer');announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');announcer.setAttribute('aria-atomic','true');
 append(stage,visual,topbar,hud,card,controls,overview,picker,statusBox,attribution,announcer);
 const collapsedPanel=make('div','scm-collapsed-panel'),collapsedTitle=make('h3'),collapsedText=make('p'),replayButton=button('scm-replay',replay);collapsedPanel.hidden=true;append(collapsedPanel,collapsedTitle,collapsedText,replayButton);
 section.replaceChildren(stage,collapsedPanel);
 const header=document.querySelector('.site-header');
 function listen(target,type,handler,options){target?.addEventListener(type,handler,options);listeners.push(()=>target?.removeEventListener(type,handler,options));}
 function act(callback){if(stableIndex<0||collapsed)return;callback(SCENIC_STOPS[stableIndex].id);}
 function updateAdd(override){if(stableIndex<0)return;const added=typeof override==='boolean'?override:Boolean(isAdded(SCENIC_STOPS[stableIndex].id));addButton.textContent=added?t('إزالة من رحلتي −','Remove from My Trip −'):t('أضف لرحلتي +','Add to My Trip +');addButton.setAttribute('aria-pressed',String(added));}
 function updateStatus(){
  const mode=status.mode;
  statusText.textContent=mode==='overview'?t('عرض هادئ للخريطة · اختر المعالم من القائمة.','Calm map view · Choose landmarks from the list.'):mode==='loading'?t('عم نجهّز المشهد الجغرافي…','Preparing the landscape…'):mode==='offline'?t('خريطة مبسّطة متاحة؛ المشهد الجوي غير متاح حاليًا.','Map overview available; aerial imagery is currently unavailable.'):mode==='satellite'?t('صور جوية؛ بيانات الارتفاع غير متاحة.','Aerial imagery; elevation data is unavailable.'):t('تضاريس وصور جوية · العرض حسب توفر البيانات.','Terrain and aerial imagery · Subject to data availability.');
  retry.hidden=reduced||mode==='loading'||mode==='terrain';retry.disabled=Boolean(loading);
  section.dataset.renderer=mode;
 }
 function applyLanguage(){
  section.dir=getLocale()==='en'?'ltr':'rtl';stage.setAttribute('aria-label',t('رحلة الأردن على الخريطة؛ استخدم التمرير أو اختار معلمًا.','Jordan map journey; scroll or choose a landmark.'));
  eyebrow.textContent=t('من التلفريك إلى تضاريس الأردن','FROM THE CABLE CAR TO JORDAN’S LANDSCAPE');title.textContent=t('كمّل الدرب على الخريطة','Follow the journey across Jordan');intro.textContent=reduced?t('اختار معلمًا واكتشف موقعه. الحركة السينمائية اختيارية.','Choose a landmark to explore its location. Cinematic motion is optional.'):t('انزل بالصفحة لتطير بين المعالم، واطلع لترجع على نفس الدرب.','Scroll down to travel between landmarks. Scroll up to retrace the route.');
  skipButton.textContent=t('تجاوز الخريطة للوجهات ↓','Skip map to destinations ↓');motionButton.textContent=reduced?t('فعّل رحلة التمرير','Enable scroll journey'):t('عرض هادئ','Use calm view');motionButton.setAttribute('aria-pressed',String(!reduced));
  detailButton.textContent=t('التفاصيل والرسوم ↗','Details and fees ↗');if(nashmiButton)nashmiButton.textContent=t('اسأل نشمي','Ask Nashmi');
  previous.textContent=t('السابق','Previous');next.textContent=t('التالي','Next');overview.textContent=t('الأردن كامل','Jordan overview');progress.setAttribute('aria-label',t('تقدّم الرحلة الجغرافية','Geographic journey progress'));
  pickerSummary.textContent=t('اختار معلمًا','Choose a landmark');stops.setAttribute('aria-label',t('معالم الرحلة الثمانية عشر','All eighteen journey landmarks'));
  SCENIC_STOPS.forEach((stop,index)=>{stopButtons[index].textContent=placeNameFor(stop);stopButtons[index].setAttribute('aria-label',`${copy(stop.focus)} · ${copy(stop.governorate)}`);labelNodes[index].firstElementChild.textContent=placeNameFor(stop);});
  retry.textContent=t('أعد تحميل المشهد','Retry landscape');collapsedTitle.textContent=t('الخريطة جاهزة وقت ما تحب','The map is here whenever you like');collapsedText.textContent=t('تجاوزت رحلة الخريطة. كمل استكشاف الوجهات، أو ارجع شوفها.','You skipped the map journey. Explore the destinations or replay it.');replayButton.textContent=t('أعد رحلة الخريطة ↑','Replay the map journey ↑');
  attribution.replaceChildren(link(t('مصادر الصور والخرائط','Map and image credits'),'credits.html#scenic-map-credits'));
  updateStatus();cardIndex=-1;lastAnnounced=-1;dirty=true;paintIfVisible();
 }
 function measure(){
  const nextHeader=Math.max(0,header?.getBoundingClientRect().height||0);if(nextHeader!==headerHeight){headerHeight=nextHeader;section.style.setProperty('--scm-header-offset',`${headerHeight}px`);}
  const rect=visual.getBoundingClientRect();if(rect.width>0&&rect.height>0){width=rect.width;height=rect.height;atlas?.resize(width,height,Math.min(2,globalThis.devicePixelRatio||1));terrain?.resize(width,height);}
  syncActivity();dirty=true;paintIfVisible();
 }
 function geometry(){const rect=section.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();return {scrollY:window.scrollY||0,sectionTop:rect.top+(window.scrollY||0),sectionHeight:rect.height,stageHeight:stageRect.height,headerHeight};}
 function readProgress(){return reduced?manualProgress:scenicScrollProgress(geometry());}
 function setTerrainActive(active){const next=Boolean(active);if(next===terrainActive)return;terrainActive=next;terrain?.setActive(next);}
 function syncActivity(){const rect=stage.getBoundingClientRect();visible=!disposed&&!collapsed&&!document.hidden&&rect.bottom>headerHeight&&rect.top<innerHeight;setTerrainActive(visible&&!reduced);if(!visible&&raf){cancelAnimationFrame(raf);raf=0;}return visible;}
 function paintIfVisible(){if(disposed||collapsed||document.hidden||!visible)return;if(!raf)raf=requestAnimationFrame(paint);}
 function scrollChanged(){if(disposed)return;syncActivity();if(visible){dirty=true;paintIfVisible();}}
 function setStatus(value){if(disposed)return;status=typeof value==='string'?{mode:value,ready:value==='terrain'||value==='satellite'}:value;updateStatus();dirty=true;syncActivity();paintIfVisible();}
 async function ensureLoaded(force=false){
  if(disposed||collapsed)return;
  if(loading)return loading;
  if(atlas){if(!reduced&&(force||!terrainStarted)){if(!terrain&&geographyData){terrain=new ScenicTerrain(terrainHost,geographyData,journey,{onStatus:setStatus,active:false});terrainActive=false;terrain.resize(width,height);}terrainStarted=true;setTerrainActive(visible);Promise.resolve(terrain?.start()).catch(()=>setStatus({mode:'offline',ready:false}));}return;}
  setStatus({mode:'loading',ready:false});
  loading=(async()=>{
   const empty={type:'FeatureCollection',features:[]},request=new AbortController(),cancel=()=>request.abort();aborter.signal.addEventListener('abort',cancel,{once:true});const timeout=setTimeout(cancel,8000);
   const load=async file=>{const response=await fetch(new URL(`../data/${file}`,import.meta.url),{signal:request.signal,credentials:'same-origin'});if(!response.ok)throw new Error('Geography unavailable');return response.json();};
   const results=await Promise.allSettled([load('jordan-geography.json'),load('jordan-governorates.json')]);clearTimeout(timeout);aborter.signal.removeEventListener('abort',cancel);
   if(disposed)return;
   const geography=geographyData={country:results[0].status==='fulfilled'?results[0].value:empty,administrative:results[1].status==='fulfilled'?results[1].value:empty};
   try{atlas=new ScenicAtlas(canvas,geography,journey);}catch{atlas=null;}
   if(!collapsed&&!reduced)try{terrain=new ScenicTerrain(terrainHost,geography,journey,{onStatus:setStatus,active:false});terrainActive=false;}catch{terrain=null;}
   measure();
   if(!terrain||reduced||collapsed)setStatus({mode:reduced?'overview':'offline',ready:false});
   else{terrainStarted=true;setTerrainActive(visible);await terrain.start();}
  })().catch(()=>{if(!disposed)setStatus({mode:'offline',ready:false});}).finally(()=>{loading=null;if(!disposed){updateStatus();dirty=true;paintIfVisible();if(!collapsed&&!reduced&&atlas&&!terrain)ensureLoaded();}});
  return loading;
 }
 function updateCard(state){
  const index=state.p<=.008||state.p>journey.holds.at(-1)?-1:Number.isInteger(state.index)?state.index:-1,stop=SCENIC_STOPS[index],arrived=Boolean(stop&&state.arrival>=.82);
  stableIndex=arrived?index:-1;card.hidden=!stop;card.classList.toggle('is-travelling',!arrived);for(const control of [detailButton,addButton,nashmiButton].filter(Boolean))control.disabled=!arrived;
  governorate.textContent=stop?copy(stop.governorate):t('المملكة الأردنية الهاشمية','THE HASHEMITE KINGDOM OF JORDAN');activeName.textContent=stop?placeNameFor(stop):t('الأردن','Jordan');flightNote.textContent=!stop?t('من الشمال الأخضر إلى خليج العقبة','From the green north to the Gulf of Aqaba'):arrived?t('وقفة على الدرب','A stop along the way'):t('على الطريق إلى المحطة التالية','Travelling to the next stop');
  if(stop&&index!==cardIndex){
   cardIndex=index;const place=localizePlace(CATALOG_BY_ID[stop.id],getLocale());
   placeTag.textContent=place.place||copy(stop.governorate);placeName.textContent=copy(stop.focus);description.textContent=place.about||place.desc||'';coordinateNote.textContent=copy(stop.coordinateNote);
   photo.alt=place.gallery?.[0]?.alt||place.ar;photo.classList.remove('image-failed');figure.classList.remove('is-unavailable');photo.src=place.image||place.photo?.src||'';photo.style.objectPosition=Array.isArray(place.photo?.position)?`${place.photo.position[0]*100}% ${place.photo.position[1]*100}%`:'50% 50%';
   photoCredit.replaceChildren();const credit=place.photo||{};if(credit.licenseUrl)append(photoCredit,link(credit.author||t('المصور','Photographer'),credit.source),make('span','',' · '),link(credit.license,credit.licenseUrl));else append(photoCredit,make('span','',t('صورة مقدّمة للمشروع · ','Photo supplied to the project · ')),link(t('المصدر','Source'),`credits.html#${stop.id}`));
   if(!reduced)terrain?.preload(index);
  }
  if(stableIndex>=0){updateAdd();if(lastAnnounced!==stableIndex){lastAnnounced=stableIndex;announcer.textContent=`${copy(stop.focus)} · ${copy(stop.governorate)}`;}}
  stopButtons.forEach((option,i)=>{const selected=i===index;option.classList.toggle('is-current',selected);if(selected)option.setAttribute('aria-current','step');else option.removeAttribute('aria-current');});
  previous.disabled=currentProgress<=.0001;next.disabled=currentProgress>=.9999;
  if(document.activeElement!==progress)progress.value=String(Math.round(currentProgress*1000));progress.setAttribute('aria-valuetext',`${Math.round(currentProgress*100)}% · ${stop?copy(stop.focus):t('الأردن','Jordan')}`);
 }
 function drawLabels(state,useTerrain){
  const project=coord=>useTerrain?terrain.project(coord):atlas?.project(coord),rectangles=[];
  const order=SCENIC_STOPS.map((_,i)=>i).sort((a,b)=>Number(b===state.index)-Number(a===state.index));
  for(const index of order){const node=labelNodes[index],point=project(SCENIC_STOPS[index].coord),active=index===state.index&&state.arrival>=.82,labelWidth=active?165:125;
   let shown=Boolean(point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>20&&point.x<width-20&&point.y>44&&point.y<height-40);
   if(width>760&&point&&point.x<Math.min(width*.34,430))shown=false;
   const box=point?{x:point.x-labelWidth/2,y:point.y-45,w:labelWidth,h:active?46:31}:null;
   if(shown&&!active&&rectangles.some(other=>box.x<other.x+other.w&&box.x+box.w>other.x&&box.y<other.y+other.h&&box.y+box.h>other.y))shown=false;
   if(shown)rectangles.push(box);node.hidden=!shown;node.classList.toggle('is-active',active);if(point)node.style.transform=`translate(${point.x.toFixed(1)}px,${point.y.toFixed(1)}px)`;
  }
 }
 function paint(){
  raf=0;if(!syncActivity()||!dirty)return;dirty=false;currentProgress=readProgress();currentState=journey.state(currentProgress);
  const state={...currentState,theme,locale:getLocale(),light:theme==='light'?1:currentState.light};
  if(!reduced)terrain?.update(state);
  const useTerrain=Boolean(!reduced&&status.ready&&terrain);
  canvas.hidden=false;terrainHost.style.opacity=useTerrain?'1':'0';atlas?.draw(state);
  updateCard(state);drawLabels(state,useTerrain);section.style.setProperty('--scm-progress',String(currentProgress));
 }
 function go(value,{instant=false}={}){
  if(disposed)return;if(collapsed)restore();
  const p=clamp(value);picker.open=false;
  if(reduced){manualProgress=p;currentProgress=p;dirty=true;syncActivity();paintIfVisible();return;}
  const g=geometry(),top=g.sectionTop-headerHeight+p*Math.max(1,g.sectionHeight-g.stageHeight);
  window.scrollTo({top:Math.max(0,top),behavior:instant?'instant':'smooth'});dirty=true;scrollChanged();
 }
 function goTo(idOrIndex){const index=typeof idOrIndex==='number'?Math.max(0,Math.min(SCENIC_STOPS.length-1,Math.trunc(idOrIndex))):SCENIC_STOPS.findIndex(stop=>stop.id===idOrIndex);if(index>=0)go(journey.stopProgress(index));}
 function move(delta){const positions=SCENIC_STOPS.map((_,index)=>journey.stopProgress(index));const point=delta>0?positions.find(value=>value>currentProgress+.00001):positions.reverse().find(value=>value<currentProgress-.00001);go(point??(delta>0?1:0));}
 function restore(){collapsed=false;section.classList.remove('is-collapsed');stage.hidden=false;collapsedPanel.hidden=true;manualProgress=0;currentProgress=0;cardIndex=-1;syncMotion();measure();if(warm)ensureLoaded();}
 function skip(){
  if(disposed)return;collapsed=true;stableIndex=-1;section.classList.add('is-collapsed');stage.hidden=true;collapsedPanel.hidden=false;picker.open=false;terrain?.destroy();terrain=null;terrainStarted=false;terrainActive=false;status={mode:'offline',ready:false};if(raf){cancelAnimationFrame(raf);raf=0;}visible=false;
  const explore=document.getElementById('explore');if(explore){const target=explore.getBoundingClientRect().top+(window.scrollY||0)-headerHeight-12;window.scrollTo({top:Math.max(0,target),behavior:'instant'});explore.setAttribute('tabindex','-1');explore.focus({preventScroll:true});}
 }
 function replay(){if(disposed)return;restore();const top=section.getBoundingClientRect().top+(window.scrollY||0)-headerHeight;window.scrollTo({top:Math.max(0,top),behavior:'instant'});stage.focus({preventScroll:true});scrollChanged();}
 function syncMotion(){reduced=forceCalm||(preference.matches&&!motionOpted);section.classList.toggle('is-reduced',reduced);section.classList.toggle('is-motion-opted',motionOpted);if(reduced)manualProgress=currentProgress;syncActivity();applyLanguage();}
 function toggleMotion(){if(reduced){forceCalm=false;motionOpted=true;syncMotion();replay();warm=true;ensureLoaded();}else{forceCalm=true;motionOpted=false;syncMotion();setStatus({mode:'overview',ready:false});measure();}}
 function keydown(event){if(event.key==='Escape'&&picker.open&&picker.contains(event.target)){event.preventDefault();picker.open=false;pickerSummary.focus({preventScroll:true});return;}if(event.target!==stage||event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;const key=event.key;if(key==='ArrowDown'||key==='PageDown'){event.preventDefault();move(1);}else if(key==='ArrowUp'||key==='PageUp'){event.preventDefault();move(-1);}else if(key==='Home'){event.preventDefault();go(0);}else if(key==='End'){event.preventDefault();go(1);}else if(key==='Escape'&&picker.open){picker.open=false;pickerSummary.focus({preventScroll:true});}}
 listen(progress,'input',()=>go(Number(progress.value)/1000,{instant:true}));listen(stage,'keydown',keydown);listen(window,'scroll',scrollChanged,{passive:true});listen(window,'resize',measure,{passive:true});listen(document,'visibilitychange',()=>{syncActivity();dirty=true;paintIfVisible();});listen(window,'darb:languagechange',applyLanguage);listen(preference,'change',()=>{motionOpted=false;forceCalm=false;syncMotion();if(reduced)setStatus({mode:'overview',ready:false});else if(warm)ensureLoaded();measure();});
 listen(photo,'error',()=>{figure.classList.add('is-unavailable');photo.alt=t('تعذّر تحميل الصورة؛ التفاصيل متاحة أدناه.','The photo could not load; details are available below.');});listen(photo,'load',()=>figure.classList.remove('is-unavailable'));
 const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;if(resizeObserver){resizeObserver.observe(visual);if(header)resizeObserver.observe(header);}
 const themeObserver=typeof MutationObserver==='function'?new MutationObserver(()=>{const nextTheme=document.documentElement.dataset.theme||'dark';if(theme!==nextTheme){theme=nextTheme;dirty=true;paintIfVisible();}}):null;themeObserver?.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 const warmObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){warm=true;ensureLoaded();}},{rootMargin:'1000px 0px',threshold:0}):null;if(warmObserver)warmObserver.observe(stage);else{warm=true;ensureLoaded();}
 syncMotion();measure();
 return {goTo,skip,replay,resize:measure,getState:()=>({progress:currentProgress,activeId:SCENIC_STOPS[stableIndex]?.id||null,index:currentState.index,collapsed,reduced,visible,renderer:status.mode,ready:Boolean(status.ready),stops:SCENIC_STOPS.length}),destroy(){if(disposed)return;disposed=true;aborter.abort();if(raf)cancelAnimationFrame(raf);for(const cleanup of listeners)cleanup();warmObserver?.disconnect();resizeObserver?.disconnect();themeObserver?.disconnect();terrain?.destroy();atlas?.destroy();section.replaceChildren();section.classList.add('is-collapsed');section.classList.remove('is-reduced','is-motion-opted');delete section.dataset.scmReady;delete section.dataset.renderer;}};
}

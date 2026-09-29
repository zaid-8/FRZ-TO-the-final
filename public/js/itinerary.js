

import {localizeCatalogPlace} from './catalog-en.js';
export const DEFAULT_PLANNING_RATES=Object.freeze({
 foodPerPersonDay:Object.freeze([10,20]),roomPerNight:Object.freeze([35,65]),
 ownCarPerKm:Object.freeze([.10,.16]),driverPerDay:Object.freeze([80,130]),
 publicPerPersonDay:Object.freeze([6,16])
});
const INTERESTS=['nature','history','culture','adventure','relax','sea'];
const BASE={id:'amman',ar:'عمّان',en:'Amman',lat:31.9539,lng:35.9106,region:'central',tags:['culture'],visitHours:3};
const text=v=>typeof v==='string'?v:'';
const translator=locale=>(ar,en)=>locale==='en'?en:ar;
const arabic=v=>text(v).replace(/[٠-٩۰-۹]/g,c=>'٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u065F\u0670ـ]/g,'').toLowerCase();
const number=v=>typeof v==='number'?v:(typeof v==='string'&&arabic(v).trim()!==''?Number(arabic(v).replace(/٫/g,'.').replace(/٬/g,'')):NaN);
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const round=v=>Math.round((v+Number.EPSILON)*100)/100;
const unique=a=>[...new Set(a)];
const interest=v=>({local:'culture',beach:'sea',relaxation:'relax',religious:'history'}[v]||v);
const safeUrl=v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}};
function cleanCatalog(input){
 const seen=new Set();return (Array.isArray(input)?input:[]).filter(x=>{
  if(!x||typeof x!=='object'||!text(x.id)||seen.has(x.id)||!Number.isFinite(x.lat)||!Number.isFinite(x.lng)||Math.abs(x.lat)>90||Math.abs(x.lng)>180)return false;
  seen.add(x.id);return true;
 }).map(x=>({...x,ar:text(x.ar)||x.id,tags:unique((Array.isArray(x.tags)?x.tags:[]).map(interest).filter(t=>INTERESTS.includes(t))),visitHours:Number.isFinite(x.visitHours)&&x.visitHours>0?Math.min(12,x.visitHours):3}));
}
function normalizedRates(input){const result={};for(const [key,fallback] of Object.entries(DEFAULT_PLANNING_RATES)){
 const values=Array.isArray(input?.[key])?input[key].map(number):[];
 result[key]=values.length===2&&values.every(v=>Number.isFinite(v)&&v>=0&&v<=10000)&&values[0]<=values[1]?values:[...fallback];
 }return result;}
function validDate(input){if(typeof input!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input))return null;const d=new Date(`${input}T12:00:00Z`);return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===input?input:null;}
function boundedInt(value,fallback,lo,hi){const n=number(value);return Number.isFinite(n)?clamp(Math.round(n),lo,hi):fallback;}
export function normalizeProfile(input={},catalog=[]){
 const p=input&&typeof input==='object'?input:{},places=cleanCatalog(catalog),ids=new Set(places.map(x=>x.id));ids.add('amman');
 const budget=number(p.budget??p.totalBudgetJD),interests=unique((Array.isArray(p.interests)?p.interests:['nature','history']).map(interest).filter(v=>INTERESTS.includes(v)));
 return {days:boundedInt(p.days,3,1,7),people:boundedInt(p.people,2,1,12),budget:Number.isFinite(budget)&&budget>=0?Math.min(1000000,budget):null,
  originId:ids.has(p.originId)?p.originId:'amman',interests:interests.length?interests:['nature','history'],
  pace:['relaxed','balanced','active'].includes(p.pace)?p.pace:'balanced',nationality:['jordanian','foreign'].includes(p.nationality)?p.nationality:'jordanian',
  transport:['car','driver','public'].includes(p.transport)?p.transport:'car',
  mustVisit:unique((Array.isArray(p.mustVisit)?p.mustVisit:[]).filter(v=>typeof v==='string'&&v.length>0&&v.length<100)).slice(0,30),
  roundTrip:p.roundTrip!==false,startDate:validDate(p.startDate),rates:normalizedRates(p.rates)};
}


export function parseLocalMessage(message,previousProfile={},catalog=[],{locale='ar'}={}){
 const profile=normalizeProfile(previousProfile,catalog),s=arabic(message),before=JSON.stringify(profile),warnings=[],changes=[],t=translator(locale);
 const set=(key,value)=>{profile[key]=value;changes.push(key);};let match;
 if((match=s.match(/(?:لمده\s*)?(\d+)\s*(?:ايام|يوم|days?\b)/)))set('days',Number(match[1]));
 else if(/اسبوع|\b(?:a|one) week\b/.test(s))set('days',7);else if(/يومين|\btwo days\b/.test(s))set('days',2);else if(/(?:^|\s)(?:يوم واحد|ليوم|يوم)(?:\s|$)|\b(?:one day|a day|day[ -]trip)\b/.test(s))set('days',1);
 if((match=s.match(/(\d+)\s*(?:اشخاص|افراد|شخص|ناس|people\b|persons?\b|travell?ers?\b)/))||(match=s.match(/(?:احنا|نحن|عددنا)\s*(\d+)/)))set('people',Number(match[1]));
 else if(/شخصين|اثنين|اتنين|\btwo (?:people|persons?|travell?ers?)\b/.test(s))set('people',2);else if(/لحالي|لوحدي|\b(?:solo|alone|by myself)\b/.test(s))set('people',1);
 if((match=s.match(/(?:ميزاني(?:تي|ه|تنا)|\bbudget\b)\s*(?:هي|حوالي|تقريبا|is|of|about|:|=)?\s*(\d+(?:\.\d+)?)/))||(match=s.match(/(\d+(?:\.\d+)?)\s*(?:دينار|jod\b|jd\b)/)))set('budget',Number(match[1]));
 if(/بدون ميزانيه محدده|ميزانيه مفتوحه|\b(?:no (?:fixed )?budget|(?:open|flexible) budget|budget is (?:open|flexible))\b/.test(s))set('budget',null);
 if(/غير اردني|اجنبي|اجانب|\b(?:foreign|international)\b/.test(s))set('nationality','foreign');else if(/اردني|\bjordanian\b/.test(s))set('nationality','jordanian');
 if(/سائق|سواق|\bdriver\b/.test(s))set('transport','driver');else if(/باص|مواصلات عامه|نقل عام|\b(?:public transport|public transit|bus)\b/.test(s))set('transport','public');else if(/سيارتي|سيارتنا|سياره|\b(?:own|our|my) car\b/.test(s))set('transport','car');
 if(/هادئ|هادي|راحه|مرتاح|براحه|\brelaxed\b/.test(s))set('pace','relaxed');else if(/نشط|سريع|مكثف|\bactive\b/.test(s))set('pace','active');else if(/متوازن|\bbalanced\b/.test(s))set('pace','balanced');
 if(/بدون رجعه|بدون عوده|اتجاه واحد|ما بدي ارجع|\b(?:one[ -]way|no return|without returning)\b/.test(s))set('roundTrip',false);else if(/ذهاب وعوده|ارجع لنقطه|مع رجعه|\bround[ -]trip\b/.test(s))set('roundTrip',true);
 if((match=s.match(/\b\d{4}-\d{2}-\d{2}\b/))){const date=validDate(match[0]);if(date)set('startDate',date);else warnings.push(t('التاريخ المكتوب غير صالح؛ بقي تاريخ البداية السابق.','The date is invalid; the previous start date was kept.'));}
 const negative=prefix=>{const clause=prefix.split(/\b(?:but|however|instead|include|including|add|prefer)\b|بس|لكن|بل/).at(-1);return /(?:ما بدي|لا اريد|لا تزور|بدون|استثني|احذف|شيل|مش|مو|ولا|(?:^|\s)لا)\s*(?:[^،,.؛!?]{0,24})$/.test(clause)||/\b(?:exclude|excluding|skip|avoid|remove|without|no|not|don['’]t|do not)\s+(?!only\b)(?:[^،,.؛;!?]{0,24})$/.test(clause);};
 const requested=[...profile.mustVisit];
 for(const place of cleanCatalog(catalog)){
  const aliases=unique([place.ar,place.en,place.id,...(Array.isArray(place.aliases)?place.aliases:[])].map(arabic).filter(v=>v.length>1)).sort((a,b)=>b.length-a.length);
  let occurrence=null;for(const alias of aliases){let at=s.indexOf(alias);while(at!==-1&&/^[a-z0-9]/.test(alias)&&(/[a-z0-9]/.test(s[at-1]||'')||/[a-z0-9]/.test(s[at+alias.length]||'')))at=s.indexOf(alias,at+1);if(at!==-1&&(occurrence===null||at<occurrence.at))occurrence={at,alias};}
  if(!occurrence)continue;const prefix=s.slice(Math.max(0,occurrence.at-42),occurrence.at);
  if(/(?:من|from)\s*$/.test(prefix)&&!negative(prefix)){set('originId',place.id);continue;}
  if(negative(prefix)){const at=requested.indexOf(place.id);if(at!==-1)requested.splice(at,1);changes.push('mustVisit');}
  else{requested.push(place.id);changes.push('mustVisit');}
 }
 if(changes.includes('mustVisit'))profile.mustVisit=unique(requested);
 const interestWords={nature:/طبيع|غابات|خضره|\b(?:nature|forests?|greenery|outdoors?)\b/,history:/تاريخ|اثار|تراث|\b(?:history|historical|heritage|archaeology|ruins)\b/,culture:/ثقاف|محلي|اسواق|\b(?:culture|cultural|markets?|local experiences)\b/,adventure:/مغامر|تسلق|هايكن|\b(?:adventure|hiking|climbing|trekking)\b/,relax:/استرخاء|استجمام|\b(?:relax|relaxation|relaxing)\b/,sea:/بحر|شاطئ|سباح|\b(?:sea|beach|beaches|swimming|coast)\b/};
 let selected=[...profile.interests],interestChanged=false;
 for(const [key,pattern] of Object.entries(interestWords)){const hit=pattern.exec(s);if(!hit)continue;interestChanged=true;
  if(negative(s.slice(Math.max(0,hit.index-30),hit.index)))selected=selected.filter(v=>v!==key);else if(!selected.includes(key))selected.push(key);
 }if(interestChanged)set('interests',selected);
 const normalized=normalizeProfile(profile,catalog);
 if(changes.includes('days')&&normalized.days!==profile.days)warnings.push(t('مدة الرحلة المتاحة من يوم إلى 7 أيام.','Trip length must be between 1 and 7 days.'));
 if(changes.includes('people')&&normalized.people!==profile.people)warnings.push(t('عدد المسافرين المتاح من 1 إلى 12.','The number of travelers must be between 1 and 12.'));
 const understood=before!==JSON.stringify(normalized)||changes.length>0;
 if(!understood)warnings.push(t('المحلل المحلي لم يلتقط تغييرًا واضحًا. استخدم الحقول أو اكتب مثلًا: يومين، 4 أشخاص، ميزانيتي 150 دينار، من عمّان.','The local parser did not recognize a clear change. Use the fields or try: 2 days, 4 people, budget 150 JOD, from Amman.'));
 return {profile:normalized,understood,changes:unique(changes),warnings,mode:'local'};
}

function km(a,b){const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlng=(b.lng-a.lng)*rad,v=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2;return 6371*2*Math.asin(Math.sqrt(clamp(v,0,1)))*1.35;}
const location=p=>({id:p.id,lat:p.lat,lng:p.lng,name:p.ar});
const minuteTime=hours=>{const minutes=Math.round(hours*60/5)*5;return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;};
const fee=(place,p)=>{if(place.id==='petra'&&p.nationality==='foreign')return null;const n=place.entry?.[p.nationality];return typeof n==='number'&&Number.isFinite(n)&&n>=0&&(n!==0||safeUrl(place.entry?.source)&&validDate(place.entry?.checkedAt))?n:null;};
function duration(place,p){return place.id==='petra'?Math.max(7,place.visitHours):round(place.visitHours*(p.pace==='relaxed'?1.1:p.pace==='active'?.9:1));}
function affinity(place,p,preferred){return place.tags.filter(t=>p.interests.includes(t)).length*12+(preferred.has(place.id)?16:0)+4;}
function tourOptions(state,p,places,origin,must,preferred,day,locale){
 const limit={relaxed:8,balanced:9,active:10}[p.pace],last=day===p.days,visits=[],remaining=places.filter(x=>!state.visited.has(x.id)),t=translator(locale);
 const pending=remaining.filter(x=>must.has(x.id));
 const candidates=remaining.map(place=>({place,rank:(must.has(place.id)?150:0)+affinity(place,p,preferred)-km(state.at,place)*.18-(fee(place,p)||0)*p.people*(p.budget===null?.05:.3)})).sort((a,b)=>b.rank-a.rank||a.place.id.localeCompare(b.place.id)).slice(0,9).map(x=>x.place);
 const addTour=(stops,at,hours,distance,visited)=>{
  const ends=last&&p.roundTrip?[origin]:unique([at.id,origin.id,...pending.filter(x=>x.id!==at.id).sort((a,b)=>km(at,a)-km(at,b)).slice(0,2).map(x=>x.id)]).map(id=>id===origin.id?origin:places.find(x=>x.id===id)).filter(Boolean);
  for(const end of ends){const extra=km(at,end),total=hours+extra/55;if(total>limit+.00001)continue;
   const direct=km(state.at,end);
   if(direct>120&&distance+extra>direct*1.25+10&&!stops.some(s=>must.has(s.place.id)))continue;
   if(!stops.length&&end.id===state.at.id&&day<p.days&&remaining.length)continue;
   const points=[state.at,...stops.map(s=>s.place)];if(points.at(-1).id!==end.id)points.push(end);
   visits.push({stops:stops.map(s=>({id:s.place.id,arrival:minuteTime(9+s.arrival),durationHours:s.duration,reason:must.has(s.place.id)?t('محطة طلبتها ضمن رحلتك.','A stop you requested for your trip.'):s.place.tags.some(tag=>p.interests.includes(tag))?t('تناسب اهتماماتك وقريبة من مسار هذا اليوم.','Matches your interests and is near this day’s route.'):t('محطة قريبة تكمّل مسار اليوم.','A nearby stop that fits this day’s route.')})),start:state.at,end,totalHours:total,travelKm:distance+extra,travelHours:(distance+extra)/55,points,visited});
  }
 };
 const walk=(at,stops,hours,distance,visited)=>{
  if(stops.length)addTour(stops,at,hours,distance,visited);
  if(stops.length>=3||stops.some(s=>s.place.id==='petra'||s.duration>=6))return;
  for(const next of candidates){if(visited.has(next.id))continue;


   if((next.id==='amman'&&visited.has('citadel'))||(next.id==='citadel'&&visited.has('amman')))continue;
   const dist=km(at,next),travel=dist/55,dur=duration(next,p),isFullDay=next.id==='petra'||dur>=6;
   if(isFullDay&&(stops.length>0||travel>.5))continue;
   const rest=stops.length?.5:0,total=hours+rest+travel+dur;
   if(total>limit)continue;
   walk(next,[...stops,{place:next,arrival:hours+rest+travel,duration:dur}],total,distance+dist,new Set([...visited,next.id]));
  }
 };
 walk(state.at,[],0,0,new Set(state.visited));


 const transfers=unique([origin.id,...pending.map(x=>x.id),...candidates.filter(x=>duration(x,p)>=6).map(x=>x.id)]);
 for(const id of transfers){const end=id===origin.id?origin:places.find(x=>x.id===id);if(!end||end.id===state.at.id||last&&p.roundTrip&&end.id!==origin.id)continue;
  const distance=km(state.at,end);if(distance/55<=limit)visits.push({stops:[],start:state.at,end,totalHours:distance/55,travelKm:distance,travelHours:distance/55,points:[state.at,end],visited:new Set(state.visited)});
 }


 if(state.at.id===origin.id||!last||!p.roundTrip)visits.push({stops:[],start:state.at,end:state.at,totalHours:0,travelKm:0,travelHours:0,points:[state.at],visited:new Set(state.visited)});
 return visits;
}
function costFor(days,p,byId,locale){
 const ids=unique(days.flatMap(d=>d.stops.map(s=>s.id))),unknown=[],assumptions=[],sources=[],entryItems=[],t=translator(locale);let entryKnown=0;
 for(const id of ids){const place=byId.get(id),value=fee(place,p),label=text(place.entry?.scope)||place.ar;
  if(value===null)unknown.push({id,type:'entry',label:t(`رسوم ${label}`,`Entry fee: ${label}`),note:place.id==='petra'&&p.nationality==='foreign'?`${text(place.entry?.note)} ${t('فئة تذكرة الزائر الأجنبي لم تُحسم؛ لا تُحتسب رسوم البترا في المجموع.','The international visitor ticket category has not been confirmed; Petra entry fees are excluded from the total.')}`:text(place.entry?.note)||t('لا يتوفر سعر دخول موثوق؛ غير داخل في المجموع الجزئي.','No verified entry price is available; it is excluded from the partial total.'),required:true});
  else{const total=round(value*p.people);entryKnown+=total;entryItems.push({id,label,perPerson:value,total,note:text(place.entry?.note)});}
  const source=safeUrl(place.entry?.source);if(source)sources.push({label:t(`رسوم ${label}`,`Entry fee: ${label}`),url:source,checkedAt:text(place.entry.checkedAt)});
  if(place.costNote)assumptions.push(`${place.ar}: ${place.costNote}`);
  if(Array.isArray(place.activities)&&place.activities.length)unknown.push({id,type:'activities',label:t(`أنشطة إضافية في ${place.ar}`,`Optional activities in ${place.ar}`),note:t('اختيارية وغير محجوزة؛ لا تتضمنها الأرقام المعروضة.','Optional and not booked; excluded from the displayed estimates.'),required:false});
 }
 const multiply=(range,value)=>range.map(n=>round(n*value)),nights=days.slice(0,-1).filter(d=>d.end.id!==p.originId).length,rooms=Math.ceil(p.people/2),distance=days.reduce((s,d)=>s+d.travelKm,0),vehicles=p.transport==='car'?Math.ceil(p.people/5):p.transport==='driver'?Math.ceil(p.people/4):0;
 const food=multiply(p.rates.foodPerPersonDay,p.people*p.days),lodging=multiply(p.rates.roomPerNight,rooms*nights);
 const transport=p.transport==='car'?multiply(p.rates.ownCarPerKm,distance*vehicles):p.transport==='driver'?multiply(p.rates.driverPerDay,p.days*vehicles):multiply(p.rates.publicPerPersonDay,p.people*p.days);
 const activities=[0,0],total=[0,1].map(i=>round(entryKnown+food[i]+lodging[i]+transport[i]));
 if(p.transport==='public')unknown.push({type:'transport',label:t('توفر خطوط النقل العام والوصلات الأخيرة','Public transport routes and last-mile connections'),note:t('لم تُتحقق المسارات أو أجور النقل الإضافي من الموقف إلى الموقع؛ غير داخلة في المجموع الجزئي.','Routes and additional fares from the stop to the site are unverified; they are excluded from the partial total.'),required:true});
 assumptions.unshift(t('كل المبالغ بالدينار الأردني وللمجموعة كاملة. أسعار الطعام والسكن والنقل افتراضات تخطيط قابلة للتعديل وليست عروضًا مباشرة.','All amounts are in Jordanian dinars (JOD) for the whole group. Food, lodging and transport rates are adjustable planning assumptions, not live quotes.'),t(`الطعام: ${p.rates.foodPerPersonDay.join('–')} دينار للشخص/اليوم، على مدى ${p.days} أيام.`,`Food: ${p.rates.foodPerPersonDay.join('–')} JOD per person per day, for ${p.days} ${p.days===1?'day':'days'}.`),t(`السكن: ${rooms} غرفة/غرف مشتركة بحد أقصى شخصين للغرفة × ${nights} ليلة خارج نقطة الانطلاق، بسعر ${p.rates.roomPerNight.join('–')} دينار للغرفة/الليلة. لا يشمل سكنك الحالي عند نقطة الانطلاق.`,`Lodging: ${rooms} shared ${rooms===1?'room':'rooms'}, up to two people per room, for ${nights} ${nights===1?'night':'nights'} away from the starting point, at ${p.rates.roomPerNight.join('–')} JOD per room per night. Your existing accommodation at the starting point is excluded.`));
 assumptions.push(p.transport==='car'?t(`${vehicles} سيارة مملوكة (حتى 5 مسافرين لكل سيارة): ${p.rates.ownCarPerKm.join('–')} دينار/كم/سيارة للوقود والتشغيل؛ إيجار السيارة والمواقف غير مشمولين.`,`${vehicles} owned ${vehicles===1?'car':'cars'} (up to 5 travelers per car): ${p.rates.ownCarPerKm.join('–')} JOD per km per car for fuel and running costs; car rental and parking are excluded.`):p.transport==='driver'?t(`${vehicles} سيارة مع سائق (حتى 4 مسافرين لكل سيارة): ${p.rates.driverPerDay.join('–')} دينار/يوم/سيارة كتقدير فقط. مبيت السائق وأي إضافات تحتاج عرضًا مؤكدًا.`,`${vehicles} ${vehicles===1?'car':'cars'} with a driver (up to 4 travelers per car): ${p.rates.driverPerDay.join('–')} JOD per day per car as an estimate only. Driver accommodation and extras need a confirmed quote.`):t(`نقل عام: ${p.rates.publicPerPersonDay.join('–')} دينار للشخص/اليوم كتقدير عام. الجداول والخطوط والوصلات الأخيرة غير متحققة.`,`Public transport: ${p.rates.publicPerPersonDay.join('–')} JOD per person per day as a general estimate. Timetables, routes and last-mile connections are unverified.`),t('الأنشطة الإضافية والتأمين والتأشيرات ورسوم الحجز غير داخلة. الصفر في بند الأنشطة يعني أنها غير مختارة، ولا يعني أنها مجانية.','Optional activities, insurance, visas and booking fees are excluded. Zero under activities means none have been selected; it does not mean they are free.'),t('المسافة التقريبية = المسافة الجوية × 1.35؛ زمن القيادة = المسافة المقدرة ÷ 55 كم/ساعة. ليست مسافة طريق محسوبة أو موعد وصول مؤكد.','Approximate distance = straight-line distance × 1.35; driving time = estimated distance ÷ 55 km/h. These are not routed road distances or confirmed arrival times.'));
 return {entryKnown:round(entryKnown),entryItems,food,lodging,transport,activities,unknown,total,perPerson:total.map(n=>round(n/p.people)),assumptions:unique(assumptions),partial:unknown.some(x=>x.required),nights,rooms,vehicles,sources};
}
function routeFor(days){const route=[];for(const day of days)for(const point of day.points){const last=route.at(-1);if(last?.id===point.id&&last.day===day.day)continue;route.push({...location(point),day:day.day});}return route;}
function mapsUrl(route){if(!route.length)return 'https://www.google.com/maps';const coords=p=>`${p.lat},${p.lng}`,params=new URLSearchParams({api:'1',origin:coords(route[0]),destination:coords(route.at(-1)),travelmode:'driving'});if(route.length>2)params.set('waypoints',route.slice(1,-1).map(coords).join('|'));return `https://www.google.com/maps/dir/?${params}`;}

export function buildItinerary(input,catalog=[],preferredIds=[],{locale='ar'}={}){
 const places=cleanCatalog(catalog).map(place=>{if(locale!=='en')return place;const localized=localizeCatalogPlace(place,'en');return {...place,ar:localized.ar,entry:place.entry?localized.entry:place.entry,costNote:place.costNote?localized.costNote:place.costNote};}),p=normalizeProfile(input,places),origin=places.find(x=>x.id===p.originId)||(locale==='en'?localizeCatalogPlace(BASE,'en'):BASE),byId=new Map(places.map(x=>[x.id,x])),warnings=[],t=translator(locale);
 byId.set(origin.id,origin);const preferred=new Set(Array.isArray(preferredIds)?preferredIds:[]),requested=unique(p.mustVisit);

 const required=requested.filter(id=>!(id==='amman'&&requested.includes('citadel')));
 if(required.length!==requested.length)warnings.push(t('جُمعت عمّان والقلعة في محطة القلعة داخل عمّان لتجنب تكرار الموقع والتكلفة؛ لا تعني هذه المحطة جولة شاملة لكل المدينة.','Amman and the Citadel were combined into one Citadel stop to avoid counting the same location and cost twice; this is not a full city tour.'));
 const must=new Set(required),maxHours={relaxed:8,balanced:9,active:10}[p.pace];
 if(places.length!==(Array.isArray(catalog)?catalog.length:0))warnings.push(t('استُبعدت بيانات وجهات مكررة أو غير صالحة من التخطيط.','Duplicate or invalid destination records were excluded from planning.'));
 let beam=[{at:origin,visited:new Set(),days:[],score:0}];
 for(let day=1;day<=p.days;day++){
  const next=[];
  for(const state of beam)for(const option of tourOptions(state,p,places,origin,must,preferred,day,locale)){
   const newStops=option.stops.map(s=>byId.get(s.id)),gain=newStops.reduce((s,x)=>s+(must.has(x.id)?10000:affinity(x,p,preferred)),0),away=option.end.id!==origin.id;
   const dayData={day,...option},days=[...state.days,dayData];
   const progress=must.has(option.end.id)&&!option.visited.has(option.end.id)?180:0;
   const score=state.score+gain-option.travelKm*.10-(away?3:0)-(option.stops.length?0:8);
   const roughCost=costFor(days,{...p,days:day},byId,locale),costPressure=p.budget===null?0:Math.max(0,roughCost.total[0]-p.budget)*.6;
   next.push({at:option.end,visited:option.visited,days,score,rank:score+progress-costPressure});
  }
  const seen=new Set();beam=next.sort((a,b)=>b.rank-a.rank||a.at.id.localeCompare(b.at.id)).filter(s=>{const key=s.at.id+'|'+[...s.visited].sort().join(',');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,28);
 }
 const evaluated=beam.map(state=>{const cost=costFor(state.days,p,byId,locale),missing=required.filter(id=>!state.visited.has(id)),budgetTier=p.budget===null?0:cost.total[1]<=p.budget?0:cost.total[0]<=p.budget?1:2;return {...state,cost,missing,budgetTier};});
 evaluated.sort((a,b)=>a.missing.length-b.missing.length||Number(!a.visited.size)-Number(!b.visited.size)||a.budgetTier-b.budgetTier||(a.budgetTier===2&&p.budget!==null?a.cost.total[0]-b.cost.total[0]:0)||b.score-a.score);
 const chosen=evaluated[0]||{days:[],visited:new Set(),cost:costFor([],p,byId,locale),missing:required,score:0};
 const feasible=chosen.visited.size>0&&chosen.missing.length===0&&chosen.days.length===p.days&&(!p.roundTrip||chosen.at?.id===origin.id);
 if(input?.originId&&input.originId!==p.originId)warnings.push(t('نقطة الانطلاق المطلوبة غير موجودة ببيانات صالحة؛ استُخدمت عمّان.','The requested starting point has no valid data; Amman was used.'));
 if(chosen.missing.length)warnings.push(t(`تعذّر إدراج المحطات المطلوبة ضمن ${p.days} أيام وحد ${maxHours} ساعات يوميًا: ${chosen.missing.map(id=>byId.get(id)?.ar||id).join('، ')}. زد المدة أو غيّر نقطة البداية أو شرط العودة؛ لم تُحذف هذه الطلبات من تفضيلاتك.`,`These requested stops could not fit within ${p.days} ${p.days===1?'day':'days'} and ${maxHours} hours per day: ${chosen.missing.map(id=>byId.get(id)?.ar||id).join(', ')}. Add days, change the starting point or change the return requirement; your requested stops have been kept in your preferences.`));
 if(!chosen.days.some(d=>d.stops.length))warnings.push(t('لا توجد زيارات قابلة للتنفيذ بهذه القيود؛ هذه ليست رحلة مكتملة.','No visits are feasible with these constraints; this is not a complete trip.'));
 if(chosen.days.some(d=>!d.stops.length))warnings.push(t('تتضمن الخطة يوم انتقال أو يومًا غير مخصص للزيارة؛ يظهر ذلك صراحة في الجدول.','The plan includes a transfer day or a day without visits, shown explicitly in the schedule.'));
 if(p.transport==='public')warnings.push(t('النقل العام: الأوقات أدناه تقدير جغرافي للقيادة فقط؛ لم نتحقق من الحافلات أو مواعيدها، وقد يتعذر تنفيذ التسلسل دون نقل إضافي.','Public transport: the times below are geographical driving estimates only. Bus routes and schedules are unverified, and extra transport may be needed to follow this sequence.'));
 if(chosen.cost.vehicles>1)warnings.push(t(`حُسب النقل على ${chosen.cost.vehicles} سيارات بسبب عدد المسافرين؛ تحقّق من السيارات والمقاعد المتاحة.`,`Transport was estimated for ${chosen.cost.vehicles} cars based on the group size; confirm available vehicles and seats.`));
 if(p.startDate)warnings.push(t('تاريخ البداية لا يتحقق تلقائيًا من أيام الإغلاق أو الطقس أو توفر الحجوزات.','The start date does not automatically check closures, weather or booking availability.'));
 if(chosen.cost.partial)warnings.push(t('المجموع جزئي: توجد رسوم أو تكاليف ضرورية غير معروفة. لا يُعد تأكيدًا بأن الميزانية تكفي.','The total is partial: some required fees or costs are unknown. It does not confirm that the budget is sufficient.'));
 let budgetStatus=p.budget===null||chosen.cost.partial?'uncertain':chosen.cost.total[1]<=p.budget?'within':chosen.cost.total[0]>p.budget?'over':'uncertain';
 if(!feasible&&budgetStatus==='within')budgetStatus='uncertain';
 if(p.budget!==null&&chosen.cost.total[0]>p.budget){budgetStatus='over';warnings.push(t('حتى الحد الأدنى للتكاليف المعروفة يتجاوز الميزانية. جُرّبت محطات أقرب وأقل تكلفة؛ خفّض عدد الأيام/الأشخاص أو عدّل الافتراضات.','Even the lower estimate of known costs exceeds the budget. Closer and cheaper stops were considered; reduce the number of days or travelers, or adjust the assumptions.'));}
 const route=routeFor(chosen.days),directionsUrl=mapsUrl(route);
 if(route.length>11)warnings.push(t('المسار طويل وقد يتجاوز عدد المحطات الذي تدعمه خرائط Google؛ افتح مسارات الأيام منفصلة عند الحاجة.','This route may exceed the number of stops supported by Google Maps; open individual day routes if needed.'));
 const {sources,...cost}=chosen.cost;
 return {title:t(`${p.days} ${p.days===1?'يوم':'أيام'} من ${origin.ar}`,`${p.days} ${p.days===1?'day':'days'} from ${origin.ar}`),profile:p,
  days:chosen.days.map(d=>({day:d.day,stops:d.stops,start:location(d.start),end:location(d.end),travelKm:round(d.travelKm),travelHours:round(d.travelHours),totalHours:round(d.totalHours),travelOnly:d.stops.length===0,directionsUrl:mapsUrl(routeFor([d]))})),
  route,cost,warnings:unique(warnings),budgetStatus,sources:[...new Map(sources.map(s=>[s.url,s])).values()],directionsUrl,feasible,unplannedMandatory:chosen.missing};
}

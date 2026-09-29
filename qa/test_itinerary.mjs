import assert from 'node:assert/strict';
import {normalizeProfile,parseLocalMessage,buildItinerary,DEFAULT_PLANNING_RATES} from '../public/js/itinerary.js';
import {CATALOG} from '../public/js/catalog.js';

const origin={lat:31.9539,lng:35.9106};
const entry=(jordanian=1,foreign=3)=>({jordanian,foreign,unit:'person',scope:'رسم الموقع',note:'سعر اختبار فقط',source:'https://example.test/fees',checkedAt:'2026-09-28'});
const place=(id,ar,lat,lng,hours=2,price=entry())=>({id,ar,lat,lng,tags:['nature','history'],visitHours:hours,entry:price,activities:[]});
const sites=[place('ajloun','عجلون',32.33,35.75,3),place('jerash','جرش',32.28,35.90,3),place('petra','البترا',30.328,35.44,7,entry(1,50)),place('aqaba','العقبة',29.531,35.006,6),place('amman','عمّان',origin.lat,origin.lng,4,entry(null,null))];
sites[2].aliases=['البتراء','petra'];
let tests=0;
function test(name,fn){fn();tests++;console.log(`✓ ${name}`);}
const total=(...values)=>Math.round(values.reduce((s,n)=>s+n,0)*100)/100;

test('normalization clamps and validates without NaN, accepts Arabic digits and optional rates',()=>{
 const p=normalizeProfile({days:'٩',people:'٠',budget:'١٢٥',originId:'missing',pace:'wrong',nationality:'wrong',transport:'wrong',startDate:'2026-02-30',rates:{foodPerPersonDay:[30,10],ownCarPerKm:[.12,.18]}},sites);
 assert.equal(p.days,7);assert.equal(p.people,1);assert.equal(p.budget,125);assert.equal(p.originId,'amman');assert.equal(p.startDate,null);
 assert.deepEqual(p.rates.foodPerPersonDay,[...DEFAULT_PLANNING_RATES.foodPerPersonDay]);assert.deepEqual(p.rates.ownCarPerKm,[.12,.18]);
 assert.equal(normalizeProfile({budget:Infinity}).budget,null);assert.equal(normalizeProfile(null).days,3);
 assert.equal(normalizeProfile({budget:0}).budget,0);assert.equal(normalizeProfile({totalBudgetJD:'٨٠'}).budget,80);
});

test('local parser reads Arabic numbers, origin and explicit exclusion without claiming AI',()=>{
 const r=parseLocalMessage('٣ أيام و٤ أشخاص، ميزانيتي ١٥٠ دينار من عمّان. ما بدي عجلون ولا جرش بس البتراء', {mustVisit:['ajloun','jerash']},sites);
 assert.equal(r.mode,'local');assert.equal(r.understood,true);assert.equal(r.profile.days,3);assert.equal(r.profile.people,4);assert.equal(r.profile.budget,150);
 assert.deepEqual(r.profile.mustVisit,['petra']);assert.equal(r.profile.originId,'amman');
 const next=parseLocalMessage('بدون رجعة، من العقبة، ٧٠ دينار، باص، غير أردني',r.profile,sites);
 assert.equal(next.profile.roundTrip,false);assert.equal(next.profile.originId,'aqaba');assert.equal(next.profile.budget,70);assert.equal(next.profile.transport,'public');assert.equal(next.profile.nationality,'foreign');
 const unchanged=parseLocalMessage('هذا كلام غير محدد',r.profile,sites);assert.equal(unchanged.understood,false);assert.ok(unchanged.warnings.length);
 const oneDay=parseLocalMessage('يوم في عجلون وجرش',{},sites);assert.equal(oneDay.profile.days,1);assert.deepEqual(oneDay.profile.mustVisit,['ajloun','jerash']);
});

test('a group fee is per person, food is per person, owned-car distance is shared',()=>{
 const catalog=[place('site','محطة',31.99,35.91,2,entry(5,15))];
 const p={days:1,people:4,mustVisit:['site'],rates:{foodPerPersonDay:[10,20],ownCarPerKm:[.1,.2]}};
 const r=buildItinerary(p,catalog);assert.equal(r.feasible,true);assert.equal(r.cost.entryKnown,20);assert.deepEqual(r.cost.food,[40,80]);assert.deepEqual(r.cost.lodging,[0,0]);assert.equal(r.cost.vehicles,1);
 assert.ok(Math.abs(r.cost.transport[0]-r.days[0].travelKm*.1)<.02);
 assert.equal(r.cost.total[0],total(20,40,r.cost.transport[0]));assert.equal(r.cost.total[1],total(20,80,r.cost.transport[1]));
 assert.equal(r.cost.perPerson[0],Math.round(r.cost.total[0]/4*100)/100);
 const large=buildItinerary({...p,people:12},catalog);assert.equal(large.cost.vehicles,3);assert.ok(Math.abs(large.cost.transport[0]-r.cost.transport[0]*3)<.03);
});

test('overnight rooms and inter-day positions remain consistent; last day returns to origin',()=>{
 const r=buildItinerary({days:3,people:3,mustVisit:['petra'],pace:'active'},sites);
 assert.equal(r.feasible,true);assert.equal(r.days.length,3);assert.equal(r.days.at(-1).end.id,'amman');
 for(let i=1;i<r.days.length;i++)assert.deepEqual(r.days[i].start,r.days[i-1].end);
 for(const day of r.days){const dailyRoute=r.route.filter(point=>point.day===day.day);assert.equal(dailyRoute[0].id,day.start.id);assert.equal(dailyRoute.at(-1).id,day.end.id);}
 assert.equal(r.cost.rooms,2);const nights=r.days.slice(0,-1).filter(d=>d.end.id!=='amman').length;assert.equal(r.cost.nights,nights);assert.equal(r.cost.lodging[0],nights*2*35);
 for(const d of r.days)assert.ok(d.totalHours<=10.01);
 const pd=r.days.find(d=>d.stops.some(s=>s.id==='petra'));assert.equal(pd.stops[0].id,'petra');assert.equal(pd.stops.length,1);assert.ok(pd.stops[0].durationHours>=7);assert.equal(pd.stops[0].arrival,'09:00');
});

test('Ajloun, Petra and Aqaba cannot silently become a one-day trip',()=>{
 const r=buildItinerary({days:1,mustVisit:['ajloun','petra','aqaba']},sites);
 assert.equal(r.feasible,false);assert.ok(r.unplannedMandatory.includes('petra'));assert.ok(r.unplannedMandatory.includes('aqaba'));assert.equal(r.profile.mustVisit.length,3);assert.ok(r.warnings.some(w=>w.includes('تعذّر')));assert.ok(r.days.every(d=>d.totalHours<=9.01));
});

test('a distant full-day visit needs a transfer, while one-way plans retain their final location',()=>{
 const impossible=buildItinerary({days:1,mustVisit:['petra'],roundTrip:false},sites);assert.equal(impossible.feasible,false);
 const oneWay=buildItinerary({days:2,mustVisit:['petra'],roundTrip:false},sites);assert.equal(oneWay.feasible,true);assert.equal(oneWay.days.at(-1).end.id,'petra');
 const fromAqaba=buildItinerary({days:1,originId:'aqaba',mustVisit:['aqaba'],roundTrip:true},sites);assert.equal(fromAqaba.days[0].start.id,'aqaba');assert.equal(fromAqaba.days[0].end.id,'aqaba');
});

test('budget selection tries a cheaper nearby itinerary, rather than only warning',()=>{
 const catalog=[place('cheap','قريب مجاني',31.96,35.91,2,entry(0,0)),place('expensive','بعيد مكلف',32.05,35.91,2,entry(25,40))];
 const rates={foodPerPersonDay:[0,0],ownCarPerKm:[.1,.1],roomPerNight:[0,0]};
 const open=buildItinerary({days:1,people:2,rates},catalog,['expensive']);assert.ok(open.days[0].stops.some(s=>s.id==='expensive'));
 const tight=buildItinerary({days:1,people:2,budget:5,rates},catalog,['expensive']);assert.equal(tight.budgetStatus,'within');assert.ok(tight.cost.total[1]<=5);assert.ok(tight.days[0].stops.every(s=>s.id!=='expensive'));
 const forced=buildItinerary({days:1,people:2,budget:5,rates,mustVisit:['expensive']},catalog);assert.equal(forced.budgetStatus,'over');assert.equal(forced.feasible,true);assert.ok(forced.days[0].stops.some(s=>s.id==='expensive'));
});

test('unknown is never converted to free; zero requires explicit source evidence',()=>{
 for(const price of [entry(null,null),{jordanian:0,foreign:0}]){
  const r=buildItinerary({days:1,people:1,budget:1000,mustVisit:['unknown']},[place('unknown','رسم غير متحقق',origin.lat,origin.lng,2,price)]);
  assert.equal(r.cost.entryKnown,0);assert.equal(r.cost.partial,true);assert.equal(r.budgetStatus,'uncertain');assert.ok(r.cost.unknown.some(x=>x.required));
 }
 const free=buildItinerary({days:1,people:1,budget:1000,mustVisit:['free']},[place('free','مجاني مثبت',origin.lat,origin.lng,2,entry(0,0))]);assert.equal(free.cost.partial,false);assert.equal(free.cost.entryItems[0].perPerson,0);
 const foreign=buildItinerary({days:1,people:1,budget:1000,originId:'petra',nationality:'foreign',mustVisit:['petra']},sites);assert.equal(foreign.cost.partial,true);assert.equal(foreign.budgetStatus,'uncertain');
});

test('maps use real coordinate directions and public transport remains explicitly uncertain',()=>{
 const r=buildItinerary({days:1,mustVisit:['jerash'],transport:'public'},sites),url=new URL(r.directionsUrl);
 assert.equal(url.origin,'https://www.google.com');assert.equal(url.pathname,'/maps/dir/');assert.equal(url.searchParams.get('api'),'1');assert.match(url.searchParams.get('origin'),/^31\./);assert.equal(url.searchParams.get('origin'),url.searchParams.get('destination'));assert.ok(url.searchParams.get('waypoints').includes('32.28,35.9'));
 assert.ok(r.warnings.some(w=>w.includes('النقل العام')));assert.deepEqual(r.cost.transport,[12,32]);
});

test('Amman/Citadel requests have one specific stop and unknown IDs remain visible',()=>{
 const catalog=[place('amman','عمّان',origin.lat,origin.lng,4,entry(null,null)),place('citadel','قلعة عمّان',31.954,35.935,2,entry(.25,3))];
 const r=buildItinerary({days:1,mustVisit:['amman','citadel']},catalog);assert.equal(r.feasible,true);assert.deepEqual(r.days[0].stops.map(s=>s.id),['citadel']);assert.equal(r.cost.entryKnown,.5);assert.ok(r.warnings.some(w=>w.includes('جُمعت')));
 const unknown=buildItinerary({days:1,mustVisit:['missing']},catalog);assert.equal(unknown.feasible,false);assert.ok(unknown.unplannedMandatory.includes('missing'));
});

test('malformed data never produces NaN, blank plans are not labeled feasible, inputs stay immutable',()=>{
 const catalog=[null,{id:'bad',lat:Infinity,lng:0},place('good','جيد',origin.lat,origin.lng),place('good','نسخة',origin.lat,origin.lng)],input={days:1,people:2,mustVisit:['good']};
 const before=JSON.stringify({input,catalog}),result=buildItinerary(input,catalog);assert.equal(JSON.stringify({input,catalog}),before);assert.ok(!JSON.stringify(result).includes('NaN'));assert.ok(result.warnings.some(w=>w.includes('غير صالحة')));
 assert.equal(buildItinerary({days:1},[]).feasible,false);assert.deepEqual(buildItinerary(input,catalog),buildItinerary(input,catalog));
});

test('English plans localize generated text while preserving routes, costs and uncertainty',()=>{
 const facts=r=>({profile:r.profile,days:r.days.map(d=>({...d,stops:d.stops.map(({reason,...stop})=>stop),start:{...d.start,name:undefined},end:{...d.end,name:undefined}})),route:r.route.map(({name,...point})=>point),cost:{...r.cost,assumptions:undefined,entryItems:r.cost.entryItems.map(({label,note,...item})=>item),unknown:r.cost.unknown.map(({label,note,...item})=>item)},sources:r.sources.map(({label,...source})=>source),budgetStatus:r.budgetStatus,directionsUrl:r.directionsUrl,feasible:r.feasible,unplannedMandatory:r.unplannedMandatory});
 const before=JSON.stringify(CATALOG),profiles=[
  {days:1,people:2,mustVisit:['ajloun'],transport:'car'},
  {days:1,people:9,mustVisit:['citadel','amman'],transport:'driver',startDate:'2026-10-05',budget:5},
  {days:1,originId:'petra',nationality:'foreign',mustVisit:['petra'],transport:'public'},
  {days:1,originId:'missing',mustVisit:['ajloun','petra','aqaba','missing'],transport:'public'},
  {days:7,pace:'active',people:1,mustVisit:['petra','aqaba'],roundTrip:true}
 ];
 for(const profile of profiles){
  const ar=buildItinerary(profile,CATALOG),en=buildItinerary(profile,CATALOG,[],{locale:'en'});
  assert.deepEqual(facts(en),facts(ar));assert.doesNotMatch(JSON.stringify(en),/[\u0600-\u06ff]/);assert.match(en.title,/days? from /);
 }
 assert.equal(JSON.stringify(CATALOG),before);
 const empty=buildItinerary({days:1},[],[],{locale:'en'});assert.equal(empty.title,'1 day from Amman');assert.equal(empty.feasible,false);assert.doesNotMatch(JSON.stringify(empty),/[\u0600-\u06ff]/);
 const malformed=buildItinerary({days:1},[null,CATALOG[0],CATALOG[0]],[],{locale:'en'});assert.ok(malformed.warnings.some(w=>w.includes('Duplicate or invalid')));
});

test('English local parser warnings remain explicit and use English place aliases',()=>{
 const catalog=[{...sites[4],en:'Amman'},{...sites[2],en:'Petra'}];
 const parsed=parseLocalMessage('9 days, 20 people, budget 150 JOD, from Amman, 2026-02-30',{},catalog,{locale:'en'});
 assert.equal(parsed.mode,'local');assert.equal(parsed.profile.days,7);assert.equal(parsed.profile.people,12);assert.equal(parsed.profile.budget,150);assert.equal(parsed.profile.originId,'amman');assert.equal(parsed.profile.startDate,null);assert.equal(parsed.warnings.length,3);assert.doesNotMatch(parsed.warnings.join(' '),/[\u0600-\u06ff]/);
 const unchanged=parseLocalMessage('Hello',{},catalog,{locale:'en'});assert.equal(unchanged.understood,false);assert.match(unchanged.warnings[0],/local parser/);assert.doesNotMatch(unchanged.warnings[0],/[\u0600-\u06ff]/);
 const legacy=parseLocalMessage('Hello',{},catalog);assert.match(legacy.warnings[0],/[\u0600-\u06ff]/);
});

test('English local requests parse trip details, interests and explicit exclusions',()=>{
 const result=parseLocalMessage('2 days, 4 people, budget is 150 JOD, from Amman. Skip Ajloun, exclude Petra; nature and beaches, no history. One-way.',{mustVisit:['ajloun','petra'],interests:['history']},CATALOG,{locale:'en'});
 assert.equal(result.mode,'local');assert.equal(result.understood,true);assert.equal(result.profile.days,2);assert.equal(result.profile.people,4);assert.equal(result.profile.budget,150);assert.equal(result.profile.originId,'amman');assert.equal(result.profile.roundTrip,false);assert.deepEqual(result.profile.mustVisit,[]);assert.deepEqual(result.profile.interests,['nature','sea']);assert.deepEqual(result.warnings,[]);
 const updated=parseLocalMessage('From Aqaba, our car, round-trip, flexible budget. Include history, culture, adventure and relaxation.',result.profile,CATALOG,{locale:'en'});
 assert.equal(updated.profile.originId,'aqaba');assert.equal(updated.profile.transport,'car');assert.equal(updated.profile.roundTrip,true);assert.equal(updated.profile.budget,null);assert.deepEqual(updated.profile.interests,['nature','sea','history','culture','adventure','relax']);
 const list=parseLocalMessage('Exclude Petra and Ajloun, but include Jerash.',{mustVisit:['petra','ajloun']},CATALOG,{locale:'en'});assert.deepEqual(list.profile.mustVisit,['jerash']);
 const words=parseLocalMessage('A day-trip, solo, public transport, 90 JD, forests and hiking.',{},CATALOG,{locale:'en'});assert.equal(words.profile.days,1);assert.equal(words.profile.people,1);assert.equal(words.profile.transport,'public');assert.equal(words.profile.budget,90);assert.ok(words.profile.interests.includes('adventure'));
});

test('English keywords use word boundaries and not-only does not exclude an interest',()=>{
 const previous={interests:['culture'],mustVisit:[],pace:'balanced',transport:'car'},unmatched=parseLocalMessage('The beachside hotel has interactive workshops and salted food.',previous,CATALOG,{locale:'en'});
 assert.equal(unmatched.understood,false);assert.deepEqual(unmatched.profile.interests,['culture']);assert.deepEqual(unmatched.profile.mustVisit,[]);assert.equal(unmatched.profile.pace,'balanced');assert.equal(unmatched.profile.transport,'car');
 const interest=parseLocalMessage('Not only nature.',{interests:['culture']},CATALOG,{locale:'en'});assert.deepEqual(interest.profile.interests,['culture','nature']);
});

console.log(`${tests} itinerary tests passed.`);




import test,{before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeProfile} from '../public/js/itinerary.js';
import {CATALOG} from '../public/js/catalog.js';

const address=process.env.FIRESTORE_EMULATOR_HOST;
if(!address){
 test('Firestore owner-isolation and schema rules require the local emulator',{skip:'FIRESTORE_EMULATOR_HOST absent: rules have NOT been compiled or executed.'},()=>{});
}else{
 const match=/^(127\.0\.0\.1|localhost|\[::1\]):(\d{1,5})$/.exec(address);
 assert(match,'Rules tests only accept a loopback Firestore emulator.');
 const port=Number(match[2]);assert(port>0&&port<=65535,'Valid local emulator port required.');
 let testing,sdk;
 try{[testing,sdk]=await Promise.all([import('@firebase/rules-unit-testing'),import('firebase/firestore')]);}
 catch(cause){throw new Error('Emulator test prerequisites missing: install firebase and @firebase/rules-unit-testing in your development environment. Rules tests did not run.',{cause});}
 const {initializeTestEnvironment,assertSucceeds,assertFails}=testing;
 const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,serverTimestamp,Timestamp}=sdk;
 let environment;
 const prefs=()=>normalizeProfile({days:2,people:3,mustVisit:['ajloun'],startDate:'2028-02-29'},CATALOG);
 const record=(changes={})=>({version:1,savedIds:['ajloun'],tripProfile:prefs(),tripStopIds:['ajloun'],title:'رحلة الشمال',updatedAt:serverTimestamp(),...changes});
 const db=uid=>uid?environment.authenticatedContext(uid).firestore():environment.unauthenticatedContext().firestore();
 const ref=(database,uid='alice')=>doc(database,'users',uid,'plans','current');
 before(async()=>{environment=await initializeTestEnvironment({projectId:'demo-darb-security',firestore:{host:match[1].replace(/^\[|\]$/g,''),port,rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});});
 beforeEach(async()=>environment.clearFirestore());
 after(async()=>{await environment?.cleanup();});

 test('owner can create, read, replace and delete the canonical current document',async()=>{
  const database=db('alice'),plan=ref(database);
  await assertSucceeds(setDoc(plan,record()));await assertSucceeds(getDoc(plan));
  await assertSucceeds(setDoc(plan,record({savedIds:['petra'],title:'رحلة جديدة'})));
  await assertSucceeds(deleteDoc(plan));
 });
 test('unauthenticated requests and other users cannot read, write or delete an owner plan',async()=>{
  await assertSucceeds(setDoc(ref(db('alice')),record()));
  for(const user of [null,'bob']){
   const plan=ref(db(user));
   await assertFails(getDoc(plan));await assertFails(setDoc(plan,record()));
   await assertFails(updateDoc(plan,{title:'تغيير',updatedAt:serverTimestamp()}));await assertFails(deleteDoc(plan));
  }
 });
 test('UID path controls ownership and undeclared paths/collection listings stay denied',async()=>{
  const database=db('alice');await assertSucceeds(setDoc(ref(database),record()));
  await assertFails(setDoc(ref(database,'bob'),record()));
  await assertFails(getDocs(collection(database,'users','alice','plans')));
  await assertFails(getDocs(collection(database,'users')));
  await assertFails(setDoc(doc(database,'users','alice','plans','another'),record()));
  await assertFails(setDoc(doc(database,'users','alice'),{admin:true}));
  await assertFails(setDoc(doc(database,'public','plan'),record()));
 });
 test('favorites-only records and numeric/rate boundaries are valid',async()=>{
  const plan=ref(db('alice'));
  await assertSucceeds(setDoc(plan,record({tripProfile:null,tripStopIds:[]})));
  const profile=prefs();profile.days=7;profile.people=12;profile.budget=1000000;profile.rates.foodPerPersonDay=[0,10000];
  await assertSucceeds(setDoc(plan,record({savedIds:CATALOG.map(place=>place.id),tripProfile:profile})));
 });
 test('schema prevents top-level privilege, cost, chat and URL injection',async()=>{
  const plan=ref(db('alice'));
  for(const key of ['ownerId','uid','role','cost','directionsUrl','messages','html'])await assertFails(setDoc(plan,record({[key]:'untrusted'})));
  const missing=record();delete missing.savedIds;await assertFails(setDoc(plan,missing));
  await assertFails(setDoc(plan,record({version:2})));await assertFails(setDoc(plan,record({version:'1'})));
 });
 test('all writes must have a server timestamp, including partial updates',async()=>{
  const plan=ref(db('alice'));await assertSucceeds(setDoc(plan,record()));
  await assertFails(setDoc(plan,record({updatedAt:Timestamp.fromMillis(0)})));
  await assertFails(setDoc(plan,record({updatedAt:'2026-09-28T12:00:00Z'})));
  await assertFails(updateDoc(plan,{title:'بدون وقت خادم'}));
  await assertSucceeds(updateDoc(plan,{title:'مع وقت خادم',updatedAt:serverTimestamp()}));
 });
 test('malformed IDs and profile/stop relationships cannot be stored',async()=>{
  const plan=ref(db('alice'));
  for(const value of [['unknown'],['ajloun','ajloun'],[{id:'ajloun'}],Array(19).fill('ajloun'),'ajloun',null]){
   await assertFails(setDoc(plan,record({savedIds:value})));
   await assertFails(setDoc(plan,record({tripStopIds:value})));
   await assertFails(setDoc(plan,record({tripProfile:{...prefs(),mustVisit:value}})));
  }
  await assertFails(setDoc(plan,record({tripProfile:null,tripStopIds:['ajloun']})));
 });
 test('profile ranges, types, enums and nested allowlists are enforced',async()=>{
  const plan=ref(db('alice'));
  const mutations=[['days',0],['days',8],['days',1.5],['days','2'],['people',13],['people',0],['budget',-1],['budget',1000001],['budget','100'],['originId','unknown'],['interests',[]],['interests',['nature','nature']],['interests',['admin']],['roundTrip','false'],['pace','fast'],['nationality','admin'],['transport','plane'],['startDate','2026-13-01'],['startDate','tomorrow']];
  for(const[key,value]of mutations)await assertFails(setDoc(plan,record({tripProfile:{...prefs(),[key]:value}})));
  await assertFails(setDoc(plan,record({tripProfile:{...prefs(),admin:true}})));
  const missing=prefs();delete missing.people;await assertFails(setDoc(plan,record({tripProfile:missing})));
 });
 test('rate fields cannot contain arbitrary maps, reversed pairs or nonfinite values',async()=>{
  const plan=ref(db('alice'));
  for(const pair of [[20,10],[-1,20],[0,10001],[NaN,2],[1,Infinity],['1',2],[1],[1,2,3],null])await assertFails(setDoc(plan,record({tripProfile:{...prefs(),rates:{...prefs().rates,foodPerPersonDay:pair}}})));
  await assertFails(setDoc(plan,record({tripProfile:{...prefs(),rates:{...prefs().rates,extra:[0,0]}}})));
 });
 test('titles reject excess length and unusable control/whitespace content',async()=>{
  const plan=ref(db('alice'));
  for(const title of ['', '   ','x'.repeat(161),'line\nbreak','null\0byte',42])await assertFails(setDoc(plan,record({title})));
 });
}

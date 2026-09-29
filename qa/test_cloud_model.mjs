import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizePlanPayload,sanitizeStoredPlan,validateCloudProfile,CloudDataError} from '../public/js/cloud-model.js';
import {normalizeProfile,buildItinerary} from '../public/js/itinerary.js';
import {CATALOG} from '../public/js/catalog.js';
import {createFirebaseClient,resolveFirebaseConfig} from '../public/js/firebase-client.js';
const profile=()=>normalizeProfile({days:2,people:3,mustVisit:['ajloun'],startDate:'2028-02-29'},CATALOG);
const payload=()=>({savedIds:['ajloun','jerash'],tripProfile:profile(),tripStopIds:['ajloun','jerash'],title:'رحلة الشمال'});
const stored=()=>({version:1,...payload(),updatedAt:{seconds:1790596800,nanoseconds:123000000}});
const invalid=fn=>assert.throws(fn,e=>e instanceof CloudDataError&&e.code==='CLOUD_INVALID_DATA');
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};

test('favorites-only save is explicit, canonical and detached from its input',()=>{
 const input=freeze({savedIds:['ajloun']}),clean=sanitizePlanPayload(input);
 assert.deepEqual(clean,{savedIds:['ajloun'],tripProfile:null,tripStopIds:[],title:'رحلتي في درب'});
 assert.notEqual(clean.savedIds,input.savedIds);clean.savedIds.push('jerash');assert.deepEqual(input.savedIds,['ajloun']);
 for(const x of [{},null,[]])invalid(()=>sanitizePlanPayload(x));
});
test('canonical profiles round-trip without mutation or shared nested arrays',()=>{
 const input=freeze(payload()),clean=sanitizePlanPayload(input);assert.deepEqual(clean,input);
 assert.notEqual(clean.tripProfile,input.tripProfile);assert.notEqual(clean.tripProfile.interests,input.tripProfile.interests);
 assert.notEqual(clean.tripProfile.rates.roomPerNight,input.tripProfile.rates.roomPerNight);
 assert.deepEqual(validateCloudProfile(profile()),profile());assert.equal(sanitizePlanPayload({savedIds:CATALOG.map(p=>p.id)}).savedIds.length,18);
});
test('numeric limits reject coercion, fractions and nonfinite values',()=>{
 for(const[key,values]of Object.entries({days:[0,8,1.2,'2',null,NaN,Infinity],people:[0,13,2.5,'3',null,NaN],budget:[-1,1000001,'100',NaN,Infinity,-Infinity]}))for(const value of values)invalid(()=>validateCloudProfile({...profile(),[key]:value}));
 for(const value of [null,0,1000000])assert.equal(validateCloudProfile({...profile(),budget:value}).budget,value);
 assert.equal(validateCloudProfile({...profile(),days:7,people:12}).people,12);
});
test('destination references reject unknown IDs, duplicates, objects and oversized lists',()=>{
 for(const value of [['ajloun','ajloun'],['missing'],['../users/other'],['https://attacker.test'],[{id:'ajloun'}],Array(19).fill('ajloun'),'ajloun',null]){
  invalid(()=>sanitizePlanPayload({...payload(),savedIds:value}));invalid(()=>sanitizePlanPayload({...payload(),tripStopIds:value}));invalid(()=>validateCloudProfile({...profile(),mustVisit:value}));
 }
 invalid(()=>validateCloudProfile({...profile(),originId:'unknown'}));invalid(()=>sanitizePlanPayload({savedIds:[],tripStopIds:['ajloun']}));
});
test('data cannot smuggle costs, URLs, HTML, chat, privileges or arbitrary fields',()=>{
 for(const key of ['cost','directionsUrl','html','messages','role','ownerId','uid','__proto__']){
  const input=payload();Object.defineProperty(input,key,{value:'https://attacker.test',enumerable:true});invalid(()=>sanitizePlanPayload(input));
  const snapshot=stored();Object.defineProperty(snapshot,key,{value:{total:[0,0]},enumerable:true});invalid(()=>sanitizeStoredPlan(snapshot));
 }
 invalid(()=>validateCloudProfile({...profile(),admin:true}));invalid(()=>validateCloudProfile({...profile(),rates:{...profile().rates,custom:[0,0]}}));
 const missing=profile();delete missing.people;invalid(()=>validateCloudProfile(missing));
});
test('rates are complete ordered finite pairs',()=>{
 for(const pair of [[20,10],[-1,20],[0,10001],[NaN,2],[1,Infinity],['1',2],[1],[1,2,3],null,{0:1,1:2}])invalid(()=>validateCloudProfile({...profile(),rates:{...profile().rates,foodPerPersonDay:pair}}));
 const rates=profile().rates;delete rates.roomPerNight;invalid(()=>validateCloudProfile({...profile(),rates}));
 assert.deepEqual(validateCloudProfile({...profile(),rates:{...profile().rates,foodPerPersonDay:[0,10000]}}).rates.foodPerPersonDay,[0,10000]);
});
test('profile enums, booleans, interests and real dates are validated',()=>{
 for(const[key,value]of [['pace','fast'],['nationality','admin'],['transport','plane'],['roundTrip','false'],['roundTrip',0],['startDate','2026-02-29'],['startDate','2026-02-30'],['startDate','2026-13-01'],['startDate','tomorrow'],['startDate',1790596800],['interests',[]],['interests',['nature','nature']],['interests',['unknown']],['interests','nature']])invalid(()=>validateCloudProfile({...profile(),[key]:value}));
 assert.equal(validateCloudProfile(profile()).startDate,'2028-02-29');assert.equal(validateCloudProfile({...profile(),roundTrip:false,startDate:null}).roundTrip,false);
});
test('titles have a length/control-character limit and remain plain text',()=>{
 for(const title of ['', '   ','x'.repeat(161),'line\nbreak','tab\ttext','null\0byte',12,null])invalid(()=>sanitizePlanPayload({...payload(),title}));
 assert.equal(sanitizePlanPayload({...payload(),title:'  رحلة  '}).title,'رحلة');
 assert.equal(sanitizePlanPayload({...payload(),title:'<img src=x onerror=alert(1)>'}).title,'<img src=x onerror=alert(1)>');

});
test('stored document version, envelope and timestamps fail closed',()=>{
 assert.match(sanitizeStoredPlan(stored()).updatedAt,/^\d{4}-\d{2}-\d{2}T/);
 assert.equal(sanitizeStoredPlan({...stored(),updatedAt:'2026-09-28T12:00:00Z'}).updatedAt,'2026-09-28T12:00:00.000Z');
 for(const value of [0,2,'1',null])invalid(()=>sanitizeStoredPlan({...stored(),version:value}));
 for(const value of [null,0,'yesterday','2026-02-30T12:00:00Z',{seconds:1.5,nanoseconds:0},{seconds:1,nanoseconds:-1},{seconds:1,nanoseconds:1000000000},{seconds:NaN,nanoseconds:0}])invalid(()=>sanitizeStoredPlan({...stored(),updatedAt:value}));
 const missing=stored();delete missing.updatedAt;invalid(()=>sanitizeStoredPlan(missing));const original=freeze(stored());sanitizeStoredPlan(original);assert.deepEqual(original,stored());
});
test('restore rebuilds costs and route URLs from current catalog inputs',()=>{
 const fee=n=>({jordanian:n,foreign:n,source:'https://example.test/fees',checkedAt:'2026-09-28'});
 const sites=[{id:'amman',ar:'عمّان',lat:31.9539,lng:35.9106,tags:['culture'],visitHours:2,entry:fee(0)},{id:'ajloun',ar:'عجلون',lat:31.96,lng:35.92,tags:['nature'],visitHours:2,entry:fee(3)}];
 const prefs=normalizeProfile({days:1,people:2,originId:'amman',mustVisit:['ajloun']},sites);
 const record={version:1,savedIds:['ajloun'],tripProfile:prefs,tripStopIds:['ajloun'],title:'رحلة',updatedAt:'2026-09-28T12:00:00Z'};
 const restored=sanitizeStoredPlan(record,sites),before=buildItinerary(restored.tripProfile,sites,restored.tripStopIds),fresh=structuredClone(sites);fresh[1].entry=fee(9);
 const rebuilt=buildItinerary(restored.tripProfile,fresh,restored.tripStopIds);assert.equal(before.cost.entryKnown,6);assert.equal(rebuilt.cost.entryKnown,18);
 assert.equal(new URL(rebuilt.directionsUrl).origin,'https://www.google.com');assert(!Object.hasOwn(restored,'cost'));assert(!Object.hasOwn(restored,'directionsUrl'));
 invalid(()=>sanitizeStoredPlan({...record,cost:{total:[0,0]},directionsUrl:'javascript:alert(1)'},sites));
});


const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fakeClient(options={}){
 const calls=[],committed=[],watchers=new Set(),apps=[],auth={currentUser:options.user??null};
 const control={calls,committed,auth,online:true,read:async()=>({exists:()=>true,data:stored,metadata:{fromCache:false,hasPendingWrites:false}}),transactionGet:async()=>({exists:()=>false}),commit:async()=>{},linkError:null};
 control.changeUser=user=>{auth.currentUser=user;for(const callback of watchers)callback(user);};
 const config={apiKey:'public-web-config-key',projectId:'demo-darb-security',authDomain:'demo-darb-security.firebaseapp.com',appId:'1:123:web:abc'};
 const modules={
  app:{getApps:()=>apps,initializeApp:(opts,name)=>{calls.push('initialize');const app={name,options:opts};apps.push(app);return app;}},
  auth:{getAuth:()=>auth,onAuthStateChanged:(_auth,callback)=>{watchers.add(callback);queueMicrotask(()=>{if(watchers.has(callback))callback(auth.currentUser);});return()=>watchers.delete(callback);},
   signInAnonymously:async()=>{calls.push('anonymous');control.changeUser({uid:'guest-a',isAnonymous:true});},
   GoogleAuthProvider:class{setCustomParameters(value){calls.push(['provider-parameters',value]);}},
   linkWithPopup:async user=>{calls.push(['link',user.uid]);if(control.linkError)throw control.linkError;control.changeUser({...user,isAnonymous:false,displayName:'Traveler'});},
   signInWithPopup:async()=>{calls.push('google-sign-in');control.changeUser({uid:'google-b',isAnonymous:false});},
   signOut:async()=>{calls.push('sign-out');control.changeUser(null);}},
  firestore:{getFirestore:()=>({test:true}),doc:(_db,...parts)=>({path:parts.join('/')}),serverTimestamp:()=>({serverTimestamp:true}),
   getDocFromServer:async ref=>{calls.push(['get-server',ref.path]);return control.read(ref);},
   runTransaction:async(_db,body)=>{calls.push('transaction');const staged=[];await body({get:async ref=>{calls.push(['transaction-get',ref.path]);return control.transactionGet(ref);},set:(ref,data)=>staged.push({op:'set',path:ref.path,data}),delete:ref=>staged.push({op:'delete',path:ref.path})});await control.commit();committed.push(...staged);return undefined;}}
 };
 const client=createFirebaseClient({resolveConfig:async()=>{calls.push('config');return config;},loadModules:async()=>{calls.push('modules');return modules;},appCheckSiteKey:'',isOnline:()=>control.online,...options.clientOptions});
 return {...control,client,control,config,modules};
}

test('SDK initialization restores an existing session without creating accounts or writing data',async t=>{
 const h=fakeClient();t.after(()=>h.client.dispose());assert.deepEqual(h.calls,[]);
 const [a,b]=await Promise.all([h.client.getFirebaseContext(),h.client.getFirebaseContext()]);assert.equal(a,b);
 assert.equal(h.calls.filter(c=>c==='initialize').length,1);assert.equal(h.calls.filter(c=>c==='modules').length,1);
 assert(!h.calls.includes('anonymous'));assert(!h.calls.includes('transaction'));assert.equal(h.client.getCloudState().uid,null);
 await assert.rejects(h.client.saveCloudTrip(payload()),{code:'CLOUD_AUTH_REQUIRED'});assert.equal(h.committed.length,0);
});
test('guest creation requires an explicit action and is not repeated for an existing session',async t=>{
 const h=fakeClient();t.after(()=>h.client.dispose());await h.client.connectGuest();await h.client.connectGuest();
 assert.equal(h.calls.filter(c=>c==='anonymous').length,1);assert.equal(h.client.getCloudState().uid,'guest-a');assert.equal(h.committed.length,0);
});
test('save reports success only after transaction acknowledgement at the current UID path',async t=>{
 const h=fakeClient({user:{uid:'alice',isAnonymous:false}});t.after(()=>h.client.dispose());const gate=deferred();h.control.commit=()=>gate.promise;
 let complete=false;const pending=h.client.saveCloudTrip(payload()).then(value=>{complete=true;return value;});await tick();
 assert.equal(complete,false);assert.equal(h.committed.length,0);gate.resolve();const result=await pending;
 assert.equal(result.saved,true);assert.equal(h.committed[0].path,'users/alice/plans/current');assert.equal(h.committed[0].data.version,1);
 assert.deepEqual(h.committed[0].data.updatedAt,{serverTimestamp:true});assert(!Object.hasOwn(h.committed[0].data,'cost'));
});
test('offline and server-rejected writes never return saved=true or queue a client write',async t=>{
 const h=fakeClient({user:{uid:'alice'}});t.after(()=>h.client.dispose());h.control.online=false;
 await assert.rejects(h.client.saveCloudTrip(payload()),{code:'CLOUD_OFFLINE'});assert.deepEqual(h.calls,[]);
 h.control.online=true;h.control.commit=async()=>{throw Object.assign(new Error('offline'),{code:'unavailable'});};
 await assert.rejects(h.client.saveCloudTrip(payload()),{code:'CLOUD_UNAVAILABLE'});assert.equal(h.committed.length,0);
});
test('write timeout is unconfirmed and retains its pending lock until the original transaction settles',async t=>{
 const h=fakeClient({user:{uid:'alice'},clientOptions:{writeTimeoutMs:15}});t.after(()=>h.client.dispose());const gate=deferred();h.control.commit=()=>gate.promise;
 await assert.rejects(h.client.saveCloudTrip(payload()),{code:'CLOUD_WRITE_UNCONFIRMED'});assert.equal(h.client.getCloudState().writePending,true);
 await assert.rejects(h.client.saveCloudTrip(payload()),{code:'CLOUD_WRITE_PENDING'});await assert.rejects(h.client.deleteCloudTrip(),{code:'CLOUD_WRITE_PENDING'});
 assert.equal(h.calls.filter(c=>c==='transaction').length,1);gate.resolve();await tick();
 assert.equal(h.client.getCloudState().writePending,false);assert.equal(h.committed.length,1);
 assert.notEqual(h.client.getCloudState().error,null,'A late commit must not silently announce save success after timeout.');
});
test('loads reject malformed documents, local cache and pending writes',async t=>{
 const h=fakeClient({user:{uid:'alice'}});t.after(()=>h.client.dispose());await h.client.getFirebaseContext();
 for(const metadata of [{fromCache:true,hasPendingWrites:false},{fromCache:false,hasPendingWrites:true}]){
  h.control.read=async()=>({exists:()=>true,data:stored,metadata});await assert.rejects(h.client.loadCloudTrip(),{code:'CLOUD_UNCONFIRMED_READ'});
 }
 h.control.read=async()=>({exists:()=>true,data:()=>({...stored(),cost:{total:[0,0]}}),metadata:{}});await assert.rejects(h.client.loadCloudTrip(),{code:'CLOUD_INVALID_DATA'});
 h.control.read=async()=>({exists:()=>false,metadata:{}});assert.equal(await h.client.loadCloudTrip(),null);
});
test('old-account reads are rejected even if auth changes A to B and back to A',async t=>{
 const h=fakeClient({user:{uid:'alice'}});t.after(()=>h.client.dispose());await h.client.getFirebaseContext();const gate=deferred();h.control.read=()=>gate.promise;
 const pending=h.client.loadCloudTrip();await tick();h.control.changeUser({uid:'bob'});h.control.changeUser({uid:'alice'});
 gate.resolve({exists:()=>true,data:stored,metadata:{}});await assert.rejects(pending,{code:'CLOUD_AUTH_CHANGED'});
});
test('auth switches during a transaction prevent a staged write and reject late acknowledgements',async t=>{
 const h=fakeClient({user:{uid:'alice'}});t.after(()=>h.client.dispose());await h.client.getFirebaseContext();
 const readGate=deferred();h.control.transactionGet=()=>readGate.promise;
 const first=h.client.saveCloudTrip(payload());await tick();h.control.changeUser({uid:'bob'});readGate.resolve({exists:()=>false});
 await assert.rejects(first,{code:'CLOUD_AUTH_CHANGED'});assert.equal(h.committed.length,0);
 h.control.transactionGet=async()=>({exists:()=>false});const ack=deferred();h.control.commit=()=>ack.promise;
 const second=h.client.saveCloudTrip(payload());await tick();h.control.changeUser({uid:'carol'});ack.resolve();
 await assert.rejects(second,{code:'CLOUD_AUTH_CHANGED'});assert.equal(h.committed[0].path,'users/bob/plans/current');
});
test('anonymous Google linking preserves UID and credential collision never silently switches accounts',async t=>{
 const h=fakeClient({user:{uid:'guest-a',isAnonymous:true}});t.after(()=>h.client.dispose());await h.client.signInGoogle();
 assert.equal(h.client.getCloudState().uid,'guest-a');assert.equal(h.client.getCloudState().isAnonymous,false);assert(!h.calls.includes('google-sign-in'));
 h.control.changeUser({uid:'guest-a',isAnonymous:true});h.control.linkError=Object.assign(new Error('collision'),{code:'auth/credential-already-in-use'});
 await assert.rejects(h.client.signInGoogle(),{code:'CLOUD_ACCOUNT_CONFLICT'});assert.equal(h.client.getCloudState().uid,'guest-a');assert(!h.calls.includes('google-sign-in'));assert.equal(h.committed.length,0);
 await h.client.signInGoogle({replaceAnonymous:true});assert.equal(h.client.getCloudState().uid,'google-b');assert.equal(h.committed.length,0);
});
test('delete uses an acknowledged owner transaction and offline sign-out keeps cloud data',async t=>{
 const h=fakeClient({user:{uid:'alice'}});t.after(()=>h.client.dispose());assert.deepEqual(await h.client.deleteCloudTrip(),{deleted:true});
 assert.deepEqual(h.committed,[{op:'delete',path:'users/alice/plans/current'}]);h.control.online=false;await h.client.signOutCloud();assert.equal(h.client.getCloudState().uid,null);assert.equal(h.committed.length,1);
});
test('public config resolution uses Hosting init data and never needs a secret credential',async()=>{
 let request;const h=fakeClient();
 const config=await resolveFirebaseConfig({explicit:{},fetchImpl:async(url,options)=>{request={url,options};return{ok:true,json:async()=>({...h.config,privateKey:'must-not-copy'})};}});
 assert.equal(request.url,'/__/firebase/init.json');assert.equal(request.options.credentials,'same-origin');assert.equal(request.options.cache,'no-store');assert(!Object.hasOwn(config,'privateKey'));
 await assert.rejects(resolveFirebaseConfig({explicit:{apiKey:'partial'},fetchImpl:()=>assert.fail('must not fetch partial explicit configuration')}),{code:'CLOUD_INVALID_CONFIG'});
 await assert.rejects(resolveFirebaseConfig({explicit:{},fetchImpl:async()=>({ok:false})}),{code:'CLOUD_NOT_CONFIGURED'});
});

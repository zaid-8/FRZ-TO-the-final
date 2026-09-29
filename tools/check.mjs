import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CATALOG} from '../public/js/catalog.js';
import {PHOTOS} from '../public/js/photos.js';
import {DATA,FILTERS,PLANS} from '../public/js/destinations.js';
import {evaluateJourney,cableMeshes,ropeHeight,progressForStation,DEPARTURE,TRAVEL} from '../public/js/journey.js';
import {buildStation} from '../public/js/station.js';
import {MATERIALS} from '../public/js/geometry.js';
import {parseGLB} from '../public/js/render.js';
import {project} from '../public/js/math.js';
import {readPlan,moveStop,filterDestinations} from '../public/js/plan.js';
const expected=['ajloun','jerash','ummqais','pella','ummjimal','salt','iraq','amman','citadel','kharana','madaba','deadsea','karak','dana','shobak','petra','rum','aqaba'];
const photoSources=JSON.parse(fs.readFileSync(new URL('../public/PHOTO_SOURCES.json',import.meta.url),'utf8'));
const supplied=new Map(photoSources.suppliedPhotos.map(p=>[p.src,p]));
const remote=new Map(photoSources.photos.map(p=>[p.id,p]));
const localSources=[],remoteSources=[];
const localAsset=src=>{
 assert(/^assets\/[A-Za-z0-9_./-]+$/.test(src)&&!src.split('/').includes('..'),'Safe packaged asset path: '+src);
 const path=new URL('../public/'+src,import.meta.url);assert(fs.existsSync(path),src);return path;
};
assert.deepEqual(CATALOG.map(d=>d.id),expected);assert.deepEqual(DATA,CATALOG);assert.deepEqual(FILTERS.all,expected);
assert.deepEqual(photoSources.route.map(d=>d.id),expected);
for(const d of DATA){
 assert.equal(d.image,d.photo.src);assert(d.gallery.length>0);assert.equal(d.image,d.gallery[0].src);
 for(const image of d.gallery){
  assert(image.alt,'Every gallery photo needs descriptive text');
  if(image.src.startsWith('assets/')){
   const path=localAsset(image.src),record=supplied.get(image.src);assert(record,'Bundled photo provenance: '+image.src);
   assert.equal(record.destination,d.id);assert.equal(record.originalFilename,image.originalFilename);
   assert(record.width>0&&record.height>0&&record.inspected&&record.bytesUnchanged);
   assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'),record.sha256,'Bundled source bytes match inspected upload');
   assert.equal(record.sourceType,'user-provided');assert.equal(record.licenseVerified,false);assert.equal(record.licenseIdentifier,null);
   assert.equal(d.photo.licenseUrl,'');assert(!/CC BY|CC0/.test(d.photo.license));localSources.push(image.src);
  }else{
   assert(image.src.startsWith('https://upload.wikimedia.org/'));
   assert(d.photo.source.startsWith('https://commons.wikimedia.org/wiki/File:'));
   assert(d.photo.author&&d.photo.license&&d.photo.licenseUrl.startsWith('https://creativecommons.org/'));
   const record=remote.get(d.id);assert(record?.activeInCatalog);assert.equal(record.author,d.photo.author);assert.equal(record.source,d.photo.source);assert.equal(record.license,d.photo.license);
   remoteSources.push(image.src);
  }
 }
 assert(d.source.startsWith('https://'));assert(d.map.startsWith('https://'));assert.equal(d.index,expected.indexOf(d.id));
}
assert.equal(localSources.length,45);assert.equal(new Set(localSources).size,supplied.size);assert.equal(remoteSources.length,7);
for(const [id,photo] of Object.entries(PHOTOS)){const record=remote.get(id);assert(record,'Preserved Commons credit: '+id);for(const key of ['author','source','license','licenseUrl'])assert.equal(record[key],photo[key]);}
const usedFilenames=new Set(photoSources.suppliedPhotos.map(p=>p.originalFilename));
for(const excluded of photoSources.excludedSuppliedPhotos){assert(!usedFilenames.has(excluded.originalFilename));assert.equal(excluded.used,false);assert(excluded.reason);}
for(const ref of photoSources.references){localAsset(ref.src);assert.equal(ref.sourceType,'user-provided');assert.equal(ref.license,null);}
for(const ids of Object.values(FILTERS)){assert.equal(ids.length,new Set(ids).size);for(const id of ids)assert(expected.includes(id));}
assert(FILTERS.sea.includes('aqaba')&&FILTERS.sea.includes('deadsea'));assert(FILTERS.relax.includes('deadsea'));
for(const p of Object.values(PLANS))for(const item of p.items)assert(expected.includes(item[1]));
const b=fs.readFileSync(new URL('../public/assets/models/darb-cabin.glb',import.meta.url));const cabin=parseGLB(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
assert.equal(cabin.meshes.filter(m=>m.material==='glass').length,1);assert(cabin.meshes.some(m=>m.material==='cabinRed'));assert(!cabin.meshes.some(m=>m.material==='orange'));
assert.deepEqual(cabin.anchor,[-.12,2.7658,0]);
assert(cabin.meshes.reduce((n,m)=>n+m.data.length/18,0)<60000,'Cabin stays within the agreed mesh budget');
for(const m of cabin.meshes)for(let i=0;i<m.data.length;i+=6)assert(Math.abs(Math.hypot(...m.data.slice(i+3,i+6))-1)<.002,'Cabin normals remain normalized');
const rope=cableMeshes();assert.deepEqual(rope,cableMeshes());
for(const m of [...cabin.meshes,...buildStation(),...rope]){assert(MATERIALS[m.material],m.material);assert(m.data.every(Number.isFinite));}
const sampleStates=[];
for(const [w,h] of [[1440,900],[1920,1080],[390,844],[360,660],[600,800],[720,900],[430,740],[2560,1080]])for(let j=0;j<=240;j++){
 const p=j/240,s=evaluateJourney(p,w,h),again=evaluateJourney(p,w,h);
 assert.deepEqual(s.center,again.center);assert(s.center.every(Number.isFinite));assert(s.vp.every(Number.isFinite));
 const local=[...cabin.anchor,1],transformed=[0,0,0];for(let r=0;r<3;r++)for(let c=0;c<4;c++)transformed[r]+=s.matrix[c*4+r]*local[c];
 assert(Math.hypot(...s.anchor.map((x,k)=>x-transformed[k]))<.00006,'Hanger must stay on fixed rope');
 assert.equal(s.anchor[1],ropeHeight(s.routeX));
 const anchor=project(s.anchor,s.vp);assert(anchor[0]>-.8&&anchor[0]<.5&&anchor[1]>.45&&anchor[1]<.8,'Anchor remains clear of screen edges');

 for(const edge of [-1,1]){let lo=s.routeX-80,hi=s.routeX+80;for(let n=0;n<35;n++){const x=(lo+hi)/2;const point=project([x,ropeHeight(x),0],s.vp);if(point[0]<edge)lo=x;else hi=x;}const x=(lo+hi)/2;const point=project([x,ropeHeight(x),0],s.vp);assert(point[1]>-1&&point[1]<1,'Wire spans full viewport width');}
 const left=evaluateJourney(Math.max(0,p-1e-6),w,h),right=evaluateJourney(Math.min(1,p+1e-6),w,h);
 assert(Math.hypot(...right.center.map((v,k)=>v-left.center[k]))<.001,'Continuous reversible cabin path');
 assert(s.photoA.src&&s.photoB.src&&s.photoMix>=0&&s.photoMix<=1);
 if(j%20===0)sampleStates.push({w,h,progress:p,destination:DATA[Math.round(s.q)].id,cabin:s.cabinNdc,anchor});
}
assert.equal(evaluateJourney(0,1440,900).q,0);assert.equal(evaluateJourney(DEPARTURE/TRAVEL,1440,900).q,0);assert.equal(evaluateJourney(1,1440,900).q,DATA.length-1);
for(let index=1;index<DATA.length;index++)assert(Math.abs(evaluateJourney(progressForStation(index),1440,900).q-index)<1e-10);
let store={getItem:()=>JSON.stringify(['petra','unknown','ajloun','petra',17])};assert.deepEqual(readPlan(store,expected),['petra','ajloun']);assert.deepEqual(readPlan({getItem(){throw Error();}},expected),[]);assert.deepEqual(readPlan({getItem:()=>'{bad'},expected),[]);assert.deepEqual(moveStop(['ajloun','jerash','petra'],'jerash',-1),['jerash','ajloun','petra']);assert.deepEqual(moveStop(['ajloun'],'ajloun',-1),['ajloun']);assert.equal(filterDestinations(DATA,FILTERS,'all','ام قيس')[0].id,'ummqais');assert.equal(filterDestinations(DATA,FILTERS,'history','جرش')[0].id,'jerash');assert.equal(filterDestinations(DATA,FILTERS,'nature','جرش').length,0);
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
for(const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(m[1].startsWith('http'))continue;assert(fs.existsSync(new URL('../public/'+m[1].split('#')[0],import.meta.url)),m[1]);}
for(const m of css.matchAll(/url\('([^']+)'\)/g))assert(fs.existsSync(new URL('../public/'+m[1],import.meta.url)),m[1]);
assert(html.includes('lang="ar" dir="rtl"'));
const renderer=fs.readFileSync(new URL('../public/js/render.js',import.meta.url),'utf8');assert(!/blitFramebuffer\([^;]*DEPTH_BUFFER_BIT/s.test(renderer),'No cross-default depth blit');
const credits=fs.readFileSync(new URL('../public/credits.html',import.meta.url),'utf8'),creditsModule=fs.readFileSync(new URL('../public/js/credits.js',import.meta.url),'utf8');
assert(credits.includes('src="js/credits.js"')&&credits.includes('PHOTO_SOURCES.json'));
assert(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(creditsModule),'Photo metadata must not be inserted as HTML');
for(const m of credits.matchAll(/(?:src|href)="([^"#]+)"/g)){if(m[1].startsWith('http'))continue;assert(fs.existsSync(new URL('../public/'+m[1].split('#')[0],import.meta.url)),m[1]);}
fs.writeFileSync(new URL('../qa/composition-checks.json',import.meta.url),JSON.stringify(sampleStates,null,2));
console.log('PASS: 18 destinations; 45 supplied photo checksums and 7 active remote sources; all legacy Commons credits and exclusions; red GLB mesh budget/normals and station geometry; 1928 continuous reversible path samples at 8 viewport sizes; transformed hanger-to-fixed-rope attachment; visible full-width cable; departure phase and navigation targets; plan storage/reordering and Arabic search; local HTML/CSS and credits references. Actual browser, remote photo delivery, GPU and visual acceptance remain separate.');

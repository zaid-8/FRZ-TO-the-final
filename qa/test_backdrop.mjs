import assert from 'node:assert/strict';
import {DATA} from '../public/js/destinations.js';
import {PhotoBackdrop} from '../public/js/backdrop.js';
function element(){const classes=new Set();return {dataset:{},style:{},hidden:false,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}};}
const nodes=new Map(['photo-a','photo-b','photo-credit','photo-notice'].map(id=>[id,element()]));
globalThis.document={getElementById:id=>nodes.get(id)};
const b=new PhotoBackdrop(),state=(a,c,m)=>({q:a+m,photoA:DATA[a].photo,photoB:DATA[c].photo,photoMix:m});
b.paint(state(0,1,0));assert.equal(b.notice.hidden,false);
b.images[0].onload();b.images[1].onload();assert.equal(b.notice.hidden,true);
b.paint(state(0,1,.5));assert.equal(b.images[0].style.opacity,'1');assert.equal(b.images[1].style.opacity,'0.5');assert(b.credit.textContent.includes(DATA[0].photo.author)&&b.credit.textContent.includes(DATA[1].photo.author));
const loadedJerash=b.images[1];b.paint(state(1,2,0));assert.equal(b.images[0],loadedJerash);assert.equal(b.images[0].dataset.status,'ready');assert.equal(b.images[0].style.opacity,'1');
b.images[1].classList.add('image-failed');b.images[1].onerror();b.paint(state(1,2,1));assert.equal(b.images[0].style.opacity,'0');assert.equal(b.images[1].style.opacity,'0');assert.equal(b.notice.hidden,false);assert(!b.credit.textContent.includes(DATA[2].photo.author));
b.images[1].onload();assert(!b.images[1].classList.contains('image-failed'));assert.equal(b.images[1].style.opacity,'1');assert.equal(b.notice.hidden,true);assert(b.credit.textContent.includes(DATA[2].photo.author));
b.paint(state(0,1,0));b.images[0].onload();b.images[1].onload();b.paint(state(0,1,.4));assert(b.credit.textContent.includes(DATA[0].photo.author));
console.log('PASS: loading, crossfade, loaded-layer reuse, failed-photo neutral state, correct visible-photo credits, successful recovery after image-failed. DOM logic only, not browser visual QA.');

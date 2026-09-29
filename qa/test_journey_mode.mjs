import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Journey,progressForStation,DEPARTURE,TRAVEL} from '../public/js/journey.js';


const source=readFileSync(new URL('../public/js/app.js',import.meta.url),'utf8');
const initializer=source.slice(source.indexOf('async function initJourney('),source.indexOf("\n$('journey').style"));
let options,initialIndex;
const elements={scene:{},journey:{},loading:{hidden:false},'loading-text':{textContent:''}};
await vm.runInNewContext(initializer+'\ninitJourney();',{
 journey:null,$:id=>elements[id],staticMode:false,update(){},useStatic(){},
 document:{querySelector:()=>({offsetHeight:84}),body:{classList:{add(){}}}},
 Journey:class{constructor(config){options=config;this.ready=false;}async init(index){initialIndex=index;}}
});
assert.equal(options.scrollDriven,true,'The page enables scrolling on initialization without a start action');
assert.equal(options.scrollInset,84,'The page accounts for its sticky header');
assert.equal(initialIndex,null,'Initial loading follows the current scroll position instead of forcing station zero');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
assert(!html.includes('id="journey-mode"'),'There is no tour activation button');
assert(!html.includes('compact-journey'),'The first paint does not force a compact hero');

const scrolls=[];
globalThis.window={scrollTo:options=>scrolls.push(options)};
globalThis.matchMedia=()=>({matches:false});
globalThis.scrollY=0;
let headerHeight=84;
const section={offsetHeight:21000,getBoundingClientRect:()=>({top:headerHeight-globalThis.scrollY})};
const canvas={clientHeight:800};
const journey=new Journey({canvas,section,scrollInset:headerHeight});
let wakes=0;journey.wake=()=>wakes++;
journey.resize();
assert.equal(journey.scrollDriven,true,'Journey itself defaults to scroll control');
assert.equal(journey.top,0,'The sticky header does not delay departure');
globalThis.scrollY=1;journey.readScroll();
assert(journey.target>0,'The first scroll moves the cable car without any button press');
globalThis.scrollY=journey.length*.4;journey.readScroll();assert.equal(journey.target,.4);
globalThis.scrollY=journey.length*.2;journey.readScroll();assert.equal(journey.target,.2,'Backward scrolling reverses the journey');
assert.equal(scrolls.length,0,'Reading page scroll never changes page position');
journey.depart();assert.equal(journey.target,DEPARTURE/TRAVEL);
assert.equal(scrolls.at(-1).top,journey.length*DEPARTURE/TRAVEL,'The optional departure button remains available');
journey.go(6,true);assert.equal(journey.current,progressForStation(6));
assert.equal(scrolls.at(-1).top,journey.length*progressForStation(6),'Station controls follow the same path');
headerHeight=112;journey.scrollInset=headerHeight;journey.resize();assert.equal(journey.top,0,'Mobile header resize preserves the scroll origin');
journey.reduced=true;const beforeQuiet=scrolls.length;journey.go(3,true);globalThis.scrollY=6000;journey.readScroll();
assert.equal(journey.target,progressForStation(3),'Quiet mode keeps the selected station while the page scrolls');
assert.equal(scrolls.length,beforeQuiet,'Quiet station controls do not move the page');
journey.reduced=false;journey.resize();globalThis.scrollY=journey.length*.3;journey.readScroll();
assert.equal(journey.target,.3,'Re-enabling motion restores scroll control immediately');
assert(wakes>0,'Scroll changes wake the renderer');
console.log('PASS: page initialization enables immediate reversible scroll travel without an activation button; sticky-header/mobile origin, optional departure/stations, quiet mode, and motion restoration. No GPU or browser rendering tested.');

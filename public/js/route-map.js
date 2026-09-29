import {getLocale,t,localizePlace} from './i18n.js';
import {DATA} from './destinations.js';

const TILE_SIZE=256,MIN_ZOOM=4,MAX_ZOOM=16,MAX_LAT=85.05112878;
const instances=new WeakMap();
const places=new Map(DATA.map(place=>[place.id,place]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const coordinate=value=>typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;

export function projectMercator(lat,lng,zoom=0){
 const size=TILE_SIZE*2**zoom,latitude=clamp(lat,-MAX_LAT,MAX_LAT)*Math.PI/180;
 return {x:(clamp(lng,-180,180)+180)/360*size,y:(1-Math.asinh(Math.tan(latitude))/Math.PI)/2*size};
}

export function unprojectMercator(x,y,zoom=0){
 const size=TILE_SIZE*2**zoom;
 return {lat:Math.atan(Math.sinh(Math.PI*(1-2*y/size)))*180/Math.PI,lng:x/size*360-180};
}

function routePoints(route){
 const input=Array.isArray(route)?route:Array.isArray(route?.points)?route.points:[];
 return input.map((point,index)=>({id:String(point?.id??index),lat:coordinate(point?.lat),lng:coordinate(point?.lng),name:String(point?.name||'').slice(0,180),nameEn:String(point?.nameEn||'').slice(0,180),day:point?.day??1}))
  .filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180);
}

const dayName=(day,locale=getLocale())=>/^\d+$/.test(String(day))?locale==='en'?`Day ${day}`:`اليوم ${day}`:String(day);
const pointName=(point,index)=>places.has(point.id)?localizePlace(places.get(point.id),getLocale()).ar:(getLocale()==='en'&&point.nameEn||point.name||t(`المحطة ${index+1}`,`Stop ${index+1}`));
const coordinates=point=>`${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
const placeLink=point=>`https://www.google.com/maps/search/?${new URLSearchParams({api:'1',query:coordinates(point)})}`;

export function directionsLinks(route,{locale=getLocale()}={}){
 const days=new Map();
 for(const point of routePoints(route)){const key=String(point.day);if(!days.has(key))days.set(key,[]);days.get(key).push(point);}
 const links=[];
 for(const [day,points] of days){
  if(points.length===1){links.push({label:`${dayName(day,locale)} · ${locale==='en'?'Open stop location':'فتح موقع المحطة'}`,url:placeLink(points[0]),day,pointCount:1});continue;}
  const count=Math.ceil((points.length-1)/4);
  for(let start=0,part=1;start<points.length-1;start+=4,part++){
   const segment=points.slice(start,start+5),query=new URLSearchParams({api:'1',origin:coordinates(segment[0]),destination:coordinates(segment.at(-1)),travelmode:'driving'});
   if(segment.length>2)query.set('waypoints',segment.slice(1,-1).map(coordinates).join('|'));
   links.push({label:`${dayName(day,locale)}${count>1?` · ${locale==='en'?'Part':'الجزء'} ${part}`:''}`,url:`https://www.google.com/maps/dir/?${query}`,day,pointCount:segment.length});
  }
 }
 return links;
}

function ensureStyles(){
 if(document.querySelector('link[data-darb-route-map-style]'))return;
 const href=new URL('../map.css',import.meta.url).href,existing=[...document.querySelectorAll('link[rel="stylesheet"]')].find(link=>link.href===href);
 if(existing){existing.dataset.darbRouteMapStyle='';return;}
 const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.darbRouteMapStyle='';document.head.append(link);
}

function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function button(label,text,className=''){const node=element('button',className,text);node.type='button';node.setAttribute('aria-label',label);node.title=label;return node;}
function externalLink(label,href,className=''){const node=element('a',className,label);node.href=href;node.target='_blank';node.rel='noopener';return node;}

export function renderRouteMap(container,route,{interactive=true}={}){
 if(!container||typeof container.append!=='function')throw new TypeError('A route map container is required');
 instances.get(container)?.();ensureStyles();
 const points=routePoints(route),root=element('section','darb-route-map');
 const heading=element('div','darb-route-map__heading'),headingTitle=element('strong'),headingCount=element('span');heading.append(headingTitle,headingCount);
 const note=element('p','darb-route-map__note');
 const locationBar=element('div','darb-route-map__location-bar'),locate=button('','','darb-route-map__locate'),locationStatus=element('span','darb-route-map__location-status');locationStatus.setAttribute('role','status');locationStatus.setAttribute('aria-live','polite');locationBar.append(locate,locationStatus);locationBar.hidden=!interactive;
 const viewport=element('div','darb-route-map__viewport');viewport.setAttribute('role','region');
 if(interactive)viewport.tabIndex=0;
 const tileLayer=element('div','darb-route-map__tiles');tileLayer.setAttribute('aria-hidden','true');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('darb-route-map__lines');svg.setAttribute('aria-hidden','true');
 const halo=document.createElementNS(svg.namespaceURI,'path'),line=document.createElementNS(svg.namespaceURI,'path');halo.classList.add('darb-route-map__halo');line.classList.add('darb-route-map__line');svg.append(halo,line);
 const pins=element('div','darb-route-map__pins'),status=element('div','darb-route-map__status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const statusText=element('span'),retry=button('','','darb-route-map__retry');retry.hidden=true;status.append(statusText,retry);
 const attribution=element('div','darb-route-map__attribution');attribution.dir='ltr';attribution.append(externalLink('© OpenStreetMap contributors','https://www.openstreetmap.org/copyright'));
 const controls=element('div','darb-route-map__controls');controls.setAttribute('role','group');
 const zoomIn=button('','+'),zoomOut=button('','−'),fitButton=button('','⌖');controls.append(zoomIn,zoomOut,fitButton);controls.hidden=!interactive;fitButton.disabled=!points.length;
 const selection=element('div','darb-route-map__selection');selection.hidden=true;
 const closeSelection=button('','×','darb-route-map__selection-close'),selectionName=element('strong'),selectionMeta=element('span'),selectionCoords=element('small'),selectionLink=externalLink('','https://www.google.com/maps/');selectionCoords.dir='ltr';
 selection.append(closeSelection,selectionName,selectionMeta,selectionCoords,selectionLink);
 const locationMarker=element('div','darb-route-map__my-location'),locationMarkerLabel=element('span','darb-route-map__my-location-label');locationMarker.setAttribute('role','img');locationMarker.hidden=true;locationMarker.append(locationMarkerLabel);pins.append(locationMarker);
 viewport.append(tileLayer,svg,pins,status,controls,selection,attribution);
 const footer=element('div','darb-route-map__directions'),directionsLabel=element('span','darb-route-map__directions-label'),directionList=element('div','darb-route-map__direction-links');
 root.append(heading,note,locationBar,viewport,footer);container.append(root);

 const listeners=[],tiles=new Map(),markers=[];
 let destroyed=false,frame=0,observer=null,intersection=null,onScreen=true,width=0,height=0,zoom=8,center={x:.6,y:.4},drag=null,moved=false,userPositioned=false,selected=-1,currentPosition=null,locationState='idle',locationRequest=0,locationTimer=0;
 const normalized=points.map(point=>projectMercator(point.lat,point.lng));
 for(const point of normalized){point.x/=TILE_SIZE;point.y/=TILE_SIZE;}
 const bounds=normalized.length?{left:Math.min(...normalized.map(p=>p.x)),right:Math.max(...normalized.map(p=>p.x)),top:Math.min(...normalized.map(p=>p.y)),bottom:Math.max(...normalized.map(p=>p.y))}:null;
 const listen=(node,type,handler,options)=>{node.addEventListener(type,handler,options);listeners.push(()=>node.removeEventListener(type,handler,options));};
 const requestDraw=()=>{if(!destroyed&&!frame)frame=requestAnimationFrame(draw);};
 const tileKey=(z,x,y)=>`${z}/${x}/${y}`;
 const discardTile=record=>{record.image.onload=null;record.image.onerror=null;record.image.removeAttribute('src');record.image.remove();};

 function refreshLocation(){
  const label=t('موقعي الحالي','My location');locate.textContent=locationState==='pending'?t('جارٍ تحديد موقعك…','Finding your location…'):label;locate.setAttribute('aria-label',label);locate.title=label;locate.disabled=locationState==='pending';locate.setAttribute('aria-busy',String(locationState==='pending'));
  const messages={
   idle:t('اعرض موقعك دون تغيير نقطة انطلاق الرحلة.','Show your location without changing your trip origin.'),
   pending:t('اسمح بالوصول للموقع إذا طلب المتصفح ذلك.','Allow location access if your browser asks.'),
   success:t('موقعك ظاهر باللون الأزرق.','Your location is shown in blue.'),
   denied:t('إذن الموقع مرفوض. اسمح به من إعدادات الموقع في المتصفح ثم حاول مجددًا.','Location permission was denied. Allow it in your browser site settings, then try again.'),
   unavailable:t('تعذّر تحديد موقعك الآن. تأكد من تشغيل خدمة الموقع ثم حاول مجددًا.','Your location is unavailable. Check that location services are on, then try again.'),
   timeout:t('انتهت مهلة تحديد الموقع. حاول مرة أخرى.','Finding your location timed out. Try again.'),
   unsupported:t('هذا المتصفح لا يتيح تحديد الموقع. افتح الموقع عبر HTTPS بمتصفح يدعم الموقع.','Location is not available in this browser. Open the HTTPS site in a browser with location support.')
  };
  const accuracy=currentPosition?.accuracy,accuracyText=Number.isFinite(accuracy)?t(`الدقة التقريبية: ${Math.round(accuracy)} م`,`Approximate accuracy: ${Math.round(accuracy)} m`):'';
  locationStatus.textContent=messages[locationState]+(locationState==='success'&&accuracyText?` ${accuracyText}`:'');
  locationBar.dataset.locationState=locationState;
  locationMarkerLabel.textContent=locationState==='success'?t('موقعي','My location'):t('آخر موقع محدّد','Last located position');
  if(currentPosition){const markerLabel=`${locationMarkerLabel.textContent}: ${currentPosition.lat.toFixed(5)}, ${currentPosition.lng.toFixed(5)}${accuracyText?` · ${accuracyText}`:''}`;locationMarker.setAttribute('aria-label',markerLabel);locationMarker.title=markerLabel;}
 }

 function translate(){
  root.dir=getLocale()==='en'?'ltr':'rtl';root.setAttribute('aria-label',t('خريطة مسار الرحلة','Trip route map'));
  headingTitle.textContent=t('خريطة رحلتك','Your trip map');headingCount.textContent=t(`${points.length} محطات`,`${points.length} ${points.length===1?'stop':'stops'}`);
  note.textContent=t('مسار تخطيطي بين المحطات، وليس توجيه قيادة','Schematic lines between stops, not driving directions');
  viewport.setAttribute('aria-label',interactive?t('خريطة المحطات. اسحب للتحريك، أو استخدم الأسهم وأزرار التكبير.','Map of stops. Drag to pan, or use the arrow keys and zoom controls.'):t('خريطة المحطات','Map of stops'));
  status.dir=selection.dir=root.dir;controls.setAttribute('aria-label',t('التحكم بالخريطة','Map controls'));
  for(const [node,label] of [[retry,t('إعادة تحميل أجزاء الخريطة الظاهرة','Reload visible map tiles')],[zoomIn,t('تكبير الخريطة','Zoom in')],[zoomOut,t('تصغير الخريطة','Zoom out')],[fitButton,t('إظهار جميع المحطات','Show all stops')],[closeSelection,t('إغلاق معلومات المحطة','Close stop details')]]){node.setAttribute('aria-label',label);node.title=label;}
  retry.textContent=t('إعادة المحاولة','Retry');selectionLink.textContent=t('فتح الموقع في Google Maps','Open location in Google Maps');
  markers.forEach((marker,index)=>{const point=points[index],name=pointName(point,index);marker.setAttribute('aria-label',t(`المحطة ${index+1}: ${name}، ${dayName(point.day)}`,`Stop ${index+1}: ${name}, ${dayName(point.day)}`));marker.title=name;});
  if(selected>=0)showPoint(selected);
  const links=directionsLinks(points);directionList.replaceChildren();for(const link of links)directionList.append(externalLink(link.label,link.url));
  if(links.length){directionsLabel.textContent=t('اتجاهات القيادة الفعلية في Google Maps:','Driving directions in Google Maps:');footer.replaceChildren(directionsLabel,directionList);}else footer.replaceChildren();
  refreshLocation();refreshStatus();
 }

 function locateCurrentPosition(){
  if(destroyed||locationState==='pending')return;
  const geolocation=globalThis.navigator?.geolocation;
  if(!geolocation||typeof geolocation.getCurrentPosition!=='function'||globalThis.isSecureContext===false){locationState='unsupported';refreshLocation();return;}
  const request=++locationRequest;locationState='pending';refreshLocation();
  const active=()=>!destroyed&&request===locationRequest&&locationState==='pending';
  const finish=state=>{if(!active())return false;clearTimeout(locationTimer);locationTimer=0;locationRequest++;locationState=state;refreshLocation();return true;};
  const failure=error=>finish(error?.code===1?'denied':error?.code===3?'timeout':'unavailable');
  locationTimer=setTimeout(()=>finish('timeout'),15000);
  try{geolocation.getCurrentPosition(position=>{
   if(!active())return;
   const lat=position?.coords?.latitude,lng=position?.coords?.longitude,accuracy=position?.coords?.accuracy;
   if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){finish('unavailable');return;}
   currentPosition={lat,lng,accuracy:typeof accuracy==='number'&&Number.isFinite(accuracy)&&accuracy>=0?accuracy:null};
   const projected=projectMercator(lat,lng);center={x:projected.x/TILE_SIZE,y:projected.y/TILE_SIZE};
   const precision=currentPosition.accuracy??1000,scale=Math.max(100,Math.min(width,height)-100),metersPerWorld=40075016.686*Math.max(.05,Math.cos(lat*Math.PI/180));
   zoom=clamp(Math.floor(Math.log2(metersPerWorld*scale/(TILE_SIZE*Math.max(precision*4,1500)))),MIN_ZOOM,MAX_ZOOM);userPositioned=true;
   finish('success');constrain();requestDraw();
  },failure,{enableHighAccuracy:true,timeout:10000,maximumAge:0});}catch(error){failure(error);}
 }

 function refreshStatus(){
  if(!points.length&&!currentPosition){status.hidden=false;statusText.textContent=t('أضف محطات بإحداثيات لعرض مسار رحلتك.','Add stops with coordinates to show your route.');retry.hidden=true;return;}
  const failed=[...tiles.values()].some(tile=>tile.state==='failed'),ready=tiles.size>0&&[...tiles.values()].every(tile=>tile.state==='ready');
  root.classList.toggle('darb-route-map--schematic',failed);root.dataset.mapState=failed?'schematic':ready?'map':'loading';
  status.hidden=ready&&!failed;retry.hidden=!failed;
  const message=failed?t('تعذّر تحميل كامل الخريطة؛ المعروض الآن مخطط إحداثيات.','The map could not load completely. Positions are shown on a coordinate diagram.'):t('جارٍ تحميل الخريطة…','Loading map…');if(statusText.textContent!==message)statusText.textContent=message;
 }

 function constrain(){
  if(!width||!height)return;
  if(currentPosition){const size=TILE_SIZE*2**zoom,halfX=Math.min(.5,width/size/2),halfY=Math.min(.5,height/size/2);center.x=clamp(center.x,halfX,1-halfX);center.y=clamp(center.y,halfY,1-halfY);return;}
  if(!bounds)return;
  const size=TILE_SIZE*2**zoom,padding=Math.max((bounds.right-bounds.left)*.3,(bounds.bottom-bounds.top)*.3,Math.max(width,height)/size*.35,.0015);
  const halfX=Math.min(.5,width/size/2),halfY=Math.min(.5,height/size/2);
  const left=Math.max(halfX,bounds.left-padding),right=Math.min(1-halfX,bounds.right+padding),top=Math.max(halfY,bounds.top-padding),bottom=Math.min(1-halfY,bounds.bottom+padding);
  center.x=left<=right?clamp(center.x,left,right):.5;center.y=top<=bottom?clamp(center.y,top,bottom):.5;
 }

 function fit(){
  if(!bounds||!width||!height)return;
  center={x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2};
  const spanX=bounds.right-bounds.left,spanY=bounds.bottom-bounds.top;
  zoom=spanX<1e-8&&spanY<1e-8?12:clamp(Math.floor(Math.min(Math.log2(Math.max(80,width-110)/(TILE_SIZE*Math.max(spanX,1e-8))),Math.log2(Math.max(80,height-110)/(TILE_SIZE*Math.max(spanY,1e-8))))),MIN_ZOOM,MAX_ZOOM);
  constrain();requestDraw();
 }

 function setZoom(next){zoom=clamp(next,MIN_ZOOM,MAX_ZOOM);userPositioned=true;constrain();requestDraw();}

 function showPoint(index){
  selected=index;const point=points[index];selectionName.textContent=pointName(point,index);selectionMeta.textContent=t(`المحطة ${index+1} · ${dayName(point.day)}`,`Stop ${index+1} · ${dayName(point.day)}`);selectionCoords.textContent=`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;selectionLink.href=placeLink(point);selection.hidden=false;
  markers.forEach((marker,i)=>{marker.classList.toggle('is-selected',i===index);marker.setAttribute('aria-expanded',String(i===index));});
 }

 function draw(){
  frame=0;if(destroyed||!onScreen||!width||!height||!bounds&&!currentPosition)return;
  constrain();const size=TILE_SIZE*2**zoom,offsetX=center.x*size-width/2,offsetY=center.y*size-height/2,max=2**zoom-1;
  const firstX=Math.max(0,Math.floor(offsetX/TILE_SIZE)),lastX=Math.min(max,Math.ceil((offsetX+width)/TILE_SIZE)-1),firstY=Math.max(0,Math.floor(offsetY/TILE_SIZE)),lastY=Math.min(max,Math.ceil((offsetY+height)/TILE_SIZE)-1),visible=new Set();
  for(let x=firstX;x<=lastX;x++)for(let y=firstY;y<=lastY;y++){
   const key=tileKey(zoom,x,y);visible.add(key);let record=tiles.get(key);
   if(!record){
    const image=element('img','darb-route-map__tile');image.alt='';image.draggable=false;image.decoding='async';image.width=TILE_SIZE;image.height=TILE_SIZE;
    record={image,state:'loading'};tiles.set(key,record);
    image.onload=()=>{if(destroyed||tiles.get(key)!==record)return;record.state='ready';image.classList.add('is-ready');refreshStatus();};
    image.onerror=()=>{if(destroyed||tiles.get(key)!==record)return;record.state='failed';refreshStatus();};
    tileLayer.append(image);image.src=`https://tile.openstreetmap.org/${key}.png`;
   }
   record.image.style.transform=`translate(${(x*TILE_SIZE-offsetX).toFixed(2)}px,${(y*TILE_SIZE-offsetY).toFixed(2)}px)`;
  }
  for(const [key,record] of tiles)if(!visible.has(key)){discardTile(record);tiles.delete(key);}
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const projected=normalized.map(point=>({x:point.x*size-offsetX,y:point.y*size-offsetY}));
  const path=projected.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');halo.setAttribute('d',path);line.setAttribute('d',path);
  projected.forEach((point,index)=>{const marker=markers[index];marker.hidden=point.x<-24||point.x>width+24||point.y<-24||point.y>height+24;marker.style.left=`${point.x.toFixed(2)}px`;marker.style.top=`${point.y.toFixed(2)}px`;});
  if(currentPosition){const point=projectMercator(currentPosition.lat,currentPosition.lng,zoom),x=point.x-offsetX,y=point.y-offsetY;locationMarker.hidden=x<-24||x>width+24||y<-24||y>height+24;locationMarker.style.left=`${x.toFixed(2)}px`;locationMarker.style.top=`${y.toFixed(2)}px`;}
  zoomIn.disabled=zoom>=MAX_ZOOM;zoomOut.disabled=zoom<=MIN_ZOOM;refreshStatus();
 }

 points.forEach((point,index)=>{
  const marker=button('',String(index+1),'darb-route-map__pin');marker.dataset.pointId=point.id;marker.setAttribute('aria-expanded','false');
  listen(marker,'click',()=>showPoint(index));markers.push(marker);pins.append(marker);
 });
 listen(closeSelection,'click',()=>{selection.hidden=true;if(selected>=0){markers[selected].classList.remove('is-selected');markers[selected].setAttribute('aria-expanded','false');if(markers[selected].hidden)viewport.focus();else markers[selected].focus();}selected=-1;});
 listen(retry,'click',()=>{for(const [key,record] of tiles)if(record.state==='failed'){discardTile(record);tiles.delete(key);}requestDraw();});
 listen(zoomIn,'click',()=>setZoom(zoom+1));listen(zoomOut,'click',()=>setZoom(zoom-1));listen(fitButton,'click',()=>{userPositioned=false;fit();});

 if(interactive){
  listen(locate,'click',locateCurrentPosition);
  listen(viewport,'pointerdown',event=>{
   if(event.button!==0||event.target.closest('button,a,.darb-route-map__selection,.darb-route-map__status')||!bounds&&!currentPosition)return;
   drag={id:event.pointerId,x:event.clientX,y:event.clientY,center:{...center}};moved=false;viewport.classList.add('is-dragging');
   try{viewport.setPointerCapture(event.pointerId);}catch{}
  });
  listen(viewport,'pointermove',event=>{
   if(!drag||event.pointerId!==drag.id)return;
   const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;
   if(!moved)return;event.preventDefault();userPositioned=true;const size=TILE_SIZE*2**zoom;center={x:drag.center.x-dx/size,y:drag.center.y-dy/size};constrain();requestDraw();
  });
  const endDrag=event=>{if(!drag||event.pointerId!==drag.id)return;try{if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);}catch{}drag=null;viewport.classList.remove('is-dragging');};
  listen(viewport,'pointerup',endDrag);listen(viewport,'pointercancel',endDrag);listen(viewport,'lostpointercapture',endDrag);
  listen(viewport,'keydown',event=>{
   if(event.target!==viewport||!bounds&&!currentPosition)return;
   if(['+','='].includes(event.key)){event.preventDefault();event.stopPropagation();setZoom(zoom+1);return;}
   if(event.key==='-'){event.preventDefault();event.stopPropagation();setZoom(zoom-1);return;}
   if(event.key==='Home'){event.preventDefault();event.stopPropagation();userPositioned=false;fit();return;}
   const delta={ArrowLeft:[-80,0],ArrowRight:[80,0],ArrowUp:[0,-80],ArrowDown:[0,80]}[event.key];if(!delta)return;
   event.preventDefault();event.stopPropagation();userPositioned=true;const size=TILE_SIZE*2**zoom;center.x+=delta[0]/size;center.y+=delta[1]/size;constrain();requestDraw();
  });
 }else viewport.classList.add('is-static');

 function measure(){
  if(destroyed)return;const nextWidth=viewport.clientWidth,nextHeight=viewport.clientHeight;if(!nextWidth||!nextHeight)return;
  const changed=nextWidth!==width||nextHeight!==height;width=nextWidth;height=nextHeight;if(!changed)return;
  if(!userPositioned)fit();else{constrain();requestDraw();}
 }
 if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(measure);observer.observe(viewport);}else listen(window,'resize',measure);
 if(typeof IntersectionObserver!=='undefined'){
  onScreen=false;intersection=new IntersectionObserver(entries=>{if(destroyed)return;onScreen=entries.some(entry=>entry.isIntersecting);if(onScreen)requestDraw();else{for(const record of tiles.values())discardTile(record);tiles.clear();}},{threshold:0});intersection.observe(viewport);
 }
 listen(window,'darb:languagechange',translate);
 measure();translate();

 function cleanup(){
  if(destroyed)return;destroyed=true;locationRequest++;clearTimeout(locationTimer);if(frame)cancelAnimationFrame(frame);observer?.disconnect();intersection?.disconnect();
  if(drag){try{if(viewport.hasPointerCapture(drag.id))viewport.releasePointerCapture(drag.id);}catch{}drag=null;}
  for(const remove of listeners)remove();for(const record of tiles.values())discardTile(record);tiles.clear();root.remove();if(instances.get(container)===cleanup)instances.delete(container);
 }
 instances.set(container,cleanup);return cleanup;
}

import {DATA} from './destinations.js';
import {t} from './i18n.js';

export function photoCredit(d){
 const p=d.photo;
 if(!p.licenseUrl)return `<p class="image-credit supplied-credit">${t('صورة مقدّمة للمشروع','Photo supplied to the project')} · <a href="credits.html#${d.id}">${t('المصدر','Source')} ↗</a></p>`;
 return `<p class="image-credit" dir="ltr"><a href="${p.source}" target="_blank" rel="noopener noreferrer">${p.author}</a> · <a href="${p.licenseUrl}" target="_blank" rel="noopener noreferrer">${p.license}</a></p>`;
}

export class PhotoBackdrop {
 constructor(){
  this.images=[document.getElementById('photo-a'),document.getElementById('photo-b')];
  this.credit=document.getElementById('photo-credit');
  this.notice=document.getElementById('photo-notice');
  this.images.forEach(img=>{img.onload=()=>{img.classList.remove('image-failed');img.dataset.status='ready';this.refresh();};img.onerror=()=>{img.dataset.status='error';this.refresh();};});
 }
 paint(state){
  const index=Math.max(0,Math.min(DATA.length-1,Math.round(state.q))),d=DATA[index];
  this.photos=[state.photoA||d.photo,state.photoB||d.photo];this.mix=state.photoMix||0;

  if(this.images[1].dataset.source===this.photos[0].src&&this.images[0].dataset.source!==this.photos[0].src)this.images.reverse();
  else if(this.images[0].dataset.source===this.photos[1].src&&this.images[1].dataset.source!==this.photos[1].src)this.images.reverse();
  this.images.forEach((img,i)=>{
   img.style.zIndex=String(i);
   const p=this.photos[i];
   const pan=state.photoPan||[0,0],scale=state.photoScale||1;
   img.style.transformOrigin=`${p.position[0]*100}% ${p.position[1]*100}%`;
   img.style.transform=`translate(${pan[0]*100}%,${pan[1]*100}%) scale(${scale})`;
   if(img.dataset.source!==p.src){img.classList.remove('image-failed');img.dataset.source=p.src;img.dataset.status='loading';img.src=p.src;img.style.objectPosition=`${p.position[0]*100}% ${p.position[1]*100}%`;}
  });
  this.credit.href='credits.html#'+d.id;
  this.refresh();
 }
 refresh(){
  if(!this.photos)return;
  const b=this.images[1].dataset.status==='ready'?this.mix:0;
  const a=this.images[0].dataset.status==='ready'?(this.images[1].dataset.status==='ready'?1:1-this.mix):0;
  this.images[0].style.opacity=String(a);this.images[1].style.opacity=String(b);
  const visible=this.photos.filter((p,i)=>i===0?a*(1-b)>.001:b>.001);
  this.credit.textContent=(visible.length?[...new Set(visible.map(p=>p.licenseUrl?`${p.author} · ${p.license}`:t('صورة مقدّمة للمشروع','Photo supplied to the project')))].join(' / '):t('مصادر الصور','Photo sources'))+' ↗';this.credit.title=this.credit.textContent;
  const active=this.images[this.mix<.5?0:1],status=active.dataset.status;
  this.notice.hidden=status==='ready';
  this.notice.textContent=status==='error'?t('تعذّر تحميل صورة المكان','Could not load the destination photo'):t('جارٍ تحميل صورة المكان…','Loading destination photo…');
 }
}

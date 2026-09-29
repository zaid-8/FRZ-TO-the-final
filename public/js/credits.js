import {getLocale,t,setLocale,localizePlace,applyTranslations} from './i18n.js';
import './theme.js';
import {CATALOG} from './catalog.js';
import {PHOTOS} from './photos.js';

const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
function safeHref(value){
 if(typeof value!=='string')return null;
 if(/^assets\/[a-zA-Z0-9_./-]+$/.test(value)&&!value.split('/').includes('..'))return value;
 try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}
}
function link(label,href){
 const target=safeHref(href);if(!target)return node('span',label);
 const a=node('a',label);a.href=target;if(target.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}return a;
}
function labelValue(label,value){const p=node('p');p.append(document.createTextNode(label+' '),node('bdi',value||t("غير مرفق","Not supplied")));return p;}
function photoCard(image,photo,metadata){
 const figure=node('figure',undefined,'credits-photo'),source=safeHref(image.src);
 if(source){const img=node('img');img.src=source;img.alt=image.alt||'';img.loading='lazy';img.decoding='async';img.width=512;img.height=320;figure.append(img);}
 const caption=node('figcaption');caption.append(node('h3',image.alt||photo.title||''));
 const original=image.originalFilename||photo.originalFilename||photo.title;
 if(original)caption.append(node('p',original,'original-name'));
 if(image.src?.startsWith('assets/')){
  caption.append(node('p',t("صورة مقدّمة مع المشروع؛ لم تُرفق بيانات المصوّر أو الترخيص.","Photo supplied with the project; photographer and license information was not provided.")));
  const record=metadata.get(image.src);
  if(record)caption.append(node('p',`${record.displayWidth||record.width} × ${record.displayHeight||record.height} ${t('بكسل · الملف المرفق دون تعديل','pixels · original supplied file')}`));
  caption.append(link(t("فتح الملف المضمّن ↗","Open included file ↗"),image.src));
 }else{
  caption.append(labelValue(t("تصوير:","Photographer:"),photo.author));
  const license=node('p');license.append(link(photo.license||t("بيانات الترخيص","License details"),photo.licenseUrl));caption.append(license);
  const links=node('p',undefined,'source-links');links.append(link(t("صفحة الصورة الأصلية ↗","Original photo page ↗"),photo.source),link(t("ملف الصورة ↗","Image file ↗"),photo.original||image.src));caption.append(links);
 }
 figure.append(caption);return figure;
}
function legacyCredit(photo){
 const details=node('details'),summary=node('summary',t("مصدر إضافي محفوظ من النسخة السابقة","Additional source retained from the earlier version"));details.append(summary,node('p',photo.title,'original-name'),labelValue(t("تصوير:","Photographer:"),photo.author));
 const links=node('p',undefined,'source-links');links.append(link(photo.license,photo.licenseUrl),link(t("صفحة المصدر ↗","Source page ↗"),photo.source),link(t("الصورة الأصلية ↗","Original image ↗"),photo.original||photo.src));details.append(links);return details;
}
let sourceData={};
function render(data={}){
 sourceData=data;applyTranslations();document.title=t('درب — الصور ومصادرها','DARB — Photo credits');const language=document.getElementById('language-toggle');if(language){language.textContent=t('English','العربية');language.setAttribute('aria-label',t('Switch to English','التبديل إلى العربية'));}
 const metadata=new Map((data.suppliedPhotos||[]).map(item=>[item.src,item]));
 const host=document.getElementById('destination-credits'),nav=document.getElementById('credits-nav');
 const expanded=new Set([...host.querySelectorAll('details[open]')].map(el=>el.closest('article')?.id));
 host.replaceChildren();nav.replaceChildren();
 for(const item of CATALOG){
  const place=localizePlace(item);
  const article=node('article',undefined,'credit-entry');article.id=place.id;article.append(node('h2',place.ar));
  const jump=node('a',place.ar);jump.href='#'+encodeURIComponent(place.id);nav.append(jump);
  const gallery=node('div',undefined,'credits-gallery');
  for(const image of place.gallery)gallery.append(photoCard(image,place.photo,metadata));
  article.append(gallery);
  const legacy=PHOTOS[place.id];if(legacy&&legacy.src!==place.image){const details=legacyCredit(legacy);details.open=expanded.has(place.id);article.append(details);}
  host.append(article);
 }
 const refs=document.getElementById('reference-list');
 refs.replaceChildren();
 for(const ref of data.references||[]){
  const li=node('li');li.append(node('strong',getLocale()==='en'?({'اجلون 1 (مرجع تلفريك)':'Ajloun cable car reference','محطة التلفريك':'Cable car station','نشمي':'Nashmi'}[ref.label]||'Project visual reference'):ref.label),document.createTextNode(' — '),node('bdi',ref.originalFilename));
  if(ref.width&&ref.height)li.append(document.createTextNode(` · ${ref.width} × ${ref.height} ${t('بكسل','pixels')}`));
  if(safeHref(ref.src))li.append(document.createTextNode(' · '),link(t("الملف المرفق ↗","Included file ↗"),ref.src));refs.append(li);
 }
 if(!refs.childElementCount)refs.append(node('li',t("مراجع العربة والمحطة وصورة نشمي مرفقة من صاحب المشروع.","Cabin, station and Nashmi references were supplied by the project owner.")));
 const local=CATALOG.flatMap(place=>place.gallery).filter(image=>image.src?.startsWith('assets/')).length;
 document.getElementById('credits-status').textContent=t(`${CATALOG.length} وجهة · ${local} صورة محلية في المعارض · مصادر الصور الخارجية محفوظة أدناه.`,`${CATALOG.length} destinations · ${local} local gallery photos · external photo credits below.`);
}
fetch('PHOTO_SOURCES.json').then(response=>{if(!response.ok)throw new Error('Photo provenance unavailable');return response.json();}).then(render).catch(()=>render());

render();
document.getElementById('language-toggle')?.addEventListener('click',()=>setLocale(getLocale()==='ar'?'en':'ar'));
window.addEventListener('darb:languagechange',()=>render(sourceData));

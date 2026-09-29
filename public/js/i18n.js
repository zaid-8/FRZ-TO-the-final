import {localizeCatalogPlace} from './catalog-en.js';
const LOCALE_KEY='darb.language';
let locale='ar';
try{locale=globalThis.localStorage?.getItem(LOCALE_KEY)==='en'?'en':'ar';}catch{}
export const getLocale=()=>locale;
export const t=(ar,en)=>locale==='en'?en:ar;
export const localizePlace=(place,language=locale)=>localizeCatalogPlace(place,language);
const bindings=new WeakMap();
export function applyTranslations(root=globalThis.document){
 if(!root?.querySelectorAll)return;
 const nodes=[...(root.matches?.('[data-i18n-en],[data-i18n-title-en],[data-i18n-aria-label-en],[data-i18n-placeholder-en],[data-i18n-alt-en],[data-i18n-content-en]')?[root]:[]),...root.querySelectorAll('[data-i18n-en],[data-i18n-title-en],[data-i18n-aria-label-en],[data-i18n-placeholder-en],[data-i18n-alt-en],[data-i18n-content-en]')];
 for(const node of nodes){
  let original=bindings.get(node);
  if(!original){original={};if(node.hasAttribute('data-i18n-en'))original.html=node.innerHTML;for(const key of ['title','aria-label','placeholder','alt','content'])if(node.hasAttribute(`data-i18n-${key}-en`))original[key]=node.getAttribute(key)||'';bindings.set(node,original);}
  if(original.html!==undefined)node.innerHTML=locale==='en'?node.getAttribute('data-i18n-en'):original.html;
  for(const key of ['title','aria-label','placeholder','alt','content'])if(original[key]!==undefined)node.setAttribute(key,locale==='en'?node.getAttribute(`data-i18n-${key}-en`):original[key]);
 }
}
function documentLocale(){if(globalThis.document?.documentElement){document.documentElement.lang=locale;document.documentElement.dir=locale==='en'?'ltr':'rtl';}}
export function setLocale(value){
 const next=value==='en'?'en':'ar';if(next===locale)return;
 locale=next;try{globalThis.localStorage?.setItem(LOCALE_KEY,locale);}catch{}
 documentLocale();applyTranslations();
 if(typeof globalThis.window?.dispatchEvent==='function')window.dispatchEvent(new CustomEvent('darb:languagechange',{detail:{locale}}));
}
documentLocale();

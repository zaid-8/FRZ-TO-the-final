import {t} from './i18n.js';

const themeButton=document.getElementById('theme-toggle');
let theme='dark';
try{const saved=localStorage.getItem('darb.theme');if(saved==='light'||saved==='dark')theme=saved;}catch{}
function apply(){
 document.documentElement.dataset.theme=theme;
 document.documentElement.style.colorScheme=theme;
 const themeColor=document.querySelector('meta[name="theme-color"]');
 if(themeColor)themeColor.content=theme==='dark'?'#101a17':'#f7f3ec';
 if(themeButton){
  themeButton.setAttribute('aria-pressed',String(theme==='dark'));
  themeButton.setAttribute('aria-label',theme==='dark'?t('تفعيل المظهر الفاتح','Switch to light theme'):t('تفعيل المظهر الداكن','Switch to dark theme'));
  themeButton.title=themeButton.getAttribute('aria-label');
  themeButton.textContent=theme==='dark'?'☀':'☾';
 }
}
apply();
themeButton?.addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';apply();try{localStorage.setItem('darb.theme',theme);}catch{}});
window.addEventListener('darb:languagechange',apply);

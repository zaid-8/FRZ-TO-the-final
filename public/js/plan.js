export const STORAGE_KEY='darb.trip.v1';
export function readPlan(storage,allowed){try{const raw=JSON.parse(storage.getItem(STORAGE_KEY)||'[]');return Array.isArray(raw)?[...new Set(raw.filter(id=>typeof id==='string'&&allowed.includes(id)))]:[];}catch{return[];}}
export function moveStop(plan,id,direction){const index=plan.indexOf(id),next=index+direction;if(index<0||next<0||next>=plan.length)return [...plan];const result=[...plan];[result[index],result[next]]=[result[next],result[index]];return result;}
export function normalizeArabic(value){return value.trim().toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u065F\u0670]/g,'');}
export function filterDestinations(data,filters,filter,query){const q=normalizeArabic(query);return data.filter(d=>(filters[filter]||filters.all).includes(d.id)&&normalizeArabic(d.ar+' '+d.en+' '+d.place).includes(q));}

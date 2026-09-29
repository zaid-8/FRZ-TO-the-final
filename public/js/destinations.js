import {CATALOG} from './catalog.js';
export const DATA = CATALOG;
const matching = (...tags) => DATA.filter(d => d.tags.some(t => tags.includes(t))).map(d => d.id);
export const FILTERS = {
  all: DATA.map(d => d.id), nature: matching('nature'), history: matching('history'),
  local: matching('local','culture'), adventure: matching('adventure'),
  relax: matching('relaxation','relax'), sea: matching('beach','sea'),
};

export const PLANS = {
  north: {title:'أخضر على مدّ النظر',subtitle:'غابات عجلون، أعمدة جرش، وإطلالة أم قيس.',days:'حكايات الشمال',image:'assets/places/ajloun-forest.jpg',items:[['عجلون','ajloun'],['جرش','jerash'],['أم قيس','ummqais']]},
  culture: {title:'لكل حجر قصة',subtitle:'من نبض عمّان لفسيفساء مادبا وحكايات الكرك.',days:'مدن وحكايات',image:'assets/places/amman-downtown.jpg',items:[['عمّان','amman'],['مادبا','madaba'],['الكرك','karak']]},
  south: {title:'من الحجر إلى البحر',subtitle:'ورد البترا، رمل رم، وآخر النهار على بحر العقبة.',days:'على درب الجنوب',image:'assets/places/rum-desert.jpg',items:[['البترا','petra'],['وادي رم','rum'],['العقبة','aqaba']]},
};

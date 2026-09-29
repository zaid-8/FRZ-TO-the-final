import {CATALOG_BY_ID} from './catalog.js';

const STOPS = [
  {
    id:'ajloun',coord:[35.72744,32.32531],governorate:{ar:'عجلون',en:'Ajloun'},governorateISO:'JO-AJ',
    focus:{ar:'قلعة عجلون',en:'Ajloun Castle'},zoom:12.8,pitch:55,bearing:26,
    source:'https://international.visitjordan.com/wheretogo/ajloun/',
    coordinateNote:{ar:'تركيز تقريبي على القلعة بعد تجربة التلفريك؛ موقع القلعة مختلف عن محطتي التلفريك.',en:'Approximate focus on the castle after the cable car experience; the castle is separate from both cable car stations.'}
  },
  {
    id:'jerash',coord:[35.89079,32.27756],governorate:{ar:'جرش',en:'Jerash'},governorateISO:'JO-JA',
    focus:{ar:'الساحة البيضاوية في جرش',en:'Jerash Oval Plaza'},zoom:12.9,pitch:55,bearing:8,
    source:'https://jerash.visitjordan.com/en/Site/6',coordinateSource:'https://mapcarta.com/35585498',
    coordinateNote:{ar:'تركيز تقريبي على محيط الساحة البيضاوية داخل الموقع الأثري، وليس بوابة الدخول.',en:'Approximate focus on the Oval Plaza area within the archaeological site, not the entrance gate.'}
  },
  {
    id:'ummqais',coord:[35.67806,32.65569],governorate:{ar:'إربد',en:'Irbid'},governorateISO:'JO-IR',
    focus:{ar:'آثار أم قيس · جدارا',en:'Umm Qais · Gadara ruins'},zoom:12.7,pitch:55,bearing:-28,
    source:'https://international.visitjordan.com/wheretogo/umm-qais/',
    coordinateNote:{ar:'تركيز تقريبي على المنطقة الأثرية ومتحف أم قيس، وليس مركز البلدة الحديثة.',en:'Approximate focus on the archaeological area and Umm Qais museum, rather than the modern town centre.'}
  },
  {
    id:'pella',coord:[35.61512,32.44877],governorate:{ar:'إربد',en:'Irbid'},governorateISO:'JO-IR',
    focus:{ar:'طبقة فحل · بيلا الأثرية',en:'Pella archaeological site'},zoom:12.7,pitch:55,bearing:-16,
    source:'https://whc.unesco.org/en/tentativelists/1554/',coordinateSource:'https://mapcarta.com/35137748',
    coordinateNote:{ar:'تركيز تقريبي على الموقع الأثري؛ حدود التلال ومناطق التنقيب أوسع من نقطة العرض.',en:'Approximate focus on the archaeological site; its hills and excavation areas extend beyond the camera point.'}
  },
  {
    id:'ummjimal',coord:[36.37000,32.32694],governorate:{ar:'المفرق',en:'Mafraq'},governorateISO:'JO-MA',
    focus:{ar:'أم الجمال الأثرية',en:'Umm al Jimal archaeological site'},zoom:12.7,pitch:55,bearing:22,
    source:'https://whc.unesco.org/en/list/1721/maps/',
    coordinateNote:{ar:'نقطة مرجعية للموقع التراثي منشورة لدى اليونسكو؛ ليست تحديدًا لبوابة الدخول.',en:'UNESCO reference point for the heritage property; it does not identify the entrance gate.'}
  },
  {
    id:'salt',coord:[35.72831,32.04261],governorate:{ar:'البلقاء',en:'Balqa'},governorateISO:'JO-BA',
    focus:{ar:'السلط · النسيج التاريخي',en:'As-Salt historic core'},zoom:12.8,pitch:55,bearing:-22,
    source:'https://whc.unesco.org/en/list/689/maps/',
    coordinateNote:{ar:'نقطة مرجعية لمدينة السلط التاريخية لدى اليونسكو؛ لا تمثل مدخلًا أو متحفًا بعينه.',en:'UNESCO reference point for historic As-Salt; it does not represent a specific entrance or museum.'}
  },
  {
    id:'iraq',coord:[35.75140,31.91280],governorate:{ar:'عمّان',en:'Amman'},governorateISO:'JO-AM',
    focus:{ar:'عراق الأمير · قصر العبد',en:'Iraq al Amir · Qasr al Abd'},zoom:12.8,pitch:55,bearing:24,
    source:'https://www.levantineceramics.org/sites/1262-iraq-al-amir',
    coordinateNote:{ar:'تركيز تقريبي على قصر العبد ضمن عراق الأمير؛ لا يشمل كل الكهوف والتجارب المحيطة.',en:'Approximate focus on Qasr al Abd in Iraq al Amir; it does not cover every nearby cave or experience.'}
  },
  {
    id:'amman',coord:[35.93931,31.95169],governorate:{ar:'عمّان',en:'Amman'},governorateISO:'JO-AM',
    focus:{ar:'وسط عمّان · المدرج الروماني',en:'Downtown Amman · Roman Theatre'},zoom:12.9,pitch:55,bearing:18,
    source:'https://international.visitjordan.com/wheretogo/amman/',
    coordinateNote:{ar:'المدرج الروماني نقطة العرض لوسط المدينة؛ عمّان وجهة أوسع وليست معلمًا بتذكرة موحدة.',en:'The Roman Theatre is the downtown camera focus; Amman is a wider destination without a single admission ticket.'}
  },
  {
    id:'citadel',coord:[35.93544,31.95431],governorate:{ar:'عمّان',en:'Amman'},governorateISO:'JO-AM',
    focus:{ar:'جبل القلعة',en:'Amman Citadel'},zoom:12.9,pitch:55,bearing:-18,
    source:'https://international.visitjordan.com/wheretogo/amman/',
    coordinateNote:{ar:'تركيز تقريبي على موقع جبل القلعة؛ له توقف مستقل عن وسط عمّان.',en:'Approximate focus on the Citadel site, with its own stop separate from downtown Amman.'}
  },
  {
    id:'kharana',coord:[36.46282,31.72897],governorate:{ar:'عمّان',en:'Amman'},governorateISO:'JO-AM',
    focus:{ar:'قصر الخرانة',en:'Qasr Kharana'},zoom:12.5,pitch:55,bearing:30,
    source:'https://moi.gov.jo/AR/Pages/المواقع_الأثرية_في_المحافظة__العاصمة',coordinateSource:'https://mapcarta.com/12840870',
    coordinateNote:{ar:'تركيز تقريبي على القصر في البادية الشرقية ضمن محافظة العاصمة، وليس محافظة الزرقاء.',en:'Approximate focus on the castle in the eastern desert of Amman Governorate, rather than Zarqa Governorate.'}
  },
  {
    id:'madaba',coord:[35.79544,31.71606],governorate:{ar:'مادبا',en:'Madaba'},governorateISO:'JO-MD',
    focus:{ar:'متنزه مادبا الأثري',en:'Madaba Archaeological Park'},zoom:12.8,pitch:55,bearing:-8,
    source:'https://international.visitjordan.com/wheretogo/madaba/',
    coordinateNote:{ar:'تركيز تقريبي على المتنزه الأثري داخل مدينة مادبا؛ جبل نيبو موقع منفصل.',en:'Approximate focus on the archaeological park within Madaba city; Mount Nebo is a separate site.'}
  },
  {
    id:'deadsea',coord:[35.58191,31.69920],governorate:{ar:'البلقاء',en:'Balqa'},governorateISO:'JO-BA',
    focus:{ar:'الساحل الأردني · محيط شاطئ عمّان السياحي',en:'Jordanian shore · Amman Tourist Beach area'},zoom:11.8,pitch:55,bearing:-34,
    source:'https://international.visitjordan.com/wheretogo/the-dead-sea/',
    coordinateNote:{ar:'تركيز ساحلي تقريبي قرب شاطئ عمّان السياحي؛ الوصول والخدمات والرسوم حسب المنشأة المختارة.',en:'Approximate coastal focus near Amman Tourist Beach; access, facilities and fees depend on the selected operator.'}
  },
  {
    id:'karak',coord:[35.70169,31.18094],governorate:{ar:'الكرك',en:'Karak'},governorateISO:'JO-KA',
    focus:{ar:'قلعة الكرك',en:'Karak Castle'},zoom:12.8,pitch:55,bearing:22,
    source:'https://international.visitjordan.com/wheretogo/karak/',
    coordinateNote:{ar:'تركيز تقريبي على القلعة في البلدة القديمة، وليس نقطة لوادي بن حمّاد.',en:'Approximate focus on the castle in the old town, not on Wadi Bin Hammad.'}
  },
  {
    id:'dana',coord:[35.60831,30.67431],governorate:{ar:'الطفيلة',en:'Tafilah'},governorateISO:'JO-AT',
    focus:{ar:'قرية ضانا وحافة الوادي',en:'Dana Village and valley rim'},zoom:12.1,pitch:55,bearing:-30,
    source:'https://international.visitjordan.com/wheretogo/dana-feynan/',
    coordinateNote:{ar:'تركيز تقريبي على القرية وحافة الوادي؛ المحمية ومساراتها تمتد على مساحة أوسع.',en:'Approximate focus on the village and valley rim; the reserve and its trails cover a wider area.'}
  },
  {
    id:'shobak',coord:[35.56091,30.53149],governorate:{ar:'معان',en:'Maan'},governorateISO:'JO-MN',
    focus:{ar:'قلعة الشوبك',en:'Shobak Castle'},zoom:12.6,pitch:55,bearing:26,
    source:'https://moi.gov.jo/EN/ListDetails/Governorates_and_Sectors/57/5',coordinateSource:'https://mapcarta.com/W108392488',
    coordinateNote:{ar:'تركيز تقريبي على قلعة الشوبك فوق التل، وليس مركز البلدة.',en:'Approximate focus on the hilltop Shobak Castle, rather than the town centre.'}
  },
  {
    id:'petra',coord:[35.45175,30.32214],governorate:{ar:'معان',en:'Maan'},governorateISO:'JO-MN',
    focus:{ar:'البترا · الخزنة',en:'Petra · Al-Khazneh'},zoom:12.8,pitch:55,bearing:24,
    source:'https://www.visitpetra.jo/en/Location/2',
    coordinateNote:{ar:'تركيز تقريبي على الخزنة داخل البترا؛ ليست مدخل الزوار أو نقطة وصول بالسيارة في وادي موسى.',en:'Approximate focus on the Treasury inside Petra; it is not the visitor entrance or a vehicle arrival point in Wadi Musa.'}
  },
  {
    id:'rum',coord:[35.42131,29.57404],governorate:{ar:'العقبة',en:'Aqaba'},governorateISO:'JO-AQ',
    focus:{ar:'وادي رم · القرية والجبال',en:'Wadi Rum · village and mountains'},zoom:11.8,pitch:55,bearing:34,
    source:'https://international.visitjordan.com/wheretogo/wadi-rum/',coordinateSource:'https://mapcarta.com/N802529483',
    coordinateNote:{ar:'تركيز تقريبي على قرية رم والجبال المحيطة، جنوب مركز الزوار وبعيدًا عن ساحل العقبة.',en:'Approximate focus on Rum village and surrounding mountains, south of the visitor centre and separate from Aqaba’s coast.'}
  },
  {
    id:'aqaba',coord:[35.00204,29.52138],governorate:{ar:'العقبة',en:'Aqaba'},governorateISO:'JO-AQ',
    focus:{ar:'قلعة العقبة والواجهة البحرية',en:'Aqaba Castle and waterfront'},zoom:12.3,pitch:55,bearing:-35,
    source:'https://international.visitjordan.com/wheretogo/aqaba/',coordinateSource:'https://mapcarta.com/34728766',
    coordinateNote:{ar:'تركيز تقريبي على القلعة والواجهة البحرية داخل مدينة العقبة، وليس وادي رم.',en:'Approximate focus on the castle and waterfront in Aqaba city, rather than Wadi Rum.'}
  }
];

export const SCENIC_STOPS = STOPS.map(stop=>({...stop,place:CATALOG_BY_ID[stop.id]}));
export const SCENIC_STOPS_BY_ID = Object.fromEntries(SCENIC_STOPS.map(stop=>[stop.id,stop]));

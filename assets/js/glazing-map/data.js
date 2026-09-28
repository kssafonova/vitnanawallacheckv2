/* «Персональная карта остекления»: зоны дома, вопросы сценариев и движок предварительных рекомендаций.
   Сначала — часть дома и эффект, система — только в итоге. Рекомендация — предварительная концепция,
   без цен и инженерных обещаний: всё подтверждается после изучения проекта и замера.

   Типы (JSDoc — сайт без сборщика и TypeScript):
   @typedef {'portal'|'window'|'terrace'|'garden'|'entry'|'second'} ZoneId
   @typedef {'daily'|'open'|'light'|'summer'|'season'|'year'|'view'|'warm'|'sun'|'unknown'} UsageId
   @typedef {'warm'|'view'|'open'|'threshold'|'sun'|'safety'|'expert'} PriorityId
   @typedef {'project'|'construction'|'ready'} StageId
   @typedef {{title:string, code?:'HS'|'FS'|'FIXED'|'FACADE'|'COLD'|'WARM'|'ENTRY'|'WINTER_GARDEN',
              shortDescription:string, engineerCheck:string[], disclaimer:string}} Recommendation
   @typedef {{id:string, zoneId:ZoneId, answers:Object<string,string>, answersText:string[], usage?:UsageId,
              priority?:PriorityId, stage?:StageId, recommendedSolution:Recommendation, createdAt:string}} ZoneSelection
   @typedef {{id?:string, selectedZones:ZoneSelection[], objectStage?:StageId, createdAt:string, updatedAt:string}} GlazingMapProject */

export const DISCLAIMER = 'Это предварительная концепция, составленная по вашим ответам. Возможность изготовления, точные размеры, стеклопакеты, пороги, нагрузки, монтажные узлы и стоимость подтверждаются после изучения проекта и инженерного замера.';

const STAGE_Q = {
  id: 'stage', title: 'Дом уже построен?', options: [
    { v: 'project', t: 'Есть проект', d: 'Проёмы можно заложить под систему заранее.' },
    { v: 'construction', t: 'Строится', d: 'Успеваем согласовать проёмы и пороги до отделки.' },
    { v: 'ready', t: 'Готов', d: 'Работаем с существующими проёмами.' },
  ],
};

/** Зоны: порядок — как в списке под картой. `q` — вопросы сценария (один на экран). */
export const ZONES = [
  {
    id: 'portal', num: '01', name: 'Гостиная → сад', where: 'Первый этаж, фасад к террасе',
    hint: 'Выход на участок из гостиной', aria: 'гостиная и выход в сад',
    q: [
      { id: 'usage', title: 'Как должна работать эта стена?', options: [
        { v: 'daily', t: 'Каждый день', d: 'Тёплый удобный переход на террасу.' },
        { v: 'open', t: 'Открывать летом', d: 'Максимально свободный проход на участок.' },
        { v: 'light', t: 'Больше света', d: 'Панорамное окно или витраж.' },
      ] },
      { id: 'priority', title: 'Что важнее всего?', options: [
        { v: 'warm', t: 'Тепло зимой' },
        { v: 'threshold', t: 'Нулевой порог' },
        { v: 'view', t: 'Максимум стекла' },
        { v: 'expert', t: 'Подобрать с инженером' },
      ] },
    ],
  },
  {
    id: 'window', num: '02', name: 'Панорамные окна', where: 'Второй этаж',
    hint: 'Свет и вид в спальнях и кабинете', aria: 'панорамные окна второго этажа',
    q: [
      { id: 'priority', title: 'Что особенно важно для этих окон?', options: [
        { v: 'view', t: 'Вид и минимум рам' },
        { v: 'warm', t: 'Тепло зимой' },
        { v: 'sun', t: 'Защита от солнца' },
        { v: 'expert', t: 'Нужен подбор' },
      ] },
      { id: 'opening', title: 'Нужно ли открывание?', options: [
        { v: 'yes', t: 'Да, для проветривания' },
        { v: 'no', t: 'Нет, главное — вид' },
        { v: 'unknown', t: 'Не знаю' },
      ] },
    ],
  },
  {
    id: 'terrace', num: '03', name: 'Терраса / веранда', where: 'Терраса у дома',
    hint: 'Сезонное или тёплое остекление', aria: 'терраса или веранда',
    q: [
      { id: 'usage', title: 'Когда хотите пользоваться террасой?', options: [
        { v: 'summer', t: 'Только летом' },
        { v: 'season', t: 'Весна–осень' },
        { v: 'year', t: 'Круглый год' },
      ] },
      { id: 'open', title: 'Как фасад должен открываться летом?', options: [
        { v: 'side', t: 'Открывать одну сторону' },
        { v: 'all', t: 'Открывать почти всё' },
        { v: 'none', t: 'Необязательно открывать' },
      ] },
      { id: 'roof', title: 'Что находится сверху?', options: [
        { v: 'roof', t: 'Готовая кровля' },
        { v: 'canopy', t: 'Навес' },
        { v: 'glass', t: 'Нужно верхнее остекление' },
        { v: 'unknown', t: 'Не знаю' },
      ] },
    ],
  },
  {
    id: 'garden', num: '04', name: 'Зимний сад', where: 'Пристройка к дому',
    hint: 'Стеклянное пространство у дома', aria: 'зимний сад',
    q: [
      { id: 'usage', title: 'Когда будет использоваться пространство?', options: [
        { v: 'season', t: 'Весна–осень' },
        { v: 'year', t: 'Круглый год' },
        { v: 'unknown', t: 'Нужен подбор' },
      ] },
      { id: 'priority', title: 'Что важнее?', options: [
        { v: 'light', t: 'Больше света' },
        { v: 'open', t: 'Открывать фасад' },
        { v: 'warm', t: 'Тепло зимой' },
        { v: 'expert', t: 'Нужен подбор' },
      ] },
    ],
  },
  {
    id: 'entry', num: '05', name: 'Входная группа', where: 'Главный вход',
    hint: 'Дверь, боковой свет и фрамуга', aria: 'входная группа',
    q: [
      { id: 'priority', title: 'Что важнее для входа?', options: [
        { v: 'light', t: 'Свет в холле' },
        { v: 'privacy', t: 'Приватность' },
        { v: 'safety', t: 'Безопасность' },
        { v: 'composition', t: 'Единая композиция фасада' },
      ] },
      STAGE_Q,
    ],
  },
  {
    id: 'second', num: '06', name: 'Второй свет / фронтон', where: 'Высокий объём дома',
    hint: 'Высокое фасадное остекление', aria: 'второй свет и фронтон',
    q: [
      { id: 'priority', title: 'Что нужно в этой зоне?', options: [
        { v: 'light', t: 'Максимум света' },
        { v: 'view', t: 'Вид на участок' },
        { v: 'sun', t: 'Защита от солнца' },
        { v: 'warm', t: 'Тепло зимой' },
      ] },
      { id: 'opening', title: 'Нужны открывающиеся части?', options: [
        { v: 'yes', t: 'Да' },
        { v: 'no', t: 'Нет' },
        { v: 'expert', t: 'Нужен подбор' },
      ] },
    ],
  },
];

export const zoneById = id => ZONES.find(z => z.id === id);

/** Подписи выбранных ответов — для итога и письма инженеру. */
export function answersText(zone, answers) {
  return zone.q.map(q => {
    const o = q.options.find(x => x.v === answers[q.id]);
    return o ? `${q.title} — ${o.t}` : null;
  }).filter(Boolean);
}

const rec = (title, code, shortDescription, engineerCheck) => ({ title, code, shortDescription, engineerCheck, disclaimer: DISCLAIMER });

/** Движок рекомендаций: ответы зоны → предварительное решение. @returns {Recommendation} */
export function recommend(zoneId, a) {
  switch (zoneId) {
    case 'portal': {
      const checks = ['Проверить габариты проёма.', 'Проверить вес и допустимые размеры створок.',
        'Проверить порог, отметку чистого пола и водоотведение.', 'Проверить монтажный узел и подготовку проёма.'];
      if (a.priority === 'threshold') checks.unshift('Нулевой порог: заложить нижний профиль в пол и продумать водоотвод.');
      if (a.priority === 'warm') checks.unshift('Тепло зимой: подобрать стеклопакет и утеплить узел примыкания.');
      if (a.usage === 'open') return rec('FS-складная система', 'FS',
        a.priority === 'warm' ? 'Фасад раскрывается летом почти целиком. Теплотехнику складной системы сравним с раздвижной для этого проёма.'
          : 'Фасад раскрывается летом почти целиком — свободный проход из гостиной на участок.', checks);
      if (a.usage === 'light') return rec('Панорамное окно / фасадный витраж', 'FIXED',
        a.priority === 'view' ? 'Больше стекла и света без выхода — минимум рам в плоскости фасада.' : 'Свет и вид на сад без выхода через эту стену.',
        checks.filter(c => !c.startsWith('Нулевой')));
      return rec('HS-раздвижной портал', 'HS', 'Тёплый ежедневный выход на террасу: створка поднимается и сдвигается, не занимая места в комнате.', checks);
    }
    case 'window': {
      const checks = ['Подобрать стеклопакет по ориентации фасада.', 'Проверить безопасность стекла.',
        'Определить открывающиеся части.', 'Проверить габариты и статическую схему.'];
      if (a.priority === 'sun') checks.unshift('Солнцезащита: стекло с селективным покрытием или наружная защита.');
      const open = a.opening === 'yes' ? ' Часть створок — открывающиеся, для проветривания.'
        : a.opening === 'no' ? ' Глухое остекление — максимум вида.' : ' Открывающиеся части определим вместе с инженером.';
      const lead = { view: 'Вид и свет на втором этаже, минимум рам.', warm: 'Тёплое панорамное остекление второго этажа.',
        sun: 'Панорама со светом без перегрева комнат.', expert: 'Панорамное остекление второго этажа — подберём с инженером.' }[a.priority] || 'Вид и свет на втором этаже.';
      return rec('Панорамное окно / фасадный витраж', 'FIXED', lead + open, checks);
    }
    case 'terrace': {
      const checks = ['Проверить основание и опоры.', 'Проверить кровлю и верхнее примыкание.', 'Проверить водоотведение и порог.'];
      const when = { summer: 'Летом', season: 'Весна–осень', year: 'Круглый год' }[a.usage] || '';
      const openText = { side: 'одна сторона открывается', all: 'фасад открывается почти целиком', none: 'без раскрытия фасада' }[a.open] || '';
      let r;
      if (a.usage === 'year') {
        checks.unshift('Тёплый контур: основание, утепление пола, стеклопакеты и отопление.');
        r = rec('Тёплое остекление террасы', 'WARM', `${when}, ${openText}. Тёплый контур с термопрофилем и стеклопакетами.`, checks);
      } else if (a.usage === 'season' && (a.open === 'side' || a.open === 'all')) {
        r = rec('Открываемое остекление террасы', 'FS', `${when}, ${openText}. Складная FS-система или сезонная раздвижная.`, checks);
      } else {
        r = rec('Сезонное (холодное) остекление террасы', 'COLD', `${when}${openText ? ', ' + openText : ''}. Защита от ветра и дождя без тёплого контура.`, checks);
      }
      if (a.roof === 'glass') {
        r.title += ' + стеклянная кровля';
        r.engineerCheck.push('Стеклянная кровля: несущая схема, снеговые нагрузки и водоотвод — как у зимнего сада.');
      } else if (a.roof === 'unknown') r.engineerCheck.push('Определить, что будет сверху: кровля, навес или остекление.');
      return r;
    }
    case 'garden': {
      const lead = { season: 'Сезонный зимний сад: весна–осень.', year: 'Тёплый зимний сад для круглогодичного использования.', unknown: 'Режим использования подберём с инженером.' }[a.usage] || '';
      const want = { light: ' Акцент — максимум света.', open: ' Фасад с открывающимися секциями.', warm: ' Акцент — тепло зимой.', expert: '' }[a.priority] || '';
      return rec('Проектное остекление зимнего сада', 'WINTER_GARDEN', lead + want, ['Фундамент и несущая схема.',
        'Кровля, водоотведение и снеговые нагрузки.', 'Вентиляция и солнцезащита.', 'Примыкание к существующему дому.']);
    }
    case 'entry': {
      const lead = { light: 'Больше дневного света в холле.', privacy: 'Свет в холле с матовым или тонированным стеклом для приватности.',
        safety: 'Усиленная дверь и безопасное стекло.', composition: 'Вход в одной композиции с остеклением фасада.' }[a.priority] || '';
      const checks = ['Габариты проёма и открывание двери.', 'Безопасность стекла и фурнитура.', 'Порог и примыкание к крыльцу.'];
      if (a.stage === 'ready') checks.push('Работа с существующим проёмом.');
      return rec('Входная группа: дверь + боковой витраж + верхняя фрамуга', 'ENTRY', lead, checks);
    }
    case 'second': {
      const lead = { light: 'Максимум света в двусветном объёме.', view: 'Высокое остекление с видом на участок.',
        sun: 'Высокое остекление с солнцезащитой.', warm: 'Высокое тёплое остекление фронтона.' }[a.priority] || '';
      const open = a.opening === 'yes' ? ' С открывающимися частями.' : a.opening === 'no' ? ' Глухое остекление.' : '';
      return rec('Высокий фасадный витраж / фронтонное остекление', 'FACADE', lead + open, ['Геометрия фронтона.',
        'Разбивка стеклянной плоскости.', 'Вес стеклопакетов и монтаж.', 'Солнцезащита.', 'Вентиляция и открывания.']);
    }
  }
  return rec('Подбор с инженером', undefined, '', []);
}

/** Поля usage / priority / stage из ответов — как в типе ZoneSelection. */
export function selectionFields(zoneId, a) {
  const f = {}, USAGE = ['daily', 'open', 'light', 'summer', 'season', 'year', 'view', 'warm', 'sun', 'unknown'],
    PRIORITY = ['warm', 'view', 'open', 'threshold', 'sun', 'safety', 'expert'];
  if (USAGE.includes(a.usage)) f.usage = a.usage;
  if (PRIORITY.includes(a.priority)) f.priority = a.priority;
  if (a.stage) f.stage = a.stage;
  return f;
}

/** Подпись к состоянию 3D-сцены: что сейчас показывает дом (под вопросом в панели). */
export function sceneCaption(zoneId, a) {
  switch (zoneId) {
    case 'portal': return { daily: 'Тёплый раздвижной сценарий: створки уходят за глухую, светлая линия — чистый проход', open: 'Складной сценарий: створки собираются к стороне, проём открыт почти целиком', light: 'Панорамный витраж: порог исчезает, стена становится стеклом' }[a.usage] || 'HS-портал в стене гостиной';
    case 'terrace': return a.roof === 'glass' ? 'Стеклянная кровля над террасой' : a.open === 'all' ? 'Фасад террасы раскрывается почти целиком' : a.open === 'side' ? 'Открывается одна сторона' : 'Стеклянный контур террасы';
    case 'garden': return a.priority === 'open' ? 'Створка зимнего сада сдвигается' : 'Стеклянная пристройка у дома';
    case 'window': return a.opening === 'yes' ? 'Открывающиеся створки для проветривания' : a.priority === 'sun' ? 'Солнцезащитное стекло' : 'Панорамные окна второго этажа';
    case 'entry': return a.priority === 'privacy' ? 'Матовое стекло в боковом витраже и фрамуге' : 'Дверь, боковой витраж и фрамуга';
    case 'second': return a.priority === 'sun' ? 'Ламели защищают высокий витраж от солнца' : 'Тёплый свет во втором свете';
  }
  return '';
}

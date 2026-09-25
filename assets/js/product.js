(() => {
  const root=document.querySelector('[data-product-root]');
  const sku=document.body.dataset.sku;
  if(!root||!sku)return;

  const base='../../../';
  const meta={
    HS2:{code:'HS / 30',name:'Классический выход',story:'Большой стеклянный проём без распашной створки.',lead:'Двухсекционный подъёмно-раздвижной портал для ежедневного выхода из гостиной или кухни-столовой на террасу. Активная створка движется параллельно фиксированной и не занимает пространство комнаты.',use:'Гостиная · кухня-столовая · терраса',opening:'≈ 50% проёма'},
    HS3:{code:'HS / 36',name:'Широкий проход',story:'Две активные створки — больше открытого пространства.',lead:'Трёхсекционный HS-портал для широкого выхода на террасу. Две активные створки позволяют освободить большую часть фасадного проёма, сохраняя спокойную панорамную композицию.',use:'Большая гостиная · терраса · веранда',opening:'до ≈ 66% проёма'},
    HS4:{code:'HS / 48',name:'Открывание от центра',story:'Симметричный портал для главного фасада дома.',lead:'Четырёхсекционная конфигурация с двумя центральными активными створками. Подходит для широкого панорамного фасада и главного выхода на террасу, когда важна симметрия.',use:'Главный фасад · большая терраса · дом с видом',opening:'≈ 50% проёма'},
    FS3:{code:'FS / 27',name:'Три складные створки',story:'Створки складываются к краю и освобождают почти весь проём.',lead:'Компактная складная система для террасы или веранды. Три створки собираются пакетом у одной стороны и оставляют максимально открытый проход.',use:'Терраса · веранда · летняя кухня',opening:'почти весь проём'},
    FS4:{code:'FS / 36',name:'Схема 3 + 1',story:'Большой складной фасад с отдельной проходной створкой.',lead:'Четырёхсекционный складной портал: три створки собираются пакетом, одна может работать как отдельная проходная. Для просторных террас и веранд.',use:'Терраса · веранда · павильон',opening:'почти весь проём'}
  };
  const colors={'9016':'#f2f2ed','7016':'#383b3a','7024':'#4b4d4c','9005':'#111'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
  const rel=slug=>base+slug;

  const smallSvg=v=>{
    if(v.model==='HS2'){
      const right=v.scheme_code==='B1';
      return '<svg viewBox="0 0 100 52"><rect x="2" y="2" width="96" height="48"/><line x1="50" y1="2" x2="50" y2="50"/><path d="'+(right?'M87 38H57m7-6-7 6 7 6':'M13 38h30m-7-6 7 6-7 6')+'"/></svg>';
    }
    if(v.model==='HS3')return '<svg viewBox="0 0 100 52"><rect x="2" y="2" width="96" height="48"/><line x1="34" y1="2" x2="34" y2="50"/><line x1="66" y1="2" x2="66" y2="50"/><path d="M11 38h47m-7-6 7 6-7 6"/></svg>';
    if(v.model==='HS4')return '<svg viewBox="0 0 100 52"><rect x="2" y="2" width="96" height="48"/><line x1="26" y1="2" x2="26" y2="50"/><line x1="50" y1="2" x2="50" y2="50"/><line x1="74" y1="2" x2="74" y2="50"/><path d="M46 38H31m6-6-6 6 6 6M54 38h15m-6-6 6 6-6 6"/></svg>';
    if(v.model==='FS3')return '<svg viewBox="0 0 100 52"><rect x="2" y="2" width="96" height="48"/><path d="M18 10l16 16-16 16M34 10l16 16-16 16M50 10l16 16-16 16"/></svg>';
    return '<svg viewBox="0 0 100 52"><rect x="2" y="2" width="96" height="48"/><path d="M14 9l14 17-14 17M28 9l14 17-14 17M42 9l14 17-14 17"/><line x1="75" y1="4" x2="75" y2="48"/></svg>';
  };

  const largeSvg=v=>{
    const width=esc(v.size.split(' × ')[0]);
    if(v.model==='HS2'){
      const right=v.scheme_code==='B1';
      return '<svg viewBox="0 0 680 340"><rect x="38" y="44" width="604" height="232"/><line x1="340" y1="44" x2="340" y2="276"/><path d="'+(right?'M560 170H410m22-18-22 18 22 18':'M120 170H270m-22-18 22 18-22 18')+'"/><text x="'+(right?'470':'148')+'" y="138" style="fill:#111;stroke:none;font-size:14px">ACTIVE</text><text x="'+(right?'148':'470')+'" y="138" style="fill:#111;stroke:none;font-size:14px">FIX</text><text x="300" y="325" style="fill:#111;stroke:none;font-size:13px">'+width+'</text></svg>';
    }
    if(v.model==='HS3')return '<svg viewBox="0 0 680 340"><rect x="38" y="44" width="604" height="232"/><line x1="239" y1="44" x2="239" y2="276"/><line x1="440" y1="44" x2="440" y2="276"/><text x="100" y="138" style="fill:#111;stroke:none;font-size:14px">ACTIVE</text><text x="300" y="138" style="fill:#111;stroke:none;font-size:14px">ACTIVE</text><text x="515" y="138" style="fill:#111;stroke:none;font-size:14px">FIX</text><path d="M110 176H410m-22-18 22 18-22 18"/><text x="300" y="325" style="fill:#111;stroke:none;font-size:13px">'+width+'</text></svg>';
    if(v.model==='HS4')return '<svg viewBox="0 0 680 340"><rect x="38" y="44" width="604" height="232"/><line x1="189" y1="44" x2="189" y2="276"/><line x1="340" y1="44" x2="340" y2="276"/><line x1="491" y1="44" x2="491" y2="276"/><text x="85" y="138" style="fill:#111;stroke:none;font-size:14px">FIX</text><text x="235" y="138" style="fill:#111;stroke:none;font-size:14px">ACTIVE</text><text x="382" y="138" style="fill:#111;stroke:none;font-size:14px">ACTIVE</text><text x="535" y="138" style="fill:#111;stroke:none;font-size:14px">FIX</text><path d="M320 176H210m22-18-22 18 22 18M360 176h110m-22-18 22 18-22 18"/><text x="300" y="325" style="fill:#111;stroke:none;font-size:13px">'+width+'</text></svg>';
    if(v.model==='FS3')return '<svg viewBox="0 0 680 340"><rect x="38" y="44" width="604" height="232"/><path d="M130 72l95 88-95 88M225 72l95 88-95 88M320 72l95 88-95 88"/><text x="300" y="325" style="fill:#111;stroke:none;font-size:13px">'+width+'</text></svg>';
    return '<svg viewBox="0 0 680 340"><rect x="38" y="44" width="604" height="232"/><path d="M105 72l85 88-85 88M190 72l85 88-85 88M275 72l85 88-85 88"/><line x1="500" y1="44" x2="500" y2="276"/><text x="300" y="325" style="fill:#111;stroke:none;font-size:13px">'+width+'</text></svg>';
  };

  const initForm=()=>{
    const form=document.querySelector('[data-product-form]');
    if(!form)return;
    const status=form.querySelector('[data-form-status]');
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=form.querySelector('button[type="submit"]');
      const old=button?.innerHTML;
      if(button){button.disabled=true;button.textContent='Отправляем…'}
      if(status)status.textContent='';
      try{
        const res=await fetch(form.dataset.endpoint||base+'forms/send.php',{method:'POST',body:new FormData(form)});
        if(!res.ok)throw new Error('HTTP '+res.status);
        if(status)status.textContent='Спасибо. Получили запрос — свяжемся с вами для уточнения проекта.';
        form.reset();
      }catch(e){
        if(status)status.textContent='Не удалось отправить форму. Позвоните нам или попробуйте ещё раз.';
      }finally{
        if(button){button.disabled=false;button.innerHTML=old}
      }
    });
  };

  const initReveal=()=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver' in window))return;
    const items=[...document.querySelectorAll('[data-reveal]')];
    items.forEach(el=>el.classList.add('reveal-ready'));
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('is-visible');io.unobserve(entry.target)}
    }),{threshold:.12,rootMargin:'0px 0px -7% 0px'});
    items.forEach(el=>io.observe(el));
  };

  fetch(base+'data/products.json')
    .then(r=>{if(!r.ok)throw new Error('products.json');return r.json()})
    .then(data=>{
      const v=data.variants.find(item=>item.sku===sku);
      if(!v)throw new Error('SKU not found');
      const m=meta[v.model];
      const family=data.variants.filter(item=>item.model===v.model);
      const colorOptions=family.filter(item=>item.scheme_slug===v.scheme_slug);
      const schemeOptions=family.filter(item=>item.color_slug===v.color_slug);
      const isHS=v.model.startsWith('HS');
      if(!isHS){
        window.location.replace(base+'systems/fs/');
        return;
      }
      const customHref=isHS?base+'systems/hs/#hs-calculator':base+'index.html#calculator';
      const systemHref=isHS?base+'systems/hs/':base+'index.html#systems';

      document.title=m.code+' — '+v.size+', '+v.color+' RAL '+v.ral+' | PORTAL SYSTEMS';

      const swatches=colorOptions.map(x=>'<a class="product-swatch '+(x.sku===v.sku?'is-active':'')+'" href="'+rel(x.slug)+'"><span class="product-swatch__dot" style="--sw:'+(colors[x.ral]||'#ccc')+'"></span><span><strong>'+esc(x.color)+'</strong><small>RAL '+esc(x.ral)+'</small></span></a>').join('');
      const schemes=schemeOptions.map(x=>'<a class="product-scheme '+(x.sku===v.sku?'is-active':'')+'" href="'+rel(x.slug)+'">'+esc(x.scheme_label.replace(/^Схема\s+[A-Z0-9-]+\s*·\s*/i,''))+'<span>→</span></a>').join('');
      const tech=[
        ['Профильная база',v.profile],['Механизм',v.hardware],['Направляющая',v.track],['Глубина рамы',v.frame_depth],
        ['Глубина створки',v.sash_depth],['Заполнение',v.filling],['Стеклопакет',v.glass],['Секции',String(v.sections)]
      ].map(([a,b])=>'<div><small>'+esc(a)+'</small><strong>'+esc(b)+'</strong></div>').join('');

      root.innerHTML=`
<div class="p-wrap p-crumbs"><a href="${base}">Главная</a><span>/</span><a href="${base}catalog/">Каталог</a><span>/</span><a href="${systemHref}">${isHS?'HS':'FS'}</a><span>/</span>${m.code}</div>
<section class="product-hero">
  <div class="product-hero__grid">
    <div class="product-media" data-reveal>
      <img src="${base+v.image}" alt="${m.code} — ${esc(v.size)}, ${esc(v.color)}">
      <span class="product-media__label">${esc(v.scheme_code)} · ${esc(v.color)} RAL ${esc(v.ral)}</span>
      <span class="product-media__scheme" aria-hidden="true">${smallSvg(v)}</span>
    </div>
    <aside class="product-buy">
      <div class="product-buy__top"><span class="product-buy__code">${m.code}</span><span class="product-buy__status">готовая конфигурация</span></div>
      <h1>${m.name}<small>${esc(v.size)} · ${esc(v.color)} RAL ${esc(v.ral)}</small></h1>
      <p class="product-buy__lead">${m.lead}</p>
      <div class="product-price"><div class="product-price__value"><small>Стоимость конструкции от</small><strong>${money(v.price)}</strong></div><div class="product-price__term">срок — после подтверждения комплектации</div></div>
      <div class="product-quick">
        <div><small>Схема</small><strong>${esc(v.scheme_code)}</strong></div><div><small>Открывание</small><strong>${esc(m.opening)}</strong></div>
        <div><small>Секции</small><strong>${v.sections}</strong></div><div><small>Сценарий</small><strong>${esc(m.use)}</strong></div>
      </div>
      <div class="product-variant"><div class="product-variant__head"><span>Цвет</span><span>${esc(v.color)} · RAL ${esc(v.ral)}</span></div><div class="product-swatches">${swatches}</div></div>
      <div class="product-variant"><div class="product-variant__head"><span>Схема</span><span>${esc(v.scheme_code)}</span></div><div class="product-schemes">${schemes}</div></div>
      <div class="product-actions"><a class="ui-btn ui-btn--dark" href="#product-contact">Получить точную смету <span>→</span></a><a class="ui-btn" href="${customHref}">Изменить размер / комплектацию <span>↗</span></a></div>
      <p class="product-sku">Артикул: ${esc(v.sku)}</p>
    </aside>
  </div>
</section>

<section class="product-story">
  <div class="p-wrap">
    <div class="product-story__grid"><p class="ui-eyebrow">01 · Конфигурация</p><div class="product-story__main"><h2>${m.story}</h2><p class="product-story__copy">${m.lead} Конкретный SKU фиксирует размер, цвет и схему; если архитектура требует другого решения, рассчитываем отдельную конфигурацию.</p></div></div>
    <div class="product-config" data-reveal><div class="product-config__drawing">${largeSvg(v)}</div><div class="product-config__facts"><div><small>Размер</small><strong>${esc(v.size)}</strong></div><div><small>Конфигурация</small><strong>${esc(v.subtitle)}</strong></div><div><small>Схема</small><strong>${esc(v.scheme_label)}</strong></div><div><small>Цвет</small><strong>${esc(v.color)} · RAL ${esc(v.ral)}</strong></div></div></div>
  </div>
</section>

<section class="product-lifestyle" data-reveal>
  <img src="${base+v.architecture}" alt="${m.code} в архитектуре загородного дома" loading="lazy" decoding="async">
  <div class="product-lifestyle__copy"><small>${m.code} · ${esc(v.size)}</small><h2>Система внутри архитектуры</h2><p>${esc(m.use)}. Портал подбираем по проёму, планировке и маршруту движения, а не только по размеру из каталога.</p></div>
</section>

<section class="product-tech">
  <div class="p-wrap">
    <header class="product-tech__head"><h2>Инженерная спецификация</h2><p>Поставщиков и комплектующие показываем на техническом уровне. Итоговые характеристики конкретной конструкции подтверждаются после расчёта размера и стеклопакета.</p></header>
    <div class="product-tech__grid">${tech}</div>
    <div class="product-docs"><a class="product-doc" href="${systemHref}"><div><strong>Описание системы и механики</strong><small>Схемы открывания, стеклопакеты и инженерные ориентиры</small></div><span>↗</span></a><a class="product-doc" href="${customHref}"><div><strong>Индивидуальная конфигурация</strong><small>Другой размер, стекло, цвет или монтажный узел</small></div><span>→</span></a></div>
  </div>
</section>

<section class="product-custom">
  <div class="p-wrap product-custom__grid"><div><p class="ui-eyebrow">02 · Под проект</p><h2>Не нашли точный вариант?</h2></div><div>
    <div class="product-custom__rows">
      <div><span>01</span><div><b>Другой размер</b><p>Проверим геометрию створок и допустимый вес стекла.</p></div></div>
      <div><span>02</span><div><b>Другой RAL</b><p>Подберём цвет под фасад, кровлю и другие алюминиевые элементы.</p></div></div>
      <div><span>03</span><div><b>Стекло под задачу</b><p>Безопасность, акустика, солнцезащита и теплотехника — в одной формуле.</p></div></div>
      <div><span>04</span><div><b>Монтажный узел</b><p>Согласуем порог, чистовой пол, гидроизоляцию и наружный водоотвод.</p></div></div>
    </div>
    <a class="ui-btn ui-btn--dark" href="${customHref}">Рассчитать индивидуально <span>→</span></a>
  </div></div>
</section>

<section class="product-contact" id="product-contact">
  <div class="p-wrap product-contact__grid"><div><p class="ui-eyebrow">03 · Точная смета</p><h2>Начнём с вашего проёма</h2><p class="product-contact__copy">Оставьте телефон и примерные размеры. Зафиксируем нужную конфигурацию, проверим ограничения и уточним стоимость изготовления и монтажа.</p></div>
    <form class="product-form" data-product-form data-endpoint="${base}forms/send.php"><input type="hidden" name="source" value="${esc(v.sku)}"><label class="product-field"><span>Имя</span><input name="name" autocomplete="name" required placeholder="Ваше имя"></label><label class="product-field"><span>Телефон</span><input name="phone" autocomplete="tel" required placeholder="+7 999 000-00-00"></label><label class="product-field"><span>Комментарий</span><textarea name="comment" placeholder="Размер проёма, стадия строительства, пожелания"></textarea></label><button class="ui-btn ui-btn--dark" type="submit">Получить расчёт <span>→</span></button><p class="product-form__status" data-form-status></p></form>
  </div>
</section>

<div class="mobile-buy"><div class="mobile-buy__price"><small>от</small><strong>${money(v.price)}</strong></div><a class="ui-btn ui-btn--dark" href="#product-contact">Получить смету <span>→</span></a></div>
      `;
      initForm();initReveal();
    })
    .catch(err=>{
      root.innerHTML='<div class="p-wrap" style="padding:80px 20px"><h1 style="font-weight:300">Товар временно недоступен</h1><p>Не удалось загрузить конфигурацию. Вернитесь в <a href="'+base+'catalog/" style="text-decoration:underline">каталог</a>.</p></div>';
      console.error(err);
    });
})();
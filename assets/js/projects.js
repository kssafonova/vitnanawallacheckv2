// Страница «Проекты»: фильтры (система — вкладки, объект и статус — списки, «Сбросить») и просмотр проекта крупно (<dialog>).
// Карточки собирает tools/build.mjs из data/projects.json; без JS видны все проекты.
(() => {
  const root = document.querySelector('[data-projects]');
  if (!root) return;
  const cards = [...root.querySelectorAll('.pj-card')];
  const tabs = [...root.querySelectorAll('[data-pj-system]')];
  const selType = root.querySelector('[data-pj-type]'), selStatus = root.querySelector('[data-pj-status]');
  const count = root.querySelector('[data-pj-count]'), empty = root.querySelector('[data-pj-empty]');
  const st = { system: '', type: '', status: '' };
  const word = n => (n % 10 === 1 && n % 100 !== 11 ? 'проект' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'проекта' : 'проектов');

  const apply = () => {
    let shown = 0;
    cards.forEach(c => {
      const ok = (!st.system || c.dataset.system.split(' ').includes(st.system))
        && (!st.type || c.dataset.type === st.type) && (!st.status || c.dataset.status === st.status);
      c.hidden = !ok;
      if (ok) shown++;
    });
    tabs.forEach(t => t.setAttribute('aria-pressed', String(t.dataset.pjSystem === st.system)));
    count.textContent = `${shown} ${word(shown)}`;
    empty.hidden = shown > 0;
  };
  tabs.forEach(t => t.addEventListener('click', () => { st.system = t.dataset.pjSystem; apply(); }));
  selType.addEventListener('change', () => { st.type = selType.value; apply(); });
  selStatus.addEventListener('change', () => { st.status = selStatus.value; apply(); });
  root.querySelectorAll('[data-pj-reset]').forEach(b => b.addEventListener('click', () => {
    Object.assign(st, { system: '', type: '', status: '' }); selType.value = ''; selStatus.value = ''; apply();
  }));
  apply();

  // Просмотр крупно
  const dlg = document.querySelector('[data-pj-dialog]');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const $ = s => dlg.querySelector(s);
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-pj-open]');
    if (!b) return;
    const c = b.closest('.pj-card'), img = c.querySelector('img');
    $('[data-pj-img]').src = img.src; $('[data-pj-img]').alt = img.alt;
    $('[data-pj-tag]').textContent = c.querySelector('.pj-card__tag').textContent;
    $('[data-pj-title]').textContent = c.querySelector('h2').textContent;
    $('[data-pj-meta]').innerHTML = c.querySelector('.pj-card__meta').innerHTML;
    $('[data-pj-text]').textContent = c.querySelector('.pj-card__text').textContent;
    dlg.showModal();
  });
  $('[data-pj-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
})();

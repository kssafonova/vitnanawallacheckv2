// Страница «Проекты» (как vitrocsa.com/projects): фильтры — вкладки систем, «Объект», «Статус», «Сбросить»;
// подробности проекта — тёмная плашка поверх фото при наведении (CSS), на сенсорных экранах — по нажатию (.is-open).
// Карточки собирает tools/build.mjs из data/projects.json; без JS видны все проекты.
(() => {
  const root = document.querySelector('[data-projects]');
  if (!root) return;
  const cards = [...root.querySelectorAll('.pj-card')];
  const tabs = [...root.querySelectorAll('[data-pj-system]')];
  const selType = root.querySelector('[data-pj-type]'), selStatus = root.querySelector('[data-pj-status]');
  const selSystem = root.querySelector('[data-pj-system-select]'); // на телефоне вместо вкладок
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
    if (selSystem) selSystem.value = st.system;
    count.textContent = `${shown} ${word(shown)}`;
    empty.hidden = shown > 0;
  };
  tabs.forEach(t => t.addEventListener('click', () => { st.system = t.dataset.pjSystem; apply(); }));
  if (selSystem) selSystem.addEventListener('change', () => { st.system = selSystem.value; apply(); });
  selType.addEventListener('change', () => { st.type = selType.value; apply(); });
  selStatus.addEventListener('change', () => { st.status = selStatus.value; apply(); });
  root.querySelectorAll('[data-pj-reset]').forEach(b => b.addEventListener('click', () => {
    Object.assign(st, { system: '', type: '', status: '' }); selType.value = ''; selStatus.value = ''; apply();
  }));
  apply();

  // Сенсорные экраны: нажатие по фото показывает / прячет подробности (открыта одна карточка)
  if (matchMedia('(hover: none)').matches) {
    root.addEventListener('click', e => {
      const m = e.target.closest('.pj-card__media');
      if (!m) return;
      const open = !m.classList.contains('is-open');
      root.querySelectorAll('.pj-card__media.is-open').forEach(x => x.classList.remove('is-open'));
      m.classList.toggle('is-open', open);
    });
  }
})();

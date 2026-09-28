/* «Персональная карта остекления» (/osteklenie-pod-klyuch/): интерфейс карты.
   Не линейный квиз: общий вид дома → метка или кнопка зоны → 2–3 коротких вопроса → зона в проекте → следующая зона
   → итог «Ваш проект остекления» → форма инженеру (<lead-form data-mode="engineering">).
   Сцена: сначала статичная схема (рендер + HTML-метки + контуры SVG), 3D подгружается позже —
   на компьютере при появлении в кадре, на телефоне после первого действия. Spline — если настроен (spline.js), иначе three.js.
   Нет WebGL, prefers-reduced-motion или экономия трафика — остаёмся на схеме, весь сценарий работает. */
import { ZONES, zoneById } from './data.js';
import * as store from './store.js';
import { track, setMetrika } from './analytics.js';
import { FALLBACK } from './fallback-geometry.js';

const root = document.querySelector('[data-gm]');
if (root) init();

function init() {
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cfg = (() => { try { return JSON.parse(document.getElementById('gm-config')?.textContent || '{}'); } catch (e) { return {}; } })();
  setMetrika(cfg.metrika);
  const mqReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mqDesk = matchMedia('(min-width: 1000px)');
  const reduced = () => mqReduced.matches;

  const stage = $('[data-gm-stage]'), hotLayer = $('[data-gm-hots]'), svg = $('[data-gm-outlines]');
  const intro = $('[data-gm-intro]'), panel = $('[data-gm-panel]'), panelBody = $('[data-gm-panel-body]'), backdrop = $('[data-gm-backdrop]');
  const chips = $('[data-gm-chips]'), status = $('[data-gm-status]');
  const summary = $('[data-gm-summary]'), list = $('[data-gm-list]'), mini = $('[data-gm-mini]');
  const leadSec = $('[data-gm-lead]'), lead = $('lead-form', leadSec), done = $('[data-gm-done]');
  const toast = $('[data-gm-toast]');

  let scene = null;            // контроллер 3D (three.js или Spline), null — статичная схема
  let started = false;
  let active = null;           // открытая зона
  let draft = {};              // ответы открытой зоны
  let step = 0;                // номер вопроса; = q.length — экран «Зона добавлена»
  let opener = null;           // элемент, открывший панель (вернуть фокус)

  // ---------- метки, контуры, кнопки зон ----------
  const hots = {}, polys = {};
  ZONES.forEach(z => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'gm-hot'; b.dataset.zone = z.id;
    b.setAttribute('aria-label', 'Выбрать зону: ' + z.aria);
    b.innerHTML = `<span class="gm-hot__dot" aria-hidden="true"></span><span class="gm-hot__tip" aria-hidden="true"><b>${esc(z.name)}</b>${esc(z.hint)}</span>`;
    b.addEventListener('click', () => openZone(z.id, b, 'hotspot'));
    hotLayer.appendChild(b); hots[z.id] = b;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    p.setAttribute('points', (FALLBACK.outlines[z.id] || []).map(([x, y]) => `${x},${y}`).join(' '));
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(p); polys[z.id] = p;
  });
  chips.innerHTML = ZONES.map(z => `<button type="button" class="gm-chip" data-zone="${z.id}"><span class="gm-chip__n" aria-hidden="true"></span><span>${esc(z.name)}</span></button>`).join('');
  $$('.gm-chip', chips).forEach(b => b.addEventListener('click', () => openZone(b.dataset.zone, b, 'chip')));
  $$('[data-gm-open]', document).forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    root.querySelector('#map')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    openZone(a.dataset.gmOpen, a, 'link');
  }));

  function placeHots(anchors) {
    for (const z of ZONES) {
      const a = anchors?.[z.id] || { ...FALLBACK.anchors[z.id], visible: true };
      const h = hots[z.id];
      h.style.left = (a.x * 100).toFixed(2) + '%';
      h.style.top = (a.y * 100).toFixed(2) + '%';
      h.hidden = !a.visible;
    }
  }
  placeHots(null);

  // ---------- состояние → интерфейс ----------
  const numOf = id => { const i = store.getProject().selectedZones.findIndex(s => s.zoneId === id); return i < 0 ? '' : String(i + 1).padStart(2, '0'); };

  function renderMarks() {
    const sel = store.getProject().selectedZones.map(s => s.zoneId);
    for (const z of ZONES) {
      const n = numOf(z.id), on = !!n;
      const h = hots[z.id];
      h.classList.toggle('is-selected', on); h.classList.toggle('is-active', active === z.id);
      h.setAttribute('aria-pressed', active === z.id ? 'true' : 'false');
      h.querySelector('.gm-hot__dot').textContent = on ? n : '+';
      h.setAttribute('aria-label', (on ? `Зона ${n} в проекте — изменить: ` : 'Выбрать зону: ') + z.aria);
      polys[z.id].classList.toggle('is-selected', on); polys[z.id].classList.toggle('is-active', active === z.id);
      const c = chips.querySelector(`[data-zone="${z.id}"]`);
      c.classList.toggle('is-selected', on); c.classList.toggle('is-active', active === z.id);
      c.querySelector('.gm-chip__n').textContent = on ? n : '+';
      c.setAttribute('aria-pressed', active === z.id ? 'true' : 'false');
    }
    scene?.setSelectedZones(sel);
    const count = sel.length;
    status.hidden = !count;
    if (count) status.innerHTML = `<span>В проекте ${count} ${plural(count, 'зона', 'зоны', 'зон')}</span><a href="#project" data-gm-to-project>Посмотреть мой проект <i aria-hidden="true">↓</i></a>`;
  }
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };

  function renderSummary() {
    const p = store.getProject(), sel = p.selectedZones;
    summary.hidden = !sel.length;
    if (!sel.length) { leadSec.hidden = true; return; }
    list.innerHTML = sel.map((s, i) => {
      const z = zoneById(s.zoneId), r = s.recommendedSolution, n = String(i + 1).padStart(2, '0');
      return `<li class="gm-item" data-zone="${z.id}">
  <span class="gm-item__n">${n}</span>
  <div class="gm-item__body">
    <p class="gm-item__zone">${esc(z.name)}</p>
    <h3>${esc(r.title)}</h3>
    ${r.shortDescription ? `<p class="gm-item__desc">${esc(r.shortDescription)}</p>` : ''}
    <p class="gm-item__check"><span>Проверить:</span> ${esc(r.engineerCheck.map(c => c.replace(/\.$/, '')).join('; ').toLowerCase())}.</p>
    <p class="gm-item__answers">${s.answersText.map(esc).join(' · ')}</p>
    <div class="gm-item__acts"><button type="button" data-gm-edit="${z.id}">Изменить</button><button type="button" data-gm-remove="${z.id}">Убрать</button></div>
  </div>
</li>`;
    }).join('');
    mini.querySelectorAll('.gm-mini__mark').forEach(m => m.remove());
    sel.forEach((s, i) => {
      const a = FALLBACK.anchors[s.zoneId], m = document.createElement('span');
      m.className = 'gm-mini__mark'; m.dataset.zone = s.zoneId; m.textContent = String(i + 1).padStart(2, '0');
      m.style.left = a.x * 100 + '%'; m.style.top = a.y * 100 + '%';
      mini.appendChild(m);
    });
    mini.querySelectorAll('polygon').forEach(pl => pl.classList.toggle('is-selected', sel.some(s => s.zoneId === pl.dataset.zone)));
    const stageIn = lead.querySelector?.('[name=stage]');
    if (stageIn && p.objectStage && !stageIn.value) lead.setStage?.(p.objectStage);
    lead.setPayload?.(payloadProject(), projectText());
  }

  // Подсветка зоны в мини-схеме при наведении на пункт списка
  const miniPolys = {};
  ZONES.forEach(z => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    p.setAttribute('points', (FALLBACK.outlines[z.id] || []).map(([x, y]) => `${x},${y}`).join(' '));
    p.setAttribute('vector-effect', 'non-scaling-stroke'); p.dataset.zone = z.id;
    mini.querySelector('svg').appendChild(p); miniPolys[z.id] = p;
  });
  const hl = id => { Object.entries(miniPolys).forEach(([k, p]) => p.classList.toggle('is-active', k === id)); mini.querySelectorAll('.gm-mini__mark').forEach(m => m.classList.toggle('is-active', m.dataset.zone === id)); };
  list.addEventListener('pointerover', e => hl(e.target.closest('.gm-item')?.dataset.zone || null));
  list.addEventListener('pointerleave', () => hl(null));
  list.addEventListener('focusin', e => hl(e.target.closest('.gm-item')?.dataset.zone || null));
  list.addEventListener('click', e => {
    const ed = e.target.closest('[data-gm-edit]'), rm = e.target.closest('[data-gm-remove]');
    if (ed) { root.querySelector('#map').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }); openZone(ed.dataset.gmEdit, ed, 'edit'); }
    if (rm) {
      const id = rm.dataset.gmRemove;
      store.removeZone(id);
      track('zone_removed', { zoneId: id, selectedZonesCount: store.getProject().selectedZones.length });
      (list.querySelector('button') || $('[data-gm-add-more]'))?.focus();
    }
  });

  store.subscribe(() => { renderMarks(); renderSummary(); });
  renderMarks(); renderSummary();

  // ---------- панель сценария зоны ----------
  function openZone(id, from, source) {
    const z = zoneById(id); if (!z) return;
    startOnce(source);
    track('hotspot_clicked', { zoneId: id, source });
    opener = from || hots[id];
    active = id;
    const prev = store.getSelection(id);
    draft = prev ? { ...prev.answers } : {};
    if (id === 'entry' && !draft.stage && store.getProject().objectStage) draft.stage = store.getProject().objectStage;
    step = 0;
    intro.hidden = mqDesk.matches; panel.hidden = false;
    root.classList.add('gm-open');
    if (!mqDesk.matches) { backdrop.hidden = false; document.documentElement.classList.add('gm-lock'); }
    renderPanel(true);
    renderMarks();
    scene?.focusZone(id);
    ensure3D('interaction');
  }

  function closePanel(focusBack = true) {
    const was = active;
    active = null; panel.hidden = true; intro.hidden = false; backdrop.hidden = true;
    root.classList.remove('gm-open'); document.documentElement.classList.remove('gm-lock');
    renderMarks();
    scene?.reset();
    if (focusBack) {
      const back = opener && document.contains(opener) && opener.offsetParent ? opener : (hots[was]?.hidden ? chips.querySelector(`[data-zone="${was}"]`) : hots[was]);
      back?.focus({ preventScroll: !mqDesk.matches ? false : true });
    }
  }

  function renderPanel(focusTitle) {
    const z = zoneById(active), qs = z.q, sel = store.getSelection(active);
    const n = numOf(active) || String(store.getProject().selectedZones.length + 1).padStart(2, '0');
    if (step < qs.length) {
      const q = qs[step], v = draft[q.id], last = step === qs.length - 1;
      panelBody.innerHTML = `
<div class="gm-panel__head"><span class="gm-panel__n">${n}</span><p class="gm-panel__zone">${esc(z.name)}</p><button type="button" class="gm-panel__x" data-gm-close aria-label="Закрыть и вернуться к карте">×</button></div>
<p class="gm-panel__step">Вопрос ${step + 1} из ${qs.length}</p>
<h2 class="gm-panel__q" id="gm-q" tabindex="-1">${esc(q.title)}</h2>
<div class="gm-opts" role="radiogroup" aria-labelledby="gm-q">
${q.options.map(o => `<button type="button" role="radio" class="gm-opt${o.v === v ? ' is-on' : ''}" aria-checked="${o.v === v}" data-v="${o.v}"><b>${esc(o.t)}</b>${o.d ? `<span>${esc(o.d)}</span>` : ''}</button>`).join('')}
</div>
<div class="gm-panel__acts">
  <button type="button" class="ui-btn" data-gm-back><span aria-hidden="true">←</span> ${step ? 'Назад' : 'Назад к карте'}</button>
  <button type="button" class="ui-btn ui-btn--dark" data-gm-next ${v ? '' : 'disabled'}>${last ? (sel ? 'Сохранить изменения' : 'Добавить в проект') : 'Продолжить'} <span aria-hidden="true">${last ? '+' : '→'}</span></button>
</div>`;
      const opts = $$('.gm-opt', panelBody);
      opts.forEach((b, i) => {
        b.tabIndex = (v ? b.dataset.v === v : i === 0) ? 0 : -1;
        b.addEventListener('click', () => {
          draft[q.id] = b.dataset.v;
          opts.forEach(o => { const on = o === b; o.classList.toggle('is-on', on); o.setAttribute('aria-checked', on); o.tabIndex = on ? 0 : -1; });
          $('[data-gm-next]', panelBody).disabled = false;
        });
        b.addEventListener('keydown', e => {
          const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
          if (!k) return;
          e.preventDefault();
          const t = opts[(i + k + opts.length) % opts.length]; t.focus(); t.click();
        });
      });
      $('[data-gm-back]', panelBody).addEventListener('click', () => { if (step) { step--; renderPanel(true); } else closePanel(); });
      $('[data-gm-next]', panelBody).addEventListener('click', () => {
        if (!draft[q.id]) return;
        if (!last) { step++; renderPanel(true); return; }
        const isNew = !sel;
        const s = store.upsertZone(active, draft);
        track('zone_story_completed', { zoneId: active });
        if (isNew) track('zone_selected', { zoneId: active, selectedZonesCount: store.getProject().selectedZones.length });
        track('recommendation_shown', { zoneId: active, recommendationCode: s.recommendedSolution.code || '' });
        step = qs.length; renderPanel(true);
      });
    } else {
      const r = store.getSelection(active).recommendedSolution;
      panelBody.innerHTML = `
<div class="gm-panel__head"><span class="gm-panel__n">${n}</span><p class="gm-panel__zone">${esc(z.name)}</p><button type="button" class="gm-panel__x" data-gm-close aria-label="Закрыть и вернуться к карте">×</button></div>
<p class="gm-panel__step">Зона добавлена в проект</p>
<h2 class="gm-panel__q" tabindex="-1">${esc(r.title)}</h2>
${r.shortDescription ? `<p class="gm-panel__lead">${esc(r.shortDescription)}</p>` : ''}
<div class="gm-panel__checks"><p>Инженер проверит</p><ul>${r.engineerCheck.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
<p class="gm-panel__note">Вы можете вернуться к дому и выбрать следующую часть фасада или перейти к предварительной карте остекления.</p>
<div class="gm-panel__acts gm-panel__acts--stack">
  <button type="button" class="ui-btn ui-btn--dark" data-gm-project>Посмотреть мой проект <span aria-hidden="true">↓</span></button>
  <button type="button" class="ui-btn" data-gm-more>Добавить ещё одну зону <span aria-hidden="true">+</span></button>
  <button type="button" class="ui-btn" data-gm-back>Вернуться к карте <span aria-hidden="true">←</span></button>
</div>`;
      $('[data-gm-back]', panelBody).addEventListener('click', () => closePanel());
      $('[data-gm-more]', panelBody).addEventListener('click', () => {
        closePanel(false);
        const next = ZONES.find(zz => !store.getSelection(zz.id));
        const t = next ? (mqDesk.matches ? hots[next.id] : chips.querySelector(`[data-zone="${next.id}"]`)) : chips.querySelector('.gm-chip');
        t?.focus();
      });
      $('[data-gm-project]', panelBody).addEventListener('click', () => { closePanel(false); goProject(); });
    }
    $('[data-gm-close]', panelBody)?.addEventListener('click', () => closePanel());
    if (focusTitle) requestAnimationFrame(() => $('.gm-panel__q', panelBody)?.focus({ preventScroll: mqDesk.matches }));
  }

  panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closePanel(); } });
  backdrop.addEventListener('click', () => closePanel());
  // фокус не уходит из шторки на телефоне
  panel.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || mqDesk.matches) return;
    const f = $$('button:not([disabled]), [href], [tabindex="0"]', panel).filter(el => el.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  mqDesk.addEventListener('change', () => { if (active) { intro.hidden = mqDesk.matches; backdrop.hidden = mqDesk.matches; document.documentElement.classList.toggle('gm-lock', !mqDesk.matches); } });

  // ---------- старт, итог, форма ----------
  function startOnce(source) {
    if (started) return;
    started = true;
    track('glazing_map_started', { source });
  }
  $('[data-gm-start]').addEventListener('click', () => {
    startOnce('cta');
    ensure3D('interaction');
    const target = mqDesk.matches ? hots.portal : chips;
    root.querySelector('#map').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: mqDesk.matches ? 'start' : 'center' });
    stage.classList.add('is-hinting'); setTimeout(() => stage.classList.remove('is-hinting'), 2400);
    (mqDesk.matches ? target : chips.querySelector('.gm-chip'))?.focus({ preventScroll: true });
  });
  root.addEventListener('click', e => { if (e.target.closest('[data-gm-to-project]')) { e.preventDefault(); goProject(); } });

  let completedSent = false;
  function goProject() {
    if (!store.getProject().selectedZones.length) return;
    summary.hidden = false;
    summary.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    $('#gm-summary-title').focus({ preventScroll: true });
    if (!completedSent) { completedSent = true; track('project_map_completed', { selectedZonesCount: store.getProject().selectedZones.length }); }
  }
  $('[data-gm-add-more]').addEventListener('click', () => {
    root.querySelector('#map').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    const next = ZONES.find(z => !store.getSelection(z.id));
    const t = next ? (mqDesk.matches ? hots[next.id] : chips.querySelector(`[data-zone="${next.id}"]`)) : chips.querySelector('.gm-chip');
    t?.focus({ preventScroll: true });
  });
  $('[data-gm-save]').addEventListener('click', () => {
    say(store.persist() ? 'Проект сохранён в этом браузере — при следующем визите карта откроется с вашими зонами.' : 'Браузер не дал сохранить проект (приватный режим). Отправьте его инженеру — он сохранится в заявке.');
  });
  $('[data-gm-engineer]').addEventListener('click', () => {
    leadSec.hidden = false; done.hidden = true; $('[data-gm-lead-form]').hidden = false;
    lead.setPayload?.(payloadProject(), projectText());
    const st = store.getProject().objectStage; if (st) lead.setStage?.(st);
    leadSec.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    $('#gm-lead-title').focus({ preventScroll: true });
    track('lead_form_opened', { selectedZonesCount: store.getProject().selectedZones.length });
  });
  lead.addEventListener('change', e => { if (e.target.matches('input[type=file]') && e.target.files[0]) track('file_attached', { selectedZonesCount: store.getProject().selectedZones.length }); });
  lead.addEventListener('lead-form:stage', e => store.setStage(e.detail));
  lead.addEventListener('lead-form:sent', () => {
    track('engineering_lead_submitted', { selectedZonesCount: store.getProject().selectedZones.length, splineAvailable: scene?.kind === 'spline' });
    $('[data-gm-lead-form]').hidden = true; done.hidden = false;
    $('#gm-done-title').focus();
  });

  function payloadProject() { return JSON.parse(JSON.stringify(store.getProject())); }
  function projectText() {
    return store.getProject().selectedZones.map((s, i) => {
      const z = zoneById(s.zoneId), r = s.recommendedSolution;
      return `${String(i + 1).padStart(2, '0')}. ${z.name} — ${r.title}\n   ${s.answersText.join('; ')}`;
    }).join('\n');
  }

  let toastTimer = 0;
  function say(text) {
    toast.textContent = text; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 5000);
  }

  // ---------- 3D: отложенная загрузка ----------
  let loading = null;
  function can3D() {
    if (reduced()) return 'reduced-motion';
    const c = navigator.connection;
    if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return 'slow-network';
    try { const t = document.createElement('canvas'); if (!(t.getContext('webgl2') || t.getContext('webgl'))) return 'no-webgl'; } catch (e) { return 'no-webgl'; }
    return '';
  }
  function ensure3D(why) {
    if (loading || scene) return;
    const no = can3D();
    if (no) { loading = Promise.resolve(); track('spline_fallback_used', { reason: no, fallback: 'static', splineAvailable: false }); return; }
    loading = (async () => {
      const host = $('[data-gm-canvas]');
      if (cfg.splineScene) {
        try {
          const { createSplineScene } = await import('./spline.js');
          scene = await createSplineScene(host, { sceneUrl: cfg.splineScene, runtimeUrl: new URL(cfg.splineRuntime, document.baseURI).href, onZoneClick: id => openZone(id, hots[id], 'spline') });
          track('spline_loaded', { splineAvailable: true });
        } catch (e) {
          host.innerHTML = '';
          track('spline_fallback_used', { reason: 'spline-error', fallback: 'three', splineAvailable: false });
        }
      } else track('spline_fallback_used', { reason: 'not-configured', fallback: 'three', splineAvailable: false });
      if (!scene) {
        try {
          const { createScene } = await import('./scene3d.js');
          scene = createScene(host, { reducedMotion: reduced(), onFrame: s => { if (s.anchors) placeHots(s.anchors()); } });
        } catch (e) {
          host.innerHTML = ''; scene = null;
          track('spline_fallback_used', { reason: 'webgl-error', fallback: 'static', splineAvailable: false });
          return;
        }
      }
      scene.setReducedMotion(reduced());
      scene.setSelectedZones(store.getProject().selectedZones.map(s => s.zoneId));
      if (active) scene.focusZone(active);
      stage.classList.add('is-3d');
      if (scene.anchors) { stage.classList.add('is-3d-anchors'); placeHots(scene.anchors()); }
    })();
  }
  mqReduced.addEventListener('change', () => scene?.setReducedMotion(reduced()));
  // компьютер: 3D, когда карта в кадре и страница загрузилась; телефон — после первого действия
  if (matchMedia('(min-width: 900px) and (hover: hover)').matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      const go = () => ensure3D('viewport');
      document.readyState === 'complete' ? (window.requestIdleCallback || setTimeout)(go) : addEventListener('load', () => (window.requestIdleCallback || setTimeout)(go), { once: true });
    }, { rootMargin: '100px' });
    io.observe(stage);
  }

  // Появление блоков при прокрутке — мягко, без захвата прокрутки
  if (!reduced() && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    $$('[data-gm-reveal]', document).forEach(el => { el.classList.add('gm-reveal'); io.observe(el); });
  }

  track('glazing_map_viewed', { selectedZonesCount: store.getProject().selectedZones.length });
  // Сохранённый проект: сразу показываем итог
  if (store.getProject().selectedZones.length) started = true;
}

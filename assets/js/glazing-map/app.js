/* «Персональная карта остекления» (/osteklenie-pod-klyuch/): полноэкранный первый экран — дом и есть интерфейс.
   Сценарий: общий вид → номер на фасаде (01–06) → камера летит к зоне, остальное уходит в тень → компактная панель с одним вопросом
   → ответ меняет саму 3D-сцену (setAnswers) → «Добавить в проект» → камера возвращается, на фасаде остаётся рамка и номер
   → следующая зона → ниже по странице итог «Ваш проект остекления» и форма инженеру.
   Сцена: сначала полноэкранный постер (горизонтальный / вертикальный) с HTML-метками, 3D подгружается лениво:
   на компьютере после загрузки страницы, на телефоне — после первого нажатия. Spline — если настроен (spline.js), иначе three.js.
   reduced-motion, нет WebGL или медленная сеть — остаёмся на постере, весь сценарий работает.
   ?debug=1 — панель отладки: объекты сцены, камера, активная зона, ответы. */
import { ZONES, zoneById, sceneCaption, recommend } from './data.js';
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
  const smooth = () => (reduced() ? 'auto' : 'smooth');
  const debug = new URLSearchParams(location.search).has('debug');

  const hero = $('[data-gm-hero]'), stage = $('[data-gm-stage]'), hotLayer = $('[data-gm-hots]'), svg = $('[data-gm-outlines]');
  const intro = $('[data-gm-intro]'), panel = $('[data-gm-panel]'), panelBody = $('[data-gm-panel-body]'), status = $('[data-gm-status]');
  const summary = $('[data-gm-summary]'), list = $('[data-gm-list]'), mini = $('[data-gm-mini]');
  const leadSec = $('[data-gm-lead]'), lead = $('lead-form', leadSec), done = $('[data-gm-done]');
  const toast = $('[data-gm-toast]'), dbg = $('[data-gm-debug]');

  let scene = null, started = false, active = null, draft = {}, step = 0, opener = null;

  // ---------- метки на фасаде: номер в тонком круге, подпись — только при наведении / фокусе ----------
  const hots = {}, polys = {};
  ZONES.forEach(z => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'gm-hot'; b.dataset.zone = z.id;
    b.innerHTML = `<span class="gm-hot__dot" aria-hidden="true">${z.num}</span><span class="gm-hot__label" aria-hidden="true">${esc(z.name)}</span><span class="gm-hot__tip" aria-hidden="true"><b>${esc(z.name)}</b>${esc(z.hint)}</span>`;
    b.addEventListener('click', () => active === z.id ? null : openZone(z.id, b, 'hotspot'));
    // наведение подсвечивает зону в сцене песочным
    b.addEventListener('pointerenter', () => scene?.setHover?.(z.id));
    b.addEventListener('pointerleave', () => scene?.setHover?.(null));
    b.addEventListener('focus', () => scene?.setHover?.(z.id));
    b.addEventListener('blur', () => scene?.setHover?.(null));
    hotLayer.appendChild(b); hots[z.id] = b;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(p); polys[z.id] = p;
  });
  $$('[data-gm-open]', document).forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    hero.scrollIntoView({ behavior: smooth() });
    openZone(a.dataset.gmOpen, a, 'link');
  }));

  // Постер: вертикальный на узком экране, горизонтальный — на остальных; кадрирование как object-fit: cover
  const posterMode = () => (stage.clientWidth / Math.max(1, stage.clientHeight) < 1.15 ? 'port' : 'land');
  function posterBox() {
    const f = FALLBACK[posterMode()], W = stage.clientWidth, H = stage.clientHeight, s = Math.max(W / f.width, H / f.height);
    return { f, s, ox: (W - f.width * s) / 2, oy: (H - f.height * s) / 2 };
  }
  function drawOutlines() {
    const { f } = posterBox();
    svg.setAttribute('viewBox', `0 0 ${f.width} ${f.height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    for (const z of ZONES) polys[z.id].setAttribute('points', (f.outlines[z.id] || []).map(([x, y]) => `${(x * f.width).toFixed(1)},${(y * f.height).toFixed(1)}`).join(' '));
  }
  function placeHots(anchors) {
    const W = stage.clientWidth, H = stage.clientHeight, pb = anchors ? null : posterBox();
    for (const z of ZONES) {
      let x, y, vis = true;
      if (anchors) { const a = anchors[z.id]; x = a.x * W; y = a.y * H; vis = a.visible; }
      else { const a = pb.f.anchors[z.id]; x = pb.ox + a.x * pb.f.width * pb.s; y = pb.oy + a.y * pb.f.height * pb.s; vis = x > 16 && x < W - 16; }
      const h = hots[z.id];
      h.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      h.hidden = !vis || (active && active !== z.id && !mqDesk.matches);
    }
  }
  const relayout = () => { drawOutlines(); if (!scene?.anchors) placeHots(null); };
  new ResizeObserver(relayout).observe(stage);
  relayout();

  // ---------- состояние → метки, счётчик, итог ----------
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
  function renderMarks() {
    const sel = store.getProject().selectedZones;
    for (const z of ZONES) {
      const on = sel.some(s => s.zoneId === z.id), h = hots[z.id];
      h.classList.toggle('is-selected', on); h.classList.toggle('is-active', active === z.id); h.classList.toggle('is-dim', !!active && active !== z.id);
      h.setAttribute('aria-pressed', active === z.id ? 'true' : 'false');
      h.setAttribute('aria-label', `${z.num} — ${on ? 'в проекте, изменить' : 'выбрать зону'}: ${z.aria}`);
      polys[z.id].classList.toggle('is-selected', on); polys[z.id].classList.toggle('is-active', active === z.id);
    }
    scene?.setSelectedZones(sel.map(s => s.zoneId));
    const n = sel.length;
    status.innerHTML = `<span class="gm-count__n">В проекте: ${String(n).padStart(2, '0')} ${plural(n, 'зона', 'зоны', 'зон')}</span>`
      + (n ? `<span class="gm-count__list">${sel.map(s => { const z = zoneById(s.zoneId); return `<span><b>${z.num}</b> ${esc(z.name)}</span>`; }).join('')}</span><a href="#project" data-gm-to-project>Мой проект <i aria-hidden="true">↓</i></a>` : '');
    $('[data-gm-hint]').textContent = n ? 'Выберите следующую часть дома — или посмотрите проект целиком.' : 'Выберите зону, с которой хотите начать: нажмите на номер на фасаде.';
  }

  function renderSummary() {
    const p = store.getProject(), sel = p.selectedZones;
    summary.hidden = !sel.length;
    if (!sel.length) { leadSec.hidden = true; return; }
    list.innerHTML = sel.map(s => {
      const z = zoneById(s.zoneId), r = s.recommendedSolution;
      return `<li class="gm-item" data-zone="${z.id}">
  <span class="gm-item__n">${z.num}</span>
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
    sel.forEach(s => {
      const a = FALLBACK.land.anchors[s.zoneId], z = zoneById(s.zoneId), m = document.createElement('span');
      m.className = 'gm-mini__mark'; m.dataset.zone = s.zoneId; m.textContent = z.num;
      m.style.left = a.x * 100 + '%'; m.style.top = a.y * 100 + '%';
      mini.appendChild(m);
    });
    Object.entries(miniPolys).forEach(([k, pl]) => pl.classList.toggle('is-selected', sel.some(s => s.zoneId === k)));
    lead.setPayload?.(payloadProject(), projectText());
  }

  // Мини-схема в итоге: горизонтальный постер, контуры выбранных зон, подсветка при наведении на пункт списка
  const miniPolys = {};
  { const f = FALLBACK.land, s = mini.querySelector('svg'); s.setAttribute('viewBox', `0 0 ${f.width} ${f.height}`);
    ZONES.forEach(z => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      p.setAttribute('points', (f.outlines[z.id] || []).map(([x, y]) => `${x * f.width},${y * f.height}`).join(' '));
      p.setAttribute('vector-effect', 'non-scaling-stroke'); s.appendChild(p); miniPolys[z.id] = p;
    }); }
  const hl = id => { Object.entries(miniPolys).forEach(([k, p]) => p.classList.toggle('is-active', k === id)); mini.querySelectorAll('.gm-mini__mark').forEach(m => m.classList.toggle('is-active', m.dataset.zone === id)); };
  list.addEventListener('pointerover', e => hl(e.target.closest('.gm-item')?.dataset.zone || null));
  list.addEventListener('pointerleave', () => hl(null));
  list.addEventListener('focusin', e => hl(e.target.closest('.gm-item')?.dataset.zone || null));
  list.addEventListener('click', e => {
    const ed = e.target.closest('[data-gm-edit]'), rm = e.target.closest('[data-gm-remove]');
    if (ed) { hero.scrollIntoView({ behavior: smooth() }); openZone(ed.dataset.gmEdit, ed, 'edit'); }
    if (rm) {
      const id = rm.dataset.gmRemove;
      store.removeZone(id); scene?.setAnswers(id, {}, true);
      track('zone_removed', { zoneId: id, selectedZonesCount: store.getProject().selectedZones.length });
      (list.querySelector('button') || $('[data-gm-add-more]'))?.focus();
    }
  });
  store.subscribe(() => { renderMarks(); renderSummary(); });

  // ---------- панель сценария: один вопрос, ответ меняет сцену ----------
  function insets() {
    if (!active) return scene?.setInset(0, 0);
    if (mqDesk.matches) scene?.setInset(panel.offsetWidth + 40, 0);
    else scene?.setInset(0, Math.min(panel.offsetHeight, stage.clientHeight * 0.62));
  }
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
    hero.classList.add('is-focus');
    panel.hidden = false;
    renderPanel(true);
    renderMarks(); placeHots(scene?.anchors ? scene.anchors() : null);
    ensure3D();
    scene?.focusZone(id);
    scene?.setAnswers(id, draft);
    requestAnimationFrame(insets);
  }
  function closePanel(focusBack = true) {
    const was = active;
    active = null; panel.hidden = true; hero.classList.remove('is-focus');
    scene?.setInset(0, 0); scene?.reset();
    renderMarks(); placeHots(scene?.anchors ? scene.anchors() : null);
    if (focusBack) (opener && document.contains(opener) && opener.offsetParent ? opener : hots[was])?.focus({ preventScroll: true });
  }

  function renderPanel(focusTitle) {
    const z = zoneById(active), qs = z.q, sel = store.getSelection(active), q = qs[step], v = draft[q.id], last = step === qs.length - 1;
    const answered = qs.every(qq => draft[qq.id]);
    panelBody.innerHTML = `
<div class="gm-panel__head"><span class="gm-panel__n">${z.num}</span><p class="gm-panel__zone">${esc(z.name)}</p><button type="button" class="gm-panel__x" data-gm-close aria-label="Вернуться к дому">×</button></div>
<p class="gm-panel__step">${qs.length > 1 ? `Вопрос ${step + 1} из ${qs.length}` : 'Один вопрос'}</p>
<h2 class="gm-panel__q" id="gm-q" tabindex="-1">${esc(q.title)}</h2>
<div class="gm-opts" role="radiogroup" aria-labelledby="gm-q">
${q.options.map(o => `<button type="button" role="radio" class="gm-opt${o.v === v ? ' is-on' : ''}" aria-checked="${o.v === v}" data-v="${o.v}"><b>${esc(o.t)}</b>${o.d ? `<span>${esc(o.d)}</span>` : ''}</button>`).join('')}
</div>
<p class="gm-panel__caption" data-gm-caption aria-live="polite"></p>
<div class="gm-panel__acts">
  ${last
    ? `<button type="button" class="ui-btn ui-btn--dark" data-gm-add ${answered ? '' : 'disabled'}>${sel ? 'Сохранить в проекте' : 'Добавить в проект'} <span aria-hidden="true">+</span></button>`
    : `<button type="button" class="ui-btn ui-btn--dark" data-gm-next ${v ? '' : 'disabled'}>Продолжить <span aria-hidden="true">→</span></button>`}
  <button type="button" class="ui-btn gm-btn-ghost" data-gm-back><span aria-hidden="true">←</span> ${step ? 'Назад' : 'К общей карте'}</button>
</div>`;
    const cap = $('[data-gm-caption]', panelBody);
    // под вариантами — что показывает сцена и предварительное решение (когда все ответы даны)
    const updateCaption = () => {
      if (!Object.keys(draft).length) { cap.hidden = true; return; }
      const done = qs.every(qq => draft[qq.id]);
      const title = done ? recommend(active, draft).title : '';
      cap.innerHTML = `${title ? `<b>${esc(title)} · предварительный сценарий</b>` : ''}${esc(sceneCaption(active, draft))}${done ? '. Размеры и узлы проверит инженер.' : ''}`;
      cap.hidden = false;
    };
    updateCaption();
    const opts = $$('.gm-opt', panelBody);
    opts.forEach((b, i) => {
      b.tabIndex = (v ? b.dataset.v === v : i === 0) ? 0 : -1;
      b.addEventListener('click', () => {
        draft[q.id] = b.dataset.v;
        opts.forEach(o => { const on = o === b; o.classList.toggle('is-on', on); o.setAttribute('aria-checked', on); o.tabIndex = on ? 0 : -1; });
        scene?.setAnswers(active, draft);
        updateCaption();
        const next = $('[data-gm-next], [data-gm-add]', panelBody);
        next.disabled = last ? !qs.every(qq => draft[qq.id]) : false;
      });
      b.addEventListener('keydown', e => {
        const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!k) return;
        e.preventDefault();
        const t = opts[(i + k + opts.length) % opts.length]; t.focus(); t.click();
      });
    });
    $('[data-gm-back]', panelBody).addEventListener('click', () => { if (step) { step--; renderPanel(true); } else closePanel(); });
    $('[data-gm-next]', panelBody)?.addEventListener('click', () => { if (draft[q.id]) { step++; renderPanel(true); } });
    $('[data-gm-add]', panelBody)?.addEventListener('click', () => {
      const isNew = !sel, id = active;
      const s = store.upsertZone(id, draft);
      scene?.setAnswers(id, draft, true);
      track('zone_story_completed', { zoneId: id });
      if (isNew) track('zone_selected', { zoneId: id, selectedZonesCount: store.getProject().selectedZones.length });
      track('recommendation_shown', { zoneId: id, recommendationCode: s.recommendedSolution.code || '' });
      closePanel();
      say(`${z.num} ${z.name} — в проекте. Предварительно: ${s.recommendedSolution.title.toLowerCase()}.`);
    });
    $('[data-gm-close]', panelBody).addEventListener('click', () => closePanel());
    if (focusTitle) requestAnimationFrame(() => { $('.gm-panel__q', panelBody)?.focus({ preventScroll: true }); insets(); });
  }
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closePanel(); } });
  mqDesk.addEventListener('change', () => { insets(); placeHots(scene?.anchors ? scene.anchors() : null); });

  // ---------- старт, итог, форма ----------
  function startOnce(source) { if (!started) { started = true; track('glazing_map_started', { source }); } }
  $('[data-gm-start]').addEventListener('click', e => {
    const next = ZONES.find(z => !store.getSelection(z.id)) || ZONES[0];
    openZone(next.id, e.currentTarget, 'cta');
  });
  root.addEventListener('click', e => { if (e.target.closest('[data-gm-to-project]')) { e.preventDefault(); goProject(); } });
  $('[data-gm-scroll]').addEventListener('click', e => {
    e.preventDefault();
    (store.getProject().selectedZones.length ? summary : document.getElementById('after-map')).scrollIntoView({ behavior: smooth() });
  });

  let completedSent = false;
  function goProject() {
    if (!store.getProject().selectedZones.length) return;
    if (active) closePanel(false);
    summary.hidden = false;
    summary.scrollIntoView({ behavior: smooth(), block: 'start' });
    $('#gm-summary-title').focus({ preventScroll: true });
    if (!completedSent) { completedSent = true; track('project_map_completed', { selectedZonesCount: store.getProject().selectedZones.length }); }
  }
  $('[data-gm-add-more]').addEventListener('click', () => {
    hero.scrollIntoView({ behavior: smooth() });
    const next = ZONES.find(z => !store.getSelection(z.id));
    (next ? hots[next.id] : hots.portal).focus({ preventScroll: true });
  });
  $('[data-gm-save]').addEventListener('click', () => {
    say(store.persist() ? 'Проект сохранён в этом браузере — при следующем визите карта откроется с вашими зонами.' : 'Браузер не дал сохранить проект (приватный режим). Отправьте его инженеру — он сохранится в заявке.');
  });
  $('[data-gm-engineer]').addEventListener('click', () => {
    leadSec.hidden = false; done.hidden = true; $('[data-gm-lead-form]').hidden = false;
    lead.setPayload?.(payloadProject(), projectText());
    const st = store.getProject().objectStage; if (st) lead.setStage?.(st);
    leadSec.scrollIntoView({ behavior: smooth(), block: 'start' });
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
    return store.getProject().selectedZones.map(s => {
      const z = zoneById(s.zoneId);
      return `${z.num}. ${z.name} — ${s.recommendedSolution.title}\n   ${s.answersText.join('; ')}`;
    }).join('\n');
  }
  let toastTimer = 0;
  function say(text) { toast.textContent = text; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 4800); }

  // ---------- 3D: лениво, без блокировки первого экрана ----------
  let loading = null;
  function can3D() {
    if (reduced()) return 'reduced-motion';
    const c = navigator.connection;
    if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return 'slow-network';
    try { const t = document.createElement('canvas'); if (!(t.getContext('webgl2') || t.getContext('webgl'))) return 'no-webgl'; } catch (e) { return 'no-webgl'; }
    return '';
  }
  function ensure3D() {
    if (loading || scene) return;
    const no = can3D();
    if (no) { loading = Promise.resolve(); track('spline_fallback_used', { reason: no, fallback: 'poster', splineAvailable: false }); return; }
    loading = (async () => {
      const host = $('[data-gm-canvas]');
      if (cfg.splineScene) {
        try {
          const { createSplineScene } = await import('./spline.js');
          scene = await createSplineScene(host, { sceneUrl: cfg.splineScene, runtimeUrl: new URL(cfg.splineRuntime, document.baseURI).href, onZoneClick: id => openZone(id, hots[id], 'spline') });
          track('spline_loaded', { splineAvailable: true });
        } catch (e) { host.innerHTML = ''; scene = null; track('spline_fallback_used', { reason: 'spline-error', fallback: 'three', splineAvailable: false }); }
      } else track('spline_fallback_used', { reason: 'not-configured', fallback: 'three', splineAvailable: false });
      if (!scene) {
        try {
          const { createScene } = await import('./scene3d.js');
          scene = createScene(host, { reducedMotion: reduced(), onFrame: s => { if (s.anchors) placeHots(s.anchors()); if (debug) showDebug(); } });
        } catch (e) { host.innerHTML = ''; scene = null; track('spline_fallback_used', { reason: 'webgl-error', fallback: 'poster', splineAvailable: false }); return; }
      }
      scene.setReducedMotion(reduced());
      for (const s of store.getProject().selectedZones) scene.setAnswers(s.zoneId, s.answers, true);
      scene.setSelectedZones(store.getProject().selectedZones.map(s => s.zoneId));
      if (active) { scene.focusZone(active); scene.setAnswers(active, draft); insets(); }
      stage.classList.add('is-3d');
      if (scene.anchors) { stage.classList.add('is-3d-anchors'); placeHots(scene.anchors()); }
      onScroll();
    })();
  }
  mqReduced.addEventListener('change', () => scene?.setReducedMotion(reduced()));
  // компьютер — после загрузки страницы (постер уже стоит); телефон — по первому нажатию на метку
  if (matchMedia('(min-width: 900px)').matches) {
    const go = () => (window.requestIdleCallback || setTimeout)(() => ensure3D(), { timeout: 1500 });
    document.readyState === 'complete' ? go() : addEventListener('load', go, { once: true });
  }
  // лёгкий отъезд камеры при прокрутке первого экрана
  let sp = 0;
  function onScroll() { if (sp) return; sp = requestAnimationFrame(() => { sp = 0; const r = hero.getBoundingClientRect(); scene?.setScroll?.(Math.min(1, Math.max(0, -r.top / r.height))); }); }
  addEventListener('scroll', onScroll, { passive: true });

  // Появление блоков ниже — мягкий сдвиг, текст виден всегда
  if (!reduced() && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    $$('[data-gm-reveal]', document).forEach(el => { el.classList.add('gm-reveal'); io.observe(el); });
  }

  // ---------- отладка ----------
  let dbgT = 0;
  function showDebug() {
    const now = performance.now(); if (now - dbgT < 250) return; dbgT = now;
    dbg.hidden = false;
    dbg.textContent = JSON.stringify({ active, step, draft, scene: scene?.debug ? scene.debug() : { renderer: scene ? scene.kind : 'poster' } }, null, 1);
  }
  if (debug) { showDebug(); setInterval(showDebug, 500); }

  renderMarks(); renderSummary();
  if (store.getProject().selectedZones.length) started = true;
  track('glazing_map_viewed', { selectedZonesCount: store.getProject().selectedZones.length });
}

/* Адаптер Spline-сцены с тем же интерфейсом, что у three.js-сцены (scene3d.js):
   focusZone(zoneId), reset(), setSelectedZones(ids), setReducedMotion(on).
   Включается, только если в data/site-config.json → glazing_map.spline_scene задан адрес .splinecode,
   а runtime Spline лежит локально (glazing_map.spline_runtime, по умолчанию assets/vendor/spline/runtime.js — CDN не подключаем).
   Каждый вызов безопасен: нет объекта или события в сцене — предупреждение в консоли на localhost, страница работает дальше. */

// Имена из ТЗ: состояния сцены, группы остекления и метки
export const SPLINE_NAMES = {
  portal: { state: 'STATE_PORTAL', group: 'PORTAL_LIVING_ROOM', hotspot: 'HOTSPOT_PORTAL', camera: 'CAMERA_TERRACE' },
  window: { state: 'STATE_WINDOWS', group: 'PANORAMIC_WINDOWS_UPPER', hotspot: 'HOTSPOT_WINDOWS', camera: 'CAMERA_UPPER_FACADE' },
  terrace: { state: 'STATE_TERRACE', group: 'TERRACE_GLAZING', hotspot: 'HOTSPOT_TERRACE', camera: 'CAMERA_TERRACE' },
  garden: { state: 'STATE_WINTER_GARDEN', group: 'WINTER_GARDEN', hotspot: 'HOTSPOT_WINTER_GARDEN', camera: 'CAMERA_WINTER_GARDEN' },
  entry: { state: 'STATE_ENTRANCE', group: 'ENTRANCE_GROUP', hotspot: 'HOTSPOT_ENTRANCE', camera: 'CAMERA_OVERVIEW' },
  second: { state: 'STATE_DOUBLE_HEIGHT', group: 'DOUBLE_HEIGHT_GLAZING', hotspot: 'HOTSPOT_DOUBLE_HEIGHT', camera: 'CAMERA_UPPER_FACADE' },
};
const dev = /^(localhost|127\.)/.test(location.hostname);
const warn = (...a) => { if (dev) console.warn('[spline]', ...a); };

/**
 * @param {HTMLElement} host
 * @param {{sceneUrl:string, runtimeUrl:string, timeout?:number, onZoneClick?:(id:string)=>void}} opts
 */
export async function createSplineScene(host, { sceneUrl, runtimeUrl, timeout = 12000, onZoneClick }) {
  if (!sceneUrl || !runtimeUrl) throw new Error('spline: not configured');
  const { Application } = await import(runtimeUrl);
  const canvas = document.createElement('canvas');
  canvas.className = 'gm-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const app = new Application(canvas);
  await Promise.race([app.load(sceneUrl), new Promise((_, no) => setTimeout(() => no(new Error('spline: timeout')), timeout))]);

  const vars = (() => { try { return app.getVariables?.() || {}; } catch (e) { return {}; } })();
  const emit = (event, name) => {
    try {
      if (!app.findObjectByName(name)) return warn('нет объекта', name);
      app.emitEvent(event, name);
    } catch (e) { warn(event, name, e.message); }
  };
  // Состояние сцены: через переменную mapState (если есть в сцене), иначе — событием на метке зоны
  const setState = (state, hotspot) => {
    if ('mapState' in vars) { try { app.setVariable('mapState', state); return; } catch (e) { warn('mapState', e.message); } }
    if (hotspot) emit('mouseDown', hotspot); else emit('mouseDown', 'HOUSE_ROOT');
  };
  // Клик по метке внутри сцены открывает сценарий зоны в HTML
  const byHotspot = Object.fromEntries(Object.entries(SPLINE_NAMES).map(([id, n]) => [n.hotspot, id]));
  try { app.addEventListener('mouseDown', e => { const id = byHotspot[e.target?.name]; if (id) onZoneClick?.(id); }); } catch (e) { warn('events', e.message); }

  return {
    kind: 'spline',
    canvas,
    focusZone(id) { const n = SPLINE_NAMES[id]; if (n) setState(n.state, n.hotspot); },
    reset() { setState('STATE_OVERVIEW'); emit('mouseDown', 'EVENT_RESET_MAP'); },
    setSelectedZones(ids) {
      for (const [id, n] of Object.entries(SPLINE_NAMES)) {
        try { const o = app.findObjectByName(n.group); if (o && 'selected' in vars) app.setVariable('selected_' + id, ids.includes(id)); } catch (e) { warn('selected', e.message); }
      }
    },
    setReducedMotion(on) { if ('reducedMotion' in vars) { try { app.setVariable('reducedMotion', !!on); } catch (e) { warn('reducedMotion', e.message); } } },
    anchors: null, // метки остаются в позициях статичной схемы: камера общего вида в Spline должна совпадать с ней
    destroy() { try { app.dispose?.(); } catch (e) { /* */ } canvas.remove(); },
  };
}

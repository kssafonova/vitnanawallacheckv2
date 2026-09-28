/* Аналитика карты: один адаптер track(), UI-компоненты не вызывают ym / gtag напрямую.
   События уходят в window.dataLayer (Яндекс Метрика в режиме электронной коммерции / GTM их подхватывают)
   и в ym(…, 'reachGoal') — если на странице есть счётчик и в конфиге задан metrika_id. */
let counter = 0;
export function setMetrika(id) { counter = Number(id) || 0; }

export const deviceType = () => innerWidth < 768 ? 'mobile' : innerWidth < 1100 ? 'tablet' : 'desktop';

export function track(name, params = {}) {
  const payload = { deviceType: deviceType(), ...params };
  try {
    (window.dataLayer = window.dataLayer || []).push({ event: 'glazing_map', action: name, ...payload });
    if (counter && typeof window.ym === 'function') window.ym(counter, 'reachGoal', name, payload);
  } catch (e) { /* аналитика не должна ломать страницу */ }
  if (/^(localhost|127\.)/.test(location.hostname) && window.PS_DEBUG) console.info('[track]', name, payload);
}

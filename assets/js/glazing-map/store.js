/* Состояние карты: выбранные зоны, стадия объекта. Автосохранение в localStorage (ключ ps-glazing-map),
   при обновлении страницы проект восстанавливается. Подписка — subscribe(fn). */
import { zoneById, recommend, selectionFields, answersText } from './data.js';

const KEY = 'ps-glazing-map';
const now = () => new Date().toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && Array.isArray(p.selectedZones)) {
      // пересчитываем рекомендации: правила могли обновиться с прошлого визита
      p.selectedZones = p.selectedZones.filter(s => zoneById(s.zoneId)).map(s => build(s.zoneId, s.answers || {}, s));
      return p;
    }
  } catch (e) { /* приватный режим или повреждённые данные — начинаем с чистого листа */ }
  return { id: uid(), selectedZones: [], createdAt: now(), updatedAt: now() };
}

function build(zoneId, answers, prev) {
  return {
    id: prev?.id || uid(), zoneId, answers: { ...answers }, answersText: answersText(zoneById(zoneId), answers),
    ...selectionFields(zoneId, answers), recommendedSolution: recommend(zoneId, answers), createdAt: prev?.createdAt || now(),
  };
}

let project = load();
const subs = new Set();

function commit(save = true) {
  project.updatedAt = now();
  if (save) persist();
  subs.forEach(fn => fn(project));
}

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(project)); return true; } catch (e) { return false; }
}
export const getProject = () => project;
export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
export const getSelection = zoneId => project.selectedZones.find(s => s.zoneId === zoneId);

/** Добавить или обновить зону (у зоны одна запись — повторный выбор заменяет ответы, номер сохраняется). */
export function upsertZone(zoneId, answers) {
  const i = project.selectedZones.findIndex(s => s.zoneId === zoneId);
  const sel = build(zoneId, answers, project.selectedZones[i]);
  if (i >= 0) project.selectedZones[i] = sel; else project.selectedZones.push(sel);
  if (answers.stage) project.objectStage = answers.stage;
  commit();
  return sel;
}
export function removeZone(zoneId) {
  project.selectedZones = project.selectedZones.filter(s => s.zoneId !== zoneId);
  commit();
}
export function setStage(stage) { project.objectStage = stage || undefined; commit(); }
export function resetProject() { project = { id: uid(), selectedZones: [], createdAt: now(), updatedAt: now() }; commit(); }

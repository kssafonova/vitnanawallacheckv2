export const APP_ROOT = new URL('../../', import.meta.url);
export const url = (path='') => new URL(path, APP_ROOT).href;

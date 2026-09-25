# PORTAL SYSTEMS — FS Portal Canvas Demo

Готовый автономный интерактивный блок складного FS-портала.

## Файлы

- `index.html` — демо-страница
- `styles.css` — стили блока
- `fs-portal.js` — Canvas-анимация

## Что умеет

- мобильная структура first;
- плавное открытие / закрытие;
- управление ползунком;
- прямое управление мышью или пальцем по Canvas;
- `prefers-reduced-motion`;
- без библиотек и внешних зависимостей;
- адаптивное Retina-отрисовывание.

## Как запустить

Просто откройте `index.html` в браузере.

Для сайта PORTAL SYSTEMS:
1. перенесите HTML секции `.fs-demo` в нужный PHP-шаблон;
2. подключите `styles.css`;
3. подключите `fs-portal.js` перед `</body>` или через общий footer.

Пример:

```html
<link rel="stylesheet" href="/assets/css/fs-portal.css">
<script src="/assets/js/fs-portal.js" defer></script>
```

## Настройка количества створок

В `fs-portal.js`:

```js
const PANEL_COUNT = 6;
```

Можно поставить 4, 5, 6 и т.д.

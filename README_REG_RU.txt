PORTAL SYSTEMS — пакет для REG.RU
================================

СТРУКТУРА
---------
index.html                         — главная страница
assets/css/site.css                — общие стили сайта + Systems
assets/css/calculator.css          — стили калькулятора
assets/js/site.js                  — меню, FAQ, общая логика, контактная форма
assets/js/calculator.js            — расчётный engine калькулятора
assets/js/calculator-dialog.js     — логика диалогов калькулятора
assets/js/calculator-mobile.js     — синхронизация mobile preview
assets/js/systems.js               — интерактив HS/FS Systems
assets/images/*                    — фотографии (вынесены из base64)
content/privacy-policy-portal-systems.pdf — действующая политика из библиотеки
forms/send.php                     — серверная отправка заявок
forms/config.php                   — email получателя/отправителя
.htaccess                          — настройки Apache/REG.RU
robots.txt / sitemap.xml           — базовая SEO-конфигурация

ЗАГРУЗКА НА REG.RU
------------------
1. Распакуйте ZIP локально.
2. Загрузите СОДЕРЖИМОЕ папки проекта в корень сайта (обычно public_html / www / htdocs — зависит от тарифа).
3. В корне рядом должны оказаться index.html, .htaccess, assets/, forms/, content/.
4. Убедитесь, что домен открывает index.html.
5. Проверьте PHP: откройте форму и отправьте тестовую заявку.
6. Заявки настроены на: 
   Если нужен другой адрес — меняется только forms/config.php.

ВАЖНО ПО ПОЧТЕ
---------------
forms/send.php использует стандартный PHP mail(). На большинстве PHP-тарифов REG.RU он доступен,
но конкретный тариф/почтовая конфигурация могут требовать настройки SMTP. Если письмо не приходит,
проверьте папку Спам и журнал/настройки PHP mail в панели REG.RU. Сам сайт при ошибке покажет сообщение
с номером телефона вместо потери заявки.

ПРОВЕРКА ПЕРЕД ПУБЛИКАЦИЕЙ
---------------------------
- Главная: /index.html
- Политика: /content/privacy-policy-portal-systems.pdf или /policy
- Форма внизу страницы
- Форма в шаге «Расчёт» калькулятора
- Mobile menu
- Systems: HS slider/drag, FS canvas
- Калькулятор: Проём → Опции → Расчёт

ИЗОБРАЖЕНИЯ
------------
- assets/images/hero/hero-house.webp (1704 KB) — Современный загородный дом с панорамным остеклением
- assets/images/systems/hs-overview.jpg (87 KB) — HS-портал PORTAL SYSTEMS
- assets/images/projects/house.webp (209 KB) — Комплексное панорамное остекление загородного дома
- assets/images/projects/interior.webp (206 KB) — Панорамное остекление в пол
- assets/images/projects/terrace.webp (148 KB) — HS-портал на террасу
- assets/images/company/production.webp (939 KB) — Производство алюминиевых конструкций PORTAL SYSTEMS

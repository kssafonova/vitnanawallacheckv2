/* <lead-form> — одна форма заявки для всего сайта: главная, HS, товар, контакты, калькулятор.
   Светлый DOM (стили .lead-form* в components.css), отправка в forms/send.php, файл проекта до 15 МБ.
   Минимальная: имя, телефон, кнопка; «+ Добавить размер или файл проекта» открывает комментарий и файл.
   el.setProject(text) — дописать в письмо параметры (так делает калькулятор).
   Атрибуты:
     data-base     путь до корня сайта ("../../")
     data-source   источник для письма (home, hs, contacts, SKU товара)
     data-theme    "dark" — для тёмного фона
     data-cta      текст кнопки (по умолчанию «Получить расчёт»)
     data-context  строка в письмо: откуда заявка (например, модель и цвет)
     data-comment  подсказка в поле «Проём / задача» */
(() => {
  const FILE_MAX = 15 * 1024 * 1024;
  const FILE_EXT = /\.(pdf|dwg|dxf|jpe?g|png|webp|heic|zip)$/i;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clip = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5 12.3 19.2a5 5 0 0 1-7.1-7.1l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/></svg>';
  let uid = 0;

  class LeadForm extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = '1';
      const d = this.dataset, base = d.base || '', id = 'lf' + (++uid);
      // Минимальная плоская форма (решение владельца): имя, телефон, кнопка; размер и файл — по ссылке «+ Добавить…»
      this.innerHTML = `
<form class="lead-form${d.theme === 'dark' ? ' lead-form--dark' : ''}" novalidate>
  <div class="lead-form__row">
    <label class="lead-form__field"><span>Имя</span><input name="name" autocomplete="name" maxlength="100" required placeholder="Как к вам обращаться"></label>
    <label class="lead-form__field"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="+7 999 000-00-00"></label>
  </div>
  <button class="lead-form__more" type="button" aria-expanded="false" aria-controls="${id}-extra">+ Добавить размер или файл проекта</button>
  <div class="lead-form__extra" id="${id}-extra" hidden>
    <label class="lead-form__field"><span>Проём / задача</span><textarea name="comment" rows="2" maxlength="3000" placeholder="${esc(d.comment || 'Например: 3600 × 2300 мм, выход из гостиной на террасу')}"></textarea></label>
    <label class="lead-form__file" data-lf-filebox>
      <input type="file" name="project_file" accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.webp,.heic,.zip" data-lf-file aria-describedby="${id}-fh">
      ${clip}<span><b data-lf-filename>Прикрепить проект, план или фото</b><small id="${id}-fh">PDF, DWG, JPG, PNG или ZIP · до 15 МБ</small></span>
    </label>
  </div>
  <input type="hidden" name="source" value="${esc(d.source || 'site')}">
  <input type="hidden" name="project" value="${d.context ? esc('Откуда: ' + d.context) : ''}" data-lf-project>
  <input class="lead-form__hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
  <button class="lead-form__submit" type="submit">${esc(d.cta || 'Получить расчёт')} <i aria-hidden="true">→</i></button>
  <p class="lead-form__legal">Замер — бесплатно. Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
  <p class="lead-form__status" data-lf-status role="status" aria-live="polite"></p>
</form>`;
      const more = this.querySelector('.lead-form__more'), extra = this.querySelector('.lead-form__extra');
      more.addEventListener('click', () => { extra.hidden = false; more.hidden = true; more.setAttribute('aria-expanded', 'true'); extra.querySelector('textarea').focus(); });
      // Калькулятор передаёт сюда параметры расчёта — они уходят в письмо полем project
      const project = this.querySelector('[data-lf-project]');
      this.setProject = text => { project.value = [d.context ? 'Откуда: ' + d.context : '', text].filter(Boolean).join('\n'); };
      const form = this.querySelector('form');
      const status = this.querySelector('[data-lf-status]');
      const fileIn = this.querySelector('[data-lf-file]'), fileName = this.querySelector('[data-lf-filename]'), box = this.querySelector('[data-lf-filebox]');
      const say = (text, cls) => { status.className = 'lead-form__status' + (cls ? ' is-' + cls : ''); status.innerHTML = text; };

      fileIn.addEventListener('change', () => {
        const f = fileIn.files[0];
        say('');
        box.classList.toggle('has-file', !!f);
        if (!f) { fileName.textContent = 'Прикрепить проект, план или фото'; return; }
        if (f.size > FILE_MAX || !FILE_EXT.test(f.name)) {
          fileIn.value = ''; box.classList.remove('has-file');
          fileName.textContent = 'Прикрепить проект, план или фото';
          say(f.size > FILE_MAX ? 'Файл больше 15 МБ — сожмите его или пришлите ссылку в комментарии.' : 'Этот формат не принимаем: подойдут PDF, DWG, JPG, PNG или ZIP.', 'error');
          return;
        }
        fileName.textContent = f.name;
      });

      form.addEventListener('submit', async e => {
        e.preventDefault();
        const nameIn = form.querySelector('[name=name]'), phoneIn = form.querySelector('[name=phone]');
        if (!nameIn.value.trim() || phoneIn.value.replace(/\D+/g, '').length < 10) {
          say('Укажите имя и телефон — без них инженер не сможет связаться.', 'error');
          (nameIn.value.trim() ? phoneIn : nameIn).focus();
          return;
        }
        const btn = form.querySelector('.lead-form__submit');
        btn.disabled = true;
        say('Отправляем…');
        try {
          const res = await fetch(base + 'forms/send.php', { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'XMLHttpRequest' } });
          const out = await res.json().catch(() => ({}));
          if (!res.ok || !out.ok) throw new Error(out.message || '');
          form.reset(); box.classList.remove('has-file'); fileName.textContent = 'Прикрепить проект, план или фото';
          say('Заявка отправлена. Инженер перезвонит в рабочее время и договорится о бесплатном замере.', 'ok');
        } catch (err) {
          say(`Не получилось отправить${err.message ? ': ' + esc(err.message) : ''}. Позвоните нам: <a href="tel:+79774102479">+7 977 410-24-79</a>`, 'error');
        } finally { btn.disabled = false; }
      });
    }
  }
  if (!customElements.get('lead-form')) customElements.define('lead-form', LeadForm);
})();

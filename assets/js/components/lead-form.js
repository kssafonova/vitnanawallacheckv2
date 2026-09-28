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
     data-comment  подсказка в поле «Проём / задача»
     data-mode     "engineering" — форма «Передайте проект инженеру» (карта остекления): телефон или WhatsApp,
                   удобный способ связи, город / район, стадия, файл (JPG, PNG, PDF), комментарий, согласие — обязательно.
                   el.setPayload(obj, text) — объект проекта уходит полем glazing_map (JSON), текст — в письмо;
                   el.setStage(v) — отметить стадию. События: lead-form:sent (успешная отправка), lead-form:stage. */
(() => {
  const FILE_MAX = 15 * 1024 * 1024;
  const FILE_EXT = /\.(pdf|dwg|dxf|jpe?g|png|webp|heic|zip)$/i;
  const FILE_EXT_ENG = /\.(pdf|jpe?g|png)$/i;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clip = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5 12.3 19.2a5 5 0 0 1-7.1-7.1l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/></svg>';
  let uid = 0;

  class LeadForm extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = '1';
      const d = this.dataset, base = d.base || '', id = 'lf' + (++uid);
      const eng = d.mode === 'engineering';
      const seg = (name, label, opts) => `<div class="lead-form__seg" role="group" aria-label="${label}"><span>${label}</span><div>${opts.map(([v, t]) =>
        `<button type="button" data-seg="${name}" data-v="${v}" aria-pressed="false">${t}</button>`).join('')}</div><input type="hidden" name="${name}"></div>`;
      const fileBox = `<label class="lead-form__file" data-lf-filebox>
      <input type="file" name="project_file" accept="${eng ? '.pdf,.jpg,.jpeg,.png' : '.pdf,.dwg,.dxf,.jpg,.jpeg,.png,.webp,.heic,.zip'}" data-lf-file aria-describedby="${id}-fh">
      ${clip}<span><b data-lf-filename>${eng ? 'План, фасад или фото объекта' : 'Прикрепить проект, план или фото'}</b><small id="${id}-fh">${eng ? 'JPG, PNG или PDF · до 15 МБ' : 'PDF, DWG, JPG, PNG или ZIP · до 15 МБ'}</small></span>
    </label>`;
      // Минимальная плоская форма (решение владельца): имя, телефон, кнопка; размер и файл — по ссылке «+ Добавить…»
      // Режим engineering (карта остекления): все поля сразу, согласие обязательно
      const fields = eng ? `
  <div class="lead-form__row">
    <label class="lead-form__field"><span>Имя</span><input name="name" autocomplete="name" maxlength="100" required placeholder="Как к вам обращаться"></label>
    <label class="lead-form__field"><span>Телефон или WhatsApp</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="+7 999 000-00-00"></label>
  </div>
  ${seg('contact_pref', 'Удобный способ связи', [['phone', 'Телефон'], ['whatsapp', 'WhatsApp'], ['telegram', 'Telegram']])}
  <label class="lead-form__field"><span>Город / район объекта</span><input name="city" maxlength="120" autocomplete="address-level2" placeholder="Например: Истра, Новорижское шоссе"></label>
  ${seg('stage', 'Стадия', [['project', 'Проект'], ['construction', 'Стройка'], ['ready', 'Готовый дом']])}
  ${fileBox}
  <label class="lead-form__field"><span>Комментарий</span><textarea name="comment" rows="2" maxlength="3000" placeholder="${esc(d.comment || 'Что важно учесть: сроки, размеры, пожелания')}"></textarea></label>
  <label class="lead-form__consent"><input type="checkbox" name="privacy_consent" value="1" required><i aria-hidden="true"></i><span>Согласен(на) на обработку персональных данных</span></label>
  <input type="hidden" name="glazing_map" data-lf-map>
  <input type="hidden" name="page_url" value="${esc(location.href.split('#')[0])}">
  <input type="hidden" name="referrer" value="${esc(document.referrer)}">
  <input type="hidden" name="utm" value="${esc(JSON.stringify(Object.fromEntries([...new URLSearchParams(location.search)].filter(([k]) => /^utm_/.test(k)))))}">` : `
  <div class="lead-form__row">
    <label class="lead-form__field"><span>Имя</span><input name="name" autocomplete="name" maxlength="100" required placeholder="Как к вам обращаться"></label>
    <label class="lead-form__field"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="+7 999 000-00-00"></label>
  </div>
  <button class="lead-form__more" type="button" aria-expanded="false" aria-controls="${id}-extra">+ Добавить размер или файл проекта</button>
  <div class="lead-form__extra" id="${id}-extra" hidden>
    <label class="lead-form__field"><span>Проём / задача</span><textarea name="comment" rows="2" maxlength="3000" placeholder="${esc(d.comment || 'Например: 3600 × 2300 мм, выход из гостиной на террасу')}"></textarea></label>
    ${fileBox}
  </div>`;
      this.innerHTML = `
<form class="lead-form${d.theme === 'dark' ? ' lead-form--dark' : ''}${eng ? ' lead-form--eng' : ''}" novalidate>${fields}
  <input type="hidden" name="source" value="${esc(d.source || 'site')}">
  <input type="hidden" name="project" value="${d.context ? esc('Откуда: ' + d.context) : ''}" data-lf-project>
  <input class="lead-form__hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
  <button class="lead-form__submit" type="submit">${esc(d.cta || 'Получить расчёт')} <i aria-hidden="true">→</i></button>
  <p class="lead-form__legal">${eng ? 'Инженер свяжется удобным способом. Замер — бесплатно.' : 'Замер — бесплатно. Нажимая кнопку, вы соглашаетесь на обработку персональных данных.'}</p>
  <p class="lead-form__status" data-lf-status role="status" aria-live="polite"></p>
</form>`;
      // Кнопки-переключатели (способ связи, стадия): выбранный — чёрная заливка
      const setSeg = (name, v, emit) => {
        const input = this.querySelector(`input[name="${name}"]`); if (!input) return;
        input.value = v || '';
        this.querySelectorAll(`[data-seg="${name}"]`).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v ? 'true' : 'false'));
        if (emit) this.dispatchEvent(new CustomEvent('lead-form:' + name.replace('contact_pref', 'contact'), { detail: v, bubbles: true }));
      };
      this.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => {
        const cur = this.querySelector(`input[name="${b.dataset.seg}"]`).value;
        setSeg(b.dataset.seg, cur === b.dataset.v ? '' : b.dataset.v, true);
      }));
      this.setStage = v => setSeg('stage', v, false);
      const mapIn = this.querySelector('[data-lf-map]');
      this.setPayload = (obj, text) => { if (mapIn) mapIn.value = JSON.stringify(obj); if (text != null) this.setProject(text); };
      const more = this.querySelector('.lead-form__more'), extra = this.querySelector('.lead-form__extra');
      more?.addEventListener('click', () => { extra.hidden = false; more.hidden = true; more.setAttribute('aria-expanded', 'true'); extra.querySelector('textarea').focus(); });
      // Калькулятор передаёт сюда параметры расчёта — они уходят в письмо полем project
      const project = this.querySelector('[data-lf-project]');
      this.setProject = text => { project.value = [d.context ? 'Откуда: ' + d.context : '', text].filter(Boolean).join('\n'); };
      const form = this.querySelector('form');
      const status = this.querySelector('[data-lf-status]');
      const fileIn = this.querySelector('[data-lf-file]'), fileName = this.querySelector('[data-lf-filename]'), box = this.querySelector('[data-lf-filebox]');
      const fileLabel = fileName.textContent;
      const say = (text, cls) => { status.className = 'lead-form__status' + (cls ? ' is-' + cls : ''); status.innerHTML = text; };

      fileIn.addEventListener('change', () => {
        const f = fileIn.files[0];
        say('');
        box.classList.toggle('has-file', !!f);
        if (!f) { fileName.textContent = fileLabel; return; }
        if (f.size > FILE_MAX || !(eng ? FILE_EXT_ENG : FILE_EXT).test(f.name)) {
          fileIn.value = ''; box.classList.remove('has-file');
          fileName.textContent = fileLabel;
          say(f.size > FILE_MAX ? 'Файл больше 15 МБ — сожмите его или пришлите ссылку в комментарии.' : `Этот формат не принимаем: подойдут ${eng ? 'JPG, PNG или PDF' : 'PDF, DWG, JPG, PNG или ZIP'}.`, 'error');
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
        const consent = form.querySelector('[name=privacy_consent]');
        if (consent && !consent.checked) { say('Подтвердите согласие на обработку персональных данных.', 'error'); consent.focus(); return; }
        const btn = form.querySelector('.lead-form__submit');
        btn.disabled = true;
        say('Отправляем…');
        try {
          const res = await fetch(base + 'forms/send.php', { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'XMLHttpRequest' } });
          const out = await res.json().catch(() => ({}));
          if (!res.ok || !out.ok) throw new Error(out.message || '');
          const keep = mapIn?.value, keepProject = project.value;
          form.reset(); box.classList.remove('has-file'); fileName.textContent = fileLabel;
          if (mapIn) { mapIn.value = keep; project.value = keepProject; }
          this.querySelectorAll('[data-seg]').forEach(b => b.setAttribute('aria-pressed', 'false'));
          say('Заявка отправлена. Инженер перезвонит в рабочее время и договорится о бесплатном замере.', 'ok');
          this.dispatchEvent(new CustomEvent('lead-form:sent', { detail: out, bubbles: true }));
        } catch (err) {
          say(`Не получилось отправить${err.message ? ': ' + esc(err.message) : ''}. Позвоните нам: <a href="tel:+79774102479">+7 977 410-24-79</a>`, 'error');
        } finally { btn.disabled = false; }
      });
    }
  }
  if (!customElements.get('lead-form')) customElements.define('lead-form', LeadForm);
})();

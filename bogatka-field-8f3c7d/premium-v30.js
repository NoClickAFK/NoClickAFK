let premiumEnhanceTimer = null;

function premiumEyeIcon(hidden) {
  return hidden
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"/><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a17.7 17.7 0 0 1-2.1 3.2"/><path d="M6.6 6.6C3.8 8.5 2 12 2 12s3.5 8 10 8a10.7 10.7 0 0 0 4.1-.8"/></svg>`;
}

function enhancePasswordField() {
  const input = document.querySelector("#cloudPassword");
  if (!input || input.closest(".cloud-password-control")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "cloud-password-control";
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cloud-password-toggle";
  button.setAttribute("aria-label", "Показать пароль");
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = premiumEyeIcon(true);
  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-label", show ? "Скрыть пароль" : "Показать пароль");
    button.setAttribute("aria-pressed", String(show));
    button.innerHTML = premiumEyeIcon(!show);
    input.focus({preventScroll:true});
  });
  wrapper.appendChild(button);
}

function enforceCurrentVersion() {
  const label = document.querySelector("#versionLabel");
  if (label && typeof APP_VERSION !== "undefined") label.textContent = APP_VERSION;
}

function enhancePremiumUi() {
  enforceCurrentVersion();
  enhancePasswordField();
}

function schedulePremiumEnhance() {
  clearTimeout(premiumEnhanceTimer);
  premiumEnhanceTimer = setTimeout(enhancePremiumUi, 60);
}

function getAccessLinkData() {
  const token = localStorage.getItem(TOKEN_KEY);
  const version = typeof APP_VERSION === "string" ? APP_VERSION.replace(/\D/g, "") : "320";
  const baseUrl = `${location.origin}${location.pathname}?v=${version}`;
  return {
    url: token ? `${baseUrl}#access=${encodeURIComponent(token)}` : baseUrl,
    hasFullKey: Boolean(token),
  };
}

function ensureAccessLinkModal() {
  let modal = document.querySelector("#accessLinkModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "accessLinkModal";
  modal.className = "access-link-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <section class="access-link-card" role="dialog" aria-modal="true" aria-labelledby="accessLinkTitle">
      <button class="access-link-close" type="button" aria-label="Закрыть">×</button>
      <h2 id="accessLinkTitle">Доступ с нового устройства</h2>
      <p id="accessLinkIntro">Подготовка ссылки…</p>
      <div class="access-link-notice" id="accessLinkNotice"></div>
      <label class="access-link-field">Ссылка на приложение
        <input id="accessLinkValue" type="text" readonly spellcheck="false">
      </label>
      <div class="access-link-actions">
        <button class="btn" id="accessCopyBtn" type="button">Копировать ссылку</button>
        <button class="btn secondary" id="accessOpenBtn" type="button">Открыть</button>
        <button class="btn secondary" id="accessShareBtn" type="button">Поделиться</button>
      </div>
      <div class="access-link-message" id="accessLinkMessage" aria-live="polite"></div>
    </section>`;
  document.body.appendChild(modal);

  const close = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };
  modal.querySelector(".access-link-close").addEventListener("click", close);
  modal.addEventListener("click", event => { if (event.target === modal) close(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && modal.classList.contains("open")) close(); });

  modal.querySelector("#accessCopyBtn").addEventListener("click", async () => {
    const input = modal.querySelector("#accessLinkValue");
    const message = modal.querySelector("#accessLinkMessage");
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(input.value);
        copied = true;
      }
    } catch (_) {}
    if (!copied) {
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
      try { copied = document.execCommand("copy"); } catch (_) {}
    }
    message.textContent = copied
      ? "Ссылка скопирована. Отправьте её на телефон или другому участнику."
      : "Не удалось скопировать автоматически. Выделите ссылку и скопируйте вручную.";
  });

  modal.querySelector("#accessOpenBtn").addEventListener("click", () => {
    const url = modal.querySelector("#accessLinkValue").value;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  });

  modal.querySelector("#accessShareBtn").addEventListener("click", async () => {
    const url = modal.querySelector("#accessLinkValue").value;
    const message = modal.querySelector("#accessLinkMessage");
    const hasFullKey = modal.dataset.hasFullKey === "1";
    if (!url) return;
    if (!navigator.share) {
      message.textContent = "Системное меню недоступно. Используйте кнопку «Копировать ссылку».";
      return;
    }
    try {
      await navigator.share({
        title:"Чек-лист «Богатка»",
        text: hasFullKey
          ? "Ссылка доступа к рабочему приложению «Богатка»"
          : "Ссылка на приложение «Богатка». При первом открытии введите шестизначный код доступа, затем войдите в облачный аккаунт.",
        url,
      });
      message.textContent = "Ссылка передана в системное меню.";
    } catch (error) {
      if (error?.name !== "AbortError") message.textContent = "Не удалось открыть системное меню. Используйте кнопку «Копировать ссылку».";
    }
  });

  return modal;
}

function openAccessLinkModal() {
  const data = getAccessLinkData();
  const modal = ensureAccessLinkModal();
  modal.dataset.hasFullKey = data.hasFullKey ? "1" : "0";
  modal.querySelector("#accessLinkValue").value = data.url;
  modal.querySelector("#accessLinkMessage").textContent = "";

  const intro = modal.querySelector("#accessLinkIntro");
  const notice = modal.querySelector("#accessLinkNotice");
  if (data.hasFullKey) {
    intro.textContent = "Это полная ссылка доступа. На новом устройстве приложение откроется без ввода шестизначного кода.";
    notice.className = "access-link-notice success";
    notice.innerHTML = "<strong>Готово к передаче.</strong> Отправьте ссылку себе на телефон через Telegram или другой мессенджер.";
  } else {
    intro.textContent = "Исходный ключ был удалён при очистке данных браузера, поэтому сейчас сформирована обычная ссылка на приложение.";
    notice.className = "access-link-notice warning";
    notice.innerHTML = "<strong>Это не ошибка.</strong> На новом устройстве откройте эту ссылку, введите ваш шестизначный код доступа один раз, затем войдите в тот же облачный аккаунт. После входа данные синхронизируются.";
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function replaceAccessLinkButton() {
  const oldButton = document.querySelector("#shareAccessBtn");
  if (!oldButton || oldButton.dataset.premiumAccess === "1") return;
  const button = oldButton.cloneNode(true);
  button.dataset.premiumAccess = "1";
  oldButton.replaceWith(button);
  button.addEventListener("click", openAccessLinkModal);
}

window.addEventListener("load", () => {
  replaceAccessLinkButton();
  enhancePremiumUi();
  const observer = new MutationObserver(schedulePremiumEnhance);
  observer.observe(document.body, {childList:true,subtree:true});
});

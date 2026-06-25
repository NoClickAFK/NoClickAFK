(function () {
  if (window.BogatkaSuiteUI) return;

  const S = window.BogatkaSuite;
  if (!S) return;
  const VERSION = S.VERSION;
  const PHOTO_LABELS = Object.fromEntries(PHOTO_CATEGORIES.map(([key, title]) => [key, title]));
  const originalRenderLocations = window.renderLocations || renderLocations;
  const baseUpdateSummary = window.updateSummary || updateSummary;
  let refreshTimer = null;
  let refreshing = null;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const formatNumber = (value, digits = 0) => value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(Number(value));
  const formatDate = value => {
    if (!value) return "—";
    try { return new Date(value).toLocaleString("ru-RU"); } catch (_) { return String(value); }
  };
  const canEdit = () => typeof cloudRole === "undefined" || cloudRole !== "viewer";

  function setVersion() {
    const label = document.getElementById("versionLabel");
    if (label) label.textContent = VERSION;
  }

  function scheduleRefresh(delay = 40) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refresh().catch(console.error), delay);
  }

  function renderLocationsV400() {
    originalRenderLocations();
    scheduleRefresh(80);
  }
  window.renderLocations = renderLocationsV400;
  try { renderLocations = renderLocationsV400; } catch (_) {}

  function findDetails(card, text) {
    return [...card.querySelectorAll(":scope .location-body > details")].find(details => details.querySelector(":scope > summary")?.textContent.includes(text));
  }

  function economyMarkup(id) {
    const fields = [
      ["monthlyRevenue", "Прогноз выручки в месяц, BYN", "number"],
      ["grossMarginPct", "Валовая маржа, %", "number"],
      ["taxRatePct", "Налоги с выручки, %", "number"],
      ["payroll", "Фонд оплаты труда, BYN", "number"],
      ["marketing", "Маркетинг в месяц, BYN", "number"],
      ["logistics", "Логистика в месяц, BYN", "number"],
      ["otherOpex", "Прочие расходы в месяц, BYN", "number"],
      ["initialStock", "Стартовый товарный запас, BYN", "number"],
      ["workingCapital", "Оборотный капитал, BYN", "number"],
      ["openingOther", "Прочие затраты на открытие, BYN", "number"],
      ["openingInvestmentOverride", "Инвестиции вручную, BYN", "number"],
      ["forecastNote", "Комментарий к прогнозу", "text"],
    ];
    return `
      <details class="economy-v400" data-economy-details="${id}">
        <summary><span>Экономическая модель и окупаемость</span><span class="economy-status-v400 empty" data-economy-status="${id}">Недостаточно данных</span></summary>
        <div class="details-body">
          <p class="section-note">Аренда, площадь, коммунальные, ремонт, оборудование и депозит берутся из технических параметров. Остальные значения вводятся здесь.</p>
          <div class="grid-3 economy-fields-v400">
            ${fields.map(([key, label, type]) => `<label class="field">${escapeHtml(label)}<input type="${type}" step="any" data-economy-location="${id}" data-economy-key="${key}"></label>`).join("")}
          </div>
          <div class="economy-results-v400">
            <div><span>Аренда за м²</span><strong data-econ-result="rentPerSqm">—</strong></div>
            <div><span>Арендная нагрузка</span><strong data-econ-result="rentBurdenPct">—</strong></div>
            <div><span>Валовая прибыль</span><strong data-econ-result="grossProfit">—</strong></div>
            <div><span>Постоянные расходы</span><strong data-econ-result="fixedCosts">—</strong></div>
            <div><span>Операционная прибыль</span><strong data-econ-result="operatingProfit">—</strong></div>
            <div><span>Маржинальность</span><strong data-econ-result="operatingMarginPct">—</strong></div>
            <div><span>Точка безубыточности</span><strong data-econ-result="breakEvenRevenue">—</strong></div>
            <div><span>Инвестиции в открытие</span><strong data-econ-result="openingInvestment">—</strong></div>
            <div><span>Окупаемость</span><strong data-econ-result="paybackMonths">—</strong></div>
          </div>
          <div class="economy-note-v400" data-economy-note="${id}"></div>
        </div>
      </details>`;
  }

  function ensureEconomy(card, id) {
    if (card.querySelector(`[data-economy-details="${id}"]`)) return;
    const tech = findDetails(card, "Технические и финансовые");
    if (!tech) return;
    tech.insertAdjacentHTML("afterend", economyMarkup(id));
    card.querySelectorAll(`[data-economy-location="${id}"]`).forEach(input => {
      const eventName = input.type === "text" || input.type === "number" ? "input" : "change";
      input.addEventListener(eventName, () => {
        clearTimeout(input._suiteSaveTimer);
        input._suiteSaveTimer = setTimeout(() => S.saveEconomyField(id, input.dataset.economyKey, input.value).catch(showError), 350);
      });
    });
  }

  function ensurePhotoPlan(card, id) {
    const photoDetails = findDetails(card, "Фотографии по категориям");
    const body = photoDetails?.querySelector(".details-body");
    if (!body || body.querySelector(`[data-photo-plan="${id}"]`)) return;
    const panel = document.createElement("div");
    panel.className = "photo-plan-v400";
    panel.dataset.photoPlan = id;
    panel.innerHTML = `
      <div class="photo-plan-head-v400"><div><strong>Обязательный фотоплан</strong><span>Минимальный комплект для удалённой оценки объекта</span></div><b data-photo-plan-total="${id}">0%</b></div>
      <div class="photo-plan-track-v400"><span data-photo-plan-bar="${id}"></span></div>
      <div class="photo-plan-grid-v400" data-photo-plan-grid="${id}"></div>`;
    body.prepend(panel);

    for (const [category] of PHOTO_CATEGORIES) {
      const photosRoot = card.querySelector(`[data-photos="${CSS.escape(id)}:${CSS.escape(category)}"]`);
      const head = photosRoot?.closest(".photo-category")?.querySelector(".photo-category-head h4");
      if (head && !head.parentElement.querySelector(`[data-photo-badge="${category}"]`)) {
        const badge = document.createElement("span");
        badge.className = "photo-count-badge-v400";
        badge.dataset.photoBadge = category;
        head.insertAdjacentElement("afterend", badge);
      }
    }
  }

  function collaborationMarkup(id) {
    return `
      <details class="collaboration-v400" data-collaboration="${id}">
        <summary>Совместная работа: задачи, комментарии и история</summary>
        <div class="details-body">
          <div class="collaboration-tabs-v400">
            <button type="button" class="active" data-collab-tab="tasks">Задачи <span data-task-count="${id}">0</span></button>
            <button type="button" data-collab-tab="comments">Комментарии <span data-comment-count="${id}">0</span></button>
            <button type="button" data-collab-tab="history">История <span data-history-count="${id}">0</span></button>
          </div>
          <section class="collab-pane-v400 active" data-collab-pane="tasks">
            <form class="task-form-v400" data-task-form="${id}">
              <input name="title" placeholder="Что нужно сделать" required>
              <input name="assignee" placeholder="Ответственный">
              <input name="dueDate" type="date" aria-label="Срок">
              <select name="priority"><option value="normal">Обычный приоритет</option><option value="high">Высокий приоритет</option><option value="critical">Критический</option></select>
              <button class="btn" type="submit">Добавить задачу</button>
            </form>
            <div class="task-list-v400" data-task-list="${id}"></div>
          </section>
          <section class="collab-pane-v400" data-collab-pane="comments">
            <form class="comment-form-v400" data-comment-form="${id}"><textarea name="text" placeholder="Комментарий для участников проекта" required></textarea><button class="btn" type="submit">Добавить комментарий</button></form>
            <div class="comment-list-v400" data-comment-list="${id}"></div>
          </section>
          <section class="collab-pane-v400" data-collab-pane="history"><div class="history-list-v400" data-history-list="${id}"></div></section>
        </div>
      </details>`;
  }

  function ensureCollaboration(card, id) {
    if (card.querySelector(`[data-collaboration="${id}"]`)) return;
    const photos = findDetails(card, "Фотографии по категориям");
    if (!photos) return;
    photos.insertAdjacentHTML("afterend", collaborationMarkup(id));
    const root = card.querySelector(`[data-collaboration="${id}"]`);
    root.querySelectorAll("[data-collab-tab]").forEach(button => button.addEventListener("click", () => {
      root.querySelectorAll("[data-collab-tab]").forEach(item => item.classList.toggle("active", item === button));
      root.querySelectorAll("[data-collab-pane]").forEach(pane => pane.classList.toggle("active", pane.dataset.collabPane === button.dataset.collabTab));
    }));
    root.querySelector(`[data-task-form="${id}"]`)?.addEventListener("submit", async event => {
      event.preventDefault();
      if (!canEdit()) return alert("Роль наблюдателя не позволяет добавлять задачи.");
      const form = new FormData(event.currentTarget);
      await S.addTask(id, Object.fromEntries(form.entries()));
      event.currentTarget.reset();
    });
    root.querySelector(`[data-comment-form="${id}"]`)?.addEventListener("submit", async event => {
      event.preventDefault();
      if (!canEdit()) return alert("Роль наблюдателя не позволяет добавлять комментарии.");
      const form = new FormData(event.currentTarget);
      await S.addComment(id, form.get("text"));
      event.currentTarget.reset();
    });
  }

  function launchMarkup(id) {
    return `
      <details class="launch-project-v400" data-launch-details="${id}">
        <summary><span>Проект открытия магазина</span><span class="launch-progress-label-v400" data-launch-label="${id}">Не активирован</span></summary>
        <div class="details-body" data-launch-body="${id}"></div>
      </details>`;
  }

  function ensureLaunch(card, id) {
    if (card.querySelector(`[data-launch-details="${id}"]`)) return;
    const decision = card.querySelector(".decision");
    if (!decision) return;
    decision.insertAdjacentHTML("afterend", launchMarkup(id));
  }

  function activeActionButtons(card, id) {
    const actions = card.querySelector(".location-actions");
    if (!actions) return;
    const oldDelete = actions.querySelector('[data-action="delete-location-direct"]');
    if (oldDelete) oldDelete.remove();
    if (!actions.querySelector('[data-action="archive-location"]')) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn warning small";
      button.dataset.action = "archive-location";
      button.textContent = "В архив";
      button.addEventListener("click", () => S.archiveLocation(id).catch(showError));
      actions.appendChild(button);
    }
  }

  function ensureCard(card, id) {
    ensureEconomy(card, id);
    ensurePhotoPlan(card, id);
    ensureCollaboration(card, id);
    ensureLaunch(card, id);
    activeActionButtons(card, id);
  }

  function renderEconomy(card, metric) {
    const economy = metric.economy || S.calculateEconomy(metric.data);
    const details = card.querySelector(`[data-economy-details="${metric.id}"]`);
    if (!details) return;
    details.querySelectorAll("[data-economy-key]").forEach(input => {
      if (input === document.activeElement) return;
      input.value = metric.data?.economy?.[input.dataset.economyKey] ?? "";
    });
    const values = {
      rentPerSqm: economy.rentPerSqm === null ? "—" : `${formatNumber(economy.rentPerSqm, 2)} BYN`,
      rentBurdenPct: economy.rentBurdenPct === null ? "—" : `${formatNumber(economy.rentBurdenPct, 1)}%`,
      grossProfit: `${formatNumber(economy.grossProfit, 2)} BYN`,
      fixedCosts: `${formatNumber(economy.fixedCosts, 2)} BYN`,
      operatingProfit: `${formatNumber(economy.operatingProfit, 2)} BYN`,
      operatingMarginPct: economy.operatingMarginPct === null ? "—" : `${formatNumber(economy.operatingMarginPct, 1)}%`,
      breakEvenRevenue: economy.breakEvenRevenue === null ? "—" : `${formatNumber(economy.breakEvenRevenue, 2)} BYN`,
      openingInvestment: `${formatNumber(economy.openingInvestment, 2)} BYN`,
      paybackMonths: economy.paybackMonths === null ? "—" : `${formatNumber(economy.paybackMonths, 1)} мес.`,
    };
    Object.entries(values).forEach(([key, value]) => { const target = details.querySelector(`[data-econ-result="${key}"]`); if (target) target.textContent = value; });
    const status = card.querySelector(`[data-economy-status="${metric.id}"]`);
    if (status) { status.textContent = economy.statusText; status.className = `economy-status-v400 ${economy.status}`; }
    const note = card.querySelector(`[data-economy-note="${metric.id}"]`);
    if (note) {
      const messages = [];
      if (!economy.revenue) messages.push("Укажите прогноз выручки.");
      if (!economy.grossMarginPct) messages.push("Укажите валовую маржу.");
      if (economy.rentBurdenPct !== null && economy.rentBurdenPct > 18) messages.push("Арендная нагрузка выше 18% — критически высокая.");
      else if (economy.rentBurdenPct !== null && economy.rentBurdenPct > 12) messages.push("Арендная нагрузка выше желательного диапазона 8–12%.");
      if (economy.operatingProfit < 0) messages.push("Прогнозная операционная прибыль отрицательная.");
      note.textContent = messages.join(" ") || "Расчёт заполнен. Сопоставьте прогноз с фактическими показателями действующих магазинов.";
    }
  }

  function renderPhotoPlan(card, metric) {
    const plan = metric.photoPlan;
    if (!plan) return;
    const total = card.querySelector(`[data-photo-plan-total="${metric.id}"]`);
    const bar = card.querySelector(`[data-photo-plan-bar="${metric.id}"]`);
    const grid = card.querySelector(`[data-photo-plan-grid="${metric.id}"]`);
    if (total) total.textContent = `${plan.completed}/${plan.requiredTotal} · ${plan.percent}%`;
    if (bar) bar.style.width = `${plan.percent}%`;
    if (grid) grid.innerHTML = Object.entries(S.PHOTO_PLAN).filter(([, required]) => required > 0).map(([category, required]) => {
      const count = plan.counts[category] || 0;
      const done = count >= required;
      return `<div class="${done ? "done" : ""}"><span>${escapeHtml(PHOTO_LABELS[category] || category)}</span><strong>${count}/${required}</strong></div>`;
    }).join("");
    card.querySelectorAll("[data-photo-badge]").forEach(badge => {
      const category = badge.dataset.photoBadge;
      const required = S.PHOTO_PLAN[category] || 0;
      const count = plan.counts[category] || 0;
      badge.textContent = required ? `${count}/${required}` : `${count}`;
      badge.classList.toggle("done", required ? count >= required : count > 0);
    });
  }

  function renderTasks(card, metric) {
    const tasks = Array.isArray(metric.data.tasks) ? [...metric.data.tasks] : [];
    const list = card.querySelector(`[data-task-list="${metric.id}"]`);
    const count = card.querySelector(`[data-task-count="${metric.id}"]`);
    if (count) count.textContent = tasks.filter(task => task.status !== "done").length;
    if (!list) return;
    tasks.sort((a, b) => (a.status === "done") - (b.status === "done") || String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")));
    list.innerHTML = tasks.length ? tasks.map(task => {
      const overdue = task.dueDate && task.status !== "done" && new Date(`${task.dueDate}T23:59:59`) < new Date();
      return `<article class="task-card-v400 ${task.status === "done" ? "done" : ""} ${overdue ? "overdue" : ""}">
        <div class="task-main-v400"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.assignee || "Без ответственного")} · ${task.dueDate ? escapeHtml(task.dueDate) : "без срока"}</span>${task.note ? `<small>${escapeHtml(task.note)}</small>` : ""}</div>
        <span class="task-priority-v400 ${task.priority || "normal"}">${task.priority === "critical" ? "Критический" : task.priority === "high" ? "Высокий" : "Обычный"}</span>
        <select data-task-status="${task.id}"><option value="todo" ${task.status === "todo" ? "selected" : ""}>К выполнению</option><option value="doing" ${task.status === "doing" ? "selected" : ""}>В работе</option><option value="waiting" ${task.status === "waiting" ? "selected" : ""}>Ожидает</option><option value="done" ${task.status === "done" ? "selected" : ""}>Готово</option></select>
        <button type="button" class="task-delete-v400" data-task-delete="${task.id}" aria-label="Удалить задачу">×</button>
      </article>`;
    }).join("") : '<p class="empty-state-v400">Задач пока нет.</p>';
    list.querySelectorAll("[data-task-status]").forEach(select => select.addEventListener("change", () => S.updateTask(metric.id, select.dataset.taskStatus, { status: select.value }).catch(showError)));
    list.querySelectorAll("[data-task-delete]").forEach(button => button.addEventListener("click", () => {
      if (confirm("Удалить задачу?")) S.deleteTask(metric.id, button.dataset.taskDelete).catch(showError);
    }));
  }

  function renderComments(card, metric) {
    const comments = Array.isArray(metric.data.comments) ? [...metric.data.comments].reverse() : [];
    const list = card.querySelector(`[data-comment-list="${metric.id}"]`);
    const count = card.querySelector(`[data-comment-count="${metric.id}"]`);
    if (count) count.textContent = comments.length;
    if (!list) return;
    list.innerHTML = comments.length ? comments.map(comment => `<article class="comment-card-v400"><div><strong>${escapeHtml(comment.author || comment.authorEmail || "Участник")}</strong><time>${escapeHtml(formatDate(comment.createdAt))}</time></div><p>${escapeHtml(comment.text)}</p>${canEdit() ? `<button type="button" data-comment-delete="${comment.id}">Удалить</button>` : ""}</article>`).join("") : '<p class="empty-state-v400">Комментариев пока нет.</p>';
    list.querySelectorAll("[data-comment-delete]").forEach(button => button.addEventListener("click", () => {
      if (confirm("Удалить комментарий?")) S.deleteComment(metric.id, button.dataset.commentDelete).catch(showError);
    }));
  }

  function renderHistory(card, metric) {
    const activity = Array.isArray(metric.data.activity) ? [...metric.data.activity].reverse() : [];
    const list = card.querySelector(`[data-history-list="${metric.id}"]`);
    const count = card.querySelector(`[data-history-count="${metric.id}"]`);
    if (count) count.textContent = activity.length;
    if (!list) return;
    list.innerHTML = activity.length ? activity.slice(0, 60).map(entry => `<article class="history-item-v400"><span class="history-dot-v400"></span><div><strong>${escapeHtml(entry.action || "Изменение")}${entry.label ? ` · ${escapeHtml(entry.label)}` : ""}</strong><small>${escapeHtml(entry.actor || entry.actorEmail || "Участник")} · ${escapeHtml(formatDate(entry.at))}</small>${entry.from || entry.to ? `<p>${entry.from ? `<del>${escapeHtml(entry.from)}</del>` : ""}${entry.to ? `<ins>${escapeHtml(entry.to)}</ins>` : ""}</p>` : entry.details ? `<p>${escapeHtml(entry.details)}</p>` : ""}</div></article>`).join("") : '<p class="empty-state-v400">История появится после первого изменения.</p>';
  }

  function launchProgress(project) {
    const milestones = Array.isArray(project?.milestones) ? project.milestones : [];
    const done = milestones.filter(item => item.status === "done").length;
    return { done, total: milestones.length, percent: milestones.length ? Math.round(done / milestones.length * 100) : 0 };
  }

  function renderLaunch(card, metric) {
    const body = card.querySelector(`[data-launch-body="${metric.id}"]`);
    const label = card.querySelector(`[data-launch-label="${metric.id}"]`);
    if (!body) return;
    const project = metric.data.launchProject;
    const shouldOffer = metric.data.status === "Оставить" || metric.data.decision === "Оставить";
    if (!project?.enabled) {
      if (label) label.textContent = shouldOffer ? "Готов к запуску" : "Не активирован";
      body.innerHTML = `<div class="launch-empty-v400"><p>${shouldOffer ? "Локация выбрана. Создайте рабочий план открытия магазина." : "Проект открытия станет основным рабочим блоком после решения «Оставить»."}</p><button type="button" class="btn" data-launch-activate="${metric.id}" ${shouldOffer && canEdit() ? "" : "disabled"}>Создать проект открытия</button></div>`;
      body.querySelector("[data-launch-activate]")?.addEventListener("click", async () => {
        const data = await getLocationData(metric.id);
        S.ensureLaunchProject(data);
        data.updatedAt = new Date().toISOString();
        await idbPut(STORE, data, `location:${metric.id}`);
        await updateSummary();
      });
      return;
    }

    const progress = launchProgress(project);
    if (label) label.textContent = `${progress.done}/${progress.total} · ${progress.percent}%`;
    body.innerHTML = `
      <div class="launch-overview-v400"><div><span>Этап</span><strong>${escapeHtml(project.stage || "Подготовка")}</strong></div><div><span>Дата открытия</span><strong>${escapeHtml(project.targetDate || "не задана")}</strong></div><div><span>Ответственный</span><strong>${escapeHtml(project.manager || "не назначен")}</strong></div><div><span>Бюджет</span><strong>${project.budget ? `${escapeHtml(project.budget)} BYN` : "не задан"}</strong></div></div>
      <div class="launch-progress-v400"><span style="width:${progress.percent}%"></span></div>
      <div class="grid-4 launch-fields-v400">
        <label class="field">Текущий этап<select data-launch-field="stage"><option>Подготовка договора</option><option>Проектирование</option><option>Ремонт</option><option>Комплектация</option><option>Набор персонала</option><option>Подготовка к открытию</option><option>Открыт</option></select></label>
        <label class="field">Плановая дата<input type="date" data-launch-field="targetDate"></label>
        <label class="field">Ответственный<input type="text" data-launch-field="manager"></label>
        <label class="field">Бюджет проекта, BYN<input type="number" step="any" data-launch-field="budget"></label>
      </div>
      <label class="field launch-notes-v400">Примечания по запуску<textarea data-launch-field="notes"></textarea></label>
      <div class="milestone-list-v400">${(project.milestones || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(item => `<article class="milestone-v400 ${item.status === "done" ? "done" : ""}"><span class="milestone-number-v400">${(item.order || 0) + 1}</span><div><strong>${escapeHtml(item.title)}</strong><input type="text" value="${escapeHtml(item.assignee || "")}" placeholder="Ответственный" data-milestone-assignee="${item.id}"><input type="date" value="${escapeHtml(item.dueDate || "")}" data-milestone-date="${item.id}"></div><select data-milestone-status="${item.id}"><option value="todo" ${item.status === "todo" ? "selected" : ""}>Не начато</option><option value="doing" ${item.status === "doing" ? "selected" : ""}>В работе</option><option value="waiting" ${item.status === "waiting" ? "selected" : ""}>Ожидает</option><option value="done" ${item.status === "done" ? "selected" : ""}>Готово</option></select></article>`).join("")}</div>`;

    body.querySelectorAll("[data-launch-field]").forEach(input => {
      input.value = project[input.dataset.launchField] ?? "";
      const eventName = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, () => {
        clearTimeout(input._launchTimer);
        input._launchTimer = setTimeout(() => S.saveLaunchField(metric.id, input.dataset.launchField, input.value).catch(showError), 300);
      });
    });
    body.querySelectorAll("[data-milestone-status]").forEach(select => select.addEventListener("change", () => S.updateMilestone(metric.id, select.dataset.milestoneStatus, { status: select.value }).catch(showError)));
    body.querySelectorAll("[data-milestone-assignee]").forEach(input => input.addEventListener("change", () => S.updateMilestone(metric.id, input.dataset.milestoneAssignee, { assignee: input.value }).catch(showError)));
    body.querySelectorAll("[data-milestone-date]").forEach(input => input.addEventListener("change", () => S.updateMilestone(metric.id, input.dataset.milestoneDate, { dueDate: input.value }).catch(showError)));
  }

  function ensureArchiveManager() {
    let panel = document.getElementById("archiveManagerV400");
    if (panel) return panel;
    const anchor = document.getElementById("locationSortPanel") || document.querySelector(".summary.card");
    if (!anchor) return null;
    panel = document.createElement("details");
    panel.id = "archiveManagerV400";
    panel.className = "archive-manager-v400 hidden";
    panel.innerHTML = `<summary><span>Архив локаций</span><span data-archive-count>0</span></summary><div class="archive-list-v400" data-archive-list></div>`;
    anchor.insertAdjacentElement("afterend", panel);
    return panel;
  }

  async function renderArchiveManager() {
    const panel = ensureArchiveManager();
    if (!panel) return;
    const archived = [];
    for (const item of locations) {
      const data = await getLocationData(item.id);
      if (data.archivedAt || item.archivedAt) archived.push({ item, data });
    }
    panel.classList.toggle("hidden", !archived.length);
    panel.querySelector("[data-archive-count]").textContent = archived.length;
    const list = panel.querySelector("[data-archive-list]");
    list.innerHTML = archived.map(({ item, data }) => `<article><div><strong>${escapeHtml(item.title || item.address)}</strong><span>${escapeHtml(item.address || "")} · архивировал: ${escapeHtml(data.archivedBy || "—")} · ${escapeHtml(formatDate(data.archivedAt || item.archivedAt))}</span></div><button type="button" class="btn secondary small" data-archive-restore="${item.id}">Восстановить</button><button type="button" class="btn danger small" data-archive-delete="${item.id}">Удалить окончательно</button></article>`).join("");
    list.querySelectorAll("[data-archive-restore]").forEach(button => button.addEventListener("click", () => S.restoreArchivedLocation(button.dataset.archiveRestore).catch(showError)));
    list.querySelectorAll("[data-archive-delete]").forEach(button => button.addEventListener("click", () => S.permanentlyDeleteArchived(button.dataset.archiveDelete).catch(showError)));
  }

  function ensureDuplicateWarning() {
    const address = document.getElementById("locationAddress");
    if (!address || document.getElementById("duplicateAddressWarning")) return;
    const warning = document.createElement("div");
    warning.id = "duplicateAddressWarning";
    warning.className = "duplicate-warning-v400 hidden";
    address.closest("label")?.insertAdjacentElement("afterend", warning);
    address.addEventListener("input", () => {
      const duplicate = S.findAddressDuplicate(address.value, document.getElementById("editLocationId")?.value || "");
      warning.classList.toggle("hidden", !duplicate);
      if (duplicate) warning.innerHTML = `<strong>${duplicate.exact ? "Такой адрес уже существует" : "Возможный дубль"}</strong><span>${escapeHtml(duplicate.item.title || duplicate.item.address)}</span>`;
    });
  }

  function updateSummaryMetrics(metrics) {
    const activePhotos = metrics.reduce((sum, metric) => sum + metric.photoCount, 0);
    const inspected = metrics.filter(metric => metric.completion > 0 || metric.photoCount > 0).length;
    const scored = metrics.filter(metric => metric.rawScore > 0);
    const values = {
      totalLocationsCount: metrics.length,
      completedCount: inspected,
      bestScore: scored.length ? Math.max(...scored.map(metric => metric.rawScore)) : 0,
      averageScore: scored.length ? (scored.reduce((sum, metric) => sum + metric.rawScore, 0) / scored.length).toFixed(1) : "0",
      candidateCount: metrics.filter(metric => metric.data.status === "Кандидат").length,
      negotiationCount: metrics.filter(metric => metric.data.status === "Переговоры").length,
      keepCount: metrics.filter(metric => metric.data.status === "Оставить" || metric.data.decision === "Оставить").length,
      excludedCount: metrics.filter(metric => metric.data.status === "Исключить" || metric.data.decision === "Исключить").length,
      photoCount: activePhotos,
    };
    Object.entries(values).forEach(([id, value]) => { const target = document.getElementById(id); if (target) target.textContent = value; });
  }

  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      setVersion();
      S.installFunctionOverrides();
      S.installPhotoDeleteHistoryWrapper();
      S.enhanceDecisionEngine();
      ensureDuplicateWarning();

      const metrics = await window.BogatkaDecisionEngine.computeAll();
      const metricMap = new Map(metrics.map(metric => [metric.id, metric]));
      document.querySelectorAll("[data-location-card]").forEach(card => {
        const id = card.dataset.locationCard;
        const metric = metricMap.get(id);
        card.classList.toggle("hidden", !metric);
        if (!metric) return;
        ensureCard(card, id);
        renderEconomy(card, metric);
        renderPhotoPlan(card, metric);
        renderTasks(card, metric);
        renderComments(card, metric);
        renderHistory(card, metric);
        renderLaunch(card, metric);
      });
      updateSummaryMetrics(metrics);
      await renderArchiveManager();
      if (window.BogatkaDecisionUI?.refresh) await window.BogatkaDecisionUI.refresh();
      return metrics;
    })().finally(() => { refreshing = null; });
    return refreshing;
  }

  async function updateSummaryV400() {
    if (baseUpdateSummary) await baseUpdateSummary();
    await refresh();
  }
  window.updateSummary = updateSummaryV400;
  try { updateSummary = updateSummaryV400; } catch (_) {}

  window.BogatkaSuiteUI = { refresh, scheduleRefresh };
  setVersion();
  ensureDuplicateWarning();
  scheduleRefresh(600);
})();

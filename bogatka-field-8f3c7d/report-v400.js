(function () {
  if (window.__bogatkaReportV400 || typeof window.buildReportHtml !== "function") return;
  window.__bogatkaReportV400 = true;
  const baseBuildReportHtml = window.buildReportHtml;
  const S = window.BogatkaSuite;
  const STOP_LABELS = Object.fromEntries((window.BogatkaDecisionEngine?.STOPS || []).map(([key, label]) => [key, label]));
  const PHOTO_LABELS = Object.fromEntries(PHOTO_CATEGORIES.map(([key, label]) => [key, label]));
  const escReport = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const numberReport = (value, digits = 0) => value === null || value === undefined || !Number.isFinite(Number(value)) ? "—" : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(Number(value));
  const dateReport = value => { if (!value) return "—"; try { return new Date(value).toLocaleString("ru-RU"); } catch (_) { return String(value); } };

  function economyHtml(metric) {
    const economy = metric.economy || S.calculateEconomy(metric.data);
    return `<section class="report-suite-section"><h3>Экономическая модель</h3><div class="report-suite-grid">
      <div><b>Прогноз выручки:</b> ${numberReport(economy.revenue, 2)} BYN</div>
      <div><b>Валовая маржа:</b> ${numberReport(economy.grossMarginPct, 1)}%</div>
      <div><b>Аренда за м²:</b> ${numberReport(economy.rentPerSqm, 2)} BYN</div>
      <div><b>Арендная нагрузка:</b> ${numberReport(economy.rentBurdenPct, 1)}%</div>
      <div><b>Операционная прибыль:</b> ${numberReport(economy.operatingProfit, 2)} BYN</div>
      <div><b>Операционная маржа:</b> ${numberReport(economy.operatingMarginPct, 1)}%</div>
      <div><b>Точка безубыточности:</b> ${numberReport(economy.breakEvenRevenue, 2)} BYN</div>
      <div><b>Инвестиции:</b> ${numberReport(economy.openingInvestment, 2)} BYN</div>
      <div><b>Окупаемость:</b> ${economy.paybackMonths === null ? "—" : `${numberReport(economy.paybackMonths, 1)} мес.`}</div>
      <div><b>Вывод:</b> ${escReport(economy.statusText)}</div>
    </div></section>`;
  }

  function stopHtml(metric) {
    const entries = Object.entries(metric.data.stopFactors || {}).filter(([, value]) => value);
    const labels = { clear: "Нет проблемы", risk: "Риск / уточнить", block: "Стоп-фактор" };
    return `<section class="report-suite-section"><h3>Стоп-факторы</h3>${entries.length ? `<table><tbody>${entries.map(([key, value]) => `<tr class="stop-${escReport(value)}"><td>${escReport(STOP_LABELS[key] || key)}</td><td>${escReport(labels[value] || value)}</td></tr>`).join("")}</tbody></table>` : "<p>Стоп-факторы не проверены.</p>"}</section>`;
  }

  function photoPlanHtml(metric) {
    const plan = metric.photoPlan;
    if (!plan) return "";
    return `<section class="report-suite-section"><h3>Фотоплан: ${plan.completed}/${plan.requiredTotal} (${plan.percent}%)</h3><div class="report-photo-plan">${Object.entries(S.PHOTO_PLAN).filter(([, required]) => required > 0).map(([category, required]) => `<span class="${(plan.counts[category] || 0) >= required ? "done" : ""}">${escReport(PHOTO_LABELS[category] || category)}: <b>${plan.counts[category] || 0}/${required}</b></span>`).join("")}</div></section>`;
  }

  function taskHtml(metric) {
    const tasks = Array.isArray(metric.data.tasks) ? metric.data.tasks : [];
    const comments = Array.isArray(metric.data.comments) ? metric.data.comments : [];
    const activity = Array.isArray(metric.data.activity) ? metric.data.activity.slice(-20).reverse() : [];
    const taskRows = tasks.map(task => `<tr><td>${escReport(task.title)}</td><td>${escReport(task.assignee || "—")}</td><td>${escReport(task.dueDate || "—")}</td><td>${escReport(({ todo: "К выполнению", doing: "В работе", waiting: "Ожидает", done: "Готово" })[task.status] || task.status || "—")}</td></tr>`).join("");
    const commentCards = comments.slice(-20).reverse().map(comment => `<div class="report-comment"><b>${escReport(comment.author || comment.authorEmail || "Участник")}</b><small>${escReport(dateReport(comment.createdAt))}</small><p>${escReport(comment.text)}</p></div>`).join("");
    const history = activity.map(item => `<li><b>${escReport(item.action || "Изменение")}</b>${item.label ? ` · ${escReport(item.label)}` : ""}<small>${escReport(item.actor || item.actorEmail || "Участник")} · ${escReport(dateReport(item.at))}</small></li>`).join("");
    return `<section class="report-suite-section"><h3>Задачи и совместная работа</h3>${taskRows ? `<table><thead><tr><th>Задача</th><th>Ответственный</th><th>Срок</th><th>Статус</th></tr></thead><tbody>${taskRows}</tbody></table>` : "<p>Задач нет.</p>"}${commentCards ? `<h4>Комментарии</h4><div class="report-comments">${commentCards}</div>` : ""}${history ? `<h4>Последние изменения</h4><ul class="report-history">${history}</ul>` : ""}</section>`;
  }

  function launchHtml(metric) {
    const project = metric.data.launchProject;
    if (!project?.enabled) return "";
    const milestones = Array.isArray(project.milestones) ? project.milestones : [];
    const done = milestones.filter(item => item.status === "done").length;
    return `<section class="report-suite-section launch-report"><h3>Проект открытия магазина: ${done}/${milestones.length}</h3><div class="report-suite-grid"><div><b>Этап:</b> ${escReport(project.stage || "—")}</div><div><b>Плановая дата:</b> ${escReport(project.targetDate || "—")}</div><div><b>Ответственный:</b> ${escReport(project.manager || "—")}</div><div><b>Бюджет:</b> ${escReport(project.budget || "—")} BYN</div></div><ol class="report-milestones">${milestones.sort((a, b) => (a.order || 0) - (b.order || 0)).map(item => `<li class="${item.status === "done" ? "done" : ""}"><b>${escReport(item.title)}</b><span>${escReport(item.assignee || "—")} · ${escReport(item.dueDate || "без срока")} · ${escReport(({ todo: "не начато", doing: "в работе", waiting: "ожидает", done: "готово" })[item.status] || item.status)}</span></li>`).join("")}</ol></section>`;
  }

  function executiveTable(metrics) {
    return `<section class="report-executive"><h2>Сравнение активных локаций</h2><div class="report-wide-table"><table><thead><tr><th>Ранг</th><th>Локация</th><th>Рекомендация</th><th>Вес /100</th><th>Заполнено</th><th>Балл /70</th><th>Стопы</th><th>Аренда</th><th>Прибыль</th><th>Окупаемость</th></tr></thead><tbody>${metrics.map(metric => `<tr><td>#${metric.rank}</td><td>${escReport(metric.item.title || metric.item.address)}</td><td>${escReport(metric.recommendation.label)}</td><td>${numberReport(metric.weighted, 1)}</td><td>${metric.completion}%</td><td>${metric.rawScore}</td><td>${metric.blocks ? `${metric.blocks} стоп` : metric.risks ? `${metric.risks} риск` : "нет"}</td><td>${numberReport(metric.rent, 2)}</td><td>${numberReport(metric.economy?.operatingProfit, 2)}</td><td>${metric.economy?.paybackMonths === null || metric.economy?.paybackMonths === undefined ? "—" : `${numberReport(metric.economy.paybackMonths, 1)} мес.`}</td></tr>`).join("")}</tbody></table></div></section>`;
  }

  window.buildReportHtml = async function buildReportHtmlV400() {
    const html = await baseBuildReportHtml();
    const parser = new DOMParser();
    const documentReport = parser.parseFromString(html, "text/html");
    const metrics = await window.BogatkaDecisionEngine.computeAll();
    const metricMap = new Map(metrics.map(metric => [metric.id, metric]));
    const sections = [...documentReport.querySelectorAll(".report-location")];

    sections.forEach((section, index) => {
      const locationItem = locations[index];
      if (!locationItem) return;
      const metric = metricMap.get(locationItem.id);
      if (!metric) { section.remove(); return; }
      section.dataset.locationId = locationItem.id;
      const score = section.querySelector(".report-score");
      if (score) score.insertAdjacentHTML("beforeend", `<span class="report-weighted">${numberReport(metric.weighted, 1)}/100 взвешенно · ${metric.completion}% заполнено</span><span class="report-recommendation ${escReport(metric.recommendation.className)}">${escReport(metric.recommendation.label)}</span>`);
      const photosHeading = [...section.querySelectorAll("h3")].find(heading => heading.textContent.trim() === "Фотографии");
      const suite = documentReport.createElement("div");
      suite.className = "report-suite-v400";
      suite.innerHTML = `${economyHtml(metric)}${stopHtml(metric)}${photoPlanHtml(metric)}${taskHtml(metric)}${launchHtml(metric)}`;
      if (photosHeading) photosHeading.insertAdjacentElement("beforebegin", suite);
      else section.querySelector(".report-location-head")?.insertAdjacentElement("afterend", suite);
    });

    const cover = documentReport.querySelector(".report-cover");
    if (cover) {
      cover.querySelectorAll("p").forEach(paragraph => {
        if (paragraph.textContent.includes("Осмотрено:")) paragraph.remove();
      });
      cover.insertAdjacentHTML("beforeend", `<p><b>Активных локаций:</b> ${metrics.length} · <b>Лучший взвешенный результат:</b> ${metrics.length ? numberReport(Math.max(...metrics.map(metric => metric.weighted)), 1) : 0}/100</p>`);
      cover.insertAdjacentHTML("afterend", executiveTable(metrics));
    }

    const style = documentReport.createElement("style");
    style.textContent = `
      .report-executive,.report-suite-section{background:#fff;border:1px solid #d4e0d8;border-radius:14px;padding:16px;margin:14px 0}.report-executive h2,.report-suite-section h3{margin-top:0}.report-wide-table{overflow:auto}.report-wide-table table{min-width:1050px}.report-suite-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.report-suite-grid>div{padding:9px;border:1px solid #dce6e0;border-radius:9px;background:#f7faf8}.report-weighted,.report-recommendation{display:block;margin-top:6px;font-size:11px}.report-recommendation{padding:5px;border-radius:999px;background:#e6f2ea}.report-recommendation.stop{background:#fde5e5;color:#993232}.report-recommendation.risk{background:#fff0d3;color:#875710}.report-photo-plan{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.report-photo-plan span{padding:7px;border:1px solid #dce5e0;border-radius:8px}.report-photo-plan span.done{background:#e8f5ed;color:#17613d}.report-comment{padding:10px;border:1px solid #dce5e0;border-radius:9px;margin:7px 0}.report-comment small{float:right;color:#7b887f}.report-comment p{white-space:pre-wrap}.report-history{padding-left:20px}.report-history small{display:block;color:#7b887f}.report-milestones li{margin:6px 0;padding:7px}.report-milestones li.done{background:#eaf6ee;text-decoration:none}.report-milestones span{display:block;color:#6e7b73;font-size:11px}.stop-block td{background:#fff0f0}.stop-risk td{background:#fff8e8}@media(max-width:700px){.report-suite-grid,.report-photo-plan{grid-template-columns:1fr}}@media print{.report-executive,.report-suite-section{break-inside:avoid}.report-wide-table{overflow:visible}.report-wide-table table{min-width:0;font-size:9px}}`;
    documentReport.head.appendChild(style);
    return `<!doctype html>\n${documentReport.documentElement.outerHTML}`;
  };
})();

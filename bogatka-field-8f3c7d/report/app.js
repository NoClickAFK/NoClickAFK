const REPORT_ENDPOINT = "https://fascqulqvlxmraktuxez.supabase.co/functions/v1/bogatka-public-report";

const reportRoot = document.getElementById("reportRoot");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxCaption = document.getElementById("lightboxCaption");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
}

function display(value) {
  return value === undefined || value === null || value === "" ? "—" : escapeHtml(value);
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("ru-RU", withTime ? undefined : {day:"2-digit",month:"2-digit",year:"numeric"});
  } catch (_) {
    return escapeHtml(value);
  }
}

function totalScore(data) {
  return SCORES.reduce((sum, [key]) => sum + Number(data?.score?.[key] || 0), 0);
}

function renderRows(definitions, source = {}) {
  return definitions.map(([key, label]) => `<tr><td>${escapeHtml(label)}</td><td>${display(source?.[key])}</td></tr>`).join("");
}

function renderChecklist(data) {
  const groups = {};
  CHECKLIST.forEach(([key, label, group]) => {
    if (data?.check?.[key]) (groups[group] ||= []).push(label);
  });
  const entries = Object.entries(groups);
  if (!entries.length) return '<p class="empty">Нет отмеченных пунктов.</p>';
  return `<div class="check-grid">${entries.map(([group, labels]) => `
    <div class="check-group"><h4>${escapeHtml(group)}</h4><ul>${labels.map(label => `<li>${escapeHtml(label)}</li>`).join("")}</ul></div>`).join("")}</div>`;
}

function renderPhotos(locationId, photos) {
  let result = "";
  for (const [category, title] of PHOTO_CATEGORIES) {
    const items = photos.filter(photo => photo.location_id === locationId && (photo.category || "other") === category && photo.url);
    if (!items.length) continue;
    result += `<section class="photo-group"><h4>${escapeHtml(title)}</h4><div class="photos">${items.map(photo => `
      <figure class="photo">
        <button type="button" data-photo-url="${escapeHtml(photo.url)}" data-photo-caption="${escapeHtml(photo.caption || photo.original_name || title)}">
          <img loading="lazy" src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || title)}">
        </button>
        <figcaption>${escapeHtml(photo.caption || photo.original_name || "")}</figcaption>
      </figure>`).join("")}</div></section>`;
  }
  return result || '<p class="empty">Фотографии не добавлены.</p>';
}

function renderLocation(location, index, photos) {
  const data = location.form_data || {};
  const score = totalScore(data);
  const gps = data.gpsLat && data.gpsLon ? `${data.gpsLat}, ${data.gpsLon}` : "—";
  return `
    <article class="location">
      <div class="location-head">
        <div><span class="rank">Локация ${index + 1}</span><h2>${escapeHtml(location.title || location.address || "Без названия")}</h2><p>${escapeHtml(location.note || "")}</p></div>
        <div class="score">${score}<small>/ 70</small></div>
      </div>
      <div class="location-body">
        <div class="summary-grid">
          <div><b>Адрес:</b> ${display(location.address)}</div><div><b>Статус:</b> ${display(data.status || location.status)}</div>
          <div><b>Решение:</b> ${display(data.decision)}</div><div><b>Тип объекта:</b> ${display(data.objectTypeOther || data.objectType || location.object_type)}</div>
          <div><b>Дата:</b> ${display(data.date)}</div><div><b>Время:</b> ${display(data.time)}</div>
          <div><b>Аренда:</b> ${display(data.rent)}</div><div><b>Контакт:</b> ${display(data.contact)}</div>
          <div><b>GPS:</b> ${escapeHtml(gps)}</div><div><b>Обновлено:</b> ${formatDate(location.updated_at, true)}</div>
        </div>

        <h3>Полевой замер трафика</h3>
        <table><tbody>${renderRows(TRAFFIC_FIELDS, data.traffic)}</tbody></table>

        <h3>Оценка локации</h3>
        <table><tbody>${renderRows(SCORES, data.score)}</tbody></table>

        <h3>Технические и финансовые параметры</h3>
        <table><tbody>${renderRows(TECH_FIELDS, data.tech)}</tbody></table>

        <h3>Подтверждённые пункты чек-листа</h3>
        ${renderChecklist(data)}

        <h3>Конкуренты и окружение</h3>
        <div class="summary-grid">
          <div><b>Ближайший конкурент:</b> ${display(data?.competitor?.name)}</div>
          <div><b>Расстояние:</b> ${display(data?.competitor?.distance)}</div>
          <div><b>Сильные стороны:</b> ${display(data?.competitor?.strengths)}</div>
          <div><b>Слабые стороны:</b> ${display(data?.competitor?.weaknesses)}</div>
        </div>

        <div class="notes-grid">
          <div><h3>Плюсы</h3><p>${display(data.pros)}</p></div>
          <div><h3>Минусы</h3><p>${display(data.cons)}</p></div>
          <div><h3>Риски</h3><p>${display(data.risks)}</p></div>
          <div><h3>Что уточнить</h3><p>${display(data.questions)}</p></div>
          <div><h3>Идея формата</h3><p>${display(data.formatIdea)}</p></div>
          <div><h3>Заметки</h3><p>${display(data.notes)}</p></div>
        </div>

        <h3>Фотографии</h3>
        ${renderPhotos(location.id, photos)}
      </div>
    </article>`;
}

function renderReport(payload) {
  const snapshot = payload.snapshot || {};
  const project = snapshot.project || {};
  const global = snapshot.global || {};
  const locations = Array.isArray(snapshot.locations) ? snapshot.locations : [];
  const photos = Array.isArray(snapshot.photos) ? snapshot.photos : [];
  const inspected = locations.filter(location => {
    const data = location.form_data || {};
    return data.date || data.decision || totalScore(data) > 0 || location.updated_at;
  }).length;
  const best = Math.max(0, ...locations.map(location => totalScore(location.form_data || {})));

  document.title = `${payload.name || "Отчёт «Богатка»"}`;
  reportRoot.innerHTML = `
    <section class="cover">
      <h1>${escapeHtml(payload.name || project.name || "Отчёт по локациям «Богатка»")}</h1>
      <p><b>Инспектор:</b> ${display(global.inspector)}</p>
      <p><b>Общие заметки:</b> ${display(global.tripNotes)}</p>
      <div class="cover-meta">
        <div><strong>${inspected}</strong><span>осмотрено</span></div>
        <div><strong>${best}/70</strong><span>лучший балл</span></div>
        <div><strong>${formatDate(payload.created_at || snapshot.generated_at, true)}</strong><span>дата отчёта</span></div>
      </div>
    </section>
    ${locations.map((location, index) => renderLocation(location, index, photos)).join("") || '<section class="state-card"><h1>В отчёте пока нет локаций</h1></section>'}`;
}

function showError(message) {
  reportRoot.innerHTML = `<section class="state-card error-card"><h1>Не удалось открыть отчёт</h1><p>${escapeHtml(message)}</p><p>Ссылка могла быть отключена или срок её действия истёк.</p></section>`;
}

function openLightbox(url, caption) {
  lightboxImage.src = url;
  lightboxCaption.textContent = caption || "";
  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImage.removeAttribute("src");
  document.body.style.overflow = "";
}

async function loadReport() {
  const token = new URLSearchParams(location.search).get("token") || "";
  if (!token) return showError("В ссылке отсутствует токен отчёта.");
  try {
    const response = await fetch(`${REPORT_ENDPOINT}?token=${encodeURIComponent(token)}`, {headers:{Accept:"application/json"}});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Ошибка ${response.status}`);
    renderReport(payload);
  } catch (error) {
    showError(error.message || String(error));
  }
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-photo-url]");
  if (button) return openLightbox(button.dataset.photoUrl, button.dataset.photoCaption);
  if (event.target === lightbox || event.target.closest(".lightbox-close")) closeLightbox();
});

document.addEventListener("keydown", event => { if (event.key === "Escape") closeLightbox(); });

loadReport();

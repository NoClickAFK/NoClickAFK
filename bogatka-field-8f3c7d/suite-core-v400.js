(function () {
  if (window.BogatkaSuite) return;

  const VERSION = "4.0.0";
  const MAX_ACTIVITY = 300;
  const PHOTO_PLAN = {
    street: 3,
    entrance: 3,
    parking: 2,
    traffic: 2,
    competitors: 2,
    interior: 5,
    storage: 2,
    engineering: 3,
    documents: 2,
    other: 0,
  };
  const LAUNCH_MILESTONES = [
    "Договор аренды подписан",
    "Техническое обследование завершено",
    "Планировка и дизайн утверждены",
    "Смета ремонта согласована",
    "Ремонт завершён",
    "Вывеска согласована и заказана",
    "Торговое оборудование установлено",
    "Интернет, касса, охрана и видеонаблюдение подключены",
    "Персонал подобран и обучен",
    "Поставщики и стартовый ассортимент согласованы",
    "Первая поставка принята",
    "Магазин готов к открытию",
  ];

  let suppressHistory = 0;
  let photoDeleteWrapperInstalled = false;

  const nowIso = () => new Date().toISOString();
  const trimText = (value, limit = 180) => {
    const text = String(value ?? "").trim();
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  };
  const sameValue = (left, right) => JSON.stringify(left ?? "") === JSON.stringify(right ?? "");

  function currentActor() {
    const user = typeof cloudSession !== "undefined" ? cloudSession?.user : null;
    const email = user?.email || "";
    const name = user?.user_metadata?.display_name
      || user?.user_metadata?.full_name
      || document.querySelector('[data-global="inspector"]')?.value?.trim()
      || email
      || "Локальный пользователь";
    return { id: user?.id || "local", name, email };
  }

  function appendActivityToData(data, entry) {
    if (suppressHistory) return;
    const actor = currentActor();
    const activity = Array.isArray(data.activity) ? [...data.activity] : [];
    const at = nowIso();
    const previous = activity.at(-1);
    const canMerge = previous
      && entry.field
      && previous.field === entry.field
      && previous.action === entry.action
      && previous.actorId === actor.id
      && Date.now() - new Date(previous.at).getTime() < 120000;

    const next = {
      id: canMerge ? previous.id : crypto.randomUUID(),
      at,
      actorId: actor.id,
      actor: actor.name,
      actorEmail: actor.email,
      action: entry.action || "Изменение",
      field: entry.field || "",
      label: entry.label || "",
      from: trimText(entry.from),
      to: trimText(entry.to),
      details: trimText(entry.details, 300),
    };

    if (canMerge) activity[activity.length - 1] = { ...previous, ...next, from: previous.from };
    else activity.push(next);
    data.activity = activity.slice(-MAX_ACTIVITY);
  }

  async function appendActivity(locationId, entry) {
    if (!locationId || suppressHistory) return;
    const data = await getLocationData(locationId);
    appendActivityToData(data, entry);
    data.updatedAt = nowIso();
    await idbPut(STORE, data, `location:${locationId}`);
  }

  function fieldLabel(element, path) {
    if (path === "decision") return "Итоговое решение";
    const label = element.closest("label")?.childNodes?.[0]?.textContent?.trim();
    return label || path;
  }

  function ensureLaunchProject(data) {
    data.launchProject ||= {};
    if (!data.launchProject.enabled) {
      const actor = currentActor();
      data.launchProject = {
        enabled: true,
        createdAt: nowIso(),
        createdBy: actor.name,
        stage: "Подготовка договора",
        targetDate: "",
        manager: actor.name,
        budget: "",
        notes: "",
        milestones: LAUNCH_MILESTONES.map((title, index) => ({
          id: crypto.randomUUID(),
          title,
          order: index,
          status: "todo",
          assignee: "",
          dueDate: "",
          note: "",
        })),
      };
      appendActivityToData(data, {
        action: "Создан проект открытия",
        label: "Проект открытия",
        details: "Локация переведена в режим подготовки магазина.",
      });
    }
    return data.launchProject;
  }

  function parseNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;
    const normalized = value.replace(/\s+/g, "").replace(",", ".");
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function calculateEconomy(data = {}) {
    const economy = data.economy || {};
    const revenue = parseNumber(economy.monthlyRevenue) || 0;
    const grossMarginPct = parseNumber(economy.grossMarginPct) || 0;
    const taxRatePct = parseNumber(economy.taxRatePct) || 0;
    const area = parseNumber(data?.tech?.totalArea) || 0;
    const rent = parseNumber(data?.tech?.rentPerMonth) ?? parseNumber(data.rent) ?? 0;
    const utilities = parseNumber(data?.tech?.utilities) ?? parseNumber(economy.utilities) ?? 0;
    const payroll = parseNumber(economy.payroll) || 0;
    const marketing = parseNumber(economy.marketing) || 0;
    const logistics = parseNumber(economy.logistics) || 0;
    const otherOpex = parseNumber(economy.otherOpex) || 0;
    const repair = parseNumber(data?.tech?.repairEstimate) || 0;
    const equipment = parseNumber(data?.tech?.equipmentEstimate) || 0;
    const deposit = parseNumber(data?.tech?.deposit) || 0;
    const initialStock = parseNumber(economy.initialStock) || 0;
    const openingOther = parseNumber(economy.openingOther) || 0;
    const workingCapital = parseNumber(economy.workingCapital) || 0;
    const openingInvestmentOverride = parseNumber(economy.openingInvestmentOverride);

    const grossProfit = revenue * grossMarginPct / 100;
    const taxes = revenue * taxRatePct / 100;
    const fixedCosts = rent + utilities + payroll + marketing + logistics + otherOpex;
    const operatingProfit = grossProfit - taxes - fixedCosts;
    const contributionRate = Math.max(0, (grossMarginPct - taxRatePct) / 100);
    const breakEvenRevenue = contributionRate > 0 ? fixedCosts / contributionRate : null;
    const openingInvestmentCalculated = repair + equipment + deposit + initialStock + openingOther + workingCapital;
    const openingInvestment = openingInvestmentOverride ?? openingInvestmentCalculated;
    const paybackMonths = operatingProfit > 0 && openingInvestment > 0 ? openingInvestment / operatingProfit : null;
    const rentPerSqm = area > 0 ? rent / area : null;
    const rentBurdenPct = revenue > 0 ? rent / revenue * 100 : null;
    const operatingMarginPct = revenue > 0 ? operatingProfit / revenue * 100 : null;

    let status = "empty";
    let statusText = "Недостаточно данных";
    if (revenue > 0 && grossMarginPct > 0) {
      if (operatingProfit <= 0) { status = "danger"; statusText = "Экономика не сходится"; }
      else if ((rentBurdenPct ?? 0) > 18 || (paybackMonths ?? 0) > 36) { status = "risk"; statusText = "Высокая нагрузка"; }
      else if ((rentBurdenPct ?? 100) <= 12 && (paybackMonths ?? 100) <= 24) { status = "good"; statusText = "Рабочая экономика"; }
      else { status = "medium"; statusText = "Требует оптимизации"; }
    }

    return {
      revenue, grossMarginPct, taxRatePct, area, rent, utilities, payroll, marketing, logistics, otherOpex,
      repair, equipment, deposit, initialStock, openingOther, workingCapital,
      grossProfit, taxes, fixedCosts, operatingProfit, contributionRate, breakEvenRevenue,
      openingInvestmentCalculated, openingInvestment, paybackMonths, rentPerSqm, rentBurdenPct,
      operatingMarginPct, status, statusText,
    };
  }

  function photoPlanFor(locationId, photos) {
    const locationPhotos = photos.filter(photo => photo.locationId === locationId);
    const counts = {};
    for (const photo of locationPhotos) counts[photo.category || "other"] = (counts[photo.category || "other"] || 0) + 1;
    const requiredTotal = Object.values(PHOTO_PLAN).reduce((sum, count) => sum + count, 0);
    const completed = Object.entries(PHOTO_PLAN).reduce((sum, [category, required]) => sum + Math.min(required, counts[category] || 0), 0);
    const percent = requiredTotal ? Math.round(completed / requiredTotal * 100) : 100;
    const missing = Object.entries(PHOTO_PLAN)
      .filter(([, required]) => required > 0)
      .map(([category, required]) => ({ category, required, count: counts[category] || 0, missing: Math.max(0, required - (counts[category] || 0)) }))
      .filter(item => item.missing > 0);
    return { counts, total: locationPhotos.length, completed, requiredTotal, percent, missing };
  }

  function normalizeAddress(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\b(республика беларусь|беларусь|гродненская область|г\.\s*гродно|город\s+гродно|гродно)\b/g, " ")
      .replace(/\b(улица|ул\.?|проспект|пр-т|переулок|пер\.?|шоссе|бул\.?|бульвар)\b/g, " ")
      .replace(/[^a-zа-я0-9]+/gi, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function addressSimilarity(left, right) {
    const a = new Set(normalizeAddress(left).split(" ").filter(Boolean));
    const b = new Set(normalizeAddress(right).split(" ").filter(Boolean));
    if (!a.size || !b.size) return 0;
    const intersection = [...a].filter(token => b.has(token)).length;
    return intersection / Math.max(a.size, b.size);
  }

  function findAddressDuplicate(address, excludeId = "") {
    const normalized = normalizeAddress(address);
    if (!normalized) return null;
    let near = null;
    for (const item of locations) {
      if (item.id === excludeId) continue;
      const candidate = normalizeAddress(item.address);
      if (!candidate) continue;
      if (candidate === normalized) return { item, exact: true, similarity: 1 };
      const similarity = addressSimilarity(address, item.address);
      if (similarity >= 0.8 && (!near || similarity > near.similarity)) near = { item, exact: false, similarity };
    }
    return near;
  }

  async function saveFieldV400(element) {
    const id = element.dataset.location;
    const field = element.dataset.field;
    const data = await getLocationData(id);
    const previous = getNested(data, field);
    let value;
    if (element.type === "checkbox") value = element.checked;
    else if (element.type === "radio") { if (!element.checked) return; value = element.value; }
    else value = element.value;
    if (sameValue(previous, value)) { showSaved(); return; }

    setNested(data, field, value);
    if ((field === "status" || field === "decision") && value === "Оставить") ensureLaunchProject(data);
    appendActivityToData(data, {
      action: "Изменено поле",
      field,
      label: fieldLabel(element, field),
      from: previous,
      to: value,
    });
    data.updatedAt = nowIso();
    await idbPut(STORE, data, `location:${id}`);
    updateLocationTotal(id, data);
    await updateSummary();
    showSaved();
  }

  async function saveLocationFromModalV400() {
    const editId = document.querySelector("#editLocationId")?.value || "";
    const title = document.querySelector("#locationTitle")?.value.trim() || "";
    const address = document.querySelector("#locationAddress")?.value.trim() || "";
    const note = document.querySelector("#locationNote")?.value.trim() || "";
    if (!address) return alert("Укажите адрес для карты.");

    const duplicate = findAddressDuplicate(address, editId);
    if (duplicate?.exact) {
      alert(`Этот адрес уже есть в списке: «${duplicate.item.title || duplicate.item.address}».`);
      closeLocationModal();
      document.querySelector(`[data-location-card="${CSS.escape(duplicate.item.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (duplicate && !confirm(`Возможный дубль: «${duplicate.item.title || duplicate.item.address}». Всё равно сохранить новую локацию?`)) return;

    let targetId = editId;
    if (editId) {
      const index = locations.findIndex(item => item.id === editId);
      if (index >= 0) {
        const before = locations[index];
        locations[index] = { ...before, title: title || address, address, note };
        const data = await getLocationData(editId);
        appendActivityToData(data, {
          action: "Изменены реквизиты локации",
          label: "Адрес и название",
          from: `${before.title || ""} · ${before.address || ""}`,
          to: `${title || address} · ${address}`,
        });
        data.updatedAt = nowIso();
        await idbPut(STORE, data, `location:${editId}`);
      }
    } else {
      targetId = `custom-${crypto.randomUUID()}`;
      locations.push({ id: targetId, title: title || address, address, note, custom: true, createdAt: nowIso() });
      const data = { createdAt: nowIso(), updatedAt: nowIso() };
      appendActivityToData(data, { action: "Создана локация", label: "Новая локация", to: title || address, details: address });
      await idbPut(STORE, data, `location:${targetId}`);
    }
    await saveLocations();
    closeLocationModal();
    renderLocations();
    document.querySelector(`[data-location-card="${CSS.escape(targetId)}"]`)?.scrollIntoView({ behavior: "smooth" });
  }

  async function archiveLocation(id) {
    const item = locations.find(location => location.id === id);
    if (!item) return;
    if (!confirm(`Переместить локацию «${item.title || item.address}» в архив? Данные и фотографии сохранятся.`)) return;
    const data = await getLocationData(id);
    const actor = currentActor();
    data.archivedAt = nowIso();
    data.archivedBy = actor.name;
    appendActivityToData(data, { action: "Локация архивирована", label: "Архив", details: item.title || item.address });
    data.updatedAt = nowIso();
    item.archivedAt = data.archivedAt;
    await idbPut(STORE, data, `location:${id}`);
    await saveLocations();
    renderLocations();
  }

  async function restoreArchivedLocation(id) {
    const item = locations.find(location => location.id === id);
    if (!item) return;
    const data = await getLocationData(id);
    const previous = data.archivedAt;
    delete data.archivedAt;
    delete data.archivedBy;
    delete item.archivedAt;
    appendActivityToData(data, { action: "Локация восстановлена из архива", label: "Архив", from: previous, to: "Активна" });
    data.updatedAt = nowIso();
    await idbPut(STORE, data, `location:${id}`);
    await saveLocations();
    renderLocations();
  }

  async function permanentlyDeleteArchived(id) {
    const item = locations.find(location => location.id === id);
    const data = await getLocationData(id);
    if (!item || !data.archivedAt) return;
    if (!confirm(`Удалить «${item.title || item.address}» окончательно вместе со всеми фотографиями? Это действие нельзя отменить.`)) return;
    suppressHistory += 1;
    try {
      const photos = (await idbAll(PHOTO_STORE)).filter(photo => photo.locationId === id);
      for (const photo of photos) await idbDelete(PHOTO_STORE, photo.id);
      await idbDelete(STORE, `location:${id}`);
      await idbDelete(STORE, `undo:${id}`);
      locations = locations.filter(location => location.id !== id);
      await saveLocations();
    } finally {
      suppressHistory -= 1;
    }
    renderLocations();
  }

  async function addComment(locationId, text) {
    const value = String(text || "").trim();
    if (!value) return;
    const data = await getLocationData(locationId);
    const actor = currentActor();
    data.comments ||= [];
    data.comments.push({ id: crypto.randomUUID(), text: value, author: actor.name, authorEmail: actor.email, userId: actor.id, createdAt: nowIso() });
    appendActivityToData(data, { action: "Добавлен комментарий", label: "Комментарии", details: value });
    data.updatedAt = nowIso();
    await idbPut(STORE, data, `location:${locationId}`);
    await updateSummary();
  }

  async function deleteComment(locationId, commentId) {
    const data = await getLocationData(locationId);
    const comment = (data.comments || []).find(item => item.id === commentId);
    data.comments = (data.comments || []).filter(item => item.id !== commentId);
    appendActivityToData(data, { action: "Удалён комментарий", label: "Комментарии", details: comment?.text || "" });
    data.updatedAt = nowIso();
    await idbPut(STORE, data, `location:${locationId}`);
    await updateSummary();
  }

  async function addTask(locationId, task) {
    const title = String(task?.title || "").trim();
    if (!title) return;
    const data = await getLocationData(locationId);
    const actor = currentActor();
    data.tasks ||= [];
    data.tasks.push({
      id: crypto.randomUUID(), title, assignee: String(task.assignee || "").trim(), dueDate: task.dueDate || "",
      priority: task.priority || "normal", status: "todo", note: String(task.note || "").trim(),
      createdAt: nowIso(), createdBy: actor.name, completedAt: "",
    });
    appendActivityToData(data, { action: "Создана задача", label: "Задачи", details: title });
    data.updatedAt = nowIso();
    await idbPut(STORE, data, `location:${locationId}`);
    await updateSummary();
  }

  async function updateTask(locationId, taskId, patch) {
    const data = await getLocationData(locationId);
    const task = (data.tasks || []).find(item => item.id === taskId);
    if (!task) return;
    const previousStatus = task.status;
    Object.assign(task, patch, { updatedAt: nowIso() });
    if (patch.status === "done" && previousStatus !== "done") task.completedAt = nowIso();
    if (patch.status && patch.status !== "done") task.completedAt = "";
    appendActivityToData(data, { action: "Изменена задача", field: `task.${taskId}`, label: task.title, from: previousStatus, to: patch.status || "обновлена" });
    data.updatedAt = nowIso();
    await idbPut(STORE, data, `location:${locationId}`);
    await updateSummary();
  }

  async function deleteTask(locationId, taskId) {
    const data = await getLocationData(locationId);
    const task = (data.tasks || []).find(item => item.id === taskId);
    data.tasks = (data.tasks || []).filter(item => item.id !== taskId);
    appendActivityToData(data, { action: "Удалена задача", label: "Задачи", details: task?.title || "" });
    data.updatedAt = nowIso();
    await idbPut(STORE, data, `location:${locationId}`);
    await updateSummary();
  }

  async function saveEconomyField(locationId, key, value) {
    const data = await getLocationData(locationId);
    data.economy ||= {};
    const previous = data.economy[key];
    data.economy[key] = value;
    appendActivityToData(data, { action: "Изменена экономика", field: `economy.${key}`, label: key, from: previous, to: value });
    data.updatedAt = nowIso();
    await idbPut(STORE, data, `location:${locationId}`);
    await updateSummary();
  }

  async function saveLaunchField(locationId, path, value) {
    const data = await getLocationData(locationId);
    const project = ensureLaunchProject(data);
    const previous = getNested(project, path);
    setNested(project, path, value);
    appendActivityToData(data, { action: "Изменён проект открытия", field: `launchProject.${path}`, label: path, from: previous, to: value });
    data.updatedAt = nowIso();
    await idbPut(STORE, data, `location:${locationId}`);
    await updateSummary();
  }

  async function updateMilestone(locationId, milestoneId, patch) {
    const data = await getLocationData(locationId);
    const project = ensureLaunchProject(data);
    const milestone = project.milestones?.find(item => item.id === milestoneId);
    if (!milestone) return;
    const previousStatus = milestone.status;
    Object.assign(milestone, patch, { updatedAt: nowIso() });
    if (patch.status === "done" && previousStatus !== "done") milestone.completedAt = nowIso();
    if (patch.status && patch.status !== "done") milestone.completedAt = "";
    appendActivityToData(data, { action: "Изменён этап открытия", field: `milestone.${milestoneId}`, label: milestone.title, from: previousStatus, to: patch.status || "обновлён" });
    data.updatedAt = nowIso();
    await idbPut(STORE, data, `location:${locationId}`);
    await updateSummary();
  }

  async function withSuppressedHistory(callback) {
    suppressHistory += 1;
    try { return await callback(); }
    finally { suppressHistory -= 1; }
  }

  function installPhotoDeleteHistoryWrapper() {
    if (photoDeleteWrapperInstalled || typeof idbDelete !== "function") return;
    photoDeleteWrapperInstalled = true;
    const baseDelete = idbDelete;
    const wrapped = async function (store, key) {
      let photo = null;
      if (!suppressHistory && store === PHOTO_STORE && !(typeof cloudApplyingRemote !== "undefined" && cloudApplyingRemote)) {
        try { photo = await idbGet(PHOTO_STORE, key); } catch (_) {}
      }
      const result = await baseDelete(store, key);
      if (photo?.locationId && !suppressHistory) {
        await appendActivity(photo.locationId, {
          action: "Удалена фотография",
          label: "Фотографии",
          details: `${photo.category || "other"}: ${photo.caption || photo.originalName || "photo"}`,
        });
      }
      return result;
    };
    window.idbDelete = wrapped;
    try { idbDelete = wrapped; } catch (_) {}
  }

  function installFunctionOverrides() {
    window.saveField = saveFieldV400;
    try { saveField = saveFieldV400; } catch (_) {}
    window.saveLocationFromModal = saveLocationFromModalV400;
    try { saveLocationFromModal = saveLocationFromModalV400; } catch (_) {}

    const baseGps = typeof saveGps === "function" ? saveGps : null;
    if (baseGps && !baseGps.__v400) {
      const wrappedGps = function (id) {
        const before = getLocationData(id);
        const result = baseGps(id);
        Promise.resolve(result).then(async () => {
          setTimeout(async () => {
            const previous = await before;
            const current = await getLocationData(id);
            if (current.gpsLat && current.gpsLon && (!previous.gpsLat || previous.gpsLat !== current.gpsLat || previous.gpsLon !== current.gpsLon)) {
              await appendActivity(id, { action: "Сохранена геопозиция", label: "GPS", to: `${current.gpsLat}, ${current.gpsLon}` });
            }
          }, 800);
        });
        return result;
      };
      wrappedGps.__v400 = true;
      window.saveGps = wrappedGps;
      try { saveGps = wrappedGps; } catch (_) {}
    }

    const basePhotos = typeof handlePhotoFiles === "function" ? handlePhotoFiles : null;
    if (basePhotos && !basePhotos.__v400) {
      const wrappedPhotos = async function (input) {
        const locationId = input.dataset.photoLocation;
        const category = input.dataset.photoCategory || "other";
        const count = input.files?.length || 0;
        await basePhotos(input);
        if (count) await appendActivity(locationId, { action: "Добавлены фотографии", label: "Фотографии", details: `${category}: ${count}` });
      };
      wrappedPhotos.__v400 = true;
      window.handlePhotoFiles = wrappedPhotos;
      try { handlePhotoFiles = wrappedPhotos; } catch (_) {}
    }

    const archiveDelete = async function () {
      const id = document.querySelector("#editLocationId")?.value || "";
      if (id) await archiveLocation(id);
      closeLocationModal();
    };
    window.deleteCustomLocation = archiveDelete;
    try { deleteCustomLocation = archiveDelete; } catch (_) {}
  }

  function enhanceDecisionEngine() {
    const engine = window.BogatkaDecisionEngine;
    if (!engine || engine.__suiteV400) return;
    const baseCompute = engine.computeAll.bind(engine);
    engine.computeAllIncludingArchived = baseCompute;
    engine.computeAll = async function () {
      const photos = await idbAll(PHOTO_STORE);
      const metrics = await baseCompute();
      const active = [];
      for (const metric of metrics) {
        const plan = photoPlanFor(metric.id, photos);
        metric.photoPlan = plan;
        metric.economy = calculateEconomy(metric.data);
        metric.archived = Boolean(metric.data.archivedAt);
        if (metric.sections) {
          metric.sections.photos = plan.percent / 100;
          metric.completion = Math.round((
            (metric.sections.basic || 0) * 0.20
            + (metric.sections.scores || 0) * 0.25
            + (metric.sections.technical || 0) * 0.15
            + (metric.sections.photos || 0) * 0.20
            + (metric.sections.stops || 0) * 0.10
            + (metric.sections.conclusion || 0) * 0.10
          ) * 100);
        }
        if (metric.economy.revenue > 0 && metric.economy.grossMarginPct > 0) {
          if (metric.economy.operatingProfit <= 0 && !metric.blocks) metric.recommendation = { label: "Экономика не сходится", className: "stop", reason: "Прогнозная операционная прибыль отрицательная." };
          else if ((metric.economy.rentBurdenPct ?? 0) > 18 && !metric.blocks) metric.recommendation = { label: "Высокая аренда", className: "risk", reason: "Арендная нагрузка выше 18% прогнозной выручки." };
        }
        if (!metric.archived) active.push(metric);
      }
      active.sort((a, b) => a.blocks - b.blocks || a.risks - b.risks || b.weighted - a.weighted || b.completion - a.completion || a.originalIndex - b.originalIndex);
      active.forEach((metric, index) => { metric.rank = index + 1; });
      return active;
    };
    engine.__suiteV400 = true;
  }

  window.BogatkaSuite = {
    VERSION, PHOTO_PLAN, LAUNCH_MILESTONES,
    currentActor, appendActivity, appendActivityToData, ensureLaunchProject,
    calculateEconomy, photoPlanFor, normalizeAddress, addressSimilarity, findAddressDuplicate,
    archiveLocation, restoreArchivedLocation, permanentlyDeleteArchived,
    addComment, deleteComment, addTask, updateTask, deleteTask,
    saveEconomyField, saveLaunchField, updateMilestone,
    withSuppressedHistory, installPhotoDeleteHistoryWrapper, installFunctionOverrides,
    enhanceDecisionEngine,
  };

  installFunctionOverrides();
  enhanceDecisionEngine();
  setTimeout(() => {
    installFunctionOverrides();
    installPhotoDeleteHistoryWrapper();
    enhanceDecisionEngine();
  }, 1200);
})();

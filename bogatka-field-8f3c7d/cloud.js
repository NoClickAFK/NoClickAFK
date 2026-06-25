const CLOUD_SYNC_STATE_KEY = "bogatka_cloud_sync_state_v1";
const CLOUD_LAST_REPORT_KEY = "bogatka_cloud_last_report_v1";
const CLOUD_PROJECT_SLUG = "bogatka-grodno";

let cloudClient = null;
let cloudSession = null;
let cloudProjectId = null;
let cloudRole = null;
let cloudChannel = null;
let cloudSyncing = false;
let cloudApplyingRemote = false;
let cloudSyncTimer = null;
let cloudRealtimeTimer = null;
let cloudOriginalIdbPut = null;
let cloudOriginalIdbDelete = null;
let cloudOriginalIdbClear = null;

function cloudReadState() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_SYNC_STATE_KEY) || "{}") || {};
  } catch (_) {
    return {};
  }
}

function cloudWriteState(state) {
  localStorage.setItem(CLOUD_SYNC_STATE_KEY, JSON.stringify(state));
}

function cloudMutateState(mutator) {
  const state = cloudReadState();
  state.dirtyLocations ||= [];
  state.dirtyPhotos ||= [];
  state.deletedPhotos ||= {};
  state.knownLocationIds ||= [];
  state.knownPhotoIds ||= [];
  mutator(state);
  cloudWriteState(state);
  return state;
}

function cloudMarkLocationDirty(id) {
  if (!id) return;
  cloudMutateState(state => {
    if (!state.dirtyLocations.includes(id)) state.dirtyLocations.push(id);
  });
  cloudScheduleSync();
}

function cloudMarkPhotoDirty(id) {
  if (!id) return;
  cloudMutateState(state => {
    if (!state.dirtyPhotos.includes(id)) state.dirtyPhotos.push(id);
    delete state.deletedPhotos[id];
  });
  cloudScheduleSync();
}

function cloudMarkGlobalDirty() {
  cloudMutateState(state => { state.stateDirty = true; });
  cloudScheduleSync();
}

function cloudMarkMetaDirty() {
  cloudMutateState(state => { state.metaDirty = true; });
  cloudScheduleSync();
}

function cloudInstallTracking() {
  if (cloudOriginalIdbPut) return;
  cloudOriginalIdbPut = idbPut;
  cloudOriginalIdbDelete = idbDelete;
  cloudOriginalIdbClear = idbClear;

  idbPut = async function trackedIdbPut(store, value, key) {
    const result = await cloudOriginalIdbPut(store, value, key);
    if (!cloudApplyingRemote) {
      if (store === STORE && typeof key === "string") {
        if (key === "global") cloudMarkGlobalDirty();
        else if (key === "meta:locations") cloudMarkMetaDirty();
        else if (key.startsWith("location:")) cloudMarkLocationDirty(key.slice("location:".length));
      } else if (store === PHOTO_STORE && value?.id) {
        cloudMarkPhotoDirty(value.id);
      }
    }
    return result;
  };

  idbDelete = async function trackedIdbDelete(store, key) {
    let existing = null;
    if (!cloudApplyingRemote && store === PHOTO_STORE) {
      try { existing = await idbGet(PHOTO_STORE, key); } catch (_) {}
    }
    const result = await cloudOriginalIdbDelete(store, key);
    if (!cloudApplyingRemote && store === PHOTO_STORE) {
      cloudMutateState(state => {
        state.deletedPhotos[key] = existing?.storagePath || null;
        state.dirtyPhotos = (state.dirtyPhotos || []).filter(id => id !== key);
      });
      cloudScheduleSync();
    }
    return result;
  };

  idbClear = async function trackedIdbClear(store) {
    const result = await cloudOriginalIdbClear(store);
    if (!cloudApplyingRemote) {
      cloudMutateState(state => {
        state.localResetAt = new Date().toISOString();
        state.dirtyLocations = [];
        state.dirtyPhotos = [];
        state.deletedPhotos = {};
        state.stateDirty = false;
        state.metaDirty = false;
      });
    }
    return result;
  };
}

function cloudSetMessage(text = "", type = "info") {
  const target = document.querySelector("#cloudMessage");
  if (!target) return;
  target.textContent = text;
  target.className = `cloud-message ${text ? "show" : ""} ${type}`;
}

function cloudFormatTime(value) {
  if (!value) return "ещё не выполнялась";
  try { return new Date(value).toLocaleString("ru-RU"); } catch (_) { return value; }
}

function cloudSetStatus(status, detail = "") {
  const button = document.querySelector("#cloudSyncBtn");
  const indicator = document.querySelector("#cloudIndicator");
  const title = document.querySelector("#cloudStatusTitle");
  const subtitle = document.querySelector("#cloudStatusDetail");
  const state = cloudReadState();

  const labels = {
    signed_out: "Войти и синхронизировать",
    ready: "Облако: синхронизировано",
    syncing: "Синхронизация…",
    offline: "Облако: нет связи",
    error: "Облако: ошибка",
  };
  if (button) {
    button.textContent = labels[status] || "Облачная синхронизация";
    button.classList.remove("ready", "syncing", "error");
    if (["ready", "syncing", "error"].includes(status)) button.classList.add(status);
  }
  if (indicator) {
    indicator.className = `cloud-indicator ${status === "offline" ? "error" : status}`;
  }
  if (title) title.textContent = labels[status] || "Облачная синхронизация";
  if (subtitle) subtitle.textContent = detail || (status === "ready" ? `Последняя синхронизация: ${cloudFormatTime(state.lastSyncAt)}` : "");

  const pill = document.querySelector("#cloudTopPill");
  if (pill) {
    pill.className = `pill cloud-sync-pill ${status}`;
    pill.textContent = status === "ready" ? "Облако синхронизировано" : labels[status] || "Облако";
  }
}

function cloudRoleLabel(role) {
  return ({ owner:"Владелец", editor:"Редактор", viewer:"Наблюдатель" })[role] || role || "—";
}

function cloudRenderModal() {
  const modal = document.querySelector("#cloudModal .modal-card");
  if (!modal) return;

  if (!cloudSession) {
    modal.innerHTML = `
      <h2>Облачная синхронизация</h2>
      <div class="cloud-panel">
        <p class="cloud-copy">Войдите под своей учётной записью. После входа данные, фотографии и локации будут доступны на телефоне и компьютере.</p>
        <div class="cloud-auth-tabs">
          <button type="button" class="active" data-cloud-tab="login">Вход</button>
          <button type="button" data-cloud-tab="signup">Создать аккаунт</button>
        </div>
        <form class="cloud-form" id="cloudAuthForm">
          <label class="field cloud-name-field hidden">Имя
            <input type="text" id="cloudDisplayName" autocomplete="name" placeholder="Имя участника">
          </label>
          <label class="field">Email
            <input type="email" id="cloudEmail" autocomplete="email" required placeholder="name@example.com">
          </label>
          <label class="field">Пароль
            <input type="password" id="cloudPassword" autocomplete="current-password" minlength="6" required placeholder="Минимум 6 символов">
          </label>
          <button class="btn" id="cloudAuthSubmit" type="submit">Войти</button>
        </form>
        <div class="cloud-message" id="cloudMessage"></div>
        <div class="help"><b>Первый вошедший пользователь</b> становится владельцем проекта. Остальных участников владелец добавляет по email.</div>
      </div>
      <div class="modal-actions"><button class="btn secondary" data-close-cloud>Закрыть</button></div>`;

    let mode = "login";
    const tabs = modal.querySelectorAll("[data-cloud-tab]");
    const form = modal.querySelector("#cloudAuthForm");
    const nameField = modal.querySelector(".cloud-name-field");
    const submit = modal.querySelector("#cloudAuthSubmit");
    tabs.forEach(tab => tab.addEventListener("click", () => {
      mode = tab.dataset.cloudTab;
      tabs.forEach(item => item.classList.toggle("active", item === tab));
      nameField.classList.toggle("hidden", mode !== "signup");
      submit.textContent = mode === "signup" ? "Создать аккаунт" : "Войти";
      modal.querySelector("#cloudPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
      cloudSetMessage();
    }));
    form.addEventListener("submit", event => cloudHandleAuth(event, mode));
    modal.querySelectorAll("[data-close-cloud]").forEach(button => button.addEventListener("click", cloudCloseModal));
    return;
  }

  const lastReport = localStorage.getItem(CLOUD_LAST_REPORT_KEY) || "";
  modal.innerHTML = `
    <h2>Облачная синхронизация</h2>
    <div class="cloud-panel">
      <div class="cloud-user">
        <div class="cloud-user-meta">
          <b>${esc(cloudSession.user.email || "Пользователь")}</b>
          <span>${esc(cloudSession.user.user_metadata?.display_name || "")}</span>
          <span class="cloud-role">${esc(cloudRoleLabel(cloudRole))}</span>
        </div>
        <button class="btn secondary small" type="button" id="cloudSignOutBtn">Выйти</button>
      </div>

      <div class="cloud-status-card">
        <div><strong id="cloudStatusTitle">Облачная синхронизация</strong><small id="cloudStatusDetail">Подготовка…</small></div>
        <span class="cloud-indicator" id="cloudIndicator"></span>
      </div>

      <div class="cloud-actions">
        <button class="btn" type="button" id="cloudSyncNowBtn">Синхронизировать сейчас</button>
        <button class="btn premium-share" type="button" id="cloudPublishBtn">Создать ссылку на отчёт</button>
      </div>

      <div class="cloud-report-link ${lastReport ? "" : "hidden"}" id="cloudReportLinkBox">
        <input type="text" id="cloudReportLink" readonly value="${esc(lastReport)}">
        <button class="btn secondary" type="button" id="cloudCopyReportBtn">Копировать</button>
      </div>

      <div class="cloud-section ${cloudRole === "owner" ? "" : "hidden"}">
        <h3>Участники проекта</h3>
        <p class="cloud-copy">Пользователь должен сначала создать аккаунт в этом приложении. После этого добавьте его по email.</p>
        <form class="cloud-form" id="cloudInviteForm">
          <div class="grid-2">
            <label class="field">Email участника<input type="email" id="cloudInviteEmail" required placeholder="name@example.com"></label>
            <label class="field">Роль<select id="cloudInviteRole"><option value="editor">Редактор</option><option value="viewer">Наблюдатель</option><option value="owner">Владелец</option></select></label>
          </div>
          <button class="btn secondary" type="submit">Добавить участника</button>
        </form>
        <div class="cloud-members" id="cloudMembers"><span>Загрузка…</span></div>
      </div>

      <div class="cloud-message" id="cloudMessage"></div>
      <p class="cloud-danger-note">Локальная резервная копия остаётся дополнительной страховкой. Облачная синхронизация не заменяет контрольную копию после выездного дня.</p>
    </div>
    <div class="modal-actions"><button class="btn secondary" data-close-cloud>Закрыть</button></div>`;

  modal.querySelector("#cloudSignOutBtn")?.addEventListener("click", cloudSignOut);
  modal.querySelector("#cloudSyncNowBtn")?.addEventListener("click", () => cloudSyncAll({manual:true}).catch(cloudHandleError));
  modal.querySelector("#cloudPublishBtn")?.addEventListener("click", () => cloudPublishReport().catch(cloudHandleError));
  modal.querySelector("#cloudCopyReportBtn")?.addEventListener("click", cloudCopyLastReport);
  modal.querySelector("#cloudInviteForm")?.addEventListener("submit", cloudInviteMember);
  modal.querySelectorAll("[data-close-cloud]").forEach(button => button.addEventListener("click", cloudCloseModal));
  cloudLoadMembers().catch(cloudHandleError);
  cloudSetStatus(cloudSyncing ? "syncing" : "ready");
}

function cloudOpenModal() {
  document.querySelector("#cloudModal")?.classList.remove("hidden");
  cloudRenderModal();
}

function cloudCloseModal() {
  document.querySelector("#cloudModal")?.classList.add("hidden");
}

async function cloudHandleAuth(event, mode) {
  event.preventDefault();
  const email = document.querySelector("#cloudEmail")?.value.trim();
  const password = document.querySelector("#cloudPassword")?.value || "";
  const displayName = document.querySelector("#cloudDisplayName")?.value.trim() || "";
  if (!email || password.length < 6) return cloudSetMessage("Укажите email и пароль не короче 6 символов.", "error");

  cloudSetMessage(mode === "signup" ? "Создаю аккаунт…" : "Выполняю вход…", "info");
  if (mode === "signup") {
    const { data, error } = await cloudClient.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split("@")[0] },
        emailRedirectTo: `${location.origin}${location.pathname}`,
      },
    });
    if (error) return cloudSetMessage(error.message, "error");
    if (!data.session) {
      cloudSetMessage("Аккаунт создан. Подтвердите email по письму, затем вернитесь и войдите.", "success");
      return;
    }
  } else {
    const { error } = await cloudClient.auth.signInWithPassword({ email, password });
    if (error) return cloudSetMessage(error.message, "error");
  }
  cloudSetMessage("Вход выполнен. Запускаю синхронизацию…", "success");
}

async function cloudSignOut() {
  await cloudClient.auth.signOut();
  cloudSession = null;
  cloudProjectId = null;
  cloudRole = null;
  if (cloudChannel) await cloudClient.removeChannel(cloudChannel);
  cloudChannel = null;
  cloudSetStatus("signed_out");
  cloudRenderModal();
}

async function cloudEnsureProject() {
  if (!cloudSession) throw new Error("Сначала войдите в облачную учётную запись.");
  if (cloudProjectId && cloudRole) return cloudProjectId;

  const { data: projectId, error: claimError } = await cloudClient.rpc("claim_bogatka_project");
  if (claimError) throw new Error(claimError.message);
  cloudProjectId = projectId;

  const { data: member, error: memberError } = await cloudClient
    .from("project_members")
    .select("role")
    .eq("project_id", cloudProjectId)
    .eq("user_id", cloudSession.user.id)
    .single();
  if (memberError) throw new Error(memberError.message);
  cloudRole = member.role;
  return cloudProjectId;
}

function cloudScheduleSync(delay = 1600) {
  if (!cloudSession || cloudApplyingRemote) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => cloudSyncAll().catch(cloudHandleError), delay);
}

function cloudCleanFormData(data) {
  const copy = structuredClone(data || {});
  delete copy.cloudId;
  delete copy.cloudRevision;
  delete copy.cloudUpdatedAt;
  return copy;
}

function cloudDate(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

async function cloudFetchRemote() {
  const [locationsResult, photosResult, stateResult] = await Promise.all([
    cloudClient.from("locations").select("*").eq("project_id", cloudProjectId).is("archived_at", null).order("sort_order"),
    cloudClient.from("photos").select("*").eq("project_id", cloudProjectId).is("deleted_at", null).order("sort_order"),
    cloudClient.from("project_state").select("*").eq("project_id", cloudProjectId).maybeSingle(),
  ]);
  if (locationsResult.error) throw new Error(locationsResult.error.message);
  if (photosResult.error) throw new Error(photosResult.error.message);
  if (stateResult.error) throw new Error(stateResult.error.message);
  return {
    remoteLocations: locationsResult.data || [],
    remotePhotos: photosResult.data || [],
    remoteState: stateResult.data || null,
  };
}

async function cloudDownloadPhoto(remotePhoto) {
  const { data, error } = await cloudClient.storage.from(BOGATKA_SUPABASE.photoBucket).download(remotePhoto.storage_path);
  if (error) throw new Error(`Не удалось скачать фото: ${error.message}`);
  return data;
}

async function cloudApplyRemote(remoteLocations, remotePhotos, remoteState, syncState) {
  cloudApplyingRemote = true;
  let locationsChanged = false;
  try {
    const dirtyLocations = new Set(syncState.dirtyLocations || []);
    const dirtyPhotos = new Set(syncState.dirtyPhotos || []);
    const deletedPhotos = new Set(Object.keys(syncState.deletedPhotos || {}));
    const localLocationMap = new Map(locations.map(item => [item.id, item]));

    for (const remote of remoteLocations) {
      const clientId = remote.client_id || remote.id;
      const localMeta = localLocationMap.get(clientId);
      const localData = await idbGet(STORE, `location:${clientId}`) || {};
      const localNewer = cloudDate(localData.updatedAt) > cloudDate(remote.updated_at);
      if (!dirtyLocations.has(clientId) && !localNewer) {
        const nextMeta = {
          id: clientId,
          title: remote.title,
          address: remote.address || "",
          note: remote.note || "",
          custom: !DEFAULT_LOCATIONS.some(item => item.id === clientId),
          cloudId: remote.id,
          createdAt: remote.created_at,
          updatedAt: remote.updated_at,
        };
        if (localMeta) Object.assign(localMeta, nextMeta);
        else {
          locations.push(nextMeta);
          localLocationMap.set(clientId, nextMeta);
        }
        const nextData = {
          ...(remote.form_data || {}),
          cloudId: remote.id,
          cloudRevision: remote.revision,
          cloudUpdatedAt: remote.updated_at,
        };
        await cloudOriginalIdbPut(STORE, nextData, `location:${clientId}`);
        locationsChanged = true;
      }
    }

    const remoteClientIds = new Set(remoteLocations.map(item => item.client_id || item.id));
    const knownLocationIds = new Set(syncState.knownLocationIds || []);
    for (const localMeta of [...locations]) {
      if (!localMeta.cloudId) continue;
      if (!remoteClientIds.has(localMeta.id) && knownLocationIds.has(localMeta.id) && !dirtyLocations.has(localMeta.id)) {
        locations = locations.filter(item => item.id !== localMeta.id);
        await cloudOriginalIdbDelete(STORE, `location:${localMeta.id}`);
        locationsChanged = true;
      }
    }
    if (locationsChanged) await cloudOriginalIdbPut(STORE, locations, "meta:locations");

    if (remoteState && !syncState.stateDirty) {
      const localGlobal = await idbGet(STORE, "global") || {};
      if (cloudDate(remoteState.updated_at) >= cloudDate(localGlobal.updatedAt)) {
        await cloudOriginalIdbPut(STORE, { ...(remoteState.data || {}), cloudUpdatedAt: remoteState.updated_at }, "global");
      }
    }

    const localPhotos = await idbAll(PHOTO_STORE);
    const localPhotoMap = new Map(localPhotos.map(photo => [photo.id, photo]));
    const remotePhotoIds = new Set(remotePhotos.map(photo => photo.id));
    const knownPhotoIds = new Set(syncState.knownPhotoIds || []);

    for (const remotePhoto of remotePhotos) {
      if (deletedPhotos.has(remotePhoto.id)) continue;
      const local = localPhotoMap.get(remotePhoto.id);
      if (!local) {
        const blob = await cloudDownloadPhoto(remotePhoto);
        const clientId = remoteLocations.find(item => item.id === remotePhoto.location_id)?.client_id;
        if (!clientId) continue;
        await cloudOriginalIdbPut(PHOTO_STORE, {
          id: remotePhoto.id,
          locationId: clientId,
          category: remotePhoto.category || "other",
          caption: remotePhoto.caption || "",
          storagePath: remotePhoto.storage_path,
          cloudLocationId: remotePhoto.location_id,
          cloudSyncedAt: remotePhoto.updated_at,
          originalName: remotePhoto.original_name || "photo.jpg",
          width: remotePhoto.width,
          height: remotePhoto.height,
          size: remotePhoto.file_size || blob.size,
          createdAt: remotePhoto.created_at,
          blob,
        });
      } else if (!dirtyPhotos.has(remotePhoto.id)) {
        local.caption = remotePhoto.caption || "";
        local.category = remotePhoto.category || local.category || "other";
        local.storagePath = remotePhoto.storage_path;
        local.cloudLocationId = remotePhoto.location_id;
        local.cloudSyncedAt = remotePhoto.updated_at;
        await cloudOriginalIdbPut(PHOTO_STORE, local);
      }
    }

    for (const local of localPhotos) {
      if (local.storagePath && knownPhotoIds.has(local.id) && !remotePhotoIds.has(local.id) && !dirtyPhotos.has(local.id)) {
        await cloudOriginalIdbDelete(PHOTO_STORE, local.id);
      }
    }
  } finally {
    cloudApplyingRemote = false;
  }
  if (locationsChanged || remotePhotos.length) renderLocations();
  else await restoreAllForms();
}

async function cloudDeleteRemovedLocations(remoteLocations, syncState) {
  const currentIds = new Set(locations.map(item => item.id));
  const knownIds = new Set(syncState.knownLocationIds || []);
  const remoteByClient = new Map(remoteLocations.map(item => [item.client_id || item.id, item]));
  const deletedClientIds = [...knownIds].filter(id => !currentIds.has(id) && remoteByClient.has(id));
  for (const clientId of deletedClientIds) {
    const remote = remoteByClient.get(clientId);
    const { data: photoRows } = await cloudClient.from("photos").select("storage_path").eq("location_id", remote.id);
    const paths = (photoRows || []).map(row => row.storage_path).filter(Boolean);
    if (paths.length) await cloudClient.storage.from(BOGATKA_SUPABASE.photoBucket).remove(paths);
    const { error } = await cloudClient.from("locations").delete().eq("id", remote.id);
    if (error) throw new Error(error.message);
  }
}

async function cloudPushLocations(remoteLocations, syncState) {
  const remoteByClient = new Map(remoteLocations.map(item => [item.client_id || item.id, item]));
  const dirty = new Set(syncState.dirtyLocations || []);
  const pushRows = [];

  for (let index = 0; index < locations.length; index++) {
    const item = locations[index];
    const data = await getLocationData(item.id);
    const remote = remoteByClient.get(item.id);
    const localNewer = cloudDate(data.updatedAt || item.updatedAt || item.createdAt) > cloudDate(remote?.updated_at);
    const shouldPush = !remote || dirty.has(item.id) || syncState.metaDirty || localNewer;
    if (!shouldPush) continue;
    pushRows.push({
      project_id: cloudProjectId,
      client_id: item.id,
      title: item.title || item.address || "Без названия",
      address: item.address || null,
      note: item.note || null,
      status: data.status || null,
      object_type: data.objectType || null,
      form_data: cloudCleanFormData(data),
      sort_order: index,
      updated_by: cloudSession.user.id,
    });
  }

  let rows = remoteLocations;
  if (pushRows.length) {
    const { data, error } = await cloudClient
      .from("locations")
      .upsert(pushRows, { onConflict:"project_id,client_id" })
      .select("*");
    if (error) throw new Error(error.message);
    const updated = new Map(remoteLocations.map(item => [item.client_id || item.id, item]));
    for (const row of data || []) updated.set(row.client_id || row.id, row);
    rows = [...updated.values()];

    cloudApplyingRemote = true;
    try {
      for (const row of data || []) {
        const clientId = row.client_id || row.id;
        const localData = await getLocationData(clientId);
        await cloudOriginalIdbPut(STORE, {
          ...localData,
          cloudId: row.id,
          cloudRevision: row.revision,
          cloudUpdatedAt: row.updated_at,
        }, `location:${clientId}`);
        const meta = locations.find(item => item.id === clientId);
        if (meta) meta.cloudId = row.id;
      }
      await cloudOriginalIdbPut(STORE, locations, "meta:locations");
    } finally {
      cloudApplyingRemote = false;
    }
  }
  return rows;
}

async function cloudPushProjectState(remoteState, syncState) {
  const global = await idbGet(STORE, "global") || {};
  const hasContent = Object.keys(global).some(key => !key.startsWith("cloud"));
  const localNewer = cloudDate(global.updatedAt) > cloudDate(remoteState?.updated_at);
  if (!remoteState || syncState.stateDirty || localNewer || hasContent && !remoteState) {
    const { data, error } = await cloudClient
      .from("project_state")
      .upsert({ project_id:cloudProjectId, data:cloudCleanFormData(global), updated_by:cloudSession.user.id })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    cloudApplyingRemote = true;
    try {
      await cloudOriginalIdbPut(STORE, { ...global, cloudUpdatedAt:data.updated_at }, "global");
    } finally { cloudApplyingRemote = false; }
  }
}

async function cloudDeletePhotos(syncState) {
  const entries = Object.entries(syncState.deletedPhotos || {});
  for (const [id, rememberedPath] of entries) {
    let path = rememberedPath;
    if (!path) {
      const { data } = await cloudClient.from("photos").select("storage_path").eq("id", id).maybeSingle();
      path = data?.storage_path || null;
    }
    if (path) await cloudClient.storage.from(BOGATKA_SUPABASE.photoBucket).remove([path]);
    const { error } = await cloudClient.from("photos").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}

function cloudPhotoExtension(photo) {
  const type = photo.blob?.type || "image/jpeg";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
}

async function cloudPushPhotos(remoteLocations, remotePhotos, syncState) {
  const remotePhotoIds = new Set(remotePhotos.map(photo => photo.id));
  const dirty = new Set(syncState.dirtyPhotos || []);
  const remoteLocationByClient = new Map(remoteLocations.map(item => [item.client_id || item.id, item]));
  const localPhotos = await idbAll(PHOTO_STORE);

  for (const photo of localPhotos) {
    const locationRow = remoteLocationByClient.get(photo.locationId);
    if (!locationRow || !photo.blob) continue;
    const shouldPush = dirty.has(photo.id) || !remotePhotoIds.has(photo.id) || !photo.storagePath;
    if (!shouldPush) continue;

    const path = photo.storagePath || `${cloudProjectId}/${locationRow.id}/${photo.id}.${cloudPhotoExtension(photo)}`;
    const { error: uploadError } = await cloudClient.storage
      .from(BOGATKA_SUPABASE.photoBucket)
      .upload(path, photo.blob, { upsert:true, contentType:photo.blob.type || "image/jpeg", cacheControl:"3600" });
    if (uploadError) throw new Error(uploadError.message);

    const { data: row, error: rowError } = await cloudClient
      .from("photos")
      .upsert({
        id:photo.id,
        project_id:cloudProjectId,
        location_id:locationRow.id,
        category:photo.category || "other",
        caption:photo.caption || null,
        storage_path:path,
        original_name:photo.originalName || "photo.jpg",
        mime_type:photo.blob.type || "image/jpeg",
        width:photo.width || null,
        height:photo.height || null,
        file_size:photo.size || photo.blob.size,
        updated_by:cloudSession.user.id,
      })
      .select("*")
      .single();
    if (rowError) throw new Error(rowError.message);

    cloudApplyingRemote = true;
    try {
      await cloudOriginalIdbPut(PHOTO_STORE, {
        ...photo,
        storagePath:path,
        cloudLocationId:locationRow.id,
        cloudSyncedAt:row.updated_at,
      });
    } finally { cloudApplyingRemote = false; }
  }
}

async function cloudSyncAll({ manual = false } = {}) {
  if (cloudSyncing) return;
  if (!cloudSession) {
    cloudSetStatus("signed_out");
    if (manual) cloudOpenModal();
    return;
  }
  if (!navigator.onLine) {
    cloudSetStatus("offline", "Изменения сохранены на устройстве и будут отправлены после восстановления связи.");
    return;
  }

  cloudSyncing = true;
  cloudSetStatus("syncing", "Сверяю локации и фотографии…");
  try {
    await cloudEnsureProject();
    const syncState = cloudReadState();
    const { remoteLocations, remotePhotos, remoteState } = await cloudFetchRemote();

    await cloudApplyRemote(remoteLocations, remotePhotos, remoteState, syncState);
    await cloudDeleteRemovedLocations(remoteLocations, syncState);
    await cloudDeletePhotos(syncState);
    const finalLocations = await cloudPushLocations(remoteLocations, syncState);
    await cloudPushProjectState(remoteState, syncState);
    await cloudPushPhotos(finalLocations, remotePhotos, syncState);

    const refreshed = await cloudFetchRemote();
    const nextState = cloudReadState();
    nextState.dirtyLocations = [];
    nextState.dirtyPhotos = [];
    nextState.deletedPhotos = {};
    nextState.stateDirty = false;
    nextState.metaDirty = false;
    nextState.knownLocationIds = refreshed.remoteLocations.map(item => item.client_id || item.id);
    nextState.knownPhotoIds = refreshed.remotePhotos.map(item => item.id);
    nextState.lastSyncAt = new Date().toISOString();
    nextState.projectId = cloudProjectId;
    nextState.userId = cloudSession.user.id;
    cloudWriteState(nextState);

    await cloudSubscribeRealtime();
    cloudSetStatus("ready");
    cloudSetMessage("Синхронизация завершена.", "success");
    if (manual) await updateSummary();
  } catch (error) {
    cloudSetStatus("error", error.message || String(error));
    throw error;
  } finally {
    cloudSyncing = false;
  }
}

async function cloudSubscribeRealtime() {
  if (!cloudProjectId || cloudChannel) return;
  cloudChannel = cloudClient
    .channel(`bogatka-${cloudProjectId}`)
    .on("postgres_changes", { event:"*", schema:"public", table:"locations", filter:`project_id=eq.${cloudProjectId}` }, cloudHandleRealtime)
    .on("postgres_changes", { event:"*", schema:"public", table:"photos", filter:`project_id=eq.${cloudProjectId}` }, cloudHandleRealtime)
    .on("postgres_changes", { event:"*", schema:"public", table:"project_state", filter:`project_id=eq.${cloudProjectId}` }, cloudHandleRealtime)
    .subscribe();
}

function cloudHandleRealtime() {
  clearTimeout(cloudRealtimeTimer);
  cloudRealtimeTimer = setTimeout(() => cloudSyncAll().catch(cloudHandleError), 1200);
}

async function cloudLoadMembers() {
  const root = document.querySelector("#cloudMembers");
  if (!root || !cloudProjectId || cloudRole !== "owner") return;
  const { data: members, error } = await cloudClient
    .from("project_members")
    .select("user_id,role,created_at")
    .eq("project_id", cloudProjectId)
    .order("created_at");
  if (error) throw new Error(error.message);
  const ids = (members || []).map(item => item.user_id);
  let profiles = [];
  if (ids.length) {
    const result = await cloudClient.from("profiles").select("id,email,display_name").in("id", ids);
    if (result.error) throw new Error(result.error.message);
    profiles = result.data || [];
  }
  const profileMap = new Map(profiles.map(item => [item.id, item]));
  root.innerHTML = (members || []).map(member => {
    const profile = profileMap.get(member.user_id) || {};
    return `<div class="cloud-member"><span><b>${esc(profile.display_name || profile.email || member.user_id)}</b><small>${esc(profile.email || "")}</small></span><span class="cloud-role">${esc(cloudRoleLabel(member.role))}</span></div>`;
  }).join("") || "<span>Участников пока нет.</span>";
}

async function cloudInviteMember(event) {
  event.preventDefault();
  const email = document.querySelector("#cloudInviteEmail")?.value.trim();
  const role = document.querySelector("#cloudInviteRole")?.value || "editor";
  if (!email) return;
  cloudSetMessage("Добавляю участника…", "info");
  const { error } = await cloudClient.rpc("add_project_member_by_email", {
    p_project_id:cloudProjectId,
    p_email:email,
    p_role:role,
  });
  if (error) return cloudSetMessage(error.message, "error");
  document.querySelector("#cloudInviteEmail").value = "";
  cloudSetMessage("Участник добавлен.", "success");
  await cloudLoadMembers();
}

async function cloudBuildSnapshot() {
  const [{ data: project, error: projectError }, { data: remoteLocations, error: locationError }, { data: remotePhotos, error: photoError }, { data: state, error: stateError }] = await Promise.all([
    cloudClient.from("projects").select("id,name,slug,description,updated_at").eq("id", cloudProjectId).single(),
    cloudClient.from("locations").select("*").eq("project_id", cloudProjectId).is("archived_at", null).order("sort_order"),
    cloudClient.from("photos").select("*").eq("project_id", cloudProjectId).is("deleted_at", null).order("sort_order"),
    cloudClient.from("project_state").select("data,updated_at").eq("project_id", cloudProjectId).maybeSingle(),
  ]);
  if (projectError) throw new Error(projectError.message);
  if (locationError) throw new Error(locationError.message);
  if (photoError) throw new Error(photoError.message);
  if (stateError) throw new Error(stateError.message);
  return {
    version:1,
    generated_at:new Date().toISOString(),
    project,
    global:state?.data || {},
    locations:remoteLocations || [],
    photos:remotePhotos || [],
  };
}

async function cloudPublishReport() {
  if (!cloudSession) {
    cloudOpenModal();
    cloudSetMessage("Сначала войдите, чтобы создать постоянную ссылку на отчёт.", "info");
    return;
  }
  cloudSetMessage("Синхронизирую данные перед публикацией…", "info");
  await cloudSyncAll({manual:true});
  const snapshot = await cloudBuildSnapshot();
  const { data, error } = await cloudClient
    .from("reports")
    .insert({ project_id:cloudProjectId, name:`Отчёт «Богатка» от ${new Date().toLocaleDateString("ru-RU")}`, snapshot })
    .select("public_token")
    .single();
  if (error) throw new Error(error.message);
  const basePath = location.pathname.replace(/[^/]*$/, "");
  const link = `${location.origin}${basePath}report/?token=${encodeURIComponent(data.public_token)}`;
  localStorage.setItem(CLOUD_LAST_REPORT_KEY, link);
  cloudRenderModal();
  cloudSetMessage("Ссылка создана. Получатель сможет только просматривать отчёт.", "success");
  await cloudShareLink(link);
}

async function cloudShareLink(link) {
  if (navigator.share) {
    try {
      await navigator.share({ title:"Отчёт по локациям «Богатка»", text:"Отчёт доступен только для просмотра", url:link });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  await navigator.clipboard.writeText(link);
  alert("Ссылка на отчёт скопирована.");
}

async function cloudCopyLastReport() {
  const link = localStorage.getItem(CLOUD_LAST_REPORT_KEY);
  if (!link) return;
  await navigator.clipboard.writeText(link);
  cloudSetMessage("Ссылка скопирована.", "success");
}

function cloudReplaceButtons() {
  const oldCloud = document.querySelector("#cloudSyncBtn");
  if (oldCloud) {
    const next = oldCloud.cloneNode(true);
    oldCloud.replaceWith(next);
    next.addEventListener("click", () => {
      if (cloudSession) cloudSyncAll({manual:true}).catch(cloudHandleError);
      cloudOpenModal();
    });
  }

  const oldShare = document.querySelector("#shareReportBtn");
  if (oldShare) {
    const next = oldShare.cloneNode(true);
    next.textContent = "Поделиться отчётом по ссылке";
    oldShare.replaceWith(next);
    next.addEventListener("click", () => cloudPublishReport().catch(cloudHandleError));
  }
}

function cloudHandleError(error) {
  console.error(error);
  const message = error?.message || String(error);
  cloudSetStatus("error", message);
  cloudSetMessage(message, "error");
}

async function cloudWaitForDb() {
  for (let i = 0; i < 100; i++) {
    if (typeof db !== "undefined" && db) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("Локальная база приложения не инициализирована.");
}

async function cloudInit() {
  cloudReplaceButtons();
  const statusbar = document.querySelector(".statusbar");
  if (statusbar && !document.querySelector("#cloudTopPill")) {
    const pill = document.createElement("span");
    pill.id = "cloudTopPill";
    pill.className = "pill cloud-sync-pill signed_out";
    pill.textContent = "Облако: вход не выполнен";
    statusbar.appendChild(pill);
  }

  if (!window.BOGATKA_SUPABASE || !window.supabase?.createClient) {
    cloudSetStatus("error", "Не удалось загрузить модуль облака.");
    return;
  }
  await cloudWaitForDb();
  cloudInstallTracking();
  cloudClient = window.supabase.createClient(
    BOGATKA_SUPABASE.url,
    BOGATKA_SUPABASE.publishableKey,
    { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } }
  );

  const { data } = await cloudClient.auth.getSession();
  cloudSession = data.session;
  cloudClient.auth.onAuthStateChange((_event, session) => {
    cloudSession = session;
    setTimeout(async () => {
      if (session) {
        try {
          await cloudEnsureProject();
          cloudRenderModal();
          await cloudSyncAll();
        } catch (error) { cloudHandleError(error); }
      } else {
        cloudProjectId = null;
        cloudRole = null;
        cloudSetStatus("signed_out");
        cloudRenderModal();
      }
    }, 0);
  });

  if (cloudSession) {
    await cloudEnsureProject();
    cloudSetStatus(navigator.onLine ? "syncing" : "offline");
    cloudSyncAll().catch(cloudHandleError);
  } else {
    cloudSetStatus("signed_out");
  }

  window.cloudPublishReport = cloudPublishReport;
  window.cloudSyncAll = cloudSyncAll;
  window.addEventListener("online", () => cloudSyncAll().catch(cloudHandleError));
  window.addEventListener("offline", () => cloudSetStatus("offline"));
}

window.addEventListener("load", () => cloudInit().catch(cloudHandleError));

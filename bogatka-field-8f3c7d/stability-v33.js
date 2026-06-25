const bogatkaPhotoUrlSets = new Map();
let bogatkaRoleSelectObserver = null;
let bogatkaUiRestoreTimer = null;

function bogatkaStableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(bogatkaStableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${bogatkaStableStringify(value[key])}`).join(",")}}`;
}

function bogatkaCleanCloudFields(data) {
  const copy = structuredClone(data || {});
  delete copy.cloudId;
  delete copy.cloudRevision;
  delete copy.cloudUpdatedAt;
  return copy;
}

function bogatkaValuesEqual(left, right) {
  return bogatkaStableStringify(left) === bogatkaStableStringify(right);
}

function bogatkaCaptureUiState() {
  const openDetails = [];
  document.querySelectorAll('[data-location-card]').forEach(card => {
    const locationId = card.dataset.locationCard;
    [...card.querySelectorAll('details')].forEach((details, index) => {
      if (details.open) openDetails.push(`${locationId}:${index}`);
    });
  });
  const active = document.activeElement;
  const focus = active?.matches?.('[data-location][data-field],[data-global]') ? {
    location: active.dataset.location || "",
    field: active.dataset.field || "",
    global: active.dataset.global || "",
    start: typeof active.selectionStart === "number" ? active.selectionStart : null,
    end: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
  } : null;
  return { openDetails, focus, scrollX: window.scrollX, scrollY: window.scrollY };
}

function bogatkaRestoreUiState(state) {
  if (!state) return;
  const openSet = new Set(state.openDetails || []);
  document.querySelectorAll('[data-location-card]').forEach(card => {
    const locationId = card.dataset.locationCard;
    [...card.querySelectorAll('details')].forEach((details, index) => {
      details.open = openSet.has(`${locationId}:${index}`);
    });
  });
  if (state.focus) {
    let selector = "";
    if (state.focus.global) selector = `[data-global="${CSS.escape(state.focus.global)}"]`;
    else if (state.focus.location && state.focus.field) selector = `[data-location="${CSS.escape(state.focus.location)}"][data-field="${CSS.escape(state.focus.field)}"]`;
    const target = selector ? document.querySelector(selector) : null;
    if (target) {
      target.focus({ preventScroll:true });
      if (state.focus.start !== null && target.setSelectionRange) {
        try { target.setSelectionRange(state.focus.start, state.focus.end); } catch (_) {}
      }
    }
  }
  window.scrollTo(state.scrollX || 0, state.scrollY || 0);
}

if (typeof renderLocations === "function") {
  const bogatkaBaseRenderLocations = renderLocations;
  renderLocations = function bogatkaStableRenderLocations() {
    const state = bogatkaCaptureUiState();
    bogatkaBaseRenderLocations();
    clearTimeout(bogatkaUiRestoreTimer);
    requestAnimationFrame(() => bogatkaRestoreUiState(state));
    bogatkaUiRestoreTimer = setTimeout(() => bogatkaRestoreUiState(state), 180);
  };
}

async function bogatkaDecodeBlob(blob) {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(blob);
    return { source:bitmap, width:bitmap.width, height:bitmap.height, close:() => bitmap.close?.() };
  }
  const dataUrl = await blobToDataURL(blob);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
  return { source:image, width:image.naturalWidth, height:image.naturalHeight, close:() => {} };
}

async function bogatkaCreatePreviewBlob(blob) {
  const decoded = await bogatkaDecodeBlob(blob);
  const maxDimension = 720;
  const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha:false });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(decoded.source, 0, 0, width, height);
  decoded.close();
  return await new Promise((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error("Не удалось создать миниатюру фотографии.")), "image/jpeg", .78);
  });
}

async function bogatkaEnsurePreview(photo) {
  if (photo.previewBlob instanceof Blob && photo.previewBlob.size) return photo.previewBlob;
  if (!(photo.blob instanceof Blob) || !photo.blob.size) return null;
  try {
    photo.previewBlob = await bogatkaCreatePreviewBlob(photo.blob);
    const put = cloudOriginalIdbPut || idbPut;
    await put(PHOTO_STORE, photo);
    return photo.previewBlob;
  } catch (error) {
    console.warn("Не удалось создать миниатюру", error);
    return photo.blob;
  }
}

function bogatkaReleasePhotoUrls(rootKey) {
  const urls = bogatkaPhotoUrlSets.get(rootKey) || [];
  urls.forEach(url => {
    objectUrls.delete(url);
    try { URL.revokeObjectURL(url); } catch (_) {}
  });
  bogatkaPhotoUrlSets.delete(rootKey);
}

if (typeof revokeObjectUrls === "function") {
  const bogatkaBaseRevokeObjectUrls = revokeObjectUrls;
  revokeObjectUrls = function bogatkaStableRevokeObjectUrls() {
    bogatkaPhotoUrlSets.clear();
    bogatkaBaseRevokeObjectUrls();
  };
}

async function bogatkaRenderPhotoCategory(locationId, category) {
  const root = document.querySelector(`[data-photos="${CSS.escape(locationId)}:${CSS.escape(category)}"]`);
  if (!root) return;
  const rootKey = `${locationId}:${category}`;
  const renderToken = crypto.randomUUID();
  root.dataset.renderToken = renderToken;
  const photos = (await idbAll(PHOTO_STORE)).filter(photo => photo.locationId === locationId && (photo.category || "other") === category);
  const fragment = document.createDocumentFragment();
  const nextUrls = [];

  for (const photo of photos) {
    if (root.dataset.renderToken !== renderToken) return;
    const previewBlob = await bogatkaEnsurePreview(photo);
    if (root.dataset.renderToken !== renderToken) return;
    const sourceBlob = previewBlob || photo.blob;
    const url = sourceBlob instanceof Blob ? URL.createObjectURL(sourceBlob) : "";
    if (url) {
      nextUrls.push(url);
      objectUrls.add(url);
    }

    const card = document.createElement("div");
    card.className = "photo";
    card.innerHTML = `
      <div class="photo-preview photo-loading"><img alt="${esc(photo.caption || photo.originalName || "Фото")}" decoding="async"><button class="photo-delete" title="Удалить">×</button></div>
      <input type="text" value="${esc(photo.caption || "")}" placeholder="Подпись к фото">
      <div class="photo-meta">${photo.width || "?"}×${photo.height || "?"} · ${((photo.size || photo.blob?.size || 0)/1024/1024).toFixed(1)} МБ</div>`;

    const img = card.querySelector("img");
    const preview = card.querySelector(".photo-preview");
    img.addEventListener("load", () => preview.classList.remove("photo-loading"), { once:true });
    img.addEventListener("error", async () => {
      if (img.dataset.retry === "1") return;
      img.dataset.retry = "1";
      try {
        const fresh = await idbGet(PHOTO_STORE, photo.id);
        if (fresh?.blob instanceof Blob) img.src = await blobToDataURL(fresh.previewBlob instanceof Blob ? fresh.previewBlob : fresh.blob);
      } catch (error) { console.warn("Не удалось повторно открыть фотографию", error); }
    });
    if (url) img.src = url;

    preview.addEventListener("click", async event => {
      if (event.target.closest(".photo-delete")) return;
      const fresh = await idbGet(PHOTO_STORE, photo.id);
      if (!(fresh?.blob instanceof Blob)) return;
      const fullUrl = URL.createObjectURL(fresh.blob);
      objectUrls.add(fullUrl);
      openPhotoViewer(fullUrl, fresh.caption || fresh.originalName || "Фотография локации");
    });

    card.querySelector(".photo-delete").addEventListener("click", async event => {
      event.stopPropagation();
      if (!confirm("Удалить эту фотографию?")) return;
      await idbDelete(PHOTO_STORE, photo.id);
      await bogatkaRenderPhotoCategory(locationId, category);
      await updateSummary();
    });

    card.querySelector("input").addEventListener("input", event => {
      clearTimeout(event.target._saveTimer);
      event.target._saveTimer = setTimeout(async () => {
        const current = await idbGet(PHOTO_STORE, photo.id);
        if (!current) return;
        current.caption = event.target.value;
        await idbPut(PHOTO_STORE, current);
        showSaved();
      }, 350);
    });
    fragment.appendChild(card);
  }

  if (root.dataset.renderToken !== renderToken) {
    nextUrls.forEach(url => URL.revokeObjectURL(url));
    return;
  }
  const previousUrls = bogatkaPhotoUrlSets.get(rootKey) || [];
  root.replaceChildren(fragment);
  bogatkaPhotoUrlSets.set(rootKey, nextUrls);
  requestAnimationFrame(() => previousUrls.forEach(url => {
    objectUrls.delete(url);
    try { URL.revokeObjectURL(url); } catch (_) {}
  }));
}

renderPhotoCategory = bogatkaRenderPhotoCategory;

async function bogatkaRefreshLocationFields(locationId) {
  const data = await getLocationData(locationId);
  document.querySelectorAll(`[data-location="${CSS.escape(locationId)}"][data-field]`).forEach(element => {
    if (element === document.activeElement) return;
    const value = getNested(data, element.dataset.field);
    if (element.type === "checkbox") element.checked = Boolean(value);
    else if (element.type === "radio") element.checked = element.value === value;
    else if (value !== undefined && element.value !== String(value)) element.value = value;
  });
  updateLocationTotal(locationId, data);
  updateGpsLabel(locationId, data);
  await updateUndoState(locationId);
}

async function bogatkaRefreshGlobalFields() {
  const global = await idbGet(STORE, "global") || {};
  document.querySelectorAll("[data-global]").forEach(element => {
    if (element === document.activeElement) return;
    const value = global[element.dataset.global] || "";
    if (element.value !== String(value)) element.value = value;
  });
}

async function bogatkaStableCloudApplyRemote(remoteLocations, remotePhotos, remoteState, syncState) {
  cloudApplyingRemote = true;
  let structureChanged = false;
  let globalChanged = false;
  const changedLocations = new Set();
  const changedPhotoRoots = new Set();
  try {
    const dirtyLocations = new Set(syncState.dirtyLocations || []);
    const dirtyPhotos = new Set(syncState.dirtyPhotos || []);
    const deletedPhotos = new Set(Object.keys(syncState.deletedPhotos || {}));
    const localLocationMap = new Map(locations.map(item => [item.id, item]));

    for (const remote of remoteLocations) {
      const clientId = remote.client_id || remote.id;
      let localMeta = localLocationMap.get(clientId);
      const localData = await idbGet(STORE, `location:${clientId}`) || {};
      const localNewer = cloudDate(localData.updatedAt) > cloudDate(remote.updated_at);

      if (!localMeta) {
        localMeta = {
          id:clientId,
          title:remote.title,
          address:remote.address || "",
          note:remote.note || "",
          custom:!DEFAULT_LOCATIONS.some(item => item.id === clientId),
          cloudId:remote.id,
          createdAt:remote.created_at,
          updatedAt:remote.updated_at,
        };
        locations.push(localMeta);
        localLocationMap.set(clientId, localMeta);
        structureChanged = true;
      } else {
        const visibleMetaChanged = localMeta.title !== remote.title || (localMeta.address || "") !== (remote.address || "") || (localMeta.note || "") !== (remote.note || "");
        Object.assign(localMeta, {
          title:remote.title,
          address:remote.address || "",
          note:remote.note || "",
          cloudId:remote.id,
          updatedAt:remote.updated_at,
        });
        if (visibleMetaChanged) structureChanged = true;
      }

      if (!dirtyLocations.has(clientId) && !localNewer) {
        const remoteForm = remote.form_data || {};
        const contentChanged = !bogatkaValuesEqual(bogatkaCleanCloudFields(localData), remoteForm);
        const cloudMetaChanged = localData.cloudId !== remote.id || localData.cloudRevision !== remote.revision || localData.cloudUpdatedAt !== remote.updated_at;
        if (contentChanged || cloudMetaChanged) {
          await cloudOriginalIdbPut(STORE, {
            ...remoteForm,
            cloudId:remote.id,
            cloudRevision:remote.revision,
            cloudUpdatedAt:remote.updated_at,
          }, `location:${clientId}`);
          if (contentChanged) changedLocations.add(clientId);
        }
      }
    }

    const remoteClientIds = new Set(remoteLocations.map(item => item.client_id || item.id));
    const knownLocationIds = new Set(syncState.knownLocationIds || []);
    for (const localMeta of [...locations]) {
      if (!localMeta.cloudId) continue;
      if (!remoteClientIds.has(localMeta.id) && knownLocationIds.has(localMeta.id) && !dirtyLocations.has(localMeta.id)) {
        locations = locations.filter(item => item.id !== localMeta.id);
        await cloudOriginalIdbDelete(STORE, `location:${localMeta.id}`);
        structureChanged = true;
      }
    }
    await cloudOriginalIdbPut(STORE, locations, "meta:locations");

    if (remoteState && !syncState.stateDirty) {
      const localGlobal = await idbGet(STORE, "global") || {};
      if (cloudDate(remoteState.updated_at) >= cloudDate(localGlobal.updatedAt)) {
        const remoteGlobal = remoteState.data || {};
        globalChanged = !bogatkaValuesEqual(bogatkaCleanCloudFields(localGlobal), remoteGlobal);
        if (globalChanged || localGlobal.cloudUpdatedAt !== remoteState.updated_at) {
          await cloudOriginalIdbPut(STORE, { ...remoteGlobal, cloudUpdatedAt:remoteState.updated_at }, "global");
        }
      }
    }

    const localPhotos = await idbAll(PHOTO_STORE);
    const localPhotoMap = new Map(localPhotos.map(photo => [photo.id, photo]));
    const remotePhotoIds = new Set(remotePhotos.map(photo => photo.id));
    const knownPhotoIds = new Set(syncState.knownPhotoIds || []);

    for (const remotePhoto of remotePhotos) {
      if (deletedPhotos.has(remotePhoto.id)) continue;
      const clientId = remoteLocations.find(item => item.id === remotePhoto.location_id)?.client_id;
      if (!clientId) continue;
      const local = localPhotoMap.get(remotePhoto.id);
      if (!local) {
        const blob = await cloudDownloadPhoto(remotePhoto);
        await cloudOriginalIdbPut(PHOTO_STORE, {
          id:remotePhoto.id,
          locationId:clientId,
          category:remotePhoto.category || "other",
          caption:remotePhoto.caption || "",
          storagePath:remotePhoto.storage_path,
          cloudLocationId:remotePhoto.location_id,
          cloudSyncedAt:remotePhoto.updated_at,
          originalName:remotePhoto.original_name || "photo.jpg",
          width:remotePhoto.width,
          height:remotePhoto.height,
          size:remotePhoto.file_size || blob.size,
          createdAt:remotePhoto.created_at,
          blob,
        });
        changedPhotoRoots.add(`${clientId}:${remotePhoto.category || "other"}`);
      } else if (!dirtyPhotos.has(remotePhoto.id)) {
        const oldRoot = `${local.locationId}:${local.category || "other"}`;
        const newRoot = `${clientId}:${remotePhoto.category || "other"}`;
        const metadataChanged = local.caption !== (remotePhoto.caption || "") || (local.category || "other") !== (remotePhoto.category || "other") || local.storagePath !== remotePhoto.storage_path || local.cloudSyncedAt !== remotePhoto.updated_at;
        let blobChanged = false;
        if (!(local.blob instanceof Blob) || !local.blob.size) {
          local.blob = await cloudDownloadPhoto(remotePhoto);
          blobChanged = true;
        }
        if (metadataChanged || blobChanged) {
          local.locationId = clientId;
          local.caption = remotePhoto.caption || "";
          local.category = remotePhoto.category || "other";
          local.storagePath = remotePhoto.storage_path;
          local.cloudLocationId = remotePhoto.location_id;
          local.cloudSyncedAt = remotePhoto.updated_at;
          local.originalName = remotePhoto.original_name || local.originalName || "photo.jpg";
          local.width = remotePhoto.width || local.width;
          local.height = remotePhoto.height || local.height;
          local.size = remotePhoto.file_size || local.size || local.blob.size;
          await cloudOriginalIdbPut(PHOTO_STORE, local);
          changedPhotoRoots.add(oldRoot);
          changedPhotoRoots.add(newRoot);
        }
      }
    }

    for (const local of localPhotos) {
      if (local.storagePath && knownPhotoIds.has(local.id) && !remotePhotoIds.has(local.id) && !dirtyPhotos.has(local.id)) {
        await cloudOriginalIdbDelete(PHOTO_STORE, local.id);
        changedPhotoRoots.add(`${local.locationId}:${local.category || "other"}`);
      }
    }
  } finally {
    cloudApplyingRemote = false;
  }

  if (structureChanged) {
    renderLocations();
    return;
  }
  for (const locationId of changedLocations) await bogatkaRefreshLocationFields(locationId);
  if (globalChanged) await bogatkaRefreshGlobalFields();
  for (const rootKey of changedPhotoRoots) {
    const separator = rootKey.lastIndexOf(":");
    await bogatkaRenderPhotoCategory(rootKey.slice(0, separator), rootKey.slice(separator + 1));
  }
  if (changedLocations.size || changedPhotoRoots.size || globalChanged) await updateSummary();
}

if (typeof cloudApplyRemote === "function") cloudApplyRemote = bogatkaStableCloudApplyRemote;

function bogatkaCloseRoleSelect(except = null) {
  document.querySelectorAll(".bogatka-role-select.open").forEach(wrapper => {
    if (wrapper !== except) wrapper.classList.remove("open");
  });
}

function bogatkaEnhanceRoleSelect() {
  const select = document.querySelector("#cloudInviteRole");
  if (!select || select.dataset.bogatkaCustom === "1") return;
  select.dataset.bogatkaCustom = "1";
  select.classList.add("bogatka-native-select-hidden");

  const wrapper = document.createElement("div");
  wrapper.className = "bogatka-role-select";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "bogatka-role-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const label = document.createElement("span");
  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.setAttribute("viewBox", "0 0 24 24");
  chevron.setAttribute("fill", "none");
  chevron.setAttribute("stroke", "currentColor");
  chevron.setAttribute("stroke-width", "2.2");
  chevron.setAttribute("stroke-linecap", "round");
  chevron.setAttribute("stroke-linejoin", "round");
  chevron.classList.add("bogatka-role-chevron");
  chevron.innerHTML = '<path d="m6 9 6 6 6-6"/>';
  trigger.append(label, chevron);

  const menu = document.createElement("div");
  menu.className = "bogatka-role-menu";
  menu.setAttribute("role", "listbox");

  const sync = () => {
    const current = [...select.options].find(option => option.value === select.value) || select.options[0];
    label.textContent = current?.textContent || "Выберите роль";
    menu.querySelectorAll(".bogatka-role-option").forEach(option => option.classList.toggle("selected", option.dataset.value === select.value));
  };

  [...select.options].forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bogatka-role-option";
    button.dataset.value = option.value;
    button.setAttribute("role", "option");
    button.textContent = option.textContent;
    button.addEventListener("click", () => {
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles:true }));
      sync();
      wrapper.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus({ preventScroll:true });
    });
    menu.appendChild(button);
  });

  trigger.addEventListener("click", () => {
    const willOpen = !wrapper.classList.contains("open");
    bogatkaCloseRoleSelect(wrapper);
    wrapper.classList.toggle("open", willOpen);
    trigger.setAttribute("aria-expanded", String(willOpen));
  });
  trigger.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      wrapper.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    }
  });
  select.addEventListener("change", sync);
  wrapper.append(trigger, menu);
  select.insertAdjacentElement("afterend", wrapper);
  sync();
}

function bogatkaInstallPremiumObservers() {
  bogatkaEnhanceRoleSelect();
  if (!bogatkaRoleSelectObserver) {
    bogatkaRoleSelectObserver = new MutationObserver(() => bogatkaEnhanceRoleSelect());
    bogatkaRoleSelectObserver.observe(document.body, { childList:true, subtree:true });
  }
  document.addEventListener("click", event => {
    if (!event.target.closest(".bogatka-role-select")) bogatkaCloseRoleSelect();
  });
}

/* The original handler was bound before the premium script finished loading. Replace it immediately. */
if (typeof replaceAccessLinkButton === "function") replaceAccessLinkButton();
if (typeof copyAccessLink === "function" && typeof openAccessLinkModal === "function") {
  copyAccessLink = function bogatkaOpenAccessLink() { openAccessLinkModal(); };
}

bogatkaInstallPremiumObservers();

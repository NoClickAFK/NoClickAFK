let v22EnhanceTimer = null;

function scheduleV22Enhance() {
  clearTimeout(v22EnhanceTimer);
  v22EnhanceTimer = setTimeout(upgradeV22Controls, 90);
}

function upgradeV22Controls() {
  if (document.getElementById("versionLabel")) document.getElementById("versionLabel").textContent = "4.0.0";

  document.querySelectorAll(".photo-mode-bar").forEach(bar => {
    if (bar.dataset.v22 === "1") return;
    const section = bar.closest("[data-location-card]");
    const locationId = section?.dataset.locationCard;
    if (!section || !locationId) return;

    const enabled = photoEditState.has(locationId);
    bar.dataset.v22 = "1";
    bar.innerHTML = `
      <label class="photo-edit-switch">
        <input type="checkbox" ${enabled ? "checked" : ""} aria-label="Разрешить редактирование фотографий">
        <span class="photo-edit-track"><span class="photo-edit-knob"></span></span>
        <span class="photo-edit-label">Редактирование фотографий</span>
      </label>
      <span class="photo-mode-status ${enabled ? "enabled" : "disabled"}">${enabled ? "Удаление и подписи разрешены" : "Удаление и подписи заблокированы"}</span>`;

    const checkbox = bar.querySelector('input[type="checkbox"]');
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) photoEditState.add(locationId);
      else photoEditState.delete(locationId);
      applyPhotoEditState(locationId, section);
      const status = bar.querySelector(".photo-mode-status");
      status.textContent = checkbox.checked ? "Удаление и подписи разрешены" : "Удаление и подписи заблокированы";
      status.classList.toggle("enabled", checkbox.checked);
      status.classList.toggle("disabled", !checkbox.checked);
    });
  });
}

window.addEventListener("load", () => {
  scheduleV22Enhance();
  const observer = new MutationObserver(scheduleV22Enhance);
  observer.observe(document.body, {childList:true, subtree:true});
});

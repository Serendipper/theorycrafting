(function () {
  "use strict";

  const STORAGE_PREFIX = "theorycrafting:";

  function getChecklistId() {
    return (
      document.body.getAttribute("data-checklist") ||
      document.getElementById("checklist-progress")?.dataset.checklist ||
      null
    );
  }

  function storageKey(checklistId) {
    return STORAGE_PREFIX + checklistId;
  }

  function loadState(checklistId) {
    try {
      const raw = localStorage.getItem(storageKey(checklistId));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveState(checklistId, state) {
    try {
      localStorage.setItem(storageKey(checklistId), JSON.stringify(state));
      return true;
    } catch (err) {
      console.warn("Checklist: could not save progress.", err);
      return false;
    }
  }

  function itemKey(checklistId, index) {
    return checklistId + "-hp-" + (index + 1);
  }

  function getContentRoot() {
    return (
      document.querySelector("article.md-content__inner") ||
      document.querySelector("article.md-typeset") ||
      document.querySelector("article")
    );
  }

  function getCheckboxes() {
    const root = getContentRoot();
    if (!root) return [];
    return Array.from(
      root.querySelectorAll("li.task-list-item input[type='checkbox']")
    );
  }

  function updateProgress(checkboxes, progressEl) {
    const total = parseInt(progressEl.dataset.total, 10) || checkboxes.length;
    const collected = checkboxes.filter((cb) => cb.checked).length;
    const remaining = total - collected;
    progressEl.innerHTML =
      "<strong>" +
      collected +
      "</strong> / " +
      total +
      " collected · <strong>" +
      remaining +
      "</strong> remaining";
  }

  function applyCheckedClass(checkbox) {
    const li = checkbox.closest("li.task-list-item");
    if (li) {
      li.classList.toggle("checklist-done", checkbox.checked);
    }
  }

  function init() {
    const checklistId = getChecklistId();
    if (!checklistId) return;

    const progressEl = document.getElementById("checklist-progress");
    const checkboxes = getCheckboxes();
    if (!progressEl || checkboxes.length === 0) return;

    const state = loadState(checklistId);

    function persistCheckbox(checkbox, key) {
      state[key] = checkbox.checked;
      saveState(checklistId, state);
      applyCheckedClass(checkbox);
      updateProgress(checkboxes, progressEl);
    }

    checkboxes.forEach((checkbox, index) => {
      const key = itemKey(checklistId, index);
      checkbox.dataset.checklistKey = key;
      if (state[key]) {
        checkbox.checked = true;
      }
      applyCheckedClass(checkbox);

      checkbox.addEventListener("change", function () {
        persistCheckbox(checkbox, key);
      });
      // Label clicks sometimes skip change in custom Material checkboxes
      checkbox.addEventListener("click", function () {
        requestAnimationFrame(function () {
          persistCheckbox(checkbox, key);
        });
      });
    });

    updateProgress(checkboxes, progressEl);

    let resetBtn = document.getElementById("checklist-reset");
    if (!resetBtn) {
      resetBtn = document.createElement("button");
      resetBtn.id = "checklist-reset";
      resetBtn.type = "button";
      resetBtn.className = "md-button";
      resetBtn.textContent = "Clear progress";
      resetBtn.style.marginBottom = "1rem";
      progressEl.parentNode.insertBefore(resetBtn, progressEl);

      resetBtn.addEventListener("click", function () {
        if (
          !window.confirm(
            "Clear all checked items for this checklist? This cannot be undone."
          )
        ) {
          return;
        }
        localStorage.removeItem(storageKey(checklistId));
        checkboxes.forEach((checkbox) => {
          checkbox.checked = false;
          applyCheckedClass(checkbox);
        });
        updateProgress(checkboxes, progressEl);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

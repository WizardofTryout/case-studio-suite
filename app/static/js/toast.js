/**
 * Toast & Modern Modal Notification System (Strictly Zero Native Popups)
 */

window.showToast = function(message, type = "info", duration = 4000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  else if (type === "warning") icon = "⚠️";
  else if (type === "error") icon = "❌";

  toast.innerHTML = `<span>${icon}</span><span style="flex:1;">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
};

window.showConfirmModal = function(title, message, onConfirm, confirmText = "Bestätigen", cancelText = "Abbrechen") {
  const overlay = document.getElementById("generic-modal-overlay");
  if (!overlay) return;

  const titleEl = document.getElementById("generic-modal-title");
  const bodyEl = document.getElementById("generic-modal-body");
  const confirmBtn = document.getElementById("generic-modal-confirm");
  const cancelBtn = document.getElementById("generic-modal-cancel");

  titleEl.innerText = title;
  bodyEl.innerHTML = `<p>${message}</p>`;
  confirmBtn.innerText = confirmText;
  cancelBtn.innerText = cancelText;

  overlay.classList.add("active");

  const cleanup = () => {
    overlay.classList.remove("active");
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  confirmBtn.onclick = () => {
    cleanup();
    if (typeof onConfirm === "function") onConfirm();
  };

  cancelBtn.onclick = () => {
    cleanup();
  };
};

window.showPromptModal = function(title, label, defaultValue, onSubmit) {
  const overlay = document.getElementById("generic-modal-overlay");
  if (!overlay) return;

  const titleEl = document.getElementById("generic-modal-title");
  const bodyEl = document.getElementById("generic-modal-body");
  const confirmBtn = document.getElementById("generic-modal-confirm");
  const cancelBtn = document.getElementById("generic-modal-cancel");

  titleEl.innerText = title;
  bodyEl.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px;">
      <label style="font-size:0.85rem; color:#94a3b8;">${label}</label>
      <input type="text" id="generic-modal-input" class="gate-answer-input" value="${defaultValue || ''}" style="width:100%; padding:8px 12px; font-size:0.9rem;" />
    </div>
  `;
  confirmBtn.innerText = "Speichern";
  cancelBtn.innerText = "Abbrechen";

  overlay.classList.add("active");
  const inputEl = document.getElementById("generic-modal-input");
  if (inputEl) {
    setTimeout(() => inputEl.focus(), 50);
  }

  const cleanup = () => {
    overlay.classList.remove("active");
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  confirmBtn.onclick = () => {
    const val = inputEl ? inputEl.value.trim() : "";
    cleanup();
    if (typeof onSubmit === "function") onSubmit(val);
  };

  cancelBtn.onclick = () => {
    cleanup();
  };
};

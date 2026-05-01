// modals.js — open/close <dialog> elements via data attributes.
//
// HTML contract:
//   <button data-open-modal="station-1">Read more</button>
//   <dialog id="modal-station-1">
//     <button data-close-modal>×</button>
//     ...
//   </dialog>
//
// Closes on:
//   - any [data-close-modal] click inside the dialog
//   - backdrop click (outside the .modal__inner)
//   - ESC (native <dialog> behaviour)

function openFromTarget(targetKey) {
  const dialog = document.getElementById(`modal-${targetKey}`);
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  // Reset scroll for the body each time
  const inner = dialog.querySelector('.modal__inner');
  if (inner) inner.scrollTop = 0;
  const body = dialog.querySelector('.modal__body');
  if (body) body.scrollTop = 0;
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

export function initModals() {
  document.querySelectorAll('[data-open-modal]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openFromTarget(btn.dataset.openModal);
    });
  });

  document.querySelectorAll('dialog.modal').forEach((dialog) => {
    // Close button(s)
    dialog.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeDialog(dialog));
    });
    // Backdrop click — anywhere outside .modal__inner counts as backdrop.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) closeDialog(dialog);
    });
  });
}

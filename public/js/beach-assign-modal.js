/* Beach assign modal: a small dedicated dialog to assign an umbrella + period
 * to a reservation. Used from Spiaggia "Da assegnare" list. Mobile-friendly. */
(function () {
  let umbrellas = null;
  let currentReservation = null;

  function $(id) { return document.getElementById(id); }

  async function ensureUmbrellas() {
    if (umbrellas) return umbrellas;
    try { umbrellas = await window.api.beach.umbrellas.getAll(); }
    catch (_) { umbrellas = []; }
    return umbrellas;
  }

  function fillSelect(currentId) {
    const sel = $('beach-assign-umbrella');
    sel.innerHTML = '<option value="">— Seleziona —</option>';
    (umbrellas || []).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.code + (u.row_label ? ' · ' + u.row_label : '');
      if (currentId && String(u.id) === String(currentId)) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  async function checkAvailability() {
    const help = $('beach-assign-help');
    const sel = $('beach-assign-umbrella');
    const s = $('beach-assign-start');
    const e = $('beach-assign-end');
    if (!help || !sel || !s || !e) return;
    help.textContent = '';
    help.className = 'form-text small mt-2';
    if (!sel.value || !s.value || !e.value) return;
    if (new Date(e.value) < new Date(s.value)) {
      help.textContent = 'Le date sono invertite';
      help.classList.add('text-danger');
      return;
    }
    try {
      const conflicts = await window.api.beach.assignments.list({
        umbrella_id: sel.value, from: s.value, to: e.value
      });
      const otherId = currentReservation && currentReservation.id;
      const blocked = (conflicts || []).filter(c => !otherId || c.reservation_id !== otherId);
      if (blocked.length) {
        const c = blocked[0];
        help.innerHTML = '⚠ Occupato (' + c.start_date + ' → ' + c.end_date + ')';
        help.classList.add('text-danger');
      } else {
        help.innerHTML = '✓ Disponibile';
        help.classList.add('text-success');
      }
    } catch (_) { /* ignore */ }
  }

  async function openModal(reservation) {
    currentReservation = reservation;
    $('beach-assign-reservation-id').value = reservation.id;

    // Summary line
    const summary = $('beach-assign-summary');
    if (summary) {
      const parts = [];
      if (reservation.client_name) parts.push('<strong>' + escapeHTML(reservation.client_name) + '</strong>');
      if (reservation.room_number) parts.push('App. ' + escapeHTML(reservation.room_number));
      summary.innerHTML = parts.join(' · ');
    }

    // Pre-fill dates with reservation check-in/out
    if (reservation.check_in_date) $('beach-assign-start').value = reservation.check_in_date;
    if (reservation.check_out_date) $('beach-assign-end').value = reservation.check_out_date;

    await ensureUmbrellas();

    // Pre-select umbrella if reservation already has an assignment
    let currentAssignment = null;
    try {
      const list = await window.api.beach.assignments.list({ reservation_id: reservation.id });
      currentAssignment = (list && list[0]) || null;
    } catch (_) {}
    fillSelect(currentAssignment ? currentAssignment.umbrella_id : null);
    if (currentAssignment) {
      $('beach-assign-start').value = currentAssignment.start_date;
      $('beach-assign-end').value = currentAssignment.end_date;
    }

    // Show "Rimuovi" only when an assignment already exists
    const clearBtn = $('beach-assign-clear');
    if (clearBtn) clearBtn.hidden = !currentAssignment;

    $('beach-assign-help').textContent = '';

    bootstrap.Modal.getOrCreateInstance($('beach-assign-modal')).show();
    setTimeout(checkAvailability, 200);
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  async function save() {
    const id = parseInt($('beach-assign-reservation-id').value, 10);
    const umbrella = parseInt($('beach-assign-umbrella').value || '0', 10);
    const start = $('beach-assign-start').value;
    const end = $('beach-assign-end').value;
    const btn = $('beach-assign-save');
    if (!id || !umbrella || !start || !end) {
      $('beach-assign-help').textContent = 'Compila tutti i campi';
      $('beach-assign-help').className = 'form-text small mt-2 text-danger';
      return;
    }
    if (new Date(end) < new Date(start)) {
      $('beach-assign-help').textContent = 'Le date sono invertite';
      $('beach-assign-help').className = 'form-text small mt-2 text-danger';
      return;
    }
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Salvataggio…';
    try {
      await window.api.beach.assignments.sync({
        reservation_id: id, umbrella_id: umbrella, start_date: start, end_date: end
      });
      bootstrap.Modal.getInstance($('beach-assign-modal')).hide();
      if (window.uiUtils) window.uiUtils.showToast('Ombrellone assegnato', 'success');
      document.dispatchEvent(new CustomEvent('beach-data-invalidated'));
    } catch (err) {
      console.error('Assign failed:', err);
      $('beach-assign-help').textContent = 'Errore: ' + (err.message || err);
      $('beach-assign-help').className = 'form-text small mt-2 text-danger';
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  async function clearAssignment() {
    const id = parseInt($('beach-assign-reservation-id').value, 10);
    if (!id) return;
    try {
      await window.api.beach.assignments.sync({
        reservation_id: id, umbrella_id: null, start_date: null, end_date: null
      });
      bootstrap.Modal.getInstance($('beach-assign-modal')).hide();
      if (window.uiUtils) window.uiUtils.showToast('Ombrellone rimosso', 'success');
      document.dispatchEvent(new CustomEvent('beach-data-invalidated'));
    } catch (err) {
      console.error('Clear failed:', err);
    }
  }

  window.openBeachAssignModal = openModal;

  document.addEventListener('DOMContentLoaded', function () {
    const saveBtn = $('beach-assign-save');
    const clearBtn = $('beach-assign-clear');
    if (saveBtn) saveBtn.addEventListener('click', save);
    if (clearBtn) clearBtn.addEventListener('click', clearAssignment);
    ['beach-assign-umbrella', 'beach-assign-start', 'beach-assign-end'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('change', checkAvailability);
    });
  });
})();

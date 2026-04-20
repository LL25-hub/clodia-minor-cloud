/* Reservation modal: beach block + loading overlay.
 *
 * - Populates the umbrella <select> from /beach/umbrellas on demand.
 * - Toggles the beach block when the "Spiaggia" checkbox is flipped.
 * - Defaults the beach date range to the reservation check-in/check-out.
 * - Warns about umbrella/date conflicts when the user picks an umbrella.
 * - When an existing reservation is opened, fetches its current assignment
 *   and pre-fills the select and date range.
 * - Wraps openReservationModal() / saveReservation() to show a spinner
 *   overlay while data loads, and to sync the beach assignment on save.
 */
(function () {
  let umbrellaList = null;
  // Id of the reservation currently being edited (captured from openReservationModal).
  // currentReservationId in app.js is a lexical top-level let and is NOT reachable
  // via window, so we track it here ourselves.
  let editingReservationId = null;

  function $(id) { return document.getElementById(id); }

  function showLoading(show) {
    const el = $('reservation-modal-loading');
    if (!el) return;
    if (show) { el.hidden = false; el.setAttribute('aria-hidden', 'false'); }
    else { el.hidden = true; el.setAttribute('aria-hidden', 'true'); }
  }

  async function ensureUmbrellas(force) {
    if (umbrellaList && !force) return umbrellaList;
    try {
      umbrellaList = await window.api.beach.umbrellas.getAll();
    } catch (e) {
      umbrellaList = [];
    }
    return umbrellaList;
  }

  function fillUmbrellaSelect(items) {
    const sel = $('beach-umbrella-select');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— nessuno —</option>';
    (items || []).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.code + (u.row_label ? ' · ' + u.row_label : '');
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  }

  function toggleBeachBlock() {
    const cb = $('has-beach');
    const block = $('beach-assign-block');
    if (!cb || !block) return;
    block.hidden = !cb.checked;
  }

  function prefillDates() {
    const ci = $('check-in-date');
    const co = $('check-out-date');
    const s = $('beach-start-date');
    const e = $('beach-end-date');
    if (!s || !e) return;
    if (!s.value && ci && ci.value) s.value = ci.value;
    if (!e.value && co && co.value) e.value = co.value;
  }

  async function checkAvailability() {
    const help = $('beach-umbrella-help');
    const sel = $('beach-umbrella-select');
    const s = $('beach-start-date');
    const e = $('beach-end-date');
    if (!help || !sel || !s || !e) return;
    help.textContent = '';
    help.className = 'form-text small';
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
      // Exclude the current reservation's own assignment
      const currentId = parseInt($('reservation-id').value || '0', 10);
      const conflicting = (conflicts || []).filter(c => !currentId || c.reservation_id !== currentId);
      if (conflicting.length) {
        const c = conflicting[0];
        help.innerHTML = '⚠ Occupato (' + c.start_date + ' → ' + c.end_date + ')';
        help.classList.add('text-danger');
      } else {
        help.innerHTML = '✓ Disponibile';
        help.classList.add('text-success');
      }
    } catch (_) { /* ignore */ }
  }

  // Called after the reservation form has been populated with an existing reservation
  async function prefillFromReservation(reservationId) {
    try {
      const assignments = await window.api.beach.assignments.list({ reservation_id: reservationId });
      const a = (assignments && assignments[0]) || null;
      const sel = $('beach-umbrella-select');
      const s = $('beach-start-date');
      const e = $('beach-end-date');
      if (a) {
        if (sel) sel.value = String(a.umbrella_id);
        if (s) s.value = a.start_date;
        if (e) e.value = a.end_date;
        // If not already enabled, turn on the Spiaggia switch
        const cb = $('has-beach');
        if (cb && !cb.checked) { cb.checked = true; toggleBeachBlock(); }
      }
    } catch (_) { /* ignore */ }
  }

  // Wrap openReservationModal so the overlay shows instantly
  function installOpenWrapper() {
    const orig = window.openReservationModal;
    if (typeof orig !== 'function') return setTimeout(installOpenWrapper, 100);
    window.openReservationModal = async function (reservationId) {
      // Remember the id so the save hook can sync the beach assignment
      editingReservationId = reservationId || null;

      // Reset beach fields
      const cb = $('has-beach');
      const block = $('beach-assign-block');
      const sel = $('beach-umbrella-select');
      const s = $('beach-start-date');
      const e = $('beach-end-date');
      const help = $('beach-umbrella-help');
      if (sel) sel.value = '';
      if (s) s.value = '';
      if (e) e.value = '';
      if (help) { help.textContent = ''; help.className = 'form-text small'; }
      if (block) block.hidden = !(cb && cb.checked);

      // Show overlay if editing existing
      if (reservationId) showLoading(true);
      try {
        await ensureUmbrellas();
        fillUmbrellaSelect(umbrellaList);
        const result = orig.call(this, reservationId);
        if (result && typeof result.then === 'function') await result;
        if (reservationId) await prefillFromReservation(reservationId);
        prefillDates();
      } finally {
        showLoading(false);
      }
    };
  }

  // Intercept api.reservations.create so we can capture the new id for
  // brand-new reservations (they don't have #reservation-id populated).
  let lastCreatedId = null;
  function installApiHook() {
    if (!window.api || !window.api.reservations) return setTimeout(installApiHook, 100);
    const origCreate = window.api.reservations.create;
    if (origCreate && !origCreate.__cmBeachWrapped) {
      window.api.reservations.create = async function (data) {
        const res = await origCreate.apply(this, arguments);
        if (res && res.id) lastCreatedId = res.id;
        return res;
      };
      window.api.reservations.create.__cmBeachWrapped = true;
    }
  }

  // Wrap saveReservation so after save we sync the beach assignment.
  function installSaveHook() {
    const originalSave = window.saveReservation;
    if (typeof originalSave !== 'function') return setTimeout(installSaveHook, 100);

    window.saveReservation = async function () {
      // Source of truth for the id being edited:
      //   1. #reservation-id hidden field (populated by fillReservationForm)
      //   2. editingReservationId captured by our openReservationModal wrapper
      const hidden = parseInt(($('reservation-id') && $('reservation-id').value) || '0', 10);
      const editingId = hidden || editingReservationId || null;

      // Snapshot beach form BEFORE the original save hides the modal / resets
      const cb = $('has-beach');
      const sel = $('beach-umbrella-select');
      const s = $('beach-start-date');
      const e = $('beach-end-date');
      const beachSnapshot = {
        enabled: !!(cb && cb.checked),
        umbrella_id: sel && sel.value ? parseInt(sel.value, 10) : null,
        start_date: s && s.value ? s.value : null,
        end_date: e && e.value ? e.value : null
      };

      // Reset capture before running the save
      lastCreatedId = null;
      const result = originalSave.apply(this, arguments);
      if (result && typeof result.then === 'function') {
        try { await result; } catch (_) { /* errors are surfaced by original */ }
      }

      // Decide the target reservation id: editing -> editingId, else the
      // freshly-created id captured by the api.create interceptor
      const targetId = editingId || lastCreatedId;
      if (!targetId) return result;

      try {
        // Fall back to check-in/check-out if beach dates are empty
        const ci = $('check-in-date'), co = $('check-out-date');
        const startDate = beachSnapshot.start_date || (ci && ci.value) || null;
        const endDate = beachSnapshot.end_date || (co && co.value) || null;

        const payload = {
          reservation_id: targetId,
          umbrella_id: beachSnapshot.enabled && beachSnapshot.umbrella_id ? beachSnapshot.umbrella_id : null,
          start_date: beachSnapshot.enabled ? startDate : null,
          end_date: beachSnapshot.enabled ? endDate : null
        };

        // Only call the API if there's a meaningful change to sync
        if (payload.umbrella_id || !beachSnapshot.enabled) {
          await window.api.beach.assignments.sync(payload);
          document.dispatchEvent(new CustomEvent('beach-data-invalidated'));
          if (window.uiUtils && window.uiUtils.showToast) {
            window.uiUtils.showToast(
              payload.umbrella_id ? 'Ombrellone assegnato con successo' : 'Ombrellone rimosso dalla prenotazione',
              'success'
            );
          }
        }
      } catch (err) {
        console.error('Beach sync failed:', err);
        if (window.uiUtils && window.uiUtils.showToast) {
          window.uiUtils.showToast('Errore durante il salvataggio dell\'ombrellone: ' + (err.message || err), 'danger');
        }
      } finally {
        editingReservationId = null;
      }
      return result;
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    const cb = $('has-beach');
    if (cb) cb.addEventListener('change', function () {
      toggleBeachBlock();
      if (cb.checked) {
        ensureUmbrellas().then(() => fillUmbrellaSelect(umbrellaList));
        prefillDates();
      }
    });

    // Keep the block in sync whenever check-in/check-out dates change (only if empty)
    ['check-in-date', 'check-out-date'].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('change', () => {
        const s = $('beach-start-date'); const e = $('beach-end-date');
        if (s && !s.value && $('check-in-date').value) s.value = $('check-in-date').value;
        if (e && !e.value && $('check-out-date').value) e.value = $('check-out-date').value;
      });
    });

    ['beach-umbrella-select', 'beach-start-date', 'beach-end-date'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('change', checkAvailability);
    });

    installOpenWrapper();
    installSaveHook();
    installApiHook();
  });
})();

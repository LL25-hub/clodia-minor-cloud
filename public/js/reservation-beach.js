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

  // Wrap saveReservation so after save we sync the beach assignment
  function installSaveHook() {
    // Listen to a custom event dispatched after save, OR monkey-patch.
    // Easier: observe the "reservation saved" toast is not reliable. Use patch.
    const originalSave = window.saveReservation;
    if (typeof originalSave !== 'function') return setTimeout(installSaveHook, 100);

    window.saveReservation = async function () {
      // Let the existing flow run and record whether it created a new reservation
      const prevId = parseInt($('reservation-id').value || '0', 10);
      // We cannot cleanly intercept the new id from the original function, so we
      // listen to api.reservations.create/update calls. Simpler: call original,
      // then query the latest reservation by client/date to find ours. Too fragile.
      // Instead we await the original save and afterwards, if #reservation-id
      // holds a non-empty id, use that; otherwise, find the most recent
      // reservation from the fresh list.
      const res = originalSave.apply(this, arguments);
      if (res && typeof res.then === 'function') await res;

      // At this point the modal is already hidden and sections refreshed.
      // #reservation-id is cleared after save, so we can't use it directly.
      // Strategy: if we were editing and `prevId` > 0 then sync that id.
      // If new, skip (user can reopen the reservation to assign the umbrella).
      try {
        const sel = $('beach-umbrella-select');
        const cb = $('has-beach');
        const s = $('beach-start-date');
        const e = $('beach-end-date');
        if (!sel || !cb) return res;
        if (!prevId) return res; // new reservation — assignment to be set on next edit
        const payload = {
          reservation_id: prevId,
          umbrella_id: cb.checked && sel.value ? parseInt(sel.value, 10) : null,
          start_date: cb.checked && s && s.value ? s.value : null,
          end_date: cb.checked && e && e.value ? e.value : null
        };
        await window.api.beach.assignments.sync(payload);
        document.dispatchEvent(new CustomEvent('beach-data-invalidated'));
      } catch (err) {
        console.error('Beach sync failed:', err);
      }
      return res;
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
  });
})();

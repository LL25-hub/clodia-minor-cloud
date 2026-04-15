/* Prenotazioni section: unified card view with live filters (mobile + desktop).
 *
 * Wraps the global updateReservationsHistory() so every table-render ALSO paints
 * a rich, priority-ordered card grid with:
 *   - stats chips (active / soon / future / past)
 *   - two live search fields (cliente, appartamento)
 *   - status filter chips (Tutte / In corso / Imminenti / Future / Passate)
 *   - clickable cards (tap to edit)
 */
(function () {
  const MS_DAY = 86400000;

  let lastReservations = [];
  let currentStatusFilter = 'all';
  let clientFilterText = '';
  let roomFilterText = '';

  // --- Helpers ---
  function parseDate(s) {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function formatShortDate(s) {
    const d = parseDate(s);
    return d ? d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '';
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / MS_DAY);
  }

  function classifyReservation(res) {
    const today = todayStart();
    const ci = parseDate(res.check_in_date);
    const co = parseDate(res.check_out_date);
    if (!ci || !co) return { bucket: 'past', key: 0, label: '' };

    if (ci <= today && co > today) return { bucket: 'active', key: co.getTime(), label: 'In corso' };
    if (daysBetween(today, ci) === 0) return { bucket: 'soon', key: ci.getTime(), label: 'Arriva oggi' };
    if (daysBetween(today, co) === 0) return { bucket: 'soon', key: co.getTime(), label: 'Parte oggi' };
    const dCi = daysBetween(today, ci);
    if (dCi > 0 && dCi <= 7) return { bucket: 'soon', key: ci.getTime(), label: `Tra ${dCi}g` };
    const dCo = daysBetween(today, co);
    if (dCo > 0 && dCo <= 7) return { bucket: 'soon', key: co.getTime(), label: `Parte tra ${dCo}g` };
    if (ci > today) return { bucket: 'future', key: ci.getTime(), label: formatShortDate(res.check_in_date) };
    return { bucket: 'past', key: -ci.getTime(), label: 'Passata' };
  }

  function sortReservations(list) {
    const order = { active: 0, soon: 1, future: 2, past: 3 };
    return list.slice().sort(function (a, b) {
      const ca = classifyReservation(a);
      const cb = classifyReservation(b);
      if (order[ca.bucket] !== order[cb.bucket]) return order[ca.bucket] - order[cb.bucket];
      return ca.key - cb.key;
    });
  }

  function cleanNotes(notes) {
    if (!notes) return '';
    return String(notes).replace(/\s*\|\s*Preventivo: €[0-9.]+/, '').trim();
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function createIconBadge(iconClass, text, variant) {
    const span = createEl('span', 'r-badge r-badge-' + (variant || 'default'));
    const i = createEl('i', iconClass);
    span.appendChild(i);
    if (text) span.appendChild(document.createTextNode(' ' + text));
    return span;
  }

  // --- Card ---
  function buildCard(reservation) {
    const info = classifyReservation(reservation);
    const card = createEl('article', 'r-card r-card--' + info.bucket);
    card.dataset.id = reservation.id;
    const color = (reservation.reservation_color || 'yellow').toLowerCase();
    card.classList.add('r-card--color-' + color);

    // Header
    const header = createEl('header', 'r-card__header');
    if (info.label) {
      const pill = createEl('span', 'r-card__status', info.label);
      header.appendChild(pill);
    }
    const title = createEl('h6', 'r-card__title', reservation.client_name || 'Cliente');
    header.appendChild(title);
    const numPeople = reservation.num_people ||
      (parseInt(reservation.adults || 0) + parseInt(reservation.children || 0)) || 1;
    const people = createEl('span', 'r-card__people');
    people.innerHTML = '<i class="fas fa-user"></i> ' + numPeople;
    header.appendChild(people);
    card.appendChild(header);

    // Meta: apartment + dates
    const meta = createEl('div', 'r-card__meta');
    const apt = createEl('span', 'r-card__apt');
    apt.innerHTML = '<i class="fas fa-building"></i> ' +
      (reservation.room_number || '-') +
      (reservation.room_type ? ' · <span class="r-card__apt-type">' + reservation.room_type + '</span>' : '');
    meta.appendChild(apt);
    const dates = createEl('span', 'r-card__dates');
    dates.innerHTML = '<i class="far fa-calendar"></i> ' +
      formatShortDate(reservation.check_in_date) + ' → ' +
      formatShortDate(reservation.check_out_date);
    meta.appendChild(dates);
    if (reservation.reference) {
      const ref = createEl('span', 'r-card__ref');
      ref.innerHTML = '<i class="fas fa-tag"></i> ' + String(reservation.reference);
      meta.appendChild(ref);
    }
    card.appendChild(meta);

    // Badges
    const badges = createEl('div', 'r-card__badges');
    const isPaid = reservation.is_paid == 1 || reservation.is_paid === true;
    badges.appendChild(isPaid
      ? createIconBadge('fas fa-check', 'Pagato', 'success')
      : createIconBadge('fas fa-circle', 'Da pagare', 'danger'));
    if (reservation.has_beach == 1) badges.appendChild(createIconBadge('fas fa-umbrella-beach', 'Spiaggia', 'info'));
    if (reservation.has_deposit == 1) badges.appendChild(createIconBadge('fas fa-money-bill-wave', 'Caparra', 'warning'));
    card.appendChild(badges);

    // Payment summary
    const cash = parseFloat(reservation.cash_amount) || 0;
    const transfer = parseFloat(reservation.transfer_amount) || 0;
    const estimate = parseFloat(reservation.estimate_amount) || 0;
    const totalPaid = cash + transfer;
    if (estimate > 0 || totalPaid > 0) {
      const pay = createEl('div', 'r-card__pay');
      const parts = [];
      if (estimate > 0) parts.push('<span class="r-card__pay-estimate">Preventivo €' + Math.round(estimate) + '</span>');
      if (totalPaid > 0) parts.push('<span class="r-card__pay-paid">Incassato €' + Math.round(totalPaid) + '</span>');
      pay.innerHTML = parts.join(' · ');
      card.appendChild(pay);
    }

    // Notes
    const notes = cleanNotes(reservation.notes);
    if (notes) {
      const n = createEl('p', 'r-card__notes', notes);
      card.appendChild(n);
    }

    // Action buttons (visible on hover / always on mobile)
    const actions = createEl('div', 'r-card__actions');
    const editBtn = createEl('button', 'r-card__action r-card__action--edit');
    editBtn.type = 'button';
    editBtn.setAttribute('aria-label', 'Modifica');
    editBtn.innerHTML = '<i class="fas fa-pen"></i>';
    editBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (typeof window.editReservation === 'function') window.editReservation(reservation.id);
    });
    actions.appendChild(editBtn);

    const delBtn = createEl('button', 'r-card__action r-card__action--delete');
    delBtn.type = 'button';
    delBtn.setAttribute('aria-label', 'Elimina');
    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (typeof window.deleteReservation === 'function') window.deleteReservation(reservation.id);
    });
    actions.appendChild(delBtn);
    card.appendChild(actions);

    card.addEventListener('click', function () {
      if (typeof window.editReservation === 'function') window.editReservation(reservation.id);
    });

    return card;
  }

  // --- Render ---
  function renderSection(container, title, list) {
    if (!list.length) return;
    const section = createEl('section', 'r-cards-section');
    const titleEl = createEl('h5', 'r-cards-section__title', title);
    titleEl.setAttribute('data-count', list.length + (list.length === 1 ? ' prenotazione' : ' prenotazioni'));
    section.appendChild(titleEl);
    const grid = createEl('div', 'r-cards-grid');
    list.forEach(function (r) { grid.appendChild(buildCard(r)); });
    section.appendChild(grid);
    container.appendChild(section);
  }

  function filteredList() {
    const cSearch = clientFilterText.toLowerCase();
    const rSearch = roomFilterText.toLowerCase();
    return lastReservations.filter(function (r) {
      if (currentStatusFilter !== 'all') {
        const b = classifyReservation(r).bucket;
        if (b !== currentStatusFilter) return false;
      }
      if (cSearch) {
        const n = String(r.client_name || '').toLowerCase();
        if (!n.includes(cSearch)) return false;
      }
      if (rSearch) {
        const rn = String(r.room_number || '').toLowerCase();
        if (!rn.includes(rSearch)) return false;
      }
      return true;
    });
  }

  function updateStats() {
    const counts = { active: 0, soon: 0, future: 0, past: 0 };
    lastReservations.forEach(function (r) {
      const b = classifyReservation(r).bucket;
      if (counts[b] !== undefined) counts[b]++;
    });
    const byId = function (id) { return document.getElementById(id); };
    if (byId('stat-active')) byId('stat-active').textContent = counts.active;
    if (byId('stat-soon'))   byId('stat-soon').textContent   = counts.soon;
    if (byId('stat-future')) byId('stat-future').textContent = counts.future;
    if (byId('stat-past'))   byId('stat-past').textContent   = counts.past;

    // Highlight the matching stat chip as active
    document.querySelectorAll('.chip-stat').forEach(function (chip) {
      chip.classList.toggle('is-active', chip.dataset.filter === currentStatusFilter);
    });
  }

  function renderCards() {
    const container = document.getElementById('reservations-card-view');
    if (!container) return;
    container.innerHTML = '';

    const visible = sortReservations(filteredList());
    if (!visible.length) {
      container.appendChild(createEl('div', 'r-cards-empty', 'Nessuna prenotazione trovata'));
      updateStats();
      return;
    }

    // Group by bucket
    const groups = { active: [], soon: [], future: [], past: [] };
    visible.forEach(function (r) {
      const b = classifyReservation(r).bucket;
      (groups[b] || groups.past).push(r);
    });

    // When a specific filter is active, render without section headers
    if (currentStatusFilter !== 'all') {
      const grid = createEl('div', 'r-cards-grid');
      visible.forEach(function (r) { grid.appendChild(buildCard(r)); });
      container.appendChild(grid);
    } else {
      renderSection(container, 'In corso', groups.active);
      renderSection(container, 'Questa settimana', groups.soon);
      renderSection(container, 'Prossime', groups.future);
      renderSection(container, 'Storico', groups.past);
    }

    updateStats();
  }

  // --- Wire filters ---
  function wireFilters() {
    const clientInput = document.getElementById('history-client-search');
    const roomInput = document.getElementById('history-room-search');
    let t = null;
    if (clientInput) {
      clientInput.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { clientFilterText = clientInput.value.trim(); renderCards(); }, 150);
      });
    }
    if (roomInput) {
      roomInput.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { roomFilterText = roomInput.value.trim(); renderCards(); }, 150);
      });
    }

    // Status chip filters
    document.querySelectorAll('.chip-filter[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentStatusFilter = btn.dataset.filter;
        document.querySelectorAll('.chip-filter').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        renderCards();
      });
    });

    // Stats chips act as filters too
    document.querySelectorAll('.chip-stat[data-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        const f = chip.dataset.filter;
        currentStatusFilter = (currentStatusFilter === f) ? 'all' : f;
        document.querySelectorAll('.chip-filter').forEach(function (b) {
          const match = b.dataset.filter === currentStatusFilter;
          b.classList.toggle('is-active', match);
          b.setAttribute('aria-selected', match ? 'true' : 'false');
        });
        renderCards();
      });
    });
  }

  function installWrapper() {
    if (typeof window.updateReservationsHistory !== 'function') {
      return setTimeout(installWrapper, 50);
    }
    const original = window.updateReservationsHistory;
    window.updateReservationsHistory = function (reservations) {
      try { original.call(this, reservations); } catch (e) { console.error(e); }
      lastReservations = Array.isArray(reservations) ? reservations : [];
      try { renderCards(); } catch (e) { console.error('renderCards error:', e); }
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireFilters();
    installWrapper();
  });
})();

/* Spiaggia: monthly calendar view styled like the Registro.
 *   - rows = umbrellas
 *   - columns = days of the current month
 *   - bars = beach assignments spanning one or more days
 *   - click on a bar -> opens the linked reservation
 */
(function () {
  const state = {
    year: null,
    month: null,    // 0-based
    umbrellas: [],
    assignments: [],
  };

  function $(id) { return document.getElementById(id); }

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDate(s) { if (!s) return null; const d = new Date(s + 'T00:00:00'); return isNaN(d.getTime()) ? null : d; }

  function monthDates(year, month) {
    const days = new Date(year, month + 1, 0).getDate();
    const out = [];
    for (let i = 1; i <= days; i++) out.push(iso(new Date(year, month, i)));
    return out;
  }

  function monthName(month) {
    return new Date(2000, month, 1).toLocaleDateString('it-IT', { month: 'long' });
  }

  function dayAbbr(date) {
    return date.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '').toUpperCase();
  }

  function groupByRow(umbrellas) {
    const out = new Map();
    umbrellas.forEach(u => {
      const key = u.row_label || 'Fila';
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(u);
    });
    for (const arr of out.values()) {
      arr.sort((a, b) => (a.position || 0) - (b.position || 0) || a.code.localeCompare(b.code));
    }
    return out;
  }

  function firstDayOf(year, month) { return iso(new Date(year, month, 1)); }
  function lastDayOf(year, month) { return iso(new Date(year, month + 1, 0)); }

  async function loadMonth() {
    const monthStart = firstDayOf(state.year, state.month);
    const monthEnd = lastDayOf(state.year, state.month);
    const tasks = [];

    if (!state.umbrellas.length) {
      tasks.push(
        window.api.beach.umbrellas.getAll().then(u => { state.umbrellas = u || []; })
      );
    }
    // Month assignments (for the calendar view)
    tasks.push(
      window.api.beach.assignments.list({ from: monthStart, to: monthEnd })
        .then(a => { state.assignments = a || []; })
    );
    // All assignments (for pending detection across any period)
    tasks.push(
      window.api.beach.assignments.list()
        .then(a => { state.allAssignments = a || []; })
    );
    // All reservations (use shared cache if fresh)
    tasks.push(loadAllReservations().then(r => { state.reservations = r; }));

    await Promise.all(tasks);
    render();
    renderPending();
  }

  async function loadAllReservations() {
    const cache = window.__dataCache;
    if (cache && cache.reservations && (Date.now() - (cache.at || 0)) < 60 * 1000) {
      return cache.reservations;
    }
    return await window.api.reservations.getAll();
  }

  function renderHeader(dates) {
    const header = $('beach-days-header');
    if (!header) return;
    // Wipe all day cells except the first ("Ombr.")
    header.querySelectorAll('th:not(.room-cell)').forEach(el => el.remove());

    const todayStr = iso(new Date());
    dates.forEach(d => {
      const dd = new Date(d + 'T00:00:00');
      const th = document.createElement('th');
      th.className = 'date-header';
      if (dd.getDay() === 6) th.classList.add('saturday-column');
      if (d === todayStr) th.classList.add('today-header');
      th.innerHTML = '<div class="day-number">' + dd.getDate() + '</div><div class="day-abbr">' + dayAbbr(dd) + '</div>';
      header.appendChild(th);
    });
  }

  function buildBar(assignment, colSpan) {
    const r = assignment.reservation || {};
    const client = (r.client && r.client.name) || 'Cliente';
    const color = r.reservation_color || 'yellow';

    const bar = document.createElement('div');
    bar.className = 'reservation-bar reservation-color-' + color;
    bar.dataset.reservationId = r.id || '';
    bar.addEventListener('click', function (e) {
      e.stopPropagation();
      if (r.id && typeof window.editReservation === 'function') window.editReservation(r.id);
    });

    const body = document.createElement('div');
    body.className = 'reservation-body';
    const center = document.createElement('div');
    center.className = 'reservation-center';
    const name = document.createElement('div');
    name.className = 'reservation-client-name';
    name.textContent = client;
    center.appendChild(name);
    body.appendChild(center);
    bar.appendChild(body);
    return bar;
  }

  function renderRows(dates) {
    const tbody = $('beach-rows');
    if (!tbody) return;
    tbody.innerHTML = '';

    const groups = groupByRow(state.umbrellas);

    for (const [rowLabel, list] of groups) {
      // Row header
      const header = document.createElement('tr');
      header.className = 'floor-header';
      const th = document.createElement('td');
      th.colSpan = dates.length + 1;
      th.textContent = rowLabel;
      th.style.padding = '4px 8px';
      th.style.fontSize = '0.85rem';
      header.appendChild(th);
      tbody.appendChild(header);

      list.forEach(um => {
        const row = document.createElement('tr');

        const codeCell = document.createElement('td');
        codeCell.className = 'room-cell';
        codeCell.innerHTML = '<div class="room-number">' + um.code + '</div>';
        row.appendChild(codeCell);

        // Flag each day with the active assignment, if any
        const cellAssignments = new Array(dates.length).fill(null);
        state.assignments.forEach(a => {
          if (a.umbrella_id !== um.id) return;
          const start = a.start_date;
          const end = a.end_date;
          for (let i = 0; i < dates.length; i++) {
            if (dates[i] >= start && dates[i] <= end) cellAssignments[i] = a;
          }
        });

        // Emit cells, merging consecutive days of the same assignment
        let current = null;
        let startIdx = -1;
        for (let i = 0; i <= cellAssignments.length; i++) {
          const same = i < cellAssignments.length && cellAssignments[i] && current && cellAssignments[i].id === current.id;
          if (same) continue;

          if (current) {
            const endIdx = i - 1;
            const colSpan = endIdx - startIdx + 1;
            const td = document.createElement('td');
            td.colSpan = colSpan;
            td.className = 'reservation-cell';
            td.style.setProperty('--cols', colSpan);

            // Saturday stripes behind the bar
            const satIdxs = [];
            for (let k = 0; k < colSpan; k++) {
              const dd = new Date(dates[startIdx + k] + 'T00:00:00');
              if (dd.getDay() === 6) satIdxs.push(k);
            }
            if (satIdxs.length) {
              td.classList.add('includes-saturday');
              const stripes = document.createElement('div');
              stripes.className = 'reservation-bg-stripes';
              stripes.setAttribute('aria-hidden', 'true');
              const pctW = 100 / colSpan;
              satIdxs.forEach(k => {
                const s = document.createElement('div');
                s.className = 'reservation-bg-stripe';
                s.style.left = (k * pctW) + '%';
                s.style.width = pctW + '%';
                stripes.appendChild(s);
              });
              td.appendChild(stripes);
            }

            td.appendChild(buildBar(current, colSpan));
            row.appendChild(td);
          }

          if (i === cellAssignments.length) break;

          if (cellAssignments[i]) {
            current = cellAssignments[i];
            startIdx = i;
          } else {
            const cell = document.createElement('td');
            cell.dataset.date = dates[i];
            cell.dataset.umbrellaId = um.id;
            const dd = new Date(dates[i] + 'T00:00:00');
            if (dd.getDay() === 6) cell.classList.add('saturday-column');
            row.appendChild(cell);
            current = null;
          }
        }

        tbody.appendChild(row);
      });
    }
  }

  function render() {
    const dates = monthDates(state.year, state.month);
    const label = $('beach-month-display');
    if (label) label.textContent = monthName(state.month).charAt(0).toUpperCase() + monthName(state.month).slice(1) + ' ' + state.year;
    renderHeader(dates);
    renderRows(dates);
  }

  function renderPending() {
    const block = $('beach-pending-block');
    const listEl = $('beach-pending-list');
    const countEl = $('beach-pending-count');
    if (!block || !listEl) return;

    const reservations = state.reservations || [];
    const assignments = state.allAssignments || [];
    const withAssignment = new Set(assignments.map(a => a.reservation_id));

    const pending = reservations
      .filter(r => !r.deleted)
      .filter(r => r.has_beach == 1 || r.has_beach === true)
      .filter(r => !withAssignment.has(r.id))
      .sort((a, b) => {
        const ca = new Date(a.check_in_date || 0);
        const cb = new Date(b.check_in_date || 0);
        return ca - cb;
      });

    if (countEl) countEl.textContent = String(pending.length);

    if (!pending.length) {
      block.hidden = true;
      listEl.innerHTML = '';
      return;
    }
    block.hidden = false;
    listEl.innerHTML = '';

    pending.forEach(r => {
      const li = document.createElement('li');
      li.className = 'beach-pending__item';

      const left = document.createElement('div');
      left.className = 'beach-pending__main';
      const name = document.createElement('div');
      name.className = 'beach-pending__client';
      name.textContent = r.client_name || 'Cliente';
      left.appendChild(name);
      const meta = document.createElement('div');
      meta.className = 'beach-pending__meta';
      const shortDate = d => {
        if (!d) return '';
        const dd = new Date(d + 'T00:00:00');
        return dd.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
      };
      meta.innerHTML = '<i class="fas fa-building"></i> ' + (r.room_number || '-') +
        ' · <i class="far fa-calendar"></i> ' + shortDate(r.check_in_date) + ' → ' + shortDate(r.check_out_date);
      left.appendChild(meta);
      li.appendChild(left);

      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'beach-pending__cta';
      cta.innerHTML = '<i class="fas fa-umbrella-beach"></i> Assegna';
      li.appendChild(cta);

      li.addEventListener('click', function () {
        if (typeof window.editReservation === 'function') window.editReservation(r.id);
      });
      listEl.appendChild(li);
    });
  }

  function goToMonth(year, month) {
    if (month < 0) { month = 11; year -= 1; }
    else if (month > 11) { month = 0; year += 1; }
    state.year = year;
    state.month = month;
    loadMonth().catch(e => console.error('Beach load error:', e));
  }

  function goToday() {
    const d = new Date();
    goToMonth(d.getFullYear(), d.getMonth());
  }

  // Public entry point used by the navigation handler
  window.loadBeach = async function () {
    if (state.year == null) {
      const d = new Date();
      state.year = d.getFullYear();
      state.month = d.getMonth();
    }
    try {
      await loadMonth();
    } catch (err) {
      console.error('Beach load error:', err);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    const prev = $('beach-prev-month');
    const next = $('beach-next-month');
    const today = $('beach-today-btn');
    if (prev) prev.addEventListener('click', () => goToMonth(state.year, state.month - 1));
    if (next) next.addEventListener('click', () => goToMonth(state.year, state.month + 1));
    if (today) today.addEventListener('click', () => goToday());

    // Refresh when a reservation is saved (cache invalidation signal)
    document.addEventListener('beach-data-invalidated', function () {
      state.assignments = [];
      state.allAssignments = [];
      state.reservations = [];
      if (state.year != null) loadMonth();
    });
  });
})();

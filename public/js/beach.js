/* Spiaggia section: umbrella grid with date picker and occupancy. */
(function () {
  let umbrellasCache = null;

  function todayISO() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function groupByRow(umbrellas) {
    const map = new Map();
    umbrellas.forEach(u => {
      const key = u.row_label || 'Fila';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(u);
    });
    for (const list of map.values()) list.sort((a, b) => (a.position || 0) - (b.position || 0) || a.code.localeCompare(b.code));
    return map;
  }

  async function loadUmbrellas() {
    if (umbrellasCache) return umbrellasCache;
    umbrellasCache = await window.api.beach.umbrellas.getAll();
    return umbrellasCache;
  }

  function formatDateLong(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function render() {
    const dateInput = document.getElementById('beach-date');
    if (!dateInput.value) dateInput.value = todayISO();
    const date = dateInput.value;

    const [umbrellas, assignments] = await Promise.all([
      loadUmbrellas(),
      window.api.beach.assignments.list({ date })
    ]);

    const occupied = new Map();
    (assignments || []).forEach(a => {
      occupied.set(a.umbrella_id, a);
    });

    const total = umbrellas.length;
    const busy = (assignments || []).length;
    const free = total - busy;

    const subtitleEl = document.getElementById('beach-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent =
        formatDateLong(date) + ' · ' + busy + '/' + total + ' occupati · ' + free + ' liberi';
      subtitleEl.style.textTransform = 'capitalize';
    }

    const grid = document.getElementById('beach-grid');
    grid.innerHTML = '';
    const groups = groupByRow(umbrellas);
    for (const [row, list] of groups) {
      const rowEl = document.createElement('div');
      rowEl.className = 'beach-row';
      const label = document.createElement('div');
      label.className = 'beach-row__label';
      label.textContent = row;
      rowEl.appendChild(label);
      const cells = document.createElement('div');
      cells.className = 'beach-row__cells';
      list.forEach(u => {
        const ass = occupied.get(u.id);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'beach-cell' + (ass ? ' beach-cell--busy' : ' beach-cell--free');
        cell.dataset.umbrellaId = u.id;
        cell.title = u.code + (ass ? ' · occupato' : ' · libero');
        cell.innerHTML = '<i class="fas fa-umbrella-beach"></i><span class="beach-cell__code">' + u.code + '</span>';
        cell.addEventListener('click', function () {
          showDetails(u, ass);
        });
        cells.appendChild(cell);
      });
      rowEl.appendChild(cells);
      grid.appendChild(rowEl);
    }

    hideDetails();
  }

  function showDetails(umbrella, assignment) {
    const el = document.getElementById('beach-details');
    if (!el) return;
    el.hidden = false;
    el.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'beach-details__title';
    title.innerHTML = '<i class="fas fa-umbrella-beach"></i> Ombrellone <strong>' + umbrella.code + '</strong>' +
      (umbrella.row_label ? ' · ' + umbrella.row_label : '');
    el.appendChild(title);

    if (!assignment) {
      const free = document.createElement('div');
      free.className = 'beach-details__status beach-details__status--free';
      free.textContent = 'Libero in questa data';
      el.appendChild(free);
      return;
    }
    const r = assignment.reservation;
    const clientName = r && r.client ? r.client.name : 'Cliente';
    const clientPhone = r && r.client ? r.client.phone : null;

    const busy = document.createElement('div');
    busy.className = 'beach-details__status beach-details__status--busy';
    busy.textContent = 'Occupato · dal ' + assignment.start_date + ' al ' + assignment.end_date;
    el.appendChild(busy);

    const who = document.createElement('div');
    who.className = 'beach-details__client';
    who.innerHTML = '<strong></strong>' + (clientPhone ? ' · <a href="tel:' + String(clientPhone).replace(/[^0-9+]/g, '') + '">' + clientPhone + '</a>' : '');
    who.querySelector('strong').textContent = clientName;
    el.appendChild(who);

    if (r && r.check_in_date) {
      const stay = document.createElement('div');
      stay.className = 'beach-details__stay';
      stay.textContent = 'Soggiorno: ' + r.check_in_date + ' → ' + r.check_out_date;
      el.appendChild(stay);
    }

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'btn btn-sm btn-outline-primary mt-2';
    openBtn.innerHTML = '<i class="fas fa-external-link-alt me-1"></i> Apri prenotazione';
    openBtn.addEventListener('click', function () {
      if (r && r.id && typeof window.editReservation === 'function') window.editReservation(r.id);
    });
    el.appendChild(openBtn);
  }

  function hideDetails() {
    const el = document.getElementById('beach-details');
    if (el) { el.hidden = true; el.innerHTML = ''; }
  }

  // Exposed so the navigation handler can call it
  window.loadBeach = function () {
    const dateInput = document.getElementById('beach-date');
    if (dateInput && !dateInput.value) dateInput.value = todayISO();
    render();
  };

  document.addEventListener('DOMContentLoaded', function () {
    const dateInput = document.getElementById('beach-date');
    if (dateInput) {
      dateInput.value = todayISO();
      dateInput.addEventListener('change', render);
    }
    // Initial render if section is visible at load (it's not by default)
    const section = document.getElementById('beach');
    if (section && section.classList.contains('active')) render();
  });
})();

/* Overview page ("New"): KPIs + Chart.js graphs + actionable lists.
 * Overrides the legacy loadDashboardData() so no server changes are required. */
(function () {
  const MS_DAY = 86400000;
  const charts = {}; // keep chart instances to destroy before redrawing

  function todayISO() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function toISODate(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yy + '-' + mm + '-' + dd;
  }
  function parseDate(s) {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function daysBetween(a, b) {
    return Math.round((b - a) / MS_DAY);
  }
  function formatDate(d, opts) {
    return d.toLocaleDateString('it-IT', opts || { day: '2-digit', month: 'short' });
  }
  function formatMoney(n) {
    return Math.round(Number(n) || 0).toLocaleString('it-IT');
  }
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // --- Data fetch with shared cache ---
  // window.__dataCache stores { rooms, reservations, at } so other sections
  // (Prenotazioni, Registro) can render instantly from memory while a
  // background refresh keeps the data fresh.
  const CACHE_TTL = 60 * 1000;
  function getCache() {
    return window.__dataCache || (window.__dataCache = { rooms: null, reservations: null, at: 0 });
  }
  function isCacheFresh() {
    const c = getCache();
    return c.rooms && c.reservations && (Date.now() - c.at) < CACHE_TTL;
  }
  async function fetchAll(options) {
    const force = options && options.force;
    const c = getCache();
    if (!force && isCacheFresh()) {
      return { rooms: c.rooms, reservations: c.reservations };
    }
    const [roomsRes, reservationsRes] = await Promise.all([
      window.api.rooms.getAll(),
      window.api.reservations.getAll()
    ]);
    c.rooms = Array.isArray(roomsRes) ? roomsRes : [];
    c.reservations = Array.isArray(reservationsRes) ? reservationsRes : [];
    c.at = Date.now();
    // Let other pages know new data is available
    document.dispatchEvent(new CustomEvent('data-cache-updated', { detail: { at: c.at } }));
    return { rooms: c.rooms, reservations: c.reservations };
  }
  // Expose so other scripts can reuse the cache
  window.__prefetchData = fetchAll;

  // --- KPIs ---
  function computeKPIs(rooms, reservations) {
    const today = todayISO();
    const todayStr = toISODate(today);
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

    let arrivalsToday = 0, departuresToday = 0;
    let arrivalsWeek = 0, departuresWeek = 0;
    let future = 0;

    const occupiedRoomIds = new Set();

    reservations.forEach(r => {
      const ci = parseDate(r.check_in_date);
      const co = parseDate(r.check_out_date);
      if (!ci || !co) return;

      if (r.check_in_date === todayStr) arrivalsToday++;
      if (r.check_out_date === todayStr) departuresToday++;

      if (ci >= today && ci <= weekEnd) arrivalsWeek++;
      if (co >= today && co <= weekEnd) departuresWeek++;

      if (ci <= today && co > today) occupiedRoomIds.add(r.room_id);
      if (ci > today) future++;
    });

    const totalRooms = rooms.length;
    const occupied = occupiedRoomIds.size;
    const free = Math.max(totalRooms - occupied, 0);
    const rate = totalRooms ? Math.round((occupied / totalRooms) * 100) : 0;

    return {
      totalRooms, occupied, free, rate,
      arrivalsToday, departuresToday, arrivalsWeek, departuresWeek,
      future
    };
  }

  function renderKPIs(k) {
    setText('kpi-occupancy-rate', k.rate);
    setText('kpi-occupied', k.occupied);
    setText('kpi-free', k.free);
    const bar = document.getElementById('kpi-occupancy-bar');
    if (bar) bar.style.width = k.rate + '%';
    setText('kpi-arrivals-today', k.arrivalsToday);
    setText('kpi-arrivals-week', k.arrivalsWeek);
    setText('kpi-departures-today', k.departuresToday);
    setText('kpi-departures-week', k.departuresWeek);
    setText('kpi-future-count', k.future);

    const today = new Date();
    setText('overview-today', today.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    setText('overview-subtitle', k.totalRooms + ' appartamenti · ' + k.rate + '% occupati oggi');
  }

  // --- Lists ---
  function renderLists(reservations) {
    const today = todayISO();
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

    const upcomingCheckins = reservations
      .filter(r => { const ci = parseDate(r.check_in_date); return ci && ci >= today && ci <= weekEnd; })
      .sort((a, b) => parseDate(a.check_in_date) - parseDate(b.check_in_date));

    const upcomingCheckouts = reservations
      .filter(r => { const co = parseDate(r.check_out_date); return co && co >= today && co <= weekEnd; })
      .sort((a, b) => parseDate(a.check_out_date) - parseDate(b.check_out_date));

    // Active / future reservations with a residual balance
    const pending = reservations
      .map(r => {
        const est = parseFloat(r.estimate_amount) || 0;
        const paid = (parseFloat(r.cash_amount) || 0) + (parseFloat(r.transfer_amount) || 0);
        return { r, diff: est - paid };
      })
      .filter(x => {
        if (x.diff <= 0.01) return false;
        const co = parseDate(x.r.check_out_date);
        return co && co > today; // only include not-yet-past stays
      })
      .sort((a, b) => parseDate(a.r.check_in_date) - parseDate(b.r.check_in_date))
      .slice(0, 12);

    renderReservationList('list-upcoming-checkins', upcomingCheckins, 'check_in_date');
    renderReservationList('list-upcoming-checkouts', upcomingCheckouts, 'check_out_date');
    renderPendingList('list-pending-payments', pending);

    setText('list-checkins-count', upcomingCheckins.length);
    setText('list-checkouts-count', upcomingCheckouts.length);
    setText('list-pending-count', pending.length);
  }

  function listItem() {
    const li = document.createElement('li');
    li.className = 'list-card__item';
    return li;
  }

  function renderReservationList(id, list, dateField) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    if (!list.length) {
      const li = listItem();
      li.innerHTML = '<span class="list-card__empty">Nessuna prenotazione</span>';
      el.appendChild(li);
      return;
    }
    list.slice(0, 8).forEach(r => {
      const d = parseDate(r[dateField]);
      const diff = daysBetween(todayISO(), d);
      const pill = diff === 0 ? 'Oggi' : (diff === 1 ? 'Domani' : 'Tra ' + diff + 'g');
      const li = listItem();
      li.innerHTML =
        '<div class="list-card__date">' +
          '<span class="list-card__day">' + d.getDate() + '</span>' +
          '<span class="list-card__month">' + d.toLocaleDateString('it-IT', { month: 'short' }).toUpperCase() + '</span>' +
        '</div>' +
        '<div class="list-card__main">' +
          '<div class="list-card__title"></div>' +
          '<div class="list-card__meta"><i class="fas fa-building"></i> ' +
            escapeHTML(r.room_number || '-') + ' · <i class="fas fa-user"></i> ' +
            (r.num_people || 1) + '</div>' +
        '</div>' +
        '<span class="list-card__pill">' + pill + '</span>';
      // escape client name safely
      const titleEl = li.querySelector('.list-card__title');
      if (titleEl) titleEl.textContent = r.client_name || 'Cliente';
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => window.editReservation && window.editReservation(r.id));
      el.appendChild(li);
    });
  }

  function renderPendingList(id, items) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    if (!items.length) {
      const li = listItem();
      li.innerHTML = '<span class="list-card__empty">Tutte pagate 🎉</span>';
      el.appendChild(li);
      return;
    }
    items.forEach(x => {
      const r = x.r;
      const li = listItem();
      li.innerHTML =
        '<div class="list-card__main">' +
          '<div class="list-card__title"></div>' +
          '<div class="list-card__meta"><i class="fas fa-building"></i> ' +
            escapeHTML(r.room_number || '-') + ' · check-in ' +
            formatDate(parseDate(r.check_in_date)) + '</div>' +
        '</div>' +
        '<span class="list-card__amount">€' + formatMoney(x.diff) + '</span>';
      const titleEl = li.querySelector('.list-card__title');
      if (titleEl) titleEl.textContent = r.client_name || 'Cliente';
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => window.editReservation && window.editReservation(r.id));
      el.appendChild(li);
    });
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // --- Orchestration ---
  async function renderOverview() {
    try {
      const { rooms, reservations } = await fetchAll();
      // Filter out soft-deleted reservations
      const live = reservations.filter(r => !r.deleted);
      const k = computeKPIs(rooms, live);
      renderKPIs(k);
      renderLists(live);
    } catch (err) {
      console.error('Overview render error:', err);
      setText('overview-subtitle', 'Errore durante il caricamento dei dati.');
    }
  }

  function installOverride() {
    // Override the legacy loader used by the navigation code
    window.loadDashboardData = renderOverview;
  }

  document.addEventListener('DOMContentLoaded', function () {
    installOverride();
    // If the dashboard is visible at boot, render now
    const dashboard = document.getElementById('dashboard');
    if (dashboard && dashboard.classList.contains('active')) {
      renderOverview();
    }
  });
})();

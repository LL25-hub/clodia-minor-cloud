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

  // --- Data fetch ---
  async function fetchAll() {
    const [roomsRes, reservationsRes] = await Promise.all([
      window.api.rooms.getAll(),
      window.api.reservations.getAll()
    ]);
    return {
      rooms: Array.isArray(roomsRes) ? roomsRes : [],
      reservations: Array.isArray(reservationsRes) ? reservationsRes : []
    };
  }

  // --- KPIs ---
  function computeKPIs(rooms, reservations) {
    const today = todayISO();
    const todayStr = toISODate(today);
    const year = today.getFullYear();
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

    let arrivalsToday = 0, departuresToday = 0;
    let arrivalsWeek = 0, departuresWeek = 0;
    let future = 0, pending = 0, pendingCount = 0;
    let earnedYear = 0, estimateYear = 0;

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

      // Revenue: only consider reservations that are active this year
      if (ci.getFullYear() === year || co.getFullYear() === year) {
        const est = parseFloat(r.estimate_amount) || 0;
        const paid = (parseFloat(r.cash_amount) || 0) + (parseFloat(r.transfer_amount) || 0);
        estimateYear += est;
        earnedYear += paid;
        const diff = est - paid;
        if (diff > 0 && ci <= weekEnd) {
          // Only count "da incassare" on reservations happening soon-ish
        }
        if (diff > 0) {
          pending += diff;
          pendingCount++;
        }
      }
    });

    const totalRooms = rooms.length;
    const occupied = occupiedRoomIds.size;
    const free = Math.max(totalRooms - occupied, 0);
    const rate = totalRooms ? Math.round((occupied / totalRooms) * 100) : 0;

    return {
      totalRooms, occupied, free, rate,
      arrivalsToday, departuresToday, arrivalsWeek, departuresWeek,
      future, pending, pendingCount, earnedYear, estimateYear
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
    setText('kpi-earned', formatMoney(k.earnedYear));
    setText('kpi-estimate', formatMoney(k.estimateYear));
    setText('kpi-pending', formatMoney(k.pending));
    setText('kpi-pending-count', k.pendingCount);
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

    const pending = reservations
      .map(r => {
        const est = parseFloat(r.estimate_amount) || 0;
        const paid = (parseFloat(r.cash_amount) || 0) + (parseFloat(r.transfer_amount) || 0);
        return { r, diff: est - paid };
      })
      .filter(x => x.diff > 0.01 && parseDate(x.r.check_in_date) && parseDate(x.r.check_out_date) > today)
      .sort((a, b) => parseDate(a.r.check_in_date) - parseDate(b.r.check_in_date))
      .slice(0, 8);

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

  // --- Charts ---
  function accent() { return '#0071e3'; }

  function destroyChart(key) {
    if (charts[key]) { try { charts[key].destroy(); } catch (_) {} delete charts[key]; }
  }

  function drawOccupancy30d(rooms, reservations) {
    const el = document.getElementById('chart-occupancy-30d');
    if (!el || typeof Chart === 'undefined') return;
    destroyChart('occ30');
    const total = Math.max(rooms.length, 1);
    const labels = []; const data = [];
    const today = todayISO();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      labels.push(d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }));
      const occupiedSet = new Set();
      reservations.forEach(r => {
        const ci = parseDate(r.check_in_date), co = parseDate(r.check_out_date);
        if (!ci || !co) return;
        if (ci <= d && co > d) occupiedSet.add(r.room_id);
      });
      data.push(Math.round((occupiedSet.size / total) * 100));
    }
    const ctx = el.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, 'rgba(0,113,227,0.35)');
    grad.addColorStop(1, 'rgba(0,113,227,0)');
    charts.occ30 = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Occupazione %',
          data,
          borderColor: accent(),
          backgroundColor: grad,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + '%' } } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,0.06)' } },
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false } }
        }
      }
    });
  }

  function drawPaymentStatus(reservations) {
    const el = document.getElementById('chart-payments');
    if (!el || typeof Chart === 'undefined') return;
    destroyChart('pay');
    let paid = 0, partial = 0, unpaid = 0;
    reservations.forEach(r => {
      const est = parseFloat(r.estimate_amount) || 0;
      const got = (parseFloat(r.cash_amount) || 0) + (parseFloat(r.transfer_amount) || 0);
      if (est <= 0 && got <= 0) return;
      if (got >= est && est > 0) paid++;
      else if (got > 0) partial++;
      else unpaid++;
    });
    charts.pay = new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Pagato', 'Parziale', 'Da pagare'],
        datasets: [{
          data: [paid, partial, unpaid],
          backgroundColor: ['#30d158', '#ff9f0a', '#ff3b30'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, padding: 12 } } }
      }
    });
  }

  function drawBookingsPerMonth(reservations) {
    const el = document.getElementById('chart-bookings-per-month');
    if (!el || typeof Chart === 'undefined') return;
    destroyChart('months');
    const year = new Date().getFullYear();
    const counts = new Array(12).fill(0);
    reservations.forEach(r => {
      const ci = parseDate(r.check_in_date);
      if (!ci || ci.getFullYear() !== year) return;
      counts[ci.getMonth()]++;
    });
    const labels = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    charts.months = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{
        label: 'Prenotazioni',
        data: counts,
        backgroundColor: accent(),
        borderRadius: 6,
        maxBarThickness: 40
      }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(0,0,0,0.06)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function drawTopRooms(rooms, reservations) {
    const el = document.getElementById('chart-top-rooms');
    if (!el || typeof Chart === 'undefined') return;
    destroyChart('topRooms');
    const countByRoomId = new Map();
    reservations.forEach(r => {
      if (!r.room_id) return;
      countByRoomId.set(r.room_id, (countByRoomId.get(r.room_id) || 0) + 1);
    });
    const sorted = Array.from(countByRoomId.entries())
      .map(([id, count]) => {
        const room = rooms.find(x => x.id === id);
        return { label: room ? room.room_number : '#' + id, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    charts.topRooms = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: { labels: sorted.map(x => x.label), datasets: [{
        data: sorted.map(x => x.count),
        backgroundColor: '#1d1d1f',
        borderRadius: 6,
        maxBarThickness: 26
      }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x + ' prenotazioni' } } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { grid: { display: false } }
        }
      }
    });
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
      drawOccupancy30d(rooms, live);
      drawPaymentStatus(live);
      drawBookingsPerMonth(live);
      drawTopRooms(rooms, live);
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

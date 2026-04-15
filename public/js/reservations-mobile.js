/* Reservations section: mobile card view with priority ordering.
 *
 * Wraps the global updateReservationsHistory() so that every time the
 * "Prenotazioni" table is rendered we ALSO paint a card-oriented view
 * that is visible on small screens. The table view stays on desktop.
 *
 * Priority order (topmost = most relevant):
 *   1. In corso oggi (check-in <= today < check-out)
 *   2. Check-in nei prossimi 7 giorni
 *   3. Check-out nei prossimi 7 giorni
 *   4. Future oltre 7 giorni, ordinate per data di arrivo
 *   5. Passate (più recenti prima)
 */
(function () {
  const MS_DAY = 86400000;

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
    if (!d) return '';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }

  function formatFullDate(s) {
    const d = parseDate(s);
    if (!d) return '';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / MS_DAY);
  }

  function classifyReservation(res) {
    const today = todayStart();
    const ci = parseDate(res.check_in_date);
    const co = parseDate(res.check_out_date);
    if (!ci || !co) return { bucket: 5, key: 0, status: 'unknown', label: '' };

    // In corso: check-in passato, check-out futuro o oggi
    if (ci <= today && co > today) {
      return { bucket: 0, key: co.getTime(), status: 'active', label: 'In corso' };
    }
    // Check-in oggi
    if (daysBetween(today, ci) === 0) {
      return { bucket: 1, key: ci.getTime(), status: 'check-in-today', label: 'Arriva oggi' };
    }
    // Check-out oggi
    if (daysBetween(today, co) === 0) {
      return { bucket: 1, key: co.getTime(), status: 'check-out-today', label: 'Parte oggi' };
    }
    // In arrivo entro 7 giorni
    const daysToCI = daysBetween(today, ci);
    if (daysToCI > 0 && daysToCI <= 7) {
      return { bucket: 2, key: ci.getTime(), status: 'upcoming', label: `Tra ${daysToCI}g` };
    }
    // In partenza entro 7 giorni
    const daysToCO = daysBetween(today, co);
    if (daysToCO > 0 && daysToCO <= 7) {
      return { bucket: 2, key: co.getTime(), status: 'leaving', label: `Parte tra ${daysToCO}g` };
    }
    // Future oltre 7 giorni
    if (ci > today) {
      return { bucket: 3, key: ci.getTime(), status: 'future', label: formatShortDate(res.check_in_date) };
    }
    // Passate
    return { bucket: 4, key: -ci.getTime(), status: 'past', label: 'Passata' };
  }

  function sortReservations(reservations) {
    return reservations.slice().sort(function (a, b) {
      const ca = classifyReservation(a);
      const cb = classifyReservation(b);
      if (ca.bucket !== cb.bucket) return ca.bucket - cb.bucket;
      return ca.key - cb.key;
    });
  }

  function cleanNotes(notes) {
    if (!notes) return '';
    return String(notes).replace(/\s*\|\s*Preventivo: €[0-9.]+/, '').trim();
  }

  function createBadge(text, variant) {
    const span = document.createElement('span');
    span.className = 'r-badge r-badge-' + (variant || 'default');
    span.textContent = text;
    return span;
  }

  function createIconBadge(iconClass, text, variant) {
    const span = document.createElement('span');
    span.className = 'r-badge r-badge-' + (variant || 'default');
    const i = document.createElement('i');
    i.className = iconClass;
    span.appendChild(i);
    if (text) {
      const t = document.createTextNode(' ' + text);
      span.appendChild(t);
    }
    return span;
  }

  function buildCard(reservation) {
    const card = document.createElement('article');
    card.className = 'r-card';
    card.dataset.id = reservation.id;

    const info = classifyReservation(reservation);
    card.classList.add('r-card--' + info.status);

    const color = (reservation.reservation_color || 'yellow').toLowerCase();
    card.classList.add('r-card--color-' + color);

    // --- Header row: status label + client name + num people ---
    const header = document.createElement('header');
    header.className = 'r-card__header';

    if (info.label) {
      const statusPill = document.createElement('span');
      statusPill.className = 'r-card__status';
      statusPill.textContent = info.label;
      header.appendChild(statusPill);
    }

    const title = document.createElement('h6');
    title.className = 'r-card__title';
    title.textContent = reservation.client_name || 'Cliente';
    header.appendChild(title);

    const numPeople = reservation.num_people ||
      (parseInt(reservation.adults || 0) + parseInt(reservation.children || 0)) || 1;
    const people = document.createElement('span');
    people.className = 'r-card__people';
    people.innerHTML = '<i class="fas fa-user"></i> ' + numPeople;
    header.appendChild(people);

    card.appendChild(header);

    // --- Apartment + dates ---
    const meta = document.createElement('div');
    meta.className = 'r-card__meta';

    const apt = document.createElement('span');
    apt.className = 'r-card__apt';
    apt.innerHTML = '<i class="fas fa-building"></i> ' +
      (reservation.room_number || '-') +
      (reservation.room_type ? ' · <span class="r-card__apt-type">' + reservation.room_type + '</span>' : '');
    meta.appendChild(apt);

    const dates = document.createElement('span');
    dates.className = 'r-card__dates';
    dates.innerHTML = '<i class="far fa-calendar"></i> ' +
      formatShortDate(reservation.check_in_date) + ' → ' +
      formatShortDate(reservation.check_out_date);
    meta.appendChild(dates);

    card.appendChild(meta);

    // --- Badges: spiaggia, caparra, riferimento, pagamento ---
    const badges = document.createElement('div');
    badges.className = 'r-card__badges';

    const isPaid = reservation.is_paid == 1 || reservation.is_paid === true;
    badges.appendChild(
      isPaid
        ? createIconBadge('fas fa-check', 'Pagato', 'success')
        : createIconBadge('fas fa-circle', 'Da pagare', 'danger')
    );
    if (reservation.has_beach == 1) {
      badges.appendChild(createIconBadge('fas fa-umbrella-beach', 'Spiaggia', 'info'));
    }
    if (reservation.has_deposit == 1) {
      badges.appendChild(createIconBadge('fas fa-money-bill-wave', 'Caparra', 'warning'));
    }
    if (reservation.reference) {
      badges.appendChild(createIconBadge('fas fa-tag', reservation.reference, 'default'));
    }

    card.appendChild(badges);

    // --- Payment summary (only what matters) ---
    const cash = parseFloat(reservation.cash_amount) || 0;
    const transfer = parseFloat(reservation.transfer_amount) || 0;
    const estimate = parseFloat(reservation.estimate_amount) || 0;
    const totalPaid = cash + transfer;

    if (estimate > 0 || totalPaid > 0) {
      const pay = document.createElement('div');
      pay.className = 'r-card__pay';
      const parts = [];
      if (estimate > 0) {
        parts.push('<span class="r-card__pay-estimate">€' + Math.round(estimate) + '</span>');
      }
      if (totalPaid > 0) {
        parts.push('<span class="r-card__pay-paid">Incassato €' + Math.round(totalPaid) + '</span>');
      }
      pay.innerHTML = parts.join(' · ');
      card.appendChild(pay);
    }

    // --- Notes (short, one-line) ---
    const notes = cleanNotes(reservation.notes);
    if (notes) {
      const n = document.createElement('p');
      n.className = 'r-card__notes';
      n.textContent = notes;
      card.appendChild(n);
    }

    // --- Tap to edit ---
    card.addEventListener('click', function () {
      if (typeof window.editReservation === 'function') {
        window.editReservation(reservation.id);
      }
    });

    return card;
  }

  function renderSection(container, title, reservations) {
    if (reservations.length === 0) return;
    const section = document.createElement('section');
    section.className = 'r-cards-section';

    const h = document.createElement('h5');
    h.className = 'r-cards-section__title';
    h.textContent = title;
    section.appendChild(h);

    reservations.forEach(function (r) {
      section.appendChild(buildCard(r));
    });

    container.appendChild(section);
  }

  function renderCards(reservations) {
    const container = document.getElementById('reservations-card-view');
    if (!container) return;
    container.innerHTML = '';

    if (!reservations || reservations.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'r-cards-empty';
      empty.textContent = 'Nessuna prenotazione trovata';
      container.appendChild(empty);
      return;
    }

    const sorted = sortReservations(reservations);
    // Group by bucket for section headers
    const groups = { active: [], today: [], soon: [], future: [], past: [] };
    sorted.forEach(function (r) {
      const info = classifyReservation(r);
      if (info.bucket === 0) groups.active.push(r);
      else if (info.bucket === 1) groups.today.push(r);
      else if (info.bucket === 2) groups.soon.push(r);
      else if (info.bucket === 3) groups.future.push(r);
      else groups.past.push(r);
    });

    renderSection(container, 'In corso', groups.active);
    renderSection(container, 'Oggi', groups.today);
    renderSection(container, 'Questa settimana', groups.soon);
    renderSection(container, 'Prossime', groups.future);
    renderSection(container, 'Storico', groups.past);
  }

  function installWrapper() {
    if (typeof window.updateReservationsHistory !== 'function') {
      // Retry until app.js has defined the function
      return setTimeout(installWrapper, 50);
    }
    const original = window.updateReservationsHistory;
    window.updateReservationsHistory = function (reservations) {
      try { original.call(this, reservations); } catch (e) { console.error(e); }
      try { renderCards(reservations); } catch (e) { console.error('renderCards error:', e); }
    };
  }

  document.addEventListener('DOMContentLoaded', installWrapper);
})();

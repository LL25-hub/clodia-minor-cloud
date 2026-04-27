/* Print system — rebuilt from scratch.
 *
 * Strategy: build a self-contained HTML document inside a hidden iframe and
 * call print() on it. This way the print layout is completely isolated from
 * the app's screen CSS, so we get deterministic A4-landscape pages with the
 * exact widths/heights we need — no flex collapse, no overflow surprises.
 *
 * Two flows are supported:
 *   - Registro:   prints the currently visible month (rooms × days)
 *   - Spiaggia:   prints either the current month or the current + next month
 *                 (umbrellas × days, mode = "1" | "2")
 */
(function () {
  // ---------- shared helpers ----------
  const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const WEEKDAYS_IT = ['DO','LU','MA','ME','GI','VE','SA'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function monthDates(year, month) {
    const days = new Date(year, month + 1, 0).getDate();
    const out = [];
    for (let i = 1; i <= days; i++) out.push(iso(new Date(year, month, i)));
    return out;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function reverseDigits(n) { return String(n).split('').reverse().join(''); }

  function refDayMonthOnly(reference) {
    if (!reference) return '';
    const s = String(reference).trim();
    // Strip a trailing "/yyyy" or "-yy" segment
    return s.replace(/[\/\-.]\d{2,4}$/, '');
  }

  // ---------- data fetching ----------
  async function fetchRoomsAndReservations() {
    const cache = window.__dataCache;
    if (cache && cache.rooms && cache.reservations &&
        (Date.now() - (cache.at || 0)) < 60000) {
      return { rooms: cache.rooms, reservations: cache.reservations };
    }
    const [rooms, reservations] = await Promise.all([
      window.api.rooms.getAll(),
      window.api.reservations.getAll()
    ]);
    if (window.__dataCache) {
      window.__dataCache.rooms = rooms;
      window.__dataCache.reservations = reservations;
      window.__dataCache.at = Date.now();
    }
    return { rooms, reservations };
  }

  async function fetchUmbrellasAndAssignments(year, month) {
    const monthStart = iso(new Date(year, month, 1));
    const monthEnd = iso(new Date(year, month + 1, 0));
    const [umbrellas, assignments] = await Promise.all([
      window.api.beach.umbrellas.getAll(),
      window.api.beach.assignments.list({ from: monthStart, to: monthEnd })
    ]);
    return { umbrellas, assignments };
  }

  // ---------- registro renderer ----------
  function buildRegistroHtml(year, month, rooms, reservations) {
    const dates = monthDates(year, month);
    const dayCount = dates.length;
    const monthLabel = MONTHS_IT[month] + ' ' + year;

    // Group rooms by floor (preserve common ordering)
    const FLOOR_ORDER = ['Piano Terra','Primo Piano','Secondo Piano','Terzo Piano','Quarto Piano','Altro'];
    const byFloor = new Map();
    rooms.forEach(r => {
      const f = r.floor || 'Altro';
      if (!byFloor.has(f)) byFloor.set(f, []);
      byFloor.get(f).push(r);
    });
    for (const arr of byFloor.values()) arr.sort((a,b) => String(a.room_number).localeCompare(String(b.room_number), 'it', { numeric: true }));

    // colgroup widths in % so the whole month fits horizontally
    const umbrellaPct = 5;
    const dayPct = (100 - umbrellaPct) / dayCount;

    let html = '';
    // Header row: day numbers + abbr
    html += '<table class="reg-table"><colgroup>';
    html += '<col class="col-room">';
    for (let i = 0; i < dayCount; i++) html += '<col class="col-day">';
    html += '</colgroup>';
    html += '<thead><tr><th class="room-cell">App.</th>';
    dates.forEach(d => {
      const dd = new Date(d + 'T00:00:00');
      const isSat = dd.getDay() === 6;
      html += '<th class="day-h' + (isSat ? ' sat' : '') + '">' +
              '<div class="day-n">' + dd.getDate() + '</div>' +
              '<div class="day-a">' + WEEKDAYS_IT[dd.getDay()] + '</div></th>';
    });
    html += '</tr></thead><tbody>';

    const monthFirst = dates[0];
    const monthLast = dates[dates.length - 1];

    FLOOR_ORDER.forEach(floor => {
      const list = byFloor.get(floor);
      if (!list || !list.length) return;
      html += '<tr class="floor-row"><td colspan="' + (dayCount + 1) + '">' + escapeHtml(floor) + '</td></tr>';
      list.forEach(room => {
        // For each day, find which reservation covers it (skip deleted)
        const cellRes = new Array(dayCount).fill(null);
        reservations.forEach(r => {
          if (r.deleted) return;
          if (r.room_id !== room.id) return;
          const ci = r.check_in_date, co = r.check_out_date;
          if (!ci || !co) return;
          for (let i = 0; i < dayCount; i++) {
            if (dates[i] >= ci && dates[i] < co) cellRes[i] = r;
          }
        });

        html += '<tr class="room-row"><td class="room-cell">' + escapeHtml(room.room_number) + '</td>';
        // Walk and group consecutive same-reservation cells
        let i = 0;
        while (i < dayCount) {
          if (!cellRes[i]) {
            const dd = new Date(dates[i] + 'T00:00:00');
            const cls = dd.getDay() === 6 ? ' sat' : '';
            html += '<td class="empty' + cls + '"></td>';
            i++;
          } else {
            const cur = cellRes[i];
            let j = i;
            while (j < dayCount && cellRes[j] && cellRes[j].id === cur.id) j++;
            const span = j - i;
            // Compute saturday positions inside the span (for grey stripes)
            const satIdx = [];
            for (let k = 0; k < span; k++) {
              const dd = new Date(dates[i + k] + 'T00:00:00');
              if (dd.getDay() === 6) satIdx.push(k);
            }
            const color = (cur.reservation_color || 'yellow').toLowerCase();
            const fromPrev = cur.check_in_date < monthFirst;
            const toNext = cur.check_out_date > monthLast;

            const refDM = escapeHtml(refDayMonthOnly(cur.reference));
            const est = parseFloat(cur.estimate_amount) || 0;
            const priceRev = est > 0 ? reverseDigits(Math.round(est)) : '';
            const name = escapeHtml(cur.client_name || 'Cliente');

            // Decide which labels to show based on span (priority: name > price > ref)
            const showRef = span >= 5 && refDM;
            const showPrice = span >= 4 && priceRev;

            // Saturday stripes background
            let stripes = '';
            if (satIdx.length) {
              const w = 100 / span;
              satIdx.forEach(k => {
                stripes += '<div class="bg-stripe" style="left:' + (k*w) + '%;width:' + w + '%;"></div>';
              });
            }

            html += '<td class="bar-cell ' + color + (fromPrev ? ' from-prev' : '') + (toNext ? ' to-next' : '') + '" colspan="' + span + '">';
            html += stripes;
            html += '<div class="bar">';
            if (showRef) html += '<span class="bar-ref">' + refDM + '</span>';
            html += '<span class="bar-name">' + name + '</span>';
            if (showPrice) html += '<span class="bar-price">' + priceRev + '</span>';
            html += '</div></td>';
            i = j;
          }
        }
        html += '</tr>';
      });
    });

    html += '</tbody></table>';

    return wrapPrintDocument(monthLabel, html, registroCss(dayCount));
  }

  function registroCss(dayCount) {
    // Layout budget for A4 landscape (297×210mm) with 3mm @page margins:
    //   available height ≈ 204mm
    //   month title ............... 4mm
    //   thead row ................. 4mm
    //   5 floor rows × 2.8mm ...... 14mm
    //   30 room rows × 4.9mm ...... 147mm
    //   border collapse + slack ... ~25mm
    // → fits comfortably on one page.
    return `
      @page { size: 297mm 210mm; margin: 3mm; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000;
        font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
        -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .month-title { text-align: center; font-size: 10pt; font-weight: 700; margin: 0 0 1mm; text-transform: capitalize; line-height: 1; }
      .reg-table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; break-inside: avoid; }
      .reg-table tr { page-break-inside: avoid; break-inside: avoid; }
      .reg-table col.col-room { width: 5%; }
      .reg-table col.col-day { width: ${(95/dayCount).toFixed(4)}%; }
      .reg-table th, .reg-table td {
        border: 1px solid #888;
        padding: 0;
        font-size: 6.5pt;
        line-height: 1;
        vertical-align: middle;
        overflow: hidden;
      }
      .reg-table thead th { background: #fff; height: 4mm; padding: 0; }
      .reg-table .day-h .day-n { font-size: 6.5pt; font-weight: 700; }
      .reg-table .day-h .day-a { font-size: 4.5pt; color: #555; }
      .reg-table .day-h.sat { background: #7f7f7f !important; }
      .reg-table .room-cell { font-weight: 700; font-size: 8pt; text-align: center; padding: 0 2px; background: #fff; }
      .reg-table .floor-row td { background: #7f7f7f !important; font-weight: 700; font-size: 7pt; text-align: left; padding: 0 4px; height: 2.8mm; color: #000; }
      .reg-table tr.room-row td { height: 4.9mm; }
      .reg-table td.empty.sat { background: #7f7f7f !important; }
      .reg-table td.bar-cell { position: relative; padding: 0; background: transparent; }
      .reg-table td.bar-cell .bg-stripe { position: absolute; top: 0; bottom: 0; background: #7f7f7f; }
      .reg-table td.bar-cell .bar {
        position: relative; z-index: 2;
        margin: 0.2mm 0; height: calc(100% - 0.4mm);
        display: flex; align-items: center; justify-content: center; gap: 3px;
        padding: 0 3px;
        font-size: 7pt; font-weight: 700; line-height: 1;
        border: 1px solid #888;
      }
      .reg-table td.bar-cell.yellow .bar { background: #c5c5c5; color: #000; border-color: #8a8a8a; }
      .reg-table td.bar-cell.orange .bar { background: #fff; color: #000; border: 1px dashed #8a8a8a; }
      .reg-table td.bar-cell.blue   .bar { background: #0a84ff; color: #fff; border-color: #004a99; }
      .reg-table td.bar-cell.from-prev .bar { border-top-left-radius: 0; border-bottom-left-radius: 0; border-left-width: 3px; }
      .reg-table td.bar-cell.to-next   .bar { border-top-right-radius: 0; border-bottom-right-radius: 0; border-right-width: 3px; }
      .reg-table .bar-name { font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: clip; min-width: 0; }
      .reg-table .bar-ref { font-size: 5.5pt; background: rgba(0,0,0,0.15); padding: 0 3px; border-radius: 3px; white-space: nowrap; }
      .reg-table .bar-price { font-size: 7pt; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
    `;
  }

  // ---------- spiaggia renderer ----------
  function buildSpiaggiaMonthBlock(year, month, umbrellas, assignments) {
    const dates = monthDates(year, month);
    const dayCount = dates.length;
    const monthLabel = MONTHS_IT[month] + ' ' + year;

    const byRow = new Map();
    umbrellas.forEach(u => {
      const k = u.row_label || 'Fila';
      if (!byRow.has(k)) byRow.set(k, []);
      byRow.get(k).push(u);
    });
    for (const arr of byRow.values()) arr.sort((a,b) => (a.position||0) - (b.position||0) || a.code.localeCompare(b.code));

    let html = '<div class="month-block"><div class="month-title">' + monthLabel + '</div>';
    html += '<table class="reg-table"><colgroup>';
    html += '<col class="col-room">';
    for (let i = 0; i < dayCount; i++) html += '<col class="col-day">';
    html += '</colgroup>';
    html += '<thead><tr><th class="room-cell">Ombr.</th>';
    dates.forEach(d => {
      const dd = new Date(d + 'T00:00:00');
      const isSat = dd.getDay() === 6;
      html += '<th class="day-h' + (isSat ? ' sat' : '') + '">' +
              '<div class="day-n">' + dd.getDate() + '</div>' +
              '<div class="day-a">' + WEEKDAYS_IT[dd.getDay()] + '</div></th>';
    });
    html += '</tr></thead><tbody>';

    for (const [rowLabel, list] of byRow) {
      html += '<tr class="floor-row"><td colspan="' + (dayCount + 1) + '">' + escapeHtml(rowLabel) + '</td></tr>';
      list.forEach(um => {
        const cellAss = new Array(dayCount).fill(null);
        assignments.forEach(a => {
          if (a.umbrella_id !== um.id) return;
          for (let i = 0; i < dayCount; i++) {
            if (dates[i] >= a.start_date && dates[i] <= a.end_date) cellAss[i] = a;
          }
        });
        html += '<tr class="room-row"><td class="room-cell">' + escapeHtml(um.code) + '</td>';
        let i = 0;
        while (i < dayCount) {
          if (!cellAss[i]) {
            const dd = new Date(dates[i] + 'T00:00:00');
            const cls = dd.getDay() === 6 ? ' sat' : '';
            html += '<td class="empty' + cls + '"></td>';
            i++;
          } else {
            const cur = cellAss[i];
            let j = i;
            while (j < dayCount && cellAss[j] && cellAss[j].id === cur.id) j++;
            const span = j - i;
            const r = cur.reservation || {};
            const color = (r.reservation_color || 'yellow').toLowerCase();
            const name = escapeHtml((r.client && r.client.name) || 'Cliente');
            html += '<td class="bar-cell ' + color + '" colspan="' + span + '">';
            html += '<div class="bar"><span class="bar-name">' + name + '</span></div>';
            html += '</td>';
            i = j;
          }
        }
        html += '</tr>';
      });
    }
    html += '</tbody></table></div>';
    return html;
  }

  function buildSpiaggiaHtml(blocks, dayCount, monthCount) {
    // Pick row height so n umbrellas (~30) + headers fit on one page.
    // For 2-month mode we have to halve the per-row height roughly.
    const rowH = monthCount === 2 ? 2.6 : 4.9;
    const floorH = monthCount === 2 ? 2.2 : 2.8;
    const titleSize = monthCount === 2 ? 8 : 10;
    const css = `
      @page { size: 297mm 210mm; margin: 3mm; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000;
        font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
        -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sheet { display: flex; flex-direction: column; gap: 2mm; }
      .month-block { display: block; page-break-inside: avoid; break-inside: avoid; }
      .month-title { text-align: center; font-size: ${titleSize}pt; font-weight: 700; margin: 0 0 1mm; text-transform: capitalize; line-height: 1; }
      .reg-table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; break-inside: avoid; }
      .reg-table tr { page-break-inside: avoid; break-inside: avoid; }
      .reg-table col.col-room { width: 5%; }
      .reg-table col.col-day { width: ${(95/dayCount).toFixed(4)}%; }
      .reg-table th, .reg-table td {
        border: 1px solid #888;
        padding: 0;
        font-size: 6.5pt;
        line-height: 1;
        vertical-align: middle;
        overflow: hidden;
      }
      .reg-table thead th { background: #fff; height: 4mm; padding: 0; }
      .reg-table .day-h .day-n { font-size: 6.5pt; font-weight: 700; }
      .reg-table .day-h .day-a { font-size: 4.5pt; color: #555; }
      .reg-table .day-h.sat { background: #7f7f7f !important; }
      .reg-table .room-cell { font-weight: 700; font-size: 8pt; text-align: center; padding: 0 2px; background: #fff; }
      .reg-table .floor-row td { background: #7f7f7f !important; font-weight: 700; font-size: 7pt; text-align: left; padding: 0 4px; height: ${floorH}mm; color: #000; }
      .reg-table tr.room-row td { height: ${rowH}mm; }
      .reg-table td.empty.sat { background: #7f7f7f !important; }
      .reg-table td.bar-cell { position: relative; padding: 0; }
      .reg-table td.bar-cell .bar {
        margin: 0.2mm 0; height: calc(100% - 0.4mm);
        display: flex; align-items: center; justify-content: center;
        padding: 0 2px;
        font-size: 6.5pt; font-weight: 700; line-height: 1;
        border: 1px solid #888;
      }
      .reg-table td.bar-cell.yellow .bar { background: #c5c5c5; color: #000; border-color: #8a8a8a; }
      .reg-table td.bar-cell.orange .bar { background: #fff; color: #000; border: 1px dashed #8a8a8a; }
      .reg-table td.bar-cell.blue   .bar { background: #0a84ff; color: #fff; border-color: #004a99; }
      .reg-table .bar-name { overflow: hidden; white-space: nowrap; text-overflow: clip; }
    `;
    return wrapPrintDocument('Spiaggia', '<div class="sheet">' + blocks.join('') + '</div>', css);
  }

  function wrapPrintDocument(title, body, css) {
    return '<!doctype html><html lang="it"><head><meta charset="utf-8"><title>' + escapeHtml(title) +
      '</title><style>' + css + '</style></head><body>' +
      (body.includes('month-title') || body.includes('sheet') ? body : '<div class="month-title">' + escapeHtml(title) + '</div>' + body) +
      '</body></html>';
  }

  // ---------- print pipeline ----------
  function openInIframeAndPrint(html) {
    return new Promise(resolve => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText =
        'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      const finish = () => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { console.error(e); }
        // Remove the iframe a bit later so the print dialog has time to read it
        setTimeout(() => { try { iframe.remove(); } catch (_) {} resolve(); }, 1500);
      };
      // Wait for the iframe document to be ready
      if (iframe.contentWindow.document.readyState === 'complete') setTimeout(finish, 50);
      else iframe.addEventListener('load', () => setTimeout(finish, 50));
    });
  }

  async function printRegistro() {
    const ay = (window.appState && window.appState.currentYear) || new Date().getFullYear();
    const am = (window.appState && window.appState.currentMonth) || new Date().getMonth();
    const { rooms, reservations } = await fetchRoomsAndReservations();
    const html = buildRegistroHtml(ay, am, rooms || [], reservations || []);
    await openInIframeAndPrint(html);
  }

  async function printSpiaggia(mode) {
    const now = new Date();
    const y1 = now.getFullYear(), m1 = now.getMonth();
    const blocks = [];
    const { umbrellas: u1, assignments: a1 } = await fetchUmbrellasAndAssignments(y1, m1);
    blocks.push(buildSpiaggiaMonthBlock(y1, m1, u1, a1));
    let dayCount = monthDates(y1, m1).length;
    let monthCount = 1;
    if (mode === '2') {
      const next = new Date(y1, m1 + 1, 1);
      const y2 = next.getFullYear(), m2 = next.getMonth();
      const { umbrellas: u2, assignments: a2 } = await fetchUmbrellasAndAssignments(y2, m2);
      blocks.push(buildSpiaggiaMonthBlock(y2, m2, u2, a2));
      dayCount = Math.max(dayCount, monthDates(y2, m2).length);
      monthCount = 2;
    }
    const html = buildSpiaggiaHtml(blocks, dayCount, monthCount);
    await openInIframeAndPrint(html);
  }

  // ---------- bind buttons ----------
  document.addEventListener('click', async function (e) {
    const btn = e.target.closest && e.target.closest('.print-btn');
    if (!btn) return;
    e.preventDefault();
    btn.disabled = true;
    try {
      const section = btn.dataset.printSection || '';
      const mode = btn.dataset.printMode || '1';
      if (section === 'reservations') {
        await printRegistro();
      } else if (section === 'beach') {
        await printSpiaggia(mode);
      }
    } catch (err) {
      console.error('Print failed:', err);
      if (window.uiUtils) window.uiUtils.showToast('Errore durante la stampa: ' + (err.message || err), 'danger');
    } finally {
      btn.disabled = false;
    }
  });
})();

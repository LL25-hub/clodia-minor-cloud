/* Print system — rebuilt from scratch.
 *
 * Strategy: build a self-contained HTML document inside a hidden iframe and
 * call print() on it. This way the print layout is completely isolated from
 * the app's screen CSS, so we get deterministic A4-landscape pages with the
 * exact widths/heights we need — no flex collapse, no overflow surprises.
 *
 * The "Stampa" button on the Registro produces a 2-page document:
 *   page 1 — Registro:  rooms × days for the currently visible month
 *   page 2 — Spiaggia:  umbrellas × days for the same month
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
  function buildRegistroTable(year, month, rooms, reservations) {
    const dates = monthDates(year, month);
    const dayCount = dates.length;

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

    // Header row used both at the top (thead) and at the bottom (tfoot)
    const headerRow = (() => {
      let h = '<tr><th class="room-cell">App.</th>';
      dates.forEach(d => {
        const dd = new Date(d + 'T00:00:00');
        const isSat = dd.getDay() === 6;
        h += '<th class="day-h' + (isSat ? ' sat' : '') + '">' +
             '<div class="day-n">' + dd.getDate() + '</div>' +
             '<div class="day-a">' + WEEKDAYS_IT[dd.getDay()] + '</div></th>';
      });
      h += '</tr>';
      return h;
    })();

    let html = '';
    html += '<table class="reg-table"><colgroup>';
    html += '<col class="col-room">';
    for (let i = 0; i < dayCount; i++) html += '<col class="col-day">';
    html += '</colgroup>';
    html += '<thead>' + headerRow + '</thead>';
    html += '<tbody>';

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
            const fullName = cur.client_name || 'Cliente';
            const firstWord = (fullName.match(/^\s*(\S+)/) || [, fullName])[1];
            const fullNameEsc = escapeHtml(fullName);
            const firstWordEsc = escapeHtml(firstWord);

            // Saturday stripes background
            let stripes = '';
            if (satIdx.length) {
              const w = 100 / span;
              satIdx.forEach(k => {
                stripes += '<div class="bg-stripe" style="left:' + (k*w) + '%;width:' + w + '%;"></div>';
              });
            }

            // Right-side icons (mirror app.js logic)
            const hasBeach = (cur.has_beach == 1 || cur.has_beach === true);
            const isPaid = (cur.is_paid == 1 || cur.is_paid === true);
            const hasDeposit = (cur.has_deposit == 1 || cur.has_deposit === true);
            const iconParts = [];
            if (hasBeach) iconParts.push('<i class="fas fa-umbrella-beach"></i>');
            if (isPaid) iconParts.push('<i class="fas fa-check-circle"></i>');
            if (hasDeposit && !isPaid) iconParts.push('<i class="fas fa-coins"></i>');
            const hasIcons = iconParts.length > 0;
            // Same heuristic as the screen: each visible label takes ~3 day-cells.
            const labelsCount = 1 /* name */ + (refDM ? 1 : 0) + (priceRev ? 1 : 0);
            const iconsThreshold = hasIcons ? Math.max(7, labelsCount * 3 + 1) : 0;
            const showIcons = hasIcons && span > iconsThreshold;

            // Tiered content based on available width:
            //   span ≥ 5 → ref (left) + full name (center) + price (right)
            //   span 3–4 → first name (left) + ref (right), no price
            //   span ≤ 2 → first name centered (no ref, no price)
            let mode = 'min';
            if (span >= 5) mode = 'full';
            else if (span >= 3) mode = 'compact';

            let bodyInner = '';
            if (mode === 'full') {
              if (refDM) bodyInner += '<span class="bar-ref">' + refDM + '</span>';
              bodyInner += '<span class="bar-name">' + fullNameEsc + '</span>';
              if (priceRev) bodyInner += '<span class="bar-price">' + priceRev + '</span>';
            } else if (mode === 'compact') {
              bodyInner += '<span class="bar-name">' + firstWordEsc + '</span>';
              if (refDM) bodyInner += '<span class="bar-ref">' + refDM + '</span>';
            } else {
              bodyInner += '<span class="bar-name">' + firstWordEsc + '</span>';
            }
            const iconsHtml = showIcons ? '<span class="bar-icons">' + iconParts.join('') + '</span>' : '';

            html += '<td class="bar-cell ' + color + (fromPrev ? ' from-prev' : '') + (toNext ? ' to-next' : '') + '"' +
                    ' style="--cols:' + span + '"' +
                    ' colspan="' + span + '">';
            html += stripes;
            html += '<div class="bar bar-' + mode + '">' +
                      '<span class="bar-body">' + bodyInner + '</span>' +
                      iconsHtml +
                    '</div></td>';
            i = j;
          }
        }
        html += '</tr>';
      });
    });

    html += '</tbody>';
    html += '<tfoot>' + headerRow + '</tfoot>';
    html += '</table>';

    return html;
  }

  // Compute row heights so the table fully fills an A4 landscape page.
  // Returns mm values for both Registro (page 1) and Spiaggia (page 2).
  function computeDims(roomCount, floorCount, umbrellaCount, beachRowCount) {
    const PAGE_H = 210;        // mm — A4 landscape height
    const PAGE_MARGIN = 6;     // mm — @page margin
    const TITLE_H = 7;         // mm — the month title is now ~16pt, taller
    const HEADER_H = 5;        // mm — thead and tfoot (slightly taller for legibility)
    const FLOOR_H = 3;         // mm — section header rows
    const SLACK = 4;           // mm — small safety so total never overflows

    const available = PAGE_H - 2 * PAGE_MARGIN - TITLE_H - 2 * HEADER_H - SLACK;

    const roomReserved  = floorCount * FLOOR_H;
    // Spiaggia no longer prints floor headers (each row is self-labelled).
    const beachReserved = 0;

    const roomH      = (available - roomReserved)  / Math.max(1, roomCount);
    const umbrellaH  = (available - beachReserved) / Math.max(1, umbrellaCount);

    return {
      roomH:      Math.max(4.5, Math.min(7,    roomH)).toFixed(2),
      umbrellaH:  Math.max(5.5, Math.min(10,   umbrellaH)).toFixed(2),
      floorH:     FLOOR_H.toFixed(2)
    };
  }

  function registroCss(dayCount, dims) {
    // Page geometry decided in computeDims(); CSS just consumes those mm.
    return `
      @page { size: A4 landscape; margin: 6mm; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000;
        font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
        -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .month-title {
        text-align: center; font-size: 16pt; font-weight: 800; margin: 0 0 2mm;
        text-transform: uppercase; letter-spacing: 0.5px; line-height: 1;
      }
      .reg-table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; break-inside: avoid; }
      .reg-table tr { page-break-inside: avoid; break-inside: avoid; }
      .reg-table col.col-room { width: 5%; }
      .reg-table col.col-day { width: ${(95/dayCount).toFixed(4)}%; }
      .reg-table th, .reg-table td {
        border: 1px solid #888;
        padding: 0;
        font-size: 8pt;
        line-height: 1;
        vertical-align: middle;
        overflow: hidden;
      }
      .reg-table thead th, .reg-table tfoot th { background: #fff; height: 5mm; padding: 0; }
      .reg-table .day-h .day-n { font-size: 8pt; font-weight: 700; }
      .reg-table .day-h .day-a { font-size: 5pt; color: #555; }
      .reg-table .day-h.sat { background: #7f7f7f !important; }
      .reg-table .room-cell { font-weight: 700; font-size: 9.5pt; text-align: center; padding: 0 2px; background: #fff; }
      .reg-table .floor-row td { background: #7f7f7f !important; font-weight: 700; font-size: 8.5pt; text-align: left; padding: 0 4px; height: ${dims.floorH}mm; color: #000; }
      .reg-table tr.room-row td { height: ${dims.roomH}mm; }
      /* Spiaggia (page 2): wider left column to fit "FILA N - X" labels,
         taller rows because there are no floor headers and fewer rows. */
      .page-spiaggia .reg-table col.col-room { width: 11%; }
      .page-spiaggia .reg-table col.col-day  { width: ${(89/dayCount).toFixed(4)}%; }
      .page-spiaggia .reg-table tr.room-row td { height: ${dims.umbrellaH}mm; }
      .page-spiaggia .reg-table .room-cell { font-size: 8.5pt; padding: 0 4px; }
      .reg-table td.empty.sat { background: #7f7f7f !important; }
      /* Bar cells must let their bar overhang into the neighbouring cells
         on each side (half-cell convention from the screen view). */
      .reg-table td.bar-cell {
        position: relative; padding: 0; background: transparent;
        overflow: visible;
      }
      .reg-table td.bar-cell .bg-stripe { position: absolute; top: 0; bottom: 0; background: #7f7f7f; z-index: 0; }
      .reg-table td.bar-cell .bar {
        position: absolute; z-index: 2;
        top: 0.4mm; bottom: 0.4mm;
        left:  calc(100% / var(--cols, 1) / 2);
        right: calc(-100% / var(--cols, 1) / 2);
        display: flex; align-items: center;
        padding: 0 5px;
        font-size: 9.5pt; font-weight: 700; line-height: 1;
        border: 1px solid #888;
        border-radius: 4px;
        box-sizing: border-box;
      }
      /* Cross-month: no overhang on the closed side, hard squared corner. */
      .reg-table td.bar-cell.from-prev .bar {
        left: 0;
        border-top-left-radius: 0; border-bottom-left-radius: 0; border-left-width: 3px;
      }
      .reg-table td.bar-cell.to-next .bar {
        right: 0;
        border-top-right-radius: 0; border-bottom-right-radius: 0; border-right-width: 3px;
      }
      /* Bar internal layout: body centered, icons pinned to the right. */
      .reg-table td.bar-cell .bar .bar-body {
        flex: 1 1 auto; min-width: 0;
        display: flex; align-items: center; gap: 4px;
        overflow: hidden;
      }
      .reg-table td.bar-cell .bar.bar-full    .bar-body { justify-content: center; }
      .reg-table td.bar-cell .bar.bar-compact .bar-body { justify-content: space-between; }
      .reg-table td.bar-cell .bar.bar-min     .bar-body { justify-content: center; }
      .reg-table td.bar-cell .bar .bar-icons {
        flex: 0 0 auto;
        display: flex; align-items: center; gap: 3px;
        padding-left: 5px;
        font-size: 9pt;
      }
      .reg-table td.bar-cell .bar .bar-icons i { line-height: 1; }
      /* Colour palette */
      .reg-table td.bar-cell.yellow .bar { background: #c5c5c5; color: #000; border-color: #8a8a8a; }
      .reg-table td.bar-cell.orange .bar { background: #fff; color: #000; border: 1px dashed #8a8a8a; }
      .reg-table td.bar-cell.blue   .bar { background: #0a84ff; color: #fff; border-color: #004a99; }
      .reg-table .bar-name { font-weight: 700; font-size: 9.5pt; overflow: hidden; white-space: nowrap; text-overflow: clip; min-width: 0; }
      .reg-table .bar-ref { font-size: 8pt; font-weight: 700; background: rgba(0,0,0,0.15); padding: 0 4px; border-radius: 3px; white-space: nowrap; }
      .reg-table .bar-price { font-size: 9.5pt; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
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

    const headerRow = (() => {
      let h = '<tr><th class="room-cell">Ombr.</th>';
      dates.forEach(d => {
        const dd = new Date(d + 'T00:00:00');
        const isSat = dd.getDay() === 6;
        h += '<th class="day-h' + (isSat ? ' sat' : '') + '">' +
             '<div class="day-n">' + dd.getDate() + '</div>' +
             '<div class="day-a">' + WEEKDAYS_IT[dd.getDay()] + '</div></th>';
      });
      h += '</tr>';
      return h;
    })();

    let html = '<div class="month-block"><div class="month-title">' + monthLabel + '</div>';
    html += '<table class="reg-table"><colgroup>';
    html += '<col class="col-room">';
    for (let i = 0; i < dayCount; i++) html += '<col class="col-day">';
    html += '</colgroup>';
    html += '<thead>' + headerRow + '</thead>';
    html += '<tbody>';

    // No floor-row separators on the Spiaggia page — each umbrella row
    // includes its fila in the leftmost cell ("FILA 2 - 3").
    for (const [, list] of byRow) {
      list.forEach(um => {
        const cellAss = new Array(dayCount).fill(null);
        assignments.forEach(a => {
          if (a.umbrella_id !== um.id) return;
          for (let i = 0; i < dayCount; i++) {
            if (dates[i] >= a.start_date && dates[i] <= a.end_date) cellAss[i] = a;
          }
        });
        const label = um.row_label && !/^generic/i.test(um.row_label)
          ? String(um.row_label).toUpperCase() + ' - ' + um.code
          : um.code;
        html += '<tr class="room-row"><td class="room-cell">' + escapeHtml(label) + '</td>';
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
            const fullName = (r.client && r.client.name) || 'Cliente';
            const firstWord = (fullName.match(/^\s*(\S+)/) || [, fullName])[1];
            const refDM = escapeHtml(refDayMonthOnly(r.reference));

            let mode = 'min', bodyInner = '';
            if (span >= 5) mode = 'full';
            else if (span >= 3) mode = 'compact';

            if (mode === 'full') {
              if (refDM) bodyInner += '<span class="bar-ref">' + refDM + '</span>';
              bodyInner += '<span class="bar-name">' + escapeHtml(fullName) + '</span>';
            } else if (mode === 'compact') {
              bodyInner += '<span class="bar-name">' + escapeHtml(firstWord) + '</span>';
              if (refDM) bodyInner += '<span class="bar-ref">' + refDM + '</span>';
            } else {
              bodyInner += '<span class="bar-name">' + escapeHtml(firstWord) + '</span>';
            }

            html += '<td class="bar-cell ' + color + '"' +
                    ' style="--cols:' + span + '"' +
                    ' colspan="' + span + '">';
            html += '<div class="bar bar-' + mode + '">' +
                      '<span class="bar-body">' + bodyInner + '</span>' +
                    '</div>';
            html += '</td>';
            i = j;
          }
        }
        html += '</tr>';
      });
    }
    html += '</tbody>';
    html += '<tfoot>' + headerRow + '</tfoot>';
    html += '</table></div>';
    return html;
  }

  function buildSpiaggiaHtml(blocks, dayCount, monthCount) {
    // Each month-block has a thead + tfoot (4mm each) + content.
    // For 2-month mode we need to fit ~2 × (~30 umbrellas + headers + footers) → tighter rows.
    const rowH = monthCount === 2 ? 2.5 : 5;
    const floorH = monthCount === 2 ? 2.2 : 3;
    const titleSize = monthCount === 2 ? 9 : 11;
    const headerH = monthCount === 2 ? 3.5 : 4.5;
    const fontBar = monthCount === 2 ? 6.5 : 8;
    const fontRef = monthCount === 2 ? 5 : 6.5;
    const fontName = monthCount === 2 ? 6.5 : 8;
    const fontDay = monthCount === 2 ? 6 : 7.5;
    const fontDayA = monthCount === 2 ? 4.5 : 5;
    const fontRoom = monthCount === 2 ? 7 : 9;
    const fontFloor = monthCount === 2 ? 6.5 : 8;
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
        font-size: ${fontBar}pt;
        line-height: 1;
        vertical-align: middle;
        overflow: hidden;
      }
      .reg-table thead th, .reg-table tfoot th { background: #fff; height: ${headerH}mm; padding: 0; }
      .reg-table .day-h .day-n { font-size: ${fontDay}pt; font-weight: 700; }
      .reg-table .day-h .day-a { font-size: ${fontDayA}pt; color: #555; }
      .reg-table .day-h.sat { background: #7f7f7f !important; }
      .reg-table .room-cell { font-weight: 700; font-size: ${fontRoom}pt; text-align: center; padding: 0 2px; background: #fff; }
      .reg-table .floor-row td { background: #7f7f7f !important; font-weight: 700; font-size: ${fontFloor}pt; text-align: left; padding: 0 4px; height: ${floorH}mm; color: #000; }
      .reg-table tr.room-row td { height: ${rowH}mm; }
      .reg-table td.empty.sat { background: #7f7f7f !important; }
      .reg-table td.bar-cell { position: relative; padding: 0; }
      .reg-table td.bar-cell .bar {
        margin: 0.2mm 0; height: calc(100% - 0.4mm);
        display: flex; align-items: center; gap: 3px;
        padding: 0 3px;
        font-size: ${fontBar}pt; font-weight: 700; line-height: 1;
        border: 1px solid #888;
      }
      .reg-table td.bar-cell .bar.bar-full    { justify-content: center; }
      .reg-table td.bar-cell .bar.bar-compact { justify-content: space-between; }
      .reg-table td.bar-cell .bar.bar-min     { justify-content: center; }
      .reg-table td.bar-cell.yellow .bar { background: #c5c5c5; color: #000; border-color: #8a8a8a; }
      .reg-table td.bar-cell.orange .bar { background: #fff; color: #000; border: 1px dashed #8a8a8a; }
      .reg-table td.bar-cell.blue   .bar { background: #0a84ff; color: #fff; border-color: #004a99; }
      .reg-table .bar-name { font-weight: 700; overflow: hidden; white-space: nowrap; text-overflow: clip; min-width: 0; }
      .reg-table .bar-ref { font-size: ${fontRef}pt; background: rgba(0,0,0,0.15); padding: 0 3px; border-radius: 3px; white-space: nowrap; }
    `;
    return wrapPrintDocument('Spiaggia', '<div class="sheet">' + blocks.join('') + '</div>', css);
  }

  function wrapPrintDocument(title, body, css) {
    // Pull Font Awesome from the same CDN the app uses so we can show
    // the umbrella / paid / deposit icons inside the printed bars.
    const faLink = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">';
    return '<!doctype html><html lang="it"><head><meta charset="utf-8"><title>' + escapeHtml(title) +
      '</title>' + faLink + '<style>' + css + '</style></head><body>' +
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

      const triggerPrint = () => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
        catch (e) { console.error(e); }
        // Keep the iframe around long enough for the print dialog to read it
        setTimeout(() => { try { iframe.remove(); } catch (_) {} resolve(); }, 2000);
      };

      // Wait for the document AND any web fonts (Font Awesome) to be ready
      // before calling print(). Without this, some printers receive boxes
      // instead of icons because the font file hadn't downloaded yet.
      const waitForReady = () => {
        const cw = iframe.contentWindow;
        const proceed = () => {
          if (cw.document && cw.document.fonts && cw.document.fonts.ready) {
            cw.document.fonts.ready
              .then(() => setTimeout(triggerPrint, 100))
              .catch(() => setTimeout(triggerPrint, 300));
          } else {
            // Fallback for browsers without the Font Loading API
            setTimeout(triggerPrint, 400);
          }
        };
        if (cw.document.readyState === 'complete') proceed();
        else iframe.addEventListener('load', proceed, { once: true });
      };
      waitForReady();
    });
  }

  // ---------- combined registro + spiaggia (2-page document) ----------
  function buildRegistroAndSpiaggiaHtml(year, month, rooms, reservations, umbrellas, assignments) {
    const dates = monthDates(year, month);
    const dayCount = dates.length;
    const monthName = MONTHS_IT[month];
    const registroTitle = 'Prenotazioni ' + year + ' ' + monthName;
    const spiaggiaTitle = 'Spiaggia ' + year + ' ' + monthName;

    // Count distinct floors / row labels actually present in this dataset,
    // so the row-height math reflects what will be on the page.
    const floorCount = new Set(rooms.map(r => r.floor || 'Altro')).size || 1;
    const beachRowCount = new Set(umbrellas.map(u => u.row_label || 'Fila')).size || 1;
    const dims = computeDims(rooms.length, floorCount, umbrellas.length, beachRowCount);

    const registroTable = buildRegistroTable(year, month, rooms, reservations);
    const spiaggiaBlock = buildSpiaggiaMonthBlock(year, month, umbrellas, assignments);
    const spiaggiaWithLabel = spiaggiaBlock.replace(
      /<div class="month-title">[\s\S]*?<\/div>/,
      '<div class="month-title">' + escapeHtml(spiaggiaTitle) + '</div>'
    );

    const body =
      '<div class="page page-registro">' +
        '<div class="month-title">' + escapeHtml(registroTitle) + '</div>' +
        registroTable +
      '</div>' +
      '<div class="page page-spiaggia">' + spiaggiaWithLabel + '</div>';

    const css = registroCss(dayCount, dims) + `
      .page { page-break-after: always; break-after: page; }
      .page:last-child { page-break-after: auto; break-after: auto; }
    `;

    return wrapPrintDocument(registroTitle, body, css);
  }

  async function printRegistro() {
    const ay = (window.appState && window.appState.currentYear) || new Date().getFullYear();
    const am = (window.appState && window.appState.currentMonth) || new Date().getMonth();
    const [resData, beachData] = await Promise.all([
      fetchRoomsAndReservations(),
      fetchUmbrellasAndAssignments(ay, am)
    ]);
    const html = buildRegistroAndSpiaggiaHtml(
      ay, am,
      resData.rooms || [], resData.reservations || [],
      beachData.umbrellas || [], beachData.assignments || []
    );
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
      if (section === 'reservations') {
        await printRegistro();
      }
    } catch (err) {
      console.error('Print failed:', err);
      if (window.uiUtils) window.uiUtils.showToast('Errore durante la stampa: ' + (err.message || err), 'danger');
    } finally {
      btn.disabled = false;
    }
  });
})();

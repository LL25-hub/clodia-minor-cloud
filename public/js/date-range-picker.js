/* Date range picker for the dashboard "Appartamenti disponibili" search.
 * Uses Flatpickr (range mode). When both dates are picked the calendar
 * closes automatically and fires the availability search.
 */
(function () {
  function formatISO(d) {
    if (!d) return '';
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function formatHuman(d) {
    if (!d) return '';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function setHidden(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function init() {
    if (typeof flatpickr === 'undefined') {
      return setTimeout(init, 100);
    }
    initReferencePicker();
    const triggerInput = document.getElementById('available-range');
    if (!triggerInput) return;

    const locale = (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.it)
      ? flatpickr.l10ns.it : null;

    const fp = flatpickr(triggerInput, {
      mode: 'range',
      dateFormat: 'Y-m-d',
      locale: locale || undefined,
      minDate: 'today',
      showMonths: window.matchMedia('(min-width: 768px)').matches ? 2 : 1,
      disableMobile: true, // force the pretty UI even on mobile browsers
      onOpen: function () {
        triggerInput.blur();
      },
      onChange: function (selectedDates, dateStr, instance) {
        if (selectedDates.length === 2) {
          const [ci, co] = selectedDates;
          setHidden('available-check-in', formatISO(ci));
          setHidden('available-check-out', formatISO(co));
          triggerInput.value = formatHuman(ci) + ' → ' + formatHuman(co);
          instance.close();
          // Submit search automatically
          const form = document.getElementById('available-apartments-form');
          if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        } else if (selectedDates.length === 1) {
          setHidden('available-check-in', formatISO(selectedDates[0]));
          setHidden('available-check-out', '');
        } else {
          setHidden('available-check-in', '');
          setHidden('available-check-out', '');
        }
      }
    });

    // Make wrapper clickable (not just the input)
    const trigger = document.getElementById('date-range-trigger');
    if (trigger) {
      trigger.addEventListener('click', function (e) {
        if (e.target !== triggerInput) fp.open();
      });
    }
  }

  // Reference (single-day date picker) inside the reservation modal.
  function initReferencePicker() {
    const ref = document.getElementById('reference');
    if (!ref || ref.dataset.fpBound === '1') return;
    ref.dataset.fpBound = '1';
    const locale = (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.it) ? flatpickr.l10ns.it : null;
    flatpickr(ref, {
      dateFormat: 'd/m/Y',
      allowInput: false,
      locale: locale || undefined,
      disableMobile: true
    });
  }

  // Check-in / Check-out date pickers inside the reservation modal.
  // Replace the native HTML date input with a styled Flatpickr that opens
  // a calendar on tap (works the same on desktop and mobile).
  function initReservationDatePickers() {
    const ci = document.getElementById('check-in-date');
    const co = document.getElementById('check-out-date');
    if (!ci || !co) return;
    if (ci.dataset.fpBound === '1' && co.dataset.fpBound === '1') return;
    const locale = (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.it) ? flatpickr.l10ns.it : null;

    // Flatpickr requires plain text inputs to overlay nicely; force type=text
    if (ci.type === 'date') ci.type = 'text';
    if (co.type === 'date') co.type = 'text';

    const fpCi = flatpickr(ci, {
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd/m/Y',
      locale: locale || undefined,
      disableMobile: true,
      allowInput: false,
      onChange: function (selected) {
        if (!selected.length) return;
        // Make sure check-out is at least 1 day later
        const ciDate = selected[0];
        if (fpCo) {
          fpCo.set('minDate', ciDate);
          const co = document.getElementById('check-out-date');
          if (!co.value || new Date(co.value) <= ciDate) {
            const nd = new Date(ciDate); nd.setDate(nd.getDate() + 1);
            fpCo.setDate(nd, true);
          }
        }
      }
    });
    ci.dataset.fpBound = '1';

    const fpCo = flatpickr(co, {
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd/m/Y',
      locale: locale || undefined,
      disableMobile: true,
      allowInput: false
    });
    co.dataset.fpBound = '1';
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
    initReservationDatePickers();
  });
  // Re-init when the reservation modal is shown (in case Flatpickr lost binding)
  document.addEventListener('shown.bs.modal', function (e) {
    if (!e || !e.target) return;
    if (e.target.id === 'reservation-modal') initReservationDatePickers();
  });
})();

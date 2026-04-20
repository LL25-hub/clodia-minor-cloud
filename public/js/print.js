/* Print helper.
 * - Registro (reservations) prints the active month table at full page height.
 * - Spiaggia (beach) prints TWO months stacked (current + next) on the same
 *   A4 landscape page so the sheet is always filled.
 */
(function () {
  async function beforePrint(targetId) {
    document.body.setAttribute('data-print-target', targetId || '');

    if (targetId === 'beach' && typeof window.buildBeachMonthBlock === 'function') {
      // Build the 2-month print container and append it hidden until print
      const existing = document.getElementById('print-beach-months');
      if (existing) existing.remove();

      const container = document.createElement('div');
      container.id = 'print-beach-months';

      const now = new Date();
      const y1 = now.getFullYear();
      const m1 = now.getMonth();
      const nextDate = new Date(y1, m1 + 1, 1);
      const y2 = nextDate.getFullYear();
      const m2 = nextDate.getMonth();

      try {
        const b1 = await window.buildBeachMonthBlock(y1, m1);
        const b2 = await window.buildBeachMonthBlock(y2, m2);
        container.appendChild(b1);
        container.appendChild(b2);
        document.body.appendChild(container);
      } catch (e) {
        console.error('Failed to build beach print view:', e);
      }
    }
  }

  function afterPrint() {
    document.body.removeAttribute('data-print-target');
    const container = document.getElementById('print-beach-months');
    if (container) container.remove();
  }

  async function printSection(targetId) {
    try {
      const section = document.getElementById(targetId);
      if (section) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        section.classList.add('active');
      }
      await beforePrint(targetId);
      // Small delay to let layout settle
      setTimeout(() => window.print(), 80);
    } catch (e) {
      console.error('Print failed:', e);
    }
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.print-btn');
    if (!btn) return;
    e.preventDefault();
    printSection(btn.dataset.printSection || '');
  });

  window.addEventListener('afterprint', afterPrint);
})();

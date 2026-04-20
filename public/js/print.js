/* Print helper.
 *   - Registro: current month fills the A4 landscape page.
 *   - Spiaggia: two options (1 month full page, or 2 months stacked on 1 page).
 * Mode is read from the clicked button's data-print-mode attribute ('1' | '2').
 */
(function () {
  async function beforePrint(targetId, mode) {
    document.body.setAttribute('data-print-target', targetId || '');
    document.body.setAttribute('data-print-mode', mode || '');

    if (targetId === 'beach' && typeof window.buildBeachMonthBlock === 'function') {
      const existing = document.getElementById('print-beach-months');
      if (existing) existing.remove();

      const container = document.createElement('div');
      container.id = 'print-beach-months';

      const now = new Date();
      const y1 = now.getFullYear();
      const m1 = now.getMonth();

      try {
        const b1 = await window.buildBeachMonthBlock(y1, m1);
        container.appendChild(b1);

        if (mode === '2') {
          const nextDate = new Date(y1, m1 + 1, 1);
          const b2 = await window.buildBeachMonthBlock(nextDate.getFullYear(), nextDate.getMonth());
          container.appendChild(b2);
        }

        document.body.appendChild(container);
      } catch (e) {
        console.error('Failed to build beach print view:', e);
      }
    }
  }

  function afterPrint() {
    document.body.removeAttribute('data-print-target');
    document.body.removeAttribute('data-print-mode');
    const container = document.getElementById('print-beach-months');
    if (container) container.remove();
  }

  async function printSection(targetId, mode) {
    try {
      const section = document.getElementById(targetId);
      if (section) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        section.classList.add('active');
      }
      await beforePrint(targetId, mode);
      setTimeout(() => window.print(), 80);
    } catch (e) {
      console.error('Print failed:', e);
    }
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.print-btn');
    if (!btn) return;
    e.preventDefault();
    const section = btn.dataset.printSection || '';
    const mode = btn.dataset.printMode || '1';
    printSection(section, mode);
  });

  window.addEventListener('afterprint', afterPrint);
})();

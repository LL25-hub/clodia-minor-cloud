/* Print helper: prints the currently-visible section only.
 * Any button with class .print-btn fires window.print() after making sure
 * only its target section is active. */
(function () {
  function printSection(targetId) {
    try {
      const section = document.getElementById(targetId);
      if (section) {
        // Ensure it's the active/visible section
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        section.classList.add('active');
      }
      // Tag the body so @media print CSS knows what to show
      document.body.setAttribute('data-print-target', targetId || '');
      // Small delay to let styles settle
      setTimeout(() => window.print(), 50);
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

  // Clean up the tag after printing finishes
  window.addEventListener('afterprint', function () {
    document.body.removeAttribute('data-print-target');
  });
})();

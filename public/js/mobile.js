/* Mobile UX enhancements: off-canvas sidebar, dynamic topbar title, swipe-to-close. */
(function () {
  const MOBILE_BREAKPOINT = 768;
  const isMobile = () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 0.02}px)`).matches;

  function openSidebar() {
    document.body.classList.add('sidebar-open');
    const toggle = document.getElementById('mobile-menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    const toggle = document.getElementById('mobile-menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function toggleSidebar() {
    if (document.body.classList.contains('sidebar-open')) closeSidebar();
    else openSidebar();
  }

  function updateTopbarTitle(text) {
    const el = document.getElementById('mobile-topbar-title');
    if (el && text) el.textContent = text;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    const backdrop = document.getElementById('sidebar-backdrop');
    const refreshBtn = document.getElementById('mobile-refresh');

    if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);
    if (backdrop) {
      backdrop.removeAttribute('hidden');
      backdrop.addEventListener('click', closeSidebar);
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        // Trigger the current active nav item again to reload its section
        const active = document.querySelector('.list-group-item.active[data-section]');
        if (active) active.click();
        else window.location.reload();
      });
    }

    // Close sidebar when a menu item is tapped (on mobile)
    document.querySelectorAll('#sidebar-wrapper .list-group-item[data-section]').forEach(function (item) {
      item.addEventListener('click', function () {
        updateTopbarTitle(this.textContent.trim());
        if (isMobile()) setTimeout(closeSidebar, 100);
      });
    });

    // Close sidebar on escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSidebar();
    });

    // Close sidebar on orientation change / resize to desktop
    window.addEventListener('resize', function () {
      if (!isMobile()) closeSidebar();
    });

    // Initial topbar title = active nav item
    const activeItem = document.querySelector('.list-group-item.active[data-section]');
    if (activeItem) updateTopbarTitle(activeItem.textContent.trim());

    // Swipe-to-close gesture on sidebar
    const sidebar = document.getElementById('sidebar-wrapper');
    if (sidebar) {
      let startX = null;
      sidebar.addEventListener('touchstart', function (e) {
        if (!document.body.classList.contains('sidebar-open')) return;
        startX = e.touches[0].clientX;
      }, { passive: true });
      sidebar.addEventListener('touchmove', function (e) {
        if (startX === null) return;
        const dx = e.touches[0].clientX - startX;
        if (dx < -50) { closeSidebar(); startX = null; }
      }, { passive: true });
      sidebar.addEventListener('touchend', function () { startX = null; }, { passive: true });
    }
  });
})();

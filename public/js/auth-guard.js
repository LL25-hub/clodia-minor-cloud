/* Auth guard: verifies session at boot and intercepts 401 responses globally.
 * If not authenticated, redirects to /login.html preserving the current path. */
(function () {
  const LOGIN_URL = '/login.html';

  function redirectToLogin() {
    try {
      const current = location.pathname + location.search + location.hash;
      const next = encodeURIComponent(current);
      location.replace(LOGIN_URL + '?next=' + next);
    } catch (e) {
      location.replace(LOGIN_URL);
    }
  }

  // Don't run the guard on the login page itself
  if (/\/login\.html?$/i.test(location.pathname)) return;

  // Intercept fetch: any 401 from same-origin → force re-login
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    return originalFetch(input, init).then(function (res) {
      try {
        if (res && res.status === 401) {
          const u = typeof input === 'string' ? input : (input && input.url) || '';
          // Only redirect on our own API, not on cross-origin calls
          if (!u || u.startsWith('/') || u.indexOf(location.origin) === 0) {
            setTimeout(redirectToLogin, 0);
          }
        }
      } catch (_) {}
      return res;
    });
  };

  // Also intercept XHR (used by some libraries)
  const OrigXHR = window.XMLHttpRequest;
  if (OrigXHR) {
    const proto = OrigXHR.prototype;
    const origOpen = proto.open;
    const origSend = proto.send;
    proto.open = function (method, url) {
      this.__cm_url = url;
      return origOpen.apply(this, arguments);
    };
    proto.send = function () {
      this.addEventListener('readystatechange', function () {
        if (this.readyState === 4 && this.status === 401) {
          try {
            const u = this.__cm_url || '';
            if (!u || u.startsWith('/') || u.indexOf(location.origin) === 0) {
              setTimeout(redirectToLogin, 0);
            }
          } catch (_) {}
        }
      });
      return origSend.apply(this, arguments);
    };
  }

  // Initial session probe: fastest redirect when the cookie is missing
  originalFetch('/api/me', { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) redirectToLogin(); })
    .catch(function () { /* offline: leave it to other requests */ });

  // Wire the logout button once the DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    const link = document.getElementById('logout-link');
    if (!link) return;
    link.addEventListener('click', async function (e) {
      e.preventDefault();
      try {
        await originalFetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
      } catch (_) { /* ignore */ }
      redirectToLogin();
    });
  });
})();

/* Clients section: search-only mode with Apple-style contact cards. */
(function () {
  const DEBOUNCE_MS = 200;

  function getContainer() {
    return document.getElementById('clients-results');
  }

  function sanitizePhone(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    if (!s || s === '-' || s === '--') return '';
    // Strip spurious trailing ".0" (Excel/CSV import artifact)
    return s.replace(/\.0+$/, '').trim();
  }

  function phoneTelHref(phone) {
    const cleaned = sanitizePhone(phone);
    // Keep digits and leading +; pick first block if "123 / 456"
    const firstBlock = cleaned.split(/[\/\s,;]+/)[0] || cleaned;
    return firstBlock.replace(/[^0-9+]/g, '');
  }

  function initialsOf(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]).join('').toUpperCase();
  }

  function avatarColor(name) {
    // Stable pastel color from name hash
    let h = 0;
    for (let i = 0; i < (name || '').length; i++) {
      h = (h * 31 + name.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(h) % 360;
    return `hsl(${hue}, 55%, 88%)`;
  }

  function avatarTextColor(name) {
    let h = 0;
    for (let i = 0; i < (name || '').length; i++) {
      h = (h * 31 + name.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(h) % 360;
    return `hsl(${hue}, 55%, 32%)`;
  }

  function renderEmpty(msg) {
    const c = getContainer();
    if (!c) return;
    c.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'clients-results__empty';
    empty.textContent = msg;
    c.appendChild(empty);
  }

  function renderResults(clients) {
    const c = getContainer();
    if (!c) return;
    c.innerHTML = '';
    if (!clients || clients.length === 0) {
      renderEmpty('Nessun cliente trovato');
      return;
    }

    const list = document.createElement('div');
    list.className = 'client-list';

    clients.forEach(function (client) {
      const row = document.createElement('div');
      row.className = 'client-card';

      // Avatar with initials
      const avatar = document.createElement('div');
      avatar.className = 'client-card__avatar';
      avatar.style.background = avatarColor(client.name);
      avatar.style.color = avatarTextColor(client.name);
      avatar.textContent = initialsOf(client.name);
      row.appendChild(avatar);

      // Text block
      const body = document.createElement('div');
      body.className = 'client-card__body';

      const name = document.createElement('div');
      name.className = 'client-card__name';
      name.textContent = client.name || 'Senza nome';
      body.appendChild(name);

      const phoneDisplay = sanitizePhone(client.phone);
      const phoneEl = document.createElement('div');
      phoneEl.className = 'client-card__phone';
      if (phoneDisplay) {
        const icon = document.createElement('i');
        icon.className = 'fas fa-phone';
        phoneEl.appendChild(icon);
        const text = document.createTextNode(' ' + phoneDisplay);
        phoneEl.appendChild(text);
      } else {
        phoneEl.classList.add('client-card__phone--muted');
        phoneEl.textContent = 'Nessun numero';
      }
      body.appendChild(phoneEl);

      row.appendChild(body);

      // Call button (only if phone is valid)
      if (phoneDisplay) {
        const call = document.createElement('a');
        call.className = 'client-card__call';
        call.href = 'tel:' + phoneTelHref(client.phone);
        call.setAttribute('aria-label', 'Chiama ' + (client.name || ''));
        const callIcon = document.createElement('i');
        callIcon.className = 'fas fa-phone-alt';
        call.appendChild(callIcon);
        row.appendChild(call);
      }

      list.appendChild(row);
    });

    c.appendChild(list);
  }

  async function runSearch(term) {
    if (!term) {
      renderEmpty('Digita sopra per cercare un cliente');
      return;
    }
    try {
      const clients = await window.api.clients.search(term);
      renderResults(clients);
    } catch (err) {
      console.error('Clients search error:', err);
      renderEmpty('Errore durante la ricerca');
    }
  }

  function overrideLoadClients() {
    window.loadClients = function () {
      const input = document.getElementById('clients-search');
      if (input) {
        input.value = '';
        setTimeout(function () { input.focus(); }, 50);
      }
      renderEmpty('Digita sopra per cercare un cliente');
    };
  }

  function wireSearchInput() {
    const input = document.getElementById('clients-search');
    if (!input) return;
    let timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      const value = input.value.trim();
      timer = setTimeout(function () { runSearch(value); }, DEBOUNCE_MS);
    });
    input.addEventListener('search', function () {
      if (!input.value) renderEmpty('Digita sopra per cercare un cliente');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    overrideLoadClients();
    wireSearchInput();
    renderEmpty('Digita sopra per cercare un cliente');
  });
})();

/* Clients section: search-only mode.
 * Replaces the default loadClients()/updateClientsList() behavior so that:
 *  - no clients are auto-loaded
 *  - a search input drives the results table (debounced)
 */
(function () {
  const DEBOUNCE_MS = 200;

  function getTbody() {
    return document.getElementById('clients-list');
  }

  function renderPlaceholder(msg) {
    const tbody = getTbody();
    if (!tbody) return;
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.className = 'text-muted text-center py-4';
    td.textContent = msg;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function renderResults(clients) {
    const tbody = getTbody();
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!clients || clients.length === 0) {
      renderPlaceholder('Nessun cliente trovato');
      return;
    }
    clients.forEach(function (c) {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = c.name || '';
      tr.appendChild(tdName);

      const tdPhone = document.createElement('td');
      const phone = c.phone && c.phone !== '-' && c.phone !== '--' ? c.phone : '';
      if (phone) {
        const link = document.createElement('a');
        link.href = 'tel:' + phone.replace(/[^0-9+]/g, '');
        link.textContent = phone;
        tdPhone.appendChild(link);
      } else {
        tdPhone.textContent = '—';
        tdPhone.className = 'text-muted';
      }
      tr.appendChild(tdPhone);

      tbody.appendChild(tr);
    });
  }

  async function runSearch(term) {
    const tbody = getTbody();
    if (!tbody) return;
    if (!term) {
      renderPlaceholder('Digita sopra per cercare un cliente');
      return;
    }
    try {
      const clients = await window.api.clients.search(term);
      renderResults(clients);
    } catch (err) {
      console.error('Clients search error:', err);
      renderPlaceholder('Errore durante la ricerca');
    }
  }

  // Override the globally-declared loadClients() from app.js
  // so entering the Clients section does NOT auto-load all clients.
  function overrideLoadClients() {
    window.loadClients = function () {
      const input = document.getElementById('clients-search');
      if (input) {
        input.value = '';
        setTimeout(function () { input.focus(); }, 50);
      }
      renderPlaceholder('Digita sopra per cercare un cliente');
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
      // Fires on clear (x) in type="search" inputs
      if (!input.value) renderPlaceholder('Digita sopra per cercare un cliente');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    overrideLoadClients();
    wireSearchInput();
    renderPlaceholder('Digita sopra per cercare un cliente');
  });
})();

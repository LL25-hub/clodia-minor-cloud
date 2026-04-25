/* Clients section: full alphabetical list + live filter + inline edit. */
(function () {
  const DEBOUNCE_MS = 150;
  let allClients = [];
  let currentFilter = '';

  function $(id) { return document.getElementById(id); }

  function getContainer() { return document.getElementById('clients-results'); }

  function sanitizePhone(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    if (!s || s === '-' || s === '--') return '';
    return s.replace(/\.0+$/, '').trim();
  }
  function phoneTelHref(phone) {
    const cleaned = sanitizePhone(phone);
    const firstBlock = cleaned.split(/[\/\s,;]+/)[0] || cleaned;
    return firstBlock.replace(/[^0-9+]/g, '');
  }
  function initialsOf(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]).join('').toUpperCase();
  }
  function avatarColor(name) {
    let h = 0;
    for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    return 'hsl(' + hue + ', 55%, 88%)';
  }
  function avatarTextColor(name) {
    let h = 0;
    for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    return 'hsl(' + hue + ', 55%, 32%)';
  }

  function sortAlpha(list) {
    return list.slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'it', { sensitivity: 'base' });
    });
  }

  function render() {
    const c = getContainer();
    if (!c) return;
    c.innerHTML = '';
    const filter = currentFilter.trim().toLowerCase();
    const list = filter
      ? allClients.filter(x => String(x.name || '').toLowerCase().includes(filter))
      : allClients;

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'clients-results__empty';
      empty.textContent = filter ? 'Nessun cliente trovato' : 'Nessun cliente';
      c.appendChild(empty);
      return;
    }

    const ul = document.createElement('div');
    ul.className = 'client-list';

    list.forEach(function (client) {
      const row = document.createElement('div');
      row.className = 'client-card';
      row.dataset.id = client.id;

      const avatar = document.createElement('div');
      avatar.className = 'client-card__avatar';
      avatar.style.background = avatarColor(client.name);
      avatar.style.color = avatarTextColor(client.name);
      avatar.textContent = initialsOf(client.name);
      row.appendChild(avatar);

      const body = document.createElement('div');
      body.className = 'client-card__body';
      const name = document.createElement('div');
      name.className = 'client-card__name';
      name.textContent = client.name || 'Senza nome';
      body.appendChild(name);
      const phone = sanitizePhone(client.phone);
      const phoneEl = document.createElement('div');
      phoneEl.className = 'client-card__phone';
      if (phone) {
        phoneEl.innerHTML = '<i class="fas fa-phone"></i> ' + escapeHTML(phone);
      } else {
        phoneEl.classList.add('client-card__phone--muted');
        phoneEl.textContent = 'Nessun numero';
      }
      body.appendChild(phoneEl);
      row.appendChild(body);

      // Edit button
      const editBtn = document.createElement('button');
      editBtn.className = 'client-card__edit';
      editBtn.type = 'button';
      editBtn.setAttribute('aria-label', 'Modifica');
      editBtn.innerHTML = '<i class="fas fa-pen"></i>';
      editBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openEditClient(client);
      });
      row.appendChild(editBtn);

      // Call link
      if (phone) {
        const call = document.createElement('a');
        call.className = 'client-card__call';
        call.href = 'tel:' + phoneTelHref(client.phone);
        call.setAttribute('aria-label', 'Chiama');
        call.addEventListener('click', e => e.stopPropagation());
        call.innerHTML = '<i class="fas fa-phone-alt"></i>';
        row.appendChild(call);
      }

      // Tap row → also open edit
      row.addEventListener('click', function () { openEditClient(client); });

      ul.appendChild(row);
    });

    c.appendChild(ul);
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function openEditClient(client) {
    $('edit-client-id').value = client.id;
    $('edit-client-name').value = client.name || '';
    $('edit-client-phone').value = sanitizePhone(client.phone) || '';
    const m = bootstrap.Modal.getOrCreateInstance($('edit-client-modal'));
    m.show();
  }

  async function saveEditClient() {
    const id = $('edit-client-id').value;
    const name = $('edit-client-name').value.trim();
    const phone = $('edit-client-phone').value.trim() || null;
    if (!id || !name) {
      if (window.uiUtils) window.uiUtils.showToast('Nome obbligatorio', 'warning');
      return;
    }
    try {
      const updated = await window.api.clients.update(id, { name, phone });
      // Update local cache
      const idx = allClients.findIndex(c => String(c.id) === String(id));
      if (idx >= 0) allClients[idx] = updated;
      allClients = sortAlpha(allClients);
      // Invalidate any shared cache
      if (window.__dataCache) window.__dataCache.at = 0;
      bootstrap.Modal.getInstance($('edit-client-modal')).hide();
      if (window.uiUtils) window.uiUtils.showToast('Cliente aggiornato', 'success');
      render();
    } catch (err) {
      console.error('Update client error:', err);
      if (window.uiUtils) window.uiUtils.showToast('Errore aggiornamento', 'danger');
    }
  }

  async function loadClientsList() {
    const c = getContainer();
    if (c && !allClients.length) {
      c.innerHTML = '<div class="clients-results__empty">Caricamento…</div>';
    }
    try {
      const list = await window.api.clients.getAll();
      allClients = sortAlpha(Array.isArray(list) ? list : []);
      render();
    } catch (err) {
      console.error('Clients load error:', err);
      if (c) c.innerHTML = '<div class="clients-results__empty">Errore di caricamento</div>';
    }
  }

  // Override the global loadClients invoked by initNavigation
  function overrideLoadClients() {
    window.loadClients = function () {
      const input = $('clients-search');
      if (input) input.value = currentFilter || '';
      loadClientsList();
    };
  }

  function wireSearchInput() {
    const input = $('clients-search');
    if (!input) return;
    let t = null;
    input.addEventListener('input', function () {
      clearTimeout(t);
      const value = input.value;
      t = setTimeout(function () { currentFilter = value; render(); }, DEBOUNCE_MS);
    });
    input.addEventListener('search', function () {
      if (!input.value) { currentFilter = ''; render(); }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    overrideLoadClients();
    wireSearchInput();
    const saveBtn = $('save-edit-client');
    if (saveBtn) saveBtn.addEventListener('click', saveEditClient);
    // Lazy-render placeholder until the user opens the section
    const c = getContainer();
    if (c) c.innerHTML = '<div class="clients-results__empty">Apri questa sezione per caricare</div>';
  });
})();

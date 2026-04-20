// Gestori di componenti UI
let reservationModal;
let apartmentModal;
let clientModal;
let occupancyChart;
let allReservations = [];
let currentReservationId = null; // Add declaration for tracking current reservation ID

function filterReservations(clientSearch, roomSearch) {
  // Se entrambi i campi sono vuoti, restituisci tutte le prenotazioni
  if (!clientSearch && !roomSearch) {
    return allReservations;
  }
  
  // Converte in minuscolo per una ricerca case-insensitive
  clientSearch = (clientSearch || '').toLowerCase();
  roomSearch = (roomSearch || '').toLowerCase();
  
  // Filtra le prenotazioni in base ai criteri di ricerca
  return allReservations.filter(reservation => {
    const clientMatch = !clientSearch || 
      (reservation.client_name && reservation.client_name.toLowerCase().includes(clientSearch));
    
    const roomMatch = !roomSearch || 
      (reservation.room_number && reservation.room_number.toLowerCase().includes(roomSearch));
    
    return clientMatch && roomMatch;
  });
}

// Funzione per gestire il submit del form di ricerca
function handleHistorySearch(e) {
  e.preventDefault();
  
  const clientSearch = document.getElementById('history-client-search').value.trim();
  const roomSearch = document.getElementById('history-room-search').value.trim();
  
  // Filtra le prenotazioni e aggiorna la visualizzazione
  const filteredReservations = filterReservations(clientSearch, roomSearch);
  updateReservationsHistory(filteredReservations);
  
  // Mostra messaggio con il numero di risultati
  const resultsMessage = `Trovate ${filteredReservations.length} prenotazioni su ${allReservations.length} totali`;
  uiUtils.showToast(resultsMessage, 'info');
}

// Funzione per resettare la ricerca
function resetHistorySearch() {
  document.getElementById('history-client-search').value = '';
  document.getElementById('history-room-search').value = '';
  
  // Aggiorna la visualizzazione con tutte le prenotazioni
  updateReservationsHistory(allReservations);
}

// Funzione per resettare la ricerca
function resetHistorySearch() {
  document.getElementById('history-client-search').value = '';
  document.getElementById('history-room-search').value = '';
  
  // Aggiorna la visualizzazione con tutte le prenotazioni
  updateReservationsHistory(allReservations);
}

// Funzione per resettare la ricerca
function resetHistorySearch() {
  document.getElementById('history-client-search').value = '';
  document.getElementById('history-room-search').value = '';
  document.getElementById('history-date-from').value = '';
  document.getElementById('history-date-to').value = '';
  
  // Aggiorna la visualizzazione con tutte le prenotazioni
  updateReservationsHistory(allReservations);
}

// Funzione per gestire il submit del form di ricerca
function handleHistorySearch(e) {
  e.preventDefault();
  
  const clientSearch = document.getElementById('history-client-search').value.trim();
  const roomSearch = document.getElementById('history-room-search').value.trim();
  
  // Filtra le prenotazioni e aggiorna la visualizzazione
  const filteredReservations = filterReservations(clientSearch, roomSearch);
  updateReservationsHistory(filteredReservations);
  
  // Mostra messaggio con il numero di risultati
  const resultsMessage = `Trovate ${filteredReservations.length} prenotazioni su ${allReservations.length} totali`;
  uiUtils.showToast(resultsMessage, 'info');
}

// Funzione per resettare la ricerca
function resetHistorySearch() {
  document.getElementById('history-client-search').value = '';
  document.getElementById('history-room-search').value = '';
  
  // Aggiorna la visualizzazione con tutte le prenotazioni
  updateReservationsHistory(allReservations);
}
// Stato dell'applicazione
const appState = {
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear()
};
// Funzione per eliminare una prenotazione
async function deleteReservation(reservationId) {
  if (!reservationId) return;
  
  // Chiedi conferma all'utente
  if (!confirm('Sei sicuro di voler spostare questa prenotazione nel cestino? Potrai ripristinarla o eliminarla definitivamente in seguito.')) {
    return;
  }
  
  try {
    // Chiamata API per eliminare la prenotazione (ora è un soft delete)
    await api.reservations.delete(reservationId);
    window.invalidateSectionCache && window.invalidateSectionCache(['dashboard', 'reservations', 'history', 'trash']);
    if (window.__dataCache) window.__dataCache.at = 0;

    // Mostra messaggio di successo
    uiUtils.showToast('Prenotazione spostata nel cestino!', 'success');
    
    // Chiudi il modal se aperto
    if (reservationModal) {
      reservationModal.hide();
    }
    
    // Aggiorna i dati nelle varie sezioni
    loadDashboardData();
    refreshReservationCalendar();
    loadReservationsHistory();
    loadTrash(); // Carica anche il cestino se è già aperto
  } catch (error) {
    console.error('Error deleting reservation:', error);
    // L'errore viene già gestito in api.js
  }
}
// Initialize application
document.addEventListener('DOMContentLoaded', function() {
  // Carica le utility ed API
  if (!loadDependencies()) return;
  
  // Initialize Bootstrap components
  initBootstrapComponents();
  
  // Initialize navigation
  initNavigation();
  
  // Eager: only what the user sees on first paint (dashboard).
  // The rest is lazy-loaded when the user opens the section (handled in initNavigation).
  loadSettings();
  loadDashboardData(); markLoaded('dashboard');
  // Still initialize the reservation calendar's static structure (no network)
  // so first interaction with Registro is instant; data loads on tab open.
  try { if (typeof initReservationCalendar === 'function') initReservationCalendar(); } catch (e) { console.warn(e); }
  loadClients(); // search-driven, no network at boot
  
  // Add event listeners
  addGlobalEventListeners();
});

// Carica le dipendenze esterne
function loadDependencies() {
  // Verifica se le utility sono caricate
  if (!window.dateUtils || !window.uiUtils || !window.api) {
    console.error('Dipendenze mancanti: utils.js o api.js non sono stati caricati correttamente');
    // Mostra un messaggio di errore all'utente
    const appWrapper = document.getElementById('wrapper');
    if (appWrapper) {
      appWrapper.innerHTML = `
        <div class="alert alert-danger m-4">
          <h4 class="alert-heading">Errore di inizializzazione</h4>
          <p>Non è stato possibile caricare i componenti necessari dell'applicazione.</p>
          <hr>
          <p class="mb-0">Si prega di ricaricare la pagina. Se l'errore persiste, contattare l'assistenza.</p>
          <button class="btn btn-danger mt-3" onclick="location.reload()">Ricarica pagina</button>
        </div>
      `;
    }
    return false;
  }
  return true;
}

// Initialize Bootstrap components
function initBootstrapComponents() {
  // Initialize modals
  reservationModal = new bootstrap.Modal(document.getElementById('reservation-modal'));
  apartmentModal = new bootstrap.Modal(document.getElementById('apartment-modal'));
  clientModal = new bootstrap.Modal(document.getElementById('client-modal'));
  
  // Initialize chart with colori corretti (rosso per occupati, verde per liberi)
  const ctx = document.getElementById('occupancy-chart');
  if (ctx) {
    occupancyChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Occupati', 'Liberi'],
        datasets: [{
          data: [65, 35],
          backgroundColor: ['#dc3545', '#198754'], 
          borderWidth: 0,
          cutout: '75%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true
          }
        }
      }
    });
  } else {
    console.warn('Canvas per il grafico di occupazione non trovato');
  }
}

// Section cache: skip reloads that happened in the last N ms
const SECTION_CACHE_TTL_MS = 60 * 1000;
const sectionLoadedAt = {};

/** Mark all sections as stale (force reload on next visit). Called after mutations. */
window.invalidateSectionCache = function (keys) {
  if (!keys) { for (const k in sectionLoadedAt) delete sectionLoadedAt[k]; return; }
  (Array.isArray(keys) ? keys : [keys]).forEach(k => { delete sectionLoadedAt[k]; });
};

function shouldReload(sectionKey) {
  const last = sectionLoadedAt[sectionKey] || 0;
  return (Date.now() - last) > SECTION_CACHE_TTL_MS;
}

function markLoaded(sectionKey) {
  sectionLoadedAt[sectionKey] = Date.now();
}

function initNavigation() {
  const menuItems = document.querySelectorAll('.list-group-item');
  const sections = document.querySelectorAll('.section');

  menuItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const targetSection = this.getAttribute('data-section');

      // Update active menu item
      menuItems.forEach(mi => mi.classList.remove('active'));
      this.classList.add('active');

      // Show target section
      sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === targetSection) {
          section.classList.add('active');

          // Refresh section content only if cache expired
          if (targetSection === 'dashboard') {
            if (shouldReload('dashboard')) { loadDashboardData(); markLoaded('dashboard'); }
          } else if (targetSection === 'reservations') {
            if (shouldReload('reservations')) { refreshReservationCalendar(); markLoaded('reservations'); }
          } else if (targetSection === 'clients') {
            // Clients section is search-driven, no bulk preload
            if (typeof window.loadClients === 'function') window.loadClients();
          } else if (targetSection === 'history') {
            if (shouldReload('history')) { loadReservationsHistory(); markLoaded('history'); }
          } else if (targetSection === 'add-rooms') {
            if (shouldReload('add-rooms')) { loadRooms(); markLoaded('add-rooms'); }
          } else if (targetSection === 'trash') {
            if (shouldReload('trash')) { loadTrash(); markLoaded('trash'); }
          } else if (targetSection === 'beach') {
            if (typeof window.loadBeach === 'function') window.loadBeach();
          }
        }
      });
    });
  });
}

function addGlobalEventListeners() {
  // Booking buttons
  document.getElementById('add-reservation')?.addEventListener('click', function() {
    // Chiamiamo la funzione openReservationModal invece di resetReservationForm + show
    openReservationModal();
  });
  
  document.getElementById('save-reservation')?.addEventListener('click', function() {
    saveReservation();
  });
  
  // Delete reservation button in modal
  document.getElementById('delete-reservation')?.addEventListener('click', function() {
    if (currentReservationId && confirm('Sei sicuro di voler eliminare questa prenotazione?')) {
      deleteReservation(currentReservationId);
    }
  });
  
  // Trash button - Empty trash
  document.getElementById('empty-trash')?.addEventListener('click', function() {
    emptyTrash();
  });
  
  // Client buttons
  document.getElementById('add-client')?.addEventListener('click', function() {
    resetClientForm();
    clientModal.show();
  });
  
  document.getElementById('save-client')?.addEventListener('click', function() {
    saveClient();
  });
  
  // Apartment buttons
  document.getElementById('add-apartment')?.addEventListener('click', function() {
    resetApartmentForm();
    apartmentModal.show();
  });
  
  document.getElementById('save-apartment')?.addEventListener('click', function() {
    saveApartment();
  });
  
  // Month navigation
  document.getElementById('prev-month')?.addEventListener('click', function() {
    navigateMonth(-1);
  });
  
  document.getElementById('next-month')?.addEventListener('click', function() {
    navigateMonth(1);
  });
  
  // Settings form
  document.getElementById('settings-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    saveSettings();
  });
  
  // Export button in settings
  document.getElementById('backup-db')?.addEventListener('click', function() {
    exportAllToCSV();
  });
  
  // Import button in settings
  document.getElementById('import-db')?.addEventListener('click', function() {
    document.getElementById('import-file').click();
  });
  
  // Handle file selection for import
  document.getElementById('import-file')?.addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      importFromCSV(e.target.files[0]);
    }
  });
  
  // History search form
  document.getElementById('history-search-form')?.addEventListener('submit', function(e) {
    handleHistorySearch(e);
  });
  
  // History search reset button
  document.getElementById('history-search-reset')?.addEventListener('click', function() {
    resetHistorySearch();
  });
  
  // Available apartments search form
  document.getElementById('available-apartments-form')?.addEventListener('submit', function(e) {
    handleAvailableApartmentsSearch(e);
  });
  
  // Form component validation handlers
  setupFormComponentHandlers();
}
function setupFormComponentHandlers() {
  // Payment calculation event listeners
  setupPaymentCalculation();
  
  // Client search event listeners
  setupClientSearch();
  
  // Date validation for reservation form
  setupDateValidation();
  
  // Form validation
  validationUtils.setupFormValidation('apartment-form', ['apartment-name', 'apartment-type', 'apartment-floor']);
  validationUtils.setupFormValidation('client-form', ['new-client-name']);
  validationUtils.setupFormValidation('reservation-form', [
    'room-select', 'check-in-date', 'check-out-date', 'cash-amount', 'transfer-amount'
  ]);
  
  // Setup date fields in available apartments form
  setupAvailableApartmentsForm();
  
  // Sincronizza le checkbox duplicate nella prenotazione
  setupDuplicateCheckboxes();
}

// Sincronizza le checkbox duplicate per le opzioni della prenotazione
function setupDuplicateCheckboxes() {
  // Non è più necessario sincronizzare le checkbox poiché abbiamo rimosso i duplicati
  // Manteniamo la funzione vuota per compatibilità con il codice esistente
}

// Inizializza i campi data nel form di ricerca appartamenti disponibili
// (ora gestiti dal date-range picker Flatpickr — niente pre-popolazione)
function setupAvailableApartmentsForm() {
  // No-op: the hidden fields #available-check-in / #available-check-out are
  // populated by js/date-range-picker.js when the user picks both dates.
  return;
  // eslint-disable-next-line no-unreachable
  const checkInField = document.getElementById('available-check-in');
  const checkOutField = document.getElementById('available-check-out');
  if (checkInField && checkOutField) {
    const today = dateUtils.today();
    checkInField.value = today;
    checkOutField.value = dateUtils.addDays(today, 7);
    checkInField.addEventListener('change', function() {
      const checkOutDate = new Date(checkOutField.value);
      const newCheckInDate = new Date(this.value);
      if (checkOutDate <= newCheckInDate) {
        checkOutField.value = dateUtils.addDays(this.value, 1);
      }
    });
    
    // Imposta un valore minimo per check-out basato su check-in
    checkInField.addEventListener('change', function() {
      checkOutField.min = this.value;
    });
    
    // Trigger per impostare il valore minimo al caricamento
    if (checkInField.value) {
      checkOutField.min = checkInField.value;
    }
  }
}


// Setup payment calculation
function setupPaymentCalculation() {
  const estimateField = document.getElementById('estimate-amount');
  const cashAmountField = document.getElementById('cash-amount');
  const transferAmountField = document.getElementById('transfer-amount');
  const totalPriceSpan = document.getElementById('total-price');
  
  if (!cashAmountField || !transferAmountField || !totalPriceSpan || !estimateField) return;
  
  // Funzione per verificare automaticamente lo stato del pagamento
  window.updatePaymentStatus = function() {
    const estimateAmount = parseFloat(estimateField.value) || 0;
    const cashAmount = parseFloat(cashAmountField.value) || 0;
    const transferAmount = parseFloat(transferAmountField.value) || 0;
    const paymentStatusElement = document.getElementById('payment-status');
    
    const totalPaid = cashAmount + transferAmount;
    // Se c'è un preventivo, verifica che il pagamento lo raggiunga
    // Se non c'è preventivo, basta che ci sia un pagamento maggiore di zero
    const isPaid = (totalPaid >= estimateAmount && estimateAmount > 0) || (totalPaid > 0 && estimateAmount === 0);
    
    if (paymentStatusElement) {
      if (isPaid) {
        paymentStatusElement.innerHTML = '<span class="badge bg-success">Pagato</span> <small class="ms-1 text-muted">(auto)</small>';
      } else {
        paymentStatusElement.innerHTML = '<span class="badge bg-danger">Non Pagato</span> <small class="ms-1 text-muted">(auto)</small>';
      }
    }
    
    return isPaid;
  };
  
  // Calculate total price
  const updateTotalPrice = function() {
    const estimateAmount = parseFloat(estimateField.value) || 0;
    const cashAmount = parseFloat(cashAmountField.value) || 0;
    const transferAmount = parseFloat(transferAmountField.value) || 0;
    
    // Se il preventivo è maggiore di 0, lo utilizziamo per il display
    // altrimenti, usiamo la somma di contanti e bonifico
    const displayTotal = estimateAmount > 0 ? estimateAmount : (cashAmount + transferAmount);
    totalPriceSpan.textContent = Math.round(displayTotal);
    
    // Aggiorna lo stato del pagamento
    updatePaymentStatus();
  };
  
  // Aggiorna tutti i campi di input per gestire il comportamento del focus
  const paymentInputs = document.querySelectorAll('.payment-input');
  paymentInputs.forEach(input => {
    // Pulisci il valore "0" quando l'utente clicca sul campo
    input.addEventListener('focus', function() {
      if (this.value === '0') {
        this.value = '';
      }
    });
    
    // Ripristina il valore "0" se l'utente lascia il campo vuoto
    input.addEventListener('blur', function() {
      if (this.value === '') {
        this.value = '0';
      }
      updateTotalPrice();
    });
  });
  
  // Aggiungi lo stesso comportamento al campo preventivo
  estimateField.addEventListener('focus', function() {
    if (this.value === '0') {
      this.value = '';
    }
  });
  
  estimateField.addEventListener('blur', function() {
    if (this.value === '') {
      this.value = '0';
    }
    updateTotalPrice();
  });
  
  // Aggiungi event listener ai campi di input
  estimateField.addEventListener('input', updateTotalPrice);
  cashAmountField.addEventListener('input', updateTotalPrice);
  transferAmountField.addEventListener('input', updateTotalPrice);
  
  // Validate non-negative values
  const validatePositiveAmount = function() {
    if (parseFloat(this.value) < 0) {
      this.value = '0';
      updateTotalPrice();
    }
  };
  
  estimateField.addEventListener('change', validatePositiveAmount);
  cashAmountField.addEventListener('change', validatePositiveAmount);
  transferAmountField.addEventListener('change', validatePositiveAmount);
  
  // Esegui il calcolo iniziale
  updateTotalPrice();
  
  // Esponi la funzione updatePaymentStatus all'esterno per poterla riutilizzare
  window.updatePaymentStatus = updatePaymentStatus;
}

// Funzione modificata per gestire la ricerca automatica dal campo Nome Cliente
function setupClientSearch() {
  const clientNameField = document.getElementById('client-name');
  const clientIdField = document.getElementById('client-id');
  const clientResultsDiv = document.getElementById('client-results');
  const clientPhoneField = document.getElementById('client-phone');
  
  if (clientNameField && clientResultsDiv) {
    // Search as you type
    clientNameField.addEventListener('input', function() {
      const searchTerm = this.value.trim();
      
      if (searchTerm === '') {
        // Empty search = new client mode
        clientResultsDiv.classList.add('d-none');
        clientIdField.value = '';
        return;
      }
      
      // Debounce search
      if (this._searchTimeout) {
        clearTimeout(this._searchTimeout);
      }
      
      this._searchTimeout = setTimeout(async () => {
        try {
          // Fetch matching clients
          const clients = await api.clients.search(searchTerm);
          
          clientResultsDiv.innerHTML = '';
          
          if (clients.length === 0) {
            clientResultsDiv.classList.add('d-none');
            return;
          }
          
          // Create results list
          clients.forEach(client => {
            const item = document.createElement('div');
            item.className = 'p-2 border-bottom client-result';
            item.textContent = client.name;
            item.dataset.id = client.id;
            item.dataset.phone = client.phone || '';
            
            item.addEventListener('click', function() {
              // Set selected client
              clientNameField.value = client.name;
              clientIdField.value = client.id;
              clientPhoneField.value = client.phone || '';
              clientResultsDiv.classList.add('d-none');
            });
            
            clientResultsDiv.appendChild(item);
          });
          
          clientResultsDiv.classList.remove('d-none');
        } catch (error) {
          console.error('Error searching clients:', error);
          clientResultsDiv.classList.add('d-none');
        }
      }, 300); // Delay search by 300ms
    });
    
    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
      if (!clientNameField.contains(e.target) && !clientResultsDiv.contains(e.target)) {
        clientResultsDiv.classList.add('d-none');
      }
    });
    
    // Handle focus to show results again
    clientNameField.addEventListener('focus', function() {
      if (this.value.trim() !== '' && clientResultsDiv.children.length > 0) {
        clientResultsDiv.classList.remove('d-none');
      }
    });
    
    // Reset search on form open
    clientNameField.addEventListener('reset', function() {
      clientResultsDiv.classList.add('d-none');
      clientIdField.value = '';
    });
  }
}
// Setup date validation (MODIFICATO: permette date passate)
function setupDateValidation() {
  const checkInDate = document.getElementById('check-in-date');
  const checkOutDate = document.getElementById('check-out-date');
  
  if (checkInDate && checkOutDate) {
    checkInDate.addEventListener('change', function() {
      checkOutDate.min = this.value;
      
      // If check-out date is before check-in date, reset it
      if (checkOutDate.value && checkOutDate.value < this.value) {
        checkOutDate.value = this.value;
      }
    });
    
    // Non impostiamo più il minimo come data odierna
    // checkInDate.min = dateUtils.today();
  }
}

// Navigate to previous/next month
function navigateMonth(direction) {
  // Update current month and year
  appState.currentMonth += direction;
  
  // Adjust year if needed
  if (appState.currentMonth < 0) {
    appState.currentMonth = 11;
    appState.currentYear--;
  } else if (appState.currentMonth > 11) {
    appState.currentMonth = 0;
    appState.currentYear++;
  }
  
  refreshReservationCalendar();
}

// Refresh reservation calendar
function refreshReservationCalendar() {
  // Aggiorna il titolo del mese corrente
  const currentDate = new Date(appState.currentYear, appState.currentMonth, 1);
  const currentMonthDisplay = document.getElementById('current-month-display');
  
  if (currentMonthDisplay) {
    const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(currentDate);
    currentMonthDisplay.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${appState.currentYear}`;
  }
  
  // Aggiorna anche il display del mese nella sezione Registro
  const weekDisplay = document.getElementById('week-display');
  if (weekDisplay) {
    const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(currentDate);
    weekDisplay.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${appState.currentYear}`;
  }
  
  // Carica il calendario per il mese corrente
  loadMonthCalendar(appState.currentYear, appState.currentMonth);
  
  // Aggiorna la legenda delle prenotazioni
  updateReservationLegend();
}

// Save settings
async function saveSettings() {
  const hotelName = document.getElementById('hotel-name-input').value;
  
  if (!hotelName) {
    uiUtils.showToast('Inserisci il nome dell\'hotel/residence', 'danger');
    return;
  }
  
  try {
    const data = await api.settings.update({ hotel_name: hotelName });
    updateHotelName(data.hotel_name);
    uiUtils.showToast('Impostazioni salvate con successo', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    // L'errore viene già gestito in api.js
  }
}

// Update hotel name in UI
function updateHotelName(name) {
  // Update sidebar
  const sidebarHeading = document.getElementById('hotel-name-sidebar');
  if (sidebarHeading) {
    sidebarHeading.textContent = name;
  }
  
  // Update page title
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    pageTitle.textContent = name;
  }
  
  // Update document title
  document.title = name;
}

// Load settings from the server
async function loadSettings() {
  try {
    const settings = await api.settings.get();
    
    updateHotelName(settings.hotel_name);
    
    // Update form field
    const hotelNameInput = document.getElementById('hotel-name-input');
    if (hotelNameInput) {
      hotelNameInput.value = settings.hotel_name;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    // L'errore viene già gestito in api.js
  }
}

// Dashboard functionality
async function loadDashboardData() {
  try {
    const dashboardContainer = document.getElementById('dashboard');
    if (!dashboardContainer) return;
    
    // Show loading state
    const checkInList = document.getElementById('check-in-list');
    const checkOutList = document.getElementById('check-out-list');
    
    if (checkInList) uiUtils.showLoading(checkInList, 'Caricamento check-in...');
    if (checkOutList) uiUtils.showLoading(checkOutList, 'Caricamento check-out...');
    
    // Load dashboard data
    const data = await api.reservations.getDashboardStats();
    
    // Update UI with data
    updateCheckInList(data.checkIns);
    updateCheckOutList(data.checkOuts);
    updateOccupancyChart(data.occupancy);
    
    // Assicurati che il form di ricerca appartamenti sia inizializzato
    setupAvailableApartmentsForm();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    
    // Show error state
    const checkInList = document.getElementById('check-in-list');
    const checkOutList = document.getElementById('check-out-list');
    
    if (checkInList) {
      const retryButton = uiUtils.showErrorState(checkInList, 'Errore durante il caricamento dei check-in');
      if (retryButton) {
        retryButton.addEventListener('click', loadDashboardData);
      }
    }
    
    if (checkOutList) {
      const retryButton = uiUtils.showErrorState(checkOutList, 'Errore durante il caricamento dei check-out');
      if (retryButton) {
        retryButton.addEventListener('click', loadDashboardData);
      }
    }
  }
}

function updateCheckInList(checkIns) {
  const checkInList = document.getElementById('check-in-list');
  
  if (!checkInList) return;
  
  checkInList.innerHTML = '';
  
  if (checkIns.length === 0) {
    uiUtils.showEmptyState(checkInList, 'Nessun check-in questa settimana', 'calendar-check');
    return;
  }
  
  checkIns.forEach(checkIn => {
    const date = new Date(checkIn.check_in_date);
    const dayAbbr = dateUtils.getDayAbbreviation(date);
    const dayNum = date.getDate();
    
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
    listItem.innerHTML = `
      <div>
        <span class="fw-medium">${checkIn.client_name}</span>
        <span class="ms-2 text-muted small">${checkIn.room_number}</span>
      </div>
      <span class="badge bg-primary rounded-pill">${dayAbbr} ${dayNum}</span>
    `;
    
    checkInList.appendChild(listItem);
  });
}

function updateCheckOutList(checkOuts) {
  const checkOutList = document.getElementById('check-out-list');
  
  if (!checkOutList) return;
  
  checkOutList.innerHTML = '';
  
  if (checkOuts.length === 0) {
    uiUtils.showEmptyState(checkOutList, 'Nessun check-out questa settimana', 'calendar-times');
    return;
  }
  
  checkOuts.forEach(checkOut => {
    const date = new Date(checkOut.check_out_date);
    const dayAbbr = dateUtils.getDayAbbreviation(date);
    const dayNum = date.getDate();
    
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
    listItem.innerHTML = `
      <div>
        <span class="fw-medium">${checkOut.client_name}</span>
        <span class="ms-2 text-muted small">${checkOut.room_number}</span>
      </div>
      <span class="badge bg-secondary rounded-pill">${dayAbbr} ${dayNum}</span>
    `;
    
    checkOutList.appendChild(listItem);
  });
}

function updateOccupancyChart(occupancy) {
  // Update text elements
  document.getElementById('occupancy-rate').textContent = `${occupancy.rate}%`;
  document.getElementById('free-rooms').textContent = `Liberi (${occupancy.free})`;
  document.getElementById('occupied-rooms').textContent = `Occupati (${occupancy.occupied})`;
  
  // Update chart data
  if (occupancyChart) {
    occupancyChart.data.datasets[0].data = [occupancy.occupied, occupancy.free];
    occupancyChart.update();
  }
}

// Reservation calendar - initial setup
function initReservationCalendar() {
  // Initialize with current month/year
  appState.currentMonth = new Date().getMonth();
  appState.currentYear = new Date().getFullYear();
  
  refreshReservationCalendar();
}

// Load month calendar (CORRETTA per usare updateReservationTableHeaders)
function loadMonthCalendar(year, month) {
  // Generate month dates
  const monthDates = dateUtils.getMonthDates(year, month);
  
  // Aggiorna le intestazioni delle tabelle usando la funzione dedicata
  updateReservationTableHeaders(monthDates);
  
  // Load reservations for this month
  loadReservations(monthDates);
}
// Aggiornamento intestazioni tabella per layout compatto - MODIFICATO: rimossa colonna Disp
function updateReservationTableHeaders(monthDates) {
  const reservationDays = document.getElementById('reservation-days');
  if (reservationDays) {
    // Clear existing columns except the first one
    while (reservationDays.children.length > 1) {
      reservationDays.removeChild(reservationDays.lastChild);
    }
    
    // Modifica intestazione Appartamenti (prima colonna)
    const firstHeader = reservationDays.children[0];
    firstHeader.style.width = '70px';
    firstHeader.style.maxWidth = '70px';
    firstHeader.style.overflow = 'hidden';
    firstHeader.style.whiteSpace = 'nowrap';
    firstHeader.style.textOverflow = 'ellipsis';
    firstHeader.style.borderRight = '1px solid #dee2e6';
    
    // Array dei giorni abbreviati in italiano
    const daysAbbr = ['DO', 'LU', 'MA', 'ME', 'GI', 'VE', 'SA'];
    
    // Add date headers for each day of the month
    monthDates.forEach(date => {
      const dayDate = new Date(date);
      const dayNum = dayDate.getDate();
      const dayOfWeek = dayDate.getDay(); // 0-6 (domenica-sabato)
      const dayAbbr = daysAbbr[dayOfWeek];
      const isSaturday = dayDate.getDay() === 6; // 6 è sabato
      const isSunday = dayDate.getDay() === 0; // 0 è domenica
      const isWeekend = isSaturday || isSunday;
      
      const th = document.createElement('th');
      th.className = 'text-center date-header ' + (isWeekend ? 'weekend-column' : '');
      th.style.minWidth = '36px';
      
      // Crea due div per il layout a colonna: numero del giorno e abbreviazione
      th.innerHTML = `
        <div class="day-number ${dayDate.getDate() === new Date().getDate() && dayDate.getMonth() === new Date().getMonth() ? 'current-day' : ''}">${dayNum}</div>
        <div class="day-abbr">${dayAbbr}</div>
      `;
      
      reservationDays.appendChild(th);
    });
    
    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(tooltip => {
      new bootstrap.Tooltip(tooltip);
    });
  }
}

async function loadReservations(dates) {
  try {
    const tableContainer = document.getElementById('reservation-table');
    const roomsContainer = document.getElementById('reservation-rooms');
    
    if (!tableContainer || !roomsContainer) return;
    
    // Show loading state
    uiUtils.showLoading(roomsContainer, 'Caricamento planning...');
    
    // Load rooms and reservations in parallel
    const [rooms, reservations] = await Promise.all([
      api.rooms.getAll(),
      api.reservations.getAll()
    ]);
    
    // Debug: controlla il campo reservation_color
    console.log("Prenotazioni caricate:", reservations);
    for (const reservation of reservations) {
      console.log(`Prenotazione ID ${reservation.id}: ${reservation.client_name} - Colore: ${reservation.reservation_color || 'non impostato'}`);
    }
    
    // Update table with data
    updateReservationTable(rooms, reservations, dates);
  } catch (error) {
    console.error('Error loading reservations:', error);
    
    const roomsContainer = document.getElementById('reservation-rooms');
    if (roomsContainer) {
      const retryButton = uiUtils.showErrorState(roomsContainer, 'Errore durante il caricamento del planning');
      if (retryButton) {
        retryButton.addEventListener('click', () => loadReservations(dates));
      }
    }
  }
}

function updateReservationTableHeaders(monthDates) {
  const reservationDays = document.getElementById('reservation-days');
  if (reservationDays) {
    // Clear existing columns except the first one
    while (reservationDays.children.length > 1) {
      reservationDays.removeChild(reservationDays.lastChild);
    }
    
    // Modifica intestazione Appartamenti (prima colonna)
    const firstHeader = reservationDays.children[0];
    firstHeader.style.width = '70px';
    firstHeader.style.maxWidth = '70px';
    firstHeader.style.overflow = 'hidden';
    firstHeader.style.whiteSpace = 'nowrap';
    firstHeader.style.textOverflow = 'ellipsis';
    firstHeader.style.borderRight = '1px solid #dee2e6';
    
    // Array dei giorni abbreviati in italiano
    const daysAbbr = ['DO', 'LU', 'MA', 'ME', 'GI', 'VE', 'SA'];
    
    // Add date headers for each day of the month
    monthDates.forEach(date => {
      const dayDate = new Date(date);
      const dayNum = dayDate.getDate();
      const dayOfWeek = dayDate.getDay(); // 0-6 (domenica-sabato)
      const dayAbbr = daysAbbr[dayOfWeek];
      const isSaturday = dayDate.getDay() === 6; // 6 è sabato
      
      const th = document.createElement('th');
      // MODIFICATO: Usa saturday-column invece di weekend-column e solo per il sabato
      th.className = 'text-center date-header ' + (isSaturday ? 'saturday-column' : '');
      th.style.minWidth = '36px';
      
      // Crea due div per il layout a colonna: numero del giorno e abbreviazione
      th.innerHTML = `
        <div class="day-number ${dayDate.getDate() === new Date().getDate() && dayDate.getMonth() === new Date().getMonth() ? 'current-day' : ''}">${dayNum}</div>
        <div class="day-abbr">${dayAbbr}</div>
      `;
      
      reservationDays.appendChild(th);
    });
    
    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(tooltip => {
      new bootstrap.Tooltip(tooltip);
    });
  }
}

// Funzione updateReservationTable completa modificata - solo la parte relativa alle celle vuote
function updateReservationTable(rooms, reservations, dates) {
  const reservationTable = document.getElementById('reservation-rooms');

  if (!reservationTable) return;

  reservationTable.innerHTML = '';

  // Raggruppa le camere per piano per aggiungere distinzione visiva
  const roomsByFloor = {};
  rooms.forEach(room => {
    const floor = room.floor || 'Altro';
    if (!roomsByFloor[floor]) {
      roomsByFloor[floor] = [];
    }
    roomsByFloor[floor].push(room);
  });

  // Colori per i diversi piani
  const floorColors = {
    'Piano Terra': '#f7f7f7',
    'Primo Piano': '#f0f8ff',
    'Secondo Piano': '#f0fff0',
    'Terzo Piano': '#fff0f5',
    'Quarto Piano': '#fff8e1',
    'Altro': '#f5f5f5'
  };

  // Definisci l'ordine corretto dei piani (dal basso all'alto)
  const floorOrder = ['Piano Terra', 'Primo Piano', 'Secondo Piano', 'Terzo Piano', 'Quarto Piano', 'Altro'];

  // Crea righe per ogni piano e relative camere, rispettando l'ordine definito
  floorOrder.forEach(floor => {
    if (roomsByFloor[floor] && roomsByFloor[floor].length > 0) {
      // Intestazione del piano
      const floorHeader = document.createElement('tr');
      floorHeader.className = 'floor-header';
      floorHeader.style.backgroundColor = floorColors[floor] || '#f5f5f5';
      floorHeader.style.fontWeight = 'bold';

      const floorCell = document.createElement('td');
      floorCell.colSpan = dates.length + 1; // +1 per la colonna Appartamento
      floorCell.textContent = floor;
      floorCell.style.padding = '4px 8px'; // Padding ridotto
      floorCell.style.fontSize = '0.85rem'; // Font più piccolo

      floorHeader.appendChild(floorCell);
      reservationTable.appendChild(floorHeader);

      // Camere di questo piano
      roomsByFloor[floor].forEach(room => {
        const row = document.createElement('tr');
        row.style.backgroundColor = floorColors[floor] || '#f5f5f5';

        // Cella della camera con testo limitato a 5 caratteri
        const roomCell = document.createElement('td');
        roomCell.className = 'room-cell';

        // Limita il nome appartamento a max 5 caratteri
        const shortRoomName = room.room_number.length > 5
            ? room.room_number.substring(0, 5)
            : room.room_number;

        roomCell.innerHTML = `
          <div class="d-flex align-items-center">
            <div>
              <div class="room-number" title="${room.room_number}">${shortRoomName}</div>
            </div>
          </div>
        `;
        row.appendChild(roomCell);

        // Array per tracciare le prenotazioni in corso
        const cellReservations = new Array(dates.length).fill(null);

        // Identifica quali date hanno prenotazioni
        reservations.forEach(reservation => {
          if (reservation.room_id !== room.id) return;

          const checkIn = new Date(reservation.check_in_date);
          const checkOut = new Date(reservation.check_out_date);

          dates.forEach((date, index) => {
            const currentDate = new Date(date);
            if (currentDate >= checkIn && currentDate < checkOut) {
              cellReservations[index] = reservation;
            }
          });
        });

        // Crea celle per il calendario
        let currentReservation = null;
        let startIndex = -1;
        let endIndex = -1;

        for (let i = 0; i <= cellReservations.length; i++) {
          // L'ultimo indice o cambio di prenotazione indica fine di un gruppo
          if (i === cellReservations.length ||
              (cellReservations[i]?.id !== currentReservation?.id)) {

            // Se c'era una prenotazione in corso, crea la cella con colspan
            if (currentReservation) {
              const colSpan = endIndex - startIndex + 1;
              const cell = document.createElement('td');
              cell.colSpan = colSpan;
              cell.className = 'reservation-cell';
              // Used by CSS so the bar can extend by half-cell on each side
              cell.style.setProperty('--cols', colSpan);

              // Verifica se include sabato per colorare lo sfondo
              const saturdayIndicesInSpan = [];
              for (let k = 0; k < colSpan; k++) {
                if (new Date(dates[startIndex + k]).getDay() === 6) saturdayIndicesInSpan.push(k);
              }
              const isSaturdayIncluded = saturdayIndicesInSpan.length > 0;

              if (isSaturdayIncluded) {
                cell.classList.add('includes-saturday');
                // Paint a grey stripe BEHIND the bar for each internal Saturday
                const stripes = document.createElement('div');
                stripes.className = 'reservation-bg-stripes';
                stripes.setAttribute('aria-hidden', 'true');
                const pctW = 100 / colSpan;
                saturdayIndicesInSpan.forEach(k => {
                  const s = document.createElement('div');
                  s.className = 'reservation-bg-stripe';
                  s.style.left = (k * pctW) + '%';
                  s.style.width = pctW + '%';
                  stripes.appendChild(s);
                });
                cell.appendChild(stripes);
              }

              // Logica per colorare in base allo stato di pagamento
              const paymentClass = determinePaymentClass(currentReservation);

              // Debug - Visualizza i dati corretti
              console.log(`Creazione cella per prenotazione ${currentReservation.id}:`, {
                client: currentReservation.client_name,
                colore: currentReservation.reservation_color || 'yellow (default)',
                classe_applicata: paymentClass
              });

              // Calcola prezzo totale
              const totalPrice = parseFloat(currentReservation.price) || 0;

              // Ora usiamo direttamente il campo estimate_amount
              let estimateAmount = parseFloat(currentReservation.estimate_amount) || 0;
              // Calcola il totale pagato (somma di contanti e bonifico)
              const cashAmount = parseFloat(currentReservation.cash_amount) || 0;
              const transferAmount = parseFloat(currentReservation.transfer_amount) || 0;
              const totalPaid = cashAmount + transferAmount;
              const notes = currentReservation.notes || '';

              // Prepara tooltip con info aggiuntive
              const hasBeach = currentReservation.has_beach == 1 ? '✓ Spiaggia' : '✗ No spiaggia';
              const hasDeposit = currentReservation.has_deposit == 1 ? '✓ Caparra' : '✗ No caparra';
              const referenceText = currentReservation.reference || '';
              const numPeople = currentReservation.num_people ||
                  (parseInt(currentReservation.adults || 0) + parseInt(currentReservation.children || 0));

              const tooltipContent = `
                <b>${currentReservation.client_name}</b><br>
                Check-in: ${dateUtils.formatDate(currentReservation.check_in_date)}<br>
                Check-out: ${dateUtils.formatDate(currentReservation.check_out_date)}<br>
                Persone: ${numPeople}<br>
                ${hasBeach}<br>
                ${hasDeposit}
                ${referenceText ? `<br>Rif: ${referenceText}` : ''}
                ${estimateAmount > 0 ? `<br>Preventivo: <b>€${Math.round(estimateAmount)}</b>` : ''}
                <br>Pagato: <b>€${Math.round(totalPaid)}</b>
              `;

              // Abbrevia il nome del cliente se è troppo lungo per il display
              const shortClientName = currentReservation.client_name.length > 10 ?
                  currentReservation.client_name.substring(0, 10) + "..." :
                  currentReservation.client_name;

              const refText = currentReservation.reference ? String(currentReservation.reference).trim() : '';
              const estimateValue = parseFloat(currentReservation.estimate_amount) || 0;
              const priceText = estimateValue > 0 ? ('€' + Math.round(estimateValue)) : '';

              cell.innerHTML = `
  <div class="reservation-bar"
    data-reservation-id="${currentReservation.id}"
    data-bs-toggle="tooltip"
    data-bs-html="true"
    data-bs-title="${tooltipContent}">
    <div class="reservation-body">
      ${refText ? `<div class="reservation-ref">${refText}</div>` : ''}
      <div class="reservation-center">
        <div class="reservation-client-name">${currentReservation.client_name}</div>
      </div>
      ${priceText ? `<div class="reservation-price">${priceText}</div>` : ''}
    </div>
    <div class="reservation-right">
      ${currentReservation.has_beach == 1 ? '<span class="reservation-icon"><i class="fas fa-umbrella-beach"></i></span>' : ''}
      ${currentReservation.is_paid == 1 ? '<span class="reservation-icon"><i class="fas fa-check-circle"></i></span>' : ''}
      ${currentReservation.has_deposit == 1 && currentReservation.is_paid != 1 ? '<span class="reservation-icon"><i class="fas fa-coins"></i></span>' : ''}
    </div>
  </div>
`;
              // Aggiungi evento click per modifica
              const barElement = cell.querySelector('.reservation-bar');
              barElement.addEventListener('click', function(e) {
                e.stopPropagation();
                const reservationId = this.dataset.reservationId;
                console.log('Reservation clicked:', reservationId);
                editReservation(reservationId);
              });
              
              // Rimuovi tutte le classi di colore che potrebbero essere state applicate in precedenza
              barElement.classList.remove(
                'reservation-green', 'reservation-purple', 'reservation-orange',
                'reservation-blue', 'reservation-teal', 'reservation-color-yellow',
                'reservation-color-blue', 'reservation-color-orange'
              );
              
              // Applica la classe di colore corretta
              barElement.classList.add(paymentClass);

              row.appendChild(cell);

              // Inizializza tooltip
              const tooltip = new bootstrap.Tooltip(cell.querySelector('[data-bs-toggle="tooltip"]'), {
                html: true
              });
            }

            if (i === cellReservations.length) break;

            // Inizia un nuovo gruppo se c'è una prenotazione
            if (cellReservations[i]) {
              currentReservation = cellReservations[i];
              startIndex = i;
              endIndex = i;
            } else {
              // Cella vuota
              const cell = document.createElement('td');
              cell.dataset.date = dates[i];
              cell.dataset.roomId = room.id;

              // MODIFICATO: verifica solo se è sabato per colorare lo sfondo
              const cellDate = new Date(dates[i]);
              const isSaturday = cellDate.getDay() === 6; // 6=sabato
              if (isSaturday) {
                cell.classList.add('saturday-column');
              }

              // Aggiungi evento click per nuova prenotazione
              cell.addEventListener('click', function() {
                const date = this.dataset.date;
                const roomId = this.dataset.roomId;

                // Imposta la data nel form e apri il form
                resetReservationForm();
                document.getElementById('check-in-date').value = date;
                document.getElementById('check-out-date').value = dateUtils.addDays(date, 7);
                document.getElementById('room-select').value = roomId;

                // Apri il form di prenotazione
                reservationModal.show();
              });

              row.appendChild(cell);
              currentReservation = null;
            }
          } else if (cellReservations[i]) {
            // Continua il gruppo corrente
            endIndex = i;
          } else {
            // Cella vuota
            const cell = document.createElement('td');
            cell.dataset.date = dates[i];
            cell.dataset.roomId = room.id;

            // MODIFICATO: verifica solo se è sabato per colorare lo sfondo
            const cellDate = new Date(dates[i]);
            const isSaturday = cellDate.getDay() === 6; // 6=sabato
            if (isSaturday) {
              cell.classList.add('saturday-column');
            }

            // Aggiungi evento click per nuova prenotazione
            cell.addEventListener('click', function() {
              const date = this.dataset.date;
              const roomId = this.dataset.roomId;

              // Imposta la data nel form e apri il form
              resetReservationForm();
              document.getElementById('check-in-date').value = date;
              document.getElementById('check-out-date').value = dateUtils.addDays(date, 7);
              document.getElementById('room-select').value = roomId;

              // Apri il form di prenotazione
              reservationModal.show();
            });

            row.appendChild(cell);
            currentReservation = null;
          }
        }

        reservationTable.appendChild(row);
      });
    }
  });

  // Se non ci sono camere, mostra stato vuoto
  if (rooms.length === 0) {
    uiUtils.showEmptyState(
        reservationTable,
        'Nessun appartamento disponibile. Aggiungi appartamenti dalla sezione "Appartamenti".',
        'building'
    );
  }
}
function updatePaymentStatus() {
  const estimateAmount = parseFloat(document.getElementById('estimate-amount').value) || 0;
  const cashAmount = parseFloat(document.getElementById('cash-amount').value) || 0;
  const transferAmount = parseFloat(document.getElementById('transfer-amount').value) || 0;
  const paymentStatusElement = document.getElementById('payment-status');
  
  const totalPaid = cashAmount + transferAmount;
  const isPaid = (totalPaid >= estimateAmount && estimateAmount > 0) || (totalPaid > 0 && estimateAmount === 0);
  
  if (paymentStatusElement) {
    if (isPaid) {
      paymentStatusElement.innerHTML = '<span class="badge bg-success">Pagato</span>';
    } else {
      paymentStatusElement.innerHTML = '<span class="badge bg-danger">Non Pagato</span>';
    }
  }
  
  return isPaid;
}
// Questa funzione determina la classe CSS da applicare in base al colore scelto dall'utente
function determinePaymentClass(reservation) {
  // Usa il colore scelto dall'utente (default: yellow)
  const reservationColor = reservation.reservation_color || 'yellow';
  
  // Mappa il valore del colore alla classe CSS corrispondente
  const colorClassMap = {
    'yellow': 'reservation-color-yellow',  // Confermata
    'blue': 'reservation-color-blue',      // Info/Cliente precedente
    'orange': 'reservation-color-orange'   // Senza caparra
  };
  
  // Debug per verificare quale colore è impostato
  console.log(`Prenotazione ID ${reservation.id} - Colore: ${reservationColor}`);
  
  // Restituisci la classe CSS corrispondente o default a yellow
  return colorClassMap[reservationColor] || 'reservation-color-yellow';
}

async function editReservation(reservationId) {
  try {
    console.log('Opening reservation modal for editing reservation ID:', reservationId);
    // Use openReservationModal which will handle loading and filling the form
    await openReservationModal(reservationId);
  } catch (error) {
    console.error('Error opening reservation for editing:', error);
    uiUtils.showToast('Errore nel caricare la prenotazione', 'danger');
  }
}

// Versione aggiornata della funzione fillReservationForm
async function fillReservationForm(reservation) {
  console.log('Riempimento form con dati prenotazione:', {
    id: reservation.id,
    client_id: reservation.client_id,
    client_name: reservation.client_name,
    room_id: reservation.room_id,
    check_in_date: reservation.check_in_date,
    check_out_date: reservation.check_out_date
  });
  
  try {
    // Imposta il client tramite autocomplete
    if (reservation.client_id && reservation.client_name) {
      const clientSearch = document.getElementById('client-search');
      const clientId = document.getElementById('client-id');
      
      if (clientSearch && clientId) {
        clientSearch.value = reservation.client_name;
        clientId.value = reservation.client_id;
      } else {
        console.error('Elementi DOM per la selezione cliente non trovati');
      }
    } else {
      console.warn('Dati cliente mancanti nella prenotazione:', reservation);
    }
    
    // Imposta l'appartamento
    if (reservation.room_id) {
      document.getElementById('room-select').value = reservation.room_id;
    }
    
    // Imposta le date utilizzando la nuova funzione formatDateForInput
    const checkInField = document.getElementById('check-in-date');
    const checkOutField = document.getElementById('check-out-date');
    
    if (checkInField && reservation.check_in_date) {
      checkInField.value = dateUtils.formatDateForInput(reservation.check_in_date);
      console.log('Data check-in impostata:', checkInField.value);
    } else {
      console.warn('Campo check-in non trovato o data mancante');
    }
    
    if (checkOutField && reservation.check_out_date) {
      checkOutField.value = dateUtils.formatDateForInput(reservation.check_out_date);
      console.log('Data check-out impostata:', checkOutField.value);
    } else {
      console.warn('Campo check-out non trovato o data mancante');
    }
    
    // Imposta il numero di persone
    document.getElementById('num-people').value = reservation.num_people || '1';
    
    // Imposta i checkbox (is_paid rimosso perché ora è calcolato automaticamente)
    document.getElementById('has-beach').checked = reservation.has_beach === 1;
    document.getElementById('has-deposit').checked = reservation.has_deposit === 1;
    
    // Imposta gli importi
    document.getElementById('estimate-amount').value = reservation.estimate_amount || '0';
    document.getElementById('cash-amount').value = reservation.cash_amount || '0';
    document.getElementById('transfer-amount').value = reservation.transfer_amount || '0';
    
    // Imposta colore, note e riferimento
    const colorValue = reservation.reservation_color || 'yellow';
    const colorRadio = document.querySelector(`input[name="reservation-color"][value="${colorValue}"]`);
    if (colorRadio) {
      colorRadio.checked = true;
    } else {
      // Fallback to yellow if the color doesn't exist
      document.querySelector('input[name="reservation-color"][value="yellow"]').checked = true;
    }
    
    document.getElementById('notes').value = reservation.notes || '';
    document.getElementById('reference').value = reservation.reference || '';
  } catch (error) {
    console.error('Errore durante il riempimento del form:', error);
    throw error;
  }
}

async function saveReservation() {
  try {
    const form = document.getElementById('reservation-form');
    
    // Form validation
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      // Aggiungi messaggi di errore più visibili
      const errorMessage = Array.from(form.elements)
        .filter(el => !el.checkValidity() && el.required)
        .map(el => {
          const fieldName = el.labels && el.labels[0] ? el.labels[0].textContent : el.name;
          return `Campo "${fieldName}" obbligatorio`;
        })
        .join('. ');
      
      if (errorMessage) {
        uiUtils.showToast(errorMessage, 'danger');
      } else {
        uiUtils.showToast('Controlla i campi evidenziati in rosso', 'danger');
      }
      return;
    }
    
    // Validazione specifica per il campo cliente
    if (!validateClientField()) {
      return;
    }

    // Prendi il colore dai radio buttons
    const selectedColorRadio = document.querySelector('input[name="reservation-color"]:checked');
    const reservationColor = selectedColorRadio ? selectedColorRadio.value : 'yellow';
    
    // Gestione cliente: verifica se è un cliente esistente o nuovo
  const clientId = document.getElementById('client-id').value;
    const clientName = document.getElementById('client-search').value.trim();
    let finalClientId = clientId;
    
    if (!clientId && clientName) {
      // È un nuovo cliente, dobbiamo verificare se il nome esiste già
  const clientPhone = document.getElementById('client-phone').value.trim();
      
      try {
        // Mostra un indicatore di caricamento
        const saveBtn = document.getElementById('save-reservation');
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Verifica cliente...';
        
        // Ottieni tutti i clienti per verificare se esiste già
        const existingClients = await api.clients.getAll();
        
        // Cerca potenziali duplicati (stesse iniziali e lunghezze simili del nome)
        const potentialDuplicates = existingClients.filter(c => {
          // Converte entrambi i nomi in lowercase per il confronto
          const existingName = c.name.toLowerCase();
          const newName = clientName.toLowerCase();
          
          // Controlla se il nome è molto simile
          return (
            // Nomi identici (ignorando maiuscole/minuscole)
            existingName === newName ||
            // O inizia con le stesse parole e ha lunghezza simile
            (existingName.startsWith(newName.substring(0, 5)) && 
             Math.abs(existingName.length - newName.length) < 3)
          );
        });
        
        // Se esistono potenziali duplicati, chiedi conferma all'utente
        if (potentialDuplicates.length > 0) {
          const firstDuplicate = potentialDuplicates[0];
          
          // Ripristina il pulsante di salvataggio
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalBtnText;
          
          const confirmDuplicate = confirm(
            `Esiste già un cliente simile nel sistema:\n\n` +
            `"${firstDuplicate.name}" ${firstDuplicate.phone ? `(${firstDuplicate.phone})` : ''}\n\n` +
            `Vuoi utilizzare questo cliente esistente invece di crearne uno nuovo?`
          );
          
          if (confirmDuplicate) {
            // Usa il cliente esistente
            finalClientId = firstDuplicate.id;
            
            // Aggiorna il campo di ricerca con il nome corretto
            document.getElementById('client-search').value = firstDuplicate.name;
          } else {
            // Usa un nuovo cliente come richiesto dall'utente
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creazione cliente...';
            
            // Crea un nuovo cliente
            const newClient = await api.clients.create({
              name: clientName,
              phone: clientPhone
            });
            
            finalClientId = newClient.id;
            uiUtils.showToast(`Nuovo cliente "${clientName}" aggiunto con successo`, 'success');
          }
        } else {
          // Nessun duplicato, crea un nuovo cliente
          saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creazione cliente...';
          
          const newClient = await api.clients.create({
            name: clientName,
            phone: clientPhone
          });
          
          finalClientId = newClient.id;
          uiUtils.showToast(`Nuovo cliente "${clientName}" aggiunto con successo`, 'success');
        }
        
        // Ripristina il pulsante di salvataggio
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      } catch (error) {
        console.error('Error creating/checking client:', error);
        uiUtils.showToast('Errore nella gestione del cliente', 'danger');
    return;
      }
    }
    
    // Mostra indicatore di caricamento durante il salvataggio della prenotazione
    const saveBtn = document.getElementById('save-reservation');
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvataggio...';
    
    // Collect form data
    const reservationId = document.getElementById('reservation-id').value;
    
    // Calcola automaticamente se la prenotazione è pagata in base agli importi
    const estimateAmount = parseFloat(document.getElementById('estimate-amount').value) || 0;
    const cashAmount = parseFloat(document.getElementById('cash-amount').value) || 0;
    const transferAmount = parseFloat(document.getElementById('transfer-amount').value) || 0;
    
    // Prenotazione automaticamente pagata se contanti + bonifico >= preventivo (o se sono stati inseriti pagamenti ma non preventivo)
    const totalPaid = cashAmount + transferAmount;
    const isPaid = (totalPaid >= estimateAmount && estimateAmount > 0) || (totalPaid > 0 && estimateAmount === 0);
    
    const reservationData = {
      client_id: finalClientId,
      room_id: document.getElementById('room-select').value,
      check_in_date: document.getElementById('check-in-date').value,
      check_out_date: document.getElementById('check-out-date').value,
      num_people: Math.max(parseInt(document.getElementById('num-people').value, 10) || 1, 1),
      has_beach: document.getElementById('has-beach').checked ? 1 : 0,
      has_deposit: document.getElementById('has-deposit').checked ? 1 : 0,
      is_paid: isPaid ? 1 : 0, // Ora calcolato automaticamente
      estimate_amount: estimateAmount,
      cash_amount: cashAmount,
      transfer_amount: transferAmount,
      reservation_color: reservationColor, // Usa reservation_color invece di color
      notes: document.getElementById('notes').value.trim(),
      reference: document.getElementById('reference').value.trim()
    };
    
    if (currentReservationId) {
      await api.reservations.update(currentReservationId, reservationData);
      uiUtils.showToast('Prenotazione aggiornata con successo!', 'success');
    } else {
      await api.reservations.create(reservationData);
      uiUtils.showToast('Prenotazione creata con successo!', 'success');
    }
    window.invalidateSectionCache && window.invalidateSectionCache(['dashboard', 'reservations', 'history']);
    if (window.__dataCache) window.__dataCache.at = 0;
    
    // Ripristina il pulsante e chiudi il modale
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalBtnText;
    reservationModal.hide();
    
    // Aggiorna tutte le sezioni rilevanti
    refreshReservationCalendar();
    loadDashboardData();
    loadReservationsHistory();
    
    // Aggiorna la lista dei clienti dopo aver creato un nuovo cliente
    if (!clientId && clientName) {
      await loadClients();
    }
  } catch (error) {
    console.error('Error saving reservation:', error);
    uiUtils.showToast('Errore nel salvare la prenotazione', 'danger');
    
    // Ripristina il pulsante in caso di errore
    const saveBtn = document.getElementById('save-reservation');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = currentReservationId ? 'Aggiorna Prenotazione' : 'Salva Prenotazione';
    }
  }
}

// Funzione modificata per il reset del form di prenotazione
function resetReservationForm() {
  // Clear reservation ID
  currentReservationId = null;
  
  // Reset form
  const form = document.getElementById('reservation-form');
  if (form) {
    form.reset();
    form.classList.remove('was-validated');
  }
  
  // Reset form title
  const modalTitle = document.getElementById('reservationModalLabel');
  if (modalTitle) {
    modalTitle.textContent = 'Nuova Prenotazione';
  } else {
    console.error('Elemento con ID reservationModalLabel non trovato');
  }
  
  // Reset client select container
  const clientSelectContainer = document.getElementById('client-select-container');
  if (clientSelectContainer) {
    // Il contenuto sarà generato quando verrà chiamato setupClientAutocomplete()
  }
  
  // Reset client hidden fields
  const clientIdField = document.getElementById('client-id');
  if (clientIdField) {
    clientIdField.value = '';
  }
  
  // Reset room select
    const roomSelect = document.getElementById('room-select');
  if (roomSelect) {
    roomSelect.value = '';
  }
}

// Reset apartment form
function resetApartmentForm() {
  const form = document.getElementById('apartment-form');
  form.reset();
  
  // Reset ID field
  document.getElementById('apartment-id').value = '';
  
  // Reset modal title and button
  document.getElementById('apartment-modal-title').textContent = 'Nuovo Appartamento';
  document.getElementById('save-apartment').textContent = 'Aggiungi Appartamento';
  
  // RIMUOVERE QUESTA RIGA - Il campo disposizione non esiste più
  // document.getElementById('apartment-disposizione').value = '';
  
  // Rimuovi le classi di validazione
  form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}
// Reset client form
function resetClientForm() {
  const form = document.getElementById('client-form');
  form.reset();
  
  // Rimuovi le classi di validazione
  form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

// Save apartment - MODIFICATO: rimossa proprietà disposizione
async function saveApartment() {
  // Get form values
  const apartmentId = document.getElementById('apartment-id').value;
  const apartmentName = document.getElementById('apartment-name').value;
  const apartmentType = document.getElementById('apartment-type').value;
  const apartmentFloor = document.getElementById('apartment-floor').value;
  
  // Validate form
  const errors = [];
  
  if (!apartmentName) errors.push('Inserisci il nome dell\'appartamento');
  if (!apartmentType) errors.push('Seleziona la tipologia dell\'appartamento');
  if (!apartmentFloor) errors.push('Seleziona il piano dell\'appartamento');
  
  if (errors.length > 0) {
    uiUtils.showToast(errors.join('. '), 'danger');
    return;
  }
  
  // Disable button and show loading
  const saveButton = document.getElementById('save-apartment');
  saveButton.disabled = true;
  saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvataggio...';
  
  try {
    // Create apartment data - MODIFICATO: rimossa proprietà disposizione
    const apartmentData = {
      room_number: apartmentName,
      room_type: apartmentType,
      floor: apartmentFloor
    };
    
    let result;
    
    if (apartmentId) {
      // Update existing apartment
      result = await api.rooms.update(apartmentId, apartmentData);
      uiUtils.showToast('Appartamento aggiornato con successo!', 'success');
    } else {
      // Create new apartment
      result = await api.rooms.create(apartmentData);
      uiUtils.showToast('Appartamento aggiunto con successo!', 'success');
    }
    
    // Reset button state
    saveButton.disabled = false;
    saveButton.textContent = apartmentId ? 'Aggiorna Appartamento' : 'Aggiungi Appartamento';
    
    // Close modal
    apartmentModal.hide();
    
    // Reload rooms and refresh data
    loadRooms();
    loadDashboardData();
    refreshReservationCalendar();
  } catch (error) {
    console.error('Error saving apartment:', error);
    // Errore già gestito in api.js
    
    // Reset button state
    saveButton.disabled = false;
    saveButton.textContent = apartmentId ? 'Aggiorna Appartamento' : 'Aggiungi Appartamento';
  }
}

// Save client
async function saveClient() {
  // Get form values
  const clientName = document.getElementById('new-client-name').value;
  const clientPhone = document.getElementById('new-client-phone').value;
  
  // Validate form
  if (!clientName) {
    uiUtils.showToast('Inserisci il nome del cliente', 'danger');
    return;
  }
  
  // Disable button and show loading
  const saveButton = document.getElementById('save-client');
  saveButton.disabled = true;
  saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvataggio...';
  
  try {
    // Create client data
    const clientData = {
      name: clientName,
      phone: clientPhone || null
    };
    
    // Send client data to server
    const result = await api.clients.create(clientData);
    
    uiUtils.showToast('Cliente aggiunto con successo!', 'success');
    
    // Reset button state
    saveButton.disabled = false;
    saveButton.textContent = 'Salva Cliente';
    
    // Close modal
    clientModal.hide();
    
    // Reload clients
    loadClients();
  } catch (error) {
    console.error('Error adding client:', error);
    // Errore già gestito in api.js
    
    // Reset button state
    saveButton.disabled = false;
    saveButton.textContent = 'Salva Cliente';
  }
}

async function loadRooms() {
  try {
    const roomsList = document.getElementById('apartments-list');
    let rooms;

    const cache = window.__dataCache;
    const CACHE_TTL = 60 * 1000;
    const cacheFresh = cache && cache.rooms && (Date.now() - (cache.at || 0)) < CACHE_TTL;

    if (cacheFresh) {
      rooms = cache.rooms;
    } else {
      if (roomsList) uiUtils.showLoading(roomsList, 'Caricamento appartamenti...');
      rooms = await api.rooms.getAll();
    }

    updateRoomsList(rooms);
    updateRoomSelects(rooms);
  } catch (error) {
    console.error('Error loading rooms:', error);
    
    // MODIFICATO: anche qui cerchiamo apartments-list
    const roomsList = document.getElementById('apartments-list');
    if (roomsList) {
      const retryButton = uiUtils.showErrorState(roomsList, 'Errore durante il caricamento degli appartamenti');
      if (retryButton) {
        retryButton.addEventListener('click', loadRooms);
      }
    }
  }
}

function updateRoomsList(rooms) {
  // MODIFICATO: roomsList cerca ora apartments-list invece di rooms-list
  const roomsList = document.getElementById('apartments-list');
  
  if (!roomsList) return;
  
  roomsList.innerHTML = '';
  
  if (rooms.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="4" class="text-center py-3 text-muted">Nessun appartamento disponibile</td>
    `;
    roomsList.appendChild(row);
    return;
  }

  rooms.forEach((room) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${room.room_number}</td>
      <td>${room.room_type}</td>
      <td>${room.floor || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1 edit-room"
          data-id="${room.id}"
          data-name="${room.room_number}"
          data-type="${room.room_type}"
          data-floor="${room.floor}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger delete-room" data-id="${room.id}">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    roomsList.appendChild(row);
  });
  
  // Add edit event handlers
  const editButtons = document.querySelectorAll('.edit-room');
  editButtons.forEach(button => {
    button.addEventListener('click', function() {
      const roomId = this.dataset.id;
      const roomName = this.dataset.name;
      const roomType = this.dataset.type;
      const roomFloor = this.dataset.floor;
      
      // Populate form with room data - MODIFICATO: rimossa proprietà disposizione
      document.getElementById('apartment-id').value = roomId;
      document.getElementById('apartment-name').value = roomName;
      document.getElementById('apartment-type').value = roomType;
      document.getElementById('apartment-floor').value = roomFloor;
      
      // Update modal title and button text
      document.getElementById('apartment-modal-title').textContent = 'Modifica Appartamento';
      document.getElementById('save-apartment').textContent = 'Aggiorna Appartamento';
      
      // Show modal
      apartmentModal.show();
    });
  });
  
  // Add delete event handlers
  const deleteButtons = document.querySelectorAll('.delete-room');
  deleteButtons.forEach(button => {
    button.addEventListener('click', function() {
      const roomId = this.dataset.id;
      
      if (confirm('Sei sicuro di voler eliminare questo appartamento?')) {
        deleteRoom(roomId);
      }
    });
  });
}
// Update room selects in forms
function updateRoomSelects(rooms) {
  const roomSelect = document.getElementById('room-select');
  
  if (!roomSelect) return;
  
  // Clear existing options except the first one
  while (roomSelect.options.length > 1) {
    roomSelect.remove(1);
  }
  
  // Add room options
  rooms.forEach(room => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = `${room.room_number} - ${room.room_type}`;
    roomSelect.appendChild(option);
  });
}

// Delete room
async function deleteRoom(roomId) {
  try {
    await api.rooms.delete(roomId);
    
    uiUtils.showToast('Appartamento eliminato con successo!', 'success');
    
    // Reload data
    loadRooms();
    loadDashboardData();
    refreshReservationCalendar();
      } catch (error) {
    console.error('Error deleting room:', error);
    // Errore già gestito in api.js
  }
}

// Load clients
async function loadClients() {
  try {
    const clientsList = document.getElementById('clients-list');
    if (clientsList) {
      uiUtils.showLoading(clientsList, 'Caricamento clienti...');
    }
    
    const clients = await api.clients.getAll();
    
    updateClientsList(clients);
  } catch (error) {
    console.error('Error loading clients:', error);
    
    const clientsList = document.getElementById('clients-list');
    if (clientsList) {
      const retryButton = uiUtils.showErrorState(clientsList, 'Errore durante il caricamento dei clienti');
      if (retryButton) {
        retryButton.addEventListener('click', loadClients);
      }
    }
  }
}

// Update clients list
function updateClientsList(clients) {
  const clientsList = document.getElementById('clients-list');
  
  if (!clientsList) return;
  
  clientsList.innerHTML = '';
  
  if (clients.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="3" class="text-center py-3 text-muted">Nessun cliente registrato</td>
    `;
    clientsList.appendChild(row);
    return;
  }
  
  clients.forEach(client => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${client.name}</td>
      <td>${client.phone || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1 edit-client" data-id="${client.id}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary client-history" data-id="${client.id}">
          <i class="fas fa-history"></i>
        </button>
      </td>
    `;
    clientsList.appendChild(row);
  });
  
  // Add edit event handlers
  const editButtons = document.querySelectorAll('.edit-client');
  editButtons.forEach(button => {
    button.addEventListener('click', function() {
      const clientId = this.dataset.id;
      
      // TODO: Implementare modifica cliente
      uiUtils.showToast('Funzionalità di modifica cliente in sviluppo', 'info');
    });
  });
  
  // Add history event handlers
  const historyButtons = document.querySelectorAll('.client-history');
  historyButtons.forEach(button => {
    button.addEventListener('click', function() {
      const clientId = this.dataset.id;
      
      // TODO: Implementare visualizzazione storico cliente
      uiUtils.showToast('Funzionalità di storico cliente in sviluppo', 'info');
    });
  });
}
// Funzione per trovare appartamenti disponibili in un determinato periodo
async function findAvailableApartments(checkInDate, checkOutDate) {
  try {
    // Carica tutte le prenotazioni e gli appartamenti
    const [reservations, rooms] = await Promise.all([
      api.reservations.getAll(),
      api.rooms.getAll()
    ]);
    
    // Converte le date in oggetti Date per la comparazione
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    
    // Filtra gli appartamenti disponibili
    const availableRooms = rooms.filter(room => {
      // Controlla se ci sono prenotazioni sovrapposte per questo appartamento
      const hasOverlappingReservation = reservations.some(reservation => {
        if (reservation.room_id !== room.id) return false;
        
        const reservationCheckIn = new Date(reservation.check_in_date);
        const reservationCheckOut = new Date(reservation.check_out_date);
        
        // Una prenotazione si sovrappone se:
        // - Il check-in richiesto è prima del check-out della prenotazione esistente E
        // - Il check-out richiesto è dopo il check-in della prenotazione esistente
        return (checkIn < reservationCheckOut && checkOut > reservationCheckIn);
      });
      
      // Ritorna true se NON ci sono prenotazioni sovrapposte
      return !hasOverlappingReservation;
    });
    
    return availableRooms;
  } catch (error) {
    console.error('Errore nella ricerca di appartamenti disponibili:', error);
    throw error;
  }
}

// Funzione per gestire l'invio del form di ricerca appartamenti disponibili
async function handleAvailableApartmentsSearch(e) {
  e.preventDefault();
  
  // Recupera i valori delle date
  const checkInDate = document.getElementById('available-check-in').value;
  const checkOutDate = document.getElementById('available-check-out').value;
  
  // Validazione date
  const dateErrors = dateUtils.validateDateRange(checkInDate, checkOutDate);
  if (dateErrors.length > 0) {
    uiUtils.showToast(dateErrors.join('. '), 'danger');
    return;
  }
  
  // Mostra un indicatore di caricamento
  const resultsContainer = document.getElementById('available-apartments-list');
  const resultsSection = document.getElementById('available-apartments-results');
  
  resultsSection.classList.remove('d-none');
  uiUtils.showLoading(resultsContainer, 'Ricerca appartamenti disponibili...');
  
  // Aggiorna le date nei risultati
  document.getElementById('result-check-in').textContent = dateUtils.formatDate(checkInDate);
  document.getElementById('result-check-out').textContent = dateUtils.formatDate(checkOutDate);
  
  try {
    // Cerca appartamenti disponibili
    const availableRooms = await findAvailableApartments(checkInDate, checkOutDate);
    
    // Visualizza i risultati
    displayAvailableApartments(availableRooms, checkInDate, checkOutDate);
  } catch (error) {
    console.error('Errore durante la ricerca:', error);
    
    const retryButton = uiUtils.showErrorState(
      resultsContainer, 
      'Si è verificato un errore durante la ricerca degli appartamenti disponibili'
    );
    
    if (retryButton) {
      retryButton.addEventListener('click', () => handleAvailableApartmentsSearch(e));
    }
  }
}

// Funzione per visualizzare gli appartamenti disponibili
function displayAvailableApartments(availableRooms, checkInDate, checkOutDate) {
  const resultsContainer = document.getElementById('available-apartments-list');
  
  // Se non ci sono risultati, mostra un messaggio
  if (availableRooms.length === 0) {
    uiUtils.showEmptyState(
      resultsContainer, 
      'Nessun appartamento disponibile per il periodo selezionato', 
      'building'
    );
    return;
  }
  
  // Svuota il contenitore
  resultsContainer.innerHTML = '';
  
  // Crea una card per ogni appartamento disponibile
  availableRooms.forEach(room => {
    const roomCard = document.createElement('div');
    roomCard.className = 'col-md-4 mb-3';
    
    // Colore di sfondo in base al piano
    let bgColorClass = 'bg-light';
    if (room.floor === 'Piano Terra') bgColorClass = 'bg-white';
    else if (room.floor === 'Primo Piano') bgColorClass = 'bg-light';
    else if (room.floor === 'Secondo Piano') bgColorClass = 'bg-info bg-opacity-10';
    else if (room.floor === 'Terzo Piano') bgColorClass = 'bg-warning bg-opacity-10';
    
    roomCard.innerHTML = `
      <div class="card h-100 border-0">
        <div class="card-header ${bgColorClass}">
          <h6 class="mb-0 d-flex justify-content-between align-items-center">
            <span>${room.room_number}</span>
            <span class="badge bg-primary">${room.room_type}</span>
          </h6>
        </div>
        <div class="card-body">
          <p class="card-text small mb-2">
            <i class="fas fa-building me-2 text-muted"></i>${room.floor}
          </p>
          <!-- RIMOSSO riferimento a room.disposizione -->
          <button class="btn btn-sm btn-outline-primary book-now-btn w-100" 
                  data-room-id="${room.id}"
                  data-check-in="${checkInDate}"
                  data-check-out="${checkOutDate}">
            <i class="fas fa-calendar-check me-1"></i>Prenota Ora
          </button>
        </div>
      </div>
    `;
    
    resultsContainer.appendChild(roomCard);
  });
  
  // Aggiungi event listener ai pulsanti "Prenota Ora"
  const bookButtons = document.querySelectorAll('.book-now-btn');
  bookButtons.forEach(button => {
    button.addEventListener('click', function() {
      const roomId = this.dataset.roomId;
      const checkIn = this.dataset.checkIn;
      const checkOut = this.dataset.checkOut;
      
      // Apre il form di prenotazione con i dati precompilati
      resetReservationForm();
      document.getElementById('room-select').value = roomId;
      document.getElementById('check-in-date').value = checkIn;
      document.getElementById('check-out-date').value = checkOut;
      
      // Mostra il modal
      reservationModal.show();
    });
  });
}

async function loadReservationsHistory() {
  try {
    const historyList = document.getElementById('rooms-list');
    let reservations;

    // Instant render from shared cache if available
    const cache = window.__dataCache;
    const CACHE_TTL = 60 * 1000;
    const cacheFresh = cache && cache.reservations && (Date.now() - (cache.at || 0)) < CACHE_TTL;

    if (cacheFresh) {
      reservations = cache.reservations;
    } else {
      if (historyList) uiUtils.showLoading(historyList, 'Caricamento storico prenotazioni...');
      reservations = await api.reservations.getAll();
    }

    // Memorizza tutte le prenotazioni per la ricerca
    allReservations = reservations;
    
    // Ottieni i valori attuali dei campi di ricerca
    const clientSearch = document.getElementById('history-client-search')?.value.trim();
    const roomSearch = document.getElementById('history-room-search')?.value.trim();
    
    // Se sono attivi i filtri di ricerca, filtra le prenotazioni
    if (clientSearch || roomSearch) {
      const filteredReservations = filterReservations(clientSearch, roomSearch);
      updateReservationsHistory(filteredReservations);
    } else {
      // Altrimenti mostra tutte le prenotazioni
      updateReservationsHistory(reservations);
    }
  } catch (error) {
    console.error('Error loading reservations history:', error);
    
    // MODIFICATO: anche qui cerchiamo 'rooms-list'
    const historyList = document.getElementById('rooms-list');
    if (historyList) {
      const retryButton = uiUtils.showErrorState(historyList, 'Errore durante il caricamento dello storico prenotazioni');
      if (retryButton) {
        retryButton.addEventListener('click', loadReservationsHistory);
      }
    }
  }
}


function updateReservationsHistory(reservations) {
  // MODIFICATO: historyList deve cercare 'rooms-list' invece di 'history-list'
  const historyList = document.getElementById('rooms-list');
  
  if (!historyList) return;
  
  historyList.innerHTML = '';
  
  if (reservations.length === 0) {
    const row = document.createElement('tr');
    // MODIFICATO: colspan="7" per coprire tutte e 7 le colonne della tabella
    row.innerHTML = `
      <td colspan="7" class="text-center py-3 text-muted">Nessuna prenotazione trovata</td>
    `;
    historyList.appendChild(row);
    return;
  }
  
  // Sort reservations by check-in date (newest first)
  reservations.sort((a, b) => new Date(b.check_in_date) - new Date(a.check_in_date));
  
  reservations.forEach(reservation => {
    // Determine payment status badge
    const isPaid = reservation.is_paid === 1;
    const paymentStatusBadge = isPaid ? 
      '<span class="status-badge" style="background-color: rgba(87, 204, 32, 0.15); color:rgb(32, 204, 6); border: 1px solid rgb(27, 207, 14);">Pagato</span>' : 
      '<span class="status-badge" style="background-color: rgba(220, 53, 69, 0.15); color: #dc3545; border: 1px solid #dc3545;">Non pagato</span>';
    
    // Badges for new fields
    // Verifica if per evitare errori quando i valori sono undefined o null
    const hasBeach = reservation.has_beach == 1 ? 
      '<span class="feature-badge beach-badge"><i class="fas fa-umbrella-beach me-1"></i> Spiaggia</span>' : '';
    
    const hasDeposit = reservation.has_deposit == 1 ? 
      '<span class="feature-badge deposit-badge"><i class="fas fa-money-bill-wave me-1"></i> Caparra</span>' : '';
    
    const reference = reservation.reference ? 
      `<span class="feature-badge ref-badge"><i class="fas fa-tag me-1"></i> ${reservation.reference}</span>` : '';
    
    // Calculate total people - usa num_people direttamente se disponibile
    const numPeople = reservation.num_people || 
      (parseInt(reservation.adults || 0) + parseInt(reservation.children || 0)) || 1;
    
    // Payment details
    const cashAmount = parseFloat(reservation.cash_amount) || 0;
    const transferAmount = parseFloat(reservation.transfer_amount) || 0;
    
    // Ora utilizziamo direttamente il campo estimate_amount
    const estimateAmount = parseFloat(reservation.estimate_amount) || 0;
    // Calcola il totale pagato
    const totalPaid = cashAmount + transferAmount;
    const notes = reservation.notes || '';
    
    const paymentDetails = `
      <div>
        ${estimateAmount > 0 ? `<div><span class="text-muted">Preventivo:</span> €${Math.round(estimateAmount)}</div>` : ''}
        <div><span style="color: #198754;">Contanti:</span> €${Math.round(cashAmount)}</div>
        <div><span style="color: #0d6efd;">Bonifico:</span> €${Math.round(transferAmount)}</div>
        <div><span class="fw-bold">Totale:</span> €${Math.round(totalPaid)}</div>
      </div>
    `;
    
    // Debug dei valori
    console.log('Prenotazione storico:', {
      id: reservation.id,
      client: reservation.client_name,
      numPeople: numPeople,
      hasBeach: reservation.has_beach,
      hasDeposit: reservation.has_deposit,
      reference: reservation.reference
    });
    
    const row = document.createElement('tr');
    // Aggiungi classe e attributo per rendere la riga cliccabile
    row.classList.add('reservation-history-row');
    row.setAttribute('data-id', reservation.id);
    row.style.cursor = 'pointer';
    
    row.innerHTML = `
      <td>${reservation.client_name}</td>
      <td>${reservation.room_number}</td>
      <td>${dateUtils.formatDate(reservation.check_in_date)}</td>
      <td>${dateUtils.formatDate(reservation.check_out_date)}</td>
      <td>${paymentDetails}</td>
      <td class="notes-cell">
        <div class="mb-2"><strong>${numPeople}</strong> persone</div>
        <div class="mb-2">
          ${hasBeach}
          ${hasDeposit}
          ${reference}
        </div>
        <div class="notes-text">
          ${notes.replace(/\s*\|\s*Preventivo: €[0-9.]+/, '')}
        </div>
        <div class="mt-1">${paymentStatusBadge}</div>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary edit-reservation-history me-1" data-id="${reservation.id}">
          <i class="fas fa-edit"></i> Modifica
        </button>
        <button class="btn btn-sm btn-outline-danger delete-reservation-history" data-id="${reservation.id}">
          <i class="fas fa-trash"></i> Elimina
        </button>
      </td>
    `;
    historyList.appendChild(row);
  });
  
  // Add edit event handlers
  const editButtons = document.querySelectorAll('.edit-reservation-history');
  editButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation(); // Ferma la propagazione per evitare doppi click
      const reservationId = this.dataset.id;
      editReservation(reservationId);
    });
  });
  
  // Add delete event handlers
  const deleteButtons = document.querySelectorAll('.delete-reservation-history');
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation(); // Ferma la propagazione per evitare doppi click
      const reservationId = this.dataset.id;
      deleteReservation(reservationId);
    });
  });
  
  // Aggiungi event handler per click sulla riga
  const reservationRows = document.querySelectorAll('.reservation-history-row');
  reservationRows.forEach(row => {
    row.addEventListener('click', function() {
      const reservationId = this.dataset.id;
      editReservation(reservationId);
    });
  });
}
// Export to CSV
async function exportAllToCSV() {
  try {
    uiUtils.showToast('Preparazione esportazione dati in corso...', 'info');
    
    const data = await api.settings.exportData();
    
    // Create CSV content
    const csvContent = dataUtils.createCSV({
      clienti: data.clients,
      appartamenti: data.rooms,
      prenotazioni: data.reservations
    });
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Get hotel name for filename
    const hotelName = document.getElementById('hotel-name-input').value
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${hotelName}_export_${dateUtils.today()}.csv`);
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    uiUtils.showToast('Esportazione completata con successo!', 'success');
  } catch (error) {
    console.error('Error exporting data:', error);
    uiUtils.showToast('Errore durante l\'esportazione dei dati', 'danger');
  }
}

// Import data from CSV file
function importFromCSV(file) {
  if (!file) {
    uiUtils.showToast('Nessun file selezionato', 'danger');
    return;
  }
  
  // Check file extension
  if (!file.name.toLowerCase().endsWith('.csv')) {
    uiUtils.showToast('Il file deve essere in formato CSV', 'danger');
    return;
  }
  
  uiUtils.showToast('Importazione dati in corso...', 'info');
  
  const reader = new FileReader();
  
  reader.onload = async function(e) {
    try {
      const content = e.target.result;
      const importData = dataUtils.parseCSV(content);
      
      // Send data to server
      const result = await api.settings.importData(importData);
      
      uiUtils.showToast(result.message, 'success');
      
      // Reload all data
      loadSettings();
      loadDashboardData();
      loadRooms();
      loadClients();
      loadReservationsHistory();
      refreshReservationCalendar();
    } catch (error) {
      console.error('Error importing data:', error);
      uiUtils.showToast(error.message || 'Errore durante l\'importazione dei dati', 'danger');
    }
  };
  
  reader.onerror = function() {
    uiUtils.showToast('Errore durante la lettura del file', 'danger');
  };
  
  reader.readAsText(file);
}

// Carica le prenotazioni eliminate (cestino)
async function loadTrash() {
  const trashListContainer = document.getElementById('trash-list');
  
  if (!trashListContainer) return;
  
  // Mostra stato di caricamento
  trashListContainer.innerHTML = `
    <tr>
      <td colspan="8" class="text-center py-3">
        <div class="d-flex justify-content-center align-items-center loading-indicator">
          <div class="spinner-border text-primary me-2" role="status">
            <span class="visually-hidden">Caricamento...</span>
          </div>
          <span>Caricamento prenotazioni eliminate...</span>
        </div>
      </td>
    </tr>
  `;
  
  try {
    // Ottieni le prenotazioni eliminate dal server
    const deletedReservations = await api.reservations.getTrash();
    
    // Aggiorna la UI
    updateTrashList(deletedReservations);
  } catch (error) {
    console.error('Error loading trash:', error);
    
    // Mostra messaggio di errore con pulsante per riprovare
    trashListContainer.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4">
          <div class="error-state">
            <i class="fas fa-exclamation-circle fa-2x mb-3"></i>
            <p>Si è verificato un errore durante il caricamento delle prenotazioni eliminate.</p>
            <button class="btn btn-sm btn-primary mt-2" onclick="loadTrash()">
              <i class="fas fa-sync-alt me-1"></i> Riprova
            </button>
          </div>
        </td>
      </tr>
    `;
  }
}

// Aggiorna la lista delle prenotazioni eliminate
function updateTrashList(reservations) {
  const trashListContainer = document.getElementById('trash-list');
  const emptyTrashButton = document.getElementById('empty-trash');
  
  if (!trashListContainer) return;
  
  // Attiva/disattiva il pulsante "Svuota cestino" in base alla presenza di elementi
  if (emptyTrashButton) {
    emptyTrashButton.disabled = reservations.length === 0;
  }
  
  // Se non ci sono prenotazioni eliminate, mostra un messaggio
  if (reservations.length === 0) {
    trashListContainer.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4">
          <div class="empty-state">
            <i class="fas fa-trash-alt fa-2x mb-3"></i>
            <p>Il cestino è vuoto</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  // Altrimenti, visualizza le prenotazioni eliminate
  let html = '';
  
  reservations.forEach(reservation => {
    // Formatta le date per la visualizzazione
    const checkInDate = dateUtils.formatDateDisplay(reservation.check_in_date);
    const checkOutDate = dateUtils.formatDateDisplay(reservation.check_out_date);
    const deletedAt = dateUtils.formatDateTime(reservation.deleted_at);
    
    // Determina lo stato del pagamento
    const isPaid = reservation.is_paid || (reservation.cash_amount + reservation.transfer_amount > 0);
    const paymentStatus = isPaid 
      ? `<span class="badge bg-success">Pagato</span>` 
      : `<span class="badge bg-danger">Non Pagato</span>`;
    
    // Genera etichette per caratteristiche speciali
    const features = [];
    
    if (reservation.has_beach) {
      features.push(`<span class="feature-badge beach-badge"><i class="fas fa-umbrella-beach me-1"></i>Spiaggia</span>`);
    }
    
    if (reservation.has_deposit) {
      features.push(`<span class="feature-badge deposit-badge"><i class="fas fa-coins me-1"></i>Caparra</span>`);
    }
    
    if (reservation.reference) {
      features.push(`<span class="feature-badge ref-badge"><i class="fas fa-tag me-1"></i>${reservation.reference}</span>`);
    }
    
    const featuresHtml = features.length > 0 ? features.join(' ') : '-';
    
    // Aggiungi riga alla tabella
    html += `
      <tr>
        <td>${reservation.client_name}</td>
        <td>${reservation.room_number} (${reservation.room_type})</td>
        <td>${checkInDate}</td>
        <td>${checkOutDate}</td>
        <td>
          ${paymentStatus}<br>
          <small class="text-muted">${Math.round(reservation.price)} €</small>
        </td>
        <td class="notes-cell">${reservation.notes || '-'}<br>${featuresHtml}</td>
        <td><small>${deletedAt}</small></td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-success" onclick="restoreReservation(${reservation.id})" title="Ripristina">
              <i class="fas fa-trash-restore"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="permanentlyDeleteReservation(${reservation.id})" title="Elimina definitivamente">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  
  trashListContainer.innerHTML = html;
}

// Ripristina una prenotazione eliminata
async function restoreReservation(id) {
  if (!confirm('Sei sicuro di voler ripristinare questa prenotazione?')) {
    return;
  }
  
  try {
    await api.reservations.restore(id);
    
    // Mostra messaggio di successo
    uiUtils.showToast('Prenotazione ripristinata con successo!', 'success');
    
    // Aggiorna i dati
    loadTrash();
    loadDashboardData();
    refreshReservationCalendar();
    loadReservationsHistory();
  } catch (error) {
    console.error('Error restoring reservation:', error);
  }
}

// Elimina definitivamente una prenotazione
async function permanentlyDeleteReservation(id) {
  if (!confirm('Sei sicuro di voler eliminare definitivamente questa prenotazione? Questa azione non può essere annullata.')) {
    return;
  }
  
  try {
    await api.reservations.deletePermanently(id);
    
    // Mostra messaggio di successo
    uiUtils.showToast('Prenotazione eliminata definitivamente!', 'success');
    
    // Aggiorna i dati
    loadTrash();
  } catch (error) {
    console.error('Error permanently deleting reservation:', error);
  }
}

// Svuota completamente il cestino
async function emptyTrash() {
  if (!confirm('Sei sicuro di voler svuotare definitivamente il cestino? Tutte le prenotazioni eliminate verranno rimosse permanentemente. Questa azione non può essere annullata.')) {
    return;
  }
  
  try {
    // Ottieni le prenotazioni nel cestino
    const deletedReservations = await api.reservations.getTrash();
    
    if (deletedReservations.length === 0) {
      uiUtils.showToast('Il cestino è già vuoto', 'info');
      return;
    }
    
    // Elimina definitivamente ogni prenotazione
    const deletePromises = deletedReservations.map(reservation => 
      api.reservations.deletePermanently(reservation.id)
    );
    
    await Promise.all(deletePromises);
    
    // Mostra messaggio di successo
    uiUtils.showToast('Cestino svuotato con successo!', 'success');
    
    // Aggiorna i dati
    loadTrash();
  } catch (error) {
    console.error('Error emptying trash:', error);
    uiUtils.showToast('Si è verificato un errore durante lo svuotamento del cestino', 'danger');
  }
}

// Funzione per forzare l'aggiornamento completo del registro
function forceRefresh() {
  // Ricarica tutti i dati necessari
  console.log('Forza aggiornamento completo del registro prenotazioni...');
  
  // Svuota la cache delle richieste precedenti
  if (window.caches && window.caches.delete) {
    window.caches.delete('reservation-cache')
      .then(() => console.log('Cache prenotazioni eliminata'));
  }
  
  // Rimuovi tutte le prenotazioni visualizzate
  const reservationTable = document.getElementById('reservation-rooms');
  if (reservationTable) {
    reservationTable.innerHTML = '';
  }
  
  // Carica completamente il calendario in modo asincrono per garantire dati freschi
  setTimeout(() => {
    // Ricarica completamente il calendario
    console.log('Ricaricamento calendario...');
    
    // Prima rimuoviamo le intestazioni
    const reservationDays = document.getElementById('reservation-days');
    if (reservationDays) {
      while (reservationDays.children.length > 1) {
        reservationDays.removeChild(reservationDays.lastChild);
      }
    }
    
    // Poi ricarica il calendario con dati freschi
    refreshReservationCalendar();
    
    // Log di completamento
    console.log('Aggiornamento calendario completato!');
  }, 200);
}

// Funzioni per gestire il form di prenotazione
async function openReservationModal(reservationId = null) {
  try {
    console.log('Apertura modal prenotazione', reservationId ? `ID: ${reservationId}` : 'Nuova');
    
    // Reset form
    resetReservationForm();
    
    // Imposta la variabile globale per tenere traccia dell'ID prenotazione corrente
    currentReservationId = reservationId;
    
    // Set modal title
    const modalTitle = document.getElementById('reservationModalLabel');
    if (modalTitle) {
      modalTitle.textContent = reservationId ? 'Modifica Prenotazione' : 'Nuova Prenotazione';
    } else {
      console.error('Elemento con ID reservationModalLabel non trovato');
    }
    
    // Gestione del pulsante elimina (mostralo solo in modalità modifica)
    const deleteBtn = document.getElementById('delete-reservation');
    if (deleteBtn) {
      if (reservationId) {
        deleteBtn.classList.remove('d-none');
      } else {
        deleteBtn.classList.add('d-none');
      }
    }
    
    // Update save button text
    const saveButton = document.getElementById('save-reservation');
    if (saveButton) {
      saveButton.innerHTML = reservationId ? '<i class="fas fa-save me-1"></i>Aggiorna Prenotazione' : '<i class="fas fa-save me-1"></i>Salva Prenotazione';
    }
    
    // Carica subito il modal per evitare ritardi nella visualizzazione
    reservationModal.show();
    
    // Imposta i listener per gli input di prezzo
    setupPriceInputListeners();
    
    // Configura il campo autocomplete del cliente - IMPORTANTE!
    await setupClientAutocomplete();
    
    // Carica le stanze
    await loadRoomSelect();
    
    // Se è una modifica, carica i dati della prenotazione
    if (reservationId) {
      // Edit mode - load reservation data
      try {
        console.log(`Caricamento dati prenotazione ID: ${reservationId}`);
        
        // Imposta un timeout per attendere che la richiesta API completi o fallisca
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout richiesta')), 10000);
        });
        
        // Usa Promise.race per gestire il timeout
        const reservation = await Promise.race([
          api.reservations.getById(reservationId),
          timeoutPromise
        ]);
        
        if (!reservation) {
          throw new Error('Nessun dato ricevuto per la prenotazione');
        }
        
        console.log('Dati prenotazione recuperati:', reservation);
        
        // Verifica che i campi essenziali siano presenti
        if (!reservation.check_in_date || !reservation.check_out_date) {
          throw new Error('Date di check-in o check-out mancanti');
        }
        
        // Riempie il form con i dati della prenotazione
        await fillReservationForm(reservation);
      } catch (error) {
        console.error('Errore nel caricamento della prenotazione:', error);
        uiUtils.showToast('Errore nel caricamento dei dati della prenotazione', 'danger');
        
        // Chiudi il modal in caso di errore
        reservationModal.hide();
        return;
      }
    } else {
      // New reservation mode - set default dates and values
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      document.getElementById('check-in-date').value = dateUtils.formatDate(today);
      document.getElementById('check-out-date').value = dateUtils.formatDate(tomorrow);
      document.getElementById('num-people').value = '2';
      
      // Default color: yellow
      document.querySelector('input[name="reservation-color"][value="yellow"]').checked = true;
    }
  } catch (error) {
    console.error('Error opening reservation modal:', error);
    uiUtils.showToast('Errore nel caricare la prenotazione', 'danger');
    
    // Chiudi il modal in caso di errore generale
    if (reservationModal) {
      reservationModal.hide();
    }
  }
}

// Nuova funzione per l'autocomplete dei clienti
async function setupClientAutocomplete() {
  try {
    console.log('Configurazione autocomplete cliente style Google...');
    
    // Riferimenti agli elementi del DOM
    const clientSearch = document.getElementById('client-search');
    const clientSuggestions = document.getElementById('client-suggestions');
    const clientIdField = document.getElementById('client-id');
    const newClientFields = document.getElementById('new-client-fields');
    
    if (!clientSearch || !clientSuggestions || !clientIdField || !newClientFields) {
      console.error('Elementi necessari per l\'autocomplete non trovati nel DOM', {
        clientSearch: !!clientSearch,
        clientSuggestions: !!clientSuggestions,
        clientIdField: !!clientIdField,
        newClientFields: !!newClientFields
      });
      uiUtils.showToast('Errore nella configurazione del form cliente', 'danger');
      return;
    }
    
    // Carichiamo tutti i clienti
    let clients = await api.clients.getAll();
    let activeIndex = -1;
    let searchTimeout = null;
    
    console.log(`Caricati ${clients.length} clienti per l'autocomplete`);
    
    // Helper per evidenziare il testo ricercato
    const highlightText = (text, query) => {
      if (!query) return text;
      
      const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
      return text.replace(regex, '<span class="highlight">$1</span>');
    };
    
    // Helper per ordinare i risultati in base alla rilevanza
    const sortByRelevance = (results, query) => {
      return results.sort((a, b) => {
        // Priorità alle corrispondenze all'inizio del nome
        const aStartsWithQuery = a.name.toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1;
        const bStartsWithQuery = b.name.toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1;
        
        if (aStartsWithQuery !== bStartsWithQuery) {
          return aStartsWithQuery - bStartsWithQuery;
        }
        
        // Quindi per lunghezza del nome (nomi più corti sono più rilevanti)
        return a.name.length - b.name.length;
      });
    };
    
    // Funzione per mostrare i suggerimenti
    const showSuggestions = (searchText) => {
      // Nascondi i campi per nuovo cliente quando si inizia una nuova ricerca
      newClientFields.classList.add('d-none');
      clientIdField.value = '';
      activeIndex = -1;
      
      // Se il campo è vuoto, nascondi i suggerimenti
      if (!searchText) {
        clientSuggestions.innerHTML = '';
        clientSuggestions.classList.remove('show');
        return;
      }
      
      // Filtra i clienti in base al testo di ricerca
      let filteredClients = clients.filter(client => 
        client.name.toLowerCase().includes(searchText.toLowerCase())
      );
      
      // Ordina i risultati per rilevanza
      filteredClients = sortByRelevance(filteredClients, searchText);
      
      // Mostra i suggerimenti
      if (filteredClients.length > 0) {
        // Limita i risultati a massimo 5 suggerimenti
        const topResults = filteredClients.slice(0, 5);
        
        // Crea la lista di suggerimenti con testo evidenziato
        clientSuggestions.innerHTML = topResults.map(client => `
          <div class="autocomplete-item" data-id="${client.id}" data-name="${client.name}">
            <strong>${highlightText(client.name, searchText)}</strong>
            ${client.phone ? `
              <div class="client-meta">
                <i class="fas fa-phone"></i>
                <small>${client.phone}</small>
              </div>
            ` : ''}
          </div>
        `).join('');
        
        // Aggiungi opzione per creare nuovo cliente
        clientSuggestions.innerHTML += `
          <div class="autocomplete-new-client" id="create-new-client">
            <i class="fas fa-plus-circle"></i>
            <span>Nuovo cliente: "${searchText}"</span>
          </div>
        `;
        
        clientSuggestions.classList.add('show');
        
        // Aggiungi click event ai suggerimenti
        document.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', function() {
            selectClient(this);
          });
        });
        
        // Gestisci il click su "Crea nuovo cliente"
        const createNewClientBtn = document.getElementById('create-new-client');
        if (createNewClientBtn) {
          createNewClientBtn.addEventListener('click', function() {
            prepareNewClient(searchText);
          });
        }
      } else {
        // Nessun cliente trovato, mostra opzione per nuovo cliente
        clientSuggestions.innerHTML = `
          <div class="p-2 text-center">
            <em>Nessun cliente trovato con questo nome</em>
          </div>
          <div class="autocomplete-new-client" id="create-new-client">
            <i class="fas fa-plus-circle"></i>
            <span>Nuovo cliente: "${searchText}"</span>
          </div>
        `;
        clientSuggestions.classList.add('show');
        
        // Gestisci il click su "Crea nuovo cliente"
        const createNewClientBtn = document.getElementById('create-new-client');
        if (createNewClientBtn) {
          createNewClientBtn.addEventListener('click', function() {
            prepareNewClient(searchText);
          });
        }
      }
    };
    
    // Funzione per selezionare un cliente dall'elenco
    const selectClient = (item) => {
      const id = item.getAttribute('data-id');
      const name = item.getAttribute('data-name');
      
      // Chiudi immediatamente i suggerimenti prima di qualsiasi altra operazione
      clientSuggestions.classList.remove('show');
      clientSuggestions.innerHTML = '';
      
      // Imposta i valori
      clientSearch.value = name;
      clientIdField.value = id;
      newClientFields.classList.add('d-none');
      
      // Notifica l'utente con un feedback visivo
      clientSearch.classList.add('is-valid');
      setTimeout(() => {
        clientSearch.classList.remove('is-valid');
      }, 1000);
    };
    
    // Funzione per preparare la creazione di un nuovo cliente
    const prepareNewClient = (name) => {
      // Chiudi immediatamente i suggerimenti
      clientSuggestions.classList.remove('show');
      clientSuggestions.innerHTML = '';
      
      // Imposta i valori
      clientSearch.value = name;
      clientIdField.value = '';
      newClientFields.classList.remove('d-none');
      
      // Focalizza il campo telefono
      const phoneField = document.getElementById('client-phone');
      if (phoneField) {
        phoneField.focus();
      }
    };
    
    // Evento input per mostrare i suggerimenti durante la digitazione
    clientSearch.addEventListener('input', function() {
      const searchText = this.value.trim();
      
      // Aggiungi debounce per evitare troppe richieste durante la digitazione
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        showSuggestions(searchText);
      }, 200);
    });
    
    // Gestione navigazione da tastiera
    clientSearch.addEventListener('keydown', function(e) {
      const suggestions = document.querySelectorAll('.autocomplete-item, .autocomplete-new-client');
      
      // Se non ci sono suggerimenti, esci
      if (!clientSuggestions.classList.contains('show') || !suggestions.length) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          activeIndex = (activeIndex + 1) % suggestions.length;
          highlightSelection();
          break;
        case 'ArrowUp':
          e.preventDefault();
          activeIndex = activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1;
          highlightSelection();
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            const activeItem = suggestions[activeIndex];
            
            if (activeItem.id === 'create-new-client') {
              prepareNewClient(this.value.trim());
    } else {
              selectClient(activeItem);
            }
          }
          break;
        case 'Escape':
          clientSuggestions.classList.remove('show');
          clientSuggestions.innerHTML = ''; // Svuota anche la lista dei suggerimenti
          activeIndex = -1;
          break;
      }
    });
    
    // Funzione per evidenziare la selezione attiva
    const highlightSelection = () => {
      const suggestions = document.querySelectorAll('.autocomplete-item, .autocomplete-new-client');
      
      suggestions.forEach((item, index) => {
        if (index === activeIndex) {
          item.classList.add('active');
          
          // Scroll into view if needed
          const container = clientSuggestions;
          const itemTop = item.offsetTop;
          const itemBottom = itemTop + item.offsetHeight;
          const containerTop = container.scrollTop;
          const containerBottom = containerTop + container.offsetHeight;
          
          if (itemBottom > containerBottom) {
            container.scrollTop = itemBottom - container.offsetHeight;
          } else if (itemTop < containerTop) {
            container.scrollTop = itemTop;
          }
      } else {
          item.classList.remove('active');
        }
      });
    };
    
    // Nascondi i suggerimenti quando si clicca fuori
    document.addEventListener('click', function(e) {
      if (!clientSearch.contains(e.target) && !clientSuggestions.contains(e.target)) {
        clientSuggestions.classList.remove('show');
        clientSuggestions.innerHTML = ''; // Svuota immediatamente la lista dei suggerimenti
        
        // Se non è stato selezionato un cliente esistente e c'è testo nel campo,
        // mantieni visibili i campi per nuovo cliente
        if (!clientIdField.value && clientSearch.value.trim()) {
          newClientFields.classList.remove('d-none');
        }
      }
    });
    
    // Ricarica i clienti quando il form viene aperto
    const refreshClients = async () => {
      try {
        clients = await api.clients.getAll();
        console.log(`Ricaricati ${clients.length} clienti per l'autocomplete`);
  } catch (error) {
        console.error('Errore nel ricaricare i clienti:', error);
      }
    };
    
    // Chiamiamo refreshClients inizialmente
    await refreshClients();
    
    console.log('Autocomplete cliente avanzato configurato con successo');
    
  } catch (error) {
    console.error('Error setting up client autocomplete:', error);
    uiUtils.showToast('Errore nel caricare i clienti', 'danger');
  }
}

// Funzione per caricare le stanze nel select
async function loadRoomSelect() {
  try {
    const rooms = await api.rooms.getAll();
    const select = document.getElementById('room-select');
    select.innerHTML = '<option value="">Seleziona appartamento...</option>';
    
    rooms.forEach(room => {
      const option = document.createElement('option');
      option.value = room.id;
      option.textContent = `${room.room_number} - ${room.room_type}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading rooms:', error);
    uiUtils.showToast('Errore nel caricare gli appartamenti', 'danger');
  }
}

// Funzione per validare il campo cliente
function validateClientField() {
  const clientSearch = document.getElementById('client-search');
  const clientId = document.getElementById('client-id').value;
  const clientPhone = document.getElementById('client-phone');
  
  // Verifica se è stato selezionato un cliente esistente
  if (clientId) {
    return true;
  }
  
  // Verifica se è stato inserito un nome cliente
  const clientName = clientSearch.value.trim();
  if (!clientName) {
    uiUtils.showToast('Inserisci il nome del cliente', 'danger');
    clientSearch.focus();
    return false;
  }
  
  // Se è un nuovo cliente, verifica se è stato inserito il telefono
  if (clientPhone && clientPhone.value.trim() === '') {
    uiUtils.showToast('Inserisci il numero di telefono per il nuovo cliente', 'warning');
    clientPhone.focus();
    return false;
  }
  
  return true;
}

// Add a new function to create and update the reservation color legend
function updateReservationLegend() {
  const legendContainer = document.getElementById('reservation-legend');
  if (!legendContainer) return;
  
  legendContainer.innerHTML = `
    <div class="reservation-legend">
      <div class="legend-title">Legenda Stato Prenotazioni</div>
      <div class="legend-items">
        <div class="legend-item">
          <div class="legend-color" style="background: linear-gradient(90deg, #fff34f 0%, #e8f312 100%);"></div>
          <div class="legend-text"><i class="fas fa-check me-1"></i>Confermata</div>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: linear-gradient(90deg, #0984e3 0%, #74b9ff 100%);"></div>
          <div class="legend-text"><i class="fas fa-info-circle me-1"></i>Info/Cliente precedente</div>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background: linear-gradient(90deg, #feb176 0%, #e28f46 100%);"></div>
          <div class="legend-text"><i class="fas fa-exclamation-triangle me-1"></i>Senza caparra</div>
        </div>
      </div>
    </div>
  `;
}

// Funzione per inizializzare i listener degli input di prezzo
function setupPriceInputListeners() {
  const priceInputs = [
    'estimate-amount',
    'cash-amount',
    'transfer-amount'
  ];
  
  priceInputs.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('focus', function(e) {
        // Se il valore è 0, pulisci il campo
        if (parseFloat(this.value) === 0) {
          this.value = '';
        }
      });
      
      input.addEventListener('blur', function(e) {
        // Se il campo è vuoto, imposta a 0
        if (this.value === '') {
          this.value = '0';
        }
      });
    }
  });
}



// api.js - Gestione centralizzata delle chiamate API

// Configurazione base delle richieste API
const API_BASE_URL = window.electron ? '' : ''; // URL vuoto per utilizzare l'host corrente

/**
 * Esegue una richiesta API con gestione errori standardizzata migliorata
 * @param {string} endpoint - Percorso API senza il prefisso base
 * @param {object} options - Opzioni fetch (method, headers, body, ecc.)
 * @returns {Promise} - Promise che risolve con i dati o rifiuta con errore
 */
async function apiRequest(endpoint, options = {}) {
  // Rimuovo "/api" da qualsiasi endpoint che lo contenga
  endpoint = endpoint.replace(/^\/api/, '');
  
  const baseUrl = window.API_BASE_URL || '';
  const url = `${baseUrl}${endpoint}`;
  
  console.log(`[API] Chiamata a: ${url}`, options);
  
  // Assicurati che options.headers esista
  options.headers = options.headers || {};
  
  // Aggiungi l'header Content-Type per le richieste POST/PUT
  if (options.method === 'POST' || options.method === 'PUT') {
    options.headers['Content-Type'] = 'application/json';
  }

  // For mutations, we want the freshest data; for reads let the browser decide.
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    options.headers['Cache-Control'] = 'no-cache';
  }

  // Always include the session cookie
  options.credentials = 'same-origin';

  try {
    const response = await fetch(url, options);
    
    // Se la risposta non è ok (status 200-299), lancia un errore
    if (!response.ok) {
      // Prova a estrarre il messaggio di errore JSON
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // Se non è JSON, usa il testo della risposta
        errorData = { error: await response.text() };
      }
      
      // Mostra un toast di errore con il messaggio
      const errorMessage = errorData.error || `Errore ${response.status}: ${response.statusText}`;
      console.error(`[API] Errore nella richiesta: ${errorMessage}`);
      
      if (window.uiUtils && window.uiUtils.showToast) {
        window.uiUtils.showToast(errorMessage, 'danger');
      } else {
        console.error(errorMessage);
      }
      
      throw new Error(errorMessage);
    }
    
    // Per richieste DELETE potrebbe non esserci un body JSON
    if (options.method === 'DELETE') {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      } else {
        return { success: true };
      }
    }
    
    // Controlla se la risposta ha contenuto JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`[API] Risposta ricevuta da ${url}:`, data);
      return data;
    } else {
      console.error(`[API] Risposta non JSON da ${url}`);
      throw new Error('Risposta non valida dal server');
    }
    
  } catch (error) {
    // Gestisci errori di rete o di parsing
    const errorMessage = error.message || 'Errore di connessione al server';
    console.error(`[API] Errore nella richiesta: ${errorMessage}`, error);
    
    if (window.uiUtils && window.uiUtils.showToast) {
      window.uiUtils.showToast(errorMessage, 'danger');
    } else {
      console.error(errorMessage);
    }
    
    throw error;
  }
}

/**
 * API per gestione appartamenti
 */
const roomsAPI = {
  // Get all rooms
  async getAll() {
    return apiRequest('/rooms');
  },
  
  // Get room by ID
  async getById(roomId) {
    return apiRequest(`/rooms/${roomId}`);
  },
  
  // Create new room
  async create(roomData) {
    return apiRequest('/rooms', {
      method: 'POST',
      body: JSON.stringify(roomData)
    });
  },
  
  // Update room
  async update(roomId, roomData) {
    return apiRequest(`/rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(roomData)
    });
  },
  
  // Delete room
  async delete(roomId) {
    return apiRequest(`/rooms/${roomId}`, {
      method: 'DELETE'
    });
  }
};

/**
 * API per gestione clienti
 */
const clientsAPI = {
  // Get all clients
  async getAll() {
    return apiRequest('/clients');
  },
  
  // Search clients
  async search(query) {
    return apiRequest(`/clients?search=${encodeURIComponent(query)}`);
  },
  
  // Get client by ID
  async getById(clientId) {
    return apiRequest(`/clients/${clientId}`);
  },
  
  // Create new client
  async create(clientData) {
    return apiRequest('/clients', {
      method: 'POST',
      body: JSON.stringify(clientData)
    });
  },
  
  // Update client
  async update(clientId, clientData) {
    return apiRequest(`/clients/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify(clientData)
    });
  },
  
  // Delete client
  async delete(clientId) {
    return apiRequest(`/clients/${clientId}`, {
      method: 'DELETE'
    });
  }
};

/**
 * API per gestione prenotazioni - Correzione avanzata per l'errore "price is not defined"
 */
const reservationsAPI = {
  // Get all reservations
  async getAll() {
    return apiRequest('/reservations');
  },
  
  // Get all deleted reservations (trash)
  async getTrash() {
    return apiRequest('/reservations/trash');
  },
  
  // Get reservation by ID
  async getById(reservationId) {
    console.log(`[API] Richiesta prenotazione ID: ${reservationId}`);
    
    if (!reservationId) {
      console.error('[API] ID prenotazione non valido');
      throw new Error('ID prenotazione mancante o non valido');
    }
    
    try {
      const data = await apiRequest(`/reservations/${reservationId}`);
      
      if (!data || Object.keys(data).length === 0) {
        console.error(`[API] Nessun dato ricevuto per la prenotazione ID: ${reservationId}`);
        throw new Error('Prenotazione non trovata');
      }
      
      return data;
    } catch (error) {
      console.error(`[API] Errore nel recupero della prenotazione ${reservationId}:`, error);
      throw error;
    }
  },
  
  // Create new reservation - Correzione avanzata
  async create(reservationData) {
    // Crea una copia di sicurezza dei dati
    const safeData = { ...reservationData };
    
    // Verifica ogni campo numerico e assicurati che sia definito correttamente
    safeData.price = typeof safeData.price === 'number' ? safeData.price : 0;
    safeData.cash_amount = typeof safeData.cash_amount === 'number' ? safeData.cash_amount : 0;
    safeData.transfer_amount = typeof safeData.transfer_amount === 'number' ? safeData.transfer_amount : 0;
    safeData.num_people = typeof safeData.num_people === 'number' ? safeData.num_people : 1;
    
    // Verifica campi booleani
    safeData.is_paid = safeData.is_paid ? 1 : 0;
    safeData.has_beach = safeData.has_beach ? 1 : 0;
    safeData.has_deposit = safeData.has_deposit ? 1 : 0;
    
    // Verifica il campo reservation_color (default yellow se non valido)
    safeData.reservation_color = ['yellow', 'blue', 'orange'].includes(safeData.reservation_color) 
      ? safeData.reservation_color 
      : 'yellow';
    
    // Se price non è già definito, assicurati che sia almeno la somma di cash_amount e transfer_amount
    if (safeData.price === 0) {
      safeData.price = safeData.cash_amount + safeData.transfer_amount;
    }
    
    // Log avanzato per debug
    console.log('CREATE prenotazione, dati sicuri:', safeData);
    
    return apiRequest('/reservations', {
      method: 'POST',
      body: JSON.stringify(safeData)
    });
  },
  
  // Update reservation - Correzione avanzata
  async update(reservationId, reservationData) {
    // Assicurati che l'ID della prenotazione sia un numero
    reservationId = parseInt(reservationId) || 0;
    
    if (reservationId <= 0) {
      throw new Error('ID prenotazione non valido');
    }
    
    // Crea una copia di sicurezza dei dati
    const safeData = { ...reservationData };
    
    // Verifica ogni campo numerico e assicurati che sia definito correttamente
    safeData.price = typeof safeData.price === 'number' ? safeData.price : 0;
    safeData.cash_amount = typeof safeData.cash_amount === 'number' ? safeData.cash_amount : 0;
    safeData.transfer_amount = typeof safeData.transfer_amount === 'number' ? safeData.transfer_amount : 0;
    safeData.num_people = typeof safeData.num_people === 'number' ? safeData.num_people : 1;
    safeData.estimate_amount = typeof safeData.estimate_amount === 'number' ? safeData.estimate_amount : 0;
    
    // Verifica campi booleani
    safeData.is_paid = safeData.is_paid ? 1 : 0;
    safeData.has_beach = safeData.has_beach ? 1 : 0;
    safeData.has_deposit = safeData.has_deposit ? 1 : 0;
    
    // Verifica il campo reservation_color (default yellow se non valido)
    safeData.reservation_color = ['yellow', 'blue', 'orange'].includes(safeData.reservation_color) 
      ? safeData.reservation_color 
      : 'yellow';
    
    // Se price non è già definito, assicurati che sia almeno la somma di cash_amount e transfer_amount
    if (safeData.price === 0) {
      safeData.price = safeData.cash_amount + safeData.transfer_amount;
    }
    
    // Log avanzato per debug
    console.log(`UPDATE prenotazione ${reservationId}, dati sicuri:`, safeData);
    
    return apiRequest(`/reservations/${reservationId}`, {
      method: 'PUT',
      body: JSON.stringify(safeData)
    });
  },
  
  // Delete reservation (soft delete - move to trash)
  async delete(reservationId) {
    return apiRequest(`/reservations/${reservationId}`, {
      method: 'DELETE'
    });
  },
  
  // Restore a deleted reservation
  async restore(reservationId) {
    return apiRequest(`/reservations/${reservationId}/restore`, {
      method: 'POST'
    });
  },
  
  // Permanently delete a reservation
  async deletePermanently(reservationId) {
    return apiRequest(`/reservations/${reservationId}/permanent`, {
      method: 'DELETE'
    });
  },
  
  // Get dashboard data
  async getDashboardStats() {
    return apiRequest('/reservations/dashboard/stats');
  }
};

/**
 * API per impostazioni e operazioni di sistema
 */
const settingsAPI = {
  // Get settings
  async get() {
    return apiRequest('/settings');
  },
  
  // Update settings
  async update(settingsData) {
    return apiRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify(settingsData)
    });
  },
  
  // Export database
  async exportData() {
    return apiRequest('/settings/export');
  },
  
  // Import database
  async importData(importData) {
    return apiRequest('/settings/import', {
      method: 'POST',
      body: JSON.stringify(importData)
    });
  }
};

// Esporta oggetti API
window.api = {
  rooms: roomsAPI,
  clients: clientsAPI,
  reservations: reservationsAPI,
  settings: settingsAPI
};
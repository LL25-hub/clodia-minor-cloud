// utils.js - Funzioni di utilità condivise

/**
 * Funzioni utili per la formattazione e gestione delle date
 */
const dateUtils = {
    // Format date as YYYY-MM-DD for input fields
    formatDateForInput(dateValue) {
      if (!dateValue) return '';
      
      let date;
      if (dateValue instanceof Date) {
        date = dateValue;
      } else if (typeof dateValue === 'string') {
        // Supporta sia formato ISO che italiano DD/MM/YYYY
        if (dateValue.includes('/')) {
          const [day, month, year] = dateValue.split('/');
          date = new Date(`${year}-${month}-${day}`);
        } else {
          date = new Date(dateValue);
        }
      } else {
        return '';
      }
      
      // Controlla se la data è valida
      if (isNaN(date.getTime())) {
        console.error('Data non valida:', dateValue);
        return '';
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    },
    
    // Format date as DD/MM/YYYY
    formatDate(dateString) {
      if (!dateString) return '';
      
      try {
        const date = new Date(dateString);
        
        // Controlla se la data è valida
        if (isNaN(date.getTime())) {
          console.error('Data non valida in formatDate:', dateString);
          return '';
        }
        
        return date.toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch (error) {
        console.error('Errore nella formattazione della data:', error);
        return '';
      }
    },
    
    // Format date for display, converting from YYYY-MM-DD to DD/MM/YYYY
    formatDateDisplay(dateString) {
      if (!dateString) return '-';
      
      // If the date is already in YYYY-MM-DD format, convert it
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
      }
      
      // Otherwise use the standard date formatter
      return this.formatDate(dateString);
    },
    
    // Format date and time as DD/MM/YYYY HH:MM
    formatDateTime(dateTimeString) {
      if (!dateTimeString) return '-';
      const date = new Date(dateTimeString);
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    
    // Get day of week abbreviation (Lun, Mar, etc.)
    getDayAbbreviation(dateString) {
      const date = new Date(dateString);
      const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
      return days[date.getDay()];
    },
    
    // Add days to a date and return as YYYY-MM-DD
    addDays(dateString, days) {
      const date = new Date(dateString);
      date.setDate(date.getDate() + days);
      return date.toISOString().split('T')[0];
    },
    
    // Generate date range for a month
    getMonthDates(year, month) {
      const dates = [];
      const totalDays = new Date(year, month + 1, 0).getDate();
      
      for (let i = 2; i <= totalDays+1; i++) {
        const date = new Date(year, month, i);
        dates.push(date.toISOString().split('T')[0]);
      }
      
      return dates;
    },
    
    // Get today's date as YYYY-MM-DD
    today() {
      return new Date().toISOString().split('T')[0];
    },
    
    // Validate date range
    validateDateRange(checkIn, checkOut) {
      const errors = [];
      
      if (!checkIn) {
        errors.push('Data check-in obbligatoria');
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) {
        errors.push('Formato data check-in non valido');
      }
      
      if (!checkOut) {
        errors.push('Data check-out obbligatoria');
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
        errors.push('Formato data check-out non valido');
      } 
      
      if (checkIn && checkOut && checkIn === checkOut) {
        errors.push('Check-in e check-out non possono essere lo stesso giorno');
      } else if (checkIn && checkOut && /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
        // Solo se entrambe le date sono valide, facciamo il confronto
        if (new Date(checkOut) <= new Date(checkIn)) {
          errors.push('Check-out deve essere successivo al check-in');
        }
        
        // Verifica che il soggiorno non sia eccessivamente lungo (es. più di 1 anno)
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const diffTime = Math.abs(checkOutDate - checkInDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 365) {
          errors.push('La durata del soggiorno non può superare un anno');
        }
      }
      
      return errors;
    }
  }
  
  /**
   * Funzioni per la gestione dell'interfaccia utente
   */
  const uiUtils = {
    // Show toast notification
    showToast(message, type = 'info') {
      const toastContainer = document.querySelector('.toast-container');
      
      if (!toastContainer) return;
      
      // Create toast element
      const toastEl = document.createElement('div');
      toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
      toastEl.setAttribute('role', 'alert');
      toastEl.setAttribute('aria-live', 'assertive');
      toastEl.setAttribute('aria-atomic', 'true');
      
      toastEl.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">
            ${message}
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      `;
      
      toastContainer.appendChild(toastEl);
      
      // Initialize and show the toast
      const toast = new bootstrap.Toast(toastEl, {
        delay: 3000,
        animation: true
      });
      
      toast.show();
      
      // Remove toast when hidden
      toastEl.addEventListener('hidden.bs.toast', function() {
        toastEl.remove();
      });
    },
    
    // Show loading state in a container
    showLoading(container, message = 'Caricamento in corso...') {
      if (!container) return;
      
      const loadingEl = document.createElement('div');
      loadingEl.className = 'text-center py-4 loading-indicator';
      loadingEl.innerHTML = `
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Caricamento...</span>
        </div>
        <p class="mt-2 text-muted">${message}</p>
      `;
      
      container.innerHTML = '';
      container.appendChild(loadingEl);
    },
    
    // Show empty state in a container
    showEmptyState(container, message, icon = 'search') {
      if (!container) return;
      
      const emptyStateEl = document.createElement('div');
      emptyStateEl.className = 'text-center py-5 empty-state';
      emptyStateEl.innerHTML = `
        <div class="mb-3">
          <i class="fas fa-${icon} fa-3x text-muted"></i>
        </div>
        <p class="text-muted">${message}</p>
      `;
      
      container.innerHTML = '';
      container.appendChild(emptyStateEl);
    },
    
    // Show error state in a container
    showErrorState(container, message = 'Si è verificato un errore durante il caricamento dei dati') {
      if (!container) return;
      
      const errorStateEl = document.createElement('div');
      errorStateEl.className = 'text-center py-5 error-state';
      errorStateEl.innerHTML = `
        <div class="mb-3">
          <i class="fas fa-exclamation-triangle fa-3x text-danger"></i>
        </div>
        <p class="text-danger">${message}</p>
        <button class="btn btn-sm btn-outline-primary mt-2 retry-button">
          <i class="fas fa-sync-alt me-1"></i> Riprova
        </button>
      `;
      
      container.innerHTML = '';
      container.appendChild(errorStateEl);
      
      return errorStateEl.querySelector('.retry-button');
    }
  };
  
  /**
   * Utilità di validazione per i form
   */
  const validationUtils = {
    // Validate required fields
    validateRequired(form, fieldNames) {
      const errors = [];
      
      fieldNames.forEach(name => {
        const field = form.elements[name];
        if (!field) return;
        
        const value = field.value.trim();
        if (!value) {
          const label = field.labels[0]?.textContent.replace(' *', '') || name;
          errors.push(`${label} è obbligatorio`);
          field.classList.add('is-invalid');
        } else {
          field.classList.remove('is-invalid');
        }
      });
      
      return errors;
    },
    
    // Add validation event handlers to a form
    setupFormValidation(formId, requiredFields) {
      const form = document.getElementById(formId);
      if (!form) return;
      
      requiredFields.forEach(fieldName => {
        const field = form.elements[fieldName];
        if (!field) return;
        
        field.addEventListener('blur', function() {
          const value = this.value.trim();
          if (!value) {
            this.classList.add('is-invalid');
          } else {
            this.classList.remove('is-invalid');
          }
        });
        
        field.addEventListener('input', function() {
          if (this.value.trim()) {
            this.classList.remove('is-invalid');
          }
        });
      });
    }
  };
  
  /**
   * Utilità per CSV e dati
   */
  const dataUtils = {
    // Parse CSV content
    parseCSV(content) {
      try {
        // Parse sections
        const sections = content.split(/^#\s*([A-Z]+)\s*$/m);
        const data = {};
        
        // Process each section
        for (let i = 1; i < sections.length; i += 2) {
          const sectionName = sections[i].trim().toLowerCase();
          const sectionContent = sections[i + 1].trim();
          
          // Map section names to match the expected backend keys
          let mappedSectionName = sectionName;
          if (sectionName === 'clienti') mappedSectionName = 'clienti';
          if (sectionName === 'appartamenti') mappedSectionName = 'appartamenti';
          if (sectionName === 'prenotazioni') mappedSectionName = 'prenotazioni';
          
          if (sectionContent) {
            // Parse CSV content
            const lines = sectionContent.split('\n');
            const headers = this.parseCSVLine(lines[0]);
            
            // Process data rows
            const items = [];
            for (let j = 1; j < lines.length; j++) {
              if (!lines[j].trim()) continue;
              
              // Parse CSV line (handle quoted values with commas)
              const values = this.parseCSVLine(lines[j]);
              
              // Create object with headers as keys
              const item = {};
              headers.forEach((header, index) => {
                // Convert to appropriate type
                let value = values[index];
                if (value === undefined) value = '';
                
                // Remove quotes if present
                if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
                  value = value.substring(1, value.length - 1).replace(/""/g, '"');
                }
                
                // Try to convert to number if appropriate
                if (!isNaN(value) && value !== '') {
                  value = Number(value);
                }
                
                // Clean header (remove quotes if present)
                let cleanHeader = header;
                if (typeof cleanHeader === 'string' && cleanHeader.startsWith('"') && cleanHeader.endsWith('"')) {
                  cleanHeader = cleanHeader.substring(1, cleanHeader.length - 1).replace(/""/g, '"');
                }
                
                item[cleanHeader] = value;
              });
              
              items.push(item);
            }
            
            data[mappedSectionName] = items;
          }
        }
        
        console.log('Parsed data:', data);
        return data;
      } catch (error) {
        console.error('Error parsing CSV:', error);
        throw new Error('Errore durante l\'elaborazione del file CSV');
      }
    },
    
    // Parse CSV line handling quoted values
    parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          // Check for escaped quotes
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++; // Skip the next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // End of field
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      
      // Add the last field
      result.push(current);
      
      return result;
    },
    
    // Sanitize a phone value: strip trailing ".0" import artifacts and placeholders
    sanitizePhone(raw) {
      if (raw === null || raw === undefined) return '';
      const s = String(raw).trim();
      if (!s || s === '-' || s === '--') return '';
      return s.replace(/\.0+$/, '').trim();
    },

    // Create a CSV content from data objects
    createCSV(data) {
      let csvContent = '';
      const phoneFields = new Set(['phone', 'client_phone']);
      const self = this;

      Object.entries(data).forEach(([section, items]) => {
        if (!items || items.length === 0) return;

        csvContent += `# ${section.toUpperCase()}\n`;

        const headers = Object.keys(items[0]);
        csvContent += headers.join(',') + '\n';

        items.forEach(item => {
          const values = headers.map(header => {
            let value = item[header];

            // Sanitize phone columns (remove ".0" artifacts and placeholders)
            if (phoneFields.has(header) && value !== null && value !== undefined) {
              value = self.sanitizePhone(value);
            }

            if (value === null || value === undefined || value === '') return '';
            if (typeof value === 'string') {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          });

          csvContent += values.join(',') + '\n';
        });

        csvContent += '\n';
      });

      return csvContent;
    }
  };
  
  // Export utilities
  window.dateUtils = dateUtils;
  window.uiUtils = uiUtils;
  window.validationUtils = validationUtils;
  window.dataUtils = dataUtils;
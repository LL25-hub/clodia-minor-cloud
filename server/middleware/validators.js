/**
 * Middleware di validazione per operazioni comuni
 */

// Validazione camere/appartamenti - MODIFICATO: rimossa validazione disposizione
function validateRoom(req, res, next) {
  const { room_number, room_type, floor } = req.body;
  
  const errors = [];
  
  if (!room_number) errors.push('Nome appartamento è obbligatorio');
  if (!room_type) errors.push('Tipo appartamento è obbligatorio');
  if (!floor) errors.push('Piano è obbligatorio');
  
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('. ') });
  }
  
  next();
}

// Validazione cliente
function validateClient(req, res, next) {
  const { name } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nome cliente è obbligatorio' });
  }
  
  next();
}

// Validazione prenotazione (AGGIORNATA per i nuovi campi)
function validateReservation(req, res, next) {
  const { 
    room_id, check_in_date, check_out_date, 
    cash_amount, transfer_amount, num_people
  } = req.body;
  
  const errors = [];
  
  // Verifico presenza campi obbligatori
  if (!room_id) errors.push('Appartamento è obbligatorio');
  if (!check_in_date) errors.push('Data check-in è obbligatoria');
  if (!check_out_date) errors.push('Data check-out è obbligatoria');
  
  // Verifico validità delle date
  if (check_in_date && check_out_date) {
    const checkIn = new Date(check_in_date);
    const checkOut = new Date(check_out_date);
    
    if (isNaN(checkIn.getTime())) errors.push('Data check-in non valida');
    if (isNaN(checkOut.getTime())) errors.push('Data check-out non valida');
    
    if (!isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())) {
      if (checkOut <= checkIn) {
        errors.push('La data di check-out deve essere successiva alla data di check-in');
      }
    }
  }
  
  // Verifico validità numero persone
  if (num_people !== undefined) {
    const people = parseInt(num_people);
    if (isNaN(people) || people < 1) {
      errors.push('Il numero di persone deve essere almeno 1');
    }
  }
  
  // Verifico validità importi
  const price = (parseFloat(cash_amount) || 0) + (parseFloat(transfer_amount) || 0);
  if (price < 0) errors.push('Il prezzo totale non può essere negativo');
  if (isNaN(price)) errors.push('Il prezzo totale non è valido');
  
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('. ') });
  }
  
  // Se tutto è valido, aggiungo il prezzo calcolato al body
  req.body.price = price;
  next();
}

// Validazione client o creazione nuovo
function validateClientOrNew(req, res, next) {
  const { client_id, client_name } = req.body;
  
  if (!client_id && !client_name) {
    return res.status(400).json({
      error: 'Devi specificare un cliente esistente o inserire il nome di un nuovo cliente'
    });
  }
  
  next();
}

module.exports = {
  validateRoom,
  validateClient,
  validateReservation,
  validateClientOrNew
};
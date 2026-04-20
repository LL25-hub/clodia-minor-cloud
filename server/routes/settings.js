const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

// GET settings
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('settings').select('*').order('id', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) {
      const { data: created, error: insErr } = await supabase
        .from('settings').insert({ hotel_name: 'Calendar' }).select().single();
      if (insErr) throw insErr;
      return res.json(created);
    }
    res.json(data);
  } catch (err) { next(err); }
});

// PUT settings
router.put('/', async (req, res, next) => {
  const { hotel_name } = req.body;
  if (!hotel_name) return res.status(400).json({ error: 'Nome obbligatorio' });
  try {
    const { data: current } = await supabase
      .from('settings').select('id').order('id', { ascending: false }).limit(1).maybeSingle();

    if (!current) {
      const { data, error } = await supabase
        .from('settings').insert({ hotel_name }).select().single();
      if (error) throw error;
      return res.json(data);
    }
    const { data, error } = await supabase
      .from('settings').update({ hotel_name, updated_at: new Date().toISOString() })
      .eq('id', current.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// Sanitize a phone string: strip trailing ".0" and placeholder values
function sanitizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '--') return null;
  const cleaned = s.replace(/\.0+$/, '').trim();
  return cleaned || null;
}

// Export all data
router.get('/export', async (req, res, next) => {
  try {
    const [roomsRes, clientsRes, reservationsRes] = await Promise.all([
      supabase.from('rooms').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('reservations').select('*, client:clients(name,phone), room:rooms(room_number,room_type,floor)')
    ]);
    if (roomsRes.error) throw roomsRes.error;
    if (clientsRes.error) throw clientsRes.error;
    if (reservationsRes.error) throw reservationsRes.error;

    const cleanClients = clientsRes.data.map(c => ({
      ...c,
      phone: sanitizePhone(c.phone)
    }));

    const reservations = reservationsRes.data.map(r => {
      const { client, room, ...rest } = r;
      return {
        ...rest,
        client_name: client?.name,
        client_phone: sanitizePhone(client?.phone),
        room_number: room?.room_number,
        room_type: room?.room_type,
        floor: room?.floor
      };
    });

    res.json({
      rooms: roomsRes.data,
      clients: cleanClients,
      reservations
    });
  } catch (err) { next(err); }
});

// Import bulk data
router.post('/import', async (req, res, next) => {
  const { clienti, appartamenti, prenotazioni } = req.body;
  try {
    if (appartamenti && appartamenti.length > 0) {
      const rows = appartamenti.map(r => ({
        id: r.id || undefined,
        room_number: r.room_number, room_type: r.room_type, floor: r.floor || null,
        created_at: r.created_at || new Date().toISOString()
      }));
      const { error } = await supabase.from('rooms').upsert(rows);
      if (error) throw error;
    }
    if (clienti && clienti.length > 0) {
      const rows = clienti.map(c => ({
        id: c.id || undefined,
        name: c.name, phone: sanitizePhone(c.phone),
        created_at: c.created_at || new Date().toISOString()
      }));
      const { error } = await supabase.from('clients').upsert(rows);
      if (error) throw error;
    }
    if (prenotazioni && prenotazioni.length > 0) {
      const rows = prenotazioni.map(r => ({
        id: r.id || undefined,
        client_id: r.client_id, room_id: r.room_id,
        check_in_date: r.check_in_date, check_out_date: r.check_out_date,
        price: r.price || 0, adults: r.adults || 0, children: r.children || 0,
        notes: r.notes || null,
        is_paid: !!r.is_paid,
        cash_amount: r.cash_amount || 0, transfer_amount: r.transfer_amount || 0,
        num_people: r.num_people || 0,
        has_beach: !!r.has_beach, has_deposit: !!r.has_deposit,
        reference: r.reference || null,
        reservation_color: r.reservation_color || 'yellow',
        deleted: !!r.deleted, deleted_at: r.deleted_at || null,
        created_at: r.created_at || new Date().toISOString()
      }));
      const { error } = await supabase.from('reservations').upsert(rows);
      if (error) throw error;
    }
    const cc = clienti ? clienti.length : 0;
    const rc = appartamenti ? appartamenti.length : 0;
    const pc = prenotazioni ? prenotazioni.length : 0;
    res.json({ message: `Importati ${cc} clienti, ${rc} appartamenti e ${pc} prenotazioni con successo!` });
  } catch (err) { next(err); }
});

module.exports = router;

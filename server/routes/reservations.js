const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { validateReservation } = require('../middleware/validators');

// Sanitize phone: strip trailing ".0" and placeholder values, return null if empty
function sanitizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '--') return null;
  const cleaned = s.replace(/\.0+$/, '').trim();
  return cleaned || null;
}

// Helper: expand Supabase row with flat client/room fields
function flattenReservation(row) {
  if (!row) return row;
  const { client, room, ...rest } = row;
  return {
    ...rest,
    client_id: client?.id ?? rest.client_id,
    client_name: client?.name,
    client_phone: client?.phone,
    room_id: room?.id ?? rest.room_id,
    room_number: room?.room_number,
    room_type: room?.room_type,
    floor: room?.floor
  };
}

// Check room availability for given dates (excluding a specific id if provided)
async function isRoomUnavailable(room_id, check_in_date, check_out_date, excludeId = null) {
  let q = supabase.from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room_id)
    .eq('deleted', false)
    .lt('check_in_date', check_out_date)
    .gt('check_out_date', check_in_date);
  if (excludeId) q = q.neq('id', excludeId);
  const { count, error } = await q;
  if (error) throw error;
  return count > 0;
}

// GET active reservations
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('*, client:clients(id,name,phone), room:rooms(id,room_number,room_type,floor)')
      .eq('deleted', false)
      .order('check_in_date');
    if (error) throw error;
    res.json(data.map(flattenReservation));
  } catch (err) { next(err); }
});

// GET trash
router.get('/trash', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('*, client:clients(id,name,phone), room:rooms(id,room_number,room_type,floor)')
      .eq('deleted', true)
      .order('deleted_at', { ascending: false });
    if (error) throw error;
    res.json(data.map(flattenReservation));
  } catch (err) { next(err); }
});

// GET dashboard stats
router.get('/dashboard/stats', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const oneWeekLater = new Date();
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    const weekEnd = oneWeekLater.toISOString().split('T')[0];

    const [checkInsRes, checkOutsRes, roomsRes, occupiedRes] = await Promise.all([
      supabase.from('reservations')
        .select('id, check_in_date, client:clients(name), room:rooms(room_number)')
        .eq('deleted', false)
        .gte('check_in_date', today).lte('check_in_date', weekEnd)
        .order('check_in_date'),
      supabase.from('reservations')
        .select('id, check_out_date, client:clients(name), room:rooms(room_number)')
        .eq('deleted', false)
        .gte('check_out_date', today).lte('check_out_date', weekEnd)
        .order('check_out_date'),
      supabase.from('rooms').select('id', { count: 'exact', head: true }),
      supabase.from('reservations')
        .select('room_id')
        .eq('deleted', false)
        .lte('check_in_date', today)
        .gt('check_out_date', today)
    ]);

    if (checkInsRes.error) throw checkInsRes.error;
    if (checkOutsRes.error) throw checkOutsRes.error;
    if (occupiedRes.error) throw occupiedRes.error;

    const flattenForDash = arr => arr.map(r => ({
      id: r.id,
      check_in_date: r.check_in_date,
      check_out_date: r.check_out_date,
      client_name: r.client?.name,
      room_number: r.room?.room_number
    }));

    const totalRooms = roomsRes.count || 0;
    const uniqueRoomIds = new Set((occupiedRes.data || []).map(r => r.room_id));
    const occupiedRooms = uniqueRoomIds.size;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    res.json({
      checkIns: flattenForDash(checkInsRes.data || []),
      checkOuts: flattenForDash(checkOutsRes.data || []),
      occupancy: {
        total: totalRooms,
        occupied: occupiedRooms,
        free: totalRooms - occupiedRooms,
        rate: occupancyRate
      }
    });
  } catch (err) { next(err); }
});

// GET reservation by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('*, client:clients(id,name,phone), room:rooms(id,room_number,room_type,floor)')
      .eq('id', req.params.id).eq('deleted', false).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Prenotazione non trovata' });
    res.json(flattenReservation(data));
  } catch (err) { next(err); }
});

// Helper to compute normalized fields
function normalizeReservationFields(body) {
  const {
    notes, num_people, has_beach, has_deposit, reference,
    is_paid, cash_amount, transfer_amount, reservation_color,
    estimate_amount
  } = body;

  const numPeopleValue = parseInt(num_people) || 1;
  const hasBeachValue = has_beach == 1 || has_beach === true;
  const hasDepositValue = has_deposit == 1 || has_deposit === true;
  const isPaidValue = !!is_paid;
  const cashAmountValue = parseFloat(cash_amount) || 0;
  const transferAmountValue = parseFloat(transfer_amount) || 0;
  const estimateAmountValue = parseFloat(estimate_amount) || 0;
  const reservationColorValue = ['yellow', 'blue', 'orange'].includes(reservation_color) ? reservation_color : 'yellow';
  const priceValue = Math.max(
    estimateAmountValue > 0 ? estimateAmountValue : (cashAmountValue + transferAmountValue),
    0
  );

  return {
    notes: notes || null,
    num_people: numPeopleValue,
    has_beach: hasBeachValue,
    has_deposit: hasDepositValue,
    reference: reference || null,
    is_paid: isPaidValue,
    cash_amount: cashAmountValue,
    transfer_amount: transferAmountValue,
    estimate_amount: estimateAmountValue,
    reservation_color: reservationColorValue,
    price: priceValue
  };
}

// POST reservation
router.post('/', validateReservation, async (req, res, next) => {
  const { client_id, client_name, client_phone, room_id, check_in_date, check_out_date } = req.body;
  try {
    if (await isRoomUnavailable(room_id, check_in_date, check_out_date)) {
      return res.status(400).json({ error: "L'appartamento non è disponibile per le date selezionate" });
    }

    let finalClientId = null;
    if (client_id) {
      const { data: c } = await supabase.from('clients').select('id').eq('id', client_id).maybeSingle();
      if (!c) return res.status(404).json({ error: 'Cliente specificato non trovato' });
      finalClientId = client_id;
    } else if (client_name) {
      const { data: existing } = await supabase.from('clients').select('id').eq('name', client_name).maybeSingle();
      if (existing) {
        finalClientId = existing.id;
      } else {
        const { data: newClient, error: clErr } = await supabase
          .from('clients').insert({ name: client_name, phone: sanitizePhone(client_phone) })
          .select('id').single();
        if (clErr) throw clErr;
        finalClientId = newClient.id;
      }
    } else {
      return res.status(400).json({ error: 'Nome cliente richiesto' });
    }

    const norm = normalizeReservationFields(req.body);
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        client_id: finalClientId, room_id,
        check_in_date, check_out_date,
        ...norm
      })
      .select('*, client:clients(id,name,phone), room:rooms(id,room_number,room_type,floor)')
      .single();
    if (error) throw error;
    res.status(201).json(flattenReservation(data));
  } catch (err) { next(err); }
});

// PUT reservation
router.put('/:id', validateReservation, async (req, res, next) => {
  const reservationId = req.params.id;
  const { room_id, check_in_date, check_out_date } = req.body;
  try {
    const { data: existing } = await supabase
      .from('reservations').select('id').eq('id', reservationId).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Prenotazione non trovata' });

    if (await isRoomUnavailable(room_id, check_in_date, check_out_date, reservationId)) {
      return res.status(400).json({ error: "L'appartamento non è disponibile per le date selezionate" });
    }

    const norm = normalizeReservationFields(req.body);
    const { data, error } = await supabase
      .from('reservations')
      .update({ room_id, check_in_date, check_out_date, ...norm })
      .eq('id', reservationId)
      .select('*, client:clients(id,name,phone), room:rooms(id,room_number,room_type,floor)')
      .maybeSingle();
    if (error) throw error;
    res.json(flattenReservation(data));
  } catch (err) { next(err); }
});

// Soft delete
router.delete('/:id', async (req, res, next) => {
  try {
    const { error, count } = await supabase
      .from('reservations')
      .update({ deleted: true, deleted_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', req.params.id);
    if (error) throw error;
    if (!count) return res.status(404).json({ error: 'Prenotazione non trovata' });
    res.json({ message: 'Prenotazione spostata nel cestino' });
  } catch (err) { next(err); }
});

// Restore
router.post('/:id/restore', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .update({ deleted: false, deleted_at: null })
      .eq('id', req.params.id)
      .select('*, client:clients(id,name,phone), room:rooms(id,room_number,room_type,floor)')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Prenotazione non trovata nel cestino' });
    res.json({ message: 'Prenotazione ripristinata con successo', reservation: flattenReservation(data) });
  } catch (err) { next(err); }
});

// Permanent delete
router.delete('/:id/permanent', async (req, res, next) => {
  try {
    const { error, count } = await supabase
      .from('reservations').delete({ count: 'exact' }).eq('id', req.params.id);
    if (error) throw error;
    if (!count) return res.status(404).json({ error: 'Prenotazione non trovata' });
    res.json({ message: 'Prenotazione eliminata definitivamente' });
  } catch (err) { next(err); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { validateRoom } = require('../middleware/validators');

// GET rooms
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('rooms').select('*').order('room_number');
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// POST room
router.post('/', validateRoom, async (req, res, next) => {
  const { room_number, room_type, floor } = req.body;
  try {
    const { data: existing } = await supabase
      .from('rooms').select('id').eq('room_number', room_number).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Questo nome appartamento esiste già' });

    const { data, error } = await supabase
      .from('rooms').insert({ room_number, room_type, floor }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// GET room by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('rooms').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Appartamento non trovato' });
    res.json(data);
  } catch (err) { next(err); }
});

// PUT room
router.put('/:id', validateRoom, async (req, res, next) => {
  const roomId = req.params.id;
  const { room_number, room_type, floor } = req.body;
  try {
    const { data: conflict } = await supabase
      .from('rooms').select('id').eq('room_number', room_number).neq('id', roomId).maybeSingle();
    if (conflict) return res.status(400).json({ error: 'Questo nome appartamento esiste già' });

    const { data, error } = await supabase
      .from('rooms').update({ room_number, room_type, floor }).eq('id', roomId).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Appartamento non trovato' });
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE room
router.delete('/:id', async (req, res, next) => {
  const roomId = req.params.id;
  try {
    const { count } = await supabase
      .from('reservations').select('id', { count: 'exact', head: true }).eq('room_id', roomId);
    if (count > 0) {
      return res.status(400).json({ error: 'Non è possibile eliminare questo appartamento perché ha delle prenotazioni associate' });
    }
    const { error, count: delCount } = await supabase
      .from('rooms').delete({ count: 'exact' }).eq('id', roomId);
    if (error) throw error;
    if (!delCount) return res.status(404).json({ error: 'Appartamento non trovato' });
    res.json({ message: 'Appartamento eliminato con successo' });
  } catch (err) { next(err); }
});

module.exports = router;

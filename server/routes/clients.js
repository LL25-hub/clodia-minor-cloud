const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { validateClient } = require('../middleware/validators');

// Sanitize phone: strip trailing ".0" and placeholder values, return null if empty
function sanitizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '--') return null;
  const cleaned = s.replace(/\.0+$/, '').trim();
  return cleaned || null;
}

// GET clients with optional search filter
router.get('/', async (req, res, next) => {
  try {
    const searchTerm = req.query.search;
    let query = supabase.from('clients').select('*').order('name');
    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`).limit(10);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// GET client by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('clients').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Cliente non trovato' });
    res.json(data);
  } catch (err) { next(err); }
});

// POST client
router.post('/', validateClient, async (req, res, next) => {
  const { name, phone } = req.body;
  try {
    const { data: existing } = await supabase
      .from('clients').select('id').eq('name', name).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Un cliente con questo nome esiste già' });

    const { data, error } = await supabase
      .from('clients')
      .insert({ name, phone: sanitizePhone(phone) })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// PUT client
router.put('/:id', validateClient, async (req, res, next) => {
  const clientId = req.params.id;
  const { name, phone } = req.body;
  try {
    const { data: conflict } = await supabase
      .from('clients').select('id').eq('name', name).neq('id', clientId).maybeSingle();
    if (conflict) return res.status(400).json({ error: 'Un cliente con questo nome esiste già' });

    const { data, error } = await supabase
      .from('clients').update({ name, phone: sanitizePhone(phone) }).eq('id', clientId).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Cliente non trovato' });
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE client
router.delete('/:id', async (req, res, next) => {
  const clientId = req.params.id;
  try {
    const { count } = await supabase
      .from('reservations').select('id', { count: 'exact', head: true }).eq('client_id', clientId);
    if (count > 0) {
      return res.status(400).json({ error: 'Non è possibile eliminare questo cliente perché ha delle prenotazioni associate' });
    }
    const { error, count: delCount } = await supabase
      .from('clients').delete({ count: 'exact' }).eq('id', clientId);
    if (error) throw error;
    if (!delCount) return res.status(404).json({ error: 'Cliente non trovato' });
    res.json({ message: 'Cliente eliminato con successo' });
  } catch (err) { next(err); }
});

module.exports = router;

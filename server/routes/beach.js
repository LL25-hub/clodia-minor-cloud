const express = require('express');
const router = express.Router();
const { supabase } = require('../db');

// ---------------- Umbrellas ----------------

router.get('/umbrellas', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('beach_umbrellas')
      .select('*')
      .order('position');
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/umbrellas', async (req, res, next) => {
  const { code, row_label, position } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Codice obbligatorio' });
  try {
    const { data, error } = await supabase
      .from('beach_umbrellas')
      .insert({ code, row_label: row_label || null, position: Number.isFinite(+position) ? +position : 0 })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.put('/umbrellas/:id', async (req, res, next) => {
  const { code, row_label, position } = req.body || {};
  try {
    const patch = {};
    if (code !== undefined) patch.code = code;
    if (row_label !== undefined) patch.row_label = row_label || null;
    if (position !== undefined) patch.position = Number.isFinite(+position) ? +position : 0;
    const { data, error } = await supabase
      .from('beach_umbrellas').update(patch).eq('id', req.params.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ombrellone non trovato' });
    res.json(data);
  } catch (err) { next(err); }
});

router.delete('/umbrellas/:id', async (req, res, next) => {
  try {
    const { error, count } = await supabase
      .from('beach_umbrellas').delete({ count: 'exact' }).eq('id', req.params.id);
    if (error) throw error;
    if (!count) return res.status(404).json({ error: 'Ombrellone non trovato' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------------- Assignments ----------------
// GET /assignments                       -> all
// GET /assignments?date=YYYY-MM-DD       -> overlapping that day
// GET /assignments?reservation_id=NN     -> for a single reservation
// GET /assignments?from=YYYY-MM-DD&to=YYYY-MM-DD -> overlapping the range

router.get('/assignments', async (req, res, next) => {
  try {
    let q = supabase
      .from('beach_assignments')
      .select('*, umbrella:beach_umbrellas(*), reservation:reservations(id,client_id,check_in_date,check_out_date,reservation_color,deleted, client:clients(name,phone))');

    if (req.query.reservation_id) q = q.eq('reservation_id', req.query.reservation_id);
    if (req.query.umbrella_id)    q = q.eq('umbrella_id', req.query.umbrella_id);
    if (req.query.date) {
      const d = req.query.date;
      q = q.lte('start_date', d).gte('end_date', d);
    } else if (req.query.from && req.query.to) {
      // overlap: start <= to AND end >= from
      q = q.lte('start_date', req.query.to).gte('end_date', req.query.from);
    }
    const { data, error } = await q.order('start_date');
    if (error) throw error;
    // Filter out any assignment whose reservation has been soft-deleted
    const filtered = (data || []).filter(a => !(a.reservation && a.reservation.deleted === true));
    res.json(filtered);
  } catch (err) { next(err); }
});

router.post('/assignments', async (req, res, next) => {
  const { reservation_id, umbrella_id, start_date, end_date } = req.body || {};
  if (!reservation_id || !umbrella_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'reservation_id, umbrella_id, start_date e end_date obbligatori' });
  }
  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ error: 'La data di fine deve essere uguale o successiva a quella di inizio' });
  }
  try {
    // Check availability: no overlap with other assignments on the same umbrella
    const { count: conflicts, error: chkErr } = await supabase
      .from('beach_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('umbrella_id', umbrella_id)
      .lte('start_date', end_date)
      .gte('end_date', start_date);
    if (chkErr) throw chkErr;
    if (conflicts > 0) {
      return res.status(400).json({ error: "L'ombrellone è già occupato nel periodo selezionato" });
    }
    const { data, error } = await supabase
      .from('beach_assignments')
      .insert({ reservation_id, umbrella_id, start_date, end_date })
      .select('*, umbrella:beach_umbrellas(*)')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.put('/assignments/:id', async (req, res, next) => {
  const { umbrella_id, start_date, end_date } = req.body || {};
  try {
    // Conflict check against OTHER assignments of the target umbrella
    if (umbrella_id && start_date && end_date) {
      const { count: conflicts, error: chkErr } = await supabase
        .from('beach_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('umbrella_id', umbrella_id)
        .neq('id', req.params.id)
        .lte('start_date', end_date)
        .gte('end_date', start_date);
      if (chkErr) throw chkErr;
      if (conflicts > 0) {
        return res.status(400).json({ error: "L'ombrellone è già occupato nel periodo selezionato" });
      }
    }
    const patch = {};
    if (umbrella_id) patch.umbrella_id = umbrella_id;
    if (start_date) patch.start_date = start_date;
    if (end_date) patch.end_date = end_date;
    const { data, error } = await supabase
      .from('beach_assignments').update(patch).eq('id', req.params.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Assegnazione non trovata' });
    res.json(data);
  } catch (err) { next(err); }
});

router.delete('/assignments/:id', async (req, res, next) => {
  try {
    const { error, count } = await supabase
      .from('beach_assignments').delete({ count: 'exact' }).eq('id', req.params.id);
    if (error) throw error;
    if (!count) return res.status(404).json({ error: 'Assegnazione non trovata' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Bulk replace: replace all assignments of a reservation with a single new one.
// Used by the reservation form when the user picks a single umbrella.
router.post('/assignments/sync', async (req, res, next) => {
  const { reservation_id, umbrella_id, start_date, end_date } = req.body || {};
  if (!reservation_id) return res.status(400).json({ error: 'reservation_id obbligatorio' });
  try {
    // Delete existing assignments for this reservation
    const { error: delErr } = await supabase
      .from('beach_assignments').delete().eq('reservation_id', reservation_id);
    if (delErr) throw delErr;

    if (!umbrella_id || !start_date || !end_date) {
      return res.json({ ok: true, deleted: true });
    }

    // Check conflict with other reservations
    const { count: conflicts } = await supabase
      .from('beach_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('umbrella_id', umbrella_id)
      .lte('start_date', end_date)
      .gte('end_date', start_date);
    if (conflicts > 0) {
      return res.status(400).json({ error: "L'ombrellone è già occupato nel periodo selezionato" });
    }

    const { data, error } = await supabase
      .from('beach_assignments')
      .insert({ reservation_id, umbrella_id, start_date, end_date })
      .select('*, umbrella:beach_umbrellas(*)')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

module.exports = router;

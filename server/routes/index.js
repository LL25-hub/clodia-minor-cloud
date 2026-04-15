const express = require('express');
const router = express.Router();

const roomsRoutes = require('./rooms');
const clientsRoutes = require('./clients');
const reservationsRoutes = require('./reservations');
const settingsRoutes = require('./settings');

router.get('/', (req, res) => res.sendStatus(200));

router.use('/rooms', roomsRoutes);
router.use('/clients', clientsRoutes);
router.use('/reservations', reservationsRoutes);
router.use('/settings', settingsRoutes);

router.get('/dashboard', (req, res) => res.redirect('/api/reservations/dashboard/stats'));
router.get('/export', (req, res) => res.redirect('/api/settings/export'));
router.post('/import', (req, res, next) => { req.url = '/settings/import'; next(); }, settingsRoutes);

module.exports = router;

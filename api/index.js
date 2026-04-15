// Vercel serverless entry point.
// All /api/* requests are routed here by vercel.json.
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const routes = require('../server/routes');

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Mount routes both at /api and at root (frontend calls both /api/... and /rooms, /clients, etc.)
app.use('/api', routes);
app.use('/', routes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(500).json({
    error: true,
    message: 'Si è verificato un errore: ' + (err.message || err)
  });
});

module.exports = app;

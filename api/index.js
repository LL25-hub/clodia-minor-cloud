// Vercel serverless entry point.
// All /api/* requests are routed here by vercel.json.
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const routes = require('../server/routes');
const auth = require('../server/auth');

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

// ---------------- Auth endpoints (public) ----------------

app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const configuredEmail = process.env.AUTH_EMAIL || '';
    const configuredPassword = process.env.AUTH_PASSWORD || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password obbligatorie' });
    }
    // Case-insensitive email comparison
    if (String(email).trim().toLowerCase() !== configuredEmail.toLowerCase()) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    if (!auth.verifyPassword(password, configuredPassword)) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    auth.issueSession(res, configuredEmail);
    return res.json({ ok: true, email: configuredEmail });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Errore interno durante il login' });
  }
});

app.post('/api/logout', (req, res) => {
  auth.clearSession(res);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const session = auth.isAuthenticated(req);
  if (!session) return res.status(401).json({ error: 'Non autenticato' });
  res.json({ email: session.sub, exp: session.exp });
});

// ---------------- Protected routes ----------------

function guard(req, res, next) {
  // Let login/logout/me through (they are defined above and will already have matched)
  const p = req.path || '';
  if (p === '/api/login' || p === '/login' ||
      p === '/api/logout' || p === '/logout' ||
      p === '/api/me' || p === '/me') {
    return next();
  }
  return auth.requireAuth(req, res, next);
}

app.use(guard);

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

// Simple session-based auth with HMAC-signed cookies.
// Password is stored as PBKDF2 hash; session cookies are HMAC-signed JWT-like
// tokens. No dependencies beyond Node's built-in crypto.

const crypto = require('crypto');

const COOKIE_NAME = 'cm_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch (e) {
    return false;
  }
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function signToken(payload, secret) {
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac('sha256', secret).update(body).digest());
  return body + '.' + sig;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = base64url(crypto.createHmac('sha256', secret).update(body).digest());
  if (!constantTimeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body).toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

function verifyPassword(submitted, stored) {
  if (!stored) return false;
  // Format: pbkdf2_sha256$iterations$salt$hash
  const parts = String(stored).split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const expectedHash = parts[3];
  if (!iterations || !salt || !expectedHash) return false;
  const hash = crypto.pbkdf2Sync(String(submitted), salt, iterations, 32, 'sha256').toString('hex');
  return constantTimeEqual(hash, expectedHash);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function buildSetCookie(name, value, opts) {
  opts = opts || {};
  let cookie = `${name}=${encodeURIComponent(value)}`;
  cookie += `; Path=${opts.path || '/'}`;
  if (opts.maxAge !== undefined) cookie += `; Max-Age=${Math.floor(opts.maxAge)}`;
  cookie += `; HttpOnly`;
  cookie += `; SameSite=${opts.sameSite || 'Lax'}`;
  if (opts.secure) cookie += `; Secure`;
  return cookie;
}

function getSecret() {
  return process.env.AUTH_SESSION_SECRET || '';
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token, getSecret());
}

function issueSession(res, email) {
  const secret = getSecret();
  if (!secret) throw new Error('AUTH_SESSION_SECRET not configured');
  const payload = { sub: email, exp: Date.now() + SESSION_TTL_MS };
  const token = signToken(payload, secret);
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  res.setHeader('Set-Cookie', buildSetCookie(COOKIE_NAME, token, {
    maxAge: SESSION_TTL_MS / 1000,
    secure,
    sameSite: 'Lax'
  }));
}

function clearSession(res) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  res.setHeader('Set-Cookie', buildSetCookie(COOKIE_NAME, '', {
    maxAge: 0,
    secure,
    sameSite: 'Lax'
  }));
}

function requireAuth(req, res, next) {
  const session = isAuthenticated(req);
  if (!session) {
    return res.status(401).json({ error: 'Non autenticato', code: 'AUTH_REQUIRED' });
  }
  req.user = session;
  next();
}

module.exports = {
  COOKIE_NAME,
  verifyPassword,
  verifyToken,
  signToken,
  parseCookies,
  isAuthenticated,
  issueSession,
  clearSession,
  requireAuth,
};

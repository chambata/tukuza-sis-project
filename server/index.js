require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { isDefaultAdminPasswordInUse } = require('./lib/defaultPassword');

const app = express();
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// Behind Cloudflare Tunnel, the real client IP arrives in X-Forwarded-For —
// but only trust that header when the immediate peer is loopback (i.e.
// cloudflared running on this same machine). 'loopback' rather than a hop
// count matters: with a plain hop count, anyone on the school's LAN could
// connect directly and send "X-Forwarded-For: 127.0.0.1" to pass as local.
app.set('trust proxy', 'loopback');

app.use(helmet({
  // This app is an API + a plain React SPA with no inline-script needs beyond
  // what Vite's build already produces as separate files, so the default
  // helmet CSP is unnecessarily strict for the static client and not useful
  // for a JSON API — disabled here; Cloudflare's own edge protections plus
  // the origin allow-list below are the actual access controls.
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS: always allow the desktop app itself (Electron's file:// pages send
// either no Origin header or the literal string "null"; the Vite dev server
// runs on localhost) — plus any origin an Administrator has explicitly
// added in Settings (e.g. the public website's URL), read fresh on every
// request so a change in Settings takes effect without a restart.
function isOriginAllowed(origin) {
  if (!origin || origin === 'null') return true; // Electron (file://) or same-origin server-rendered requests
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true; // local dev
  try {
    const { getSetting } = require('./lib/settings');
    const configured = (getSetting('allowed_origins') || '')
      .split(',').map((o) => o.trim()).filter(Boolean);
    return configured.includes(origin);
  } catch (err) {
    return false; // fail closed if settings can't be read for any reason
  }
}
app.use(cors({
  origin: (origin, callback) => {
    callback(null, isOriginAllowed(origin));
  },
}));

app.use(express.json({ limit: '20mb' })); // allow base64 passport photo uploads and backup-file restores

// General API rate limit — generous enough for normal use, enough to blunt
// scraping/abuse once this is reachable from the internet rather than only
// from the same machine.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  skip: (req) => LOOPBACK_IPS.has(req.ip), // never throttle the desktop app's own local UI
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down and try again shortly.' },
}));

// Much stricter limit specifically on login, independent of the per-account
// lockout in server/lib/loginLockout.js — this one blunts an attacker trying
// many different usernames from one IP, which the per-account lockout alone
// wouldn't catch.
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts from this network. Please try again later.' },
}));


// Secure-by-default gate: while the published default admin password is still
// in place, refuse every API request that didn't originate on this machine.
// The desktop app itself (and anyone sitting at this computer) is unaffected,
// so the intended flow still works — change the password locally first, and
// remote access switches on by itself.
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || LOOPBACK_IPS.has(req.ip)) return next();
  if (isDefaultAdminPasswordInUse()) {
    return res.status(503).json({
      error: 'Remote access is disabled until the administrator changes the default password. Please ask them to sign in at the school computer and change it.',
    });
  }
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'tukuza-sis-server' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/students', require('./routes/students'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/results', require('./routes/results'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/backups', require('./routes/backups'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/programmes', require('./routes/programmes'));
app.use('/api/academic-years', require('./routes/academicYears'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/intakes', require('./routes/intakes'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/grade-scales', require('./routes/gradeScales'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/notifications', require('./routes/notifications'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React client for anything that isn't an API call, so a
// browser reaching this server directly (e.g. through a Cloudflare Tunnel)
// gets the full app — the same client Electron loads via file://, now also
// reachable over the network. This has no effect on how Electron itself
// loads the UI (electron/main.js still uses loadFile for that).
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

// Loopback only by default. The desktop app talks to this server from the same
// machine, and a Cloudflare Tunnel (cloudflared) also connects from the same
// machine — so nothing legitimate needs this port reachable from the school
// network. Set BIND_ADDRESS=0.0.0.0 only if you deliberately want LAN access.
const HOST = process.env.BIND_ADDRESS || '127.0.0.1';

function start() {
  return app.listen(PORT, HOST, () => {
    console.log(`[server] Tukuza SIS API listening on http://${HOST}:${PORT}`);
  });
}

// Start immediately when run as a standalone process (`node server/index.js`)
// or required from Electron's main process (Electron requires this module
// rather than executing it directly, so we can't rely on require.main here).
start();

module.exports = app;
module.exports.start = start;

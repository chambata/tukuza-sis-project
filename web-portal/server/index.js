require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();

// This runs behind a hosting platform's proxy (Render/Railway/nginx), which
// puts the real visitor address in X-Forwarded-For. Trust exactly one hop so
// the rate limiter counts real visitors instead of lumping everyone into the
// proxy's single address.
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Students sign in here from the open internet: cap login attempts per visitor.
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
}));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'tukuza-sis-web-portal' }));

app.use('/api/sync', require('./routes/sync'));
const { router: authRouter } = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/api/students', require('./routes/students'));
app.use('/api/public', require('./routes/public'));

// Serve the built React client (client/dist) for everything else, so this
// one process can be deployed as a single web service.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4100;
app.listen(PORT, () => console.log(`[portal] Tukuza SIS Web Portal listening on http://localhost:${PORT}`));

module.exports = app;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

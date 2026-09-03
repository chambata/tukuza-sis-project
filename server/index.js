require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'tukuza-sis-server' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/students', require('./routes/students'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/results', require('./routes/results'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

function start() {
  return app.listen(PORT, () => {
    console.log(`[server] Tukuza SIS API listening on http://localhost:${PORT}`);
  });
}

// Start immediately when run as a standalone process (`node server/index.js`)
// or required from Electron's main process (Electron requires this module
// rather than executing it directly, so we can't rely on require.main here).
start();

module.exports = app;
module.exports.start = start;

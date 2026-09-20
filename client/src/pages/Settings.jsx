import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, TextField, Button, Alert, Grid, Avatar } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SyncIcon from '@mui/icons-material/Sync';
import api from '../api';

export default function Settings() {
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    api.get('/settings').then((res) => setForm(res.data));
  }, []);

  function handleLogoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, institution_logo: reader.result });
    reader.readAsDataURL(file);
  }

  async function save() {
    setError('');
    setMessage('');
    try {
      await api.put('/settings', form);
      setMessage('Settings saved.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    }
  }

  async function syncNow() {
    setSyncBusy(true);
    setSyncError('');
    setSyncMessage('');
    try {
      const res = await api.post('/settings/sync-website');
      setSyncMessage(
        `Synced ${res.data.counts.students} student(s), ${res.data.counts.results} result(s), ` +
        `${res.data.counts.programmes} programme(s), ${res.data.counts.announcements} announcement(s).`
      );
      const refreshed = await api.get('/settings');
      setForm(refreshed.data);
    } catch (err) {
      setSyncError(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncBusy(false);
    }
  }

  if (!form) return <Typography>Loading…</Typography>;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>System Settings</Typography>
      <Paper sx={{ p: 3, maxWidth: 640, mb: 3 }}>
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar src={form.institution_logo || undefined} variant="rounded" sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
            {!form.institution_logo && (form.institution_name || 'T').charAt(0)}
          </Avatar>
          <Button component="label" variant="outlined" size="small">
            Upload Logo
            <input type="file" hidden accept="image/*" onChange={handleLogoChange} />
          </Button>
          {form.institution_logo && (
            <Button size="small" onClick={() => setForm({ ...form, institution_logo: '' })}>Remove</Button>
          )}
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField label="Institution Name" fullWidth value={form.institution_name}
              onChange={(e) => setForm({ ...form, institution_name: e.target.value })} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Address" fullWidth value={form.institution_address}
              onChange={(e) => setForm({ ...form, institution_address: e.target.value })} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Phone Number" fullWidth value={form.institution_phone}
              onChange={(e) => setForm({ ...form, institution_phone: e.target.value })} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Email" fullWidth value={form.institution_email}
              onChange={(e) => setForm({ ...form, institution_email: e.target.value })} />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Currency Code" fullWidth value={form.currency_code}
              onChange={(e) => setForm({ ...form, currency_code: e.target.value })}
              placeholder="ZMW" />
          </Grid>
          <Grid item xs={6}>
            <TextField label="Currency Symbol" fullWidth value={form.currency_symbol}
              onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
              placeholder="K" />
          </Grid>
        </Grid>

        <Button variant="contained" startIcon={<SaveIcon />} sx={{ mt: 3 }} onClick={save}>
          Save Settings
        </Button>
      </Paper>

      <Paper sx={{ p: 3, maxWidth: 640 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>Website Sync</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Periodically pushes a read-only copy of published results, fees, programmes, and
          announcements to your public student portal website. Nothing the website shows can
          ever write back into this app — this desktop database stays the only place data is
          actually entered or changed.
        </Typography>
        {syncMessage && <Alert severity="success" sx={{ mb: 2 }}>{syncMessage}</Alert>}
        {syncError && <Alert severity="error" sx={{ mb: 2 }}>{syncError}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField label="Website Sync URL" fullWidth value={form.website_sync_url}
              onChange={(e) => setForm({ ...form, website_sync_url: e.target.value })}
              placeholder="https://edu.fpuniversitycollege.com" />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Sync Key" fullWidth value={form.website_sync_key}
              onChange={(e) => setForm({ ...form, website_sync_key: e.target.value })}
              placeholder="Paste the key shown when the website was set up"
              helperText="This is a shared secret, not a password you choose — copy it from the portal's own setup output." />
          </Grid>
        </Grid>
        <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center' }}>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={save}>Save Sync Settings</Button>
          <Button variant="contained" startIcon={<SyncIcon />} onClick={syncNow} disabled={syncBusy || !form.website_sync_url}>
            {syncBusy ? 'Syncing…' : 'Sync Now'}
          </Button>
        </Box>
        {form.website_last_synced_at && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Last synced: {new Date(form.website_last_synced_at).toLocaleString()}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

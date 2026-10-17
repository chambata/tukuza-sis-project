import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Alert, Typography } from '@mui/material';
import api from '../api';

// `forced` = the account is still using the published default password, so
// the dialog can't be dismissed until it's changed (remote access to the
// server stays switched off until then — see server/index.js).
export default function ChangePasswordDialog({ open, forced, onClose, onChanged }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (next.length < 8) return setError('The new password must be at least 8 characters.');
    if (next !== confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setCurrent(''); setNext(''); setConfirm('');
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={forced ? undefined : onClose} disableEscapeKeyDown={forced} maxWidth="xs" fullWidth>
      <DialogTitle>{forced ? 'Change the default password' : 'Change password'}</DialogTitle>
      <DialogContent>
        {forced && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You're signed in with the default password, which is published publicly.
            Choose a new one now — remote access to this system stays switched off until you do.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Current password" type="password" fullWidth sx={{ mt: 1 }} value={current} onChange={(e) => setCurrent(e.target.value)} />
        <TextField label="New password" type="password" fullWidth sx={{ mt: 2 }} value={next} onChange={(e) => setNext(e.target.value)}
          helperText="At least 8 characters." />
        <TextField label="Confirm new password" type="password" fullWidth sx={{ mt: 2 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {!forced && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>You'll stay signed in on this device.</Typography>}
      </DialogContent>
      <DialogActions>
        {!forced && <Button onClick={onClose}>Cancel</Button>}
        <Button variant="contained" onClick={submit} disabled={busy || !current || !next}>Change password</Button>
      </DialogActions>
    </Dialog>
  );
}

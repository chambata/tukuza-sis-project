import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, IconButton, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CampaignIcon from '@mui/icons-material/Campaign';
import api from '../api';
import { useAuth } from '../AuthContext.jsx';
import { ANNOUNCEMENT_WRITE_ROLES } from '../roles.js';

const TARGETS = ['All Users', 'All Students', 'Specific Programme', 'Lecturers', 'Staff'];

export default function Announcements() {
  const { user } = useAuth();
  const canWrite = ANNOUNCEMENT_WRITE_ROLES.includes(user?.role);
  const [rows, setRows] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', target: 'All Users', target_programme: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/announcements').then((res) => setRows(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (canWrite) api.get('/programmes').then((res) => setProgrammes(res.data)); }, [canWrite]);

  async function save() {
    setError('');
    try {
      await api.post('/announcements', form);
      setOpen(false);
      setForm({ title: '', message: '', target: 'All Users', target_programme: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post announcement');
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete "${row.title}"?`)) return;
    await api.delete(`/announcements/${row.id}`);
    load();
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Announcements</Typography>
        {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New Announcement</Button>}
      </Box>

      {rows.length === 0 ? (
        <Typography color="text.secondary">No announcements yet.</Typography>
      ) : (
        rows.map((a) => (
          <Paper key={a.id} sx={{ p: 2.5, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <CampaignIcon color="primary" sx={{ mt: 0.5 }} />
                <Box>
                  <Typography fontWeight={600}>{a.title}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{a.message}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                    <Chip size="small" label={a.target === 'Specific Programme' ? a.target_programme : a.target} variant="outlined" />
                    <Typography variant="caption" color="text.secondary">
                      {a.created_by} · {new Date(a.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              {canWrite && (
                <IconButton size="small" onClick={() => remove(a)}><DeleteIcon fontSize="small" /></IconButton>
              )}
            </Box>
          </Paper>
        ))
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Announcement</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <TextField label="Title" fullWidth sx={{ mt: 1 }} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField label="Message" fullWidth multiline rows={4} sx={{ mt: 2 }} value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <TextField select label="Target" fullWidth sx={{ mt: 2 }} value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}>
            {TARGETS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          {form.target === 'Specific Programme' && (
            <TextField select label="Programme" fullWidth sx={{ mt: 2 }} value={form.target_programme}
              onChange={(e) => setForm({ ...form, target_programme: e.target.value })}>
              {programmes.map((p) => <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>)}
            </TextField>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Post Announcement</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Paper, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Switch, Chip, IconButton, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LockResetIcon from '@mui/icons-material/LockReset';
import api from '../api';
import { STAFF_ROLES, LECTURER } from '../roles.js';

export default function Users() {
  const [rows, setRows] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: LECTURER });
  const [error, setError] = useState('');

  const [resetOpen, setResetOpen] = useState(null); // holds the user row being reset
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');

  const load = useCallback(() => {
    api.get('/users').then((res) => setRows(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/programmes').then((res) => setProgrammes(res.data)); }, []);

  async function createUser() {
    setError('');
    try {
      await api.post('/users', form);
      setOpen(false);
      setForm({ username: '', password: '', full_name: '', role: LECTURER });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  }

  async function toggleActive(user) {
    await api.put(`/users/${user.id}/status`, { is_active: user.is_active ? 0 : 1 });
    load();
  }

  async function assignProgram(user, program) {
    await api.put(`/users/${user.id}/assign-program`, { program });
    load();
  }

  async function resetPassword() {
    setResetError('');
    try {
      await api.put(`/users/${resetOpen.id}/reset-password`, { newPassword });
      setResetOpen(null);
      setNewPassword('');
    } catch (err) {
      setResetError(err.response?.data?.error || 'Failed to reset password');
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>User Accounts</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add User</Button>
      </Box>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Full Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Assigned Programme</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.full_name || '—'}</TableCell>
                <TableCell><Chip size="small" label={u.role} /></TableCell>
                <TableCell>
                  {u.role === LECTURER ? (
                    <TextField
                      select size="small" value={u.assigned_program || ''} sx={{ minWidth: 200 }}
                      onChange={(e) => assignProgram(u, e.target.value)}
                      SelectProps={{ displayEmpty: true }}
                    >
                      <MenuItem value="">All programmes</MenuItem>
                      {programmes.map((p) => <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>)}
                    </TextField>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <Switch checked={!!u.is_active} onChange={() => toggleActive(u)} size="small" />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small" title="Reset password"
                    onClick={() => { setResetOpen(u); setNewPassword(''); setResetError(''); }}
                  >
                    <LockResetIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <TextField label="Username" fullWidth sx={{ mt: 1 }} value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <TextField label="Full Name" fullWidth sx={{ mt: 2 }} value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <TextField label="Password" type="password" fullWidth sx={{ mt: 2 }} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <TextField select label="Role" fullWidth sx={{ mt: 2 }} value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {STAFF_ROLES.map((r) => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Student accounts are created from a student's profile page (so the login is
            correctly linked to their record), not here.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createUser}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!resetOpen} onClose={() => setResetOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset Password — {resetOpen?.username}</DialogTitle>
        <DialogContent>
          {resetError && <Alert severity="error" sx={{ mb: 1 }}>{resetError}</Alert>}
          <TextField
            label="New Password" type="password" fullWidth sx={{ mt: 1 }}
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            helperText="At least 6 characters. Share this with the user directly."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(null)}>Cancel</Button>
          <Button variant="contained" onClick={resetPassword}>Reset Password</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

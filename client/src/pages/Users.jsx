import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Paper, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Switch, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api from '../api';

export default function Users() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'Lecturer' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/users').then((res) => setRows(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createUser() {
    setError('');
    try {
      await api.post('/users', form);
      setOpen(false);
      setForm({ username: '', password: '', full_name: '', role: 'Lecturer' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  }

  async function toggleActive(user) {
    await api.put(`/users/${user.id}/status`, { is_active: user.is_active ? 0 : 1 });
    load();
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
              <TableCell>Status</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.full_name || '—'}</TableCell>
                <TableCell><Chip size="small" label={u.role} /></TableCell>
                <TableCell>{u.is_active ? 'Active' : 'Disabled'}</TableCell>
                <TableCell>
                  <Switch checked={!!u.is_active} onChange={() => toggleActive(u)} size="small" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          {error && <Typography color="error" variant="body2" sx={{ mb: 1 }}>{error}</Typography>}
          <TextField label="Username" fullWidth sx={{ mt: 1 }} value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <TextField label="Full Name" fullWidth sx={{ mt: 2 }} value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <TextField label="Password" type="password" fullWidth sx={{ mt: 2 }} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <TextField select label="Role" fullWidth sx={{ mt: 2 }} value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {['Administrator', 'Lecturer', 'Accountant', 'Student'].map((r) => (
              <MenuItem key={r} value={r}>{r}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createUser}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

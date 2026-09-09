import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api';

const emptyForm = { name: '', code: '', head_of_department: '', description: '' };

export default function Departments() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/departments').then((res) => setRows(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({ name: row.name, code: row.code || '', head_of_department: row.head_of_department || '', description: row.description || '' });
    setError('');
    setOpen(true);
  }

  async function save() {
    setError('');
    try {
      if (editingId) {
        await api.put(`/departments/${editingId}`, form);
      } else {
        await api.post('/departments', form);
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save department');
    }
  }

  async function remove(row) {
    try {
      await api.delete(`/departments/${row.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete department');
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Departments</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add Department</Button>
      </Box>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Head of Department</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4}><Typography color="text.secondary" variant="body2">No departments yet.</Typography></TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.code || '—'}</TableCell>
                <TableCell>{r.head_of_department || '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => remove(r)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit Department' : 'Add Department'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <TextField label="Department Name" fullWidth sx={{ mt: 1 }} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Code" fullWidth sx={{ mt: 2 }} value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <TextField label="Head of Department" fullWidth sx={{ mt: 2 }} value={form.head_of_department}
            onChange={(e) => setForm({ ...form, head_of_department: e.target.value })} />
          <TextField label="Description" fullWidth multiline rows={2} sx={{ mt: 2 }} value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api';

const emptyForm = { min_score: '', max_score: '', grade: '', remark: '', sort_order: '' };

export default function GradeScales() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/grade-scales').then((res) => setRows(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: rows.length + 1 });
    setError('');
    setOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({ min_score: row.min_score, max_score: row.max_score, grade: row.grade, remark: row.remark || '', sort_order: row.sort_order });
    setError('');
    setOpen(true);
  }

  async function save() {
    setError('');
    try {
      if (editingId) {
        await api.put(`/grade-scales/${editingId}`, form);
      } else {
        await api.post('/grade-scales', form);
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save grade band');
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete the "${row.grade}" band?`)) return;
    await api.delete(`/grade-scales/${row.id}`);
    load();
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Grade Scale</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add Band</Button>
      </Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Final marks are matched against these bands (in order) to compute each result's grade and remark automatically.
      </Typography>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Range</TableCell>
              <TableCell>Grade</TableCell>
              <TableCell>Remark</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.min_score} – {r.max_score}</TableCell>
                <TableCell>{r.grade}</TableCell>
                <TableCell>{r.remark || '—'}</TableCell>
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
        <DialogTitle>{editingId ? 'Edit Grade Band' : 'Add Grade Band'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <TextField label="Minimum Score" type="number" fullWidth sx={{ mt: 1 }} value={form.min_score}
            onChange={(e) => setForm({ ...form, min_score: e.target.value })} />
          <TextField label="Maximum Score" type="number" fullWidth sx={{ mt: 2 }} value={form.max_score}
            onChange={(e) => setForm({ ...form, max_score: e.target.value })} />
          <TextField label="Grade (e.g. Distinction, A)" fullWidth sx={{ mt: 2 }} value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })} />
          <TextField label="Remark" fullWidth sx={{ mt: 2 }} value={form.remark}
            onChange={(e) => setForm({ ...form, remark: e.target.value })} />
          <TextField label="Sort Order" type="number" fullWidth sx={{ mt: 2 }} value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
            helperText="Bands are checked in this order — put narrower/overlapping ranges first." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

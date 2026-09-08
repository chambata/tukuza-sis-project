import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../api';

export default function AcademicYears() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/academic-years').then((res) => setRows(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setError('');
    try {
      await api.post('/academic-years', { label });
      setOpen(false);
      setLabel('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save academic year');
    }
  }

  async function setCurrent(row) {
    await api.put(`/academic-years/${row.id}/set-current`);
    load();
  }

  async function remove(row) {
    try {
      await api.delete(`/academic-years/${row.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete academic year');
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Academic Years</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setLabel(''); setError(''); setOpen(true); }}>
          Add Academic Year
        </Button>
      </Box>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Label</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={3}><Typography color="text.secondary" variant="body2">No academic years yet.</Typography></TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.label}</TableCell>
                <TableCell>
                  {r.is_current ? <Chip label="Current" color="primary" size="small" /> : (
                    <Button size="small" onClick={() => setCurrent(r)}>Set as current</Button>
                  )}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => remove(r)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Academic Year</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <TextField label="Label (e.g. 2026 or 2026/2027)" fullWidth sx={{ mt: 1 }} value={label} onChange={(e) => setLabel(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

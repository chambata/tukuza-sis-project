import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Button,
  TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Alert,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api';
import { openPdf } from '../pdf';

const money = (n) => `K${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function Finance() {
  const [rows, setRows] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [editing, setEditing] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/payments', { params: { from: from || undefined, to: to || undefined } }).then((res) => setRows(res.data));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const totalCollected = rows.reduce((sum, r) => sum + r.amount, 0);

  function openEdit(p) {
    setEditing(p);
    setAmount(String(p.amount));
    setMethod(p.method);
    setNotes(p.notes || '');
    setError('');
  }

  async function save() {
    setError('');
    try {
      await api.put(`/payments/${editing.id}`, { amount: Number(amount), method, notes });
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update payment');
    }
  }

  async function remove(p) {
    if (!window.confirm(`Delete payment ${p.receipt_no}? The student's balance will be recalculated.`)) return;
    await api.delete(`/payments/${p.id}`);
    load();
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Finance — Payments</Typography>
        <Button
          variant="outlined" startIcon={<PictureAsPdfIcon />}
          onClick={() => openPdf(`/payments/report.pdf?from=${from}&to=${to}`, 'financial-report.pdf')}
        >
          Financial Report
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField label="From" type="date" size="small" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="To" type="date" size="small" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
      </Box>

      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Showing {rows.length} payment{rows.length === 1 ? '' : 's'} · Total shown: {money(totalCollected)}
      </Typography>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Receipt No.</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Student</TableCell>
              <TableCell>Method</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell>{p.receipt_no}</TableCell>
                <TableCell>{p.payment_date}</TableCell>
                <TableCell>
                  <Typography component={Link} to={`/students/${p.student_id}`} sx={{ color: 'primary.main', textDecoration: 'none' }}>
                    {p.first_name} {p.surname} ({p.student_number})
                  </Typography>
                </TableCell>
                <TableCell>{p.method}</TableCell>
                <TableCell align="right">{money(p.amount)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => remove(p)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Payment — {editing?.receipt_no}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <TextField
            label="Amount (K)" type="number" fullWidth sx={{ mt: 1 }}
            value={amount} onChange={(e) => setAmount(e.target.value)}
          />
          <TextField
            select label="Method" fullWidth sx={{ mt: 2 }}
            value={method} onChange={(e) => setMethod(e.target.value)}
          >
            {['Cash', 'Bank Transfer', 'Mobile Money', 'Cheque', 'Card'].map((m) => (
              <MenuItem key={m} value={m}>{m}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Notes" fullWidth multiline rows={2} sx={{ mt: 2 }}
            value={notes} onChange={(e) => setNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

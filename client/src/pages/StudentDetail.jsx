import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Chip, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../AuthContext.jsx';
import api from '../api';

const money = (n) => `K${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function StudentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const canRecordPayment = ['Administrator', 'Accountant'].includes(user?.role);
  const [student, setStudent] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get(`/students/${id}`).then((res) => setStudent(res.data));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function recordPayment() {
    setError('');
    try {
      await api.post('/payments', { student_id: id, amount: Number(amount), method, notes });
      setPayOpen(false);
      setAmount('');
      setNotes('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment');
    }
  }

  if (!student) return <Typography>Loading…</Typography>;

  return (
    <Box>
      <Button component={Link} to="/students" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
        Back to Students
      </Button>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant="h5" fontWeight={700}>
              {[student.first_name, student.middle_name, student.surname].filter(Boolean).join(' ')}
            </Typography>
            <Typography color="text.secondary">{student.student_id} · {student.program || 'No program set'}</Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <Chip label={student.status} size="small" color="primary" />
              <Chip label={student.gender || 'Gender not set'} size="small" variant="outlined" />
              <Chip label={`Graduating ${student.year_of_graduation || '—'}`} size="small" variant="outlined" />
            </Box>
            <Typography variant="body2" sx={{ mt: 2 }}>NRC: {student.nrc_no || '—'}</Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Total Fees</Typography>
              <Typography variant="h6">{money(student.total_fees)}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Paid</Typography>
              <Typography variant="h6" color="success.main">{money(student.fees_paid)}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Balance</Typography>
              <Typography variant="h6" color={student.balance_owing > 0 ? 'warning.main' : 'success.main'}>
                {money(student.balance_owing)}
              </Typography>
              {canRecordPayment && (
                <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={() => setPayOpen(true)}>
                  Record Payment
                </Button>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>Payment History</Typography>
        {student.payments.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No payments recorded yet.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Receipt No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Received By</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {student.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.receipt_no}</TableCell>
                  <TableCell>{p.payment_date}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell>{p.received_by}</TableCell>
                  <TableCell align="right">{money(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          {error && <Typography color="error" variant="body2" sx={{ mb: 1 }}>{error}</Typography>}
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
          <Button onClick={() => setPayOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={recordPayment}>Save Payment</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

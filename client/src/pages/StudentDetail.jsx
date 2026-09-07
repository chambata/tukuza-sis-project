import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Chip, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeIcon from '@mui/icons-material/Badge';
import DescriptionIcon from '@mui/icons-material/Description';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SchoolIcon from '@mui/icons-material/School';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '../AuthContext.jsx';
import api from '../api';
import { openPdf } from '../pdf';

const money = (n) => `K${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function StudentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const canRecordPayment = ['Administrator', 'Accountant'].includes(user?.role);
  const canEnterResults = ['Administrator', 'Lecturer'].includes(user?.role);
  const [student, setStudent] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [resultOpen, setResultOpen] = useState(false);
  const [resultForm, setResultForm] = useState({ course_name: '', academic_year: '', semester: '', score: '', grade: '' });
  const [resultError, setResultError] = useState('');

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

  async function addResult() {
    setResultError('');
    try {
      await api.post('/results', { student_id: id, ...resultForm });
      setResultOpen(false);
      setResultForm({ course_name: '', academic_year: '', semester: '', score: '', grade: '' });
      load();
    } catch (err) {
      setResultError(err.response?.data?.error || 'Failed to add result');
    }
  }

  async function deleteResult(resultId) {
    await api.delete(`/results/${resultId}`);
    load();
  }

  return (
    <Box>
      <Button component={Link} to="/students" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
        Back to Students
      </Button>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          variant="outlined" size="small" startIcon={<BadgeIcon />}
          onClick={() => openPdf(`/students/${id}/id-card.pdf`, `${student.student_id}-id-card.pdf`)}
        >
          ID Card
        </Button>
        <Button
          variant="outlined" size="small" startIcon={<DescriptionIcon />}
          onClick={() => openPdf(`/students/${id}/statement.pdf`, `${student.student_id}-statement.pdf`)}
        >
          Fee Statement
        </Button>
        <Button
          variant="outlined" size="small" startIcon={<SchoolIcon />}
          onClick={() => openPdf(`/students/${id}/transcript.pdf`, `${student.student_id}-transcript.pdf`)}
        >
          Transcript
        </Button>
      </Box>

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
                <TableCell />
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
                  <TableCell align="right">
                    <Button
                      size="small" startIcon={<ReceiptIcon />}
                      onClick={() => openPdf(`/payments/${p.id}/receipt.pdf`, `${p.receipt_no}.pdf`)}
                    >
                      Receipt
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography fontWeight={600}>Results</Typography>
          {canEnterResults && (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setResultOpen(true)}>
              Add Result
            </Button>
          )}
        </Box>
        {student.results.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No results recorded yet.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Course</TableCell>
                <TableCell>Academic Year</TableCell>
                <TableCell>Semester</TableCell>
                <TableCell align="center">Score</TableCell>
                <TableCell align="center">Grade</TableCell>
                <TableCell>Entered By</TableCell>
                {canEnterResults && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {student.results.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.course_name}</TableCell>
                  <TableCell>{r.academic_year || '—'}</TableCell>
                  <TableCell>{r.semester || '—'}</TableCell>
                  <TableCell align="center">{r.score ?? '—'}</TableCell>
                  <TableCell align="center">{r.grade || '—'}</TableCell>
                  <TableCell>{r.entered_by}</TableCell>
                  {canEnterResults && (
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => deleteResult(r.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={resultOpen} onClose={() => setResultOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Result</DialogTitle>
        <DialogContent>
          {resultError && <Typography color="error" variant="body2" sx={{ mb: 1 }}>{resultError}</Typography>}
          <TextField
            label="Course Name" fullWidth sx={{ mt: 1 }}
            value={resultForm.course_name} onChange={(e) => setResultForm({ ...resultForm, course_name: e.target.value })}
          />
          <TextField
            label="Academic Year (e.g. 2026)" fullWidth sx={{ mt: 2 }}
            value={resultForm.academic_year} onChange={(e) => setResultForm({ ...resultForm, academic_year: e.target.value })}
          />
          <TextField
            select label="Semester" fullWidth sx={{ mt: 2 }}
            value={resultForm.semester} onChange={(e) => setResultForm({ ...resultForm, semester: e.target.value })}
          >
            {['Semester 1', 'Semester 2', 'Full Year'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField
            label="Score" type="number" fullWidth sx={{ mt: 2 }}
            value={resultForm.score} onChange={(e) => setResultForm({ ...resultForm, score: e.target.value })}
          />
          <TextField
            label="Grade (e.g. A, B+, Distinction)" fullWidth sx={{ mt: 2 }}
            value={resultForm.grade} onChange={(e) => setResultForm({ ...resultForm, grade: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addResult}>Save Result</Button>
        </DialogActions>
      </Dialog>

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

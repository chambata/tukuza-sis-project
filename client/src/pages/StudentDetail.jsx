import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Chip, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, IconButton, Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeIcon from '@mui/icons-material/Badge';
import DescriptionIcon from '@mui/icons-material/Description';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SchoolIcon from '@mui/icons-material/School';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UndoIcon from '@mui/icons-material/Undo';
import LoginIcon from '@mui/icons-material/Login';
import { useAuth } from '../AuthContext.jsx';
import api from '../api';
import { openPdf } from '../pdf';
import { FINANCE_ROLES, RESULTS_ENTRY_ROLES, RESULTS_APPROVAL_ROLES, SUPER_ADMIN, ADMINISTRATOR } from '../roles.js';

const money = (n) => `K${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const emptyResultForm = { course_name: '', type: 'Exam', academic_year: '', semester: '', score: '', grade: '' };

export default function StudentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const canCreateLogin = [SUPER_ADMIN, ADMINISTRATOR].includes(user?.role);
  const canApproveResults = RESULTS_APPROVAL_ROLES.includes(user?.role);
  const canRecordPayment = FINANCE_ROLES.includes(user?.role);
  const canEnterResults = RESULTS_ENTRY_ROLES.includes(user?.role);

  const [student, setStudent] = useState(null);
  const [academicYears, setAcademicYears] = useState([]);

  const [payOpen, setPayOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const [resultOpen, setResultOpen] = useState(false);
  const [editingResultId, setEditingResultId] = useState(null);
  const [resultForm, setResultForm] = useState(emptyResultForm);
  const [resultError, setResultError] = useState('');

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginCreated, setLoginCreated] = useState(null);

  const load = useCallback(() => {
    api.get(`/students/${id}`).then((res) => setStudent(res.data));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/academic-years').then((res) => setAcademicYears(res.data)); }, []);

  function openAddPayment() {
    setEditingPaymentId(null);
    setAmount('');
    setMethod('Cash');
    setNotes('');
    setError('');
    setPayOpen(true);
  }

  function openEditPayment(p) {
    setEditingPaymentId(p.id);
    setAmount(String(p.amount));
    setMethod(p.method);
    setNotes(p.notes || '');
    setError('');
    setPayOpen(true);
  }

  async function savePayment() {
    setError('');
    try {
      if (editingPaymentId) {
        await api.put(`/payments/${editingPaymentId}`, { amount: Number(amount), method, notes });
      } else {
        await api.post('/payments', { student_id: id, amount: Number(amount), method, notes });
      }
      setPayOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save payment');
    }
  }

  async function deletePayment(paymentId) {
    if (!window.confirm('Delete this payment? The student balance will be recalculated.')) return;
    await api.delete(`/payments/${paymentId}`);
    load();
  }

  function openAddResult() {
    setEditingResultId(null);
    setResultForm(emptyResultForm);
    setResultError('');
    setResultOpen(true);
  }

  function openEditResult(r) {
    setEditingResultId(r.id);
    setResultForm({
      course_name: r.course_name, type: r.type, academic_year: r.academic_year || '',
      semester: r.semester || '', score: r.score ?? '', grade: r.grade || '',
    });
    setResultError('');
    setResultOpen(true);
  }

  async function saveResult() {
    setResultError('');
    try {
      if (editingResultId) {
        await api.put(`/results/${editingResultId}`, resultForm);
      } else {
        await api.post('/results', { student_id: id, ...resultForm });
      }
      setResultOpen(false);
      load();
    } catch (err) {
      setResultError(err.response?.data?.error || 'Failed to save result');
    }
  }

  async function deleteResult(resultId) {
    if (!window.confirm('Delete this result?')) return;
    try {
      await api.delete(`/results/${resultId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete result');
    }
  }

  async function approveResult(resultId) {
    await api.put(`/results/${resultId}/approve`);
    load();
  }

  async function unapproveResult(resultId) {
    await api.put(`/results/${resultId}/unapprove`);
    load();
  }

  async function createLogin() {
    setLoginError('');
    try {
      const res = await api.post(`/students/${id}/create-login`, { password: loginPassword });
      setLoginCreated(res.data.username);
      load();
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Failed to create login');
    }
  }

  if (!student) return <Typography>Loading…</Typography>;

  return (
    <Box>
      <Button component={Link} to="/students" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
        Back to Students
      </Button>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
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
        {canCreateLogin && !student.loginAccount && (
          <Button
            variant="outlined" size="small" startIcon={<LoginIcon />}
            onClick={() => { setLoginOpen(true); setLoginPassword(''); setLoginError(''); setLoginCreated(null); }}
          >
            Create Student Login
          </Button>
        )}
        {canCreateLogin && student.loginAccount && (
          <Chip
            icon={<LoginIcon />}
            label={`Login: ${student.loginAccount.username} (${student.loginAccount.is_active ? 'Active' : 'Disabled'})`}
            size="small"
            variant="outlined"
            sx={{ alignSelf: 'center' }}
          />
        )}
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant="h5" fontWeight={700}>
              {[student.first_name, student.middle_name, student.surname].filter(Boolean).join(' ')}
            </Typography>
            <Typography color="text.secondary">{student.student_id} · {student.program || 'No programme set'}</Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <Chip label={student.status} size="small" color="primary" />
              <Chip label={student.gender || 'Sex not set'} size="small" variant="outlined" />
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
                <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={openAddPayment}>
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
                <TableCell align="right">Actions</TableCell>
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
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button
                      size="small" startIcon={<ReceiptIcon />}
                      onClick={() => openPdf(`/payments/${p.id}/receipt.pdf`, `${p.receipt_no}.pdf`)}
                    >
                      Receipt
                    </Button>
                    {canRecordPayment && (
                      <>
                        <IconButton size="small" onClick={() => openEditPayment(p)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => deletePayment(p.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </>
                    )}
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
            <Button size="small" startIcon={<AddIcon />} onClick={openAddResult}>
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
                <TableCell>Type</TableCell>
                <TableCell>Academic Year</TableCell>
                <TableCell>Semester</TableCell>
                <TableCell align="center">Score</TableCell>
                <TableCell align="center">Grade</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {student.results.map((r) => {
                const locked = r.status === 'Approved' && !canApproveResults;
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.course_name}</TableCell>
                    <TableCell><Chip size="small" label={r.type} /></TableCell>
                    <TableCell>{r.academic_year || '—'}</TableCell>
                    <TableCell>{r.semester || '—'}</TableCell>
                    <TableCell align="center">{r.score ?? '—'}</TableCell>
                    <TableCell align="center">{r.grade || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={r.status}
                        color={r.status === 'Approved' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {canApproveResults && (r.status === 'Approved' ? (
                        <IconButton size="small" title="Unapprove" onClick={() => unapproveResult(r.id)}>
                          <UndoIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <IconButton size="small" title="Approve" onClick={() => approveResult(r.id)}>
                          <CheckCircleIcon fontSize="small" color="success" />
                        </IconButton>
                      ))}
                      {canEnterResults && !locked && (
                        <>
                          <IconButton size="small" onClick={() => openEditResult(r)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => deleteResult(r.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={resultOpen} onClose={() => setResultOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingResultId ? 'Edit Result' : 'Add Result'}</DialogTitle>
        <DialogContent>
          {resultError && <Alert severity="error" sx={{ mb: 1 }}>{resultError}</Alert>}
          <TextField
            label="Course Name" fullWidth sx={{ mt: 1 }}
            value={resultForm.course_name} onChange={(e) => setResultForm({ ...resultForm, course_name: e.target.value })}
          />
          <TextField
            select label="Type" fullWidth sx={{ mt: 2 }}
            value={resultForm.type} onChange={(e) => setResultForm({ ...resultForm, type: e.target.value })}
          >
            <MenuItem value="CA">Continuous Assessment</MenuItem>
            <MenuItem value="Exam">Examination</MenuItem>
          </TextField>
          <TextField
            select label="Academic Year" fullWidth sx={{ mt: 2 }}
            value={resultForm.academic_year} onChange={(e) => setResultForm({ ...resultForm, academic_year: e.target.value })}
          >
            {academicYears.map((y) => <MenuItem key={y.id} value={y.label}>{y.label}</MenuItem>)}
          </TextField>
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
          <Button variant="contained" onClick={saveResult}>Save Result</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingPaymentId ? 'Edit Payment' : 'Record Payment'}</DialogTitle>
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
          <Button onClick={() => setPayOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={savePayment}>Save Payment</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={loginOpen} onClose={() => setLoginOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Student Login</DialogTitle>
        <DialogContent>
          {loginError && <Alert severity="error" sx={{ mb: 1 }}>{loginError}</Alert>}
          {loginCreated ? (
            <Alert severity="success">
              Login created. Username: <strong>{loginCreated}</strong>. Share the password you set with the student directly.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This creates a login for the student using their Student ID (<strong>{student.student_id}</strong>) as the username.
              </Typography>
              <TextField
                label="Set Password" type="password" fullWidth
                value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                helperText="At least 6 characters. Share this with the student directly."
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoginOpen(false)}>{loginCreated ? 'Close' : 'Cancel'}</Button>
          {!loginCreated && <Button variant="contained" onClick={createLogin}>Create Login</Button>}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

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
import LoginIcon from '@mui/icons-material/Login';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import UndoIcon from '@mui/icons-material/Undo';
import { useAuth } from '../AuthContext.jsx';
import api from '../api';
import { openPdf } from '../pdf';
import {
  FINANCE_ROLES, RESULTS_ENTRY_ROLES, RESULTS_APPROVAL_ROLES, SUPER_ADMIN, ADMINISTRATOR,
  COURSE_REGISTRATION_ROLES,
} from '../roles.js';
import { useCurrency } from '../SettingsContext.jsx';

const formatMoney = (n, cur) => `${cur}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const emptyResultForm = { course_name: '', academic_year: '', semester: '', components: [], exam_score: '' };

// The next workflow action available for a given status, and who can do it.
const WORKFLOW_STEPS = {
  Draft: { action: 'submit', label: 'Submit', roles: RESULTS_ENTRY_ROLES },
  Submitted: { action: 'approve', label: 'Approve', roles: RESULTS_APPROVAL_ROLES },
  Approved: { action: 'publish', label: 'Publish', roles: RESULTS_APPROVAL_ROLES },
  Published: { action: 'lock', label: 'Lock', roles: RESULTS_APPROVAL_ROLES },
};
const STATUS_COLOR = { Draft: 'default', Submitted: 'info', Approved: 'warning', Published: 'success', Locked: 'secondary' };

export default function StudentDetail() {
  const cur = useCurrency();
  const money = (n) => formatMoney(n, cur);
  const { id } = useParams();
  const { user } = useAuth();
  const canCreateLogin = [SUPER_ADMIN, ADMINISTRATOR].includes(user?.role);
  const canEnterResults = RESULTS_ENTRY_ROLES.includes(user?.role);
  const canRecordPayment = FINANCE_ROLES.includes(user?.role);
  const canRegisterCourses = COURSE_REGISTRATION_ROLES.includes(user?.role);
  const isSuperAdmin = user?.role === SUPER_ADMIN;

  const [student, setStudent] = useState(null);
  const [academicYears, setAcademicYears] = useState([]);
  const [courses, setCourses] = useState([]);

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

  const [courseOpen, setCourseOpen] = useState(false);
  const [courseToRegister, setCourseToRegister] = useState('');
  const [courseYear, setCourseYear] = useState('');
  const [courseSemester, setCourseSemester] = useState('');

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginCreated, setLoginCreated] = useState(null);

  const load = useCallback(() => {
    api.get(`/students/${id}`).then((res) => setStudent(res.data));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/academic-years').then((res) => setAcademicYears(res.data)); }, []);
  useEffect(() => { api.get('/courses').then((res) => setCourses(res.data)); }, []);

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
      course_name: r.course_name, academic_year: r.academic_year || '', semester: r.semester || '',
      components: r.components.map((c) => ({ component_name: c.component_name, score: c.score, max_score: c.max_score })),
      exam_score: r.exam_score ?? '',
    });
    setResultError('');
    setResultOpen(true);
  }

  function addComponentRow() {
    setResultForm({ ...resultForm, components: [...resultForm.components, { component_name: '', score: '', max_score: 100 }] });
  }
  function updateComponentRow(i, field, value) {
    const components = [...resultForm.components];
    components[i] = { ...components[i], [field]: value };
    setResultForm({ ...resultForm, components });
  }
  function removeComponentRow(i) {
    setResultForm({ ...resultForm, components: resultForm.components.filter((_, idx) => idx !== i) });
  }

  const caPreviewTotal = resultForm.components.reduce((sum, c) => sum + (Number(c.score) || 0), 0);
  const finalMarkPreview = caPreviewTotal + (Number(resultForm.exam_score) || 0);

  async function saveResult() {
    setResultError('');
    const payload = {
      course_name: resultForm.course_name,
      academic_year: resultForm.academic_year,
      semester: resultForm.semester,
      components: resultForm.components.filter((c) => c.component_name),
      exam_score: resultForm.exam_score === '' ? null : Number(resultForm.exam_score),
    };
    try {
      if (editingResultId) {
        await api.put(`/results/${editingResultId}`, payload);
      } else {
        await api.post('/results', { student_id: id, ...payload });
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

  async function advanceResult(resultId, action) {
    try {
      await api.put(`/results/${resultId}/${action}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || `Failed to ${action} result`);
    }
  }

  async function revertResult(resultId) {
    if (!window.confirm('Move this result back one stage for correction?')) return;
    await api.put(`/results/${resultId}/revert`);
    load();
  }

  async function registerCourse() {
    try {
      await api.post(`/students/${id}/courses`, { course_id: courseToRegister, academic_year: courseYear, semester: courseSemester });
      setCourseOpen(false);
      setCourseToRegister(''); setCourseYear(''); setCourseSemester('');
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to register course');
    }
  }

  async function removeCourse(enrollmentId) {
    if (!window.confirm('Remove this course registration?')) return;
    await api.delete(`/students/${id}/courses/${enrollmentId}`);
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
        <Button variant="outlined" size="small" startIcon={<BadgeIcon />}
          onClick={() => openPdf(`/students/${id}/id-card.pdf`, `${student.student_id}-id-card.pdf`)}>
          ID Card
        </Button>
        <Button variant="outlined" size="small" startIcon={<DescriptionIcon />}
          onClick={() => openPdf(`/students/${id}/statement.pdf`, `${student.student_id}-statement.pdf`)}>
          Fee Statement
        </Button>
        <Button variant="outlined" size="small" startIcon={<SchoolIcon />}
          onClick={() => openPdf(`/students/${id}/transcript.pdf`, `${student.student_id}-transcript.pdf`)}>
          Transcript
        </Button>
        {canCreateLogin && !student.loginAccount && (
          <Button variant="outlined" size="small" startIcon={<LoginIcon />}
            onClick={() => { setLoginOpen(true); setLoginPassword(''); setLoginError(''); setLoginCreated(null); }}>
            Create Student Login
          </Button>
        )}
        {canCreateLogin && student.loginAccount && (
          <Chip icon={<LoginIcon />} label={`Login: ${student.loginAccount.username} (${student.loginAccount.is_active ? 'Active' : 'Disabled'})`}
            size="small" variant="outlined" sx={{ alignSelf: 'center' }} />
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
                <Button fullWidth variant="contained" sx={{ mt: 2 }} onClick={openAddPayment}>Record Payment</Button>
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
                    <Button size="small" startIcon={<ReceiptIcon />}
                      onClick={() => openPdf(`/payments/${p.id}/receipt.pdf`, `${p.receipt_no}.pdf`)}>
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
          <Typography fontWeight={600}>Registered Courses</Typography>
          {canRegisterCourses && (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setCourseOpen(true)}>Register Course</Button>
          )}
        </Box>
        {student.courses.length === 0 ? (
          <Typography color="text.secondary" variant="body2">Not registered for any courses yet.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell><TableCell>Course</TableCell><TableCell>Period</TableCell>
                {canRegisterCourses && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {student.courses.map((c) => (
                <TableRow key={c.enrollment_id}>
                  <TableCell>{c.course_code}</TableCell>
                  <TableCell>{c.course_name}</TableCell>
                  <TableCell>{[c.academic_year, c.semester].filter(Boolean).join(' · ') || '—'}</TableCell>
                  {canRegisterCourses && (
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => removeCourse(c.enrollment_id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  )}
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
            <Button size="small" startIcon={<AddIcon />} onClick={openAddResult}>Add Result</Button>
          )}
        </Box>
        {student.results.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No results recorded yet.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Course</TableCell>
                <TableCell>Period</TableCell>
                <TableCell align="center">CA Total</TableCell>
                <TableCell align="center">Exam</TableCell>
                <TableCell align="center">Final Mark</TableCell>
                <TableCell align="center">Grade</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {student.results.map((r) => {
                const step = WORKFLOW_STEPS[r.status];
                const canAdvance = step && step.roles.includes(user?.role);
                const canEditThis = r.status === 'Draft' && canEnterResults;
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.course_name}</TableCell>
                    <TableCell>{[r.academic_year, r.semester].filter(Boolean).join(' · ') || '—'}</TableCell>
                    <TableCell align="center">{r.ca_total ?? '—'}</TableCell>
                    <TableCell align="center">{r.exam_score ?? '—'}</TableCell>
                    <TableCell align="center">{r.final_mark ?? '—'}</TableCell>
                    <TableCell align="center">{r.grade || '—'}</TableCell>
                    <TableCell><Chip size="small" label={r.status} color={STATUS_COLOR[r.status]} /></TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {canAdvance && (
                        <IconButton size="small" title={step.label} onClick={() => advanceResult(r.id, step.action)}>
                          <ArrowForwardIcon fontSize="small" color="primary" />
                        </IconButton>
                      )}
                      {isSuperAdmin && r.status !== 'Draft' && (
                        <IconButton size="small" title="Revert one stage" onClick={() => revertResult(r.id)}>
                          <UndoIcon fontSize="small" />
                        </IconButton>
                      )}
                      {canEditThis && (
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

      <Dialog open={resultOpen} onClose={() => setResultOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingResultId ? 'Edit Result' : 'Add Result'}</DialogTitle>
        <DialogContent>
          {resultError && <Alert severity="error" sx={{ mb: 1 }}>{resultError}</Alert>}
          <TextField label="Course Name" fullWidth sx={{ mt: 1 }}
            value={resultForm.course_name} onChange={(e) => setResultForm({ ...resultForm, course_name: e.target.value })} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
            <TextField select label="Academic Year" value={resultForm.academic_year}
              onChange={(e) => setResultForm({ ...resultForm, academic_year: e.target.value })}>
              {academicYears.map((y) => <MenuItem key={y.id} value={y.label}>{y.label}</MenuItem>)}
            </TextField>
            <TextField select label="Semester" value={resultForm.semester}
              onChange={(e) => setResultForm({ ...resultForm, semester: e.target.value })}>
              {['Semester 1', 'Semester 2', 'Full Year'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Box>

          <Typography fontWeight={600} sx={{ mt: 3, mb: 1 }}>Continuous Assessment Components</Typography>
          {resultForm.components.map((c, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              <TextField
                size="small" label="Component" value={c.component_name} sx={{ flex: 2 }}
                onChange={(e) => updateComponentRow(i, 'component_name', e.target.value)}
                placeholder="e.g. Assignment, Test, Quiz"
              />
              <TextField
                size="small" label="Score" type="number" sx={{ flex: 1 }} value={c.score}
                onChange={(e) => updateComponentRow(i, 'score', e.target.value)}
              />
              <IconButton size="small" onClick={() => removeComponentRow(i)}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={addComponentRow}>Add Component</Button>

          <TextField
            label="Examination Score" type="number" fullWidth sx={{ mt: 3 }}
            value={resultForm.exam_score} onChange={(e) => setResultForm({ ...resultForm, exam_score: e.target.value })}
          />

          <Paper variant="outlined" sx={{ p: 1.5, mt: 2, bgcolor: 'background.default' }}>
            <Typography variant="body2">CA Total (auto): <strong>{caPreviewTotal}</strong></Typography>
            <Typography variant="body2">Final Mark (auto): <strong>{finalMarkPreview}</strong></Typography>
            <Typography variant="caption" color="text.secondary">Grade is computed automatically on save, from the configured grade scale.</Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveResult}>Save Result</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={courseOpen} onClose={() => setCourseOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Register Course</DialogTitle>
        <DialogContent>
          <TextField select label="Course" fullWidth sx={{ mt: 1 }} value={courseToRegister}
            onChange={(e) => setCourseToRegister(e.target.value)}>
            {courses.map((c) => <MenuItem key={c.id} value={c.id}>{c.course_code} — {c.course_name}</MenuItem>)}
          </TextField>
          <TextField select label="Academic Year" fullWidth sx={{ mt: 2 }} value={courseYear}
            onChange={(e) => setCourseYear(e.target.value)}>
            {academicYears.map((y) => <MenuItem key={y.id} value={y.label}>{y.label}</MenuItem>)}
          </TextField>
          <TextField select label="Semester" fullWidth sx={{ mt: 2 }} value={courseSemester}
            onChange={(e) => setCourseSemester(e.target.value)}>
            {['Semester 1', 'Semester 2', 'Full Year'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCourseOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={registerCourse}>Register</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingPaymentId ? 'Edit Payment' : 'Record Payment'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <TextField label="Amount (K)" type="number" fullWidth sx={{ mt: 1 }}
            value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField select label="Method" fullWidth sx={{ mt: 2 }} value={method} onChange={(e) => setMethod(e.target.value)}>
            {['Cash', 'Bank Transfer', 'Mobile Money', 'Cheque', 'Card', 'EFT', 'Other'].map((m) => (
              <MenuItem key={m} value={m}>{m}</MenuItem>
            ))}
          </TextField>
          <TextField label="Notes" fullWidth multiline rows={2} sx={{ mt: 2 }}
            value={notes} onChange={(e) => setNotes(e.target.value)} />
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
              <TextField label="Set Password" type="password" fullWidth
                value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                helperText="At least 6 characters. Share this with the student directly." />
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

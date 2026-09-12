import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, Chip, Table, TableHead, TableRow, TableCell, TableBody, Button, Alert } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import SchoolIcon from '@mui/icons-material/School';
import api from '../api';
import { openPdf } from '../pdf';
import { useCurrency } from '../SettingsContext.jsx';

const formatMoney = (n, cur) => `${cur}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function StudentPortal() {
  const cur = useCurrency();
  const money = (n) => formatMoney(n, cur);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/students/me')
      .then((res) => setMe(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Unable to load your record.'));
  }, []);

  if (error) return <Alert severity="warning">{error}</Alert>;
  if (!me) return <Typography>Loading…</Typography>;

  const studentName = [me.first_name, me.middle_name, me.surname].filter(Boolean).join(' ');

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>My Profile</Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant="h5" fontWeight={700}>{studentName}</Typography>
            <Typography color="text.secondary">{me.student_id} · {me.program || 'No programme set'}</Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={me.status} size="small" color="primary" />
              <Chip label={me.gender || 'Sex not set'} size="small" variant="outlined" />
              <Chip label={`Expected graduation: ${me.year_of_graduation || '—'}`} size="small" variant="outlined" />
              {me.gpa !== null && <Chip label={`GPA: ${me.gpa.toFixed(2)}`} size="small" color="secondary" />}
            </Box>
            <Typography variant="body2" sx={{ mt: 2 }}>NRC: {me.nrc_no || '—'}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button
                variant="outlined" size="small" startIcon={<DescriptionIcon />}
                onClick={() => openPdf(`/students/${me.id}/statement.pdf`, `${me.student_id}-statement.pdf`)}
              >
                Fee Statement
              </Button>
              <Button
                variant="outlined" size="small" startIcon={<SchoolIcon />}
                onClick={() => openPdf(`/students/${me.id}/transcript.pdf`, `${me.student_id}-transcript.pdf`)}
              >
                Transcript
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">Total Fees</Typography>
              <Typography variant="h6">{money(me.total_fees)}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Paid</Typography>
              <Typography variant="h6" color="success.main">{money(me.fees_paid)}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Balance</Typography>
              <Typography variant="h6" color={me.balance_owing > 0 ? 'warning.main' : 'success.main'}>
                {money(me.balance_owing)}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {me.courses && me.courses.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography fontWeight={600} sx={{ mb: 1 }}>Registered Courses</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell><TableCell>Course</TableCell><TableCell>Credit Hours</TableCell><TableCell>Period</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {me.courses.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>{c.course_code}</TableCell>
                  <TableCell>{c.course_name}</TableCell>
                  <TableCell>{c.credit_hours || '—'}</TableCell>
                  <TableCell>{[c.academic_year, c.semester].filter(Boolean).join(' · ') || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>Results</Typography>
        {me.results.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No results have been published yet. Results appear here once your Examinations Officer publishes them.
          </Typography>
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
              </TableRow>
            </TableHead>
            <TableBody>
              {me.results.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.course_name}</TableCell>
                  <TableCell>{[r.academic_year, r.semester].filter(Boolean).join(' · ') || '—'}</TableCell>
                  <TableCell align="center">{r.ca_total ?? '—'}</TableCell>
                  <TableCell align="center">{r.exam_score ?? '—'}</TableCell>
                  <TableCell align="center">{r.final_mark ?? '—'}</TableCell>
                  <TableCell align="center"><Chip size="small" label={r.grade || '—'} color="success" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>Payment History</Typography>
        {me.payments.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No payments recorded yet.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Receipt No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Method</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {me.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.receipt_no}</TableCell>
                  <TableCell>{p.payment_date}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell align="right">{money(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}

import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, Chip, Table, TableHead, TableRow, TableCell, TableBody, Button, Alert } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import SchoolIcon from '@mui/icons-material/School';
import api from '../api';
import { openPdf } from '../pdf';

const money = (n) => `K${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function StudentPortal() {
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
  const caResults = me.results.filter((r) => r.type === 'CA');
  const examResults = me.results.filter((r) => r.type === 'Exam');

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

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>Continuous Assessment Marks</Typography>
        {caResults.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No CA marks recorded yet.</Typography>
        ) : (
          <ResultsTable rows={caResults} />
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>Examination Results</Typography>
        {examResults.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No examination results recorded yet.</Typography>
        ) : (
          <ResultsTable rows={examResults} />
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Results marked "Pending approval" are not yet final and may still change.
        </Typography>
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

function ResultsTable({ rows }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Course</TableCell>
          <TableCell>Academic Year</TableCell>
          <TableCell>Semester</TableCell>
          <TableCell align="center">Score</TableCell>
          <TableCell align="center">Grade</TableCell>
          <TableCell>Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.course_name}</TableCell>
            <TableCell>{r.academic_year || '—'}</TableCell>
            <TableCell>{r.semester || '—'}</TableCell>
            <TableCell align="center">{r.score ?? '—'}</TableCell>
            <TableCell align="center">{r.grade || '—'}</TableCell>
            <TableCell>
              <Chip
                size="small"
                label={r.status === 'Approved' ? 'Final' : 'Pending approval'}
                color={r.status === 'Approved' ? 'success' : 'default'}
                variant={r.status === 'Approved' ? 'filled' : 'outlined'}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

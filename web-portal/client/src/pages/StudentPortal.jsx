import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Chip, Table, TableHead, TableRow, TableCell, TableBody,
  AppBar, Toolbar, Button, Container, Alert,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import api from '../api';

const money = (n) => `K${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function StudentPortal() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('portal_token')) {
      navigate('/login');
      return;
    }
    api.get('/students/me')
      .then((res) => setMe(res.data))
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('portal_token');
          navigate('/login');
        } else {
          setError(err.response?.data?.error || 'Unable to load your record.');
        }
      });
  }, [navigate]);

  function logout() {
    localStorage.removeItem('portal_token');
    navigate('/login');
  }

  if (error) return <Container sx={{ mt: 4 }}><Alert severity="warning">{error}</Alert></Container>;
  if (!me) return <Container sx={{ mt: 4 }}><Typography>Loading…</Typography></Container>;

  const studentName = [me.first_name, me.middle_name, me.surname].filter(Boolean).join(' ');

  return (
    <Box>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>Student Portal</Typography>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={logout}>Sign out</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Typography variant="h5" fontWeight={700}>{studentName}</Typography>
              <Typography color="text.secondary">{me.student_id} · {me.program || 'No programme set'}</Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Chip label={me.status} size="small" color="primary" />
                <Chip label={`Expected graduation: ${me.year_of_graduation || '—'}`} size="small" variant="outlined" />
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
          <Typography fontWeight={600} sx={{ mb: 1 }}>Results</Typography>
          {me.results.length === 0 ? (
            <Typography color="text.secondary" variant="body2">No results published yet.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Course</TableCell><TableCell>Period</TableCell>
                  <TableCell align="center">CA</TableCell><TableCell align="center">Exam</TableCell>
                  <TableCell align="center">Final</TableCell><TableCell align="center">Grade</TableCell>
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
                    <TableCell align="center"><Chip size="small" color="success" label={r.grade || '—'} /></TableCell>
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
                <TableRow><TableCell>Receipt No.</TableCell><TableCell>Date</TableCell><TableCell>Method</TableCell><TableCell align="right">Amount</TableCell></TableRow>
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
      </Container>
    </Box>
  );
}

import React, { useEffect, useState } from 'react';
import { Grid, Paper, Typography, Box, List, ListItem, ListItemText, Chip } from '@mui/material';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../api';
import { useCurrency } from '../SettingsContext.jsx';

const COLORS = ['#0b5d3b', '#c9a227', '#2e7d32', '#8d6e63', '#5c6bc0', '#00838f'];

function StatCard({ label, value, sub }) {
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  );
}

const formatMoney = (n, cur) => `${cur}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function Dashboard() {
  const cur = useCurrency();
  const money = (n) => formatMoney(n, cur);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((res) => setStats(res.data));
  }, []);

  if (!stats) return <Typography>Loading dashboard…</Typography>;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Dashboard</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Total Students" value={stats.totalStudents} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Academic Staff" value={stats.totalStaff} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Fees Collected" value={money(stats.totalPaid)} sub={`of ${money(stats.totalFees)} billed`} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Balance Outstanding" value={money(stats.totalOwing)} />
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, height: 340 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>Students by Program</Typography>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie data={stats.byProgram} dataKey="count" nameKey="program" outerRadius={100} label>
                  {stats.byProgram.map((entry, i) => (
                    <Cell key={entry.program} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, height: 340 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>Academic Staff by Department</Typography>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={stats.staffByDept} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="department" width={160} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0b5d3b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2.5 }}>
            <Typography fontWeight={600} sx={{ mb: 1 }}>Recent Payments</Typography>
            {stats.recentPayments.length === 0 ? (
              <Typography color="text.secondary" variant="body2">No payments recorded yet.</Typography>
            ) : (
              <List dense>
                {stats.recentPayments.map((p) => (
                  <ListItem key={p.id} secondaryAction={<Chip label={money(p.amount)} color="primary" size="small" />}>
                    <ListItemText
                      primary={`${p.first_name} ${p.surname} (${p.student_number})`}
                      secondary={`${p.receipt_no} · ${p.payment_date}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

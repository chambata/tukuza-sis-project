import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';
import api from '../api';

const money = (n) => `K${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function Finance() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get('/payments').then((res) => setRows(res.data));
  }, []);

  const totalCollected = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Finance — Payments</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Showing latest {rows.length} payments · Total shown: {money(totalCollected)}
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

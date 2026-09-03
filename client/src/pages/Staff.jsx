import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Paper, InputAdornment, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import api from '../api';

export default function Staff() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    api.get('/staff', { params: { search } }).then((res) => setRows(res.data));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Academic Staff</Typography>
      <TextField
        placeholder="Search by name, email or NRC…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 2, width: 360 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Rank</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Employment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{[r.title, r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ')}</TableCell>
                <TableCell>
                  {r.department_name ? <Chip size="small" label={r.department_name.replace(' DEPARTMENT', '')} /> : '—'}
                </TableCell>
                <TableCell>{r.academic_rank || '—'}</TableCell>
                <TableCell>{r.email || '—'}</TableCell>
                <TableCell>{r.phone_number || '—'}</TableCell>
                <TableCell>{r.mode_of_employment || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

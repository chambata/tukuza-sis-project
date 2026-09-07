import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Chip } from '@mui/material';
import api from '../api';

const ACTION_COLORS = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'error',
  LOGIN: 'default',
  BACKUP: 'secondary',
  PRINT: 'warning',
  DOWNLOAD: 'warning',
};

export default function AuditLog() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get('/audit?limit=200').then((res) => setRows(res.data));
  }, []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Audit Log</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Most recent {rows.length} actions.</Typography>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.username}</TableCell>
                <TableCell><Chip size="small" label={r.action} color={ACTION_COLORS[r.action] || 'default'} /></TableCell>
                <TableCell>{r.entity}{r.entity_id ? ` #${r.entity_id}` : ''}</TableCell>
                <TableCell sx={{ maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.details || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

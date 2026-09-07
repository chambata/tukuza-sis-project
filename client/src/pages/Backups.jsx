import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, IconButton, Alert,
} from '@mui/material';
import BackupIcon from '@mui/icons-material/Backup';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api';
import { useAuth } from '../AuthContext.jsx';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Backups() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/backups').then((res) => setRows(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createBackup() {
    setBusy(true);
    setMessage('');
    try {
      const res = await api.post('/backups');
      setMessage(`Backup created: ${res.data.filename}`);
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Backup failed');
    } finally {
      setBusy(false);
    }
  }

  async function download(filename) {
    const res = await api.get(`/backups/${encodeURIComponent(filename)}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  async function remove(filename) {
    await api.delete(`/backups/${encodeURIComponent(filename)}`);
    load();
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Database Backups</Typography>
        <Button variant="contained" startIcon={<BackupIcon />} onClick={createBackup} disabled={busy}>
          {busy ? 'Backing up…' : 'Backup Now'}
        </Button>
      </Box>

      {message && <Alert severity="info" sx={{ mb: 2 }}>{message}</Alert>}

      <Alert severity="warning" sx={{ mb: 2 }}>
        Backups are stored on this machine only, alongside the live database. For real
        protection, periodically copy the downloaded files to a separate drive or
        cloud storage — a local backup won't survive a hardware failure.
      </Alert>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Filename</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Size</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4}><Typography color="text.secondary" variant="body2">No backups yet.</Typography></TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.filename} hover>
                <TableCell>{r.filename}</TableCell>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{formatSize(r.size)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => download(r.filename)}><DownloadIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => remove(r.filename)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

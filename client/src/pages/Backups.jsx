import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, IconButton, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import BackupIcon from '@mui/icons-material/Backup';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import SyncIcon from '@mui/icons-material/Sync';
import RestoreIcon from '@mui/icons-material/Restore';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import api from '../api';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Backups() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [secondaryFolder, setSecondaryFolder] = useState(null);
  const [syncBusy, setSyncBusy] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState(null); // { filename } or { upload: File }
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  const load = useCallback(() => {
    api.get('/backups').then((res) => setRows(res.data));
    api.get('/backups/settings/secondary-folder').then((res) => setSecondaryFolder(res.data.folder));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createBackup() {
    setBusy(true);
    setMessage('');
    try {
      const res = await api.post('/backups');
      setMessage(
        res.data.mirrored
          ? `Backup created and copied to your secondary folder: ${res.data.filename}`
          : `Backup created: ${res.data.filename}`
      );
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

  async function chooseFolder() {
    if (!window.tukuzaSIS?.chooseBackupFolder) {
      setMessage('Folder picker is only available inside the desktop app.');
      return;
    }
    const folder = await window.tukuzaSIS.chooseBackupFolder();
    if (!folder) return;
    await api.put('/backups/settings/secondary-folder', { folder });
    setSecondaryFolder(folder);
    setMessage(`Backups will now also be copied to: ${folder}`);
  }

  async function clearFolder() {
    await api.put('/backups/settings/secondary-folder', { folder: null });
    setSecondaryFolder(null);
  }

  async function syncNow() {
    setSyncBusy(true);
    setMessage('');
    try {
      const res = await api.post('/backups/settings/secondary-folder/sync-now');
      setMessage(`Copied ${res.data.copied} backup(s) to the secondary folder.`);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncBusy(false);
    }
  }

  function handleUploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setRestoreTarget({ upload: file });
    setConfirmText('');
    setRestoreError('');
  }

  async function doRestore() {
    setRestoring(true);
    setRestoreError('');
    try {
      if (restoreTarget.filename) {
        await api.post(`/backups/${encodeURIComponent(restoreTarget.filename)}/restore`);
      } else {
        const file = restoreTarget.upload;
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await api.post('/backups/upload-restore', { filename: file.name, data: dataUrl });
      }
      setRestoreTarget(null);
      setMessage('Restore complete — the app is restarting now. If the window does not reload automatically in a few seconds, close and reopen it.');
    } catch (err) {
      setRestoreError(err.response?.data?.error || 'Restore failed');
      setRestoring(false);
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Database Backups</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
            Restore from File
            <input type="file" hidden accept=".db" onChange={handleUploadFile} />
          </Button>
          <Button variant="contained" startIcon={<BackupIcon />} onClick={createBackup} disabled={busy}>
            {busy ? 'Backing up…' : 'Backup Now'}
          </Button>
        </Box>
      </Box>

      {message && <Alert severity="info" sx={{ mb: 2 }}>{message}</Alert>}

      <Paper sx={{ p: 2.5, mb: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1 }}>Offsite / Cloud Copy</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Point this at a folder synced by OneDrive, Google Drive, Dropbox, or similar,
          and every backup — manual or automatic — is copied there too. This is the
          real protection against a hardware failure; local backups alone are not.
        </Typography>
        {secondaryFolder ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <FolderIcon fontSize="small" color="action" />
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{secondaryFolder}</Typography>
            <Button size="small" onClick={chooseFolder}>Change</Button>
            <Button size="small" onClick={clearFolder}>Turn off</Button>
            <Button size="small" startIcon={<SyncIcon />} onClick={syncNow} disabled={syncBusy}>
              {syncBusy ? 'Syncing…' : 'Copy existing backups now'}
            </Button>
          </Box>
        ) : (
          <Button variant="outlined" size="small" startIcon={<FolderIcon />} onClick={chooseFolder}>
            Choose Folder
          </Button>
        )}
      </Paper>

      <Alert severity="info" sx={{ mb: 2 }}>
        The app also backs up automatically once a day while it's open, in addition
        to anything you trigger manually here.
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
                  <IconButton size="small" title="Restore from this backup"
                    onClick={() => { setRestoreTarget({ filename: r.filename }); setConfirmText(''); setRestoreError(''); }}>
                    <RestoreIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => download(r.filename)}><DownloadIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => remove(r.filename)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!restoreTarget} onClose={() => !restoring && setRestoreTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Restore Database</DialogTitle>
        <DialogContent>
          {restoreError && <Alert severity="error" sx={{ mb: 2 }}>{restoreError}</Alert>}
          <Alert severity="warning" sx={{ mb: 2 }}>
            This replaces <strong>everything currently in the app</strong> — students, staff,
            payments, results, everything — with the contents of{' '}
            <strong>{restoreTarget?.filename || restoreTarget?.upload?.name}</strong>.
            A safety backup of the current data is taken automatically first, but this
            action cannot be undone from within the app. The app will restart afterward.
          </Alert>
          <TextField
            label='Type "RESTORE" to confirm' fullWidth value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreTarget(null)} disabled={restoring}>Cancel</Button>
          <Button
            variant="contained" color="error" disabled={confirmText !== 'RESTORE' || restoring}
            onClick={doRestore}
          >
            {restoring ? 'Restoring…' : 'Restore and Restart'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

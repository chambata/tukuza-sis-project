import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Typography, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Paper, TablePagination, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, MenuItem, Chip, IconButton, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import api from '../api';
import { openPdf } from '../pdf';
import { useAuth } from '../AuthContext.jsx';
import { STUDENT_WRITE_ROLES } from '../roles.js';
import { useCurrency } from '../SettingsContext.jsx';

const emptyForm = {
  first_name: '', middle_name: '', surname: '', gender: '', student_id: '', nrc_no: '',
  total_fees: 0, fees_paid: 0, year_of_graduation: '', program: '', status: 'Active',
};

const formatMoney = (n, cur) => `${cur}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function Students() {
  const cur = useCurrency();
  const money = (n) => formatMoney(n, cur);
  const { user } = useAuth();
  const canWrite = STUDENT_WRITE_ROLES.includes(user?.role);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [programs, setPrograms] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const load = useCallback(() => {
    api.get('/students', { params: { search, page: page + 1, pageSize } }).then((res) => {
      setRows(res.data.data);
      setTotal(res.data.total);
    });
  }, [search, page, pageSize]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/programmes').then((res) => setPrograms(res.data)); }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setDialogOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({ ...row });
    setError('');
    setDialogOpen(true);
  }

  async function handleSave() {
    setError('');
    try {
      if (editingId) {
        await api.put(`/students/${editingId}`, form);
      } else {
        await api.post('/students', form);
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save student');
    }
  }

  function openImport() {
    setImportPreview(null);
    setImportResult(null);
    setImportError('');
    setImportOpen(true);
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportError('');
    setImportBusy(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post('/students/import-preview', { data: dataUrl });
      setImportPreview(res.data);
    } catch (err) {
      setImportError(err.response?.data?.error || 'Failed to read this file');
    } finally {
      setImportBusy(false);
    }
  }

  async function commitImport() {
    setImportBusy(true);
    setImportError('');
    try {
      const res = await api.post('/students/import-commit', { rows: importPreview.rows });
      setImportResult(res.data);
      setImportPreview(null);
      load();
    } catch (err) {
      setImportError(err.response?.data?.error || 'Import failed');
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Students</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={() => openPdf(`/students/report.pdf?search=${encodeURIComponent(search)}`, 'students-report.pdf')}
          >
            Export Report
          </Button>
          <Button
            variant="outlined"
            startIcon={<DescriptionIcon />}
            component="a"
            href={undefined}
            onClick={async () => {
              const res = await api.get('/students/export.xlsx', { responseType: 'blob' });
              const url = window.URL.createObjectURL(new Blob([res.data]));
              const a = document.createElement('a');
              a.href = url; a.download = 'students-export.xlsx';
              document.body.appendChild(a); a.click(); a.remove();
              window.URL.revokeObjectURL(url);
            }}
          >
            Export Excel
          </Button>
          {canWrite && (
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={openImport}>
              Import
            </Button>
          )}
          {canWrite && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
              Add Student
            </Button>
          )}
        </Box>
      </Box>

      <TextField
        placeholder="Search by name, student ID or NRC…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        size="small"
        sx={{ mb: 2, width: 360 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Student ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Gender</TableCell>
              <TableCell>Program</TableCell>
              <TableCell>Graduation</TableCell>
              <TableCell align="right">Fees Paid</TableCell>
              <TableCell align="right">Balance</TableCell>
              <TableCell>Status</TableCell>
              {canWrite && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>
                  <Typography component={Link} to={`/students/${r.id}`} sx={{ color: 'primary.main', textDecoration: 'none', fontWeight: 600 }}>
                    {r.student_id}
                  </Typography>
                </TableCell>
                <TableCell>{[r.first_name, r.middle_name, r.surname].filter(Boolean).join(' ')}</TableCell>
                <TableCell>{r.gender || '—'}</TableCell>
                <TableCell>{r.program || '—'}</TableCell>
                <TableCell>{r.year_of_graduation || '—'}</TableCell>
                <TableCell align="right">{money(r.fees_paid)}</TableCell>
                <TableCell align="right">
                  <Chip
                    size="small"
                    label={money(r.balance_owing)}
                    color={r.balance_owing > 0 ? 'warning' : 'success'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{r.status}</TableCell>
                {canWrite && (
                  <TableCell>
                    <IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(e, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Student' : 'Add Student'}</DialogTitle>
        <DialogContent>
          {error && <Typography color="error" variant="body2" sx={{ mb: 1 }}>{error}</Typography>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <TextField label="First Name" fullWidth value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Middle Name" fullWidth value={form.middle_name || ''}
                onChange={(e) => setForm({ ...form, middle_name: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Surname" fullWidth value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Gender" fullWidth value={form.gender || ''}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Student ID" fullWidth value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="NRC No." fullWidth value={form.nrc_no || ''}
                onChange={(e) => setForm({ ...form, nrc_no: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Programme" fullWidth value={form.program || ''}
                onChange={(e) => setForm({ ...form, program: e.target.value })}>
                {programs.map((p) => <MenuItem key={p.id} value={p.name}>{p.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Year of Graduation" fullWidth value={form.year_of_graduation || ''}
                onChange={(e) => setForm({ ...form, year_of_graduation: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Total Fees (K)" type="number" fullWidth value={form.total_fees}
                onChange={(e) => setForm({ ...form, total_fees: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Fees Paid (K)" type="number" fullWidth value={form.fees_paid}
                onChange={(e) => setForm({ ...form, fees_paid: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Status" fullWidth value={form.status || 'Active'}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['Active', 'Graduated', 'Deferred', 'Withdrawn', 'Suspended', 'Completed'].map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Students from Excel/CSV</DialogTitle>
        <DialogContent>
          {importError && <Typography color="error" variant="body2" sx={{ mb: 1 }}>{importError}</Typography>}
          {importResult ? (
            <Typography>
              Imported {importResult.imported} student{importResult.imported === 1 ? '' : 's'}.
              {importResult.skipped > 0 && ` Skipped ${importResult.skipped} row(s) with errors or duplicates.`}
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Expects columns like First Name, Surname, Student ID, NRC, Programme, Total Fees, Fees Paid
                (column names are matched flexibly — exact order doesn't matter).
              </Typography>
              <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={importBusy}>
                {importBusy ? 'Reading…' : 'Choose File'}
                <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleImportFile} />
              </Button>

              {importPreview && (
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ mb: 1 }}>
                    {importPreview.summary.valid} of {importPreview.summary.total} row(s) are ready to import.
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Row</TableCell><TableCell>Name</TableCell><TableCell>Student ID</TableCell><TableCell>Issues</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importPreview.rows.map((r) => (
                        <TableRow key={r.row} sx={{ opacity: r.valid ? 1 : 0.6 }}>
                          <TableCell>{r.row}</TableCell>
                          <TableCell>{[r.first_name, r.surname].filter(Boolean).join(' ')}</TableCell>
                          <TableCell>{r.student_id}</TableCell>
                          <TableCell>
                            {r.valid ? <Chip size="small" color="success" label="OK" /> : r.errors.map((e, i) => (
                              <Chip key={i} size="small" color="warning" label={e} sx={{ mr: 0.5, mb: 0.5 }} />
                            ))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>{importResult ? 'Close' : 'Cancel'}</Button>
          {importPreview && !importResult && (
            <Button variant="contained" onClick={commitImport} disabled={importBusy || importPreview.summary.valid === 0}>
              Import {importPreview.summary.valid} Student{importPreview.summary.valid === 1 ? '' : 's'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

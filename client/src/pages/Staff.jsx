import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, TextField, Table, TableHead, TableRow, TableCell, TableBody,
  Paper, InputAdornment, Chip, Button, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api';
import { useAuth } from '../AuthContext.jsx';
import { DEPARTMENT_WRITE_ROLES } from '../roles.js';

const emptyForm = {
  title: '', first_name: '', middle_name: '', last_name: '', gender: '', dob: '',
  nrc_number: '', passport_no: '', nationality: '', email: '', phone_number: '',
  postal_address: '', disability: '', academic_rank: '', position: '', date_employed: '',
  highest_level_of_study: '', field_of_study: '', mode_of_employment: '', department_id: '',
};

export default function Staff() {
  const { user } = useAuth();
  const canWrite = DEPARTMENT_WRITE_ROLES.includes(user?.role);
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/staff', { params: { search } }).then((res) => setRows(res.data));
  }, [search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/departments').then((res) => setDepartments(res.data)); }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      title: row.title || '', first_name: row.first_name || '', middle_name: row.middle_name || '',
      last_name: row.last_name || '', gender: row.gender || '', dob: row.dob || '',
      nrc_number: row.nrc_number || '', passport_no: row.passport_no || '', nationality: row.nationality || '',
      email: row.email || '', phone_number: row.phone_number || '', postal_address: row.postal_address || '',
      disability: row.disability || '', academic_rank: row.academic_rank || '', position: row.position || '',
      date_employed: row.date_employed || '', highest_level_of_study: row.highest_level_of_study || '',
      field_of_study: row.field_of_study || '', mode_of_employment: row.mode_of_employment || '',
      department_id: row.department_id || '',
    });
    setError('');
    setOpen(true);
  }

  async function save() {
    setError('');
    try {
      if (editingId) {
        await api.put(`/staff/${editingId}`, form);
      } else {
        await api.post('/staff', form);
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save staff member');
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete ${row.first_name} ${row.last_name}?`)) return;
    try {
      await api.delete(`/staff/${row.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete staff member');
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Academic Staff</Typography>
        {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add Staff</Button>}
      </Box>
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
              {canWrite && <TableCell align="right">Actions</TableCell>}
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
                {canWrite && (
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => remove(r)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingId ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, mt: 1 }}>
            <TextField label="Title (Mr/Mrs/Dr...)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <TextField label="First Name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <TextField label="Middle Name" value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} />
            <TextField label="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            <TextField select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <MenuItem value="Male">Male</MenuItem>
              <MenuItem value="Female">Female</MenuItem>
            </TextField>
            <TextField label="Date of Birth" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField label="NRC Number" value={form.nrc_number} onChange={(e) => setForm({ ...form, nrc_number: e.target.value })} />
            <TextField label="Passport No." value={form.passport_no} onChange={(e) => setForm({ ...form, passport_no: e.target.value })} />
            <TextField label="Nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
            <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField label="Phone Number" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            <TextField label="Postal Address" value={form.postal_address} onChange={(e) => setForm({ ...form, postal_address: e.target.value })} />
            <TextField label="Disability" value={form.disability} onChange={(e) => setForm({ ...form, disability: e.target.value })} />
            <TextField select label="Department" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
            <TextField label="Position" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="Lecturer, Accountant, Registrar..." />
            <TextField label="Academic Rank" value={form.academic_rank} onChange={(e) => setForm({ ...form, academic_rank: e.target.value })} />
            <TextField label="Date Employed" type="date" value={form.date_employed} onChange={(e) => setForm({ ...form, date_employed: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField label="Mode of Employment" value={form.mode_of_employment} onChange={(e) => setForm({ ...form, mode_of_employment: e.target.value })}
              placeholder="Full-time, Part-time..." />
            <TextField label="Highest Level of Study" value={form.highest_level_of_study} onChange={(e) => setForm({ ...form, highest_level_of_study: e.target.value })} />
            <TextField label="Field of Study" value={form.field_of_study} onChange={(e) => setForm({ ...form, field_of_study: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

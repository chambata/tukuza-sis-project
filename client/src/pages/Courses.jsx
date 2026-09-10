import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../api';
import { useAuth } from '../AuthContext.jsx';
import { COURSE_WRITE_ROLES } from '../roles.js';

const emptyForm = { course_code: '', course_name: '', programme_id: '', year_of_study: '', semester: '', credit_hours: '', lecturer_user_id: '', status: 'Active' };

export default function Courses() {
  const { user } = useAuth();
  const canWrite = COURSE_WRITE_ROLES.includes(user?.role);
  const [rows, setRows] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/courses').then((res) => setRows(res.data));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/programmes').then((res) => setProgrammes(res.data));
    api.get('/users').then((res) => setLecturers(res.data.filter((u) => u.role === 'Lecturer'))).catch(() => {});
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setForm({
      course_code: row.course_code, course_name: row.course_name,
      programme_id: row.programme_id || '', year_of_study: row.year_of_study || '',
      semester: row.semester || '', credit_hours: row.credit_hours || '',
      lecturer_user_id: row.lecturer_user_id || '', status: row.status,
    });
    setError('');
    setOpen(true);
  }

  async function save() {
    setError('');
    try {
      if (editingId) {
        await api.put(`/courses/${editingId}`, form);
      } else {
        await api.post('/courses', form);
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save course');
    }
  }

  async function remove(row) {
    if (!window.confirm(`Delete course ${row.course_code}?`)) return;
    try {
      await api.delete(`/courses/${row.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete course');
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Courses</Typography>
        {canWrite && <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add Course</Button>}
      </Box>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Programme</TableCell>
              <TableCell>Year / Semester</TableCell>
              <TableCell>Credit Hours</TableCell>
              <TableCell>Lecturer</TableCell>
              <TableCell>Status</TableCell>
              {canWrite && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8}><Typography color="text.secondary" variant="body2">No courses yet.</Typography></TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.course_code}</TableCell>
                <TableCell>{r.course_name}</TableCell>
                <TableCell>{r.programme_name || '—'}</TableCell>
                <TableCell>{[r.year_of_study && `Year ${r.year_of_study}`, r.semester].filter(Boolean).join(' · ') || '—'}</TableCell>
                <TableCell>{r.credit_hours || '—'}</TableCell>
                <TableCell>{r.lecturer_name || '—'}</TableCell>
                <TableCell><Chip size="small" label={r.status} color={r.status === 'Active' ? 'success' : 'default'} /></TableCell>
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

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Course' : 'Add Course'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField label="Course Code" value={form.course_code} onChange={(e) => setForm({ ...form, course_code: e.target.value })} />
            <TextField label="Course Name" value={form.course_name} onChange={(e) => setForm({ ...form, course_name: e.target.value })} />
            <TextField select label="Programme" value={form.programme_id} onChange={(e) => setForm({ ...form, programme_id: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {programmes.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
            <TextField select label="Lecturer" value={form.lecturer_user_id} onChange={(e) => setForm({ ...form, lecturer_user_id: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {lecturers.map((l) => <MenuItem key={l.id} value={l.id}>{l.full_name || l.username}</MenuItem>)}
            </TextField>
            <TextField label="Year of Study" type="number" value={form.year_of_study} onChange={(e) => setForm({ ...form, year_of_study: e.target.value })} />
            <TextField select label="Semester" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
              {['Semester 1', 'Semester 2', 'Full Year'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <TextField label="Credit Hours" type="number" value={form.credit_hours} onChange={(e) => setForm({ ...form, credit_hours: e.target.value })} />
            <TextField select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </TextField>
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

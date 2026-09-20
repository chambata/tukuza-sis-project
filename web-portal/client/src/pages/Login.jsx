import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Alert, Stack } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('portal_token', data.token);
      navigate('/portal');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundImage: 'linear-gradient(135deg, #0b5d3b 0%, #094a30 100%)',
    }}>
      <Paper elevation={6} sx={{ p: 4, width: 380 }}>
        <Stack alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <SchoolIcon color="primary" sx={{ fontSize: 44 }} />
          <Typography variant="h5" fontWeight={700}>Student Portal</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Sign in with your Student ID and password
          </Typography>
        </Stack>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Student ID" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus fullWidth />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
            <Button type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </form>
        <Button component={Link} to="/" startIcon={<ArrowBackIcon />} sx={{ mt: 2 }} size="small">
          Back to homepage
        </Button>
      </Paper>
    </Box>
  );
}

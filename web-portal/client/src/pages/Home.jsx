import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Chip, Button, AppBar, Toolbar, Container, Avatar,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import CampaignIcon from '@mui/icons-material/Campaign';
import LoginIcon from '@mui/icons-material/Login';
import api from '../api';

export default function Home() {
  const [programmes, setProgrammes] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [settings, setSettings] = useState({ institution_name: 'Tukuza SIS' });

  useEffect(() => {
    api.get('/public/programmes').then((res) => setProgrammes(res.data));
    api.get('/public/announcements').then((res) => setAnnouncements(res.data));
    api.get('/public/settings').then((res) => setSettings(res.data));
  }, []);

  return (
    <Box>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          {settings.institution_logo && (
            <Avatar src={settings.institution_logo} variant="rounded" sx={{ mr: 1.5 }} />
          )}
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            {settings.institution_name || 'Student Portal'}
          </Typography>
          <Button component={Link} to="/login" color="inherit" startIcon={<LoginIcon />}>
            Student Login
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 2.5, mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CampaignIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>Announcements</Typography>
          </Box>
          {announcements.length === 0 ? (
            <Typography color="text.secondary" variant="body2">No announcements right now.</Typography>
          ) : (
            announcements.map((a) => (
              <Box key={a.id} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { border: 0 } }}>
                <Typography fontWeight={600}>{a.title}</Typography>
                <Typography variant="body2" color="text.secondary">{a.message}</Typography>
                <Typography variant="caption" color="text.secondary">{new Date(a.created_at).toLocaleDateString()}</Typography>
              </Box>
            ))
          )}
        </Paper>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SchoolIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>Programmes</Typography>
        </Box>
        <Grid container spacing={2}>
          {programmes.length === 0 && (
            <Grid item xs={12}><Typography color="text.secondary">No programmes published yet.</Typography></Grid>
          )}
          {programmes.map((p) => (
            <Grid item xs={12} sm={6} md={4} key={p.id}>
              <Paper sx={{ p: 2.5, height: '100%' }}>
                <Typography fontWeight={700}>{p.name}</Typography>
                {p.code && <Chip size="small" label={p.code} sx={{ mt: 0.5, mb: 1 }} />}
                {p.description && <Typography variant="body2" color="text.secondary">{p.description}</Typography>}
                {p.duration_years && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Duration: {p.duration_years} year{p.duration_years === 1 ? '' : 's'}
                  </Typography>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

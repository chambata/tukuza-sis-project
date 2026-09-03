import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import App from './App.jsx';
import { AuthProvider } from './AuthContext.jsx';

const theme = createTheme({
  palette: {
    primary: { main: '#0b5d3b' }, // deep green — FPC brand-adjacent
    secondary: { main: '#c9a227' }, // gold accent
    background: { default: '#f4f6f5' },
  },
  shape: { borderRadius: 10 },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>
);

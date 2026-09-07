import axios from 'axios';

// The Electron main process always starts the embedded API server on this
// port (see server/index.js / electron/main.js). In development, Vite's dev
// server would otherwise proxy a relative "/api" to it — but the *packaged*
// app loads its HTML via file://, where a relative path resolves to nothing,
// silently breaking every request (including login). Using an absolute URL
// works in both dev and production, and CORS is already enabled server-side.
const API_BASE_URL = 'http://localhost:4000/api';

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tukuza_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('tukuza_token');
      localStorage.removeItem('tukuza_user');
      if (!window.location.hash.includes('/login')) {
        window.location.hash = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;


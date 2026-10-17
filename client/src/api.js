import axios from 'axios';

// Where the API lives depends on how this page was loaded:
//  - file:// (the packaged Electron app): a relative "/api" resolves to
//    nothing, so use the embedded server's absolute localhost address.
//  - http(s):// served by the Express server itself (e.g. a browser reaching
//    it through a Cloudflare Tunnel at https://sis.example.com): the page and
//    the API are the same origin, so a relative "/api" is correct — and using
//    localhost here would point at the *visitor's own machine*, not the server.
//  - The Vite dev server (localhost:5173): same as file://, absolute URL,
//    since Vite's proxy isn't relied on.
const isFileProtocol = window.location.protocol === 'file:';
const isViteDev = window.location.port === '5173';
const API_BASE_URL = (isFileProtocol || isViteDev) ? 'http://127.0.0.1:4000/api' : '/api';

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

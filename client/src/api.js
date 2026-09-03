import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

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

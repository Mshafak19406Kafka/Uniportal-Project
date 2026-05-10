import axios from 'axios';

const api = axios.create({
  baseURL: window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api',
  timeout: 120000, // 2 minutes timeout for large video uploads
  maxContentLength: 150 * 1024 * 1024, // 150MB
  maxBodyLength: 150 * 1024 * 1024, // 150MB
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

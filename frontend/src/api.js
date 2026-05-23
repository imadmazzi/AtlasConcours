import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('atlas_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Force bypassing of any browser or edge cache
  if (config.method === 'get') {
    config.params = {
      ...config.params,
      _t: new Date().getTime()
    };
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.headers['Expires'] = '0';
  }
  
  return config;
});

export default api;

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Global loading handler
let loadingCount = 0;
const showGlobalLoader = () => {
  loadingCount++;
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.style.display = 'flex';
  }
};

const hideGlobalLoader = () => {
  loadingCount--;
  if (loadingCount <= 0) {
    loadingCount = 0;
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.style.display = 'none';
    }
  }
};

// Add loading interceptors
api.interceptors.request.use(
  (config) => {
    if (config.showLoading !== false) {
      //showGlobalLoader();
    }
    return config;
  },
  (error) => {
    hideGlobalLoader();
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (response.config.showLoading !== false) {
      hideGlobalLoader();
    }
    return response;
  },
  (error) => {
    if (error.config?.showLoading !== false) {
      hideGlobalLoader();
    }
    return Promise.reject(error);
  }
);

export default api;

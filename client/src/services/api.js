import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('fg_token');
      localStorage.removeItem('fg_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// Transactions
export const transactionsAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  recalculate: (id) => api.post(`/transactions/${id}/recalculate-risk`),
};

// Cases
export const casesAPI = {
  getAll: (params) => api.get('/cases', { params }),
  getById: (id) => api.get(`/cases/${id}`),
  create: (data) => api.post('/cases', data),
  updateStatus: (id, data) => api.put(`/cases/${id}/status`, data),
  assign: (id, data) => api.put(`/cases/${id}/assign`, data),
  addNote: (id, data) => api.post(`/cases/${id}/notes`, data),
  generateSummary: (id) => api.post(`/cases/${id}/generate-summary`),
};

// Analytics
export const analyticsAPI = {
  summary: () => api.get('/analytics/summary'),
  riskLevels: () => api.get('/analytics/risk-levels'),
  flaggedByDay: () => api.get('/analytics/flagged-by-day'),
  casesByStatus: () => api.get('/analytics/cases-by-status'),
  highRiskMerchants: () => api.get('/analytics/high-risk-merchants'),
  volumeByHour: () => api.get('/analytics/volume-by-hour'),
  avgRiskByCategory: () => api.get('/analytics/avg-risk-by-category'),
};

// Audit
export const auditAPI = {
  getLogs: (params) => api.get('/audit-logs', { params }),
};

// Users
export const usersAPI = {
  getAnalysts: () => api.get('/users/analysts'),
};

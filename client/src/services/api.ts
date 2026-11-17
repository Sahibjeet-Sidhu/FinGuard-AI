import axios, { type AxiosError } from 'axios';
import type {
  Analyst, AnalyticsSummary, AuditLog, CasePriority, CaseStatus, CategoryRisk, DailyCount, FraudCase,
  FraudCaseDetail, HourlyVolume, LoginResponse, MerchantRisk, NamedCount, Paginated, QueryParams,
  RiskLevel, RiskRecalculation, Role, Transaction, TransactionDetail, User,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  res => res,
  (err: AxiosError) => {
    // A 401 from the login form just means wrong credentials: the page shows
    // that message itself. Any other 401 means the session is no longer valid.
    const isLoginAttempt = err.config?.url?.endsWith('/auth/login');
    if (err.response?.status === 401 && !isLoginAttempt) {
      localStorage.removeItem('fg_token');
      localStorage.removeItem('fg_user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

/** The server's error message for a failed request, or the fallback if there is none. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string }>(err)) {
    return err.response?.data?.error || fallback;
  }
  return fallback;
}

type Id = number | string;

// Auth
export const authAPI = {
  login: (data: { email: string; password: string }) => api.post<LoginResponse>('/auth/login', data),
  register: (data: { name: string; email: string; password: string; role?: Role }) =>
    api.post<{ message: string }>('/auth/register', data),
  me: () => api.get<User & { created_at: string }>('/auth/me'),
};

// Transactions
export const transactionsAPI = {
  getAll: (params?: QueryParams) => api.get<Paginated<Transaction>>('/transactions', { params }),
  getById: (id: Id) => api.get<TransactionDetail>(`/transactions/${id}`),
  recalculate: (id: Id) => api.post<RiskRecalculation>(`/transactions/${id}/recalculate-risk`),
};

// Cases
export const casesAPI = {
  getAll: (params?: QueryParams) => api.get<Paginated<FraudCase>>('/cases', { params }),
  getById: (id: Id) => api.get<FraudCaseDetail>(`/cases/${id}`),
  create: (data: { transaction_id: number; priority?: CasePriority }) =>
    api.post<{ id: number; message: string }>('/cases', data),
  updateStatus: (id: Id, data: { status: CaseStatus; resolution?: string }) =>
    api.put<{ message: string }>(`/cases/${id}/status`, data),
  assign: (id: Id, data: { analyst_id: number }) => api.put<{ message: string }>(`/cases/${id}/assign`, data),
  addNote: (id: Id, data: { note: string }) => api.post<{ id: number; message: string }>(`/cases/${id}/notes`, data),
  generateSummary: (id: Id) => api.post<{ summary: string }>(`/cases/${id}/generate-summary`),
};

// Analytics
export const analyticsAPI = {
  summary: () => api.get<AnalyticsSummary>('/analytics/summary'),
  riskLevels: () => api.get<NamedCount<RiskLevel>[]>('/analytics/risk-levels'),
  flaggedByDay: () => api.get<DailyCount[]>('/analytics/flagged-by-day'),
  casesByStatus: () => api.get<NamedCount<CaseStatus>[]>('/analytics/cases-by-status'),
  highRiskMerchants: () => api.get<MerchantRisk[]>('/analytics/high-risk-merchants'),
  volumeByHour: () => api.get<HourlyVolume[]>('/analytics/volume-by-hour'),
  avgRiskByCategory: () => api.get<CategoryRisk[]>('/analytics/avg-risk-by-category'),
};

// Audit
export const auditAPI = {
  getLogs: (params?: QueryParams) => api.get<Paginated<AuditLog>>('/audit-logs', { params }),
};

// Users
export const usersAPI = {
  getAnalysts: () => api.get<Analyst[]>('/users/analysts'),
};

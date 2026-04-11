import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth state on 401
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    return Promise.reject(error);
  }
);

// Helper to format API errors
export function formatApiError(error) {
  const detail = error.response?.data?.detail;
  if (detail == null) return 'Une erreur est survenue. Veuillez réessayer.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(' ');
  }
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
}

// Auth API
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// Users API
export const usersApi = {
  search: (q) => api.get('/users/search', { params: { q } }),
};

// Partner API
export const partnerApi = {
  sendRequest: (data) => api.post('/partner/request', data),
  getRequests: () => api.get('/partner/requests'),
  getSentRequests: () => api.get('/partner/sent-requests'),
  accept: (requestId) => api.post(`/partner/accept/${requestId}`),
  reject: (requestId) => api.post(`/partner/reject/${requestId}`),
  unlink: () => api.delete('/partner/unlink'),
  getInfo: () => api.get('/partner/info'),
};

// Exercises API
export const exercisesApi = {
  getAll: () => api.get('/exercises'),
  create: (data) => api.post('/exercises', data),
  update: (id, data) => api.put(`/exercises/${id}`, data),
  delete: (id) => api.delete(`/exercises/${id}`),
};

// Templates API
export const templatesApi = {
  getAll: () => api.get('/templates'),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
};

// Workouts API
export const workoutsApi = {
  getAll: (params) => api.get('/workouts', { params }),
  getToday: () => api.get('/workouts/today'),
  getOne: (id) => api.get(`/workouts/${id}`),
  create: (data) => api.post('/workouts', data),
  createMulti: (data) => api.post('/workouts/multi-schedule', data),
  update: (id, data) => api.put(`/workouts/${id}`, data),
  delete: (id) => api.delete(`/workouts/${id}`),
  duplicate: (data) => api.post('/workouts/duplicate', null, { params: data }),
  duplicateWeek: (data) => api.post('/workouts/duplicate-week', null, { params: data }),
  saveProgress: (id, data) => api.post(`/workouts/${id}/save-progress`, data),
  getProgress: (id) => api.get(`/workouts/${id}/progress`),
  clearProgress: (id) => api.delete(`/workouts/${id}/progress`),
};

// Sessions API
export const sessionsApi = {
  getAll: (limit = 20) => api.get('/sessions', { params: { limit } }),
  getOne: (id) => api.get(`/sessions/${id}`),
  create: (data) => api.post('/sessions', data),
  toggleLike: (id) => api.post(`/sessions/${id}/like`),
  addReaction: (id, data) => api.post(`/sessions/${id}/react`, data),
  addComment: (id, data) => api.post(`/sessions/${id}/comment`, data),
};

// Duo API
export const duoApi = {
  getStats: () => api.get('/duo/stats'),
  getActivity: (limit = 10) => api.get('/duo/activity', { params: { limit } }),
  getDetailedStats: (period = '30', targetUser = null) => 
    api.get('/duo/detailed-stats', { params: { period, target_user: targetUser } }),
};

// Streak API
export const streakApi = {
  markRestDay: (date) => api.post('/streak/rest-day', { date }),
  markSkipDay: (date) => api.post('/streak/skip-day', { date }),
  getDays: (startDate, endDate) => api.get('/streak/days', { params: { start_date: startDate, end_date: endDate } }),
  removeDay: (date) => api.delete(`/streak/day/${date}`),
};

export default api;

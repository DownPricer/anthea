import axios from 'axios';
import { invalidateFeedCache, removePostFromFeedCaches } from './feedCache';
import { formatApiErrorDetail } from './formatApiErrorDetail';
import i18n from '../i18n';

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

// Helper to format API errors (codes structurés → i18n, message backend en fallback)
export function formatApiError(error) {
  return formatApiErrorDetail(error.response?.data?.detail, (key, opts) =>
    i18n.t(key, opts)
  );
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
  search: (q, searchType = 'user') =>
    api.get('/users/search', { params: { q, search_type: searchType } }),
  getByHandle: (handle) => api.get(`/users/${encodeURIComponent(handle)}`),
  follow: (handle) => api.post(`/users/${encodeURIComponent(handle)}/follow`),
  unfollow: (handle) => api.delete(`/users/${encodeURIComponent(handle)}/follow`),
  getProfileStats: (handle) => api.get(`/users/${encodeURIComponent(handle)}/profile-stats`),
  acceptFollowRequest: (requestId) => api.post(`/follow-requests/${requestId}/accept`),
  rejectFollowRequest: (requestId) => api.post(`/follow-requests/${requestId}/reject`),
  getPendingFollowRequests: () => api.get('/follow-requests/pending'),
};

// Notifications API
export const notificationsApi = {
  list: (limit = 30, filter) =>
    api.get('/notifications', { params: { limit, ...(filter ? { filter } : {}) } }),
  unreadCount: (filter) =>
    api.get('/notifications/unread-count', { params: filter ? { filter } : {} }),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
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
  getLiveSession: () => api.get('/partner/live-session'),
};

// Live workout (duo en direct)
export const liveWorkoutApi = {
  getMessages: () => api.get('/live-workout/messages'),
  sendMessage: (data) => api.post('/live-workout/messages', data),
  getReactions: (params = {}) => api.get('/live-workout/reactions', { params }),
  sendReaction: (data) => api.post('/live-workout/reactions', data),
};

// Exercises API
export const exercisesApi = {
  getAll: (params, config) => api.get('/exercises', { params, ...(config || {}) }),
  getOne: (id, params) => api.get(`/exercises/${id}`, { params }),
  getFacets: () => api.get('/exercises/facets'),
  create: (data) => api.post('/exercises', data),
  update: (id, data) => api.put(`/exercises/${id}`, data),
  delete: (id) => api.delete(`/exercises/${id}`),
};

// Templates API
export const templatesApi = {
  getAll: (params) => api.get('/templates', { params }),
  getOne: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
};

// Workouts API
export const workoutsApi = {
  getAll: (params) => api.get('/workouts', { params }), // params.light=true : sans blocs (léger)
  getToday: () => api.get('/workouts/today'),
  getOne: (id, params) => api.get(`/workouts/${id}`, params ? { params } : undefined),
  getDrafts: () => api.get('/workouts/drafts'),
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
  getAll: (params = {}) => api.get('/sessions', { params: { limit: 20, ...params } }),
  getHistory: (params = {}) => api.get('/sessions/history', { params: { limit: 50, ...params } }),
  export: (params = {}) =>
    api.get('/sessions/export', {
      params,
      responseType: 'blob',
    }),
  getOne: (id) => api.get(`/sessions/${id}`),
  create: (data) => api.post('/sessions', data),
  adjustTime: (id, data) => api.put(`/sessions/${id}/adjust-time`, data),
  toggleLike: (id) => api.post(`/sessions/${id}/like`),
  addReaction: (id, data) => api.post(`/sessions/${id}/react`, data),
  addComment: (id, data) => api.post(`/sessions/${id}/comment`, data),
};

// Posts API (mur social)
export const postsApi = {
  create: async (data) => {
    const response = await api.post('/posts', data);
    invalidateFeedCache();
    return response;
  },
  getByHandle: (handle, params = {}) =>
    api.get(`/users/${encodeURIComponent(handle)}/posts`, { params }),
  getRepostsByHandle: (handle, params = {}) =>
    api.get(`/users/${encodeURIComponent(handle)}/reposts`, { params }),
  getOne: (id) => api.get(`/posts/${id}`),
  delete: async (id) => {
    const response = await api.delete(`/posts/${id}`);
    removePostFromFeedCaches(id);
    return response;
  },
  toggleLike: (id) => api.post(`/posts/${id}/like`),
  addComment: (id, data) => api.post(`/posts/${id}/comment`, data),
  getComments: (id) => api.get(`/posts/${id}/comments`),
  toggleCommentLike: (postId, commentId) =>
    api.post(`/posts/${postId}/comments/${commentId}/like`),
  repost: (data) => api.post('/reposts', data),
  deleteRepost: (id) => api.delete(`/reposts/${id}`),
};

// Feed API
export const feedApi = {
  get: (params = {}) => api.get('/feed', { params }),
  getTrending: (params = {}) => api.get('/feed/trending', { params }),
};

// Uploads API
export const uploadsApi = {
  uploadImage: (imageData, filename = 'image.jpg') =>
    api.post('/uploads/image', { image_data: imageData, filename }),
};

/** Résout une URL d'upload — chemins relatifs uniquement (même origine que la page). */
export function resolveMediaUrl(value) {
  if (!value) return '';
  if (value.startsWith('blob:') || value.startsWith('data:')) return value;
  if (value.startsWith('/uploads/')) return value;
  if (value.startsWith('uploads/')) return `/${value}`;
  if (value.includes('/uploads/')) {
    const idx = value.indexOf('/uploads/');
    return value.slice(idx);
  }
  return value;
}

// Push API (PWA)
export const pushApi = {
  status: () => api.get('/push/status'),
  subscribe: (data) => api.post('/push/subscribe', data),
  unsubscribe: (data) => api.delete('/push/unsubscribe', { data }),
  test: () => api.post('/push/test'),
};

// Duo API
export const duoApi = {
  getStats: () => api.get('/duo/stats'),
  getActivity: (limit = 10) => api.get('/duo/activity', { params: { limit } }),
  getActivityFeed: (limit = 20) => api.get('/duo/activity-feed', { params: { limit } }),
  getDetailedStats: (period = '30', targetUser = null) =>
    api.get('/duo/detailed-stats', { params: { period, target_user: targetUser } }),
  getBadges: () => api.get('/duo/stats').then((r) => r.data?.badges || []),
  getDuoBadges: () => api.get('/badges/catalog', { params: { scope: 'duo' } }).then((r) => r.data),
  getProfile: () => api.get('/duo/profile'),
  updateProfile: (data) => api.patch('/duo/profile', data),
  updateRoles: (pairKey, roles) => api.patch(`/duos/${encodeURIComponent(pairKey)}/roles`, { roles }),
};

export const badgesApi = {
  getCatalog: (scope = 'solo') => api.get('/badges/catalog', { params: { scope } }),
  getMyBadges: () => api.get('/users/me/badges'),
  getMyBadge: (badgeId) => api.get(`/users/me/badges/${encodeURIComponent(badgeId)}`),
  getUserBadges: (userId) => api.get(`/users/${encodeURIComponent(userId)}/badges`),
  getDuoBadges: (pairKey) => api.get(`/duos/${encodeURIComponent(pairKey)}/badges`),
  getDuoBadge: (pairKey, badgeId) =>
    api.get(`/duos/${encodeURIComponent(pairKey)}/badges/${encodeURIComponent(badgeId)}`),
};

// Duo profiles API (public)
export const duoProfilesApi = {
  getByTag: (tag) => api.get(`/duos/${encodeURIComponent(tag)}`),
  getStats: (tag) => api.get(`/duos/${encodeURIComponent(tag)}/stats`),
  getActivity: (tag, limit = 15) =>
    api.get(`/duos/${encodeURIComponent(tag)}/activity`, { params: { limit } }),
  getPosts: (tag, params = {}) =>
    api.get(`/duos/${encodeURIComponent(tag)}/posts`, { params }),
  follow: (tag) => api.post(`/duos/${encodeURIComponent(tag)}/follow`),
  unfollow: (tag) => api.delete(`/duos/${encodeURIComponent(tag)}/follow`),
  acceptFollowRequest: (requestId) => api.post(`/duos/follow-requests/${requestId}/accept`),
  rejectFollowRequest: (requestId) => api.post(`/duos/follow-requests/${requestId}/reject`),
};

// Streak API
export const streakApi = {
  markRestDay: (date) => api.post('/streak/rest-day', { date }),
  markSkipDay: (date) => api.post('/streak/skip-day', { date }),
  getDays: (startDate, endDate) => api.get('/streak/days', { params: { start_date: startDate, end_date: endDate } }),
  getCalendar: (startDate, endDate, params = {}) =>
    api.get('/streak/calendar', {
      params: { start_date: startDate, end_date: endDate, ...params },
    }),
  removeDay: (date) => api.delete(`/streak/day/${date}`),
  getCoachStatus: () => api.get('/streak/coach/status'),
  coachSetManualStreak: (streak) => api.post('/streak/coach/manual-streak', { streak }),
  coachExemptDay: (date, userId) => api.post('/streak/coach/exempt-day', { date, user_id: userId }),
};

export default api;

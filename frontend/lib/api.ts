import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  signup: (data: { email: string; password: string; name?: string; inviteCode?: string }) =>
    api.post('/auth/signup', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  firebaseAuth: (data: { firebaseUid: string; email: string; name?: string; photoUrl?: string }) =>
    api.post('/auth/firebase', data),

  getMe: () => api.get('/auth/me'),

  linkWallet: (data: { walletAddress: string; signature?: string }) =>
    api.post('/auth/wallet', data),
};

// Users API
export const usersApi = {
  getProfile: (id: string) => api.get(`/users/${id}`),

  updateProfile: (data: { name?: string; bio?: string; profilePic?: string }) =>
    api.put('/users/me', data),

  getLeaderboard: (params?: { type?: string; limit?: number; offset?: number }) =>
    api.get('/users', { params }),

  getUserDonations: (id: string, params?: { type?: string; limit?: number; offset?: number }) =>
    api.get(`/users/${id}/donations`, { params }),

  getUserPosts: (id: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/users/${id}/posts`, { params }),
};

// Donations API
export const donationsApi = {
  create: (data: { latitude: number; longitude: number; description: string; photoUrl?: string }) =>
    api.post('/donations', data),

  getAll: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/donations', { params }),

  getOne: (id: string) => api.get(`/donations/${id}`),

  confirm: (id: string, data: { latitude: number; longitude: number }) =>
    api.post(`/donations/${id}/confirm`, data),

  dispute: (id: string, data: { reason?: string }) =>
    api.post(`/donations/${id}/dispute`, data),

  cancel: (id: string) => api.delete(`/donations/${id}`),
};

// Posts API
export const postsApi = {
  create: (data: { content: string; imageUrl?: string }) =>
    api.post('/posts', data),

  getFeed: (params?: { limit?: number; offset?: number; userId?: string }) =>
    api.get('/posts', { params }),

  getOne: (id: string) => api.get(`/posts/${id}`),

  delete: (id: string) => api.delete(`/posts/${id}`),

  like: (id: string) => api.post(`/posts/${id}/like`),
};

// Reports API
export const reportsApi = {
  create: (data: { reportedUserId?: string; reportedPostId?: string; reportedDonationId?: string; reason: string }) =>
    api.post('/reports', data),

  getAll: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/reports', { params }),
};

// Rewards API
export const rewardsApi = {
  getKarma: () => api.get('/rewards/karma'),

  getKarmaHistory: (params?: { limit?: number; offset?: number }) =>
    api.get('/rewards/karma/history', { params }),

  exchange: (data: { karmaAmount: number }) =>
    api.post('/rewards/exchange', data),

  getTokens: () => api.get('/rewards/tokens'),

  getMedals: () => api.get('/rewards/medals'),

  mintMedal: (data: { tier: 'bronze' | 'silver' | 'gold' | 'platinum' }) =>
    api.post('/rewards/medals/mint', data),
};

// Invitations API
export const invitationsApi = {
  send: (data: { email: string }) =>
    api.post('/invitations', data),

  getAll: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/invitations', { params }),

  verify: (code: string) =>
    api.get(`/invitations/verify/${code}`),

  cancel: (id: string) =>
    api.delete(`/invitations/${id}`),
};

// Contributions API
export const contributionsApi = {
  createFiat: (data: { amount: number; currency?: string }) =>
    api.post('/contributions/fiat', data),

  confirmFiat: (data: { paymentIntentId: string }) =>
    api.post('/contributions/fiat/confirm', data),

  recordCrypto: (data: { txHash: string; amount: string; currency?: string }) =>
    api.post('/contributions/crypto', data),

  getAll: (params?: { limit?: number; offset?: number }) =>
    api.get('/contributions', { params }),
};

export default api;

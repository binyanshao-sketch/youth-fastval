import request from '@/utils/request'

export default {
  login: (data) => request.post('/login', data),
  getUserInfo: () => request.get('/user/info'),

  getDashboard: () => request.get('/dashboard'),

  getUsers: (params) => request.get('/users', { params }),
  getUser: (id) => request.get(`/users/${id}`),
  updateUser: (id, data) => request.put(`/users/${id}`, data),
  blacklistUser: (id) => request.post(`/users/${id}/blacklist`),

  getLuckyBagRecords: (params) => request.get('/lucky-bag/records', { params }),
  getLuckyBagConfig: () => request.get('/lucky-bag/config'),
  updateLuckyBagConfig: (data) => request.put('/lucky-bag/config', data),
  createLuckyBagPoolItem: (data) => request.post('/lucky-bag/pool', data),
  updateLuckyBagPoolItem: (id, data) => request.put(`/lucky-bag/pool/${id}`, data),
  deleteLuckyBagPoolItem: (id) => request.delete(`/lucky-bag/pool/${id}`),
  updatePoolPoster: (id, posterUrl) => request.put(`/lucky-bag/pool/${id}/poster`, { posterUrl }),

  getCoupons: (params) => request.get('/coupons', { params }),
  createCoupon: (data) => request.post('/coupons', data),
  updateCoupon: (id, data) => request.put(`/coupons/${id}`, data),
  deleteCoupon: (id) => request.delete(`/coupons/${id}`),

  getMerchants: (params) => request.get('/merchants', { params }),
  getMerchant: (id) => request.get(`/merchants/${id}`),
  createMerchant: (data) => request.post('/merchants', data),
  updateMerchant: (id, data) => request.put(`/merchants/${id}`, data),
  verifyMerchant: (id) => request.post(`/merchants/${id}/verify`),

  getFinanceRecords: (params) => request.get('/finance/records', { params }),
  getFinanceSummary: () => request.get('/finance/summary'),
  exportFinance: (params) => request.get('/finance/export', { params, responseType: 'blob' }),

  getStatistics: (params) => request.get('/statistics', { params }),
  getUserAnalysis: (params) => request.get('/statistics/users', { params }),
  getMerchantAnalysis: (params) => request.get('/statistics/merchants', { params }),

  getSettings: () => request.get('/settings'),
  updateSettings: (data) => request.put('/settings', data),

  getLogs: (params) => request.get('/logs', { params }),

  getUploadToken: (prefix) => request.get('/upload/token', { params: { prefix } })
}

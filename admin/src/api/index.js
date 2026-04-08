import request from '@/utils/request'

export default {
  // 登录
  login: (data) => request.post('/login', data),
  
  // 获取用户信息
  getUserInfo: () => request.get('/user/info'),
  
  // 仪表盘数据
  getDashboard: () => request.get('/dashboard'),
  
  // 用户管理
  getUsers: (params) => request.get('/users', { params }),
  getUser: (id) => request.get(`/users/${id}`),
  updateUser: (id, data) => request.put(`/users/${id}`, data),
  blacklistUser: (id) => request.post(`/users/${id}/blacklist`),
  
  // 福袋管理
  getLuckyBagRecords: (params) => request.get('/lucky-bag/records', { params }),
  getLuckyBagConfig: () => request.get('/lucky-bag/config'),
  updateLuckyBagConfig: (data) => request.put('/lucky-bag/config', data),
  
  // 消费券管理
  getCoupons: (params) => request.get('/coupons', { params }),
  createCoupon: (data) => request.post('/coupons', data),
  updateCoupon: (id, data) => request.put(`/coupons/${id}`, data),
  deleteCoupon: (id) => request.delete(`/coupons/${id}`),
  
  // 商家管理
  getMerchants: (params) => request.get('/merchants', { params }),
  getMerchant: (id) => request.get(`/merchants/${id}`),
  createMerchant: (data) => request.post('/merchants', data),
  updateMerchant: (id, data) => request.put(`/merchants/${id}`, data),
  verifyMerchant: (id) => request.post(`/merchants/${id}/verify`),
  
  // 财务管理
  getFinanceRecords: (params) => request.get('/finance/records', { params }),
  getFinanceSummary: () => request.get('/finance/summary'),
  exportFinance: (params) => request.get('/finance/export', { params, responseType: 'blob' }),
  
  // 统计报表
  getStatistics: (params) => request.get('/statistics', { params }),
  getUserAnalysis: (params) => request.get('/statistics/users', { params }),
  getMerchantAnalysis: (params) => request.get('/statistics/merchants', { params }),
  
  // 系统设置
  getSettings: () => request.get('/settings'),
  updateSettings: (data) => request.put('/settings', data),
  
  // 操作日志
  getLogs: (params) => request.get('/logs', { params })
}

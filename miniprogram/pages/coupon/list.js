// pages/coupon/list.js
const app = getApp();

Page({
  data: {
    currentTab: 0,
    coupons: [],
    unusedCount: 0,
    usedCount: 0,
    expiredCount: 0
  },

  onLoad() {
    this.loadCoupons();
  },

  onShow() {
    this.loadCoupons();
  },

  // 切换标签
  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab);
    this.setData({ currentTab: tab });
    this.loadCoupons(tab + 1); // status: 1未使用 2已使用 3已过期
  },

  // 加载消费券
  async loadCoupons(status = 1) {
    try {
      const data = await app.request({
        url: '/api/coupons/my',
        data: { status }
      });

      // 统计各状态数量
      this.setData({
        coupons: data,
        unusedCount: status === 1 ? data.length : this.data.unusedCount,
        usedCount: status === 2 ? data.length : this.data.usedCount,
        expiredCount: status === 3 ? data.length : this.data.expiredCount
      });

    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 查看详情
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/coupon/detail?id=${id}`
    });
  }
});

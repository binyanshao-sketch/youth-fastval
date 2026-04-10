const app = getApp();

Page({
  data: {
    currentTab: '1',
    couponPool: {
      1: [],
      2: [],
      3: []
    },
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

  async loadCoupons() {
    try {
      await app.ensureLogin();
      const [unused, used, expired] = await Promise.all([
        app.request({ url: '/api/user/coupons/my', data: { status: 1 } }),
        app.request({ url: '/api/user/coupons/my', data: { status: 2 } }),
        app.request({ url: '/api/user/coupons/my', data: { status: 3 } })
      ]);

      this.setData({
        couponPool: {
          1: unused,
          2: used,
          3: expired
        },
        coupons: { 1: unused, 2: used, 3: expired }[this.data.currentTab] || [],
        unusedCount: unused.length,
        usedCount: used.length,
        expiredCount: expired.length
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '加载消费券失败',
        icon: 'none'
      });
    }
  },

  switchTab(event) {
    const currentTab = event.currentTarget.dataset.tab;
    this.setData({
      currentTab,
      coupons: this.data.couponPool[currentTab] || []
    });
  },

  goToDetail(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/coupon/detail?id=${id}`
    });
  }
});

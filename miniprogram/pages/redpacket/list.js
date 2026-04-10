const app = getApp();

Page({
  data: {
    list: [],
    total: 0
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      await app.ensureLogin();
      const data = await app.request({
        url: '/api/user/redpacket/list'
      });

      this.setData({
        list: data.list || [],
        total: data.total || 0
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '加载红包失败',
        icon: 'none'
      });
    }
  },

  goToLottery() {
    wx.navigateTo({ url: '/pages/lottery/index' });
  }
});

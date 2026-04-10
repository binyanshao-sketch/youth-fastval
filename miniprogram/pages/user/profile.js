const app = getApp();
const { activityRules, serviceInfo } = require('../../data/content');

Page({
  data: {
    userInfo: null,
    stats: {
      redpacketCount: 0,
      couponCount: 0,
      totalAmount: '0.00',
      hasDrawnLottery: false
    },
    activityRules,
    serviceInfo
  },

  onLoad() {
    this.bootstrap();
  },

  onShow() {
    this.bootstrap();
  },

  async bootstrap() {
    if (!app.globalData.token) {
      this.setData({ userInfo: null });
      return;
    }

    try {
      await app.refreshUserInfo();
      const stats = await app.request({
        url: '/api/user/stats'
      });

      this.setData({
        userInfo: app.globalData.userInfo,
        stats
      });
    } catch (error) {
      console.error('profile bootstrap failed', error);
    }
  },

  goLogin() {
    app.login()
      .then(() => this.bootstrap())
      .catch((error) => {
        wx.showToast({
          title: error.message || '登录失败',
          icon: 'none'
        });
      });
  },

  goToRedpacket() {
    wx.navigateTo({ url: '/pages/redpacket/list' });
  },

  goToCoupon() {
    wx.switchTab({ url: '/pages/coupon/list' });
  },

  goToMerchant() {
    wx.navigateTo({ url: '/pages/merchant/nearby' });
  },

  goToPolicy() {
    wx.navigateTo({ url: '/pages/policy/index' });
  },

  goToLottery() {
    wx.navigateTo({ url: '/pages/lottery/index' });
  },

  contactService() {
    wx.makePhoneCall({
      phoneNumber: serviceInfo.phone
    });
  }
});

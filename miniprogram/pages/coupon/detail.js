// pages/coupon/detail.js
const app = getApp();

Page({
  data: {
    id: null,
    code: '',
    status: 1,
    coupon: null,
    qrcodeUrl: ''
  },

  onLoad(options) {
    this.setData({ id: options.id });
    this.loadCouponDetail();
  },

  async loadCouponDetail() {
    try {
      const data = await app.request({
        url: `/api/coupon/${this.data.id}/qrcode`
      });

      this.setData({
        code: data.code,
        qrcodeUrl: data.qrcodeUrl,
        coupon: data.coupon,
        status: data.status
      });

    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  goToNearby() {
    wx.navigateTo({ url: '/pages/merchant/nearby' });
  }
});

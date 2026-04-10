const app = getApp();

Page({
  data: {
    id: '',
    code: '',
    status: 1,
    coupon: null,
    qrcodeUrl: ''
  },

  onLoad(options) {
    this.setData({ id: options.id || '' });
    this.loadCouponDetail();
  },

  async loadCouponDetail() {
    try {
      const data = await app.request({
        url: `/api/user/coupon/${this.data.id}/qrcode`
      });

      this.setData({
        code: data.code,
        qrcodeUrl: data.qrcodeUrl,
        coupon: data.coupon,
        status: data.status
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '加载详情失败',
        icon: 'none'
      });
    }
  },

});

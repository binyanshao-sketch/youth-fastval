// pages/lucky-bag/receive.js
const app = getApp();

Page({
  data: {
    agreePrivacy: false
  },

  togglePrivacy() {
    this.setData({
      agreePrivacy: !this.data.agreePrivacy
    });
  },

  goToPrivacy() {
    wx.navigateTo({ url: '/pages/webview/index?url=https://example.com/privacy' });
  },

  async onGetPhoneNumber(e) {
    if (!this.data.agreePrivacy) {
      wx.showToast({ title: '请先同意隐私政策', icon: 'none' });
      return;
    }

    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '授权失败', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在授权...' });

    try {
      // 解密手机号
      const { encryptedData, iv } = e.detail;
      await app.request({
        url: '/api/user/bindPhone',
        method: 'POST',
        data: { encryptedData, iv }
      });

      wx.hideLoading();

      // 领取福袋
      await this.receiveLuckyBag();

    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '授权失败',
        icon: 'none'
      });
    }
  },

  async receiveLuckyBag() {
    wx.showLoading({ title: '正在领取...' });

    try {
      const data = await app.request({
        url: '/api/luckyBag/receive',
        method: 'POST'
      });

      wx.hideLoading();

      // 跳转到结果页
      wx.redirectTo({
        url: '/pages/lucky-bag/result',
        success: (res) => {
          res.eventChannel.emit('luckyBagData', data);
        }
      });

    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '领取失败',
        icon: 'none'
      });
    }
  }
});

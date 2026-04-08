// pages/lucky-bag/result.js
const app = getApp();

Page({
  data: {
    showFireworks: true,
    redPacket: null,
    coupons: []
  },

  onLoad(options) {
    // 获取传递的数据
    const eventChannel = this.getOpenerEventChannel();
    eventChannel.on('luckyBagData', (data) => {
      this.setData({
        redPacket: data.redPacket,
        coupons: data.coupons || []
      });
    });

    // 3秒后关闭动画
    setTimeout(() => {
      this.setData({ showFireworks: false });
    }, 3000);
  },

  // 提现红包
  async onWithdraw() {
    wx.showLoading({ title: '正在提现...' });

    try {
      await app.request({
        url: '/api/redpacket/withdraw',
        method: 'POST'
      });

      wx.hideLoading();
      wx.showToast({
        title: '提现成功！',
        icon: 'success'
      });

      // 更新状态
      this.setData({
        'redPacket.status': 2
      });

    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '提现失败',
        icon: 'none'
      });
    }
  },

  // 查看政策
  goToPolicy() {
    wx.navigateTo({ url: '/pages/policy/index' });
  },

  // 返回首页
  goBack() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '我领到了五四青春福袋，快来领取吧！',
      path: '/pages/index/index',
      imageUrl: '/images/share.png'
    };
  }
});

// pages/index/index.js
const app = getApp();

Page({
  data: {
    banners: [
      { id: 1, image: '/images/banner1.png', url: '' },
      { id: 2, image: '/images/banner2.png', url: '' }
    ],
    isActive: false,
    hasReceived: false,
    statusText: '活动未开始',
    countdown: null,
    myRedpacket: null,
    myCoupons: []
  },

  onLoad() {
    this.checkActivityStatus();
    this.checkReceiveStatus();
  },

  onShow() {
    this.checkReceiveStatus();
  },

  // 检查活动状态
  async checkActivityStatus() {
    try {
      const data = await app.request({
        url: '/api/status'
      });
      
      this.setData({
        isActive: data.isActive,
        statusText: data.isActive ? '进行中' : '活动未开始'
      });
      
      if (!data.isActive && data.startTime) {
        this.startCountdown(data.startTime);
      }
    } catch (error) {
      console.error('获取活动状态失败:', error);
    }
  },

  // 开始倒计时
  startCountdown(targetTime) {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const target = new Date(targetTime).getTime();
      const diff = target - now;
      
      if (diff <= 0) {
        this.setData({ countdown: null, isActive: true, statusText: '进行中' });
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      this.setData({
        countdown: { days, hours, minutes, seconds }
      });
    };
    
    updateCountdown();
    this.countdownTimer = setInterval(updateCountdown, 1000);
  },

  // 检查领取状态
  async checkReceiveStatus() {
    if (!app.globalData.token) {
      await app.login();
    }
    
    try {
      const data = await app.request({
        url: '/api/luckyBag/my'
      });
      
      if (data) {
        this.setData({
          hasReceived: true,
          myRedpacket: data.redPacket,
          myCoupons: data.coupons || []
        });
      }
    } catch (error) {
      // 未领取
      this.setData({ hasReceived: false });
    }
  },

  // 点击领取
  async onReceiveTap() {
    if (!this.data.isActive) {
      wx.showToast({ title: '活动未开始', icon: 'none' });
      return;
    }
    
    if (this.data.hasReceived) {
      wx.showToast({ title: '您已领取过福袋', icon: 'none' });
      return;
    }
    
    // 检查是否授权手机号
    if (!app.globalData.userInfo?.phone) {
      wx.navigateTo({ url: '/pages/lucky-bag/receive' });
      return;
    }
    
    this.receiveLuckyBag();
  },

  // 领取福袋
  async receiveLuckyBag() {
    wx.showLoading({ title: '正在领取...' });
    
    try {
      const data = await app.request({
        url: '/api/luckyBag/receive',
        method: 'POST'
      });
      
      wx.hideLoading();
      
      // 跳转到结果页
      wx.navigateTo({
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
  },

  // 跳转到红包页
  goToRedpacket() {
    wx.navigateTo({ url: '/pages/redpacket/list' });
  },

  // 跳转到消费券页
  goToCoupon() {
    wx.switchTab({ url: '/pages/coupon/list' });
  },

  // 跳转到商家页
  goToMerchant() {
    wx.navigateTo({ url: '/pages/merchant/nearby' });
  },

  // 跳转到政策页
  goToPolicy() {
    wx.navigateTo({ url: '/pages/policy/index' });
  },

  // 点击轮播图
  onBannerTap(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.navigateTo({ url });
    }
  },

  onUnload() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  }
});

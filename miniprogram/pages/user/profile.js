// pages/user/profile.js
const app = getApp()

Page({
  data: {
    userInfo: null,
    stats: {
      redpacketCount: 0,
      couponCount: 0,
      totalAmount: '0.00'
    }
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    this.loadUserInfo()
    if (app.globalData.userInfo) {
      this.loadStats()
    }
  },

  async loadUserInfo() {
    if (app.globalData.userInfo) {
      this.setData({ userInfo: app.globalData.userInfo })
    }
  },

  async loadStats() {
    try {
      const data = await app.request({
        url: '/api/user/stats'
      })
      
      this.setData({ stats: data })
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  },

  goLogin() {
    app.login().then((res) => {
      if (res.isNewUser) {
        wx.navigateTo({ url: '/pages/lucky-bag/receive' })
      } else {
        this.loadUserInfo()
        this.loadStats()
      }
    }).catch((error) => {
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      })
    })
  },

  goToRedpacket() {
    wx.navigateTo({ url: '/pages/redpacket/list' })
  },

  goToCoupon() {
    wx.switchTab({ url: '/pages/coupon/list' })
  },

  goToMerchant() {
    wx.navigateTo({ url: '/pages/merchant/nearby' })
  },

  goToPolicy() {
    wx.navigateTo({ url: '/pages/policy/index' })
  },

  showAbout() {
    wx.showModal({
      title: '关于活动',
      content: '五四青年节青春福袋活动由共青团宜宾市委主办，旨在为全市青年送上节日祝福，助力青年成长成才。',
      showCancel: false
    })
  },

  showRules() {
    wx.showModal({
      title: '活动规则',
      content: '1. 活动时间：2026年4月15日-5月4日\n2. 每人限领1份福袋\n3. 红包可提现至微信零钱\n4. 消费券可在指定商家使用',
      showCancel: false
    })
  },

  contactService() {
    wx.showModal({
      title: '联系客服',
      content: '如有问题请拨打客服电话：\n0831-1234567',
      confirmText: '拨打',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({
            phoneNumber: '08311234567'
          })
        }
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '五四青春福袋，快来领取吧！',
      path: '/pages/index/index',
      imageUrl: '/images/share.png'
    }
  }
})

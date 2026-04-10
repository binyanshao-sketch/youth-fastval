const { merchantFallbacks } = require('../../data/content');

Page({
  data: {
    merchant: null
  },

  onLoad(options) {
    const cached = wx.getStorageSync('selectedMerchant');
    const merchant = cached && String(cached.id) === String(options.id)
      ? cached
      : merchantFallbacks.find((item) => String(item.id) === String(options.id));

    this.setData({
      merchant: merchant || merchantFallbacks[0]
    });
  },

  callMerchant() {
    if (!this.data.merchant?.contactPhone) {
      wx.showToast({
        title: '暂无联系电话',
        icon: 'none'
      });
      return;
    }

    wx.makePhoneCall({
      phoneNumber: this.data.merchant.contactPhone
    });
  },

  openMap() {
    const { merchant } = this.data;
    if (!merchant?.latitude || !merchant?.longitude) {
      wx.showToast({
        title: '暂未配置地图位置',
        icon: 'none'
      });
      return;
    }

    wx.openLocation({
      latitude: Number(merchant.latitude),
      longitude: Number(merchant.longitude),
      name: merchant.name,
      address: merchant.address
    });
  }
});

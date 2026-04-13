const app = getApp();

function createBagOptions() {
  return Array.from({ length: 9 }).map((_, index) => ({
    id: index,
    label: `福袋 ${index + 1}`,
    tag: index < 3 ? '热力开袋' : index < 6 ? '青年好运' : '隐藏惊喜'
  }));
}

Page({
  data: {
    bagOptions: createBagOptions(),
    selectedSlot: null,
    agreePrivacy: true,
    phoneBound: false,
    showPhoneSheet: false,
    submitting: false
  },

  onLoad() {
    this.syncUserState();
  },

  async syncUserState() {
    try {
      if (app.globalData.token && !app.globalData.userInfo) {
        await app.refreshUserInfo();
      }

      this.setData({
        phoneBound: !!app.globalData.userInfo?.phone
      });
    } catch (error) {
      console.error('sync user state failed', error);
    }
  },

  onSelectBag(event) {
    this.setData({
      selectedSlot: Number(event.currentTarget.dataset.index)
    });
  },

  togglePrivacy() {
    this.setData({
      agreePrivacy: !this.data.agreePrivacy
    });
  },

  goToPrivacy() {
    wx.navigateTo({
      url: '/pages/policy/detail?id=privacy'
    });
  },

  async onOpenBag() {
    if (this.data.selectedSlot == null) {
      wx.showToast({
        title: '先从九个红包里选一个',
        icon: 'none'
      });
      return;
    }

    if (!this.data.agreePrivacy) {
      wx.showToast({
        title: '请先阅读并同意隐私说明',
        icon: 'none'
      });
      return;
    }

    try {
      if (!app.globalData.token) {
        wx.navigateTo({ url: '/pages/login/index' });
        return;
      }
      await app.refreshUserInfo();
    } catch (error) {
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none'
      });
      return;
    }

    if (!app.globalData.userInfo?.phone) {
      this.setData({
        phoneBound: false,
        showPhoneSheet: true
      });
      return;
    }

    this.setData({ phoneBound: true });
    await this.submitReceive();
  },

  closePhoneSheet() {
    this.setData({
      showPhoneSheet: false
    });
  },

  noop() {},

  async onGetPhoneNumber(event) {
    if (!this.data.agreePrivacy) {
      wx.showToast({
        title: '请先阅读并同意隐私说明',
        icon: 'none'
      });
      return;
    }

    if (event.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({
        title: '手机号授权未完成',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '正在绑定手机号' });

    try {
      await app.request({
        url: '/api/user/bindPhone',
        method: 'POST',
        data: {
          encryptedData: event.detail.encryptedData,
          iv: event.detail.iv
        }
      });

      await app.refreshUserInfo();
      this.setData({
        phoneBound: true,
        showPhoneSheet: false
      });

      wx.hideLoading();
      await this.submitReceive();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '绑定手机号失败',
        icon: 'none'
      });
    }
  },

  getLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude }),
        fail: () => reject(new Error('请允许获取位置信息后再试'))
      });
    });
  },

  async submitReceive() {
    if (this.data.submitting) {
      return;
    }

    this.setData({ submitting: true });

    let location;
    try {
      location = await this.getLocation();
    } catch (locErr) {
      this.setData({ submitting: false });
      wx.showToast({ title: locErr.message || '获取位置失败', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在开启福袋' });

    try {
      const data = await app.request({
        url: '/api/user/luckyBag/receive',
        method: 'POST',
        data: {
          slotIndex: this.data.selectedSlot,
          latitude: location.latitude,
          longitude: location.longitude
        }
      });

      app.saveLuckyBagSnapshot(data);
      wx.hideLoading();
      wx.redirectTo({
        url: '/pages/lucky-bag/result'
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '开启失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});

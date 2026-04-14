const PROD_BASE_URL = 'https://lucky.rongzhouqingnian.cloud';
const DEV_BASE_URL = 'http://127.0.0.1:3000';

function trimTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function getEnvVersion() {
  try {
    if (typeof wx.getAccountInfoSync === 'function') {
      return wx.getAccountInfoSync()?.miniProgram?.envVersion || '';
    }
  } catch (error) {
    // ignore
  }
  return '';
}

function resolveBaseUrl() {
  try {
    const override = trimTrailingSlash(wx.getStorageSync('dev_base_url'));
    if (override) {
      return override;
    }
  } catch (error) {
    // ignore
  }

  // In DevTools / development builds, prefer local backend for reliable local debugging.
  if (getEnvVersion() === 'develop') {
    return DEV_BASE_URL;
  }

  return PROD_BASE_URL;
}

App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: resolveBaseUrl(),
    luckyBagSnapshot: null,
    lotterySnapshot: null
  },

  onLaunch() {
    this.checkLoginStatus();
    this.checkUpdate();
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    if (!token) {
      return;
    }

    this.globalData.token = token;
    this.refreshUserInfo().catch(() => {});
    this.globalData.luckyBagSnapshot = wx.getStorageSync('latestLuckyBag') || null;
    this.globalData.lotterySnapshot = wx.getStorageSync('latestLottery') || null;
  },

  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (loginResult) => {
          if (!loginResult.code) {
            reject(new Error('微信登录失败'));
            return;
          }

          wx.request({
            url: `${this.globalData.baseUrl}/api/user/login`,
            method: 'POST',
            data: { code: loginResult.code },
            success: async (response) => {
              if (!response.data.success) {
                reject(new Error(response.data.message || '登录失败'));
                return;
              }

              const { token, isNewUser } = response.data.data;
              this.globalData.token = token;
              wx.setStorageSync('token', token);

              try {
                await this.refreshUserInfo();
              } catch (error) {
                reject(error);
                return;
              }

              resolve({ isNewUser });
            },
            fail: reject
          });
        },
        fail: reject
      });
    });
  },

  ensureLogin() {
    if (this.globalData.token) {
      return Promise.resolve({
        isNewUser: !this.globalData.userInfo?.phone
      });
    }

    return this.login();
  },

  refreshUserInfo() {
    if (!this.globalData.token) {
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.globalData.baseUrl}/api/user/info`,
        header: {
          Authorization: `Bearer ${this.globalData.token}`
        },
        success: (response) => {
          if (!response.data.success) {
            reject(new Error(response.data.message || '获取用户信息失败'));
            return;
          }

          this.globalData.userInfo = response.data.data;
          resolve(response.data.data);
        },
        fail: reject
      });
    });
  },

  saveLuckyBagSnapshot(snapshot) {
    this.globalData.luckyBagSnapshot = snapshot || null;
    wx.setStorageSync('latestLuckyBag', snapshot || '');
  },

  getLuckyBagSnapshot() {
    return this.globalData.luckyBagSnapshot || wx.getStorageSync('latestLuckyBag') || null;
  },

  saveLotterySnapshot(snapshot) {
    this.globalData.lotterySnapshot = snapshot || null;
    wx.setStorageSync('latestLottery', snapshot || '');
  },

  getLotterySnapshot() {
    return this.globalData.lotterySnapshot || wx.getStorageSync('latestLottery') || null;
  },

  clearSession() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    wx.removeStorageSync('token');
  },

  checkUpdate() {
    if (!wx.canIUse('getUpdateManager')) {
      return;
    }

    const updateManager = wx.getUpdateManager();
    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '发现新版本',
        content: '新版本已准备好，是否立即重启更新？',
        success: (modalResult) => {
          if (modalResult.confirm) {
            updateManager.applyUpdate();
          }
        }
      });
    });
  },

  request(options) {
    const requestOptions = {
      url: options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: options.header || {},
      skipAuthRetry: !!options.skipAuthRetry
    };

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.globalData.baseUrl}${requestOptions.url}`,
        method: requestOptions.method,
        data: requestOptions.data,
        header: {
          'Content-Type': 'application/json',
          ...(this.globalData.token ? { Authorization: `Bearer ${this.globalData.token}` } : {}),
          ...requestOptions.header
        },
        success: async (response) => {
          if (response.statusCode >= 500) {
            reject(new Error('服务器异常，请稍后再试'));
            return;
          }

          if (response.statusCode === 401 && !requestOptions.skipAuthRetry) {
            this.clearSession();

            try {
              await this.login();
              const retryData = await this.request({
                ...requestOptions,
                skipAuthRetry: true
              });
              resolve(retryData);
            } catch (error) {
              reject(error);
            }
            return;
          }

          if (!response.data?.success) {
            reject(new Error(response.data?.message || '请求失败'));
            return;
          }

          resolve(response.data.data);
        },
        fail: reject
      });
    });
  }
});

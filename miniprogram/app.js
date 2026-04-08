// app.js
App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: 'https://api.yibin-youth.com'
  },

  onLaunch() {
    // 检查登录状态
    this.checkLoginStatus();
    // 检查更新
    this.checkUpdate();
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.getUserInfo();
    }
  },

  // 登录
  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            wx.request({
              url: `${this.globalData.baseUrl}/api/user/login`,
              method: 'POST',
              data: { code: res.code },
              success: (response) => {
                if (response.data.success) {
                  const { token, openid, isNewUser } = response.data.data;
                  this.globalData.token = token;
                  wx.setStorageSync('token', token);
                  wx.setStorageSync('openid', openid);
                  resolve({ isNewUser });
                } else {
                  reject(new Error(response.data.message));
                }
              },
              fail: reject
            });
          } else {
            reject(new Error('登录失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 获取用户信息
  getUserInfo() {
    wx.request({
      url: `${this.globalData.baseUrl}/api/user/info`,
      header: {
        'Authorization': `Bearer ${this.globalData.token}`
      },
      success: (res) => {
        if (res.data.success) {
          this.globalData.userInfo = res.data.data;
        }
      }
    });
  },

  // 检查小程序更新
  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();
      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '更新提示',
          content: '新版本已经准备好，是否重启应用？',
          success: (res) => {
            if (res.confirm) {
              updateManager.applyUpdate();
            }
          }
        });
      });
    }
  },

  // 统一请求方法
  request(options) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.globalData.baseUrl}${options.url}`,
        method: options.method || 'GET',
        data: options.data || {},
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.globalData.token}`,
          ...options.header
        },
        success: (res) => {
          if (res.statusCode === 401) {
            // token过期，重新登录
            this.login().then(() => {
              this.request(options).then(resolve).catch(reject);
            });
          } else if (res.data.success) {
            resolve(res.data.data);
          } else {
            reject(new Error(res.data.message));
          }
        },
        fail: reject
      });
    });
  }
});

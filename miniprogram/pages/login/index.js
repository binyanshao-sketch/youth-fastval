const app = getApp();

Page({
  data: {
    tab: 'password',
    email: '',
    password: '',
    nickname: '',
    code: '',
    codeSending: false,
    codeCountdown: 0,
    submitting: false,
    isRegister: false
  },

  _codeTimer: null,

  onUnload() {
    if (this._codeTimer) {
      clearInterval(this._codeTimer);
      this._codeTimer = null;
    }
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  toggleRegister() {
    this.setData({ isRegister: !this.data.isRegister });
  },

  onEmailInput(e) {
    this.setData({ email: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value });
  },

  sendCode() {
    const email = this.data.email.trim();
    if (!email) {
      wx.showToast({ title: '请输入邮箱地址', icon: 'none' });
      return;
    }

    this.setData({ codeSending: true });

    wx.request({
      url: `${app.globalData.baseUrl}/api/user/auth/email/send`,
      method: 'POST',
      data: { email },
      success: (res) => {
        if (!res.data.success) {
          wx.showToast({ title: res.data.message || '发送失败', icon: 'none' });
          return;
        }

        const mockCode = res.data.data && res.data.data.mockCode;
        if (mockCode) {
          this.setData({ code: mockCode });
          wx.showToast({ title: '测试模式：已自动填入', icon: 'none' });
        } else {
          wx.showToast({ title: '验证码已发送', icon: 'none' });
        }

        this.setData({ codeCountdown: 60 });
        this._codeTimer = setInterval(() => {
          const next = this.data.codeCountdown - 1;
          this.setData({ codeCountdown: next });
          if (next <= 0) {
            clearInterval(this._codeTimer);
            this._codeTimer = null;
          }
        }, 1000);
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        this.setData({ codeSending: false });
      }
    });
  },

  handleSubmit() {
    const email = this.data.email.trim();
    if (!email) {
      wx.showToast({ title: '请输入邮箱地址', icon: 'none' });
      return;
    }

    let url;
    let data;

    if (this.data.tab === 'password') {
      const password = this.data.password;
      if (!password) {
        wx.showToast({ title: '请输入密码', icon: 'none' });
        return;
      }

      if (this.data.isRegister) {
        if (password.length < 6) {
          wx.showToast({ title: '密码长度至少6位', icon: 'none' });
          return;
        }
        url = '/api/user/auth/register';
        data = { email, password };
        if (this.data.nickname.trim()) {
          data.nickname = this.data.nickname.trim();
        }
      } else {
        url = '/api/user/auth/password';
        data = { email, password };
      }
    } else {
      const code = this.data.code.trim();
      if (!code || code.length !== 6) {
        wx.showToast({ title: '请输入6位验证码', icon: 'none' });
        return;
      }
      url = '/api/user/auth/email/login';
      data = { email, code };
    }

    this.setData({ submitting: true });

    wx.request({
      url: `${app.globalData.baseUrl}${url}`,
      method: 'POST',
      data,
      success: (res) => {
        if (!res.data.success) {
          wx.showToast({ title: res.data.message || '操作失败', icon: 'none' });
          return;
        }

        const token = res.data.data.token;
        app.globalData.token = token;
        wx.setStorageSync('token', token);

        app.refreshUserInfo().then(() => {
          wx.switchTab({ url: '/pages/index/index' });
        }).catch(() => {
          wx.switchTab({ url: '/pages/index/index' });
        });
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        this.setData({ submitting: false });
      }
    });
  },

  wxLogin() {
    this.setData({ submitting: true });
    app.login()
      .then(() => {
        wx.switchTab({ url: '/pages/index/index' });
      })
      .catch((error) => {
        wx.showToast({ title: error.message || '微信登录失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  }
});

const app = getApp();
const { activityRules, serviceInfo } = require('../../data/content');
const {
  buildGridCells,
  buildWheelItems,
  getLotteryModeLabel,
  normalizeLotteryConfig,
  normalizeLotteryResult,
  resolveDisplayPrizeCollection
} = require('../../utils/lotteryTheme');

const HOME_LOTTERY_FOCUS_KEY = 'homeFocusLottery';

function createLotteryState() {
  return {
    loadingLottery: false,
    activeMode: 'wheel',
    activeModeLabel: '大转盘',
    mode: 'wheel',
    config: {
      activeMode: 'wheel',
      wheel: [],
      grid: []
    },
    wheelItems: [],
    gridCells: [],
    wheelRotation: 0,
    wheelDuration: 0,
    gridActiveIndex: -1,
    drawing: false,
    hasDrawn: false,
    result: null
  };
}

function vibrateShort(type = 'medium') {
  try {
    wx.vibrateShort({ type });
  } catch (error) {
    wx.vibrateShort();
  }
}

function vibrateLong() {
  try {
    wx.vibrateLong();
  } catch (error) {
    // ignore
  }
}

Page({
  data: {
    activityRules,
    serviceInfo,
    booting: true,
    isActive: false,
    hasReceived: false,
    hasDrawnLottery: false,
    statusText: '活动未开始',
    countdown: null,
    myRedpacket: null,
    myCoupons: [],
    luckyBagPoster: null,
    receivedAt: '',
    posterPopupVisible: false,
    posterPopupType: 'redpacket',
    posterPopup: null,
    pageEntered: false,
    lotterySectionPulse: false,
    ...createLotteryState()
  },

  onLoad() {
    this._hadReceived = false;
    this._lastPosterPopupKey = '';
    this.bootTimer = setTimeout(() => {
      this.setData({ booting: false });
    }, 900);
    this.triggerPageEntry();
    this.checkActivityStatus();
    this.syncHomeData();
  },

  onShow() {
    this.syncHomeData();
  },

  onHide() {
    clearTimeout(this.gridTimer);
    clearTimeout(this.drawTimer);
    clearTimeout(this.pageEntryTimer);
    clearTimeout(this.lotterySectionPulseTimer);
  },

  onUnload() {
    clearInterval(this.countdownTimer);
    clearTimeout(this.bootTimer);
    clearTimeout(this.gridTimer);
    clearTimeout(this.drawTimer);
    clearTimeout(this.pageEntryTimer);
    clearTimeout(this.lotterySectionPulseTimer);
  },

  triggerPageEntry() {
    clearTimeout(this.pageEntryTimer);
    this.setData({ pageEntered: false });
    this.pageEntryTimer = setTimeout(() => {
      this.setData({ pageEntered: true });
    }, 60);
  },

  async checkActivityStatus() {
    try {
      const data = await app.request({
        url: '/api/status'
      });

      this.setData({
        isActive: data.isActive,
        statusText: data.isActive ? '进行中' : '即将开启'
      });

      if (!data.isActive && data.startTime) {
        this.startCountdown(data.startTime);
      }
    } catch (error) {
      console.error('load activity status failed', error);
    }
  },

  startCountdown(targetTime) {
    const updateCountdown = () => {
      const now = Date.now();
      const target = new Date(targetTime).getTime();
      const diff = target - now;

      if (diff <= 0) {
        this.setData({
          countdown: null,
          isActive: true,
          statusText: '进行中'
        });
        clearInterval(this.countdownTimer);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      this.setData({
        countdown: { days, hours, minutes, seconds }
      });
    };

    updateCountdown();
    clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(updateCountdown, 1000);
  },

  async syncHomeData() {
    if (!app.globalData.token) {
      app.saveLuckyBagSnapshot(null);
      app.saveLotterySnapshot(null);
      this._hadReceived = false;
      this._lastPosterPopupKey = '';
      this.setData({
        hasReceived: false,
        hasDrawnLottery: false,
        myRedpacket: null,
        myCoupons: [],
        luckyBagPoster: null,
        receivedAt: '',
        posterPopupVisible: false,
        posterPopupType: 'redpacket',
        posterPopup: null,
        lotterySectionPulse: false,
        ...createLotteryState()
      });
      return;
    }

    try {
      const [luckyBag, stats] = await Promise.all([
        app.request({ url: '/api/user/luckyBag/my' }),
        app.request({ url: '/api/user/stats' })
      ]);

      if (!luckyBag) {
        app.saveLuckyBagSnapshot(null);
        app.saveLotterySnapshot(null);
        this._hadReceived = false;
        this._lastPosterPopupKey = '';
        this.setData({
          hasReceived: false,
          hasDrawnLottery: false,
          myRedpacket: null,
          myCoupons: [],
          luckyBagPoster: null,
          receivedAt: '',
          posterPopupVisible: false,
          posterPopupType: 'redpacket',
          posterPopup: null,
          lotterySectionPulse: false,
          ...createLotteryState()
        });
        return;
      }

      app.saveLuckyBagSnapshot(luckyBag);

      const [config, drawn] = await Promise.all([
        app.request({ url: '/api/user/lottery/config' }),
        app.request({ url: '/api/user/lottery/my' })
      ]);

      const themedConfig = normalizeLotteryConfig(config);
      const themedResult = normalizeLotteryResult(drawn, themedConfig);
      const displayMode = themedResult?.gameType || themedConfig.activeMode;
      const wheelBoard = resolveDisplayPrizeCollection('wheel', themedConfig, themedResult);
      const gridBoard = resolveDisplayPrizeCollection('grid', themedConfig, themedResult);

      if (themedResult) {
        app.saveLotterySnapshot(themedResult);
      } else {
        app.saveLotterySnapshot(null);
      }

      const nextState = {
        hasReceived: true,
        hasDrawnLottery: !!stats?.hasDrawnLottery || !!themedResult,
        myRedpacket: luckyBag.redPacket || null,
        myCoupons: luckyBag.coupons || [],
        luckyBagPoster: luckyBag.poster || null,
        receivedAt: luckyBag.receivedAt || '',
        loadingLottery: false,
        activeMode: themedConfig.activeMode,
        activeModeLabel: getLotteryModeLabel(themedConfig.activeMode),
        config: themedConfig,
        wheelItems: buildWheelItems(wheelBoard),
        gridCells: buildGridCells(gridBoard),
        mode: displayMode,
        hasDrawn: !!themedResult,
        result: themedResult || null,
        gridActiveIndex: themedResult?.gameType === 'grid' ? themedResult.prize.index : -1,
        wheelRotation: themedResult?.gameType === 'wheel'
          ? this.getWheelTargetRotation(themedResult.prize.index, wheelBoard.length)
          : 0,
        wheelDuration: 0,
        drawing: false
      };

      const justUnlocked = !this._hadReceived && nextState.hasReceived;
      this._hadReceived = nextState.hasReceived;

      this.setData(nextState, () => {
        this.maybeOpenPosterPopup();
        if (justUnlocked) {
          this.scrollToLotterySection({ highlight: true });
        }
        this.consumeHomeFocusFlag();
      });
    } catch (error) {
      console.error('sync home data failed', error);
    }
  },

  getPosterPopupKey() {
    if (!this.data.hasReceived) {
      return '';
    }

    return [
      this.data.receivedAt || this.data.myRedpacket?.amount || 'no-bag',
      this.data.hasDrawnLottery ? 'drawn' : 'pending',
      this.data.result?.prize?.key || this.data.result?.prize?.name || 'no-result'
    ].join(':');
  },

  getSharePoster() {
    const result = this.data.result;
    const basePoster = this.data.luckyBagPoster || {};

    return {
      headline: '分享海报已就绪',
      title: result?.prize?.posterTitle || '把这份青春好运分享出去',
      amount: this.data.myRedpacket?.amount || basePoster.amount || '0.00',
      blessing: result?.prize?.posterMessage || '邀请朋友一起打开青春福袋，领取红包和抽奖惊喜。',
      footer: '分享当前首页，让朋友也来领取福袋并参与抽奖。'
    };
  },

  getRedpacketPoster() {
    const poster = this.data.luckyBagPoster;

    if (poster) {
      return poster;
    }

    return {
      headline: '红包荣誉海报',
      title: '青春福袋已开启',
      amount: this.data.myRedpacket?.amount || '0.00',
      blessing: this.data.myRedpacket?.blessing || '红包结果已到账，欢迎查看你的青年节福利。',
      footer: '当前为展示模式，红包结果为模拟展示。'
    };
  },

  getPosterData(type) {
    return type === 'share' ? this.getSharePoster() : this.getRedpacketPoster();
  },

  showPosterPopup(type = 'random') {
    if (!this.data.hasReceived) {
      return;
    }

    const posterType = type === 'random'
      ? (Math.random() < 0.5 ? 'redpacket' : 'share')
      : type;

    this.setData({
      posterPopupVisible: true,
      posterPopupType: posterType,
      posterPopup: this.getPosterData(posterType)
    });
  },

  maybeOpenPosterPopup() {
    const key = this.getPosterPopupKey();
    if (!key || key === this._lastPosterPopupKey) {
      return;
    }

    this._lastPosterPopupKey = key;
    this.showPosterPopup('random');
  },

  consumeHomeFocusFlag() {
    const shouldFocus = wx.getStorageSync(HOME_LOTTERY_FOCUS_KEY);
    if (!shouldFocus || !this.data.hasReceived) {
      return;
    }

    wx.removeStorageSync(HOME_LOTTERY_FOCUS_KEY);
    this.scrollToLotterySection({ highlight: true });
  },

  scrollToLotterySection({ highlight = false } = {}) {
    if (!this.data.hasReceived) {
      return;
    }

    setTimeout(() => {
      wx.pageScrollTo({
        selector: '#lottery-section',
        duration: 620,
        offsetTop: 12,
        fail: () => {}
      });

      if (highlight) {
        this.setData({ lotterySectionPulse: true });
        clearTimeout(this.lotterySectionPulseTimer);
        this.lotterySectionPulseTimer = setTimeout(() => {
          this.setData({ lotterySectionPulse: false });
        }, 1400);
      }
    }, 220);
  },

  async generateAndUploadPoster() {
    try {
      wx.showLoading({ title: '生成中...' });
      const query = wx.createSelectorQuery();
      query.select('#posterCanvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          if (!res || !res[0] || !res[0].node) {
            wx.hideLoading();
            wx.showToast({ title: '画布初始化失败', icon: 'none' });
            return;
          }
          
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const width = res[0].width;
          const height = res[0].height;
          const poster = this.data.posterPopup || {};
          
          // 简单绘制一个海报
          // 背景色
          ctx.fillStyle = '#0d5fa8';
          ctx.fillRect(0, 0, width, height);

          // 卡片
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(20, 40, width - 40, height - 80, 16);
          ctx.fill();

          ctx.textAlign = 'center';
          ctx.fillStyle = '#333333';
          
          // Headline
          ctx.font = 'bold 20px sans-serif';
          ctx.fillText(poster.headline || '青春分享', width / 2, 80);

          // Amount
          ctx.fillStyle = '#eb4d4b';
          ctx.font = 'bold 36px sans-serif';
          ctx.fillText('¥ ' + (poster.amount || '0.00'), width / 2, 140);
          
          // Title
          ctx.fillStyle = '#333333';
          ctx.font = 'bold 24px sans-serif';
          let title = poster.title || '';
          if (title.length > 12) title = title.substring(0, 12) + '...';
          ctx.fillText(title, width / 2, 190);

          // Blessing
          ctx.font = '16px sans-serif';
          ctx.fillStyle = '#666666';
          let blessing = poster.blessing || '';
          // 简单换行
          if (blessing.length > 14) {
            ctx.fillText('“' + blessing.substring(0,14), width / 2, 240);
            ctx.fillText(blessing.substring(14,28) + '”', width / 2, 270);
          } else {
             ctx.fillText('“' + blessing + '”', width / 2, 250);
          }

          // Footer
          ctx.font = '14px sans-serif';
          ctx.fillStyle = '#aaaaaa';
          ctx.fillText(poster.footer || 'YB-YOUTH', width / 2, height - 70);

          // 导出图片
          wx.canvasToTempFilePath({
            canvas,
            x: 0, y: 0,
            width, height,
            destWidth: width * 2,
            destHeight: height * 2,
            success: async (fileRes) => {
              const tempFilePath = fileRes.tempFilePath;
              
              // 接下来获取 token 并上传
              try {
                wx.showLoading({ title: '上传海报...' });
                const tokenRes = await new Promise((resolve, reject) => {
                  wx.request({
                    url: `${getApp().globalData.baseUrl}/api/user/upload/token`,
                    method: 'GET',
                    header: { Authorization: `Bearer ${getApp().globalData.token}` },
                    success: (r) => resolve(r.data),
                    fail: reject
                  });
                });

                if (!tokenRes.success) throw new Error(tokenRes.message);

                const { token, key, domain, uploadUrl } = tokenRes.data;

                const uploadRes = await new Promise((resolve, reject) => {
                  wx.uploadFile({
                    url: uploadUrl,
                    filePath: tempFilePath,
                    name: 'file',
                    formData: { token, key },
                    success: (r) => {
                      if (r.statusCode === 200) resolve(JSON.parse(r.data));
                      else reject(new Error('上传失败'));
                    },
                    fail: reject
                  });
                });

                const finalUrl = `${domain}/${uploadRes.key}`;
                
                // 通知后端更新数据库中的 url
                await new Promise((resolve) => {
                  wx.request({
                    url: `${getApp().globalData.baseUrl}/api/user/poster/save`,
                    method: 'POST',
                    data: {
                       type: this.data.posterPopupType === 'share' ? 'lottery' : 'luckybag',
                       recordId: this.data.lotterySnapshot ? this.data.lotterySnapshot.id : 1, // 模拟取得 recordID
                       posterUrl: finalUrl
                    },
                    header: { Authorization: `Bearer ${getApp().globalData.token}` },
                    success: resolve
                  });
                });

                wx.hideLoading();

                // 顺便保存到本地相册
                wx.saveImageToPhotosAlbum({
                  filePath: tempFilePath,
                  success: () => {
                    wx.showToast({ title: '保存并上云成功', icon: 'success' });
                  },
                  fail: () => {
                    wx.showToast({ title: '已上云但保存相册失败', icon: 'none' });
                  }
                });

              } catch (e) {
                wx.hideLoading();
                wx.showToast({ title: e.message || '上传异常', icon: 'none' });
              }
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '图片导出失败', icon: 'none' });
            }
          });
        });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '生成错误', icon: 'none' });
    }
  },

  closePosterPopup() {
    this.setData({
      posterPopupVisible: false
    });
  },

  openRandomPoster() {
    this.showPosterPopup('random');
  },

  openSharePoster() {
    this.showPosterPopup('share');
  },

  openRedpacketPoster() {
    this.showPosterPopup('redpacket');
  },

  noop() {},

  getWheelTargetRotation(prizeIndex, count) {
    const segment = 360 / count;
    return 360 - (prizeIndex * segment);
  },

  async onDraw() {
    if (this.data.drawing) {
      return;
    }

    if (this.data.hasDrawn) {
      wx.showToast({
        title: '你已经完成抽奖',
        icon: 'none'
      });
      return;
    }

    vibrateShort('medium');
    this.setData({ drawing: true });

    try {
      const result = await app.request({
        url: '/api/user/lottery/draw',
        method: 'POST',
        data: {
          gameType: this.data.activeMode
        }
      });

      const themedResult = normalizeLotteryResult(result, this.data.config);

      if (themedResult.gameType === 'wheel') {
        this.playWheel(themedResult);
      } else {
        this.playGrid(themedResult);
      }
    } catch (error) {
      this.setData({ drawing: false });
      wx.showToast({
        title: error.message || '抽奖失败',
        icon: 'none'
      });
    }
  },

  playWheel(result) {
    clearTimeout(this.drawTimer);
    const wheelBoard = resolveDisplayPrizeCollection('wheel', this.data.config, result);
    const extraTurns = 360 * 6;
    const rotation = this.data.wheelRotation + extraTurns
      + this.getWheelTargetRotation(result.prize.index, wheelBoard.length);

    this.setData({
      wheelDuration: 4200,
      wheelRotation: rotation
    });

    this.drawTimer = setTimeout(() => {
      this.finishDraw(result);
    }, 4300);
  },

  playGrid(result) {
    clearTimeout(this.gridTimer);
    const gridBoard = resolveDisplayPrizeCollection('grid', this.data.config, result);
    const totalSteps = gridBoard.length * 4 + result.prize.index;
    let step = 0;

    const tick = () => {
      this.setData({
        gridActiveIndex: step % gridBoard.length
      });

      if (step >= totalSteps) {
        this.finishDraw(result);
        return;
      }

      step += 1;
      const remain = totalSteps - step;
      const delay = remain < 6 ? 180 + (6 - remain) * 70 : 90;
      this.gridTimer = setTimeout(tick, delay);
    };

    tick();
  },

  finishDraw(result) {
    clearTimeout(this.gridTimer);
    clearTimeout(this.drawTimer);
    vibrateLong();

    app.saveLotterySnapshot(result);

    this.setData({
      drawing: false,
      hasDrawn: true,
      hasDrawnLottery: true,
      mode: result.gameType,
      result,
      posterPopupVisible: false,
      gridActiveIndex: result.gameType === 'grid' ? result.prize.index : -1,
      wheelRotation: result.gameType === 'wheel'
        ? this.getWheelTargetRotation(
          result.prize.index,
          resolveDisplayPrizeCollection('wheel', this.data.config, result).length
        )
        : this.data.wheelRotation,
      wheelDuration: result.gameType === 'wheel' ? 0 : this.data.wheelDuration
    }, () => {
      this.maybeOpenPosterPopup();
    });
  },

  async onReceiveTap() {
    if (!this.data.isActive) {
      wx.showToast({
        title: '活动尚未开始',
        icon: 'none'
      });
      return;
    }

    if (this.data.hasReceived) {
      this.openRandomPoster();
      return;
    }

    try {
      await app.ensureLogin();
      await app.refreshUserInfo();
      wx.navigateTo({ url: '/pages/lucky-bag/receive' });
    } catch (error) {
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none'
      });
    }
  },

  goToResult() {
    this.closePosterPopup();
    wx.navigateTo({ url: '/pages/lucky-bag/result' });
  },

  goToLottery() {
    wx.navigateTo({ url: '/pages/lottery/index' });
  },

  goToCoupon() {
    wx.switchTab({ url: '/pages/coupon/list' });
  },

  goToRedpacket() {
    wx.navigateTo({ url: '/pages/redpacket/list' });
  },

  goToMerchant() {
    wx.navigateTo({ url: '/pages/merchant/nearby' });
  },

  goToPolicy() {
    wx.navigateTo({ url: '/pages/policy/index' });
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/user/profile' });
  },

  onShareAppMessage() {
    const poster = this.getSharePoster();
    return {
      title: poster.title || '我已经打开青春福袋，快来领取你的青年节福利',
      path: '/pages/index/index'
    };
  }
});

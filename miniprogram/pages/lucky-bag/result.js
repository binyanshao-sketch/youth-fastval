const app = getApp();

const HOME_LOTTERY_FOCUS_KEY = 'homeFocusLottery';

function normalizeCoupons(coupons) {
  return (coupons || []).map((item) => {
    if (item.coupon) {
      return {
        id: item.id,
        code: item.code,
        status: item.status,
        name: item.coupon.name,
        amount: item.coupon.amount,
        minSpend: item.coupon.minSpend,
        validTo: item.coupon.validTo
      };
    }

    return {
      id: item.id,
      name: item.name,
      amount: item.amount,
      minSpend: item.minSpend,
      validTo: item.validTo
    };
  });
}

function formatTimeText(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .replace('T', ' ')
    .replace(/\.\d+Z?$/, '')
    .slice(0, 16);
}

function buildPosterModel(snapshot) {
  const poster = snapshot.poster || {};
  const redPacket = snapshot.redPacket || {};

  return {
    headline: poster.headline || '青春福袋荣誉凭证',
    amount: poster.amount || redPacket.amount || '0.00',
    title: poster.title || '宜宾青年数字荣誉卡',
    blessing: poster.blessing || redPacket.blessing || '青春好运已经同步入账，愿你一路向前。',
    footer: poster.footer || '共青团宜宾市委 · 青春福袋'
  };
}

function buildDeliveryModel(snapshot) {
  const delivery = snapshot.delivery || {};
  const redPacket = snapshot.redPacket || {};
  const toneMap = {
    sent: 'active',
    processing: 'processing',
    failed: 'failed'
  };

  return {
    status: delivery.status || 'pending',
    tone: toneMap[delivery.status] || 'pending',
    title: delivery.title || '待发放',
    description: delivery.description || '结果已生成，红包到账状态会持续同步。',
    channel: delivery.channel || '微信零钱',
    amount: redPacket.amount || '0.00'
  };
}

Page({
  data: {
    ready: false,
    poster: null,
    redPacket: null,
    coupons: [],
    delivery: null,
    policyUrl: '',
    receivedAt: '',
    receivedAtText: '',
    showGlow: true,
    pageEntered: false
  },

  onLoad() {
    this.bootstrap();
  },

  onShow() {
    if (app.globalData.token) {
      this.refreshResult();
    }
  },

  onUnload() {
    clearTimeout(this.pageEntryTimer);
    clearTimeout(this.glowTimer);
  },

  async bootstrap() {
    const snapshot = app.getLuckyBagSnapshot();
    if (snapshot) {
      this.applySnapshot(snapshot);
    }

    this.triggerEntry();
    await this.refreshResult();

    clearTimeout(this.glowTimer);
    this.glowTimer = setTimeout(() => {
      this.setData({ showGlow: false });
    }, 2400);
  },

  triggerEntry() {
    clearTimeout(this.pageEntryTimer);
    this.setData({ pageEntered: false });
    this.pageEntryTimer = setTimeout(() => {
      this.setData({ pageEntered: true });
    }, 60);
  },

  async refreshResult() {
    if (!app.globalData.token) {
      return;
    }

    try {
      const data = await app.request({
        url: '/api/user/luckyBag/my'
      });

      if (data) {
        app.saveLuckyBagSnapshot(data);
        this.applySnapshot(data);
      }
    } catch (error) {
      console.error('refresh result failed', error);
    }
  },

  applySnapshot(snapshot) {
    this.setData({
      ready: true,
      poster: buildPosterModel(snapshot),
      redPacket: snapshot.redPacket || null,
      coupons: normalizeCoupons(snapshot.coupons),
      delivery: buildDeliveryModel(snapshot),
      policyUrl: snapshot.policyUrl || '',
      receivedAt: snapshot.receivedAt || '',
      receivedAtText: formatTimeText(snapshot.receivedAt)
    });
  },

  goToHomeLottery() {
    wx.setStorageSync(HOME_LOTTERY_FOCUS_KEY, '1');
    wx.switchTab({ url: '/pages/index/index' });
  },

  goToCoupons() {
    wx.switchTab({ url: '/pages/coupon/list' });
  },

  goToRedpacket() {
    wx.navigateTo({ url: '/pages/redpacket/list' });
  },

  goToPolicy() {
    wx.navigateTo({ url: '/pages/policy/index' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onShareAppMessage() {
    return {
      title: '我已经拆开青春福袋，快来领取你的九选一红包',
      path: '/pages/index/index'
    };
  }
});

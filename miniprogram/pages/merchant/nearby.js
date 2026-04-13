const app = getApp();
const { merchantCategories, merchantFallbacks } = require('../../data/content');

const GUIDE_BADGES = [
  { label: '青年驿站', tone: 'station', icon: '青' },
  { label: '五四优选', tone: 'featured', icon: '选' }
];

const CATEGORY_COPY = {
  餐饮: '适合青年社交聚会，支持消费券到店核销。',
  文旅: '适合城市探索与周末打卡，路线轻松好安排。',
  零售: '覆盖日常消费与青年优选好物，领取后可直接使用。',
  服务: '适合青年生活服务场景，通勤和办事都更顺手。'
};

function formatDistance(distance) {
  if (distance == null || distance === '') {
    return '';
  }

  if (typeof distance === 'number' && Number.isFinite(distance)) {
    if (distance >= 1000) {
      return `${(distance / 1000).toFixed(distance >= 10000 ? 0 : 1)}km`;
    }
    return `${Math.round(distance)}m`;
  }

  return String(distance);
}

function normalizeMerchant(item, index) {
  const badge = GUIDE_BADGES[index % GUIDE_BADGES.length];
  const distanceText = formatDistance(item.distanceText || item.distance);

  return {
    ...item,
    guideBadge: item.guideBadge || badge.label,
    guideTone: item.guideTone || badge.tone,
    guideIcon: item.guideIcon || badge.icon,
    distanceText: distanceText || '推荐商家',
    couponInfo: item.couponInfo || '支持消费券核销',
    youthTagline: item.description || CATEGORY_COPY[item.category] || '青年友好商家，适合领取福袋后直接到店体验。'
  };
}

Page({
  data: {
    keyword: '',
    currentCategory: '',
    categories: merchantCategories,
    merchants: [],
    loading: true,
    location: null
  },

  onLoad() {
    this.getLocationAndLoad();
  },

  onUnload() {
    clearTimeout(this.searchTimer);
  },

  getLocationAndLoad() {
    wx.getLocation({
      type: 'gcj02',
      success: (result) => {
        this.setData({
          location: {
            latitude: result.latitude,
            longitude: result.longitude
          }
        });
        this.loadMerchants();
      },
      fail: () => {
        this.loadMerchants();
      }
    });
  },

  onSearchInput(event) {
    this.setData({ keyword: event.detail.value });
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.loadMerchants();
    }, 260);
  },

  filterCategory(event) {
    this.setData({
      currentCategory: event.currentTarget.dataset.category
    });
    this.loadMerchants();
  },

  async loadMerchants() {
    this.setData({ loading: true });

    try {
      const data = await app.request({
        url: '/api/user/merchants/nearby',
        data: {
          keyword: this.data.keyword,
          category: this.data.currentCategory,
          latitude: this.data.location?.latitude,
          longitude: this.data.location?.longitude
        }
      });

      const merchants = data.list?.length
        ? data.list.map((item, index) => normalizeMerchant(item, index))
        : this.filterLocalMerchants(merchantFallbacks);
      this.setData({ merchants, loading: false });
    } catch (error) {
      this.setData({
        merchants: this.filterLocalMerchants(merchantFallbacks),
        loading: false
      });
    }
  },

  filterLocalMerchants(source) {
    const keyword = (this.data.keyword || '').trim();
    return source
      .filter((item) => {
        const matchKeyword = !keyword || item.name.includes(keyword);
        const matchCategory = !this.data.currentCategory || item.category === this.data.currentCategory;
        return matchKeyword && matchCategory;
      })
      .map((item, index) => normalizeMerchant(item, index));
  },

  goToDetail(event) {
    const merchant = this.data.merchants.find((item) => String(item.id) === String(event.currentTarget.dataset.id));
    if (merchant) {
      wx.setStorageSync('selectedMerchant', merchant);
    }
    wx.navigateTo({
      url: `/pages/merchant/detail?id=${event.currentTarget.dataset.id}`
    });
  }
});

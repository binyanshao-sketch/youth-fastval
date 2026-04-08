// pages/merchant/nearby.js
const app = getApp()

Page({
  data: {
    keyword: '',
    currentCategory: '',
    categories: [
      { id: 'food', name: '餐饮美食' },
      { id: 'shopping', name: '购物百货' },
      { id: 'entertainment', name: '休闲娱乐' },
      { id: 'service', name: '生活服务' }
    ],
    merchants: [],
    loading: false,
    page: 1,
    hasMore: true,
    location: null
  },

  onLoad() {
    this.getLocation()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadMerchants().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMerchants()
    }
  },

  // 获取位置
  getLocation() {
    wx.showLoading({ title: '定位中...' })
    
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          location: {
            latitude: res.latitude,
            longitude: res.longitude
          }
        })
        this.loadMerchants()
      },
      fail: () => {
        wx.hideLoading()
        // 定位失败也加载商家
        this.loadMerchants()
      }
    })
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
    
    // 防抖
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => {
      this.setData({ page: 1, hasMore: true })
      this.loadMerchants()
    }, 500)
  },

  // 筛选分类
  filterCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ 
      currentCategory: category,
      page: 1, 
      hasMore: true 
    })
    this.loadMerchants()
  },

  // 加载商家
  async loadMerchants() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const data = await app.request({
        url: '/api/merchants/nearby',
        data: {
          page: this.data.page,
          pageSize: 20,
          keyword: this.data.keyword,
          category: this.data.currentCategory,
          latitude: this.data.location?.latitude,
          longitude: this.data.location?.longitude
        }
      })

      this.setData({
        merchants: this.data.page === 1 ? data.list : [...this.data.merchants, ...data.list],
        page: this.data.page + 1,
        hasMore: data.list.length >= 20
      })
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
      wx.hideLoading()
    }
  },

  // 查看详情
  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/merchant/detail?id=${id}`
    })
  }
})

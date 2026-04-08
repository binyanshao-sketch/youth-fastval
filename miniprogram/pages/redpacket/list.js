// pages/redpacket/list.js
const app = getApp()

Page({
  data: {
    list: [],
    total: 0,
    loading: false,
    page: 1,
    hasMore: true
  },

  onLoad() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadData()
    }
  },

  async loadData() {
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const data = await app.request({
        url: '/api/redpacket/list',
        data: {
          page: this.data.page,
          pageSize: 20
        }
      })

      this.setData({
        list: this.data.page === 1 ? data.list : [...this.data.list, ...data.list],
        total: data.total,
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
    }
  },

  async withdraw(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '提现确认',
      content: '确定要提现到微信零钱吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '提现中...' })

          try {
            await app.request({
              url: '/api/redpacket/withdraw',
              method: 'POST',
              data: { id }
            })

            wx.hideLoading()
            wx.showToast({
              title: '提现成功',
              icon: 'success'
            })

            // 刷新列表
            this.setData({ page: 1 })
            this.loadData()

          } catch (error) {
            wx.hideLoading()
            wx.showToast({
              title: error.message || '提现失败',
              icon: 'none'
            })
          }
        }
      }
    })
  }
})

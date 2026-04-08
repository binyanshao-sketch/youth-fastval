const { createApp } = Vue

const API_URL = 'https://api.yibin-youth.com/api/merchant'

createApp({
  data() {
    return {
      isLoggedIn: false,
      phone: '',
      code: '',
      countdown: 0,
      loading: false,
      merchant: {
        name: '',
        category: ''
      },
      stats: {
        todayCount: 0,
        todayAmount: 0,
        totalCount: 0
      },
      records: [],
      showInputDialog: false,
      inputCode: '',
      showResultDialog: false,
      result: {
        success: false,
        message: '',
        code: '',
        amount: 0
      }
    }
  },

  mounted() {
    // 检查登录状态
    const token = localStorage.getItem('merchant_token')
    if (token) {
      this.isLoggedIn = true
      this.loadData()
    }
  },

  methods: {
    // 发送验证码
    async sendCode() {
      if (!/^1[3-9]\d{9}$/.test(this.phone)) {
        alert('请输入正确的手机号')
        return
      }

      try {
        const res = await fetch(`${API_URL}/send-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: this.phone })
        })
        const data = await res.json()
        
        if (data.success) {
          this.countdown = 60
          const timer = setInterval(() => {
            this.countdown--
            if (this.countdown <= 0) clearInterval(timer)
          }, 1000)
        } else {
          alert(data.message || '发送失败')
        }
      } catch (error) {
        alert('发送失败')
      }
    },

    // 登录
    async login() {
      if (!this.phone || !this.code) {
        alert('请输入手机号和验证码')
        return
      }

      this.loading = true

      try {
        const res = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: this.phone, code: this.code })
        })
        const data = await res.json()

        if (data.success) {
          localStorage.setItem('merchant_token', data.data.token)
          this.merchant = data.data.merchant
          this.isLoggedIn = true
          this.loadData()
        } else {
          alert(data.message || '登录失败')
        }
      } catch (error) {
        alert('登录失败')
      } finally {
        this.loading = false
      }
    },

    // 登出
    logout() {
      localStorage.removeItem('merchant_token')
      this.isLoggedIn = false
      this.phone = ''
      this.code = ''
    },

    // 加载数据
    async loadData() {
      await Promise.all([
        this.loadStats(),
        this.loadRecords()
      ])
    },

    // 加载统计
    async loadStats() {
      try {
        const res = await fetch(`${API_URL}/statistics`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('merchant_token')}` }
        })
        const data = await res.json()
        if (data.success) {
          this.stats = data.data
        }
      } catch (error) {
        console.error('加载统计失败:', error)
      }
    },

    // 加载核销记录
    async loadRecords() {
      try {
        const res = await fetch(`${API_URL}/records?page=1&pageSize=20`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('merchant_token')}` }
        })
        const data = await res.json()
        if (data.success) {
          this.records = data.data.records
        }
      } catch (error) {
        console.error('加载记录失败:', error)
      }
    },

    // 扫码
    scanCode() {
      // 调用微信扫一扫
      if (typeof wx !== 'undefined' && wx.scanQRCode) {
        wx.scanQRCode({
          needResult: 1,
          success: (res) => {
            this.inputCode = res.resultStr
            this.verifyCode()
          }
        })
      } else {
        // 非微信环境，模拟扫码
        this.inputCode = 'YB' + Date.now().toString(36).toUpperCase()
        this.showInputDialog = true
      }
    },

    // 核销
    async verifyCode() {
      if (!this.inputCode) {
        alert('请输入券码')
        return
      }

      try {
        const res = await fetch(`${API_URL}/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('merchant_token')}`
          },
          body: JSON.stringify({ code: this.inputCode })
        })
        const data = await res.json()

        this.showInputDialog = false
        this.result = {
          success: data.success,
          message: data.message,
          code: this.inputCode,
          amount: data.data?.amount || 0
        }
        this.showResultDialog = true

        if (data.success) {
          this.loadStats()
          this.loadRecords()
        }

        this.inputCode = ''
      } catch (error) {
        alert('核销失败')
      }
    },

    // 关闭结果弹窗
    closeResult() {
      this.showResultDialog = false
    }
  }
}).mount('#app')

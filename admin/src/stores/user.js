import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')) : null)

  // 登录
  async function login(username, password) {
    const res = await api.login({ username, password })
    if (res.success) {
      token.value = res.data.token
      userInfo.value = res.data.userInfo
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('userInfo', JSON.stringify(res.data.userInfo))
    }
    return res
  }

  // 登出
  function logout() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  // 获取用户信息
  async function getUserInfo() {
    if (!token.value) return null
    
    const res = await api.getUserInfo()
    if (res.success) {
      userInfo.value = res.data
      localStorage.setItem('userInfo', JSON.stringify(res.data))
    }
    return res
  }

  return {
    token,
    userInfo,
    login,
    logout,
    getUserInfo
  }
})

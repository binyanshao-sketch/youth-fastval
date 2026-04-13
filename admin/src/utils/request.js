import axios from 'axios'
import { ElMessage } from 'element-plus'

function resolveAdminApiBase() {
  const fromEnv = import.meta.env.VITE_API_URL
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '')
  }

  const { hostname, port, origin } = window.location
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '5173') {
    return '/api/admin'
  }

  return `${origin.replace(/\/+$/, '')}/api/admin`
}

function getLoginPath() {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  return `${base || ''}/login`
}

const request = axios.create({
  baseURL: resolveAdminApiBase(),
  timeout: 30000
})

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          localStorage.removeItem('token')
          localStorage.removeItem('userInfo')
          window.location.href = getLoginPath()
          break
        case 403:
          ElMessage.error('没有权限访问该接口')
          break
        case 500:
          ElMessage.error('服务器内部错误')
          break
        default:
          ElMessage.error(error.response.data?.message || '请求失败')
      }
    } else {
      ElMessage.error('网络连接失败')
    }

    return Promise.reject(error)
  }
)

export default request

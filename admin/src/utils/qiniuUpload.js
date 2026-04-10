/**
 * 七牛云客户端直传工具
 *
 * 流程：
 *   1. 调用后端 /api/admin/upload/token 获取 token、key、uploadUrl
 *   2. 用 FormData 直接 POST 到七牛上传节点
 *   3. 返回 CDN 访问 URL
 */

import api from '@/api'

/**
 * 上传文件到七牛云
 * @param {File} file               - 要上传的 File 对象
 * @param {string} [prefix]         - 存储路径前缀，如 'merchant/license/'
 * @param {function} [onProgress]   - 进度回调 (percentage: number) => void
 * @returns {Promise<string>}        - 解析为 CDN 访问 URL
 */
export async function uploadToQiniu(file, prefix = 'uploads/', onProgress = null) {
  const tokenRes = await api.getUploadToken(prefix)
  if (!tokenRes.success) {
    throw new Error(tokenRes.message || '获取上传凭证失败')
  }

  const { token, key, uploadUrl, domain } = tokenRes.data

  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('token', token)
    form.append('key', key)
    form.append('file', file)

    const xhr = new XMLHttpRequest()

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(`${domain}/${key}`)
      } else {
        let message = '上传失败'
        try {
          const result = JSON.parse(xhr.responseText)
          message = result.error || message
        } catch (_e) { /* ignore */ }
        reject(new Error(message))
      }
    }

    xhr.onerror = () => reject(new Error('网络错误，上传失败'))

    xhr.open('POST', uploadUrl)
    xhr.send(form)
  })
}

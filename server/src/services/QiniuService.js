/**
 * 七牛云服务
 * - 生成客户端上传凭证（直传令牌）
 * - 构建 CDN 访问 URL
 * - 服务端删除文件
 */

const qiniu = require('qiniu');
const logger = require('../utils/logger');

class QiniuService {
  constructor() {
    this._mac = null;
    this._bucketManager = null;
  }

  get accessKey() { return process.env.QINIU_ACCESS_KEY; }
  get secretKey() { return process.env.QINIU_SECRET_KEY; }
  get bucket() { return process.env.QINIU_BUCKET; }
  get cdnDomain() {
    const d = process.env.QINIU_CDN_DOMAIN || '';
    return d.endsWith('/') ? d.slice(0, -1) : d;
  }

  /**
   * 是否已配置七牛云
   */
  isConfigured() {
    return !!(this.accessKey && this.secretKey && this.bucket && this.cdnDomain);
  }

  getMac() {
    if (!this._mac) {
      this._mac = new qiniu.auth.digest.Mac(this.accessKey, this.secretKey);
    }
    return this._mac;
  }

  getBucketManager() {
    if (!this._bucketManager) {
      const config = new qiniu.conf.Config();
      this._bucketManager = new qiniu.rs.BucketManager(this.getMac(), config);
    }
    return this._bucketManager;
  }

  /**
   * 生成客户端直传 Token
   * @param {object} options
   * @param {string} [options.prefix]  - 文件名前缀，如 'merchant/license/'
   * @param {number} [options.expires] - 凭证有效期（秒），默认 1800
   * @param {number} [options.fsizeLimit] - 文件大小上限（字节），默认 5MB
   * @returns {{ token: string, key: string, domain: string }}
   */
  getUploadToken({ prefix = 'uploads/', expires = 1800, fsizeLimit = 5 * 1024 * 1024 } = {}) {
    if (!this.isConfigured()) {
      throw new Error('七牛云未配置');
    }

    const randomId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const key = `${prefix}${randomId}`;

    const putPolicy = new qiniu.rs.PutPolicy({
      scope: `${this.bucket}:${key}`,
      expires,
      fsizeLimit,
      // 限制 MIME 类型为图片
      mimeLimit: 'image/jpeg;image/png;image/gif;image/webp'
    });

    const token = putPolicy.uploadToken(this.getMac());

    return {
      token,
      key,
      domain: this.cdnDomain,
      // 七牛华东区上传节点（可按实际 bucket 区域更换）
      uploadUrl: process.env.QINIU_UPLOAD_URL || 'https://up-z2.qiniup.com'
    };
  }

  /**
   * 根据 key 拼接 CDN 公开访问 URL
   * @param {string} key
   * @returns {string}
   */
  buildUrl(key) {
    if (!key) return '';
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    return `${this.cdnDomain}/${key}`;
  }

  /**
   * 删除七牛上的文件
   * @param {string} key
   */
  deleteFile(key) {
    if (!this.isConfigured() || !key) return Promise.resolve();

    return new Promise((resolve) => {
      this.getBucketManager().delete(this.bucket, key, (err) => {
        if (err) {
          logger.warn('七牛文件删除失败', { key, error: err.message });
        }
        resolve();
      });
    });
  }
}

module.exports = new QiniuService();

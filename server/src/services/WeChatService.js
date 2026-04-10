/**
 * 微信能力适配层
 * 支持 mock 与 real 两种模式
 */

const axios = require('axios');
const crypto = require('crypto');
const WeChatPayService = require('./WeChatPayService');

class WeChatService {
  constructor(redis) {
    this.redis = redis;
  }

  isMockMode() {
    return process.env.WX_USE_MOCK === 'true';
  }

  getSessionKeyCacheKey(userId) {
    return `wechat:session:${userId}`;
  }

  async login(code) {
    if (this.isMockMode()) {
      return {
        openid: `test_openid_${code}`,
        unionid: `test_unionid_${code}`,
        sessionKey: Buffer.from(`session_key_${code}`.padEnd(16, '0').slice(0, 16)).toString('base64')
      };
    }

    const response = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WX_APPID,
        secret: process.env.WX_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      },
      timeout: 10000
    });

    if (response.data.errcode) {
      throw new Error(response.data.errmsg || '微信登录失败');
    }

    return {
      openid: response.data.openid,
      unionid: response.data.unionid,
      sessionKey: response.data.session_key
    };
  }

  async saveSession(userId, sessionKey) {
    if (!this.redis || !sessionKey) {
      return;
    }

    await this.redis.set(this.getSessionKeyCacheKey(userId), sessionKey, 'EX', 7200);
  }

  async decryptPhone(userId, encryptedData, iv) {
    if (this.isMockMode()) {
      const suffix = String(1000 + Number(userId || 0)).slice(-4);
      return `1380000${suffix}`;
    }

    if (!this.redis) {
      throw new Error('Redis 未初始化，无法解密手机号');
    }

    const sessionKey = await this.redis.get(this.getSessionKeyCacheKey(userId));
    if (!sessionKey) {
      throw new Error('微信会话已过期，请重新登录');
    }

    const decipher = crypto.createDecipheriv(
      'aes-128-cbc',
      Buffer.from(sessionKey, 'base64'),
      Buffer.from(iv, 'base64')
    );
    decipher.setAutoPadding(true);

    let decoded = decipher.update(encryptedData, 'base64', 'utf8');
    decoded += decipher.final('utf8');

    const payload = JSON.parse(decoded);
    if (!payload.phoneNumber) {
      throw new Error('手机号解密失败');
    }

    return payload.phoneNumber;
  }

  /**
   * 微信公众号 H5 OAuth 登录（snsapi_base 静默授权，仅获取 openid）
   * 需要配置 WX_H5_APPID / WX_H5_SECRET 环境变量
   */
  async h5OAuth(code) {
    if (this.isMockMode()) {
      return {
        openid: `h5wx_test_${code}`,
        unionid: null
      };
    }

    const appId = process.env.WX_H5_APPID;
    const secret = process.env.WX_H5_SECRET;
    if (!appId || !secret) {
      throw new Error('微信公众号未配置（缺少 WX_H5_APPID / WX_H5_SECRET）');
    }

    const response = await axios.get('https://api.weixin.qq.com/sns/oauth2/access_token', {
      params: {
        appid: appId,
        secret,
        code,
        grant_type: 'authorization_code'
      },
      timeout: 10000
    });

    if (response.data.errcode) {
      throw new Error(response.data.errmsg || '微信授权失败');
    }

    return {
      openid: response.data.openid,
      unionid: response.data.unionid || null
    };
  }

  async transferToBalance(openid, amount, orderNo) {
    if (this.isMockMode()) {
      return {
        success: true,
        data: {
          paymentNo: `mock_${orderNo}`,
          paymentTime: new Date().toISOString()
        }
      };
    }

    const result = await WeChatPayService.transferToBalance(openid, amount, orderNo);
    if (!result.success) {
      throw new Error(result.message || '微信付款失败');
    }

    return result;
  }
}

module.exports = WeChatService;
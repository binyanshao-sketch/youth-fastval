/**
 * 微信支付服务
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

class WeChatPayService {
  constructor() {
    this.appId = process.env.WX_APPID;
    this.mchId = process.env.WX_PAY_MCHID;
    this.apiKey = process.env.WX_PAY_KEY;
    this.certPath = process.env.WX_PAY_CERT_PATH;
    this.keyPath = process.env.WX_PAY_KEY_PATH;
    
    // 企业付款到零钱API
    this.transferUrl = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers';
  }
  
  /**
   * 企业付款到零钱
   * @param {string} openid - 用户openid
   * @param {number} amount - 金额（元）
   * @param {string} orderId - 商户订单号
   * @param {string} desc - 付款描述
   */
  async transferToBalance(openid, amount, orderId, desc = '五四青春福袋红包提现') {
    const params = {
      mch_appid: this.appId,
      mchid: this.mchId,
      nonce_str: this.generateNonceStr(),
      partner_trade_no: orderId,
      openid: openid,
      check_name: 'NO_CHECK',
      amount: Math.round(amount * 100), // 转为分
      desc: desc,
      spbill_create_ip: '127.0.0.1'
    };
    
    // 生成签名
    params.sign = this.generateSign(params);
    
    // 转换为XML
    const xml = this.buildXml(params);
    
    try {
      const result = await this.requestWithCert(this.transferUrl, xml);
      
      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return {
          success: true,
          data: {
            paymentNo: result.payment_no,
            paymentTime: result.payment_time
          }
        };
      } else {
        return {
          success: false,
          message: result.err_code_des || result.return_msg || '付款失败'
        };
      }
    } catch (error) {
      console.error('企业付款失败:', error);
      return {
        success: false,
        message: error.message || '付款失败'
      };
    }
  }
  
  /**
   * 查询企业付款
   * @param {string} orderId - 商户订单号
   */
  async queryTransfer(orderId) {
    const params = {
      appid: this.appId,
      mch_id: this.mchId,
      partner_trade_no: orderId,
      nonce_str: this.generateNonceStr()
    };
    
    params.sign = this.generateSign(params);
    const xml = this.buildXml(params);
    
    const url = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/gettransferinfo';
    
    try {
      const result = await this.requestWithCert(url, xml);
      
      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return {
          success: true,
          data: {
            status: result.status,
            reason: result.reason,
            openid: result.openid,
            transferName: result.transfer_name,
            paymentAmount: result.payment_amount,
            transferTime: result.transfer_time,
            desc: result.desc
          }
        };
      } else {
        return {
          success: false,
          message: result.err_code_des || '查询失败'
        };
      }
    } catch (error) {
      console.error('查询付款失败:', error);
      return {
        success: false,
        message: error.message || '查询失败'
      };
    }
  }
  
  /**
   * 生成签名
   */
  generateSign(params) {
    // 按字典序排序
    const sortedKeys = Object.keys(params).sort();
    const stringA = sortedKeys
      .filter(key => params[key] !== '' && key !== 'sign')
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const stringSignTemp = `${stringA}&key=${this.apiKey}`;
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
  }
  
  /**
   * 生成随机字符串
   */
  generateNonceStr(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  /**
   * 构建XML
   */
  buildXml(params) {
    let xml = '<xml>';
    for (const key in params) {
      if (params[key] !== undefined && params[key] !== '') {
        xml += `<${key}><![CDATA[${params[key]}]]></${key}>`;
      }
    }
    xml += '</xml>';
    return xml;
  }
  
  /**
   * 解析XML
   */
  parseXml(xml) {
    const result = {};
    const regex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>|<(\w+)>(.*?)<\/\3>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const key = match[1] || match[3];
      const value = match[2] || match[4];
      result[key] = value;
    }
    return result;
  }
  
  /**
   * 带证书的HTTPS请求
   */
  async requestWithCert(url, xml) {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        key: fs.readFileSync(this.keyPath),
        cert: fs.readFileSync(this.certPath),
        headers: {
          'Content-Type': 'application/xml',
          'Content-Length': Buffer.byteLength(xml)
        }
      };
      
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(this.parseXml(data));
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', reject);
      req.write(xml);
      req.end();
    });
  }
}

module.exports = new WeChatPayService();

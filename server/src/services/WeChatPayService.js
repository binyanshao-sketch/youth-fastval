const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const logger = require('../utils/logger');

class WeChatPayService {
  constructor() {
    this.appId = process.env.WX_APPID;
    this.mchId = process.env.WX_PAY_MCHID;
    this.apiKey = process.env.WX_PAY_KEY;
    this.certPath = process.env.WX_PAY_CERT_PATH;
    this.keyPath = process.env.WX_PAY_KEY_PATH;
    this.spbillCreateIp = process.env.WX_PAY_SPBILL_IP || '127.0.0.1';
    this.transferUrl = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers';
  }

  async transferToBalance(openid, amount, orderId, desc = '五四青春福袋红包提现') {
    this.validateConfig();

    const params = {
      mch_appid: this.appId,
      mchid: this.mchId,
      nonce_str: this.generateNonceStr(),
      partner_trade_no: orderId,
      openid,
      check_name: 'NO_CHECK',
      amount: Math.round(amount * 100),
      desc,
      spbill_create_ip: this.spbillCreateIp
    };

    params.sign = this.generateSign(params);
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
      }

      return {
        success: false,
        message: result.err_code_des || result.return_msg || '微信付款失败'
      };
    } catch (error) {
      logger.error('wechat transfer failed', { error: error.message });
      return {
        success: false,
        message: error.message || '微信付款失败'
      };
    }
  }

  async queryTransfer(orderId) {
    this.validateConfig();

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
      }

      return {
        success: false,
        message: result.err_code_des || '查询失败'
      };
    } catch (error) {
      logger.error('query wechat transfer failed', { error: error.message });
      return {
        success: false,
        message: error.message || '查询失败'
      };
    }
  }

  generateSign(params) {
    const sortedKeys = Object.keys(params).sort();
    const stringA = sortedKeys
      .filter((key) => params[key] !== '' && key !== 'sign')
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    const stringSignTemp = `${stringA}&key=${this.apiKey}`;
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
  }

  generateNonceStr(length = 32) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  }

  validateConfig() {
    const required = [
      ['WX_APPID', this.appId],
      ['WX_PAY_MCHID', this.mchId],
      ['WX_PAY_KEY', this.apiKey],
      ['WX_PAY_CERT_PATH', this.certPath],
      ['WX_PAY_KEY_PATH', this.keyPath],
      ['WX_PAY_SPBILL_IP', this.spbillCreateIp]
    ];

    const missing = required.filter(([, value]) => !value).map(([key]) => key);
    if (missing.length > 0) {
      throw new Error(`缺少微信支付配置: ${missing.join(', ')}`);
    }

    if (!fs.existsSync(this.keyPath)) {
      throw new Error(`微信支付私钥文件不存在: ${this.keyPath}`);
    }

    if (!fs.existsSync(this.certPath)) {
      throw new Error(`微信支付证书文件不存在: ${this.certPath}`);
    }
  }

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
        res.on('data', (chunk) => {
          data += chunk;
        });
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

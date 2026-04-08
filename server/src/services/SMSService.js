/**
 * 短信服务（腾讯云SMS）
 */

const tencentcloud = require("tencentcloud-sdk-nodejs-sms");

const SmsClient = tencentcloud.sms.v20210111.Client;

class SMSService {
  constructor() {
    this.client = new SmsClient({
      credential: {
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY,
      },
      region: "ap-guangzhou",
      profile: {
        httpProfile: {
          endpoint: "sms.tencentcloudapi.com",
        },
      },
    });
    
    this.appId = process.env.TENCENT_SMS_APP_ID;
    this.templateId = process.env.TENCENT_SMS_TEMPLATE_ID;
    this.signName = process.env.TENCENT_SMS_SIGN;
  }
  
  /**
   * 发送验证码短信
   * @param {string} phone - 手机号
   * @param {string} content - 短信内容
   */
  async send(phone, content) {
    // 开发环境模拟发送
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SMS Mock] 发送到 ${phone}: ${content}`);
      return { success: true };
    }
    
    try {
      const params = {
        PhoneNumberSet: [`+86${phone}`],
        SmsSdkAppId: this.appId,
        SignName: this.signName,
        TemplateId: this.templateId,
        TemplateParamSet: [content.match(/\d{6}/)?.[0] || '', '5'],
      };
      
      const response = await this.client.SendSms(params);
      
      if (response.SendStatusSet[0].Code === 'Ok') {
        return { success: true };
      } else {
        return {
          success: false,
          message: response.SendStatusSet[0].Message
        };
      }
    } catch (error) {
      console.error('发送短信失败:', error);
      return {
        success: false,
        message: error.message || '发送失败'
      };
    }
  }
  
  /**
   * 批量发送短信
   * @param {string[]} phones - 手机号数组
   * @param {string} content - 短信内容
   */
  async sendBatch(phones, content) {
    // 开发环境模拟发送
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SMS Mock] 批量发送到 ${phones.length} 个号码: ${content}`);
      return { success: true };
    }
    
    try {
      const phoneSet = phones.map(p => `+86${p}`);
      
      const params = {
        PhoneNumberSet: phoneSet,
        SmsSdkAppId: this.appId,
        SignName: this.signName,
        TemplateId: this.templateId,
        TemplateParamSet: [content.match(/\d{6}/)?.[0] || '', '5'],
      };
      
      const response = await this.client.SendSms(params);
      
      const failedPhones = response.SendStatusSet
        .filter(s => s.Code !== 'Ok')
        .map((s, i) => phones[i]);
      
      if (failedPhones.length === 0) {
        return { success: true };
      } else {
        return {
          success: false,
          message: `部分发送失败: ${failedPhones.join(', ')}`
        };
      }
    } catch (error) {
      console.error('批量发送短信失败:', error);
      return {
        success: false,
        message: error.message || '发送失败'
      };
    }
  }
}

module.exports = new SMSService();

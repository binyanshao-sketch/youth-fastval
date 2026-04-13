const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class EmailService {
  constructor(models) {
    this.models = models;
    this.transporter = null;
  }

  getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    return this.transporter;
  }

  generateCode() {
    return String(crypto.randomInt(100000, 999999));
  }

  async sendVerifyCode(email, purpose = 'login') {
    const recentCount = await this.models.EmailVerifyCode.count({
      where: {
        email,
        created_at: { [Op.gte]: new Date(Date.now() - 60 * 1000) }
      }
    });

    if (recentCount > 0) {
      throw new Error('验证码发送过于频繁，请1分钟后再试');
    }

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.models.EmailVerifyCode.create({
      email,
      code,
      purpose,
      expires_at: expiresAt
    });

    const transporter = this.getTransporter();
    if (!transporter) {
      logger.warn('SMTP not configured, mock code generated', { email, code });
      return { mock: true, code };
    }

    try {
      await transporter.sendMail({
        from: `"三江青年福袋" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '三江青年福袋 - 登录验证码',
        html: `
          <div style="max-width:400px;margin:0 auto;font-family:sans-serif;padding:24px;">
            <h2 style="color:#0d5fa8;">三江青年福袋</h2>
            <p>您的登录验证码是：</p>
            <div style="font-size:32px;font-weight:bold;color:#0d5fa8;letter-spacing:8px;margin:20px 0;">${code}</div>
            <p style="color:#666;font-size:13px;">验证码10分钟内有效，请勿泄露给他人。</p>
          </div>
        `
      });
    } catch (error) {
      logger.error('Failed to send verify email', { email, error: error.message });
      throw new Error('邮件发送失败，请稍后再试');
    }

    return { mock: false };
  }

  async verifyCode(email, code, purpose = 'login') {
    const record = await this.models.EmailVerifyCode.findOne({
      where: {
        email,
        code,
        purpose,
        used: 0,
        expires_at: { [Op.gt]: new Date() }
      },
      order: [['id', 'DESC']]
    });

    if (!record) {
      return false;
    }

    await record.update({ used: 1 });
    return true;
  }
}

module.exports = EmailService;

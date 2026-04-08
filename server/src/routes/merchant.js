/**
 * 商家端API路由
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const { requireRole } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const SMSService = require('../services/SMSService');
const CouponService = require('../services/CouponService');
const logger = require('../utils/logger');

const merchantAuth = requireRole('merchant');

// 发送验证码（限流：每分钟最多 1 次）
router.post('/send-code', [
  rateLimit({ windowMs: 60000, max: 1, message: '验证码发送过于频繁，请稍后再试' })
], async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: '请输入正确的手机号' });
    }

    const { Merchant } = req.models;
    const codeKey = `merchant:login-code:${phone}`;

    // 检查商家是否存在
    const merchant = await Merchant.findOne({ where: { contact_phone: phone, status: 2 } });
    if (!merchant) {
      return res.status(400).json({ success: false, message: '该手机号未注册商家' });
    }

    // 使用 crypto 安全随机数生成验证码
    const code = String(crypto.randomInt(100000, 999999));

    await req.redis.set(codeKey, code, 'EX', 300);

    // 发送短信
    await SMSService.send(phone, `您的验证码是：${code}，5分钟内有效。`);

    res.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    logger.error('发送验证码失败', { error: error.message });
    res.status(500).json({ success: false, message: '发送失败' });
  }
});

// 商家登录（限流：每分钟最多 5 次）
router.post('/login', [
  rateLimit({ windowMs: 60000, max: 5, message: '登录尝试过于频繁，请稍后再试' })
], async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ success: false, message: '请输入手机号和验证码' });
    }

    const { Merchant } = req.models;
    const codeKey = `merchant:login-code:${phone}`;

    const merchant = await Merchant.findOne({ where: { contact_phone: phone } });
    if (!merchant) {
      return res.status(400).json({ success: false, message: '商家不存在' });
    }

    if (merchant.status !== 2) {
      return res.status(400).json({ success: false, message: '商家账号已被禁用' });
    }

    // 验证码校验（使用时序安全比较防止时序攻击）
    const cachedCode = await req.redis.get(codeKey);
    if (!cachedCode || !timingSafeEqual(cachedCode, code)) {
      return res.status(400).json({ success: false, message: '验证码错误或已过期' });
    }

    // 生成token（包含 type 字段用于角色鉴权）
    const token = jwt.sign(
      { merchantId: merchant.id, type: 'merchant' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 清除验证码
    await req.redis.del(codeKey);

    res.json({
      success: true,
      data: {
        token,
        merchant: {
          id: merchant.id,
          name: merchant.name,
          phone: merchant.contact_phone,
          category: merchant.category
        }
      }
    });
  } catch (error) {
    logger.error('商家登录失败', { error: error.message });
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 核销消费券（限流：每秒最多 5 次，防止批量刷核销）
router.post('/verify', [
  ...merchantAuth,
  rateLimit({ windowMs: 1000, max: 5 })
], async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: '请输入券码' });
    }

    const merchantId = req.merchantId;
    const couponService = new CouponService(req.models);
    const result = await couponService.confirmVerify(merchantId, code);

    res.json({
      success: true,
      message: '核销成功',
      data: {
        code: result.code,
        amount: result.amount,
        receiptNo: result.receiptNo
      }
    });
  } catch (error) {
    logger.error('核销失败', { error: error.message });
    res.status(400).json({ success: false, message: error.message || '核销失败' });
  }
});

// 核销统计
router.get('/statistics', merchantAuth, async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const couponService = new CouponService(req.models);
    const statistics = await couponService.getMerchantStatistics(merchantId);

    res.json({
      success: true,
      data: {
        todayCount: statistics.today.count,
        todayAmount: Number(statistics.today.amount || 0).toFixed(2),
        totalCount: statistics.total.count,
        totalAmount: Number(statistics.total.amount || 0).toFixed(2)
      }
    });
  } catch (error) {
    logger.error('获取统计失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 核销记录
router.get('/records', merchantAuth, async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const { page = 1, pageSize = 20 } = req.query;
    const couponService = new CouponService(req.models);
    const result = await couponService.getMerchantVerifyRecords(merchantId, parseInt(page), parseInt(pageSize));

    res.json({
      success: true,
      data: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        records: result.records.map(r => ({
          id: r.id,
          code: r.code,
          amount: r.coupon_amount,
          time: dayjs(r.verified_at).format('YYYY-MM-DD HH:mm:ss')
        }))
      }
    });
  } catch (error) {
    logger.error('获取记录失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

/**
 * 时序安全的字符串比较（防止时序攻击）
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

module.exports = router;

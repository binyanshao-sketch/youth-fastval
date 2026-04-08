/**
 * 商家端API路由
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const moment = require('moment');
const authMiddleware = require('../middleware/auth');
const SMSService = require('../services/SMSService');
const CouponService = require('../services/CouponService');

// 发送验证码
router.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    const { Merchant } = req.models;
    const codeKey = `merchant:login-code:${phone}`;
    
    // 检查商家是否存在
    const merchant = await Merchant.findOne({ where: { contact_phone: phone, status: 2 } });
    if (!merchant) {
      return res.status(400).json({ success: false, message: '该手机号未注册商家' });
    }
    
    // 生成验证码
    const code = Math.random().toString().slice(-6);
    
    await req.redis.set(codeKey, code, 'EX', 300);
    
    // 发送短信
    await SMSService.send(phone, `您的验证码是：${code}，5分钟内有效。`);
    
    res.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({ success: false, message: '发送失败' });
  }
});

// 商家登录
router.post('/login', async (req, res) => {
  try {
    const { phone, code } = req.body;
    const { Merchant } = req.models;
    const codeKey = `merchant:login-code:${phone}`;
    
    const merchant = await Merchant.findOne({ where: { contact_phone: phone } });
    if (!merchant) {
      return res.status(400).json({ success: false, message: '商家不存在' });
    }
    
    if (merchant.status !== 2) {
      return res.status(400).json({ success: false, message: '商家账号已被禁用' });
    }
    
    // 验证码校验
    const cachedCode = await req.redis.get(codeKey);
    if (!cachedCode || cachedCode !== code) {
      return res.status(400).json({ success: false, message: '验证码错误或已过期' });
    }
    
    // 生成token
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
    console.error('商家登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 核销消费券
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
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
    console.error('核销失败:', error);
    res.status(400).json({ success: false, message: error.message || '核销失败' });
  }
});

// 核销统计
router.get('/statistics', authMiddleware, async (req, res) => {
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
    console.error('获取统计失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 核销记录
router.get('/records', authMiddleware, async (req, res) => {
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
          time: moment(r.verified_at).format('YYYY-MM-DD HH:mm:ss')
        }))
      }
    });
  } catch (error) {
    console.error('获取记录失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

module.exports = router;

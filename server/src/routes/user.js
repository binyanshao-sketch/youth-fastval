/**
 * API 路由 - 用户端
 */

const express = require('express');
const router = express.Router();
const { QueryTypes } = require('sequelize');
const { body, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

// 中间件
const { requireRole } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// 服务
const LuckyBagService = require('../services/LuckyBagService');
const CouponService = require('../services/CouponService');
const WeChatService = require('../services/WeChatService');

const userAuth = requireRole('user');

/**
 * 微信登录
 * POST /api/user/login
 */
router.post('/login', [
  body('code').notEmpty().withMessage('缺少微信登录code')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { code } = req.body;

    const weChatService = new WeChatService(req.redis);
    const wxResult = await weChatService.login(code);

    // 查找或创建用户
    let user = await req.models.User.findOne({ where: { openid: wxResult.openid } });

    if (!user) {
      user = await req.models.User.create({
        openid: wxResult.openid,
        unionid: wxResult.unionid,
        status: 1
      });
    }

    await weChatService.saveSession(user.id, wxResult.sessionKey);

    // 生成JWT token（包含 type 用于角色鉴权）
    const token = req.app.locals.jwt.sign({ userId: user.id, type: 'user' });

    res.json({
      success: true,
      data: {
        token,
        openid: wxResult.openid,
        isNewUser: !user.phone
      }
    });
  } catch (error) {
    logger.error('登录失败', { error: error.message });
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

/**
 * 获取用户信息
 * GET /api/user/info
 */
router.get('/info', userAuth, async (req, res) => {
  try {
    const user = await req.models.User.findByPk(req.userId, {
      attributes: ['id', 'openid', 'phone', 'nickname', 'avatar', 'gender', 'city', 'province', 'status']
    });

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('获取用户信息失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

/**
 * 绑定手机号
 * POST /api/user/bindPhone
 */
router.post('/bindPhone', [
  ...userAuth,
  body('encryptedData').notEmpty(),
  body('iv').notEmpty()
], async (req, res) => {
  try {
    const { encryptedData, iv } = req.body;
    const userId = req.userId;

    const weChatService = new WeChatService(req.redis);
    const phone = await weChatService.decryptPhone(userId, encryptedData, iv);

    // 检查手机号是否已被使用
    const existUser = await req.models.User.findOne({ where: { phone } });
    if (existUser && existUser.id !== userId) {
      return res.status(400).json({ success: false, message: '该手机号已被使用' });
    }

    // 更新用户手机号
    await req.models.User.update({ phone }, { where: { id: userId } });

    res.json({ success: true, message: '绑定成功' });
  } catch (error) {
    logger.error('绑定手机号失败', { error: error.message });
    res.status(500).json({ success: false, message: '绑定失败' });
  }
});

/**
 * 领取福袋
 * POST /api/luckyBag/receive
 */
router.post('/luckyBag/receive', [
  ...userAuth,
  rateLimit({ windowMs: 60000, max: 1 }) // 每分钟只能请求1次
], async (req, res) => {
  try {
    const userId = req.userId;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    const luckyBagService = new LuckyBagService(req.models, req.app.locals.redis);
    const result = await luckyBagService.receive(userId, ip, userAgent);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('领取福袋失败', { error: error.message, userId: req.userId });
    res.status(400).json({
      success: false,
      message: error.message || '领取失败'
    });
  }
});

/**
 * 获取我的福袋
 * GET /api/luckyBag/my
 */
router.get('/luckyBag/my', userAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const luckyBagService = new LuckyBagService(req.models, req.app.locals.redis);
    const result = await luckyBagService.getUserLuckyBag(userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('获取福袋信息失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

/**
 * 提现红包
 * POST /api/redpacket/withdraw
 */
router.post('/redpacket/withdraw', [
  ...userAuth,
  rateLimit({ windowMs: 60000, max: 3 })
], async (req, res) => {
  try {
    const userId = req.userId;

    const record = await req.models.LuckyBagRecord.findOne({
      where: { user_id: userId }
    });

    if (!record) {
      return res.status(400).json({ success: false, message: '未领取福袋' });
    }

    if (record.redpacket_status === 2) {
      return res.status(400).json({ success: false, message: '红包已提现' });
    }

    // 触发红包发放
    const luckyBagService = new LuckyBagService(req.models, req.app.locals.redis);
    await luckyBagService.sendRedPacket(userId, record.redpacket_amount, record.id);

    res.json({
      success: true,
      message: '红包已发送到微信零钱'
    });
  } catch (error) {
    logger.error('提现失败', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: error.message || '提现失败' });
  }
});

/**
 * 红包记录列表
 * GET /api/redpacket/list
 */
router.get('/redpacket/list', userAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const record = await req.models.LuckyBagRecord.findOne({
      where: { user_id: userId },
      order: [['received_at', 'DESC']]
    });

    const list = record ? [{
      id: record.id,
      amount: record.redpacket_amount,
      status: record.redpacket_status,
      orderNo: record.redpacket_order_no,
      sentAt: record.redpacket_sent_at,
      receivedAt: record.received_at
    }] : [];

    res.json({
      success: true,
      data: {
        list,
        total: list.length
      }
    });
  } catch (error) {
    logger.error('获取红包记录失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

/**
 * 获取我的消费券
 * GET /api/coupons/my
 */
router.get('/coupons/my', userAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { status } = req.query;

    const couponService = new CouponService(req.models);
    const result = await couponService.getUserCoupons(userId, status);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('获取消费券失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

/**
 * 获取消费券核销码
 * GET /api/coupon/:id/qrcode
 */
router.get('/coupon/:id/qrcode', userAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const userCoupon = await req.models.UserCoupon.findOne({
      where: { id, user_id: userId }
    });

    if (!userCoupon) {
      return res.status(404).json({ success: false, message: '消费券不存在' });
    }

    const couponService = new CouponService(req.models);
    const coupons = await couponService.getUserCoupons(userId);
    const currentCoupon = coupons.find(item => String(item.id) === String(id));
    const qrcodePayload = JSON.stringify({
      type: 'coupon',
      code: userCoupon.code,
      couponId: userCoupon.id
    });
    const qrcodeUrl = await QRCode.toDataURL(qrcodePayload, {
      margin: 1,
      width: 240
    });

    res.json({
      success: true,
      data: {
        code: userCoupon.code,
        qrcodeUrl,
        coupon: currentCoupon?.coupon || null,
        status: userCoupon.status
      }
    });
  } catch (error) {
    logger.error('获取核销码失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

/**
 * 获取附近商家
 * GET /api/merchants/nearby
 */
router.get('/merchants/nearby', userAuth, async (req, res) => {
  try {
    const { longitude, latitude, distance = 5000 } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({ success: false, message: '缺少位置信息' });
    }

    const merchants = await req.models.sequelize.query(`
      SELECT id, name, category, address, longitude, latitude,
        (6371000 * acos(
          cos(radians(:latitude)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(:longitude)) +
          sin(radians(:latitude)) * sin(radians(latitude))
        )) AS distance
      FROM merchants
      WHERE status = 2
      HAVING distance < :distance
      ORDER BY distance
      LIMIT 20
    `, {
      replacements: { longitude, latitude, distance },
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: merchants
    });
  } catch (error) {
    logger.error('获取附近商家失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

module.exports = router;

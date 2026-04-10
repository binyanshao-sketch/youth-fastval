const express = require('express');
const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const QRCode = require('qrcode');

const logger = require('../utils/logger');
const { requireRole } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const LuckyBagService = require('../services/LuckyBagService');
const CouponService = require('../services/CouponService');
const WeChatService = require('../services/WeChatService');
const SMSService = require('../services/SMSService');
const LotteryService = require('../services/LotteryService');
const { requireGeofence } = require('../middleware/geofence');

const router = express.Router();
const userAuth = requireRole('user');

function getValidationMessage(req) {
  const errors = validationResult(req);
  return errors.isEmpty() ? null : errors.array()[0].msg;
}

function toNumber(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function getDistanceText(distance) {
  if (!Number.isFinite(distance)) {
    return '待补充';
  }

  if (distance < 1000) {
    return `${Math.round(distance)}m`;
  }

  return `${(distance / 1000).toFixed(1)}km`;
}

function calculateDistance(latitude1, longitude1, latitude2, longitude2) {
  const lat1 = toNumber(latitude1);
  const lon1 = toNumber(longitude1);
  const lat2 = toNumber(latitude2);
  const lon2 = toNumber(longitude2);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
    return null;
  }

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const a = sinLat * sinLat
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

router.post('/login', [
  rateLimit({ windowMs: 60000, max: 10, message: '登录请求过于频繁，请稍后再试' }),
  body('code').notEmpty().withMessage('缺少微信登录 code')
], async (req, res) => {
  try {
    const message = getValidationMessage(req);
    if (message) {
      return res.status(400).json({ success: false, message });
    }

    const { code } = req.body;
    const weChatService = new WeChatService(req.redis);
    const wxResult = await weChatService.login(code);

    let user = await req.models.User.findOne({
      where: { openid: wxResult.openid }
    });

    if (!user) {
      user = await req.models.User.create({
        openid: wxResult.openid,
        unionid: wxResult.unionid,
        status: 1
      });
    }

    await weChatService.saveSession(user.id, wxResult.sessionKey);

    const token = req.app.locals.jwt.sign({
      userId: user.id,
      role: 'user',
      type: 'user'
    });

    res.json({
      success: true,
      data: {
        token,
        isNewUser: !user.phone
      }
    });
  } catch (error) {
    logger.error('user login failed', { error: error.message });
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

router.post('/h5/login', [
  rateLimit({ windowMs: 60000, max: 20 }),
  body('deviceId').optional().isLength({ min: 6, max: 128 }).withMessage('deviceId 无效')
], async (req, res) => {
  try {
    const message = getValidationMessage(req);
    if (message) {
      return res.status(400).json({ success: false, message });
    }

    if (process.env.WX_USE_MOCK !== 'true') {
      return res.status(400).json({ success: false, message: 'H5 测试登录仅在测试模式可用' });
    }

    const rawDeviceId = String(req.body.deviceId || '').trim();
    const safeDeviceId = rawDeviceId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const deviceId = safeDeviceId || `browser_${Date.now()}`;
    const openid = `h5_${deviceId}`;

    let user = await req.models.User.findOne({
      where: { openid }
    });

    if (!user) {
      user = await req.models.User.create({
        openid,
        unionid: null,
        nickname: 'H5测试用户',
        status: 1
      });
    }

    const token = req.app.locals.jwt.sign({
      userId: user.id,
      role: 'user',
      type: 'user'
    });

    res.json({
      success: true,
      data: {
        token,
        isNewUser: !user.phone,
        mode: 'mock'
      }
    });
  } catch (error) {
    logger.error('h5 user login failed', { error: error.message });
    res.status(500).json({ success: false, message: 'H5 登录失败' });
  }
});

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
    logger.error('get user info failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
});

router.get('/stats', userAuth, async (req, res) => {
  try {
    const [redpacketCount, couponCount, totalAmount, pendingLottery] = await Promise.all([
      req.models.LuckyBagRecord.count({ where: { user_id: req.userId } }),
      req.models.UserCoupon.count({ where: { user_id: req.userId } }),
      req.models.LuckyBagRecord.sum('redpacket_amount', { where: { user_id: req.userId } }),
      req.models.LotteryRecord.count({ where: { user_id: req.userId } })
    ]);

    res.json({
      success: true,
      data: {
        redpacketCount,
        couponCount,
        totalAmount: Number(totalAmount || 0).toFixed(2),
        hasDrawnLottery: pendingLottery > 0
      }
    });
  } catch (error) {
    logger.error('get user stats failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '获取统计失败' });
  }
});

router.post('/bindPhone', [
  ...userAuth,
  body('encryptedData').notEmpty().withMessage('缺少 encryptedData'),
  body('iv').notEmpty().withMessage('缺少 iv')
], async (req, res) => {
  try {
    const message = getValidationMessage(req);
    if (message) {
      return res.status(400).json({ success: false, message });
    }

    const { encryptedData, iv } = req.body;
    const weChatService = new WeChatService(req.redis);
    const phone = await weChatService.decryptPhone(req.userId, encryptedData, iv);

    const existing = await req.models.User.findOne({ where: { phone } });
    if (existing && Number(existing.id) !== Number(req.userId)) {
      return res.status(400).json({ success: false, message: '该手机号已被使用' });
    }

    await req.models.User.update({ phone }, { where: { id: req.userId } });

    res.json({
      success: true,
      data: { phone },
      message: '绑定成功'
    });
  } catch (error) {
    logger.error('bind phone failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '绑定手机号失败' });
  }
});

router.post('/h5/bindPhone', [
  ...userAuth,
  rateLimit({ windowMs: 60000, max: 10 }),
  body('phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确')
], async (req, res) => {
  try {
    const message = getValidationMessage(req);
    if (message) {
      return res.status(400).json({ success: false, message });
    }

    if (process.env.WX_USE_MOCK !== 'true') {
      return res.status(400).json({ success: false, message: 'H5 手机号绑定仅在测试模式可用' });
    }

    const phone = String(req.body.phone).trim();
    const existing = await req.models.User.findOne({ where: { phone } });
    if (existing && Number(existing.id) !== Number(req.userId)) {
      return res.status(400).json({ success: false, message: '该手机号已被使用' });
    }

    await req.models.User.update({ phone }, { where: { id: req.userId } });

    res.json({
      success: true,
      data: { phone },
      message: '绑定成功'
    });
  } catch (error) {
    logger.error('h5 bind phone failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: 'H5 绑定手机号失败' });
  }
});

// ============================================================
// 公开配置端点（供 H5 前端初始化时读取）
// ============================================================
router.get('/auth-config', (req, res) => {
  res.json({
    success: true,
    data: {
      mockMode: process.env.WX_USE_MOCK === 'true',
      wxH5AppId: process.env.WX_H5_APPID || null
    }
  });
});

// ============================================================
// 短信验证码登录
// ============================================================

// 发送短信验证码
router.post('/sms/send', [
  rateLimit({ windowMs: 60000, max: 5, message: '发送过于频繁，请稍后再试' }),
  body('phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确')
], async (req, res) => {
  try {
    const message = getValidationMessage(req);
    if (message) {
      return res.status(400).json({ success: false, message });
    }

    const phone = String(req.body.phone).trim();

    // 每个手机号 60 秒内只能发一次
    const cooldownKey = `sms:cd:${phone}`;
    const hasCooldown = await req.redis.get(cooldownKey);
    if (hasCooldown) {
      const ttl = await req.redis.ttl(cooldownKey);
      return res.status(429).json({ success: false, message: `请 ${ttl} 秒后再次发送` });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await req.redis.set(`sms:code:${phone}`, code, 'EX', 300);
    await req.redis.set(cooldownKey, '1', 'EX', 60);

    const result = await SMSService.send(phone, `您的验证码是${code}，五分钟内有效`);
    if (!result.success) {
      await req.redis.del(`sms:code:${phone}`);
      return res.status(500).json({ success: false, message: result.message || '短信发送失败' });
    }

    res.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    logger.error('sms send failed', { error: error.message });
    res.status(500).json({ success: false, message: '发送失败，请稍后重试' });
  }
});

// 短信验证码登录（自动注册）
router.post('/sms/login', [
  rateLimit({ windowMs: 60000, max: 10, message: '登录请求过于频繁' }),
  body('phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
  body('code').matches(/^\d{6}$/).withMessage('验证码格式不正确')
], async (req, res) => {
  try {
    const message = getValidationMessage(req);
    if (message) {
      return res.status(400).json({ success: false, message });
    }

    const phone = String(req.body.phone).trim();
    const code = String(req.body.code).trim();

    // 防止暴力破解
    const attemptKey = `sms:atm:${phone}`;
    const attempts = Number(await req.redis.get(attemptKey) || 0);
    if (attempts >= 5) {
      return res.status(429).json({ success: false, message: '验证码错误次数过多，请重新获取' });
    }

    const storedCode = await req.redis.get(`sms:code:${phone}`);
    if (!storedCode || storedCode !== code) {
      const newAttempts = await req.redis.incr(attemptKey);
      if (newAttempts === 1) await req.redis.expire(attemptKey, 300);
      return res.status(400).json({ success: false, message: '验证码不正确或已过期' });
    }

    // 清除验证码和计数器
    await req.redis.del(`sms:code:${phone}`, attemptKey);

    // 查找或创建用户（优先按手机号匹配已有账号）
    // 使用 findOrCreate 避免并发请求同时注册同一手机号时产生的竞态条件
    let user;
    try {
      const [foundUser] = await req.models.User.findOrCreate({
        where: { phone },
        defaults: { openid: `sms_${phone}`, status: 1 }
      });
      user = foundUser;
    } catch (createError) {
      // 兜底：极端并发下 findOrCreate 仍可能抛唯一约束，再查一次
      const { UniqueConstraintError } = require('sequelize');
      if (createError instanceof UniqueConstraintError) {
        user = await req.models.User.findOne({ where: { phone } });
        if (!user) {
          throw createError;
        }
      } else {
        throw createError;
      }
    }

    const token = req.app.locals.jwt.sign({
      userId: user.id,
      role: 'user',
      type: 'user'
    });

    res.json({ success: true, data: { token } });
  } catch (error) {
    logger.error('sms login failed', { error: error.message });
    res.status(500).json({ success: false, message: '登录失败，请稍后重试' });
  }
});

// 短信验证码绑定手机号（需要已登录）
router.post('/sms/bind-phone', [
  ...userAuth,
  rateLimit({ windowMs: 60000, max: 5 }),
  body('phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
  body('code').matches(/^\d{6}$/).withMessage('验证码格式不正确')
], async (req, res) => {
  try {
    const message = getValidationMessage(req);
    if (message) {
      return res.status(400).json({ success: false, message });
    }

    const phone = String(req.body.phone).trim();
    const code = String(req.body.code).trim();

    const attemptKey = `sms:atm:${phone}`;
    const attempts = Number(await req.redis.get(attemptKey) || 0);
    if (attempts >= 5) {
      return res.status(429).json({ success: false, message: '验证码错误次数过多，请重新获取' });
    }

    const storedCode = await req.redis.get(`sms:code:${phone}`);
    if (!storedCode || storedCode !== code) {
      const newAttempts = await req.redis.incr(attemptKey);
      if (newAttempts === 1) await req.redis.expire(attemptKey, 300);
      return res.status(400).json({ success: false, message: '验证码不正确或已过期' });
    }

    await req.redis.del(`sms:code:${phone}`, attemptKey);

    const existing = await req.models.User.findOne({ where: { phone } });
    if (existing && Number(existing.id) !== Number(req.userId)) {
      return res.status(400).json({ success: false, message: '该手机号已被其他账号使用' });
    }

    await req.models.User.update({ phone }, { where: { id: req.userId } });

    res.json({ success: true, data: { phone }, message: '绑定成功' });
  } catch (error) {
    logger.error('sms bind phone failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '绑定失败，请稍后重试' });
  }
});

// ============================================================
// 微信公众号 H5 OAuth 登录
// ============================================================
router.post('/wx/h5/login', [
  rateLimit({ windowMs: 60000, max: 10 }),
  body('code').notEmpty().withMessage('缺少微信授权码')
], async (req, res) => {
  try {
    const message = getValidationMessage(req);
    if (message) {
      return res.status(400).json({ success: false, message });
    }

    const weChatService = new WeChatService(req.redis);
    const wxResult = await weChatService.h5OAuth(req.body.code);

    let user = await req.models.User.findOne({ where: { openid: wxResult.openid } });
    if (!user) {
      user = await req.models.User.create({
        openid: wxResult.openid,
        unionid: wxResult.unionid,
        status: 1
      });
    }

    const token = req.app.locals.jwt.sign({
      userId: user.id,
      role: 'user',
      type: 'user'
    });

    res.json({ success: true, data: { token, isNewUser: !user.phone } });
  } catch (error) {
    logger.error('wx h5 login failed', { error: error.message });
    res.status(500).json({ success: false, message: '微信登录失败，请稍后重试' });
  }
});

router.post('/luckyBag/receive', [
  ...userAuth,
  rateLimit({ windowMs: 60000, max: 1 }),
  requireGeofence(),
  body('slotIndex').optional().isInt({ min: 0, max: 8 }).withMessage('红包位置无效'),
  body('latitude').isFloat().withMessage('缺少位置信息'),
  body('longitude').isFloat().withMessage('缺少位置信息')
], async (req, res) => {
  try {
    const message = getValidationMessage(req);
    if (message) {
      return res.status(400).json({ success: false, message });
    }

    const luckyBagService = new LuckyBagService(req.models, req.app.locals.redis);
    const result = await luckyBagService.receive(
      req.userId,
      req.ip,
      req.get('User-Agent'),
      req.body.slotIndex ?? null
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('receive lucky bag failed', { error: error.message, userId: req.userId });
    const safeMessages = ['请勿重复提交', '活动未开始或已结束', '每人限领1份', '今日福袋已领完，请明天再来', '福袋已领完', '暂无可用消费券，请稍后再试', '红包池未配置'];
    const message = safeMessages.includes(error.message) ? error.message : '领取失败';
    res.status(400).json({ success: false, message });
  }
});

router.get('/luckyBag/my', userAuth, async (req, res) => {
  try {
    const luckyBagService = new LuckyBagService(req.models, req.app.locals.redis);
    const result = await luckyBagService.getUserLuckyBag(req.userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('get lucky bag failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '获取福袋信息失败' });
  }
});

router.get('/lottery/config', userAuth, async (req, res) => {
  try {
    const lotteryService = new LotteryService(req.models);

    res.json({
      success: true,
      data: await lotteryService.getClientConfig()
    });
  } catch (error) {
    logger.error('get lottery config failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '获取抽奖配置失败' });
  }
});

router.get('/lottery/my', userAuth, async (req, res) => {
  try {
    const lotteryService = new LotteryService(req.models);
    const result = await lotteryService.getUserLottery(req.userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('get lottery record failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '获取抽奖结果失败' });
  }
});

router.post('/lottery/draw', [
  ...userAuth,
  rateLimit({ windowMs: 60000, max: 3 }),
  body('gameType').optional().isIn(['wheel', 'grid']).withMessage('\u62bd\u5956\u73a9\u6cd5\u65e0\u6548')
], async (req, res) => {
  try {
    const message = getValidationMessage(req);
    if (message) {
      return res.status(400).json({ success: false, message });
    }

    const lotteryService = new LotteryService(req.models);
    const result = await lotteryService.draw(req.userId, req.body.gameType || null);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('lottery draw failed', { error: error.message, userId: req.userId });
    const safeMessages = ['请先领取福袋', '每人只能抽奖一次', '抽奖活动未开始'];
    const message = safeMessages.includes(error.message) ? error.message : '抽奖失败';
    res.status(400).json({ success: false, message });
  }
});

router.post('/redpacket/withdraw', [
  ...userAuth,
  rateLimit({ windowMs: 60000, max: 3 })
], async (req, res) => {
  try {
    const record = await req.models.LuckyBagRecord.findOne({
      where: { user_id: req.userId }
    });

    if (!record) {
      return res.status(400).json({ success: false, message: '请先领取福袋' });
    }

    if (record.redpacket_status === 2) {
      return res.status(400).json({ success: false, message: '红包已发放完成' });
    }

    const luckyBagService = new LuckyBagService(req.models, req.app.locals.redis);
    await luckyBagService.sendRedPacket(req.userId, record.redpacket_amount, record.id);

    res.json({
      success: true,
      message: '微信红包已重新发起发放'
    });
  } catch (error) {
    logger.error('withdraw redpacket failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '提现失败，请稍后重试' });
  }
});

router.get('/redpacket/list', userAuth, async (req, res) => {
  try {
    const record = await req.models.LuckyBagRecord.findOne({
      where: { user_id: req.userId },
      order: [['received_at', 'DESC']]
    });

    const list = record ? [{
      id: record.id,
      amount: Number(record.redpacket_amount).toFixed(2),
      blessing: record.redpacket_blessing || '',
      status: record.redpacket_status,
      orderNo: record.redpacket_order_no,
      sentAt: record.redpacket_sent_at,
      receivedAt: record.received_at,
      createTime: formatDateTime(record.received_at)
    }] : [];

    res.json({
      success: true,
      data: {
        list,
        total: list.length
      }
    });
  } catch (error) {
    logger.error('get redpacket list failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '获取红包记录失败' });
  }
});

router.get('/coupons/my', userAuth, async (req, res) => {
  try {
    const couponService = new CouponService(req.models);
    const result = await couponService.getUserCoupons(req.userId, req.query.status);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('get coupons failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '获取消费券失败' });
  }
});

router.get('/coupon/:id/qrcode', userAuth, async (req, res) => {
  try {
    const userCoupon = await req.models.UserCoupon.findOne({
      where: { id: req.params.id, user_id: req.userId }
    });

    if (!userCoupon) {
      return res.status(404).json({ success: false, message: '消费券不存在' });
    }

    const couponService = new CouponService(req.models);
    const coupons = await couponService.getUserCoupons(req.userId);
    const currentCoupon = coupons.find((item) => String(item.id) === String(req.params.id));
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
    logger.error('get coupon qrcode failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '获取核销码失败' });
  }
});

router.get('/merchants/nearby', userAuth, async (req, res) => {
  try {
    const page = Math.max(1, toNumber(req.query.page, 1));
    const pageSize = Math.min(50, Math.max(1, toNumber(req.query.pageSize, 20)));
    const offset = (page - 1) * pageSize;
    const { keyword = '', category = '', latitude, longitude } = req.query;
    const where = { status: 2 };

    if (keyword) {
      where.name = { [Op.like]: `%${String(keyword).trim().replace(/[\\%_]/g, '\\$&')}%` };
    }

    if (category) {
      where.category = String(category).trim();
    }

    const { count, rows } = await req.models.Merchant.findAndCountAll({
      where,
      order: [
        ['verified_at', 'DESC'],
        ['created_at', 'DESC']
      ],
      offset,
      limit: pageSize
    });

    const list = rows
      .map((item) => {
        const merchant = item.toJSON();
        const distance = calculateDistance(latitude, longitude, merchant.latitude, merchant.longitude);

        return {
          id: merchant.id,
          name: merchant.name,
          category: merchant.category,
          address: merchant.address,
          latitude: merchant.latitude,
          longitude: merchant.longitude,
          contactName: merchant.contact_name || '',
          contactPhone: merchant.contact_phone,
          distance,
          distanceText: getDistanceText(distance),
          couponInfo: `支持 ${merchant.category} 场景使用`
        };
      })
      .sort((left, right) => {
        if (left.distance == null && right.distance == null) {
          return 0;
        }

        if (left.distance == null) {
          return 1;
        }

        if (right.distance == null) {
          return -1;
        }

        return left.distance - right.distance;
      });

    res.json({
      success: true,
      data: {
        list,
        total: count,
        page,
        pageSize
      }
    });
  } catch (error) {
    logger.error('get merchants failed', { error: error.message, userId: req.userId });
    res.status(500).json({ success: false, message: '获取商家失败' });
  }
});

module.exports = router;

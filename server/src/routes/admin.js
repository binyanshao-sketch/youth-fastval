/**
 * 管理后台API路由 - 主入口
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { requireRole } = require('../middleware/auth');
const SystemConfigService = require('../services/SystemConfigService');
const AdminLogService = require('../services/AdminLogService');
const logger = require('../utils/logger');

const adminAuth = requireRole('admin');

// 子路由模块
const usersRouter = require('./admin/users');
const merchantsRouter = require('./admin/merchants');
const couponsRouter = require('./admin/coupons');
const financeRouter = require('./admin/finance');
const statisticsRouter = require('./admin/statistics');

router.use('/users', usersRouter);
router.use('/merchants', merchantsRouter);
router.use('/coupons', couponsRouter);
router.use('/finance', financeRouter);
router.use('/statistics', statisticsRouter);

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请输入用户名和密码' });
    }

    const { Admin } = req.models;

    const admin = await Admin.findOne({ where: { username } });
    if (!admin) {
      return res.status(400).json({ success: false, message: '用户名或密码错误' });
    }

    if (admin.status !== 1) {
      return res.status(400).json({ success: false, message: '账号已被禁用' });
    }

    if (!(await bcrypt.compare(password, admin.password))) {
      return res.status(400).json({ success: false, message: '用户名或密码错误' });
    }

    // 生成token（包含 type 字段用于角色鉴权）
    const token = req.app.locals.jwt.sign(
      { adminId: admin.id, type: 'admin' },
      '24h'
    );

    await admin.update({ last_login_at: new Date() });

    const logService = new AdminLogService(req.models);
    await logService.log(admin.id, 'admin_login', null, null, req.ip);

    res.json({
      success: true,
      data: {
        token,
        userInfo: {
          id: admin.id,
          name: admin.name,
          role: admin.role
        }
      }
    });
  } catch (error) {
    logger.error('管理员登录失败', { error: error.message });
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

router.get('/user/info', adminAuth, async (req, res) => {
  try {
    const { Admin } = req.models;
    const admin = await Admin.findByPk(req.adminId, {
      attributes: ['id', 'username', 'name', 'phone', 'role', 'status', 'last_login_at']
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: '管理员不存在' });
    }

    res.json({ success: true, data: admin });
  } catch (error) {
    logger.error('获取管理员信息失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 仪表盘数据
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const { User, LuckyBagRecord, Merchant, UserCoupon, VerifyRecord } = req.models;
    const userCount = await User.count();
    const redpacketTotal = await LuckyBagRecord.sum('redpacket_amount') || 0;
    const couponUsedCount = await UserCoupon.count({ where: { status: 2 } });
    const merchantCount = await Merchant.count({ where: { status: 2 } });

    const latestRecords = await LuckyBagRecord.findAll({
      order: [['received_at', 'DESC']],
      limit: 10,
      include: [{ model: User, as: 'user', attributes: ['phone'] }]
    });

    const latestVerifies = await VerifyRecord.findAll({
      order: [['verified_at', 'DESC']],
      limit: 10,
      include: [{ model: Merchant, as: 'merchant', attributes: ['name'] }]
    });

    res.json({
      success: true,
      data: {
        userCount,
        redpacketTotal: redpacketTotal.toFixed(2),
        couponUsedCount,
        merchantCount,
        latestRecords: latestRecords.map(r => ({
          phone: r.user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '-',
          amount: r.redpacket_amount,
          time: dayjs(r.received_at).format('YYYY-MM-DD HH:mm:ss')
        })),
        latestVerifies: latestVerifies.map(v => ({
          merchant: v.merchant?.name || '-',
          amount: v.coupon_amount,
          time: dayjs(v.verified_at).format('YYYY-MM-DD HH:mm:ss')
        }))
      }
    });
  } catch (error) {
    logger.error('获取仪表盘数据失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 福袋记录
router.get('/lucky-bag/records', adminAuth, async (req, res) => {
  try {
    const { LuckyBagRecord, User } = req.models;
    const { page = 1, pageSize = 20, phone } = req.query;
    const pageNumber = parseInt(page);
    const pageSizeNumber = parseInt(pageSize);

    const include = [{ model: User, as: 'user', attributes: ['phone', 'nickname'] }];
    const where = {};
    if (phone) {
      include[0].where = {
        phone: { [Op.like]: `%${phone}%` }
      };
      include[0].required = true;
    }

    const { count, rows } = await LuckyBagRecord.findAndCountAll({
      where,
      include,
      order: [['received_at', 'DESC']],
      limit: pageSizeNumber,
      offset: (pageNumber - 1) * pageSizeNumber
    });

    res.json({
      success: true,
      data: {
        list: rows.map(record => ({
          id: record.id,
          phone: record.user?.phone || '-',
          nickname: record.user?.nickname || '-',
          amount: record.redpacket_amount,
          status: record.redpacket_status,
          policyUrl: record.policy_url,
          receivedAt: record.received_at,
          sentAt: record.redpacket_sent_at
        })),
        total: count,
        page: pageNumber,
        pageSize: pageSizeNumber
      }
    });
  } catch (error) {
    logger.error('获取福袋记录失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 福袋配置
router.get('/lucky-bag/config', adminAuth, async (req, res) => {
  try {
    const configService = new SystemConfigService(req.models);
    const configMap = await configService.getConfigMap();
    const redpacketPool = await req.models.RedPacketPool.findAll({
      where: { status: 1 },
      order: [['amount', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        activityStartTime: configMap.activity_start_time || '',
        activityEndTime: configMap.activity_end_time || '',
        policyUrl: configMap.policy_url || '',
        dailyLimit: configMap.daily_limit || '',
        isActive: configMap.is_active === 'true',
        redpacketPool
      }
    });
  } catch (error) {
    logger.error('获取福袋配置失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.put('/lucky-bag/config', adminAuth, async (req, res) => {
  try {
    const { activityStartTime, activityEndTime, policyUrl, dailyLimit, isActive } = req.body;
    const configService = new SystemConfigService(req.models);
    await configService.updateConfig({
      activity_start_time: activityStartTime,
      activity_end_time: activityEndTime,
      policy_url: policyUrl,
      daily_limit: dailyLimit,
      is_active: String(Boolean(isActive))
    });

    const logService = new AdminLogService(req.models);
    await logService.log(req.adminId, 'update_lucky_bag_config', null, req.body, req.ip);

    res.json({ success: true, message: '保存成功' });
  } catch (error) {
    logger.error('更新福袋配置失败', { error: error.message });
    res.status(500).json({ success: false, message: error.message || '保存失败' });
  }
});

// 系统设置（带白名单校验）
router.get('/settings', adminAuth, async (req, res) => {
  try {
    const configService = new SystemConfigService(req.models);
    const configMap = await configService.getConfigMap();
    res.json({ success: true, data: configMap });
  } catch (error) {
    logger.error('获取系统设置失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.put('/settings', adminAuth, async (req, res) => {
  try {
    const configService = new SystemConfigService(req.models);
    await configService.updateConfig(req.body);

    const logService = new AdminLogService(req.models);
    await logService.log(req.adminId, 'update_settings', null, req.body, req.ip);

    res.json({ success: true, message: '保存成功' });
  } catch (error) {
    logger.error('更新系统设置失败', { error: error.message });
    res.status(400).json({ success: false, message: error.message || '保存失败' });
  }
});

// 操作日志（真正查询 admin_logs 表）
router.get('/logs', adminAuth, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const logService = new AdminLogService(req.models);
    const result = await logService.getRecords(parseInt(page), parseInt(pageSize));

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取日志失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

module.exports = router;

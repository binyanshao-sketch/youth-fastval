const express = require('express')
const bcrypt = require('bcryptjs')
const dayjs = require('dayjs')
const { Op } = require('sequelize')
const { body, validationResult } = require('express-validator')
const { requireRole } = require('../middleware/auth')
const SystemConfigService = require('../services/SystemConfigService')
const AdminLogService = require('../services/AdminLogService')
const LotteryService = require('../services/LotteryService')
const QiniuService = require('../services/QiniuService')
const rateLimit = require('../middleware/rateLimit')
const logger = require('../utils/logger')

const usersRouter = require('./admin/users')
const merchantsRouter = require('./admin/merchants')
const couponsRouter = require('./admin/coupons')
const financeRouter = require('./admin/finance')
const statisticsRouter = require('./admin/statistics')

const router = express.Router()
const adminAuth = requireRole('admin')
const { ALLOWED_CONFIG_KEYS } = SystemConfigService
const systemSettingsKeys = Array.from(ALLOWED_CONFIG_KEYS)

function getValidationMessage(req) {
  const errors = validationResult(req)
  return errors.isEmpty() ? null : errors.array()[0].msg
}

function isValidDateTime(value) {
  if (typeof value !== 'string') {
    return false
  }

  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return false
  }

  return !Number.isNaN(new Date(value.replace(' ', 'T')).getTime())
}

function isValidHttpUrl(value) {
  if (value === '' || value == null) {
    return true
  }

  try {
    const url = new URL(String(value))
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (error) {
    return false
  }
}

function buildSettingsPayload(source) {
  return systemSettingsKeys.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key]
    }
    return result
  }, {})
}

const settingsValidators = [
  body().custom((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid settings payload')
    }

    const keys = Object.keys(value)
    if (keys.length === 0) {
      throw new Error('No settings provided')
    }

    const invalidKeys = keys.filter((key) => !ALLOWED_CONFIG_KEYS.has(key))
    if (invalidKeys.length > 0) {
      throw new Error(`Unsupported settings keys: ${invalidKeys.join(', ')}`)
    }

    return true
  }),
  body('activity_start_time').optional().custom(isValidDateTime).withMessage('activity_start_time is invalid'),
  body('activity_end_time').optional().custom(isValidDateTime).withMessage('activity_end_time is invalid'),
  body('coupon_expire_time').optional().custom(isValidDateTime).withMessage('coupon_expire_time is invalid'),
  body('policy_url').optional({ nullable: true }).custom(isValidHttpUrl).withMessage('policy_url is invalid'),
  body('daily_limit').optional().isInt({ min: 1, max: 1000000 }).withMessage('daily_limit must be a positive integer'),
  body('is_active').optional().customSanitizer((value) => String(value)).isIn(['true', 'false']).withMessage('is_active must be true or false'),
  body('lottery_mode').optional().isIn(['wheel', 'grid']).withMessage('lottery_mode is invalid')
]

router.use('/users', usersRouter)
router.use('/merchants', merchantsRouter)
router.use('/coupons', couponsRouter)
router.use('/finance', financeRouter)
router.use('/statistics', statisticsRouter)

// ============================================================
// 七牛云上传凭证（仅限管理员）
// ============================================================
router.get('/upload/token', adminAuth, rateLimit({ windowMs: 60000, max: 30 }), (req, res) => {
  try {
    if (!QiniuService.isConfigured()) {
      return res.status(503).json({ success: false, message: '文件上传服务未配置' });
    }

    const prefix = String(req.query.prefix || 'uploads/').replace(/[^a-zA-Z0-9_\-/]/g, '');
    const result = QiniuService.getUploadToken({ prefix });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取七牛上传凭证失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取上传凭证失败' });
  }
});

router.post('/login', rateLimit({ windowMs: 60000, max: 5, message: '登录尝试过于频繁，请稍后再试' }), async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请输入用户名和密码' })
    }

    const { Admin } = req.models
    const admin = await Admin.findOne({ where: { username } })

    if (!admin) {
      return res.status(400).json({ success: false, message: '用户名或密码错误' })
    }

    if (admin.status !== 1) {
      return res.status(400).json({ success: false, message: '账号已被禁用' })
    }

    const matched = await bcrypt.compare(password, admin.password)
    if (!matched) {
      return res.status(400).json({ success: false, message: '用户名或密码错误' })
    }

    const token = req.app.locals.jwt.sign(
      { adminId: admin.id, role: 'admin', type: 'admin' },
      '24h'
    )

    await admin.update({ last_login_at: new Date() })

    const logService = new AdminLogService(req.models)
    await logService.log(admin.id, 'admin_login', null, null, req.ip)

    res.json({
      success: true,
      data: {
        token,
        userInfo: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          role: admin.role
        }
      }
    })
  } catch (error) {
    logger.error('管理员登录失败', { error: error.message })
    res.status(500).json({ success: false, message: '登录失败' })
  }
})

router.get('/user/info', adminAuth, async (req, res) => {
  try {
    const { Admin } = req.models
    const admin = await Admin.findByPk(req.adminId, {
      attributes: ['id', 'username', 'name', 'phone', 'role', 'status', 'last_login_at']
    })

    if (!admin) {
      return res.status(404).json({ success: false, message: '管理员不存在' })
    }

    res.json({ success: true, data: admin })
  } catch (error) {
    logger.error('获取管理员信息失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const {
      User,
      LuckyBagRecord,
      Merchant,
      UserCoupon,
      VerifyRecord,
      LotteryRecord,
      RedPacketPool
    } = req.models

    const [
      userCount,
      redpacketTotal,
      couponUsedCount,
      merchantCount,
      lotteryCount,
      pendingDeliveryCount,
      latestRecords,
      latestVerifies,
      redpacketPool
    ] = await Promise.all([
      User.count(),
      LuckyBagRecord.sum('redpacket_amount'),
      UserCoupon.count({ where: { status: 2 } }),
      Merchant.count({ where: { status: 2 } }),
      LotteryRecord.count(),
      LuckyBagRecord.count({ where: { redpacket_status: 1 } }),
      LuckyBagRecord.findAll({
        order: [['received_at', 'DESC']],
        limit: 10,
        include: [{ model: User, as: 'user', attributes: ['phone'] }]
      }),
      VerifyRecord.findAll({
        order: [['verified_at', 'DESC']],
        limit: 10,
        include: [{ model: Merchant, as: 'merchant', attributes: ['name'] }]
      }),
      RedPacketPool.findAll({
        where: { status: 1 },
        order: [['amount', 'ASC']]
      })
    ])

    res.json({
      success: true,
      data: {
        userCount,
        redpacketTotal: Number(redpacketTotal || 0).toFixed(2),
        couponUsedCount,
        merchantCount,
        lotteryCount,
        pendingDeliveryCount,
        redpacketPool: redpacketPool.map((item) => ({
          id: item.id,
          amount: item.amount,
          totalCount: item.total_count,
          usedCount: item.used_count,
          weight: item.weight,
          blessing: item.blessing
        })),
        latestRecords: latestRecords.map((record) => ({
          phone: record.user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '-',
          amount: record.redpacket_amount,
          status: record.redpacket_status,
          time: dayjs(record.received_at).format('YYYY-MM-DD HH:mm:ss')
        })),
        latestVerifies: latestVerifies.map((record) => ({
          merchant: record.merchant?.name || '-',
          amount: record.coupon_amount,
          time: dayjs(record.verified_at).format('YYYY-MM-DD HH:mm:ss')
        }))
      }
    })
  } catch (error) {
    logger.error('获取仪表盘数据失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.get('/lucky-bag/records', adminAuth, async (req, res) => {
  try {
    const { LuckyBagRecord, User, LotteryRecord } = req.models
    const { page = 1, pageSize = 20, phone } = req.query
    const pageNumber = Math.max(1, parseInt(page, 10) || 1)
    const pageSizeNumber = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))

    const include = [{
      model: User,
      as: 'user',
      attributes: ['phone', 'nickname'],
      include: [{
        model: LotteryRecord,
        as: 'lotteryRecord',
        attributes: ['game_type', 'prize_name', 'created_at'],
        required: false
      }]
    }]

    if (phone) {
      include[0].where = {
        phone: { [Op.like]: `%${String(phone).replace(/[\\%_]/g, '\\$&')}%` }
      }
      include[0].required = true
    }

    const { count, rows } = await LuckyBagRecord.findAndCountAll({
      include,
      order: [['received_at', 'DESC']],
      limit: pageSizeNumber,
      offset: (pageNumber - 1) * pageSizeNumber
    })

    res.json({
      success: true,
      data: {
        list: rows.map((record) => ({
          id: record.id,
          phone: record.user?.phone || '-',
          nickname: record.user?.nickname || '-',
          amount: record.redpacket_amount,
          blessing: record.redpacket_blessing,
          status: record.redpacket_status,
          selectedSlot: record.selected_slot,
          policyUrl: record.policy_url,
          receivedAt: record.received_at,
          sentAt: record.redpacket_sent_at,
          lotteryGameType: record.user?.lotteryRecord?.game_type || '',
          lotteryPrizeName: record.user?.lotteryRecord?.prize_name || '',
          lotteryAt: record.user?.lotteryRecord?.created_at || null
        })),
        total: count,
        page: pageNumber,
        pageSize: pageSizeNumber
      }
    })
  } catch (error) {
    logger.error('获取福袋记录失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.get('/lucky-bag/config', adminAuth, async (req, res) => {
  try {
    const configService = new SystemConfigService(req.models)
    const configMap = await configService.getConfigMap()
    const lotteryService = new LotteryService(req.models)
    const redpacketPool = await req.models.RedPacketPool.findAll({
      where: { status: 1 },
      order: [['amount', 'ASC']]
    })

    const [receivedCount, sentCount, pendingCount] = await Promise.all([
      req.models.LuckyBagRecord.count(),
      req.models.LuckyBagRecord.count({ where: { redpacket_status: 2 } }),
      req.models.LuckyBagRecord.count({ where: { redpacket_status: 1 } })
    ])

    const slotPreview = Array.from({ length: 9 }).map((_, index) => ({
      index,
      label: `福袋 ${index + 1}`,
      tag: index < 3 ? '热力开启' : index < 6 ? '青年好运' : '隐藏惊喜'
    }))

    res.json({
      success: true,
      data: {
        activityStartTime: configMap.activity_start_time || '',
        activityEndTime: configMap.activity_end_time || '',
        policyUrl: configMap.policy_url || '',
        dailyLimit: configMap.daily_limit || '',
        lotteryMode: ['wheel', 'grid'].includes(configMap.lottery_mode) ? configMap.lottery_mode : 'wheel',
        isActive: configMap.is_active === 'true',
        redpacketPool: redpacketPool.map((item) => ({
          id: item.id,
          amount: item.amount,
          totalCount: item.total_count,
          usedCount: item.used_count,
          weight: item.weight,
          blessing: item.blessing
        })),
        slotPreview,
        lotteryBoards: lotteryService.getConfig(),
        overview: {
          receivedCount,
          sentCount,
          pendingCount
        }
      }
    })
  } catch (error) {
    logger.error('获取福袋配置失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.put('/lucky-bag/config', [...adminAuth, body('activityStartTime').optional({ nullable: true }).custom((v) => !v || isValidDateTime(v)).withMessage('activityStartTime is invalid'), body('activityEndTime').optional({ nullable: true }).custom((v) => !v || isValidDateTime(v)).withMessage('activityEndTime is invalid'), body('policyUrl').optional({ nullable: true }).custom(isValidHttpUrl).withMessage('policyUrl is invalid'), body('dailyLimit').optional({ nullable: true }).isInt({ min: 1, max: 1000000 }).withMessage('dailyLimit must be a positive integer'), body('isActive').optional().isBoolean().withMessage('isActive must be boolean'), body('lotteryMode').optional().isIn(['wheel', 'grid']).withMessage('lotteryMode is invalid')], async (req, res) => {
  const message = getValidationMessage(req)
  if (message) {
    return res.status(400).json({ success: false, message })
  }
  try {
    const {
      activityStartTime,
      activityEndTime,
      policyUrl,
      dailyLimit,
      lotteryMode,
      isActive
    } = req.body
    const safeLotteryMode = ['wheel', 'grid'].includes(lotteryMode) ? lotteryMode : 'wheel'
    const configService = new SystemConfigService(req.models)

    await configService.updateConfig({
      activity_start_time: activityStartTime,
      activity_end_time: activityEndTime,
      policy_url: policyUrl,
      daily_limit: dailyLimit,
      lottery_mode: safeLotteryMode,
      is_active: String(Boolean(isActive))
    })

    res.json({ success: true, message: '保存成功' })
  } catch (error) {
    logger.error('更新福袋配置失败', { error: error.message })
    res.status(500).json({ success: false, message: error.message || '保存失败' })
  }
})

router.get('/settings', adminAuth, async (req, res) => {
  try {
    const configService = new SystemConfigService(req.models)
    const configMap = await configService.getConfigMap()
    res.json({ success: true, data: configMap })
  } catch (error) {
    logger.error('获取系统设置失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.put('/settings', [...adminAuth, ...settingsValidators], async (req, res) => {
  try {
    const message = getValidationMessage(req)
    if (message) {
      return res.status(400).json({ success: false, message })
    }

    const payload = buildSettingsPayload(req.body)
    const configService = new SystemConfigService(req.models)
    await configService.updateConfig(payload)

    res.json({ success: true, message: '保存成功' })
  } catch (error) {
    logger.error('更新系统设置失败', { error: error.message })
    res.status(400).json({ success: false, message: error.message || '保存失败' })
  }
})

router.get('/logs', adminAuth, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query
    const pageNumber = Math.max(1, parseInt(page, 10) || 1)
    const pageSizeNumber = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
    const logService = new AdminLogService(req.models)
    const result = await logService.getRecords(pageNumber, pageSizeNumber)

    res.json({ success: true, data: result })
  } catch (error) {
    logger.error('获取日志失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

module.exports = router

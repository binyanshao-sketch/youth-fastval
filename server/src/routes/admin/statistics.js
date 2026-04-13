const express = require('express')
const { Op, fn, col } = require('sequelize')
const { requireAdminPermission } = require('../../middleware/auth')
const logger = require('../../utils/logger')

const router = express.Router()
const adminAuth = requireAdminPermission('statistics:read')

router.get('/', adminAuth, async (req, res) => {
  try {
    const { LuckyBagRecord } = req.models
    const { startDate, endDate } = req.query

    const where = {}
    if (startDate && endDate) {
      // 严格验证格式，防止非法日期字符串进入 Sequelize 查询
      const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/
      if (!ISO_DATE_RE.test(String(startDate)) || !ISO_DATE_RE.test(String(endDate))) {
        return res.status(400).json({ success: false, message: '日期格式不正确' })
      }
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ success: false, message: '日期格式不正确' })
      }
      where.received_at = {
        [Op.between]: [start, end]
      }
    }

    const records = await LuckyBagRecord.findAll({
      where,
      attributes: [
        [fn('DATE', col('received_at')), 'date'],
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('redpacket_amount')), 'amount']
      ],
      group: [fn('DATE', col('received_at'))],
      order: [[fn('DATE', col('received_at')), 'ASC']]
    })

    res.json({ success: true, data: records })
  } catch (error) {
    logger.error('获取统计趋势失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.get('/users', adminAuth, async (req, res) => {
  try {
    const { User } = req.models

    const provinces = await User.findAll({
      attributes: [
        [fn('IFNULL', col('province'), '未填写'), 'province'],
        [fn('COUNT', col('id')), 'count']
      ],
      group: [fn('IFNULL', col('province'), '未填写')],
      order: [[fn('COUNT', col('id')), 'DESC']]
    })

    const latestUsers = await User.findAll({
      order: [['created_at', 'DESC']],
      limit: 10,
      attributes: ['id', 'phone', 'province', 'created_at']
    })

    res.json({
      success: true,
      data: {
        provinceDistribution: provinces,
        latestUsers
      }
    })
  } catch (error) {
    logger.error('获取用户统计失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.get('/merchants', adminAuth, async (req, res) => {
  try {
    const { VerifyRecord, Merchant } = req.models

    const ranking = await VerifyRecord.findAll({
      attributes: [
        'merchant_id',
        [fn('COUNT', col('VerifyRecord.id')), 'count'],
        [fn('SUM', col('coupon_amount')), 'amount']
      ],
      include: [{ model: Merchant, as: 'merchant', attributes: ['name'] }],
      group: ['merchant_id', 'merchant.id'],
      order: [[fn('COUNT', col('VerifyRecord.id')), 'DESC']],
      limit: 10
    })

    res.json({
      success: true,
      data: ranking.map((item) => ({
        merchantId: item.merchant_id,
        merchantName: item.merchant?.name || '-',
        count: Number(item.get('count')),
        amount: Number(item.get('amount') || 0)
      }))
    })
  } catch (error) {
    logger.error('获取商家统计失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

module.exports = router

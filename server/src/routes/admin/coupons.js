const express = require('express')
const { Op } = require('sequelize')
const { body, param, validationResult } = require('express-validator')
const { requireAdminPermission } = require('../../middleware/auth')

const logger = require('../../utils/logger')

const router = express.Router()
const adminAuth = requireAdminPermission('coupons:read')
const adminWriteAuth = requireAdminPermission('coupons:write')
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg })
  next()
}

router.get('/', adminAuth, async (req, res) => {
  try {
    const { Coupon } = req.models
    const { page = 1, pageSize = 20, name } = req.query
    const pageNumber = Math.max(1, parseInt(page, 10) || 1)
    const pageSizeNumber = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))

    const where = {}
    if (name) where.name = { [Op.like]: `%${String(name).replace(/[\\%_]/g, '\\$&')}%` }

    const { count, rows } = await Coupon.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSizeNumber,
      offset: (pageNumber - 1) * pageSizeNumber
    })

    res.json({
      success: true,
      data: {
        list: rows,
        total: count,
        page: pageNumber,
        pageSize: pageSizeNumber
      }
    })
  } catch (error) {
    logger.error('获取消费券列表失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.post('/', adminWriteAuth, [body('name').isLength({ min: 2, max: 100 }).withMessage('消费券名称不合法'), body('amount').isFloat({ gt: 0 }).withMessage('金额必须大于0'), body('minSpend').optional().isFloat({ min: 0 }).withMessage('最低消费金额不合法'), body('totalCount').isInt({ gt: 0, lt: 10000000 }).withMessage('库存数量不合法'), body('validFrom').isISO8601().withMessage('validFrom 格式错误'), body('validTo').isISO8601().withMessage('validTo 格式错误'), body('description').optional().isLength({ max: 500 }).withMessage('描述过长'), body('merchantId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('商家ID不合法'), validate], async (req, res) => {
  try {
    const { Coupon } = req.models
    const { name, amount, minSpend, totalCount, validFrom, validTo, description, merchantId } = req.body

    if (!name || !amount || !totalCount || !validFrom || !validTo) {
      return res.status(400).json({ success: false, message: '缺少必要参数' })
    }

    const coupon = await Coupon.create({
      name,
      amount,
      min_spend: minSpend,
      total_count: totalCount,
      valid_from: validFrom,
      valid_to: validTo,
      description,
      merchant_id: merchantId || null,
      status: 1
    })

    res.json({ success: true, data: coupon })
  } catch (error) {
    logger.error('创建消费券失败', { error: error.message })
    res.status(500).json({ success: false, message: '创建失败' })
  }
})

router.put('/:id', adminWriteAuth, [param('id').isInt({ min: 1 }).withMessage('消费券ID不合法'), body('name').optional().isLength({ min: 2, max: 100 }).withMessage('消费券名称不合法'), body('amount').optional().isFloat({ gt: 0 }).withMessage('金额必须大于0'), body('minSpend').optional().isFloat({ min: 0 }).withMessage('最低消费金额不合法'), body('totalCount').optional().isInt({ gt: 0, lt: 10000000 }).withMessage('库存数量不合法'), body('validFrom').optional().isISO8601().withMessage('validFrom 格式错误'), body('validTo').optional().isISO8601().withMessage('validTo 格式错误'), body('description').optional().isLength({ max: 500 }).withMessage('描述过长'), body('merchantId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('商家ID不合法'), body('status').optional().isIn([1,2]).withMessage('状态值不合法'), validate], async (req, res) => {
  try {
    const { Coupon } = req.models
    const coupon = await Coupon.findByPk(req.params.id)

    if (!coupon) {
      return res.status(404).json({ success: false, message: '消费券不存在' })
    }

    const { name, amount, minSpend, totalCount, validFrom, validTo, description, merchantId, status } = req.body

    if (amount !== undefined && (Number(amount) <= 0 || !Number.isFinite(Number(amount)))) {
      return res.status(400).json({ success: false, message: '金额必须为正数' })
    }
    if (status !== undefined && ![1, 2].includes(Number(status))) {
      return res.status(400).json({ success: false, message: '无效的状态值' })
    }

    await coupon.update({
      name: name ?? coupon.name,
      amount: amount ?? coupon.amount,
      min_spend: minSpend ?? coupon.min_spend,
      total_count: totalCount ?? coupon.total_count,
      valid_from: validFrom ?? coupon.valid_from,
      valid_to: validTo ?? coupon.valid_to,
      description: description ?? coupon.description,
      merchant_id: merchantId ?? coupon.merchant_id,
      status: status ?? coupon.status
    })

    res.json({ success: true, data: coupon })
  } catch (error) {
    logger.error('更新消费券失败', { error: error.message })
    res.status(500).json({ success: false, message: '更新失败' })
  }
})

router.delete('/:id', adminWriteAuth, async (req, res) => {
  try {
    const { Coupon } = req.models
    const coupon = await Coupon.findByPk(req.params.id)

    if (!coupon) {
      return res.status(404).json({ success: false, message: '消费券不存在' })
    }

    await coupon.update({ status: 2 })

    res.json({ success: true, message: '已停用' })
  } catch (error) {
    logger.error('停用消费券失败', { error: error.message })
    res.status(500).json({ success: false, message: '停用失败' })
  }
})

module.exports = router

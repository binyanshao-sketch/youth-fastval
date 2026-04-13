const express = require('express')
const { Op } = require('sequelize')
const { body, param, validationResult } = require('express-validator')
const { requireAdminPermission } = require('../../middleware/auth')

const logger = require('../../utils/logger')

const router = express.Router()
const adminAuth = requireAdminPermission('merchants:read')
const adminWriteAuth = requireAdminPermission('merchants:write')
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg })
  next()
}

router.get('/', adminAuth, async (req, res) => {
  try {
    const { Merchant } = req.models
    const { page = 1, pageSize = 20, name, status } = req.query
    const pageNumber = Math.max(1, parseInt(page, 10) || 1)
    const pageSizeNumber = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))

    const where = {}
    if (name) where.name = { [Op.like]: `%${String(name).replace(/[\\%_]/g, '\\$&')}%` }
    if (status) {
      const s = Number(status)
      if ([1, 2].includes(s)) where.status = s
    }

    const { count, rows } = await Merchant.findAndCountAll({
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
    logger.error('获取商家列表失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.get('/:id', adminAuth, async (req, res) => {
  try {
    const { Merchant } = req.models
    const merchant = await Merchant.findByPk(req.params.id)

    if (!merchant) {
      return res.status(404).json({ success: false, message: '商家不存在' })
    }

    res.json({ success: true, data: merchant })
  } catch (error) {
    logger.error('获取商家详情失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.post('/', adminWriteAuth, [body('name').isLength({ min: 2, max: 100 }).withMessage('商家名称不合法'), body('phone').isMobilePhone('zh-CN').withMessage('联系电话格式错误'), body('category').isLength({ min: 1, max: 50 }).withMessage('分类不合法'), body('address').isLength({ min: 3, max: 200 }).withMessage('地址不合法'), body('contactName').optional().isLength({ min: 1, max: 50 }).withMessage('联系人不合法'), body('licenseImage').optional().isURL().withMessage('营业执照图片 URL 格式不正确'), validate], async (req, res) => {
  try {
    const { Merchant } = req.models
    const { name, phone, category, address, contactName, licenseImage } = req.body

    if (!name || !phone || !category || !address) {
      return res.status(400).json({ success: false, message: '缺少必要参数' })
    }

    const merchant = await Merchant.create({
      name,
      contact_phone: phone,
      category,
      address,
      contact_name: contactName,
      license_image: licenseImage || null,
      status: 1,
      created_at: new Date()
    })

    res.json({ success: true, data: merchant })
  } catch (error) {
    logger.error('创建商家失败', { error: error.message })
    res.status(500).json({ success: false, message: '创建失败' })
  }
})

router.put('/:id', adminWriteAuth, [param('id').isInt({ min: 1 }).withMessage('商家ID不合法'), body('name').optional().isLength({ min: 2, max: 100 }).withMessage('商家名称不合法'), body('phone').optional().isMobilePhone('zh-CN').withMessage('联系电话格式错误'), body('category').optional().isLength({ min: 1, max: 50 }).withMessage('分类不合法'), body('address').optional().isLength({ min: 3, max: 200 }).withMessage('地址不合法'), body('contactName').optional().isLength({ min: 1, max: 50 }).withMessage('联系人不合法'), body('status').optional().isIn([1,2]).withMessage('状态值不合法'), validate], async (req, res) => {
  try {
    const { Merchant } = req.models
    const merchant = await Merchant.findByPk(req.params.id)

    if (!merchant) {
      return res.status(404).json({ success: false, message: '商家不存在' })
    }

    const { name, phone, category, address, contactName, status } = req.body

    await merchant.update({
      name: name ?? merchant.name,
      contact_phone: phone ?? merchant.contact_phone,
      category: category ?? merchant.category,
      address: address ?? merchant.address,
      contact_name: contactName ?? merchant.contact_name,
      status: status ?? merchant.status
    })

    res.json({ success: true, data: merchant })
  } catch (error) {
    logger.error('更新商家失败', { error: error.message })
    res.status(500).json({ success: false, message: '更新失败' })
  }
})

router.post('/:id/verify', adminWriteAuth, async (req, res) => {
  try {
    const { Merchant } = req.models
    const merchant = await Merchant.findByPk(req.params.id)

    if (!merchant) {
      return res.status(404).json({ success: false, message: '商家不存在' })
    }

    await merchant.update({ status: 2, verified_at: new Date() })

    res.json({ success: true, message: '审核通过' })
  } catch (error) {
    logger.error('审核商家失败', { error: error.message })
    res.status(500).json({ success: false, message: '审核失败' })
  }
})

module.exports = router

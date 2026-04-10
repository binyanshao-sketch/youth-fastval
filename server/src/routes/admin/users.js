const express = require('express')
const { Op } = require('sequelize')
const { body, param, validationResult } = require('express-validator')
const { requireAdminPermission } = require('../../middleware/auth')

const logger = require('../../utils/logger')

const router = express.Router()
const adminAuth = requireAdminPermission('users:read')
const adminWriteAuth = requireAdminPermission('users:write')
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg })
  next()
}

router.get('/', adminAuth, async (req, res) => {
  try {
    const { User } = req.models
    const { page = 1, pageSize = 20, phone, status } = req.query
    const pageNumber = Math.max(1, parseInt(page, 10) || 1)
    const pageSizeNumber = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))

    const where = {}
    if (phone) where.phone = { [Op.like]: `%${String(phone).replace(/[\\%_]/g, '\\$&')}%` }
    if (status) {
      const s = Number(status)
      if ([1, 2].includes(s)) where.status = s
    }

    const { count, rows } = await User.findAndCountAll({
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
    logger.error('获取用户列表失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.get('/:id', adminAuth, async (req, res) => {
  try {
    const { User } = req.models
    const user = await User.findByPk(req.params.id)

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' })
    }

    res.json({ success: true, data: user })
  } catch (error) {
    logger.error('获取用户详情失败', { error: error.message })
    res.status(500).json({ success: false, message: '获取失败' })
  }
})

router.put('/:id', adminWriteAuth,
  [param('id').isInt({ min: 1 }).withMessage('用户ID不合法'), body('nickname').optional().isLength({ min: 1, max: 64 }).withMessage('昵称长度不合法'), body('phone').optional().isMobilePhone('zh-CN').withMessage('手机号格式错误'), body('status').optional().isIn([1,2]).withMessage('状态值不合法'), validate], async (req, res) => {
  try {
    const { User } = req.models
    const { nickname, phone, status } = req.body
    const user = await User.findByPk(req.params.id)

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' })
    }

    await user.update({
      nickname: nickname ?? user.nickname,
      phone: phone ?? user.phone,
      status: status ?? user.status
    })

    res.json({ success: true, data: user })
  } catch (error) {
    logger.error('更新用户失败', { error: error.message })
    res.status(500).json({ success: false, message: '更新失败' })
  }
})

router.post('/:id/blacklist', adminWriteAuth, [param('id').isInt({ min: 1 }).withMessage('用户ID不合法'), validate], async (req, res) => {
  try {
    const { User } = req.models
    const user = await User.findByPk(req.params.id)

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' })
    }

    await user.update({ status: 2 })

    res.json({ success: true, message: '已加入黑名单' })
  } catch (error) {
    logger.error('拉黑用户失败', { error: error.message })
    res.status(500).json({ success: false, message: '操作失败' })
  }
})

module.exports = router

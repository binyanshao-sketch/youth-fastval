/**
 * 管理后台 - 用户管理路由
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { requireRole } = require('../../middleware/auth');
const AdminLogService = require('../../services/AdminLogService');
const logger = require('../../utils/logger');

const adminAuth = requireRole('admin');

// 用户列表
router.get('/', adminAuth, async (req, res) => {
  try {
    const { User } = req.models;
    const { page = 1, pageSize = 20, phone, status } = req.query;

    const where = {};
    if (phone) where.phone = { [Op.like]: `%${phone}%` };
    if (status) where.status = status;

    const { count, rows } = await User.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });

    res.json({
      success: true,
      data: {
        list: rows,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    logger.error('获取用户列表失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.get('/:id', adminAuth, async (req, res) => {
  try {
    const { User } = req.models;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('获取用户详情失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { User } = req.models;
    const { nickname, phone, status } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    await user.update({
      nickname: nickname ?? user.nickname,
      phone: phone ?? user.phone,
      status: status ?? user.status
    });

    const logService = new AdminLogService(req.models);
    await logService.log(req.adminId, 'update_user', `user:${req.params.id}`, { nickname, phone, status }, req.ip);

    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('更新用户失败', { error: error.message });
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

router.post('/:id/blacklist', adminAuth, async (req, res) => {
  try {
    const { User } = req.models;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    await user.update({ status: 2 });

    const logService = new AdminLogService(req.models);
    await logService.log(req.adminId, 'blacklist_user', `user:${req.params.id}`, null, req.ip);

    res.json({ success: true, message: '已加入黑名单' });
  } catch (error) {
    logger.error('拉黑用户失败', { error: error.message });
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

module.exports = router;

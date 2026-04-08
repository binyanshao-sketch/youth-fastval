/**
 * 管理后台 - 商家管理路由
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { requireRole } = require('../../middleware/auth');
const AdminLogService = require('../../services/AdminLogService');
const logger = require('../../utils/logger');

const adminAuth = requireRole('admin');

// 商家列表
router.get('/', adminAuth, async (req, res) => {
  try {
    const { Merchant } = req.models;
    const { page = 1, pageSize = 20, name, status } = req.query;

    const where = {};
    if (name) where.name = { [Op.like]: `%${name}%` };
    if (status) where.status = status;

    const { count, rows } = await Merchant.findAndCountAll({
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
    logger.error('获取商家列表失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.get('/:id', adminAuth, async (req, res) => {
  try {
    const { Merchant } = req.models;
    const merchant = await Merchant.findByPk(req.params.id);

    if (!merchant) {
      return res.status(404).json({ success: false, message: '商家不存在' });
    }

    res.json({ success: true, data: merchant });
  } catch (error) {
    logger.error('获取商家详情失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 添加商家
router.post('/', adminAuth, async (req, res) => {
  try {
    const { Merchant } = req.models;
    const { name, phone, category, address, contactName } = req.body;

    if (!name || !phone || !category || !address) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    const merchant = await Merchant.create({
      name,
      contact_phone: phone,
      category,
      address,
      contact_name: contactName,
      status: 1,
      created_at: new Date()
    });

    const logService = new AdminLogService(req.models);
    await logService.log(req.adminId, 'create_merchant', `merchant:${merchant.id}`, { name }, req.ip);

    res.json({ success: true, data: merchant });
  } catch (error) {
    logger.error('添加商家失败', { error: error.message });
    res.status(500).json({ success: false, message: '添加失败' });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { Merchant } = req.models;
    const merchant = await Merchant.findByPk(req.params.id);

    if (!merchant) {
      return res.status(404).json({ success: false, message: '商家不存在' });
    }

    const { name, phone, category, address, contactName, status } = req.body;
    await merchant.update({
      name: name ?? merchant.name,
      contact_phone: phone ?? merchant.contact_phone,
      category: category ?? merchant.category,
      address: address ?? merchant.address,
      contact_name: contactName ?? merchant.contact_name,
      status: status ?? merchant.status
    });

    const logService = new AdminLogService(req.models);
    await logService.log(req.adminId, 'update_merchant', `merchant:${req.params.id}`, { name, status }, req.ip);

    res.json({ success: true, data: merchant });
  } catch (error) {
    logger.error('更新商家失败', { error: error.message });
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

router.post('/:id/verify', adminAuth, async (req, res) => {
  try {
    const { Merchant } = req.models;
    const merchant = await Merchant.findByPk(req.params.id);

    if (!merchant) {
      return res.status(404).json({ success: false, message: '商家不存在' });
    }

    await merchant.update({ status: 2, verified_at: new Date() });

    const logService = new AdminLogService(req.models);
    await logService.log(req.adminId, 'verify_merchant', `merchant:${req.params.id}`, null, req.ip);

    res.json({ success: true, message: '审核通过' });
  } catch (error) {
    logger.error('审核商家失败', { error: error.message });
    res.status(500).json({ success: false, message: '审核失败' });
  }
});

module.exports = router;

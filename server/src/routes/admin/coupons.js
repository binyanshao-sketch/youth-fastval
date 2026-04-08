/**
 * 管理后台 - 消费券管理路由
 */

const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/auth');
const AdminLogService = require('../../services/AdminLogService');
const logger = require('../../utils/logger');

const adminAuth = requireRole('admin');

// 消费券列表
router.get('/', adminAuth, async (req, res) => {
  try {
    const { Coupon } = req.models;
    const { page = 1, pageSize = 20 } = req.query;

    const { count, rows } = await Coupon.findAndCountAll({
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
    logger.error('获取消费券列表失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 创建消费券
router.post('/', adminAuth, async (req, res) => {
  try {
    const { Coupon } = req.models;
    const { name, amount, minSpend, totalCount, validFrom, validTo, description, merchantId } = req.body;

    if (!name || !amount || !totalCount || !validFrom || !validTo) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
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
    });

    const logService = new AdminLogService(req.models);
    await logService.log(req.adminId, 'create_coupon', `coupon:${coupon.id}`, { name, amount }, req.ip);

    res.json({ success: true, data: coupon });
  } catch (error) {
    logger.error('创建消费券失败', { error: error.message });
    res.status(500).json({ success: false, message: '创建失败' });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { Coupon } = req.models;
    const coupon = await Coupon.findByPk(req.params.id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: '消费券不存在' });
    }

    const { name, amount, minSpend, totalCount, validFrom, validTo, description, merchantId, status } = req.body;
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
    });

    const logService = new AdminLogService(req.models);
    await logService.log(req.adminId, 'update_coupon', `coupon:${req.params.id}`, { name, status }, req.ip);

    res.json({ success: true, data: coupon });
  } catch (error) {
    logger.error('更新消费券失败', { error: error.message });
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { Coupon } = req.models;
    const coupon = await Coupon.findByPk(req.params.id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: '消费券不存在' });
    }

    await coupon.update({ status: 2 });

    const logService = new AdminLogService(req.models);
    await logService.log(req.adminId, 'disable_coupon', `coupon:${req.params.id}`, null, req.ip);

    res.json({ success: true, message: '已停用' });
  } catch (error) {
    logger.error('停用消费券失败', { error: error.message });
    res.status(500).json({ success: false, message: '停用失败' });
  }
});

module.exports = router;

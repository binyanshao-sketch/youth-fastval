/**
 * 管理后台 - 财务管理路由
 * 使用 SQL UNION + 数据库级分页替代内存分页
 */

const express = require('express');
const router = express.Router();
const { QueryTypes } = require('sequelize');
const dayjs = require('dayjs');
const { requireRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const adminAuth = requireRole('admin');

// 财务记录（SQL级别分页）
router.get('/records', adminAuth, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const pageNumber = parseInt(page);
    const pageSizeNumber = parseInt(pageSize);
    const offset = (pageNumber - 1) * pageSizeNumber;

    const countSql = `
      SELECT
        (SELECT COUNT(*) FROM lucky_bag_records) +
        (SELECT COUNT(*) FROM verify_records)
      AS total
    `;
    const [countResult] = await req.models.sequelize.query(countSql, { type: QueryTypes.SELECT });
    const total = countResult.total;

    const dataSql = `
      (
        SELECT
          CONCAT('rp-', r.id) AS id,
          'redpacket' AS type,
          IFNULL(u.phone, '未知用户') AS title,
          r.redpacket_amount AS amount,
          r.redpacket_status AS status,
          IFNULL(r.redpacket_sent_at, r.received_at) AS time
        FROM lucky_bag_records r
        LEFT JOIN users u ON u.id = r.user_id
      )
      UNION ALL
      (
        SELECT
          CONCAT('cp-', v.id) AS id,
          'coupon' AS type,
          IFNULL(m.name, '未知商家') AS title,
          v.coupon_amount AS amount,
          2 AS status,
          v.verified_at AS time
        FROM verify_records v
        LEFT JOIN merchants m ON m.id = v.merchant_id
      )
      ORDER BY time DESC
      LIMIT :limit OFFSET :offset
    `;

    const list = await req.models.sequelize.query(dataSql, {
      replacements: { limit: pageSizeNumber, offset },
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: {
        list: list.map(item => ({
          ...item,
          amount: Number(item.amount)
        })),
        total,
        page: pageNumber,
        pageSize: pageSizeNumber
      }
    });
  } catch (error) {
    logger.error('获取财务记录失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 财务统计
router.get('/summary', adminAuth, async (req, res) => {
  try {
    const { LuckyBagRecord, VerifyRecord } = req.models;
    const redPacketIssued = await LuckyBagRecord.sum('redpacket_amount') || 0;
    const redPacketWithdrawn = await LuckyBagRecord.sum('redpacket_amount', {
      where: { redpacket_status: 2 }
    }) || 0;
    const couponTotal = await VerifyRecord.sum('coupon_amount') || 0;

    res.json({
      success: true,
      data: {
        redPacketIssued: redPacketIssued.toFixed(2),
        redPacketWithdrawn: redPacketWithdrawn.toFixed(2),
        couponTotal: couponTotal.toFixed(2),
        totalExpense: (redPacketWithdrawn + couponTotal).toFixed(2)
      }
    });
  } catch (error) {
    logger.error('获取财务统计失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 财务导出
router.get('/export', adminAuth, async (req, res) => {
  try {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const csv = [
      'type,title,amount,time',
      `summary,export_generated,0,${now}`
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="finance-export-${dayjs().format('YYYYMMDDHHmmss')}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    logger.error('导出财务失败', { error: error.message });
    res.status(500).json({ success: false, message: '导出失败' });
  }
});

module.exports = router;

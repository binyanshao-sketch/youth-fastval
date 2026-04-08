/**
 * 管理后台API路由
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/auth');
const { Op, fn, col } = require('sequelize');
const moment = require('moment');

function buildSystemConfigMap(configList) {
  return configList.reduce((acc, item) => {
    acc[item.config_key] = item.config_value;
    return acc;
  }, {});
}

async function getSystemConfigMap(models) {
  const configList = await models.SystemConfig.findAll({
    order: [['config_key', 'ASC']]
  });
  return buildSystemConfigMap(configList);
}

async function upsertSystemConfig(models, entries) {
  const keys = Object.keys(entries);
  for (const key of keys) {
    await models.SystemConfig.upsert({
      config_key: key,
      config_value: String(entries[key] ?? '')
    });
  }
}

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { Admin } = req.models;
    
    const admin = await Admin.findOne({ where: { username } });
    if (!admin) {
      return res.status(400).json({ success: false, message: '用户名或密码错误' });
    }
    
    if (!(await bcrypt.compare(password, admin.password))) {
      return res.status(400).json({ success: false, message: '用户名或密码错误' });
    }
    
    // 生成token
    const token = req.app.locals.jwt.sign(
      { adminId: admin.id, type: 'admin' },
      '24h'
    );

    await admin.update({ last_login_at: new Date() });
    
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
    console.error('管理员登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

router.get('/user/info', authMiddleware, async (req, res) => {
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
    console.error('获取管理员信息失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 仪表盘数据
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const { User, LuckyBagRecord, Merchant, UserCoupon, VerifyRecord } = req.models;
    // 统计数据
    const userCount = await User.count();
    const redpacketTotal = await LuckyBagRecord.sum('redpacket_amount') || 0;
    const couponUsedCount = await UserCoupon.count({ where: { status: 2 } });
    const merchantCount = await Merchant.count({ where: { status: 2 } });
    
    // 最新领取记录
    const latestRecords = await LuckyBagRecord.findAll({
      order: [['received_at', 'DESC']],
      limit: 10,
      include: [{ model: User, as: 'user', attributes: ['phone'] }]
    });
    
    // 最新核销记录
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
          time: moment(r.received_at).format('YYYY-MM-DD HH:mm:ss')
        })),
        latestVerifies: latestVerifies.map(v => ({
          merchant: v.merchant?.name || '-',
          amount: v.coupon_amount,
          time: moment(v.verified_at).format('YYYY-MM-DD HH:mm:ss')
        }))
      }
    });
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 用户列表
router.get('/users', authMiddleware, async (req, res) => {
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
    console.error('获取用户列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.get('/users/:id', authMiddleware, async (req, res) => {
  try {
    const { User } = req.models;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.put('/users/:id', authMiddleware, async (req, res) => {
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

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('更新用户失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

router.post('/users/:id/blacklist', authMiddleware, async (req, res) => {
  try {
    const { User } = req.models;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    await user.update({ status: 2 });
    res.json({ success: true, message: '已加入黑名单' });
  } catch (error) {
    console.error('拉黑用户失败:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

router.get('/lucky-bag/records', authMiddleware, async (req, res) => {
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
    console.error('获取福袋记录失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.get('/lucky-bag/config', authMiddleware, async (req, res) => {
  try {
    const configMap = await getSystemConfigMap(req.models);
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
    console.error('获取福袋配置失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.put('/lucky-bag/config', authMiddleware, async (req, res) => {
  try {
    const { activityStartTime, activityEndTime, policyUrl, dailyLimit, isActive } = req.body;
    await upsertSystemConfig(req.models, {
      activity_start_time: activityStartTime,
      activity_end_time: activityEndTime,
      policy_url: policyUrl,
      daily_limit: dailyLimit,
      is_active: String(Boolean(isActive))
    });

    res.json({ success: true, message: '保存成功' });
  } catch (error) {
    console.error('更新福袋配置失败:', error);
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

// 商家列表
router.get('/merchants', authMiddleware, async (req, res) => {
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
    console.error('获取商家列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.get('/merchants/:id', authMiddleware, async (req, res) => {
  try {
    const { Merchant } = req.models;
    const merchant = await Merchant.findByPk(req.params.id);

    if (!merchant) {
      return res.status(404).json({ success: false, message: '商家不存在' });
    }

    res.json({ success: true, data: merchant });
  } catch (error) {
    console.error('获取商家详情失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 添加商家
router.post('/merchants', authMiddleware, async (req, res) => {
  try {
    const { Merchant } = req.models;
    const { name, phone, category, address, contactName } = req.body;
    
    const merchant = await Merchant.create({
      name,
      contact_phone: phone,
      category,
      address,
      contact_name: contactName,
      status: 1,
      created_at: new Date()
    });
    
    res.json({ success: true, data: merchant });
  } catch (error) {
    console.error('添加商家失败:', error);
    res.status(500).json({ success: false, message: '添加失败' });
  }
});

router.put('/merchants/:id', authMiddleware, async (req, res) => {
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

    res.json({ success: true, data: merchant });
  } catch (error) {
    console.error('更新商家失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

router.post('/merchants/:id/verify', authMiddleware, async (req, res) => {
  try {
    const { Merchant } = req.models;
    const merchant = await Merchant.findByPk(req.params.id);

    if (!merchant) {
      return res.status(404).json({ success: false, message: '商家不存在' });
    }

    await merchant.update({ status: 2, verified_at: new Date() });
    res.json({ success: true, message: '审核通过' });
  } catch (error) {
    console.error('审核商家失败:', error);
    res.status(500).json({ success: false, message: '审核失败' });
  }
});

// 消费券列表
router.get('/coupons', authMiddleware, async (req, res) => {
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
    console.error('获取消费券列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 创建消费券
router.post('/coupons', authMiddleware, async (req, res) => {
  try {
    const { Coupon } = req.models;
    const { name, amount, minSpend, totalCount, validFrom, validTo, description, merchantId } = req.body;
    
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
    
    res.json({ success: true, data: coupon });
  } catch (error) {
    console.error('创建消费券失败:', error);
    res.status(500).json({ success: false, message: '创建失败' });
  }
});

router.put('/coupons/:id', authMiddleware, async (req, res) => {
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

    res.json({ success: true, data: coupon });
  } catch (error) {
    console.error('更新消费券失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

router.delete('/coupons/:id', authMiddleware, async (req, res) => {
  try {
    const { Coupon } = req.models;
    const coupon = await Coupon.findByPk(req.params.id);

    if (!coupon) {
      return res.status(404).json({ success: false, message: '消费券不存在' });
    }

    await coupon.update({ status: 2 });
    res.json({ success: true, message: '已停用' });
  } catch (error) {
    console.error('停用消费券失败:', error);
    res.status(500).json({ success: false, message: '停用失败' });
  }
});

router.get('/finance/records', authMiddleware, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const pageNumber = parseInt(page);
    const pageSizeNumber = parseInt(pageSize);
    const { LuckyBagRecord, VerifyRecord, User, Merchant } = req.models;

    const [redpackets, verifies] = await Promise.all([
      LuckyBagRecord.findAll({
        include: [{ model: User, as: 'user', attributes: ['phone'] }],
        order: [['received_at', 'DESC']],
        limit: 100
      }),
      VerifyRecord.findAll({
        include: [{ model: Merchant, as: 'merchant', attributes: ['name'] }],
        order: [['verified_at', 'DESC']],
        limit: 100
      })
    ]);

    const merged = [
      ...redpackets.map(item => ({
        id: `rp-${item.id}`,
        type: 'redpacket',
        title: item.user?.phone || '未知用户',
        amount: Number(item.redpacket_amount),
        status: item.redpacket_status,
        time: item.redpacket_sent_at || item.received_at
      })),
      ...verifies.map(item => ({
        id: `cp-${item.id}`,
        type: 'coupon',
        title: item.merchant?.name || '未知商家',
        amount: Number(item.coupon_amount),
        status: 2,
        time: item.verified_at
      }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time));

    const start = (pageNumber - 1) * pageSizeNumber;
    const list = merged.slice(start, start + pageSizeNumber);

    res.json({
      success: true,
      data: {
        list,
        total: merged.length,
        page: pageNumber,
        pageSize: pageSizeNumber
      }
    });
  } catch (error) {
    console.error('获取财务记录失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 财务统计
router.get('/finance/summary', authMiddleware, async (req, res) => {
  try {
    const { LuckyBagRecord, VerifyRecord } = req.models;
    // 红包发放
    const redPacketIssued = await LuckyBagRecord.sum('redpacket_amount') || 0;
    const redPacketWithdrawn = await LuckyBagRecord.sum('redpacket_amount', {
      where: { redpacket_status: 2 }
    }) || 0;
    
    // 消费券核销
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
    console.error('获取财务统计失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 统计报表
router.get('/statistics', authMiddleware, async (req, res) => {
  try {
    const { LuckyBagRecord } = req.models;
    const { startDate, endDate } = req.query;
    
    const where = {};
    if (startDate && endDate) {
      where.received_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    // 按天统计
    const records = await LuckyBagRecord.findAll({
      where,
      attributes: [
        [fn('DATE', col('received_at')), 'date'],
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('redpacket_amount')), 'amount']
      ],
      group: [fn('DATE', col('received_at'))],
      order: [[fn('DATE', col('received_at')), 'ASC']]
    });
    
    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('获取统计报表失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.get('/statistics/users', authMiddleware, async (req, res) => {
  try {
    const { User } = req.models;
    const provinces = await User.findAll({
      attributes: [
        [fn('IFNULL', col('province'), '未填写'), 'province'],
        [fn('COUNT', col('id')), 'count']
      ],
      group: [fn('IFNULL', col('province'), '未填写')],
      order: [[fn('COUNT', col('id')), 'DESC']]
    });

    const latestUsers = await User.findAll({
      order: [['created_at', 'DESC']],
      limit: 10,
      attributes: ['id', 'phone', 'province', 'created_at']
    });

    res.json({
      success: true,
      data: {
        provinceDistribution: provinces,
        latestUsers
      }
    });
  } catch (error) {
    console.error('获取用户统计失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.get('/statistics/merchants', authMiddleware, async (req, res) => {
  try {
    const { VerifyRecord, Merchant } = req.models;
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
    });

    res.json({
      success: true,
      data: ranking.map(item => ({
        merchantId: item.merchant_id,
        merchantName: item.merchant?.name || '-',
        count: Number(item.get('count')),
        amount: Number(item.get('amount') || 0)
      }))
    });
  } catch (error) {
    console.error('获取商家统计失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const configMap = await getSystemConfigMap(req.models);
    res.json({ success: true, data: configMap });
  } catch (error) {
    console.error('获取系统设置失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.put('/settings', authMiddleware, async (req, res) => {
  try {
    await upsertSystemConfig(req.models, req.body);
    res.json({ success: true, message: '保存成功' });
  } catch (error) {
    console.error('更新系统设置失败:', error);
    res.status(500).json({ success: false, message: '保存失败' });
  }
});

router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const pageNumber = parseInt(page);
    const pageSizeNumber = parseInt(pageSize);
    const { Admin } = req.models;

    const { count, rows } = await Admin.findAndCountAll({
      attributes: ['id', 'username', 'name', 'role', 'last_login_at', 'updated_at'],
      order: [['updated_at', 'DESC']],
      limit: pageSizeNumber,
      offset: (pageNumber - 1) * pageSizeNumber
    });

    const list = rows.map(item => ({
      id: item.id,
      action: 'admin_login',
      operator: item.name || item.username,
      target: item.role,
      detail: '管理员信息变更/登录记录',
      createdAt: item.last_login_at || item.updated_at
    }));

    res.json({
      success: true,
      data: {
        list,
        total: count,
        page: pageNumber,
        pageSize: pageSizeNumber
      }
    });
  } catch (error) {
    console.error('获取日志失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

router.get('/finance/export', authMiddleware, async (req, res) => {
  try {
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    const csv = [
      'type,title,amount,time',
      `summary,export_generated,0,${now}`
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="finance-export-${moment().format('YYYYMMDDHHmmss')}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('导出财务失败:', error);
    res.status(500).json({ success: false, message: '导出失败' });
  }
});

module.exports = router;

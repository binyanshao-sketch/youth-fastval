/**
 * 福袋服务
 * 处理福袋领取、红包发放、消费券绑定等核心业务
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const RedPacketAllocator = require('./RedPacketAllocator');
const WeChatService = require('./WeChatService');
const logger = require('../utils/logger');

class LuckyBagService {
  constructor(models, redis) {
    this.models = models;
    this.redis = redis;
    this.redPacketAllocator = new RedPacketAllocator(redis);
  }

  /**
   * 检查用户是否已领取
   */
  async hasReceived(userId) {
    const record = await this.models.LuckyBagRecord.findOne({
      where: { user_id: userId }
    });
    return !!record;
  }

  async ensureRedPacketPool() {
    const hasPool = await this.redPacketAllocator.hasPool();
    if (hasPool) {
      return;
    }

    const poolConfig = await this.models.RedPacketPool.findAll({
      where: { status: 1 },
      order: [['amount', 'ASC']]
    });

    if (!poolConfig.length) {
      throw new Error('红包池未配置');
    }

    await this.redPacketAllocator.initPool(poolConfig.map(item => item.toJSON()));
  }

  /**
   * 检查活动是否进行中
   */
  async isActivityActive() {
    const config = await this.models.SystemConfig.findOne({
      where: { config_key: 'is_active' }
    });

    if (!config || config.config_value !== 'true') {
      return false;
    }

    const startTime = await this.models.SystemConfig.findOne({
      where: { config_key: 'activity_start_time' }
    });
    const endTime = await this.models.SystemConfig.findOne({
      where: { config_key: 'activity_end_time' }
    });

    const now = new Date();
    const start = new Date(startTime.config_value);
    const end = new Date(endTime.config_value);

    return now >= start && now <= end;
  }

  /**
   * 检查每日领取上限
   */
  async checkDailyLimit() {
    const dailyLimitConfig = await this.models.SystemConfig.findOne({
      where: { config_key: 'daily_limit' }
    });
    const dailyLimit = parseInt(dailyLimitConfig?.config_value || '5000');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await this.models.LuckyBagRecord.count({
      where: {
        received_at: { [Op.gte]: today }
      }
    });

    if (todayCount >= dailyLimit) {
      throw new Error('今日福袋已领完，请明天再来');
    }
  }

  /**
   * 领取福袋（使用 Redis 分布式锁防重复提交）
   */
  async receive(userId, ip, userAgent) {
    // 使用 Redis 锁防止同一用户并发领取
    const lockKey = `lock:lucky_bag:${userId}`;
    const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');
    if (!lockAcquired) {
      throw new Error('请勿重复提交');
    }

    try {
      await this.ensureRedPacketPool();

      // 1. 检查活动状态
      if (!(await this.isActivityActive())) {
        throw new Error('活动未开始或已结束');
      }

      // 2. 检查是否已领取
      if (await this.hasReceived(userId)) {
        throw new Error('每人限领1份');
      }

      // 3. 检查每日上限
      await this.checkDailyLimit();

      // 4. 检查红包库存
      if (!(await this.redPacketAllocator.hasStock())) {
        throw new Error('福袋已领完');
      }

      // 5. 分配红包（Redis 原子操作）
      const redPacket = await this.redPacketAllocator.allocate();

      // 6. 获取消费券（带库存检查）
      const coupons = await this.allocateCoupons();

      // 7. 获取政策链接
      const policyConfig = await this.models.SystemConfig.findOne({
        where: { config_key: 'policy_url' }
      });

      // 8. 使用事务创建记录 + 绑定消费券
      const transaction = await this.models.sequelize.transaction();
      let record;
      try {
        record = await this.models.LuckyBagRecord.create({
          user_id: userId,
          redpacket_amount: redPacket.amount,
          redpacket_status: 1,
          policy_url: policyConfig?.config_value || '',
          ip,
          user_agent: userAgent
        }, { transaction });

        await this.bindCoupons(userId, coupons, record.id, transaction);
        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        throw err;
      }

      // 9. 发送红包（异步，记录失败日志而非静默吞掉）
      this.sendRedPacket(userId, redPacket.amount, record.id).catch(err => {
        logger.error('异步红包发送失败', {
          userId,
          amount: redPacket.amount,
          recordId: record.id,
          error: err.message
        });
      });

      return {
        redPacket: {
          amount: redPacket.amount,
          blessing: redPacket.blessing
        },
        coupons: coupons.map(c => ({
          id: c.id,
          name: c.name,
          amount: c.amount,
          minSpend: c.min_spend,
          validTo: c.valid_to
        })),
        policyUrl: policyConfig?.config_value || ''
      };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /**
   * 分配消费券（带库存检查）
   */
  async allocateCoupons() {
    const coupons = await this.models.Coupon.findAll({
      where: {
        status: 1,
        valid_from: { [Op.lte]: new Date() },
        valid_to: { [Op.gte]: new Date() },
        // 库存检查：总数量 > 已发放数量
        [Op.and]: [
          this.models.sequelize.literal('total_count > used_count')
        ]
      },
      order: [['amount', 'DESC']],
      limit: 3
    });

    return coupons;
  }

  /**
   * 绑定消费券到用户（在事务内执行）
   */
  async bindCoupons(userId, coupons, recordId, transaction) {
    for (const coupon of coupons) {
      const code = this.generateCouponCode();

      await this.models.UserCoupon.create({
        user_id: userId,
        coupon_id: coupon.id,
        code,
        status: 1,
        received_at: new Date()
      }, { transaction });

      // 原子递增已发放数量
      await this.models.Coupon.increment('used_count', {
        where: { id: coupon.id },
        transaction
      });
    }
  }

  /**
   * 生成消费券码（使用 crypto 安全随机数，避免碰撞）
   */
  generateCouponCode() {
    const prefix = 'YB';
    // 使用 crypto 生成 8 字节随机数（16 位十六进制字符）
    const random = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `${prefix}${random}`;
  }

  /**
   * 发送红包到微信零钱
   */
  async sendRedPacket(userId, amount, recordId) {
    const user = await this.models.User.findByPk(userId);
    if (!user || !user.openid) {
      throw new Error('用户信息不完整');
    }

    // 生成唯一订单号
    const orderNo = `RP${Date.now()}${crypto.randomBytes(4).toString('hex')}`;

    try {
      const result = await this.callWechatPay(user.openid, amount, orderNo);

      await this.models.LuckyBagRecord.update({
        redpacket_order_no: orderNo,
        redpacket_status: 2,
        redpacket_sent_at: new Date()
      }, {
        where: { id: recordId }
      });

      return result;
    } catch (error) {
      await this.models.LuckyBagRecord.update({
        redpacket_order_no: orderNo,
        redpacket_status: 3
      }, {
        where: { id: recordId }
      });

      throw error;
    }
  }

  /**
   * 调用微信支付接口
   */
  async callWechatPay(openid, amount, orderNo) {
    const weChatService = new WeChatService(this.redis);
    const result = await weChatService.transferToBalance(openid, amount, orderNo);

    return {
      success: true,
      orderNo,
      amount,
      paymentNo: result.data?.paymentNo || null,
      paymentTime: result.data?.paymentTime || null
    };
  }

  /**
   * 获取用户福袋信息
   */
  async getUserLuckyBag(userId) {
    const record = await this.models.LuckyBagRecord.findOne({
      where: { user_id: userId }
    });

    if (!record) {
      return null;
    }

    const coupons = await this.models.UserCoupon.findAll({
      where: { user_id: userId },
      include: [{
        model: this.models.Coupon,
        as: 'coupon'
      }]
    });

    return {
      redPacket: {
        amount: record.redpacket_amount,
        status: record.redpacket_status,
        sentAt: record.redpacket_sent_at
      },
      coupons: coupons.map(uc => ({
        id: uc.id,
        code: uc.code,
        status: uc.status,
        coupon: uc.coupon
      })),
      receivedAt: record.received_at
    };
  }
}

module.exports = LuckyBagService;

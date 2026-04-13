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
  async enqueueRedPacketJob(recordId) {
    await this.models.sequelize.query(`
      INSERT INTO redpacket_jobs (lucky_bag_record_id, status, attempts, next_retry_at)
      VALUES (?, 'pending', 0, NOW())
      ON DUPLICATE KEY UPDATE
        status = IF(status = 'success', status, 'pending'),
        next_retry_at = IF(status = 'success', next_retry_at, NOW()),
        updated_at = NOW()
    `, { replacements: [recordId] });
  }

  async markRedPacketJob(recordId, status, errorMessage = null) {
    await this.models.sequelize.query(`
      UPDATE redpacket_jobs
      SET status = ?,
          last_error = ?,
          finished_at = CASE WHEN ? = 'success' THEN NOW() ELSE finished_at END,
          updated_at = NOW()
      WHERE lucky_bag_record_id = ?
    `, { replacements: [status, errorMessage, status, recordId] });
  }

  async scheduleRedPacketRetry(recordId, errorMessage, attempts) {
    const cappedAttempts = Number(attempts) || 0;
    const delayMinutes = Math.min(30, Math.max(1, 2 ** cappedAttempts));
    await this.models.sequelize.query(`
      UPDATE redpacket_jobs
      SET status = ?,
          attempts = ?,
          last_error = ?,
          next_retry_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
          updated_at = NOW()
      WHERE lucky_bag_record_id = ?
    `, { replacements: [cappedAttempts >= 5 ? 'dead' : 'retrying', cappedAttempts, errorMessage, delayMinutes, recordId] });
  }

  async processPendingRedPacketJobs(limit = 20) {
    const [jobs] = await this.models.sequelize.query(`
      SELECT id, lucky_bag_record_id, attempts
      FROM redpacket_jobs
      WHERE status IN ('pending', 'retrying')
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY id ASC
      LIMIT ?
    `, { replacements: [limit] });

    for (const job of jobs) {
      const record = await this.models.LuckyBagRecord.findByPk(job.lucky_bag_record_id);
      if (!record) {
        await this.markRedPacketJob(job.lucky_bag_record_id, 'dead', 'record not found');
        continue;
      }

      try {
        await this.sendRedPacket(record.user_id, record.redpacket_amount, record.id);
        await this.markRedPacketJob(record.id, 'success');
      } catch (error) {
        await this.scheduleRedPacketRetry(record.id, error.message, Number(job.attempts || 0) + 1);
        logger.error('红包补偿任务执行失败', { recordId: record.id, error: error.message });
      }
    }
  }
  constructor(models, redis) {
    this.models = models;
    this.redis = redis;
    this.redPacketAllocator = new RedPacketAllocator(redis);
  }

  isMockPaymentMode() {
    return process.env.WX_USE_MOCK === 'true';
  }

  buildDelivery(status) {
    const isMockMode = this.isMockPaymentMode();
    const mapping = {
      1: {
        status: 'processing',
        title: isMockMode ? '测试红包模拟发放中' : '微信红包发放中',
        description: isMockMode
          ? '当前处于测试模式，系统只模拟红包发放流程，不会真实支付到微信零钱。'
          : '金额已锁定，正在通过小程序或公众号通道发放到你的微信零钱。'
      },
      2: {
        status: 'sent',
        title: isMockMode ? '测试红包模拟到账' : '微信红包已到账',
        description: isMockMode
          ? '当前处于测试模式，红包状态已模拟为成功到账，未发生真实支付。'
          : '红包已发放完成，请前往微信零钱查看到账明细。'
      },
      3: {
        status: 'failed',
        title: isMockMode ? '测试红包模拟失败' : '红包发放待重试',
        description: isMockMode
          ? '当前处于测试模式，红包流程被标记为失败，可继续排查测试链路。'
          : '本次发放未完成，请稍后返回查看或联系管理员处理。'
      }
    };

    return {
      channel: isMockMode ? '测试模拟通道' : '微信零钱',
      mode: isMockMode ? 'mock' : 'live',
      ...(mapping[status] || mapping[1])
    };
  }

  buildPoster(redPacket, record) {
    const amount = Number(redPacket.amount || record?.redpacket_amount || 0).toFixed(2);
    const blessing = redPacket.blessing || record?.redpacket_blessing || '青春正当时，愿你一路有光。';

    return {
      headline: '青春福袋已开启',
      title: '五四青年节限定祝福',
      amount,
      blessing,
      posterUrl: redPacket.poster_url || redPacket.posterUrl || '',
      footer: this.isMockPaymentMode()
        ? '当前为测试模式，红包结果为模拟展示。'
        : '共青团宜宾市委邀你继续解锁下一重惊喜'
    };
  }

  buildLuckyBagResponse({ record, redPacket, coupons, policyUrl }) {
    return {
      selectedSlot: record?.selected_slot ?? null,
      redPacket: {
        amount: Number(redPacket?.amount || record?.redpacket_amount || 0).toFixed(2),
        blessing: redPacket?.blessing || record?.redpacket_blessing || '',
        status: record?.redpacket_status ?? 1,
        sentAt: record?.redpacket_sent_at || null,
        mode: this.isMockPaymentMode() ? 'mock' : 'live'
      },
      coupons: (coupons || []).map((item) => {
        if (item.coupon) {
          return {
            id: item.id,
            code: item.code,
            status: item.status,
            coupon: item.coupon
          };
        }

        return {
          id: item.id,
          name: item.name,
          amount: item.amount,
          minSpend: item.min_spend,
          validTo: item.valid_to
        };
      }),
      policyUrl: policyUrl || record?.policy_url || '',
      delivery: this.buildDelivery(record?.redpacket_status || 1),
      poster: this.buildPoster(redPacket || {}, record)
    };
  }

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

    await this.redPacketAllocator.initPool(poolConfig.map((item) => item.toJSON()));
  }

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

    if (!startTime?.config_value || !endTime?.config_value) {
      return false;
    }

    const now = new Date();
    const start = new Date(startTime.config_value);
    const end = new Date(endTime.config_value);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }

    return now >= start && now <= end;
  }

  async checkDailyLimit() {
    const dailyLimitConfig = await this.models.SystemConfig.findOne({
      where: { config_key: 'daily_limit' }
    });
    const dailyLimit = parseInt(dailyLimitConfig?.config_value || '5000', 10);

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

  async receive(userId, ip, userAgent, slotIndex = null) {
    const lockKey = `lock:lucky_bag:${userId}`;
    const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');
    if (!lockAcquired) {
      throw new Error('请勿重复提交');
    }

    try {
      await this.ensureRedPacketPool();

      if (!(await this.isActivityActive())) {
        throw new Error('活动未开始或已结束');
      }

      if (await this.hasReceived(userId)) {
        throw new Error('每人限领1份');
      }

      await this.checkDailyLimit();

      if (!(await this.redPacketAllocator.hasStock())) {
        throw new Error('福袋已领完');
      }

      const redPacket = await this.redPacketAllocator.allocate();

      // 查询该金额对应的海报
      const poolRecord = await this.models.RedPacketPool.findOne({
        where: { amount: redPacket.amount, status: 1 },
        attributes: ['poster_url']
      });
      redPacket.poster_url = poolRecord?.poster_url || '';

      const policyConfig = await this.models.SystemConfig.findOne({
        where: { config_key: 'policy_url' }
      });

      const transaction = await this.models.sequelize.transaction();
      let record;
      let coupons;
      try {
        // 将 Redis 中的扣减同步到数据库，放入事务保证一致性
        await this.models.RedPacketPool.increment('used_count', {
          where: { amount: redPacket.amount, status: 1 },
          transaction
        });

        // 在事务内分配消费券，使用 FOR UPDATE 锁防止并发超发
        coupons = await this.allocateCoupons(transaction);

        if (!coupons.length) {
          throw new Error('暂无可用消费券，请稍后再试');
        }

        record = await this.models.LuckyBagRecord.create({
          user_id: userId,
          redpacket_amount: redPacket.amount,
          redpacket_blessing: redPacket.blessing,
          redpacket_status: 1,
          selected_slot: slotIndex,
          policy_url: policyConfig?.config_value || '',
          ip,
          user_agent: userAgent
        }, { transaction });

        await this.bindCoupons(userId, coupons, record.id, transaction);
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        try {
          await this.redPacketAllocator.release(redPacket.amountKey || redPacket.amount);
        } catch (releaseError) {
          logger.error('红包库存回补失败', {
            amount: redPacket.amount,
            amountKey: redPacket.amountKey || String(redPacket.amount),
            error: releaseError.message
          });
        }
        if (record?.id) {
          await this.markRedPacketJob(record.id, 'failed', error.message);
        }
        throw error;
      }

      await this.enqueueRedPacketJob(record.id);

      this.sendRedPacket(userId, redPacket.amount, record.id).catch((error) => {
        logger.error('异步红包发送失败', {
          userId,
          amount: redPacket.amount,
          recordId: record.id,
          error: error.message
        });
      });

      return this.buildLuckyBagResponse({
        record,
        redPacket,
        coupons,
        policyUrl: policyConfig?.config_value || ''
      });
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async allocateCoupons(transaction = null) {
    const now = new Date();
    const options = {
      where: {
        status: 1,
        valid_from: { [Op.lte]: now },
        valid_to: { [Op.gte]: now },
        [Op.and]: [
          this.models.sequelize.literal('used_count < total_count')
        ]
      },
      order: [['amount', 'DESC']],
      limit: 3
    };

    if (transaction) {
      options.transaction = transaction;
      options.lock = transaction.LOCK.UPDATE;
    }

    const candidates = await this.models.Coupon.findAll(options);
    const reservedCoupons = [];

    for (const coupon of candidates) {
      const reserved = await this.reserveCouponStock(coupon.id, transaction, now);
      if (reserved) {
        reservedCoupons.push(coupon);
      }
    }

    return reservedCoupons;
  }

  async reserveCouponStock(couponId, transaction, now = new Date()) {
    const [affectedRows] = await this.models.Coupon.update({
      used_count: this.models.sequelize.literal('used_count + 1')
    }, {
      where: {
        id: couponId,
        status: 1,
        valid_from: { [Op.lte]: now },
        valid_to: { [Op.gte]: now },
        [Op.and]: [
          this.models.sequelize.literal('used_count < total_count')
        ]
      },
      transaction
    });

    return affectedRows === 1;
  }

  async bindCoupons(userId, coupons, recordId, transaction) {
    for (const coupon of coupons) {
      await this.createUserCoupon(userId, coupon.id, transaction);
    }
  }

  async createUserCoupon(userId, couponId, transaction) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.generateCouponCode();

      try {
        return await this.models.UserCoupon.create({
          user_id: userId,
          coupon_id: couponId,
          code,
          status: 1,
          received_at: new Date()
        }, { transaction });
      } catch (error) {
        if (this.isCouponCodeCollision(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('消费券码生成失败，请稍后再试');
  }

  isCouponCodeCollision(error) {
    return error?.name === 'SequelizeUniqueConstraintError';
  }

  generateCouponCode() {
    const prefix = 'YB';
    const random = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `${prefix}${random}`;
  }

  async sendRedPacket(userId, amount, recordId) {
    const user = await this.models.User.findByPk(userId);
    if (!user || !user.openid) {
      throw new Error('用户信息不完整');
    }

    const orderNo = `RP${Date.now()}${crypto.randomBytes(4).toString('hex')}`;

    try {
      await this.markRedPacketJob(recordId, 'processing');
      const result = await this.callWechatPay(user.openid, amount, orderNo);

      await this.models.LuckyBagRecord.update({
        redpacket_order_no: orderNo,
        redpacket_status: 2,
        redpacket_sent_at: new Date()
      }, {
        where: { id: recordId }
      });

      await this.markRedPacketJob(recordId, 'success');
      return result;
    } catch (error) {
      await this.models.LuckyBagRecord.update({
        redpacket_order_no: orderNo,
        redpacket_status: 3
      }, {
        where: { id: recordId }
      });

      await this.markRedPacketJob(recordId, 'failed', error.message);
      throw error;
    }
  }

  async callWechatPay(openid, amount, orderNo) {
    const weChatService = new WeChatService(this.redis);
    const result = await weChatService.transferToBalance(openid, amount, orderNo);

    return {
      success: true,
      orderNo,
      amount,
      paymentNo: result.data?.paymentNo || null,
      paymentTime: result.data?.paymentTime || null,
      mode: this.isMockPaymentMode() ? 'mock' : 'live'
    };
  }

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

    // 根据记录金额查找对应海报
    const poolRecord = await this.models.RedPacketPool.findOne({
      where: { amount: record.redpacket_amount, status: 1 },
      attributes: ['poster_url']
    });

    return {
      ...this.buildLuckyBagResponse({
        record,
        redPacket: { poster_url: poolRecord?.poster_url || '' },
        coupons
      }),
      receivedAt: record.received_at
    };
  }
}

module.exports = LuckyBagService;

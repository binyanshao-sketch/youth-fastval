/**
 * 福袋服务
 * 处理福袋领取、红包发放、消费券绑定等核心业务
 */

const { Op } = require('sequelize');
const RedPacketAllocator = require('./RedPacketAllocator');
const WeChatService = require('./WeChatService');

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
   * 领取福袋
   */
  async receive(userId, ip, userAgent) {
    await this.ensureRedPacketPool();

    // 1. 检查活动状态
    if (!(await this.isActivityActive())) {
      throw new Error('活动未开始或已结束');
    }
    
    // 2. 检查是否已领取
    if (await this.hasReceived(userId)) {
      throw new Error('每人限领1份');
    }
    
    // 3. 检查红包库存
    if (!(await this.redPacketAllocator.hasStock())) {
      throw new Error('福袋已领完');
    }
    
    // 4. 分配红包
    const redPacket = await this.redPacketAllocator.allocate();
    
    // 5. 获取消费券
    const coupons = await this.allocateCoupons();
    
    // 6. 获取政策链接
    const policyConfig = await this.models.SystemConfig.findOne({
      where: { config_key: 'policy_url' }
    });
    
    // 7. 创建领取记录
    const record = await this.models.LuckyBagRecord.create({
      user_id: userId,
      redpacket_amount: redPacket.amount,
      redpacket_status: 1, // 待发放
      policy_url: policyConfig?.config_value || '',
      ip,
      user_agent: userAgent
    });
    
    // 8. 绑定消费券
    await this.bindCoupons(userId, coupons, record.id);
    
    // 9. 发送红包（异步）
    this.sendRedPacket(userId, redPacket.amount, record.id).catch(err => {
      console.error('红包发送失败:', err);
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
  }

  /**
   * 分配消费券
   */
  async allocateCoupons() {
    // 获取启用的消费券，按类别分配
    const coupons = await this.models.Coupon.findAll({
      where: {
        status: 1,
        valid_from: { [Op.lte]: new Date() },
        valid_to: { [Op.gte]: new Date() }
      },
      order: [['amount', 'DESC']],
      limit: 3
    });
    
    return coupons;
  }

  /**
   * 绑定消费券到用户
   */
  async bindCoupons(userId, coupons, recordId) {
    for (const coupon of coupons) {
      // 生成唯一券码
      const code = this.generateCouponCode();
      
      await this.models.UserCoupon.create({
        user_id: userId,
        coupon_id: coupon.id,
        code,
        status: 1, // 未使用
        received_at: new Date()
      });
      
      // 更新消费券已发放数量
      await coupon.increment('used_count');
    }
  }

  /**
   * 生成消费券码
   */
  generateCouponCode() {
    const prefix = 'YB'; // 宜宾
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * 发送红包到微信零钱
   */
  async sendRedPacket(userId, amount, recordId) {
    const user = await this.models.User.findByPk(userId);
    if (!user || !user.openid) {
      throw new Error('用户信息不完整');
    }
    
    // 生成订单号
    const orderNo = `RP${Date.now()}${userId}`;
    
    try {
      // 调用微信支付企业付款接口
      const result = await this.callWechatPay(user.openid, amount, orderNo);
      
      // 更新记录
      await this.models.LuckyBagRecord.update({
        redpacket_order_no: orderNo,
        redpacket_status: 2, // 已发放
        redpacket_sent_at: new Date()
      }, {
        where: { id: recordId }
      });
      
      return result;
    } catch (error) {
      // 更新为发放失败
      await this.models.LuckyBagRecord.update({
        redpacket_order_no: orderNo,
        redpacket_status: 3 // 发放失败
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

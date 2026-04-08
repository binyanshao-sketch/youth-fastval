/**
 * 消费券核销服务
 */

const { Op } = require('sequelize');

class CouponService {
  constructor(models) {
    this.models = models;
  }

  /**
   * 获取用户消费券列表
   */
  async getUserCoupons(userId, status = null) {
    const where = { user_id: userId };
    
    if (status) {
      where.status = status;
    }
    
    const coupons = await this.models.UserCoupon.findAll({
      where,
      include: [{
        model: this.models.Coupon,
        as: 'coupon'
      }],
      order: [['received_at', 'DESC']]
    });
    
    return coupons.map(uc => ({
      id: uc.id,
      code: uc.code,
      status: uc.status,
      usedAt: uc.used_at,
      coupon: {
        id: uc.coupon.id,
        name: uc.coupon.name,
        amount: uc.coupon.amount,
        minSpend: uc.coupon.min_spend,
        description: uc.coupon.description,
        validFrom: uc.coupon.valid_from,
        validTo: uc.coupon.valid_to
      }
    }));
  }

  /**
   * 商家核销消费券
   */
  async verifyCoupon(merchantId, code) {
    // 1. 查找消费券
    const userCoupon = await this.models.UserCoupon.findOne({
      where: { code },
      include: [{
        model: this.models.Coupon,
        as: 'coupon'
      }]
    });
    
    if (!userCoupon) {
      throw new Error('消费券不存在');
    }
    
    // 2. 检查状态
    if (userCoupon.status === 2) {
      throw new Error('该消费券已使用');
    }
    
    if (userCoupon.status === 3) {
      throw new Error('该消费券已过期');
    }
    
    // 3. 检查有效期
    const now = new Date();
    if (now < userCoupon.coupon.valid_from || now > userCoupon.coupon.valid_to) {
      // 更新为过期状态
      await userCoupon.update({ status: 3 });
      throw new Error('该消费券已过期');
    }
    
    // 4. 检查商家权限（如果是商家专属券）
    if (userCoupon.coupon.merchant_id && userCoupon.coupon.merchant_id !== merchantId) {
      throw new Error('该消费券无法在此商家使用');
    }
    
    // 5. 返回核销信息供确认
    return {
      couponId: userCoupon.id,
      code: userCoupon.code,
      amount: userCoupon.coupon.amount,
      minSpend: userCoupon.coupon.min_spend,
      name: userCoupon.coupon.name,
      userId: userCoupon.user_id
    };
  }

  /**
   * 确认核销
   */
  async confirmVerify(merchantId, code) {
    // 开启事务
    const transaction = await this.models.sequelize.transaction();
    
    try {
      // 1. 再次验证
      const verifyInfo = await this.verifyCoupon(merchantId, code);
      
      // 2. 更新消费券状态
      await this.models.UserCoupon.update({
        status: 2, // 已核销
        used_at: new Date(),
        merchant_id: merchantId
      }, {
        where: { code },
        transaction
      });
      
      // 3. 更新消费券核销数量
      const userCoupon = await this.models.UserCoupon.findOne({
        where: { code },
        transaction
      });
      
      await this.models.Coupon.increment('used_count', {
        where: { id: userCoupon.coupon_id },
        transaction
      });
      
      // 4. 记录核销日志
      await this.models.VerifyRecord.create({
        user_coupon_id: userCoupon.id,
        user_id: userCoupon.user_id,
        merchant_id: merchantId,
        coupon_amount: verifyInfo.amount,
        code: code,
        verified_at: new Date()
      }, { transaction });
      
      await transaction.commit();
      
      return {
        success: true,
        receiptNo: `VF${Date.now()}`,
        amount: verifyInfo.amount,
        code: code
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * 获取商家核销记录
   */
  async getMerchantVerifyRecords(merchantId, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    
    const { count, rows } = await this.models.VerifyRecord.findAndCountAll({
      where: { merchant_id: merchantId },
      order: [['verified_at', 'DESC']],
      offset,
      limit: pageSize
    });
    
    return {
      total: count,
      page,
      pageSize,
      records: rows
    };
  }

  /**
   * 获取商家核销统计
   */
  async getMerchantStatistics(merchantId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 今日核销
    const todayRecords = await this.models.VerifyRecord.count({
      where: {
        merchant_id: merchantId,
        verified_at: {
          [Op.gte]: today
        }
      }
    });
    
    const todayAmount = await this.models.VerifyRecord.sum('coupon_amount', {
      where: {
        merchant_id: merchantId,
        verified_at: {
          [Op.gte]: today
        }
      }
    }) || 0;
    
    // 总计
    const totalRecords = await this.models.VerifyRecord.count({
      where: { merchant_id: merchantId }
    });
    
    const totalAmount = await this.models.VerifyRecord.sum('coupon_amount', {
      where: { merchant_id: merchantId }
    }) || 0;
    
    return {
      today: {
        count: todayRecords,
        amount: todayAmount
      },
      total: {
        count: totalRecords,
        amount: totalAmount
      }
    };
  }
}

module.exports = CouponService;

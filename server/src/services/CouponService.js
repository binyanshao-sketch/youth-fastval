/**
 * 消费券核销服务
 * 使用行级锁(SELECT ... FOR UPDATE)保证并发核销安全
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

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
   * 确认核销（带行级锁防并发）
   */
  async confirmVerify(merchantId, code) {
    const transaction = await this.models.sequelize.transaction();

    try {
      // 1. 使用行级锁查找消费券（SELECT ... FOR UPDATE）
      const userCoupon = await this.models.UserCoupon.findOne({
        where: { code },
        include: [{
          model: this.models.Coupon,
          as: 'coupon'
        }],
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!userCoupon) {
        await transaction.rollback();
        throw new Error('消费券不存在');
      }

      // 2. 检查状态
      if (userCoupon.status === 2) {
        await transaction.rollback();
        throw new Error('该消费券已使用');
      }

      if (userCoupon.status === 3) {
        await transaction.rollback();
        throw new Error('该消费券已过期');
      }

      // 3. 检查有效期
      const now = new Date();
      const validFrom = new Date(userCoupon.coupon.valid_from);
      const validTo = new Date(userCoupon.coupon.valid_to);
      validTo.setHours(23, 59, 59, 999);

      if (now < validFrom || now > validTo) {
        await userCoupon.update({ status: 3 }, { transaction });
        await transaction.commit();
        throw new Error('该消费券已过期');
      }

      // 4. 检查商家权限（商家专属券）
      if (userCoupon.coupon.merchant_id && userCoupon.coupon.merchant_id !== merchantId) {
        await transaction.rollback();
        throw new Error('该消费券无法在此商家使用');
      }

      // 5. 更新消费券状态
      await this.models.UserCoupon.update({
        status: 2,
        used_at: now,
        merchant_id: merchantId
      }, {
        where: { id: userCoupon.id },
        transaction
      });

      // 6. 更新消费券核销数量
      await this.models.Coupon.increment('used_count', {
        where: { id: userCoupon.coupon_id },
        transaction
      });

      // 7. 生成唯一核销流水号
      const receiptNo = `VF${Date.now()}${crypto.randomBytes(3).toString('hex')}`;

      // 8. 记录核销日志
      await this.models.VerifyRecord.create({
        user_coupon_id: userCoupon.id,
        user_id: userCoupon.user_id,
        merchant_id: merchantId,
        coupon_amount: userCoupon.coupon.amount,
        code: code,
        verified_at: now
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        receiptNo,
        amount: userCoupon.coupon.amount,
        code: code
      };
    } catch (error) {
      if (transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
        await transaction.rollback();
      }
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

    // 使用并行查询提高性能
    const [todayCount, todayAmount, totalCount, totalAmount] = await Promise.all([
      this.models.VerifyRecord.count({
        where: {
          merchant_id: merchantId,
          verified_at: { [Op.gte]: today }
        }
      }),
      this.models.VerifyRecord.sum('coupon_amount', {
        where: {
          merchant_id: merchantId,
          verified_at: { [Op.gte]: today }
        }
      }),
      this.models.VerifyRecord.count({
        where: { merchant_id: merchantId }
      }),
      this.models.VerifyRecord.sum('coupon_amount', {
        where: { merchant_id: merchantId }
      })
    ]);

    return {
      today: {
        count: todayCount,
        amount: todayAmount || 0
      },
      total: {
        count: totalCount,
        amount: totalAmount || 0
      }
    };
  }
}

module.exports = CouponService;

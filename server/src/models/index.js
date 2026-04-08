/**
 * 数据库模型定义
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const models = {};

  models.sequelize = sequelize;
  
  // 用户表
  models.User = sequelize.define('User', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    openid: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true
    },
    unionid: {
      type: DataTypes.STRING(64)
    },
    phone: {
      type: DataTypes.STRING(11),
      allowNull: true,
      unique: true
    },
    nickname: {
      type: DataTypes.STRING(50)
    },
    avatar: {
      type: DataTypes.STRING(255)
    },
    gender: {
      type: DataTypes.TINYINT,
      defaultValue: 0
    },
    city: {
      type: DataTypes.STRING(50)
    },
    province: {
      type: DataTypes.STRING(50)
    },
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  
  // 红包金额池配置表
  models.RedPacketPool = sequelize.define('RedPacketPool', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    total_count: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    used_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    weight: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    blessing: {
      type: DataTypes.STRING(200)
    },
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    }
  }, {
    tableName: 'redpacket_pool',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  
  // 福袋领取记录表
  models.LuckyBagRecord = sequelize.define('LuckyBagRecord', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true
    },
    redpacket_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    redpacket_order_no: {
      type: DataTypes.STRING(64)
    },
    redpacket_status: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    },
    redpacket_sent_at: {
      type: DataTypes.DATE
    },
    policy_url: {
      type: DataTypes.STRING(255)
    },
    ip: {
      type: DataTypes.STRING(50)
    },
    user_agent: {
      type: DataTypes.STRING(500)
    }
  }, {
    tableName: 'lucky_bag_records',
    timestamps: true,
    createdAt: 'received_at',
    updatedAt: false
  });
  
  // 商家表
  models.Merchant = sequelize.define('Merchant', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 6)
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 6)
    },
    contact_name: {
      type: DataTypes.STRING(50)
    },
    contact_phone: {
      type: DataTypes.STRING(11),
      allowNull: false
    },
    license_no: {
      type: DataTypes.STRING(50)
    },
    license_image: {
      type: DataTypes.STRING(255)
    },
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    },
    verified_at: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'merchants',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  
  // 消费券配置表
  models.Coupon = sequelize.define('Coupon', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    merchant_id: {
      type: DataTypes.BIGINT.UNSIGNED
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    min_spend: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    total_count: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    used_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    valid_from: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    valid_to: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(500)
    },
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    }
  }, {
    tableName: 'coupons',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  
  // 用户消费券表
  models.UserCoupon = sequelize.define('UserCoupon', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    coupon_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    },
    used_at: {
      type: DataTypes.DATE
    },
    merchant_id: {
      type: DataTypes.BIGINT.UNSIGNED
    }
  }, {
    tableName: 'user_coupons',
    timestamps: true,
    createdAt: 'received_at',
    updatedAt: false
  });
  
  // 核销记录表
  models.VerifyRecord = sequelize.define('VerifyRecord', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    user_coupon_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    merchant_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    coupon_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false
    }
  }, {
    tableName: 'verify_records',
    timestamps: true,
    createdAt: 'verified_at',
    updatedAt: false
  });
  
  // 系统配置表
  models.SystemConfig = sequelize.define('SystemConfig', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    config_key: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    config_value: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(200)
    }
  }, {
    tableName: 'system_config',
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at'
  });
  
  // 管理员表
  models.Admin = sequelize.define('Admin', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(50)
    },
    phone: {
      type: DataTypes.STRING(11)
    },
    role: {
      type: DataTypes.STRING(20),
      defaultValue: 'admin'
    },
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    },
    last_login_at: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'admins',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  
  // ============================================
  // 关联关系
  // ============================================
  
  // 用户 - 福袋记录
  models.User.hasOne(models.LuckyBagRecord, { foreignKey: 'user_id', as: 'luckyBagRecord' });
  models.LuckyBagRecord.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  
  // 用户 - 消费券
  models.User.hasMany(models.UserCoupon, { foreignKey: 'user_id', as: 'coupons' });
  models.UserCoupon.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  
  // 消费券 - 用户消费券
  models.Coupon.hasMany(models.UserCoupon, { foreignKey: 'coupon_id', as: 'userCoupons' });
  models.UserCoupon.belongsTo(models.Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
  
  // 商家 - 消费券
  models.Merchant.hasMany(models.Coupon, { foreignKey: 'merchant_id', as: 'coupons' });
  models.Coupon.belongsTo(models.Merchant, { foreignKey: 'merchant_id', as: 'merchant' });
  
  // 商家 - 核销记录
  models.Merchant.hasMany(models.VerifyRecord, { foreignKey: 'merchant_id', as: 'verifyRecords' });
  models.VerifyRecord.belongsTo(models.Merchant, { foreignKey: 'merchant_id', as: 'merchant' });

  models.UserCoupon.hasMany(models.VerifyRecord, { foreignKey: 'user_coupon_id', as: 'verifyRecords' });
  models.VerifyRecord.belongsTo(models.UserCoupon, { foreignKey: 'user_coupon_id', as: 'userCoupon' });
  
  return models;
};

-- 共青团宜宾市委"五四"青春福袋数据库设计
-- 版本: V1.0
-- 日期: 2026-04-08

-- 创建数据库
CREATE DATABASE IF NOT EXISTS yibin_youth_festival DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE yibin_youth_festival;

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `openid` VARCHAR(64) NOT NULL COMMENT '微信openid',
  `unionid` VARCHAR(64) DEFAULT NULL COMMENT '微信unionid',
  `phone` VARCHAR(11) DEFAULT NULL COMMENT '手机号',
  `nickname` VARCHAR(50) DEFAULT NULL COMMENT '昵称',
  `avatar` VARCHAR(255) DEFAULT NULL COMMENT '头像URL',
  `gender` TINYINT DEFAULT 0 COMMENT '性别 0未知 1男 2女',
  `city` VARCHAR(50) DEFAULT NULL COMMENT '城市',
  `province` VARCHAR(50) DEFAULT NULL COMMENT '省份',
  `status` TINYINT DEFAULT 1 COMMENT '状态 1正常 2黑名单',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ============================================
-- 红包金额池配置表
-- ============================================
CREATE TABLE `redpacket_pool` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `amount` DECIMAL(10,2) NOT NULL COMMENT '红包金额',
  `total_count` INT NOT NULL COMMENT '总数量',
  `used_count` INT DEFAULT 0 COMMENT '已发放数量',
  `weight` INT DEFAULT 1 COMMENT '权重',
  `blessing` VARCHAR(200) DEFAULT NULL COMMENT '祝福语',
  `status` TINYINT DEFAULT 1 COMMENT '状态 1启用 2禁用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='红包金额池配置表';

-- 初始化红包数据
INSERT INTO `redpacket_pool` (`amount`, `total_count`, `weight`, `blessing`) VALUES
(5.40, 10000, 50, '共青团宜宾市委祝您五四青年节快乐'),
(6.66, 12000, 60, '共青团宜宾市委祝您前程似锦，一路六六六'),
(8.88, 5000, 25, '共青团宜宾市委祝您万事顺意、八方皆欢喜'),
(10.00, 2168, 10, '共青团宜宾市委祝您生活十全十美');

-- ============================================
-- 福袋领取记录表
-- ============================================
CREATE TABLE `lucky_bag_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `redpacket_amount` DECIMAL(10,2) NOT NULL COMMENT '红包金额',
  `redpacket_order_no` VARCHAR(64) DEFAULT NULL COMMENT '微信支付订单号',
  `redpacket_status` TINYINT DEFAULT 1 COMMENT '红包状态 1待发放 2已发放 3发放失败',
  `redpacket_sent_at` DATETIME DEFAULT NULL COMMENT '发放时间',
  `policy_url` VARCHAR(255) DEFAULT NULL COMMENT '政策链接',
  `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
  `ip` VARCHAR(50) DEFAULT NULL COMMENT '领取IP',
  `user_agent` VARCHAR(500) DEFAULT NULL COMMENT '用户代理',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  KEY `idx_redpacket_status` (`redpacket_status`),
  KEY `idx_received_at` (`received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='福袋领取记录表';

-- ============================================
-- 商家表
-- ============================================
CREATE TABLE `merchants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '商家名称',
  `category` VARCHAR(50) NOT NULL COMMENT '类别 餐饮/文旅/零售',
  `address` VARCHAR(255) NOT NULL COMMENT '地址',
  `longitude` DECIMAL(10,6) DEFAULT NULL COMMENT '经度',
  `latitude` DECIMAL(10,6) DEFAULT NULL COMMENT '纬度',
  `contact_name` VARCHAR(50) DEFAULT NULL COMMENT '联系人',
  `contact_phone` VARCHAR(11) NOT NULL COMMENT '联系电话',
  `license_no` VARCHAR(50) DEFAULT NULL COMMENT '营业执照号',
  `license_image` VARCHAR(255) DEFAULT NULL COMMENT '营业执照图片',
  `status` TINYINT DEFAULT 1 COMMENT '状态 1待审核 2正常 3禁用',
  `verified_at` DATETIME DEFAULT NULL COMMENT '审核时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_location` (`longitude`, `latitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商家表';

-- ============================================
-- 消费券配置表
-- ============================================
CREATE TABLE `coupons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '券名称',
  `merchant_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '商家ID NULL表示通用券',
  `amount` DECIMAL(10,2) NOT NULL COMMENT '面额',
  `min_spend` DECIMAL(10,2) DEFAULT 0 COMMENT '最低消费金额',
  `total_count` INT NOT NULL COMMENT '总数量',
  `used_count` INT DEFAULT 0 COMMENT '已核销数量',
  `valid_from` DATE NOT NULL COMMENT '有效期开始',
  `valid_to` DATE NOT NULL COMMENT '有效期结束',
  `description` VARCHAR(500) DEFAULT NULL COMMENT '使用说明',
  `status` TINYINT DEFAULT 1 COMMENT '状态 1启用 2禁用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_status` (`status`),
  KEY `idx_valid_date` (`valid_from`, `valid_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消费券配置表';

-- ============================================
-- 用户消费券表
-- ============================================
CREATE TABLE `user_coupons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `coupon_id` BIGINT UNSIGNED NOT NULL COMMENT '消费券ID',
  `code` VARCHAR(20) NOT NULL COMMENT '券码',
  `status` TINYINT DEFAULT 1 COMMENT '状态 1未使用 2已核销 3已过期',
  `used_at` DATETIME DEFAULT NULL COMMENT '核销时间',
  `merchant_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '核销商家ID',
  `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_coupon_id` (`coupon_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户消费券表';

-- ============================================
-- 核销记录表
-- ============================================
CREATE TABLE `verify_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_coupon_id` BIGINT UNSIGNED NOT NULL COMMENT '用户消费券ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `merchant_id` BIGINT UNSIGNED NOT NULL COMMENT '商家ID',
  `coupon_amount` DECIMAL(10,2) NOT NULL COMMENT '券面额',
  `code` VARCHAR(20) NOT NULL COMMENT '券码',
  `verified_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '核销时间',
  `operator` VARCHAR(50) DEFAULT NULL COMMENT '操作员',
  PRIMARY KEY (`id`),
  KEY `idx_user_coupon_id` (`user_coupon_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_verified_at` (`verified_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='核销记录表';

-- ============================================
-- 管理员表
-- ============================================
CREATE TABLE `admins` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL COMMENT '用户名',
  `password` VARCHAR(255) NOT NULL COMMENT '密码',
  `name` VARCHAR(50) DEFAULT NULL COMMENT '姓名',
  `phone` VARCHAR(11) DEFAULT NULL COMMENT '手机号',
  `role` VARCHAR(20) DEFAULT 'admin' COMMENT '角色 admin/operator finance',
  `status` TINYINT DEFAULT 1 COMMENT '状态 1正常 2禁用',
  `last_login_at` DATETIME DEFAULT NULL COMMENT '最后登录时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表';

-- 初始化管理员
INSERT INTO `admins` (`username`, `password`, `name`, `role`) VALUES
('admin', '$2a$10$u87x8pmGDAAR3lACxnOGI.CctNUJVQWXcVex0zOxVMf44T8vpMynS', '超级管理员', 'admin');

-- ============================================
-- 操作日志表
-- ============================================
CREATE TABLE `admin_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_id` BIGINT UNSIGNED NOT NULL COMMENT '管理员ID',
  `action` VARCHAR(50) NOT NULL COMMENT '操作类型',
  `target` VARCHAR(100) DEFAULT NULL COMMENT '操作对象',
  `detail` TEXT DEFAULT NULL COMMENT '操作详情',
  `ip` VARCHAR(50) DEFAULT NULL COMMENT 'IP地址',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- ============================================
-- 系统配置表
-- ============================================
CREATE TABLE `system_config` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `config_key` VARCHAR(50) NOT NULL COMMENT '配置键',
  `config_value` TEXT NOT NULL COMMENT '配置值',
  `description` VARCHAR(200) DEFAULT NULL COMMENT '配置说明',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 初始化配置
INSERT INTO `system_config` (`config_key`, `config_value`, `description`) VALUES
('activity_start_time', '2026-04-15 10:00:00', '活动开始时间'),
('activity_end_time', '2026-05-04 23:59:59', '活动结束时间'),
('coupon_expire_time', '2026-05-30 23:59:59', '消费券过期时间'),
('policy_url', 'https://example.com/policy', '政策链接'),
('daily_limit', '5000', '每日领取上限'),
('is_active', 'true', '活动是否开启');

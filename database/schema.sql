CREATE DATABASE IF NOT EXISTS yibin_youth_festival
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE yibin_youth_festival;

CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `openid` VARCHAR(64) NOT NULL,
  `unionid` VARCHAR(64) DEFAULT NULL,
  `phone` VARCHAR(11) DEFAULT NULL,
  `nickname` VARCHAR(50) DEFAULT NULL,
  `avatar` VARCHAR(255) DEFAULT NULL,
  `gender` TINYINT DEFAULT 0,
  `city` VARCHAR(50) DEFAULT NULL,
  `province` VARCHAR(50) DEFAULT NULL,
  `status` TINYINT DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_openid` (`openid`),
  UNIQUE KEY `uk_users_phone` (`phone`),
  KEY `idx_users_status` (`status`),
  KEY `idx_users_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `redpacket_pool` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `amount` DECIMAL(10, 2) NOT NULL,
  `total_count` INT NOT NULL,
  `used_count` INT DEFAULT 0,
  `weight` INT DEFAULT 1,
  `blessing` VARCHAR(200) DEFAULT NULL,
  `status` TINYINT DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_redpacket_pool_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `redpacket_pool` (`amount`, `total_count`, `weight`, `blessing`) VALUES
  (5.40, 10000, 50, '共青团宜宾市委祝你五四青年节快乐'),
  (6.66, 12000, 60, '共青团宜宾市委祝你前程似锦，一路六六六'),
  (8.88, 5000, 25, '共青团宜宾市委祝你万事顺意，八方皆欢喜'),
  (10.00, 2168, 10, '共青团宜宾市委祝你生活十全十美');

CREATE TABLE `lucky_bag_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `redpacket_amount` DECIMAL(10, 2) NOT NULL,
  `redpacket_blessing` VARCHAR(200) DEFAULT NULL,
  `redpacket_order_no` VARCHAR(64) DEFAULT NULL,
  `redpacket_status` TINYINT DEFAULT 1,
  `redpacket_sent_at` DATETIME DEFAULT NULL,
  `policy_url` VARCHAR(255) DEFAULT NULL,
  `selected_slot` TINYINT DEFAULT NULL,
  `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip` VARCHAR(50) DEFAULT NULL,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_lucky_bag_user_id` (`user_id`),
  KEY `idx_lucky_bag_status` (`redpacket_status`),
  KEY `idx_lucky_bag_received_at` (`received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `merchants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `address` VARCHAR(255) NOT NULL,
  `longitude` DECIMAL(10, 6) DEFAULT NULL,
  `latitude` DECIMAL(10, 6) DEFAULT NULL,
  `contact_name` VARCHAR(50) DEFAULT NULL,
  `contact_phone` VARCHAR(11) NOT NULL,
  `license_no` VARCHAR(50) DEFAULT NULL,
  `license_image` VARCHAR(255) DEFAULT NULL,
  `status` TINYINT DEFAULT 1,
  `verified_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_merchants_category` (`category`),
  KEY `idx_merchants_status` (`status`),
  KEY `idx_merchants_location` (`longitude`, `latitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `coupons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `merchant_id` BIGINT UNSIGNED DEFAULT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `min_spend` DECIMAL(10, 2) DEFAULT 0,
  `total_count` INT NOT NULL,
  `used_count` INT DEFAULT 0,
  `valid_from` DATE NOT NULL,
  `valid_to` DATE NOT NULL,
  `description` VARCHAR(500) DEFAULT NULL,
  `status` TINYINT DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_coupons_merchant_id` (`merchant_id`),
  KEY `idx_coupons_status` (`status`),
  KEY `idx_coupons_valid_date` (`valid_from`, `valid_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `user_coupons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `coupon_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `status` TINYINT DEFAULT 1,
  `used_at` DATETIME DEFAULT NULL,
  `merchant_id` BIGINT UNSIGNED DEFAULT NULL,
  `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_coupons_code` (`code`),
  KEY `idx_user_coupons_user_id` (`user_id`),
  KEY `idx_user_coupons_coupon_id` (`coupon_id`),
  KEY `idx_user_coupons_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `lottery_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `game_type` VARCHAR(20) NOT NULL,
  `board_key` VARCHAR(40) NOT NULL,
  `prize_name` VARCHAR(100) NOT NULL,
  `prize_level` VARCHAR(20) DEFAULT NULL,
  `prize_type` VARCHAR(30) DEFAULT NULL,
  `prize_value` VARCHAR(100) DEFAULT NULL,
  `poster_title` VARCHAR(100) DEFAULT NULL,
  `poster_message` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_lottery_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `verify_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_coupon_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `merchant_id` BIGINT UNSIGNED NOT NULL,
  `coupon_amount` DECIMAL(10, 2) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `verified_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `operator` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_verify_records_user_coupon_id` (`user_coupon_id`),
  KEY `idx_verify_records_merchant_id` (`merchant_id`),
  KEY `idx_verify_records_verified_at` (`verified_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `admins` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `name` VARCHAR(50) DEFAULT NULL,
  `phone` VARCHAR(11) DEFAULT NULL,
  `role` VARCHAR(20) DEFAULT 'admin',
  `status` TINYINT DEFAULT 1,
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admins_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `admin_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_id` BIGINT UNSIGNED NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `target` VARCHAR(100) DEFAULT NULL,
  `detail` TEXT DEFAULT NULL,
  `ip` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_logs_admin_id` (`admin_id`),
  KEY `idx_admin_logs_action` (`action`),
  KEY `idx_admin_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `system_config` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `config_key` VARCHAR(50) NOT NULL,
  `config_value` TEXT NOT NULL,
  `description` VARCHAR(200) DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_system_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `system_config` (`config_key`, `config_value`, `description`) VALUES
  ('activity_start_time', '2026-04-15 10:00:00', '活动开始时间'),
  ('activity_end_time', '2026-05-04 23:59:59', '活动结束时间'),
  ('coupon_expire_time', '2026-05-30 23:59:59', '消费券过期时间'),
  ('policy_url', 'https://example.com/policy', '政策链接'),
  ('daily_limit', '5000', '每日领取上限'),
  ('is_active', 'true', '活动是否开启');

-- ============================================
-- 外键约束（保证数据引用完整性）
-- ============================================

ALTER TABLE `lucky_bag_records`
  ADD CONSTRAINT `fk_lucky_bag_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `user_coupons`
  ADD CONSTRAINT `fk_user_coupons_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_user_coupons_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `coupons`
  ADD CONSTRAINT `fk_coupons_merchant` FOREIGN KEY (`merchant_id`) REFERENCES `merchants` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `lottery_records`
  ADD CONSTRAINT `fk_lottery_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `verify_records`
  ADD CONSTRAINT `fk_verify_user_coupon` FOREIGN KEY (`user_coupon_id`) REFERENCES `user_coupons` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_verify_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_verify_merchant` FOREIGN KEY (`merchant_id`) REFERENCES `merchants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `admin_logs`
  ADD CONSTRAINT `fk_admin_logs_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

module.exports.up = async (sequelize, transaction) => {
  await sequelize.query(`
    ALTER TABLE users
      ADD COLUMN email VARCHAR(255) DEFAULT NULL AFTER phone,
      ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL AFTER email,
      MODIFY COLUMN openid VARCHAR(64) NULL,
      ADD UNIQUE KEY uk_users_email (email)
  `, { transaction });

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS email_verify_codes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(6) NOT NULL,
      purpose VARCHAR(20) NOT NULL DEFAULT 'login',
      used TINYINT DEFAULT 0,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_email_code (email, code, purpose),
      KEY idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `, { transaction });
};

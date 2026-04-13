module.exports.up = async (sequelize, transaction) => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS redpacket_jobs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      lucky_bag_record_id BIGINT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      next_retry_at DATETIME NULL,
      last_error TEXT NULL,
      finished_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_lucky_bag_record_id (lucky_bag_record_id),
      INDEX idx_status_next_retry (status, next_retry_at)
    )
  `, { transaction });
};

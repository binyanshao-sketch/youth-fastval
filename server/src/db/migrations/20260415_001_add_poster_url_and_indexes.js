module.exports.up = async (sequelize, transaction) => {
  // Add poster_url to redpacket_pool
  await sequelize.query(`
    ALTER TABLE redpacket_pool
      ADD COLUMN IF NOT EXISTS poster_url VARCHAR(500) DEFAULT NULL AFTER blessing
  `, { transaction });

  // Add poster_url to lucky_bag_records
  await sequelize.query(`
    ALTER TABLE lucky_bag_records
      ADD COLUMN IF NOT EXISTS poster_url VARCHAR(255) DEFAULT NULL AFTER selected_slot
  `, { transaction });

  // Add poster_url to lottery_records
  await sequelize.query(`
    ALTER TABLE lottery_records
      ADD COLUMN IF NOT EXISTS poster_url VARCHAR(255) DEFAULT NULL AFTER poster_message
  `, { transaction });

  // Add missing index on verify_records.user_id
  const [verifyIndexes] = await sequelize.query(
    "SHOW INDEX FROM verify_records WHERE Key_name = 'idx_verify_records_user_id'",
    { transaction }
  );
  if (verifyIndexes.length === 0) {
    await sequelize.query(
      'ALTER TABLE verify_records ADD INDEX idx_verify_records_user_id (user_id)',
      { transaction }
    );
  }

  // Add missing index on lottery_records.created_at
  const [lotteryIndexes] = await sequelize.query(
    "SHOW INDEX FROM lottery_records WHERE Key_name = 'idx_lottery_records_created_at'",
    { transaction }
  );
  if (lotteryIndexes.length === 0) {
    await sequelize.query(
      'ALTER TABLE lottery_records ADD INDEX idx_lottery_records_created_at (created_at)',
      { transaction }
    );
  }
};

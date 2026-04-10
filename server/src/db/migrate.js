const fs = require('fs');
const path = require('path');

async function ensureMigrationsTable(sequelize) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getExecutedMigrations(sequelize) {
  const [rows] = await sequelize.query('SELECT name FROM schema_migrations ORDER BY id ASC');
  return new Set(rows.map((row) => row.name));
}

async function runMigrations(sequelize) {
  const dir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(dir)) {
    return [];
  }

  await ensureMigrationsTable(sequelize);
  const executed = await getExecutedMigrations(sequelize);
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.js')).sort();
  const applied = [];

  for (const file of files) {
    if (executed.has(file)) {
      continue;
    }

    const migration = require(path.join(dir, file));
    const transaction = await sequelize.transaction();
    try {
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${file} missing up()`);
      }

      await migration.up(sequelize, transaction);
      await sequelize.query('INSERT INTO schema_migrations (name) VALUES (?)', {
        replacements: [file],
        transaction
      });
      await transaction.commit();
      applied.push(file);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  return applied;
}

module.exports = { runMigrations };

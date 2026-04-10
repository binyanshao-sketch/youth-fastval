require('dotenv').config();
const { Sequelize } = require('sequelize');
const { runMigrations } = require('../src/db/migrate');

(async () => {
  const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      dialect: 'mysql',
      logging: false
    }
  );

  try {
    await sequelize.authenticate();
    const applied = await runMigrations(sequelize);
    console.log('applied migrations:', applied);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
})();

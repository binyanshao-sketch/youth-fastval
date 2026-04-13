require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const createModels = require('../src/models');

function getArg(index, fallback = '') {
  return String(process.argv[index] || fallback || '').trim();
}

async function main() {
  const username = getArg(2, process.env.ADMIN_USERNAME);
  const password = getArg(3, process.env.ADMIN_PASSWORD);
  const name = getArg(4, process.env.ADMIN_NAME || username);

  if (!username || !password) {
    throw new Error('Usage: npm run create:admin -- <username> <password> [name]');
  }

  if (password.length < 8) {
    throw new Error('Admin password must be at least 8 characters long');
  }

  const sequelize = new Sequelize(
    process.env.DB_NAME || 'yibin_youth_festival',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || '3306'),
      dialect: 'mysql',
      logging: false,
      timezone: '+08:00'
    }
  );

  const models = createModels(sequelize);

  try {
    await sequelize.authenticate();

    const hashedPassword = await bcrypt.hash(password, 10);
    const existing = await models.Admin.findOne({ where: { username } });

    if (!existing) {
      await models.Admin.create({
        username,
        password: hashedPassword,
        name,
        role: 'admin',
        status: 1
      });
      console.log(`Created admin: ${username}`);
      return;
    }

    await existing.update({
      password: hashedPassword,
      name,
      role: existing.role || 'admin',
      status: 1
    });
    console.log(`Updated admin: ${username}`);
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

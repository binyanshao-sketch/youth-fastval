process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.DB_DIALECT = process.env.DB_DIALECT || 'sqlite'
process.env.DB_STORAGE = process.env.DB_STORAGE || './dev-runtime.sqlite'
process.env.REDIS_MOCK = process.env.REDIS_MOCK || 'true'
process.env.WX_USE_MOCK = process.env.WX_USE_MOCK || 'true'
process.env.SKIP_REDPACKET_PAYMENT = process.env.SKIP_REDPACKET_PAYMENT || 'true'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_1234567890_local_for_test'

const { Op } = require('sequelize')
const bcrypt = require('bcryptjs')
const app = require('../src/app')

async function upsertAdmin(models, username, password, name) {
  const hashedPassword = await bcrypt.hash(password, 10)
  const existing = await models.Admin.findOne({ where: { username } })
  if (existing) {
    await existing.update({
      password: hashedPassword,
      name,
      role: 'admin',
      status: 1
    })
    return
  }

  await models.Admin.create({
    username,
    password: hashedPassword,
    name,
    role: 'admin',
    status: 1
  })
}

async function upsertUser(models, email, password, nickname) {
  const hashedPassword = await bcrypt.hash(password, 10)
  const existing = await models.User.findOne({ where: { email } })
  if (existing) {
    await existing.update({
      password_hash: hashedPassword,
      nickname,
      status: 1
    })
    return
  }

  await models.User.create({
    email,
    password_hash: hashedPassword,
    nickname,
    openid: `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 1
  })
}

async function seedLuckyBagRuntimeData(models) {
  const redPacketPoolCount = await models.RedPacketPool.count({ where: { status: 1 } })
  if (redPacketPoolCount === 0) {
    await models.RedPacketPool.bulkCreate([
      { amount: 1.88, total_count: 5000, used_count: 0, weight: 30, blessing: '青春有光', status: 1 },
      { amount: 5.20, total_count: 3000, used_count: 0, weight: 15, blessing: '好运常在', status: 1 },
      { amount: 8.88, total_count: 1000, used_count: 0, weight: 8, blessing: '前程似锦', status: 1 }
    ])
  }

  const now = new Date()
  const couponCount = await models.Coupon.count({
    where: {
      status: 1,
      valid_from: { [Op.lte]: now },
      valid_to: { [Op.gte]: now }
    }
  })
  if (couponCount === 0) {
    const validFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const validTo = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)
    await models.Coupon.bulkCreate([
      {
        name: '5元通用券',
        amount: 5,
        min_spend: 0,
        total_count: 20000,
        used_count: 0,
        valid_from: validFrom,
        valid_to: validTo,
        description: '本地流程联调默认券',
        status: 1
      },
      {
        name: '10元满50券',
        amount: 10,
        min_spend: 50,
        total_count: 20000,
        used_count: 0,
        valid_from: validFrom,
        valid_to: validTo,
        description: '本地流程联调默认券',
        status: 1
      },
      {
        name: '20元满100券',
        amount: 20,
        min_spend: 100,
        total_count: 20000,
        used_count: 0,
        valid_from: validFrom,
        valid_to: validTo,
        description: '本地流程联调默认券',
        status: 1
      }
    ])
  }
}

async function start() {
  if (app.locals.initializeForTests) {
    await app.locals.initializeForTests()
  }

  const { models } = app.locals
  await upsertAdmin(models, 'admin', 'StrongPass#2026', 'System Admin')
  await upsertAdmin(models, 'manager', 'Manager#2026', 'Manager Admin')
  await upsertUser(models, 'user_demo@youth.local', 'DemoPass#2026', 'Demo User')
  await seedLuckyBagRuntimeData(models)

  const port = Number(process.env.PORT || 3000)
  app.listen(port, () => {
    console.log(`DEV_RUNTIME_SERVER_READY:${port}`)
  })
}

start().catch((error) => {
  console.error('DEV_RUNTIME_SERVER_FAILED', error)
  process.exit(1)
})

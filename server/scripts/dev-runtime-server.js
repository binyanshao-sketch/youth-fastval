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

async function start() {
  if (app.locals.initializeForTests) {
    await app.locals.initializeForTests()
  }

  const { models } = app.locals
  await upsertAdmin(models, 'admin', 'StrongPass#2026', 'System Admin')
  await upsertAdmin(models, 'manager', 'Manager#2026', 'Manager Admin')
  await upsertUser(models, 'user_demo@youth.local', 'DemoPass#2026', 'Demo User')

  const port = Number(process.env.PORT || 3000)
  app.listen(port, () => {
    console.log(`DEV_RUNTIME_SERVER_READY:${port}`)
  })
}

start().catch((error) => {
  console.error('DEV_RUNTIME_SERVER_FAILED', error)
  process.exit(1)
})

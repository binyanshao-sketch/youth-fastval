process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'local_test_jwt_secret_1234567890';
process.env.WX_USE_MOCK = process.env.WX_USE_MOCK || 'true';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:5173';
process.env.DB_DIALECT = process.env.DB_DIALECT || 'sqlite';
process.env.DB_STORAGE = process.env.DB_STORAGE || ':memory:';
process.env.REDIS_MOCK = process.env.REDIS_MOCK || 'true';

const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');

describe('API smoke tests', () => {
  let token;
  let adminToken;
  let userId;

  beforeAll(async () => {
    if (typeof app.locals.initializeForTests === 'function') {
      await app.locals.initializeForTests();
    }
  });

  afterAll(async () => {
    await app.locals.models.sequelize.close();
    if (typeof app.locals.redis.quit === 'function') {
      await app.locals.redis.quit();
    } else if (typeof app.locals.redis.disconnect === 'function') {
      app.locals.redis.disconnect();
    }
  });

  test('GET /health returns ok', async () => {
    const response = await request(app).get('/health');

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('POST /api/user/login returns token', async () => {
    const response = await request(app)
      .post('/api/user/login')
      .send({ code: `jest-${Date.now()}` });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeTruthy();
    token = response.body.data.token;
  });

  test('GET /api/user/info returns current user', async () => {
    const response = await request(app)
      .get('/api/user/info')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.openid).toBeTruthy();
    userId = response.body.data.id;
  });

  test('GET /api/coupon/:id/qrcode returns data url', async () => {
    const models = app.locals.models;

    let coupon = await models.Coupon.findOne({ where: { status: 1 } });
    if (!coupon) {
      coupon = await models.Coupon.create({
        name: 'Jest test coupon',
        amount: 20,
        min_spend: 50,
        total_count: 100,
        valid_from: '2026-04-01',
        valid_to: '2026-05-31',
        status: 1
      });
    }

    let userCoupon = await models.UserCoupon.findOne({
      where: { user_id: userId, coupon_id: coupon.id, status: 1 }
    });

    if (!userCoupon) {
      userCoupon = await models.UserCoupon.create({
        user_id: userId,
        coupon_id: coupon.id,
        code: `JEST${Date.now()}`,
        status: 1
      });
    }

    const response = await request(app)
      .get(`/api/user/coupon/${userCoupon.id}/qrcode`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.qrcodeUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  test('POST /api/admin/login accepts configured admin', async () => {
    const models = app.locals.models;
    const username = 'jest_admin';
    const password = 'JestStrong#2026!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await models.Admin.findOne({ where: { username } });
    if (!admin) {
      await models.Admin.create({
        username,
        password: hashedPassword,
        name: 'Jest Admin',
        role: 'admin',
        status: 1
      });
    } else {
      await admin.update({
        password: hashedPassword,
        name: 'Jest Admin',
        role: 'admin',
        status: 1
      });
    }

    const response = await request(app)
      .post('/api/admin/login')
      .send({ username, password });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeTruthy();
    adminToken = response.body.data.token;
  });

  test('GET /api/admin/user/info returns current admin', async () => {
    const response = await request(app)
      .get('/api/admin/user/info')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.username).toBe('jest_admin');
  });

  test('GET /api/admin/settings returns system config', async () => {
    const response = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.activity_start_time).toBeTruthy();
  });
});

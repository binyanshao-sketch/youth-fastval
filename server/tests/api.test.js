const request = require('supertest');
const app = require('../src/app');

describe('API smoke tests', () => {
  let token;
  let adminToken;
  let userId;

  afterAll(async () => {
    await app.locals.models.sequelize.close();
    app.locals.redis.disconnect();
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
        name: 'Jest测试券',
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

  test('POST /api/admin/login accepts seeded admin', async () => {
    const response = await request(app)
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'admin123456' });

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
    expect(response.body.data.username).toBe('admin');
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
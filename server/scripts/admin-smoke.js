/* eslint-disable no-console */

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const smokeMode = process.env.SMOKE_MODE || 'readonly';
const smokeAdminUsername = process.env.SMOKE_ADMIN_USERNAME || 'admin';
const smokeAdminPassword = process.env.SMOKE_ADMIN_PASSWORD || 'admin123456';

function normalizeSettingsPayload(payload) {
  const result = {};
  Object.keys(payload || {}).forEach((key) => {
    const value = payload[key];
    result[key] = value == null ? '' : String(value);
  });
  return result;
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

function ensureSuccess(result, label) {
  if (!result.ok || !result.data?.success) {
    throw new Error(`${label} 失败: ${JSON.stringify(result.data)}`);
  }
}

async function run() {
  const cleanupTasks = [];
  let headers = null;
  let settingsSnapshot = null;

  try {
  const adminLogin = await request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username: smokeAdminUsername, password: smokeAdminPassword })
  });
  ensureSuccess(adminLogin, '管理员登录');
  const adminToken = adminLogin.data.data.token;

  headers = { Authorization: `Bearer ${adminToken}` };

  const dashboard = await request('/api/admin/dashboard', { headers });
  ensureSuccess(dashboard, '仪表盘');

  const users = await request('/api/admin/users?page=1&pageSize=10', { headers });
  ensureSuccess(users, '用户列表');
  const merchants = await request('/api/admin/merchants?page=1&pageSize=10', { headers });
  ensureSuccess(merchants, '商家列表');
  const coupons = await request('/api/admin/coupons?page=1&pageSize=10', { headers });
  ensureSuccess(coupons, '消费券列表');

  const settings = await request('/api/admin/settings', { headers });
  ensureSuccess(settings, '查询系统设置');
  settingsSnapshot = normalizeSettingsPayload(settings.data.data);

  const finance = await request('/api/admin/finance/records?page=1&pageSize=10', { headers });
  ensureSuccess(finance, '财务记录');

  const statistics = await request('/api/admin/statistics', { headers });
  ensureSuccess(statistics, '统计报表');
  const userAnalysis = await request('/api/admin/statistics/users', { headers });
  ensureSuccess(userAnalysis, '用户分析');
  const merchantAnalysis = await request('/api/admin/statistics/merchants', { headers });
  ensureSuccess(merchantAnalysis, '商家分析');

  if (smokeMode === 'full') {
    const merchantName = `联调商家-${Date.now()}`;
    const createMerchant = await request('/api/admin/merchants', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: merchantName,
        phone: '13900000009',
        category: '餐饮',
        address: '联调测试地址',
        contactName: '联调测试'
      })
    });
    ensureSuccess(createMerchant, '创建商家');

    const merchantId = createMerchant.data.data.id;
    cleanupTasks.push(async () => {
      // 回退为待审核状态，避免影响正式统计
      await request(`/api/admin/merchants/${merchantId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 1, name: `${merchantName}-SMOKE` })
      });
    });

    const verifyMerchant = await request(`/api/admin/merchants/${merchantId}/verify`, {
      method: 'POST',
      headers
    });
    ensureSuccess(verifyMerchant, '审核商家');

    const createCoupon = await request('/api/admin/coupons', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `联调券-${Date.now()}`,
        amount: 18.8,
        minSpend: 50,
        totalCount: 200,
        validFrom: '2026-04-01',
        validTo: '2026-05-31',
        description: '联调测试券',
        merchantId
      })
    });
    ensureSuccess(createCoupon, '创建消费券');

    const couponId = createCoupon.data.data.id;
    cleanupTasks.push(async () => {
      // 使用既有停用接口做清理，避免继续参与发放
      await request(`/api/admin/coupons/${couponId}`, {
        method: 'DELETE',
        headers
      });
    });

    const updateSettings = await request('/api/admin/settings', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...settingsSnapshot,
        daily_limit: String(Number(settingsSnapshot.daily_limit || '5000') + 1)
      })
    });
    ensureSuccess(updateSettings, '更新系统设置');

    cleanupTasks.push(async () => {
      await request('/api/admin/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify(settingsSnapshot)
      });
    });
  }

  console.log(`admin smoke success (${smokeMode})`);
  } finally {
    if (smokeMode === 'full' && cleanupTasks.length > 0 && headers) {
      for (let i = cleanupTasks.length - 1; i >= 0; i -= 1) {
        try {
          await cleanupTasks[i]();
        } catch (error) {
          console.error(`cleanup warning: ${error.message}`);
        }
      }
    }
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

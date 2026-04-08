/**
 * 主程序入口
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const { Sequelize } = require('sequelize');

// 路由
const userRoutes = require('./routes/user');
const merchantRoutes = require('./routes/merchant');
const adminRoutes = require('./routes/admin');

// 中间件
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

function getEnv(name, fallback = '') {
  return process.env[name] || fallback;
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function validateProductionEnv() {
  if (!isProduction) {
    return;
  }

  const required = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'REDIS_HOST',
    'REDIS_PORT',
    'JWT_SECRET',
    'CORS_ORIGINS'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`缺少生产环境变量: ${missing.join(', ')}`);
  }

  if (String(process.env.JWT_SECRET).length < 24) {
    throw new Error('JWT_SECRET 长度必须至少 24 位');
  }
}

validateProductionEnv();

const corsOrigins = parseCsv(process.env.CORS_ORIGINS);
const allowAllOrigins = corsOrigins.includes('*');

// ============================================
// 基础配置
// ============================================
app.set('trust proxy', true);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (!isProduction && corsOrigins.length === 0) {
      return callback(null, true);
    }

    if (allowAllOrigins || corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin not allowed'));
  },
  credentials: !allowAllOrigins
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// 数据库连接
// ============================================
const sequelize = new Sequelize(
  getEnv('DB_NAME', 'yibin_youth_festival'),
  getEnv('DB_USER', 'root'),
  getEnv('DB_PASSWORD', ''),
  {
    host: getEnv('DB_HOST', 'localhost'),
    port: Number(getEnv('DB_PORT', '3306')),
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    },
    timezone: '+08:00'
  }
);

// 加载模型
const models = require('./models')(sequelize);
app.locals.models = models;

app.use((req, res, next) => {
  req.models = app.locals.models;
  req.redis = app.locals.redis;
  next();
});

// ============================================
// Redis 连接
// ============================================
const redis = new Redis({
  host: getEnv('REDIS_HOST', 'localhost'),
  port: Number(getEnv('REDIS_PORT', '6379')),
  password: getEnv('REDIS_PASSWORD', ''),
  db: Number(getEnv('REDIS_DB', '0'))
});

redis.on('connect', () => console.log('✅ Redis连接成功'));
redis.on('error', err => console.error('❌ Redis错误:', err));
app.locals.redis = redis;

// ============================================
// JWT 配置
// ============================================
app.locals.jwt = {
  sign: (payload, expiresIn = '7d') => jwt.sign(payload, process.env.JWT_SECRET || 'yibin-youth-2026', { expiresIn }),
  verify: (token) => jwt.verify(token, process.env.JWT_SECRET || 'yibin-youth-2026')
};

// ============================================
// 请求日志
// ============================================
app.use(requestLogger);

// ============================================
// API 路由
// ============================================
app.use('/api/user', userRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 就绪检查（用于容器探针）
app.get('/ready', async (req, res) => {
  const checks = await Promise.allSettled([
    sequelize.authenticate(),
    redis.ping()
  ]);

  const dbReady = checks[0].status === 'fulfilled';
  const redisReady = checks[1].status === 'fulfilled';
  const ready = dbReady && redisReady;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: {
      db: dbReady ? 'ok' : 'failed',
      redis: redisReady ? 'ok' : 'failed'
    },
    timestamp: new Date().toISOString()
  });
});

// 活动状态检查
app.get('/api/status', async (req, res) => {
  try {
    const isActive = await models.SystemConfig.findOne({
      where: { config_key: 'is_active' }
    });
    
    const startTime = await models.SystemConfig.findOne({
      where: { config_key: 'activity_start_time' }
    });
    
    const endTime = await models.SystemConfig.findOne({
      where: { config_key: 'activity_end_time' }
    });
    
    res.json({
      success: true,
      data: {
        isActive: isActive?.config_value === 'true',
        startTime: startTime?.config_value,
        endTime: endTime?.config_value
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取状态失败' });
  }
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

// 错误处理
app.use(errorHandler);

// ============================================
// 启动服务器
// ============================================
const PORT = process.env.PORT || 3000;
let server;

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      await redis.ping();
      console.log('✅ 数据库连接成功');
      console.log('✅ Redis连接成功');

      server = app.listen(PORT, () => {
        console.log(`🚀 服务器运行在端口 ${PORT}`);
        console.log(`📝 环境: ${process.env.NODE_ENV || 'development'}`);
        console.log(`⏰ 启动时间: ${new Date().toISOString()}`);
      });
    } catch (err) {
      console.error('❌ 服务启动失败:', err);
      process.exit(1);
    }
  })();
}

// 优雅关闭
let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`收到 ${signal} 信号，正在关闭...`);

  try {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    await sequelize.close();
    redis.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('关闭服务时发生错误:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;

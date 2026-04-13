require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const IORedis = require('ioredis');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Sequelize } = require('sequelize');

const logger = require('./utils/logger');
const { runMigrations } = require('./db/migrate');
const { startRedpacketRetryWorker } = require('./jobs/redpacketRetryWorker');
const userRoutes = require('./routes/user');
const merchantRoutes = require('./routes/merchant');
const adminRoutes = require('./routes/admin');
const auditLogger = require('./middleware/auditLogger');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const requestContext = require('./middleware/requestContext');
const { YIBIN_BOUNDS } = require('./middleware/geofence');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function getEnv(name, fallback = '') {
  return process.env[name] || fallback;
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateProductionEnv() {
  if (!isProduction) {
    return;
  }

  if (process.env.WX_USE_MOCK === 'true') {
    throw new Error('WX_USE_MOCK must be false in production');
  }

  const required = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
    'JWT_SECRET',
    'CORS_ORIGINS',
    'TENCENT_SECRET_ID',
    'TENCENT_SECRET_KEY',
    'TENCENT_SMS_APP_ID',
    'TENCENT_SMS_TEMPLATE_ID',
    'TENCENT_SMS_SIGN'
  ];

  if (process.env.WX_USE_MOCK !== 'true') {
    required.push(
      'WX_APPID',
      'WX_SECRET',
      'WX_PAY_MCHID',
      'WX_PAY_KEY',
      'WX_PAY_CERT_PATH',
      'WX_PAY_KEY_PATH',
      'WX_PAY_SPBILL_IP'
    );
  }

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing production env vars: ${missing.join(', ')}`);
  }

  if (String(process.env.JWT_SECRET).length < 24) {
    throw new Error('JWT_SECRET must be at least 24 chars');
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }
  if (isTest) {
    return 'test_jwt_secret_1234567890_for_local';
  }
  throw new Error('JWT_SECRET environment variable is required');
}

validateProductionEnv();

const jwtSecret = getJwtSecret();
const corsOrigins = parseCsv(process.env.CORS_ORIGINS);
const allowAllOrigins = corsOrigins.includes('*');

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (!isProduction && (corsOrigins.length === 0 || origin === 'null')) {
      return callback(null, true);
    }
    if (allowAllOrigins || corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: !allowAllOrigins
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

const dbDialect = getEnv('DB_DIALECT', isTest ? 'sqlite' : 'mysql');
const sequelize = dbDialect === 'sqlite'
  ? new Sequelize({
    dialect: 'sqlite',
    storage: getEnv('DB_STORAGE', ':memory:'),
    logging: false
  })
  : new Sequelize(
    getEnv('DB_NAME', 'yibin_youth_festival'),
    getEnv('DB_USER', 'root'),
    getEnv('DB_PASSWORD', ''),
    {
      host: getEnv('DB_HOST', 'localhost'),
      port: Number(getEnv('DB_PORT', '3306')),
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
      pool: {
        max: 20,
        min: 5,
        acquire: 30000,
        idle: 10000
      },
      timezone: '+08:00',
      retry: {
        max: 3
      }
    }
  );

const models = require('./models')(sequelize);
app.locals.models = models;

const useRedisMock = getEnv('REDIS_MOCK', isTest ? 'true' : 'false') === 'true';
const RedisClient = useRedisMock ? require('ioredis-mock') : IORedis;
const redis = useRedisMock
  ? new RedisClient()
  : new RedisClient({
    host: getEnv('REDIS_HOST', 'localhost'),
    port: Number(getEnv('REDIS_PORT', '6379')),
    password: getEnv('REDIS_PASSWORD', '') || undefined,
    db: Number(getEnv('REDIS_DB', '0')),
    retryStrategy(times) {
      return Math.min(times * 200, 5000);
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false
  });

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
app.locals.redis = redis;

app.locals.jwt = {
  sign: (payload, expiresIn = '7d') => jwt.sign(payload, jwtSecret, { algorithm: 'HS256', expiresIn }),
  verify: (token) => jwt.verify(token, jwtSecret, { algorithms: ['HS256'] })
};

app.use((req, res, next) => {
  req.models = app.locals.models;
  req.redis = app.locals.redis;
  next();
});
app.use(auditLogger);

const defaultTestSystemConfigs = [
  ['is_active', 'true'],
  ['activity_start_time', '2026-01-01 00:00:00'],
  ['activity_end_time', '2026-12-31 23:59:59'],
  ['coupon_expire_time', '2026-12-31 23:59:59'],
  ['policy_url', 'https://example.com/policy'],
  ['daily_limit', '5000'],
  ['lottery_mode', 'wheel']
];
let testInitialized = false;
app.locals.initializeForTests = async () => {
  if (!isTest || testInitialized) {
    return;
  }

  await sequelize.sync({ force: true });
  for (const [configKey, configValue] of defaultTestSystemConfigs) {
    await models.SystemConfig.upsert({
      config_key: configKey,
      config_value: configValue
    });
  }

  testInitialized = true;
};

app.use(requestContext);
app.use(requestLogger);

app.use('/api/user', userRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/admin', adminRoutes);
app.use('/h5', express.static(path.resolve(__dirname, '..', '..', 'client-h5'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

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
        endTime: endTime?.config_value,
        geofence: YIBIN_BOUNDS
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get status' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API not found' });
});
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
let server;
let stopRetryWorker = null;

if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      const appliedMigrations = await runMigrations(sequelize);
      if (appliedMigrations.length > 0) {
        logger.info('Migrations applied', { appliedMigrations });
      }

      await redis.ping();
      stopRetryWorker = startRedpacketRetryWorker(app);

      server = app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`, {
          env: process.env.NODE_ENV || 'development',
          startTime: new Date().toISOString()
        });
      });
    } catch (err) {
      logger.error('Server startup failed', { error: err.message, stack: err.stack });
      process.exit(1);
    }
  })();
}

let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, shutting down...`);

  try {
    if (stopRetryWorker) {
      stopRetryWorker();
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await sequelize.close();
    if (typeof redis.quit === 'function') {
      await redis.quit();
    } else {
      redis.disconnect();
    }
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown failed', { error: error.message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;

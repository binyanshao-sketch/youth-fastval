/**
 * 请求日志中间件
 */
const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    if (!req.originalUrl.includes('/health') && !req.originalUrl.includes('/ready') && !req.originalUrl.includes('.')) {
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        ip: req.ip,
        role: req.role || '-',
        userId: req.userId || '-',
        merchantId: req.merchantId || '-',
        adminId: req.adminId || '-'
      });
    }
  });

  next();
};

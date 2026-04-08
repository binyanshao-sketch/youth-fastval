/**
 * 请求日志中间件
 */

const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  const start = Date.now();

  // 响应完成后记录日志
  res.on('finish', () => {
    const duration = Date.now() - start;

    // 只记录非健康检查和非静态资源
    if (!req.originalUrl.includes('/health') && !req.originalUrl.includes('/ready') && !req.originalUrl.includes('.')) {
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        ip: req.ip,
        userId: req.userId || '-'
      });
    }
  });

  next();
};

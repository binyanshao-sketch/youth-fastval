/**
 * 请求日志中间件
 */

const moment = require('moment');

module.exports = (req, res, next) => {
  const start = Date.now();
  
  // 响应完成后记录日志
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      time: moment().format('YYYY-MM-DD HH:mm:ss'),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.userId || '-'
    };
    
    // 只记录非健康检查和非静态资源
    if (!req.originalUrl.includes('/health') && !req.originalUrl.includes('.')) {
      console.log(`[${log.time}] ${log.method} ${log.url} ${log.status} ${log.duration} IP:${log.ip} User:${log.userId}`);
    }
  });
  
  next();
};

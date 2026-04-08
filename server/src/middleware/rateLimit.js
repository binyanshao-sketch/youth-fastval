/**
 * 请求限流中间件
 */

const rateLimit = require('express-rate-limit');

module.exports = (options = {}) => {
  const {
    windowMs = 60000, // 时间窗口（毫秒）
    max = 100, // 最大请求数
    message = '请求过于频繁，请稍后再试'
  } = options;
  
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message
    },
    standardHeaders: true,
    legacyHeaders: false,
    // 使用IP作为限流key
    keyGenerator: (req) => {
      return req.ip || req.connection.remoteAddress;
    }
  });
};

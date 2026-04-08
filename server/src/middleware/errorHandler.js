/**
 * 错误处理中间件
 */

const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logger.error('请求错误', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Sequelize验证错误
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: err.errors[0].message
    });
  }

  // Sequelize唯一约束错误
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      message: '数据已存在'
    });
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '无效的token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'token已过期'
    });
  }

  // CORS 错误
  if (err.message === 'CORS origin not allowed') {
    return res.status(403).json({
      success: false,
      message: '不允许的来源'
    });
  }

  // 默认错误（生产环境不暴露内部错误信息）
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    success: false,
    message: isProduction ? '服务器内部错误' : (err.message || '服务器内部错误')
  });
};

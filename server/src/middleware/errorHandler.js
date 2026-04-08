/**
 * 错误处理中间件
 */

module.exports = (err, req, res, next) => {
  console.error('错误:', err);
  
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
  
  // 默认错误
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误'
  });
};

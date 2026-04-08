/**
 * JWT认证中间件
 */

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '请先登录'
    });
  }
  
  try {
    const decoded = req.app.locals.jwt.verify(token);
    req.auth = decoded;
    req.userId = decoded.userId || null;
    req.merchantId = decoded.merchantId || null;
    req.adminId = decoded.adminId || null;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '登录已过期，请重新登录'
    });
  }
};

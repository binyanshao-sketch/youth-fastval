/**
 * JWT认证与角色鉴权中间件
 */

/**
 * 基础认证：校验 JWT token 并提取 payload
 */
function authenticate(req, res, next) {
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
}

/**
 * 角色鉴权工厂函数
 * @param {'user'|'merchant'|'admin'} role - 要求的角色类型
 * @returns Express 中间件数组 [authenticate, requireRole]
 */
function requireRole(role) {
  return [
    authenticate,
    (req, res, next) => {
      switch (role) {
        case 'user':
          if (!req.userId) {
            return res.status(403).json({ success: false, message: '无权限访问' });
          }
          break;
        case 'merchant':
          if (!req.merchantId || req.auth.type !== 'merchant') {
            return res.status(403).json({ success: false, message: '无权限访问' });
          }
          break;
        case 'admin':
          if (!req.adminId || req.auth.type !== 'admin') {
            return res.status(403).json({ success: false, message: '无权限访问' });
          }
          break;
        default:
          return res.status(403).json({ success: false, message: '无权限访问' });
      }
      next();
    }
  ];
}

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.requireRole = requireRole;

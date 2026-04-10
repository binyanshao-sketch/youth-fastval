/**
 * JWT 认证与基于角色的访问控制中间件
 */

const ROLE_CONFIG = {
  user: {
    idKey: 'userId',
    modelName: 'User',
    isAllowedStatus(status) {
      return status !== 2;
    },
    blockedMessage: '账号已被禁用'
  },
  merchant: {
    idKey: 'merchantId',
    modelName: 'Merchant',
    isAllowedStatus(status) {
      return status === 2;
    },
    blockedMessage: '商家账号已被禁用'
  },
  admin: {
    idKey: 'adminId',
    modelName: 'Admin',
    isAllowedStatus(status) {
      return status === 1;
    },
    blockedMessage: '管理员账号已被禁用'
  }
};

function getBearerToken(req) {
  const authorization = String(req.headers.authorization || '').trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function getRequestRole(payload) {
  const role = payload?.role || payload?.type || '';
  return typeof role === 'string' ? role.trim() : '';
}

function normalizeRoles(roles) {
  const list = Array.isArray(roles) ? roles : [roles];
  return Array.from(new Set(list.filter(Boolean)));
}

function denyUnauthorized(res) {
  return res.status(401).json({
    success: false,
    message: '请先登录'
  });
}

function denyForbidden(res, message = '无权限访问') {
  return res.status(403).json({
    success: false,
    message
  });
}

async function ensureRoleEntity(req, res, role) {
  const config = ROLE_CONFIG[role];
  if (!config) {
    return denyForbidden(res);
  }

  const subjectId = req[config.idKey];
  if (!subjectId) {
    return denyForbidden(res);
  }

  const Model = req.models?.[config.modelName];
  if (!Model) {
    return res.status(500).json({
      success: false,
      message: '鉴权失败'
    });
  }

  try {
    const record = await Model.findByPk(subjectId, {
      attributes: ['status']
    });

    if (!record) {
      return denyForbidden(res);
    }

    if (!config.isAllowedStatus(record.status)) {
      return denyForbidden(res, config.blockedMessage);
    }

    return null;
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '鉴权失败'
    });
  }
}

function authenticate(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return denyUnauthorized(res);
  }

  try {
    const decoded = req.app.locals.jwt.verify(token);
    const role = getRequestRole(decoded);

    req.auth = decoded;
    req.role = role || null;
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

function requireRole(roles) {
  const allowedRoles = normalizeRoles(roles);

  return [
    authenticate,
    async (req, res, next) => {
      if (!req.role || !allowedRoles.includes(req.role)) {
        return denyForbidden(res);
      }

      const result = await ensureRoleEntity(req, res, req.role);
      if (result) {
        return result;
      }

      next();
    }
  ];
}

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.requireRole = requireRole;


function normalizePermissionList(roleValue) {
  if (Array.isArray(roleValue)) {
    return roleValue.filter(Boolean);
  }

  const value = String(roleValue || '').trim();
  if (!value) {
    return [];
  }

  if (value === 'super_admin') {
    return ['*'];
  }

  const preset = {
    admin: ['dashboard:read', 'users:read', 'users:write', 'merchants:read', 'merchants:write', 'coupons:read', 'coupons:write', 'finance:read', 'statistics:read', 'settings:read', 'settings:write'],
    ops: ['dashboard:read', 'users:read', 'merchants:read', 'coupons:read', 'coupons:write', 'statistics:read', 'settings:read'],
    finance: ['dashboard:read', 'finance:read', 'statistics:read'],
    auditor: ['dashboard:read', 'users:read', 'merchants:read', 'coupons:read', 'finance:read', 'statistics:read', 'settings:read']
  };

  return preset[value] || [];
}

function requireAdminPermission(permission) {
  return [
    requireRole('admin'),
    async (req, res, next) => {
      try {
        const Admin = req.models?.Admin;
        if (!Admin || !req.adminId) {
          return res.status(500).json({ success: false, message: '鉴权失败' });
        }

        const admin = await Admin.findByPk(req.adminId, { attributes: ['id', 'role', 'status'] });
        if (!admin || admin.status !== 1) {
          return res.status(403).json({ success: false, message: '管理员账号已被禁用' });
        }

        const permissions = normalizePermissionList(admin.role);
        req.adminRole = admin.role;
        req.adminPermissions = permissions;

        if (permissions.includes('*') || permissions.includes(permission)) {
          return next();
        }

        return res.status(403).json({ success: false, message: '无权限访问该功能' });
      } catch (error) {
        return res.status(500).json({ success: false, message: '鉴权失败' });
      }
    }
  ];
}

module.exports.requireAdminPermission = requireAdminPermission;

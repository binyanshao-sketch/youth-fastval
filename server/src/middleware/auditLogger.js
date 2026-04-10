const AdminLogService = require('../services/AdminLogService');
const logger = require('../utils/logger');

const AUDIT_METHODS = new Set(['POST', 'PUT', 'DELETE']);
const SENSITIVE_KEYS = new Set(['password', 'token', 'authorization', 'encryptedData', 'iv']);

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value).reduce((result, [key, item]) => {
    result[key] = SENSITIVE_KEYS.has(key) ? '[REDACTED]' : sanitizeValue(item);
    return result;
  }, {});
}

function buildAction(req) {
  if (req.auditAction) {
    return req.auditAction;
  }

  const routePath = req.route?.path || req.path || req.originalUrl.split('?')[0];
  return `${req.method} ${req.baseUrl || ''}${routePath}`;
}

function buildTarget(req) {
  if (req.auditTarget !== undefined) {
    return req.auditTarget;
  }

  if (!req.params?.id) {
    return null;
  }

  const segments = String(req.baseUrl || '')
    .split('/')
    .filter(Boolean);
  const resource = segments[segments.length - 1] || 'resource';
  return `${resource}:${req.params.id}`;
}

function buildDetail(req, res, duration) {
  if (req.auditDetail !== undefined) {
    return req.auditDetail;
  }

  return {
    path: req.originalUrl,
    statusCode: res.statusCode,
    durationMs: duration,
    params: sanitizeValue(req.params || {}),
    query: sanitizeValue(req.query || {}),
    body: sanitizeValue(req.body || {})
  };
}

module.exports = (req, res, next) => {
  const start = Date.now();

  res.on('finish', async () => {
    if (!AUDIT_METHODS.has(req.method)) {
      return;
    }

    if (!String(req.originalUrl || '').startsWith('/api/admin')) {
      return;
    }

    if (!req.adminId || req.auditDisabled) {
      return;
    }

    try {
      const logService = new AdminLogService(req.models);
      await logService.log(
        req.adminId,
        buildAction(req),
        buildTarget(req),
        buildDetail(req, res, Date.now() - start),
        req.ip
      );
    } catch (error) {
      logger.error('admin audit log failed', { error: error.message, url: req.originalUrl });
    }
  });

  next();
};

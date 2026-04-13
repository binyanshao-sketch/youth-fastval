const crypto = require('crypto');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = (req, res, next) => {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  const requestId = (incoming && UUID_RE.test(incoming)) ? incoming : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};

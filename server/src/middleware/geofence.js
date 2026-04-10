/**
 * 电子围栏中间件
 * 基于经纬度验证用户是否在宜宾市范围内
 *
 * 宜宾市边界范围（近似矩形）：
 *   纬度：27.6° ~ 29.2°
 *   经度：103.5° ~ 105.6°
 * 中心点约 (28.77, 104.63)，覆盖整个宜宾市行政区域
 */

const YIBIN_BOUNDS = {
  minLat: 27.6,
  maxLat: 29.2,
  minLng: 103.5,
  maxLng: 105.6
};

function isInsideYibin(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  return (
    lat >= YIBIN_BOUNDS.minLat &&
    lat <= YIBIN_BOUNDS.maxLat &&
    lng >= YIBIN_BOUNDS.minLng &&
    lng <= YIBIN_BOUNDS.maxLng
  );
}

function requireGeofence() {
  return (req, res, next) => {
    const latitude = req.body.latitude ?? req.query.latitude;
    const longitude = req.body.longitude ?? req.query.longitude;

    if (latitude == null || longitude == null) {
      return res.status(400).json({
        success: false,
        message: '请允许获取位置信息后再试',
        code: 'LOCATION_REQUIRED'
      });
    }

    if (!isInsideYibin(latitude, longitude)) {
      return res.status(403).json({
        success: false,
        message: '本活动仅限宜宾市范围内参与',
        code: 'OUT_OF_GEOFENCE'
      });
    }

    next();
  };
}

module.exports = { requireGeofence, isInsideYibin, YIBIN_BOUNDS };

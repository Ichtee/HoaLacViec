/**
 * Authoritative Geolocation & Distance Calculation Helpers
 * Used across the backend for validation, Haversine distance, and attendance verification.
 */

export const REASON_CODES = {
  VERIFIED: 'VERIFIED',
  GPS_UNAVAILABLE: 'GPS_UNAVAILABLE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  LOW_ACCURACY: 'LOW_ACCURACY',
  JOB_LOCATION_UNCONFIRMED: 'JOB_LOCATION_UNCONFIRMED',
  OUTSIDE_RADIUS: 'OUTSIDE_RADIUS',
  STALE_POSITION: 'STALE_POSITION',
  ACCURACY_MARGIN: 'ACCURACY_MARGIN',
  INVALID_COORDINATES: 'INVALID_COORDINATES',
  MANUAL_REQUEST: 'MANUAL_REQUEST',
};

/**
 * Validates latitude and longitude strictly.
 * - Must be finite numbers
 * - Lat in [-90, 90], Lng in [-180, 180]
 * - Allows 0, 0 (Null Island) as mathematically valid coordinates (though rare)
 */
export function isValidCoordinate(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return false;
  }
  if (typeof lat === 'boolean' || typeof lng === 'boolean') {
    return false;
  }
  if (typeof lat === 'object' || typeof lng === 'object') {
    return false;
  }
  if (typeof lat === 'string' && lat.trim() === '') {
    return false;
  }
  if (typeof lng === 'string' && lng.trim() === '') {
    return false;
  }

  const nLat = typeof lat === 'number' ? lat : Number(lat);
  const nLng = typeof lng === 'number' ? lng : Number(lng);

  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
    return false;
  }

  return nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180;
}

/**
 * Check if an entity (job/employer/task) has verified coordinates
 */
export function hasConfirmedCoordinates(entity) {
  if (!entity || typeof entity !== 'object') return false;
  const lat = entity.location?.lat ?? entity.lat;
  const lng = entity.location?.lng ?? entity.lng;
  return (
    entity.locationStatus === 'confirmed' &&
    isValidCoordinate(lat, lng)
  );
}

/**
 * Canonical helper for Google Maps navigation/search destination.
 * Priority:
 * 1. If locationStatus === 'confirmed' and coordinates are valid: return `${lat},${lng}`
 * 2. If stored Google placeId: return placeId
 * 3. If unconfirmed coordinates: return formattedAddress for search only (never exact navigation)
 * 4. Never fall back to fake "Hòa Lạc" or artificially concatenated storeName
 */
export function getGoogleMapsDestination(entity) {
  if (!entity || typeof entity !== 'object') return null;

  const lat = entity.location?.lat ?? entity.lat;
  const lng = entity.location?.lng ?? entity.lng;

  const confirmed =
    entity.locationStatus === 'confirmed' &&
    isValidCoordinate(lat, lng);

  // 1. Confirmed coordinates priority: return `${lat},${lng}`
  if (confirmed) {
    return `${Number(lat)},${Number(lng)}`;
  }

  // 2. Google placeId if saved
  const placeId = entity.googlePlaceId || entity.placeId;
  if (placeId && typeof placeId === 'string' && placeId.trim()) {
    return placeId.trim();
  }

  // 3. Unconfirmed: only return formatted address for search
  // Never fallback to fake "Hòa Lạc" or storeName
  const rawAddress = typeof entity.address === 'string' ? entity.address.trim() : '';
  if (rawAddress) {
    return rawAddress;
  }

  return null;
}

/**
 * Canonical helper for Google Maps directions URL based strictly on job.address string.
 * - Does not use location.lat/lng or geoPoint
 * - Does not check locationStatus
 * - Does not fallback to storeName, "Hòa Lạc", or employer.address
 * - Does not use Google Place ID
 * - If job.address is empty/whitespace, returns null
 */
export function getGoogleMapsDirectionsUrl(entity) {
  const address =
    typeof entity?.address === 'string'
      ? entity.address.trim()
      : '';

  if (!address) return null;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/**
 * Helper for Google Maps search URL based strictly on entity.address string.
 */
export function getGoogleMapsSearchUrl(entity) {
  const address =
    typeof entity?.address === 'string'
      ? entity.address.trim()
      : '';

  if (!address) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/**
 * Returns Google Maps directions URL for confirmed locations,
 * or Google Maps search URL for unconfirmed addresses.
 */
export function getGoogleMapsNavigationUrl(entity) {
  if (!entity || typeof entity !== 'object') return null;
  const confirmed = hasConfirmedCoordinates(entity);
  const dest = getGoogleMapsDestination(entity);
  if (!dest) return null;

  if (confirmed) {
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  }

  const placeId = entity.googlePlaceId || entity.placeId;
  if (placeId && typeof placeId === 'string' && placeId.trim()) {
    return `https://www.google.com/maps/dir/?api=1&destination_place_id=${encodeURIComponent(placeId.trim())}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`;
}

/**
 * Computes geodesic distance in meters between two coordinates using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number|null} Distance in meters rounded to 1 decimal place, or null if coordinates are invalid.
 */
export function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return null;
  }

  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const phi1 = nLat1 * rad;
  const phi2 = nLat2 * rad;
  const deltaPhi = (nLat2 - nLat1) * rad;
  const deltaLambda = (nLon2 - nLon1) * rad;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10;
}

/**
 * Clamps radius within a secure range (default: 50m to 500m)
 */
export function clampRadius(radius, min = 50, max = 500, fallback = 150) {
  const n = Number(radius);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, min), max);
}

/**
 * Evaluates attendance GPS submission against job target location.
 *
 * @param {Object} params
 * @param {number} [params.lat] - Device latitude
 * @param {number} [params.lng] - Device longitude
 * @param {number} [params.accuracy] - Device accuracy in meters
 * @param {string|number|Date} [params.timestamp] - Device timestamp
 * @param {Object} [params.jobLocation] - Job coordinates { lat, lng }
 * @param {string} [params.jobLocationStatus] - 'confirmed' | 'unconfirmed' | 'legacy_unverified'
 * @param {number} [params.checkinRadius] - Employer configured radius (meters)
 * @param {boolean} [params.isManual] - Whether this is a manual submission request
 * @param {string} [params.manualReason] - User explanation for manual request
 * @returns {Object} Evaluation result { verified, status, reasonCode, distanceMeters, configuredRadius, targetCoords, message }
 */
export function evaluateAttendanceGPS({
  lat,
  lng,
  accuracy,
  timestamp,
  jobLocation,
  jobLocationStatus,
  checkinRadius = 150,
  isManual = false,
  manualReason = '',
}) {
  const radius = clampRadius(checkinRadius, 50, 500, 150);

  // If student opted for manual check-in with explanation
  if (isManual) {
    return {
      verified: false,
      status: 'needs_review',
      reasonCode: REASON_CODES.MANUAL_REQUEST,
      distanceMeters: null,
      configuredRadius: radius,
      targetCoords: isValidCoordinate(jobLocation?.lat, jobLocation?.lng)
        ? { lat: Number(jobLocation.lat), lng: Number(jobLocation.lng) }
        : null,
      message: `Yêu cầu chấm công thủ công: "${manualReason || 'Không có lý do'}" (Chờ quản lý xét duyệt).`,
    };
  }

  // 1. Check if user provided coordinates
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return {
      verified: false,
      status: 'needs_review',
      reasonCode: REASON_CODES.GPS_UNAVAILABLE,
      distanceMeters: null,
      configuredRadius: radius,
      targetCoords: null,
      message: 'Không nhận được tọa độ GPS từ thiết bị (Chờ quản lý xét duyệt).',
    };
  }

  // 2. Validate coordinates format and range
  if (!isValidCoordinate(lat, lng)) {
    return {
      verified: false,
      status: 'rejected',
      reasonCode: REASON_CODES.INVALID_COORDINATES,
      distanceMeters: null,
      configuredRadius: radius,
      targetCoords: null,
      message: 'Tọa độ GPS không hợp lệ.',
    };
  }

  // 3. Validate accuracy
  const nAccuracy = Number(accuracy);
  if (!Number.isFinite(nAccuracy) || nAccuracy <= 0) {
    return {
      verified: false,
      status: 'needs_review',
      reasonCode: REASON_CODES.LOW_ACCURACY,
      distanceMeters: null,
      configuredRadius: radius,
      targetCoords: null,
      message: 'Độ chính xác GPS không hợp lệ (Chờ quản lý xét duyệt).',
    };
  }

  // 4. Validate timestamp freshness (max 2 minutes old)
  if (timestamp) {
    const timeMs = new Date(timestamp).getTime();
    const now = Date.now();
    const ageSeconds = Math.abs(now - timeMs) / 1000;
    if (Number.isFinite(ageSeconds) && ageSeconds > 120) {
      return {
        verified: false,
        status: 'needs_review',
        reasonCode: REASON_CODES.STALE_POSITION,
        distanceMeters: null,
        configuredRadius: radius,
        targetCoords: null,
        message: 'Tọa độ GPS đã cũ (> 2 phút), vui lòng lấy lại vị trí hiện tại.',
      };
    }
  }

  // 5. Target job location must exist and be confirmed
  if (!jobLocation || !isValidCoordinate(jobLocation.lat, jobLocation.lng) || jobLocationStatus !== 'confirmed') {
    return {
      verified: false,
      status: 'needs_review',
      reasonCode: REASON_CODES.JOB_LOCATION_UNCONFIRMED,
      distanceMeters: null,
      configuredRadius: radius,
      targetCoords: null,
      message: 'Địa điểm làm việc chưa được nhà tuyển dụng xác nhận vị trí bản đồ (Chờ quản lý xét duyệt thủ công).',
    };
  }

  const targetCoords = { lat: Number(jobLocation.lat), lng: Number(jobLocation.lng) };
  const distanceMeters = calculateHaversineDistanceMeters(lat, lng, targetCoords.lat, targetCoords.lng);

  if (distanceMeters === null) {
    return {
      verified: false,
      status: 'needs_review',
      reasonCode: REASON_CODES.INVALID_COORDINATES,
      distanceMeters: null,
      configuredRadius: radius,
      targetCoords,
      message: 'Không thể tính toán khoảng cách GPS.',
    };
  }

  // Accuracy threshold for auto-verification: max 100m
  const MAX_ALLOWED_ACCURACY = 100;
  if (nAccuracy > MAX_ALLOWED_ACCURACY) {
    return {
      verified: false,
      status: 'needs_review',
      reasonCode: REASON_CODES.LOW_ACCURACY,
      distanceMeters,
      configuredRadius: radius,
      targetCoords,
      message: `Độ sai số GPS của thiết bị quá lớn (±${Math.round(nAccuracy)}m > ngưỡng ${MAX_ALLOWED_ACCURACY}m). Chuyển sang chờ quản lý duyệt.`,
    };
  }

  // Check if within radius
  if (distanceMeters <= radius) {
    return {
      verified: true,
      status: 'verified',
      reasonCode: REASON_CODES.VERIFIED,
      distanceMeters,
      configuredRadius: radius,
      targetCoords,
      message: `Xác minh tự động theo tọa độ thiết bị thành công! Khoảng cách tới quán: ${Math.round(distanceMeters)}m (Bán kính cho phép: ${radius}m, sai số ±${Math.round(nAccuracy)}m).`,
    };
  }

  // Check if close to boundary within accuracy margin
  if (distanceMeters - nAccuracy <= radius) {
    return {
      verified: false,
      status: 'needs_review',
      reasonCode: REASON_CODES.ACCURACY_MARGIN,
      distanceMeters,
      configuredRadius: radius,
      targetCoords,
      message: `Khoảng cách ${Math.round(distanceMeters)}m nằm sát ranh giới bán kính ${radius}m (sai số ±${Math.round(nAccuracy)}m). Cần quản lý xác nhận.`,
    };
  }

  // Definitely outside radius
  return {
    verified: false,
    status: 'needs_review',
    reasonCode: REASON_CODES.OUTSIDE_RADIUS,
    distanceMeters,
    configuredRadius: radius,
    targetCoords,
    message: `Vị trí thiết bị cách quán ${Math.round(distanceMeters)}m (vượt quá bán kính cho phép ${radius}m). Ca làm cần quản lý duyệt công.`,
  };
}

/**
 * Evaluates whether current time is within the allowed check-in window.
 * Window: [-30 min, +60 min] relative to shift startTime in Asia/Ho_Chi_Minh (+07:00).
 */
export function evaluateCheckinWindow(shiftDate, startTime, checkinTime = new Date()) {
  const [sh, sm] = (startTime || '00:00').split(':').map(Number);
  const shiftStartDateTime = new Date(`${shiftDate}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00+07:00`);
  const now = new Date(checkinTime);

  if (isNaN(shiftStartDateTime.getTime()) || isNaN(now.getTime())) {
    return {
      allowed: false,
      code: 'INVALID_DATETIME',
      error: 'Thời gian ca làm không hợp lệ.',
    };
  }

  const diffMinutes = (now.getTime() - shiftStartDateTime.getTime()) / (1000 * 60);

  if (diffMinutes < -30) {
    return {
      allowed: false,
      code: 'CHECKIN_TOO_EARLY',
      diffMinutes,
      error: 'Chưa đến giờ check-in. Bạn chỉ có thể check-in trước giờ bắt đầu tối đa 30 phút.',
    };
  }

  if (diffMinutes > 60) {
    return {
      allowed: false,
      code: 'CHECKIN_WINDOW_EXPIRED',
      diffMinutes,
      error: 'Đã quá thời gian cho phép tự điểm danh vào ca (> 60 phút). Vui lòng liên hệ nhà tuyển dụng để được hỗ trợ.',
    };
  }

  return { allowed: true, diffMinutes };
}

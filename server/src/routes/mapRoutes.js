import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  vietmapAutocomplete,
  vietmapSearch,
  vietmapPlace,
  vietmapReverse,
  vietmapRoute,
} from '../services/vietmapService.js';
import { isValidCoordinate } from '../utils/coordinateHelper.js';
import { authenticate, requireActiveUser } from '../middlewares/auth.js';

const router = express.Router();

// Dedicated rate limiter for map search endpoints to protect Vietmap quota
// Applied before auth so even unauthenticated burst is throttled
const mapSearchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 120, // 120 requests per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Quá nhiều yêu cầu tìm kiếm bản đồ. Vui lòng thử lại sau vài phút.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// Apply rate limiter to all map endpoints
router.use(mapSearchLimiter);

// Convenience auth guard: authenticate then require active account
const authGuard = [authenticate, requireActiveUser];

/**
 * GET /api/maps/autocomplete
 * Query params: text, focusLat, focusLng
 * Auth: required (active user only — protects Vietmap quota from public abuse)
 */
router.get('/autocomplete', authGuard, async (req, res, next) => {
  try {
    const { text, focusLat, focusLng } = req.query;

    // Validate text (min 2 chars)
    if (!text || typeof text !== 'string' || text.trim().length < 2) {
      return res.json({
        success: true,
        items: [],
        message: 'Vui lòng nhập ít nhất 2 ký tự để gợi ý địa chỉ',
      });
    }

    // Validate focusLat/focusLng — must be provided together or not at all
    let focus;
    if (focusLat !== undefined || focusLng !== undefined) {
      if (focusLat === undefined || focusLng === undefined) {
        return res.status(400).json({
          success: false,
          error: 'focusLat và focusLng phải cùng tồn tại hoặc cùng vắng.',
          code: 'INVALID_FOCUS',
        });
      }
      if (!isValidCoordinate(focusLat, focusLng)) {
        return res.status(400).json({
          success: false,
          error: 'focusLat phải trong [-90,90], focusLng phải trong [-180,180].',
          code: 'INVALID_FOCUS',
        });
      }
      focus = `${focusLat},${focusLng}`;
    }

    const result = await vietmapAutocomplete({
      text: text.trim().slice(0, 500),
      focus,
    });

    if (!result.success) {
      const statusCode =
        result.code === 'VIETMAP_UNAUTHORIZED' ? 401
        : result.code === 'VIETMAP_QUOTA_EXCEEDED' ? 429
        : result.code === 'VIETMAP_RATE_LIMITED' ? 429
        : 503;
      return res.status(statusCode).json(result);
    }

    // Normalize to spec response shape
    const items = (result.suggestions || []).map((s) => ({
      refId: s.refId,
      name: s.name || '',
      display: s.display || '',
      distanceKm: typeof s.distance === 'number' ? s.distance : null,
      boundaries: s.boundaries || [],
      legacyAddress: s.address || '',
      currentAddress: s.dataNew?.display || s.address || '',
    }));

    return res.json({ success: true, items });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/maps/search
 * Query params: text (full address), focusLat, focusLng
 * Auth: required (active user only)
 */
router.get('/search', authGuard, async (req, res, next) => {
  try {
    const { text, focusLat, focusLng } = req.query;

    if (!text || typeof text !== 'string' || text.trim().length < 2) {
      return res.json({
        success: true,
        items: [],
        message: 'Vui lòng nhập ít nhất 2 ký tự để tìm kiếm địa chỉ',
      });
    }

    let focus;
    if (focusLat !== undefined || focusLng !== undefined) {
      if (focusLat === undefined || focusLng === undefined) {
        return res.status(400).json({
          success: false,
          error: 'focusLat và focusLng phải cùng tồn tại hoặc cùng vắng.',
          code: 'INVALID_FOCUS',
        });
      }
      if (!isValidCoordinate(focusLat, focusLng)) {
        return res.status(400).json({
          success: false,
          error: 'focusLat phải trong [-90,90], focusLng phải trong [-180,180].',
          code: 'INVALID_FOCUS',
        });
      }
      focus = `${focusLat},${focusLng}`;
    }

    const result = await vietmapSearch({
      text: text.trim().slice(0, 500),
      focus,
    });

    if (!result.success) {
      const statusCode =
        result.code === 'VIETMAP_UNAUTHORIZED' ? 401
        : result.code === 'VIETMAP_QUOTA_EXCEEDED' ? 429
        : 503;
      return res.status(statusCode).json(result);
    }

    const items = (result.results || []).map((s) => ({
      refId: s.refId,
      name: s.name || '',
      display: s.display || '',
      distanceKm: typeof s.distance === 'number' ? s.distance : null,
      boundaries: s.boundaries || [],
      legacyAddress: s.address || '',
      currentAddress: s.dataNew?.display || s.address || '',
    }));

    return res.json({ success: true, items });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/maps/place
 * Query params: refId (opaque token — DO NOT use as path param)
 * Auth: required (active user only)
 */
router.get('/place', authGuard, async (req, res, next) => {
  try {
    const refId = req.query.refid || req.query.refId;

    if (!refId || typeof refId !== 'string' || !refId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Tham số refid là bắt buộc',
        code: 'INVALID_REFID',
      });
    }

    const result = await vietmapPlace({ refId: refId.trim() });

    if (!result.success) {
      const statusCode =
        result.code === 'VIETMAP_UNAUTHORIZED' ? 401
        : result.code === 'VIETMAP_NO_RESULTS' ? 404
        : result.code === 'VIETMAP_QUOTA_EXCEEDED' ? 429
        : 503;
      return res.status(statusCode).json(result);
    }

    const place = result.place;
    // Spec-compliant Place response
    return res.json({
      success: true,
      provider: 'vietmap',
      display: place.formattedAddress || place.displayName || '',
      addressLine: place.addressComponents?.addressLine || '',
      lat: place.lat,
      lng: place.lng,
      addressComponents: {
        wardCode: place.addressComponents?.wardCode || null,
        wardName: place.addressComponents?.wardName || '',
        districtCode: place.addressComponents?.districtCode || null,
        districtName: place.addressComponents?.districtName || '',
        provinceCode: place.addressComponents?.provinceCode || null,
        provinceName: place.addressComponents?.provinceName || '',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/maps/reverse
 * Query params: lat, lng
 * Auth: required (active user only)
 */
router.get('/reverse', authGuard, async (req, res, next) => {
  try {
    const { lat, lng } = req.query;

    if (!isValidCoordinate(lat, lng)) {
      return res.status(400).json({
        success: false,
        error: 'Tọa độ không hợp lệ (vĩ độ [-90, 90], kinh độ [-180, 180])',
        code: 'INVALID_COORDINATES',
      });
    }

    const result = await vietmapReverse({
      lat: Number(lat),
      lng: Number(lng),
    });

    if (!result.success) {
      const statusCode =
        result.code === 'VIETMAP_UNAUTHORIZED' ? 401
        : result.code === 'VIETMAP_NO_RESULTS' ? 404
        : result.code === 'VIETMAP_QUOTA_EXCEEDED' ? 429
        : 503;
      return res.status(statusCode).json(result);
    }

    const place = result.place;
    // Spec-compliant Reverse response (same shape as Place, plus refId if available)
    return res.json({
      success: true,
      provider: 'vietmap',
      refId: place.refId || null,
      display: place.formattedAddress || place.displayName || '',
      addressLine: place.addressComponents?.addressLine || '',
      lat: place.lat,
      lng: place.lng,
      addressComponents: {
        wardCode: place.addressComponents?.wardCode || null,
        wardName: place.addressComponents?.wardName || '',
        districtCode: place.addressComponents?.districtCode || null,
        districtName: place.addressComponents?.districtName || '',
        provinceCode: place.addressComponents?.provinceCode || null,
        provinceName: place.addressComponents?.provinceName || '',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/maps/route
 * Body: { points: [{ lat, lng }, ...], vehicle: 'motorcycle'|'car' }
 * Auth: required (active user only)
 * Vehicle allowlist: only 'car' and 'motorcycle' in this phase
 */
router.post('/route', authGuard, async (req, res, next) => {
  try {
    const {
      points,
      origin,
      destination,
      vehicle = 'motorcycle',
    } = req.body;

    // Vehicle allowlist per spec
    const ALLOWED_VEHICLES = ['car', 'motorcycle'];
    const validVehicle = ALLOWED_VEHICLES.includes(vehicle) ? vehicle : null;
    if (!validVehicle) {
      return res.status(400).json({
        success: false,
        error: `vehicle phải là 'car' hoặc 'motorcycle'. Nhận được: ${vehicle}`,
        code: 'INVALID_VEHICLE',
      });
    }

    // Build point list
    let routePoints = [];
    if (Array.isArray(points) && points.length >= 2) {
      routePoints = points;
    } else if (origin && destination) {
      routePoints = [origin, destination];
    } else {
      return res.status(400).json({
        success: false,
        error: 'Cần cung cấp ít nhất 2 điểm qua tham số points hoặc origin+destination',
        code: 'INVALID_POINTS',
      });
    }

    // Validate minimum 2 points
    if (routePoints.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Cần ít nhất 2 điểm để tính tuyến đường',
        code: 'INVALID_POINTS',
      });
    }

    // Validate each point has valid lat/lng
    for (let i = 0; i < routePoints.length; i++) {
      const p = routePoints[i];
      if (!isValidCoordinate(p?.lat, p?.lng)) {
        return res.status(400).json({
          success: false,
          error: `Điểm ${i + 1} có tọa độ không hợp lệ: lat phải [-90,90], lng phải [-180,180]`,
          code: 'INVALID_COORDINATES',
        });
      }
    }

    // Route v4: points_encoded=false, no toll/congestion for micro-task phase
    const result = await vietmapRoute({
      points: routePoints,
      vehicle: validVehicle,
      // No annotations (toll/congestion not needed in this phase)
    });

    if (!result.success) {
      const statusCode =
        result.code === 'VIETMAP_UNAUTHORIZED' ? 401
        : result.code === 'VIETMAP_NO_RESULTS' ? 404
        : result.code === 'VIETMAP_QUOTA_EXCEEDED' ? 429
        : result.code === 'VIETMAP_TIMEOUT' ? 504
        : 503;
      return res.status(statusCode).json(result);
    }

    const route = result.route;
    const distanceMeters = route.distance || 0;
    const durationMilliseconds = route.timeMs || 0;
    // Spec-compliant Route response with convenience distanceKm / durationMinutes
    return res.json({
      success: true,
      provider: 'vietmap',
      distanceMeters,
      durationMilliseconds,
      distanceKm: route.distanceKm || Number((distanceMeters / 1000).toFixed(2)),
      durationMinutes: route.durationMinutes || Math.round(durationMilliseconds / 60000),
      bbox: route.bbox || null,
      // coordinates in GeoJSON [lng, lat] per spec
      coordinates: route.geoJsonCoordinates || [],
      instructions: (route.instructions || []).map((ins) => ({
        text: ins.text || '',
        sign: ins.sign || 0,
        distanceMeters: ins.distance || 0,
        durationMs: ins.time || 0,
        streetName: ins.street_name || '',
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

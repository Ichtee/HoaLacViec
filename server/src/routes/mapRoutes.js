import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  vietmapAutocomplete,
  vietmapSearch,
  vietmapPlace,
  vietmapReverse,
  vietmapReverseBatch,
  vietmapRoute,
  vietmapRouteTolls,
  vietmapMatchTolls,
} from '../services/vietmapService.js';
import { isValidCoordinate } from '../utils/coordinateHelper.js';

const router = express.Router();

// Dedicated rate limiter for map search endpoints to protect Vietmap quota
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

router.use(mapSearchLimiter);

/**
 * GET /api/maps/autocomplete
 * Query params: text, focus (lat,lng)
 */
router.get('/autocomplete', async (req, res, next) => {
  try {
    const { text, focus } = req.query;

    if (!text || typeof text !== 'string' || text.trim().length < 2) {
      return res.json({
        success: true,
        suggestions: [],
        message: 'Vui lòng nhập ít nhất 2 ký tự để gợi ý địa chỉ',
      });
    }

    const result = await vietmapAutocomplete({
      text: text.trim(),
      focus: typeof focus === 'string' ? focus.trim() : undefined,
    });

    if (!result.success) {
      const statusCode = result.code === 'UNAUTHORIZED' ? 401 : result.code === 'RESOURCE_LOCKED' ? 423 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/maps/search
 * Query params: text (full address), focus (lat,lng)
 */
router.get('/search', async (req, res, next) => {
  try {
    const { text, focus } = req.query;

    if (!text || typeof text !== 'string' || text.trim().length < 2) {
      return res.json({
        success: true,
        results: [],
        message: 'Vui lòng nhập ít nhất 2 ký tự để tìm kiếm địa chỉ',
      });
    }

    const result = await vietmapSearch({
      text: text.trim(),
      focus: typeof focus === 'string' ? focus.trim() : undefined,
    });

    if (!result.success) {
      const statusCode = result.code === 'UNAUTHORIZED' ? 401 : result.code === 'RESOURCE_LOCKED' ? 423 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/maps/place
 * Query params: refid
 */
router.get('/place', async (req, res, next) => {
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
      const statusCode = result.code === 'UNAUTHORIZED' ? 401 : result.code === 'ZERO_RESULTS' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/maps/reverse
 * Query params: lat, lng
 */
router.get('/reverse', async (req, res, next) => {
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
      const statusCode = result.code === 'UNAUTHORIZED' ? 401 : result.code === 'ZERO_RESULTS' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/maps/reverse-batch
 * Body: { points: [{lat, lng}, ...] | [[lng, lat], ...] }
 */
router.post('/reverse-batch', async (req, res, next) => {
  try {
    const { points } = req.body;

    if (!Array.isArray(points) || points.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cần danh sách points để tra cứu địa chỉ hàng loạt',
        code: 'INVALID_POINTS',
      });
    }

    const result = await vietmapReverseBatch(points);

    if (!result.success) {
      const statusCode = result.code === 'UNAUTHORIZED' ? 401 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/maps/route
 * Body: { origin, destination, points, vehicle, capacity, avoid, annotations }
 */
router.post('/route', async (req, res, next) => {
  try {
    const {
      origin,
      destination,
      points,
      vehicle = 'motorcycle',
      capacity,
      avoid,
      annotations,
    } = req.body;

    let routePoints = [];

    if (Array.isArray(points) && points.length >= 2) {
      routePoints = points;
    } else if (origin && destination) {
      routePoints = [origin, destination];
    } else {
      return res.status(400).json({
        success: false,
        error: 'Cần cung cấp điểm đón (origin) và điểm đến (destination) hoặc mảng points',
        code: 'INVALID_POINTS',
      });
    }

    const result = await vietmapRoute({
      points: routePoints,
      vehicle: typeof vehicle === 'string' ? vehicle : 'motorcycle',
      capacity,
      avoid,
      annotations,
    });

    if (!result.success) {
      const statusCode = result.code === 'UNAUTHORIZED' ? 401 : result.code === 'ZERO_RESULTS' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/maps/route-tolls
 * Body: { points: [[lng, lat], [lng, lat]], vehicle: 1..5 }
 */
router.post('/route-tolls', async (req, res, next) => {
  try {
    const { points, vehicle = 1 } = req.body;

    if (!Array.isArray(points) || points.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Cần mảng points với ít nhất 2 điểm dạng [[lng, lat], [lng, lat]]',
        code: 'INVALID_POINTS',
      });
    }

    const result = await vietmapRouteTolls({ points, vehicle });

    if (!result.success) {
      const statusCode = result.code === 'UNAUTHORIZED' ? 401 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/maps/match-tolls
 * Body: { points: [[lng, lat], ...], vehicle: 1..5 }
 */
router.post('/match-tolls', async (req, res, next) => {
  try {
    const { points, path, vehicle = 1 } = req.body;
    const trail = Array.isArray(points) ? points : path;

    if (!Array.isArray(trail) || trail.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Cần mảng GPS trail với ít nhất 2 điểm dạng [[lng, lat], ...]',
        code: 'INVALID_POINTS',
      });
    }

    const result = await vietmapMatchTolls({ points: trail, vehicle });

    if (!result.success) {
      const statusCode = result.code === 'UNAUTHORIZED' ? 401 : 400;
      return res.status(statusCode).json(result);
    }

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

/**
 * Vietmap v4 Services Integration
 * Compliant with official Vietmap Maps API v4 specifications:
 * - Autocomplete v4 (display_type=5, min 2 chars, focus bias)
 * - Place v4 (refid lookup for exact coordinates & address components)
 * - Reverse v4 (lat, lng lookup with display_type=5)
 * - Route v4 (point=lat,lng & vehicle=motorcycle / car)
 *
 * Security & Reliability:
 * - Uses VIETMAP_SERVICE_API_KEY strictly on the backend. Never exposes key to client.
 * - In-memory LRU/TTL cache to save quota.
 * - AbortController timeout handling (8 seconds).
 * - Handles 401, 423, OVER_DAILY_LIMIT, ZERO_RESULTS, and network errors.
 * - Does NOT use Nominatim's 1 req/sec mutex queue.
 * - Does NOT fall back silently to fake coordinates.
 */

import { isValidCoordinate, toRouteCoordinate } from '../utils/coordinateHelper.js';

// Default bias center: Hoa Lac Area
export const DEFAULT_HOALAC_BIAS = '21.0128,105.5255';

// In-memory cache with TTL (Time-To-Live in milliseconds)
class TimedCache {
  constructor(ttlMs = 15 * 60 * 1000, maxSize = 1000) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, customTtlMs) {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entries
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    const ttl = customTtlMs || this.ttlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  clear() {
    this.cache.clear();
  }
}

// Caches with specific TTLs
export const autocompleteCache = new TimedCache(5 * 60 * 1000); // 5 minutes
export const placeCache = new TimedCache(60 * 60 * 1000); // 1 hour (deterministic)
export const reverseCache = new TimedCache(30 * 60 * 1000); // 30 minutes
export const routeCache = new TimedCache(15 * 60 * 1000); // 15 minutes

export function getVietmapServiceApiKey() {
  const key = process.env.VIETMAP_SERVICE_API_KEY;
  if (!key || typeof key !== 'string' || !key.trim()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('VIETMAP_SERVICE_API_KEY chưa được cấu hình trên môi trường production.');
    }
    return null;
  }
  return key.trim();
}

/**
 * Standardize administrative address components from Vietmap raw object.
 * Supports both new format (2-level: ward, city) and legacy format (3-level: ward, district, city).
 */
export function normalizeVietmapAddressComponents(raw = {}) {
  const wardId = raw.ward_id ? String(raw.ward_id).trim() : null;
  const wardName = raw.ward ? String(raw.ward).trim() : '';
  const districtId = raw.district_id && raw.district_id !== 0 ? String(raw.district_id).trim() : null;
  const districtName = raw.district ? String(raw.district).trim() : '';
  const cityId = raw.city_id ? String(raw.city_id).trim() : null;
  const cityName = raw.city ? String(raw.city).trim() : '';
  const addressLine = raw.address || raw.street || '';

  return {
    addressLine: typeof addressLine === 'string' ? addressLine.trim() : '',
    wardCode: wardId,
    wardName,
    districtCode: districtId,
    districtName,
    provinceCode: cityId,
    provinceName: cityName,
  };
}

/**
 * Normalizes Vietmap Place/Reverse result to canonical internal DTO
 */
export function normalizeVietmapResult(raw, refId = null) {
  if (!raw || typeof raw !== 'object') return null;

  const lat = raw.lat !== undefined ? Number(raw.lat) : null;
  const lng = raw.lng !== undefined ? Number(raw.lng) : null;
  const displayName = raw.display || raw.name || raw.address || '';
  const formattedAddress = raw.display || raw.address || '';
  const resolvedRefId = raw.ref_id || refId || null;

  return {
    provider: 'vietmap',
    refId: resolvedRefId,
    displayName,
    formattedAddress,
    lat,
    lng,
    addressComponents: normalizeVietmapAddressComponents(raw),
  };
}

/**
 * Autocomplete v4: Suggests places for user query.
 * @param {Object} options
 * @param {string} options.text - Input search query (minimum 2 characters)
 * @param {string} [options.focus] - "lat,lng" for ranking nearby results
 * @param {number} [options.displayType=5] - 5: New format with data_old
 * @returns {Promise<{ success: boolean, suggestions: Array, error?: string }>}
 */
export async function vietmapAutocomplete(arg1, arg2, arg3) {
  let text = '';
  let focus = undefined;
  let displayType = 6; // Recommended by VietMap guide: old format primary, new in data_new

  if (typeof arg1 === 'string') {
    text = arg1;
    focus = arg2;
    displayType = typeof arg3 === 'number' ? arg3 : 6;
  } else if (arg1 && typeof arg1 === 'object') {
    text = arg1.text;
    focus = arg1.focus;
    displayType = typeof arg1.displayType === 'number' ? arg1.displayType : 6;
  }

  if (!text || typeof text !== 'string' || text.trim().length < 2) {
    return { success: true, suggestions: [], message: 'Vui lòng nhập ít nhất 2 ký tự' };
  }

  const cleanText = text.trim();
  const apiKey = getVietmapServiceApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'Dịch vụ bản đồ Vietmap chưa được kích hoạt API Key.',
      code: 'VIETMAP_KEY_MISSING',
    };
  }

  // Validate or set focus
  let focusParam = DEFAULT_HOALAC_BIAS;
  if (focus && typeof focus === 'string') {
    const parts = focus.split(',').map((p) => Number(p.trim()));
    if (parts.length === 2 && isValidCoordinate(parts[0], parts[1])) {
      focusParam = `${parts[0]},${parts[1]}`;
    }
  }

  const cacheKey = `${cleanText.toLowerCase()}|${focusParam}|${displayType}`;
  const cached = autocompleteCache.get(cacheKey);
  if (cached) {
    return { success: true, suggestions: cached, fromCache: true };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const url = new URL('https://maps.vietmap.vn/api/autocomplete/v4');
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('text', cleanText);
    url.searchParams.set('focus', focusParam);
    url.searchParams.set('display_type', String(displayType));

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return { success: false, error: 'Lỗi xác thực Vietmap API Key (401)', code: 'UNAUTHORIZED' };
    }
    if (response.status === 423) {
      return { success: false, error: 'Tài nguyên Vietmap đang bị tạm khóa hoặc vượt hạn mức (423)', code: 'RESOURCE_LOCKED' };
    }
    if (!response.ok) {
      return { success: false, error: `Máy chủ Vietmap trả về HTTP ${response.status}`, code: `HTTP_${response.status}` };
    }

    const data = await response.json();

    if (data?.code === 'OVER_DAILY_LIMIT') {
      return { success: false, error: 'Đã vượt quá hạn mức truy vấn Vietmap trong ngày', code: 'OVER_DAILY_LIMIT' };
    }

    if (!Array.isArray(data)) {
      return { success: true, suggestions: [] };
    }

    // Map suggestions cleanly without leaking internals
    const suggestions = data.slice(0, 10).map((item) => ({
      refId: item.ref_id,
      display: item.display || '',
      name: item.name || '',
      address: item.address || '',
      distance: item.distance || null,
      boundaries: item.boundaries || [],
    }));

    autocompleteCache.set(cacheKey, suggestions);
    return { success: true, suggestions };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Quá thời gian kết nối đến Vietmap Autocomplete (timeout 8s)', code: 'TIMEOUT' };
    }
    return { success: false, error: `Lỗi kết nối Vietmap Autocomplete: ${err.message}`, code: 'NETWORK_ERROR' };
  }
}

/**
 * Search v4: Forward geocode for complete address strings (non-interactive).
 * Optimized for full address lookups, DB migrations, or external imports.
 * @param {Object} options
 * @param {string} options.text - Complete address string
 * @param {string} [options.focus] - "lat,lng" for ranking bias
 * @param {number} [options.displayType=6] - 6: Both formats, old primary
 * @returns {Promise<{ success: boolean, results: Array, error?: string }>}
 */
export async function vietmapSearch(options = {}) {
  const { text, focus, displayType = 6 } = typeof options === 'string' ? { text: options } : options;
  if (!text || typeof text !== 'string' || text.trim().length < 2) {
    return { success: true, results: [], message: 'Vui lòng nhập ít nhất 2 ký tự' };
  }

  const cleanText = text.trim();
  const apiKey = getVietmapServiceApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'Dịch vụ bản đồ Vietmap chưa được kích hoạt API Key.',
      code: 'VIETMAP_KEY_MISSING',
    };
  }

  let focusParam = DEFAULT_HOALAC_BIAS;
  if (focus && typeof focus === 'string') {
    const parts = focus.split(',').map((p) => Number(p.trim()));
    if (parts.length === 2 && isValidCoordinate(parts[0], parts[1])) {
      focusParam = `${parts[0]},${parts[1]}`;
    }
  }

  const cacheKey = `search:${cleanText.toLowerCase()}|${focusParam}|${displayType}`;
  const cached = autocompleteCache.get(cacheKey);
  if (cached) {
    return { success: true, results: cached, fromCache: true };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const url = new URL('https://maps.vietmap.vn/api/search/v4');
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('text', cleanText);
    url.searchParams.set('focus', focusParam);
    url.searchParams.set('display_type', String(displayType));

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return { success: false, error: 'Lỗi xác thực Vietmap API Key (401)', code: 'UNAUTHORIZED' };
    }
    if (response.status === 423) {
      return { success: false, error: 'Tài nguyên Vietmap đang bị tạm khóa hoặc vượt hạn mức (423)', code: 'RESOURCE_LOCKED' };
    }
    if (!response.ok) {
      return { success: false, error: `Máy chủ Vietmap trả về HTTP ${response.status}`, code: `HTTP_${response.status}` };
    }

    const data = await response.json();
    if (data?.code === 'OVER_DAILY_LIMIT') {
      return { success: false, error: 'Đã vượt quá hạn mức truy vấn Vietmap trong ngày', code: 'OVER_DAILY_LIMIT' };
    }
    if (!Array.isArray(data)) {
      return { success: true, results: [] };
    }

    const results = data.slice(0, 10).map((item) => ({
      refId: item.ref_id,
      display: item.display || '',
      name: item.name || '',
      address: item.address || '',
      distance: item.distance || null,
      boundaries: item.boundaries || [],
      categories: item.categories || [],
      dataNew: item.data_new || null,
    }));

    autocompleteCache.set(cacheKey, results);
    return { success: true, results };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Quá thời gian kết nối đến Vietmap Search (timeout 8s)', code: 'TIMEOUT' };
    }
    return { success: false, error: `Lỗi kết nối Vietmap Search: ${err.message}`, code: 'NETWORK_ERROR' };
  }
}

/**
 * Place v4: Fetches exact coordinates and components for a selected ref_id.
 * Each call counts as 1 transaction on Vietmap.
 * @param {Object} options
 * @param {string} options.refId
 * @returns {Promise<{ success: boolean, place?: Object, error?: string }>}
 */
export async function vietmapPlace(arg) {
  const refId = typeof arg === 'string' ? arg : arg?.refId;
  if (!refId || typeof refId !== 'string' || !refId.trim()) {
    return { success: false, error: 'Thiếu refId để tra cứu địa điểm Vietmap', code: 'INVALID_REFID' };
  }

  const cleanRefId = refId.trim();
  const apiKey = getVietmapServiceApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'Dịch vụ bản đồ Vietmap chưa được kích hoạt API Key.',
      code: 'VIETMAP_KEY_MISSING',
    };
  }

  const cached = placeCache.get(cleanRefId);
  if (cached) {
    return { success: true, place: cached, fromCache: true };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const url = new URL('https://maps.vietmap.vn/api/place/v4');
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('refid', cleanRefId);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return { success: false, error: 'Lỗi xác thực Vietmap API Key (401)', code: 'UNAUTHORIZED' };
    }
    if (response.status === 423) {
      return { success: false, error: 'Tài nguyên Vietmap đang bị tạm khóa hoặc vượt hạn mức (423)', code: 'RESOURCE_LOCKED' };
    }
    if (!response.ok) {
      return { success: false, error: `Máy chủ Vietmap trả về HTTP ${response.status}`, code: `HTTP_${response.status}` };
    }

    const data = await response.json();

    if (data?.code === 'OVER_DAILY_LIMIT') {
      return { success: false, error: 'Đã vượt quá hạn mức truy vấn Vietmap trong ngày', code: 'OVER_DAILY_LIMIT' };
    }

    if (!data || typeof data !== 'object' || !isValidCoordinate(data.lat, data.lng)) {
      return { success: false, error: 'Không tìm thấy tọa độ hợp lệ cho địa điểm này', code: 'ZERO_RESULTS' };
    }

    const normalized = normalizeVietmapResult(data, cleanRefId);
    placeCache.set(cleanRefId, normalized);

    return { success: true, place: normalized };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Quá thời gian kết nối đến Vietmap Place (timeout 8s)', code: 'TIMEOUT' };
    }
    return { success: false, error: `Lỗi kết nối Vietmap Place: ${err.message}`, code: 'NETWORK_ERROR' };
  }
}

/**
 * Reverse v4: Converts latitude and longitude into address components.
 * @param {Object} options
 * @param {number} options.lat
 * @param {number} options.lng
 * @param {number} [options.displayType=6]
 * @returns {Promise<{ success: boolean, place?: Object, candidates?: Array, error?: string }>}
 */
export async function vietmapReverse({ lat, lng, displayType = 6 }) {
  if (!isValidCoordinate(lat, lng)) {
    return { success: false, error: 'Tọa độ tìm kiếm không hợp lệ (lat: [-90, 90], lng: [-180, 180])', code: 'INVALID_COORDINATES' };
  }

  const numLat = Number(Number(lat).toFixed(6));
  const numLng = Number(Number(lng).toFixed(6));

  const apiKey = getVietmapServiceApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'Dịch vụ bản đồ Vietmap chưa được kích hoạt API Key.',
      code: 'VIETMAP_KEY_MISSING',
    };
  }

  const cacheKey = `${numLat},${numLng}|${displayType}`;
  const cached = reverseCache.get(cacheKey);
  if (cached) {
    return { success: true, place: cached, fromCache: true };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const url = new URL('https://maps.vietmap.vn/api/reverse/v4');
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('lat', String(numLat));
    url.searchParams.set('lng', String(numLng));
    url.searchParams.set('display_type', String(displayType));

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return { success: false, error: 'Lỗi xác thực Vietmap API Key (401)', code: 'UNAUTHORIZED' };
    }
    if (response.status === 423) {
      return { success: false, error: 'Tài nguyên Vietmap đang bị tạm khóa hoặc vượt hạn mức (423)', code: 'RESOURCE_LOCKED' };
    }
    if (!response.ok) {
      return { success: false, error: `Máy chủ Vietmap trả về HTTP ${response.status}`, code: `HTTP_${response.status}` };
    }

    const data = await response.json();

    if (data?.code === 'OVER_DAILY_LIMIT') {
      return { success: false, error: 'Đã vượt quá hạn mức truy vấn Vietmap trong ngày', code: 'OVER_DAILY_LIMIT' };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return { success: false, error: 'Không tìm thấy địa chỉ tại tọa độ này', code: 'ZERO_RESULTS' };
    }

    const best = data[0];
    const normalized = normalizeVietmapResult(best, best.ref_id);

    reverseCache.set(cacheKey, normalized);

    return {
      success: true,
      place: normalized,
      candidates: data.slice(0, 5).map((d) => normalizeVietmapResult(d, d.ref_id)),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Quá thời gian kết nối đến Vietmap Reverse (timeout 8s)', code: 'TIMEOUT' };
    }
    return { success: false, error: `Lỗi kết nối Vietmap Reverse: ${err.message}`, code: 'NETWORK_ERROR' };
  }
}

/**
 * Route v4: Calculates road route between waypoints.
 * Supported profiles: motorcycle, car, truck, container.
 * Supports optional toll & congestion annotations.
 * @param {Object} options
 * @param {Array<string|{lat: number, lng: number}>} options.points - Minimum 2 points
 * @param {string} [options.vehicle='motorcycle'] - 'motorcycle' | 'car' | 'truck' | 'container'
 * @param {number} [options.capacity] - Vehicle weight in kg (required when vehicle=truck)
 * @param {string} [options.avoid] - Road type to avoid, e.g. 'ferry'
 * @param {string} [options.annotations] - Comma-separated: 'toll', 'congestion', or 'toll,congestion'
 * @returns {Promise<{ success: boolean, route?: Object, error?: string }>}
 */
export async function vietmapRoute(options = {}) {
  let {
    points,
    origin,
    destination,
    vehicle = 'motorcycle',
    capacity,
    avoid,
    annotations,
  } = options;

  if (!Array.isArray(points) || points.length === 0) {
    if (origin && destination) {
      points = [origin, destination];
    } else {
      points = [];
    }
  }

  if (points.length < 2) {
    return { success: false, error: 'Cần ít nhất 2 điểm (điểm đón và điểm đến) để tìm tuyến đường', code: 'INVALID_POINTS' };
  }

  const validPoints = points
    .map((p) => toRouteCoordinate(p))
    .filter(Boolean);

  if (validPoints.length < 2) {
    return { success: false, error: 'Tọa độ các điểm trên tuyến đường không hợp lệ', code: 'INVALID_COORDINATES' };
  }

  const validVehicle = ['motorcycle', 'car', 'truck', 'container'].includes(vehicle) ? vehicle : 'motorcycle';

  const apiKey = getVietmapServiceApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'Dịch vụ bản đồ Vietmap chưa được kích hoạt API Key.',
      code: 'VIETMAP_KEY_MISSING',
    };
  }

  const cacheKey = `${validPoints.join('->')}|${validVehicle}${annotations ? `|${annotations}` : ''}`;
  const cached = routeCache.get(cacheKey);
  if (cached) {
    return { success: true, route: cached, fromCache: true };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = new URL('https://maps.vietmap.vn/api/route/v4');
    url.searchParams.set('apikey', apiKey);
    validPoints.forEach((pt) => url.searchParams.append('point', pt));
    url.searchParams.set('points_encoded', 'false'); // Coordinates as GeoJSON / array
    url.searchParams.set('vehicle', validVehicle);

    if (validVehicle === 'truck' && capacity) {
      url.searchParams.set('capacity', String(capacity));
    }
    if (avoid) {
      url.searchParams.set('avoid', String(avoid));
    }
    if (annotations) {
      url.searchParams.set('annotations', String(annotations));
    }

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return { success: false, error: 'Lỗi xác thực Vietmap API Key (401)', code: 'UNAUTHORIZED' };
    }
    if (response.status === 423) {
      return { success: false, error: 'Tài nguyên Vietmap đang bị tạm khóa hoặc vượt hạn mức (423)', code: 'RESOURCE_LOCKED' };
    }
    if (!response.ok) {
      return { success: false, error: `Máy chủ Vietmap trả về HTTP ${response.status}`, code: `HTTP_${response.status}` };
    }

    const data = await response.json();

    if (data?.code === 'OVER_DAILY_LIMIT') {
      return { success: false, error: 'Đã vượt quá hạn mức truy vấn Vietmap trong ngày', code: 'OVER_DAILY_LIMIT' };
    }
    if (data?.code === 'ZERO_RESULTS' || !data?.paths || data.paths.length === 0) {
      return { success: false, error: 'Không tìm thấy đường đi phù hợp giữa 2 điểm', code: 'ZERO_RESULTS' };
    }

    const bestPath = data.paths[0];

    // Handle both GeoJSON LineString object and [lon, lat] coordinate array
    let geoJsonCoordinates = [];
    if (bestPath.points && typeof bestPath.points === 'object' && Array.isArray(bestPath.points.coordinates)) {
      geoJsonCoordinates = bestPath.points.coordinates;
    } else if (Array.isArray(bestPath.points)) {
      geoJsonCoordinates = bestPath.points;
    }

    // Leaflet format uses [latitude, longitude]
    const leafletPoints = geoJsonCoordinates.map((pt) => [pt[1], pt[0]]);

    const normalizedRoute = {
      distance: bestPath.distance, // meters
      distanceKm: Number((bestPath.distance / 1000).toFixed(2)),
      timeMs: bestPath.time, // milliseconds
      durationMinutes: Math.round(bestPath.time / 60000),
      bbox: bestPath.bbox || null,
      points: leafletPoints, // Leaflet format: [[lat, lng], ...]
      geoJsonCoordinates, // Vietmap GL / GeoJSON format: [[lng, lat], ...]
      instructions: bestPath.instructions || [],
      vehicle: validVehicle,
      tollCost: typeof bestPath.toll_cost === 'number' ? bestPath.toll_cost : null,
      tolls: Array.isArray(bestPath.tolls) ? bestPath.tolls : [],
      congestion: Array.isArray(bestPath.congestion) ? bestPath.congestion : [],
    };

    routeCache.set(cacheKey, normalizedRoute);
    return { success: true, route: normalizedRoute };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Quá thời gian kết nối đến Vietmap Route (timeout 10s)', code: 'TIMEOUT' };
    }
    return { success: false, error: `Lỗi kết nối Vietmap Route: ${err.message}`, code: 'NETWORK_ERROR' };
  }
}

/**
 * Route-tolls: Pre-trip BOT toll calculation by vehicle class (1-5).
 * Coordinates body order is [[lng, lat], [lng, lat]].
 * @param {Object} options
 * @param {Array<[number, number]>} options.points - Minimum 2 [lng, lat] waypoints
 * @param {number} [options.vehicle=1] - Vehicle class 1 to 5
 * @returns {Promise<{ success: boolean, totalToll?: number, tolls?: Array, path?: Array, error?: string }>}
 */
export async function vietmapRouteTolls({ points = [], vehicle = 1 }) {
  if (!Array.isArray(points) || points.length < 2) {
    return { success: false, error: 'Cần ít nhất 2 điểm [[lng, lat], ...] để tính phí BOT', code: 'INVALID_POINTS' };
  }
  const apiKey = getVietmapServiceApiKey();
  if (!apiKey) {
    return { success: false, error: 'Dịch vụ bản đồ Vietmap chưa được kích hoạt API Key.', code: 'VIETMAP_KEY_MISSING' };
  }

  const validVehicle = [1, 2, 3, 4, 5].includes(Number(vehicle)) ? Number(vehicle) : 1;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = new URL('https://maps.vietmap.vn/api/route-tolls');
    url.searchParams.set('api-version', '1.1');
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('vehicle', String(validVehicle));

    const response = await fetch(url.toString(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(points),
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return { success: false, error: 'Lỗi xác thực Vietmap API Key (401)', code: 'UNAUTHORIZED' };
    }
    if (!response.ok) {
      return { success: false, error: `Máy chủ Vietmap trả về HTTP ${response.status}`, code: `HTTP_${response.status}` };
    }

    const data = await response.json();
    const tolls = Array.isArray(data?.tolls) ? data.tolls : [];
    const totalToll = tolls.reduce((acc, t) => acc + (Number(t.amount || t.price) || 0), 0);

    return {
      success: true,
      path: Array.isArray(data?.path) ? data.path : [],
      tolls,
      totalToll,
      vehicle: validVehicle,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Quá thời gian kết nối đến Vietmap Route-tolls (timeout 10s)', code: 'TIMEOUT' };
    }
    return { success: false, error: `Lỗi kết nối Vietmap Route-tolls: ${err.message}`, code: 'NETWORK_ERROR' };
  }
}

/**
 * Match-tolls: Post-trip GPS trail snapping and toll booth reconciliation.
 * Body is [[lng, lat], ...] from GPS logger/tracker.
 * @param {Object} options
 * @param {Array<[number, number]>} [options.path] - GPS trail points [[lng, lat], ...]
 * @param {Array<[number, number]>} [options.points] - Alias for path
 * @param {number} [options.vehicle=1] - Vehicle class 1 to 5
 * @returns {Promise<{ success: boolean, distanceKm?: number, totalToll?: number, tolls?: Array, path?: Array, error?: string }>}
 */
export async function vietmapMatchTolls({ path = [], points, vehicle = 1 }) {
  const trail = Array.isArray(path) && path.length >= 2 ? path : (Array.isArray(points) ? points : []);
  if (trail.length < 2) {
    return { success: false, error: 'Cần ít nhất 2 tọa độ GPS trail [[lng, lat], ...] để đối soát BOT', code: 'INVALID_POINTS' };
  }
  const apiKey = getVietmapServiceApiKey();
  if (!apiKey) {
    return { success: false, error: 'Dịch vụ bản đồ Vietmap chưa được kích hoạt API Key.', code: 'VIETMAP_KEY_MISSING' };
  }

  const validVehicle = [1, 2, 3, 4, 5].includes(Number(vehicle)) ? Number(vehicle) : 1;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = new URL('https://maps.vietmap.vn/api/match-tolls');
    url.searchParams.set('api-version', '1.1');
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('vehicle', String(validVehicle));

    const response = await fetch(url.toString(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(trail),
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return { success: false, error: 'Lỗi xác thực Vietmap API Key (401)', code: 'UNAUTHORIZED' };
    }
    if (!response.ok) {
      return { success: false, error: `Máy chủ Vietmap trả về HTTP ${response.status}`, code: `HTTP_${response.status}` };
    }

    const data = await response.json();
    const tolls = Array.isArray(data?.tolls) ? data.tolls : [];
    const totalToll = tolls.reduce((acc, t) => acc + (Number(t.price || t.amount) || 0), 0);

    return {
      success: true,
      distanceKm: typeof data?.distance === 'number' ? Number(data.distance.toFixed(3)) : null,
      path: Array.isArray(data?.path) ? data.path : [],
      tolls,
      totalToll,
      vehicle: validVehicle,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Quá thời gian kết nối đến Vietmap Match-tolls (timeout 10s)', code: 'TIMEOUT' };
    }
    return { success: false, error: `Lỗi kết nối Vietmap Match-tolls: ${err.message}`, code: 'NETWORK_ERROR' };
  }
}

/**
 * Reverse-batch: Reverse geocodes a batch of coordinates in one round trip.
 * Uses lon, not lng, as explicitly required by VietMap reverse-batch API.
 * @param {Array<{lat: number, lng: number}|{lat: number, lon: number}|[number, number]>} points
 * @returns {Promise<{ success: boolean, results?: Array, error?: string }>}
 */
export async function vietmapReverseBatch(points = []) {
  if (!Array.isArray(points) || points.length === 0) {
    return { success: false, error: 'Cần danh sách tọa độ để tra cứu hàng loạt', code: 'INVALID_POINTS' };
  }

  const apiKey = getVietmapServiceApiKey();
  if (!apiKey) {
    return { success: false, error: 'Dịch vụ bản đồ Vietmap chưa được kích hoạt API Key.', code: 'VIETMAP_KEY_MISSING' };
  }

  // VietMap reverse-batch strictly requires { lon, lat } (lon, NOT lng!)
  const batchBody = points.map((pt) => {
    if (Array.isArray(pt) && pt.length >= 2) {
      return { lon: Number(pt[0]), lat: Number(pt[1]) };
    }
    if (pt && typeof pt === 'object') {
      const lon = pt.lon !== undefined ? Number(pt.lon) : Number(pt.lng);
      return { lon, lat: Number(pt.lat) };
    }
    return null;
  }).filter((pt) => pt && !isNaN(pt.lon) && !isNaN(pt.lat));

  if (batchBody.length === 0) {
    return { success: false, error: 'Không có tọa độ hợp lệ trong danh sách', code: 'INVALID_COORDINATES' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = new URL('https://maps.vietmap.vn/api/geocode-fleet/reverse-batch');
    url.searchParams.set('apikey', apiKey);

    const response = await fetch(url.toString(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(batchBody),
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return { success: false, error: 'Lỗi xác thực Vietmap API Key (401)', code: 'UNAUTHORIZED' };
    }
    if (!response.ok) {
      return { success: false, error: `Máy chủ Vietmap trả về HTTP ${response.status}`, code: `HTTP_${response.status}` };
    }

    const data = await response.json();
    return { success: true, results: Array.isArray(data) ? data : [] };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Quá thời gian kết nối đến Vietmap Reverse Batch (timeout 10s)', code: 'TIMEOUT' };
    }
    return { success: false, error: `Lỗi kết nối Vietmap Reverse Batch: ${err.message}`, code: 'NETWORK_ERROR' };
  }
}



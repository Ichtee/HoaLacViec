/**
 * Safe backend geocoding service using OpenStreetMap Nominatim
 * Compliant with Nominatim Usage Policy:
 * - Proper User-Agent identifying the application
 * - In-memory LRU-like cache to prevent duplicate requests
 * - Strict 1 req/sec rate limit with Promise Mutex Queue
 * - Timeout handling with AbortController
 */

import { searchGoogleMapsPlaces } from './serpApi.js';

const geocodeCache = new Map();
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1000; // Nominatim policy: max 1 request/second

// Serial Mutex Queue
let mutexQueue = Promise.resolve();

async function doGeocode(cleanQuery, cacheKey) {
  if (geocodeCache.has(cacheKey)) {
    return { success: true, ...geocodeCache.get(cacheKey), fromCache: true };
  }

  // Rate limiting with guarantee of MIN_INTERVAL_MS spacing
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - timeSinceLast));
  }
  lastRequestTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '5');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('q', cleanQuery);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HoaLacViec-GeocodingService/1.0 (contact@hoalacviec.vn)',
        'Accept-Language': 'vi,en;q=0.8',
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const fallback = await tryGoogleMapsFallback(cleanQuery, cacheKey);
      if (fallback) return fallback;
      return {
        success: false,
        error: `Máy chủ bản đồ trả về lỗi HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      const fallback = await tryGoogleMapsFallback(cleanQuery, cacheKey);
      if (fallback) return fallback;
      return {
        success: false,
        candidates: [],
        error: 'Không tìm thấy tọa độ phù hợp cho địa chỉ này',
      };
    }

    const candidates = data
      .map((d) => ({
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        displayName: d.display_name,
        address: d.address || {},
      }))
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));

    if (candidates.length === 0) {
      const fallback = await tryGoogleMapsFallback(cleanQuery, cacheKey);
      if (fallback) return fallback;
      return {
        success: false,
        candidates: [],
        error: 'Dữ liệu tọa độ trả về không hợp lệ',
      };
    }

    const best = candidates[0];

    const result = {
      lat: best.lat,
      lng: best.lng,
      displayName: best.displayName,
      candidates,
      results: candidates,
    };

    geocodeCache.set(cacheKey, result);
    return { success: true, ...result };
  } catch (err) {
    clearTimeout(timeoutId);
    const fallback = await tryGoogleMapsFallback(cleanQuery, cacheKey);
    if (fallback) return fallback;
    if (err.name === 'AbortError') {
      return { success: false, error: 'Quá thời gian kết nối tới dịch vụ bản đồ (timeout 6s)' };
    }
    return { success: false, error: `Lỗi kết nối định vị: ${err.message}` };
  }
}

async function tryGoogleMapsFallback(cleanQuery, cacheKey) {
  if (!process.env.SERPAPI_API_KEY) return null;
  try {
    const places = await searchGoogleMapsPlaces(cleanQuery);
    if (Array.isArray(places) && places.length > 0) {
      const candidates = places
        .map((p) => ({
          lat: Number(p.lat),
          lng: Number(p.lng),
          displayName: p.title + (p.address ? ` (${p.address})` : ''),
          address: { road: p.address || '' },
        }))
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));

      if (candidates.length > 0) {
        const result = {
          lat: candidates[0].lat,
          lng: candidates[0].lng,
          displayName: candidates[0].displayName,
          candidates,
          results: candidates,
          source: 'google_maps',
        };
        geocodeCache.set(cacheKey, result);
        return { success: true, ...result };
      }
    }
  } catch (fallbackErr) {
    console.warn('[GeocodingFallback] Google Maps fallback failed:', fallbackErr.message);
  }
  return null;
}

export async function geocodeAddress(addressQuery) {
  if (!addressQuery || typeof addressQuery !== 'string' || !addressQuery.trim()) {
    return { success: false, error: 'Địa chỉ tìm kiếm không được để trống' };
  }

  const cleanQuery = addressQuery.trim();
  const cacheKey = cleanQuery.toLowerCase();

  if (geocodeCache.has(cacheKey)) {
    return { success: true, ...geocodeCache.get(cacheKey), fromCache: true };
  }

  // Queue and execute serially through mutex
  const task = mutexQueue.then(() => doGeocode(cleanQuery, cacheKey));
  mutexQueue = task.catch(() => {});
  return task;
}

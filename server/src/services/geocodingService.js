/**
 * Backend Geocoding Service powered by Vietmap v4
 * Replaces legacy Nominatim & SerpApi fallback with official Vietmap v4 Autocomplete + Place APIs.
 *
 * Compliance:
 * - Does NOT use 1 req/sec mutex queue of Nominatim.
 * - Does NOT fallback silently to fake/default coordinates.
 * - Standardized response format: provider, refId, displayName, formattedAddress, lat, lng, addressComponents.
 */

import {
  vietmapAutocomplete,
  vietmapPlace,
  getVietmapServiceApiKey,
} from './vietmapService.js';

const geocodeCache = new Map();

export async function geocodeAddress(addressQuery) {
  if (!addressQuery || typeof addressQuery !== 'string' || !addressQuery.trim()) {
    return { success: false, error: 'Địa chỉ tìm kiếm không được để trống' };
  }

  const cleanQuery = addressQuery.trim();
  const cacheKey = cleanQuery.toLowerCase();

  if (geocodeCache.has(cacheKey)) {
    return { success: true, ...geocodeCache.get(cacheKey), fromCache: true };
  }

  // Check key availability
  const apiKey = getVietmapServiceApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'Dịch vụ định vị Vietmap chưa được kích hoạt API key',
      code: 'VIETMAP_KEY_MISSING',
    };
  }

  try {
    // 1. Step 1: Autocomplete v4
    const autoRes = await vietmapAutocomplete({ text: cleanQuery });

    if (!autoRes.success) {
      return {
        success: false,
        error: autoRes.error || 'Lỗi tìm kiếm gợi ý địa chỉ Vietmap',
        code: autoRes.code,
      };
    }

    const suggestions = autoRes.suggestions || [];
    if (suggestions.length === 0) {
      return {
        success: false,
        candidates: [],
        error: 'Không tìm thấy địa điểm phù hợp trên bản đồ Vietmap',
        code: 'ZERO_RESULTS',
      };
    }

    // 2. Step 2: Fetch exact Place details for the first/best suggestion
    const bestSuggestion = suggestions[0];
    const placeRes = await vietmapPlace({ refId: bestSuggestion.refId });

    if (!placeRes.success || !placeRes.place) {
      return {
        success: false,
        candidates: suggestions.map((s) => ({
          refId: s.refId,
          displayName: s.display || s.name,
          address: s.address,
        })),
        error: placeRes.error || 'Không thể lấy tọa độ chi tiết cho địa điểm này',
        code: placeRes.code,
      };
    }

    const { place } = placeRes;

    const candidateList = suggestions.map((s, idx) => ({
      refId: s.refId,
      displayName: s.display || s.name,
      address: s.address,
      lat: idx === 0 ? place.lat : undefined,
      lng: idx === 0 ? place.lng : undefined,
    }));

    const result = {
      provider: 'vietmap',
      refId: place.refId,
      lat: place.lat,
      lng: place.lng,
      displayName: place.displayName,
      formattedAddress: place.formattedAddress,
      addressComponents: place.addressComponents,
      candidates: candidateList,
      results: candidateList,
    };

    geocodeCache.set(cacheKey, result);
    return { success: true, ...result };
  } catch (err) {
    return {
      success: false,
      error: `Lỗi kết nối dịch vụ bản đồ: ${err.message}`,
      code: 'NETWORK_ERROR',
    };
  }
}

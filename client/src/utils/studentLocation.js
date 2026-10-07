import { geocodeAddress } from '@/services';
import { AREAS } from '@/constants';
import { haversineDistance, isValidCoordinate } from './index.js';
import { isCoarseLocation } from './jobLocation.js';

const CACHE_KEY = 'hlv_area_geocode_v1';
const HOALAC_CENTER = { lat: 21.0128, lng: 105.5255 };
const MAX_AREA_DISTANCE_M = 15000;

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Không lưu được bộ nhớ đệm thì lần sau tìm lại
  }
}

/**
 * Vị trí của sinh viên để tính khoảng cách, theo thứ tự ưu tiên:
 *  1. GPS hiện tại (ước tính nếu sai số > 1 km)
 *  2. Tọa độ lưu trong hồ sơ
 *  3. Khu vực sinh sống trong hồ sơ -> tìm tọa độ qua Vietmap (luôn là ước tính, có lưu tạm)
 * Trả về { lat, lng, basis: 'gps'|'profile'|'area', approximate } hoặc null.
 */
export async function resolveStudentPoint(gps, profile) {
  if (gps && isValidCoordinate(gps.lat, gps.lng)) {
    return { lat: Number(gps.lat), lng: Number(gps.lng), basis: 'gps', approximate: isCoarseLocation(gps) };
  }
  if (profile?.location && isValidCoordinate(profile.location.lat, profile.location.lng)) {
    return { lat: Number(profile.location.lat), lng: Number(profile.location.lng), basis: 'profile', approximate: false };
  }
  const area = String(profile?.area || '').trim();
  if (!area) return null;
  const label = AREAS.find((a) => a.value === area)?.label || area;
  const query = `${label}, Thạch Thất, Hà Nội`;

  const cache = readCache();
  if (cache[query]) return { ...cache[query], basis: 'area', approximate: true };

  try {
    const result = await geocodeAddress(query);
    if (!result?.success || !isValidCoordinate(result.lat, result.lng)) return null;
    // Bỏ kết quả lệch khỏi khu Hòa Lạc (trùng tên địa danh ở nơi khác)
    if (haversineDistance(result.lat, result.lng, HOALAC_CENTER.lat, HOALAC_CENTER.lng) > MAX_AREA_DISTANCE_M) return null;
    const point = { lat: Number(result.lat), lng: Number(result.lng) };
    writeCache({ ...cache, [query]: point });
    return { ...point, basis: 'area', approximate: true };
  } catch {
    return null;
  }
}

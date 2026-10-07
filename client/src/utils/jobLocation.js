import { isValidCoordinate } from './index.js';

// Sai số GPS lớn hơn ngưỡng này (thường gặp khi định vị bằng IP/Wi-Fi trên máy tính) -> khoảng cách chỉ là ước tính
export const COARSE_ACCURACY_METERS = 1000;

const valid = (p) => Boolean(p) && isValidCoordinate(p.lat, p.lng);

/**
 * Điểm dùng để tính khoảng cách tới một tin.
 * - Vị trí chủ quán đã xác nhận (và không bị đánh dấu là điểm mặc định) -> chính xác.
 * - Ngược lại dùng tọa độ ước tính từ địa chỉ (approxLocation lưu trên server, hoặc mapDisplayLocation tìm tạm ở client).
 * Trả về null nếu không có gì để tính.
 */
export function getJobDistanceTarget(job) {
  if (!job) return null;
  const confirmed = job.locationStatus === 'confirmed' && valid(job.location);
  if (confirmed && !job.locationNeedsReview) {
    return { lat: Number(job.location.lat), lng: Number(job.location.lng), approximate: false };
  }
  for (const candidate of [job.approxLocation, job.mapDisplayLocation]) {
    if (valid(candidate)) return { lat: Number(candidate.lat), lng: Number(candidate.lng), approximate: true };
  }
  if (confirmed) return { lat: Number(job.location.lat), lng: Number(job.location.lng), approximate: true };
  return null;
}

/** "850m" / "2.1km", thêm "~" khi là ước tính. */
export function formatDistanceLabel(meters, approximate = false) {
  if (meters === null || meters === undefined || !Number.isFinite(Number(meters))) return '';
  const n = Number(meters);
  const text = n < 1000 ? `${Math.round(n)}m` : `${(n / 1000).toFixed(1)}km`;
  return approximate ? `~${text}` : text;
}

export function isCoarseLocation(userLocation) {
  return Number(userLocation?.accuracy) > COARSE_ACCURACY_METERS;
}

import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { vi } from 'date-fns/locale';
import { SALARY_UNIT_LABELS, JOB_TYPE_LABELS, APP_STATUS_LABELS, SHIFT_STATUS_LABELS, SWAP_STATUS_LABELS } from '@/constants';

/** Format date to Vietnamese readable string */
export function formatDate(dateStr, fmt = 'dd/MM/yyyy') {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (!isValid(d)) return '—';
    return format(d, fmt, { locale: vi });
  } catch {
    return '—';
  }
}

/** Format datetime */
export function formatDateTime(dateStr) {
  return formatDate(dateStr, 'HH:mm dd/MM/yyyy');
}

/** Format time only */
export function formatTime(dateStr) {
  return formatDate(dateStr, 'HH:mm');
}

/** Relative time */
export function fromNow(dateStr) {
  if (!dateStr) return '';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    return formatDistanceToNow(d, { locale: vi, addSuffix: true });
  } catch {
    return '';
  }
}

/** Format VND currency */
export function formatVND(amount) {
  if (amount == null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

/** Format salary with unit */
export function formatSalary(amount, unit) {
  const unitLabel = SALARY_UNIT_LABELS[unit] || '';
  return `${formatVND(amount)}${unitLabel}`;
}

/** Get label helpers */
export const getJobTypeLabel = (type) => JOB_TYPE_LABELS[type] || type;
export const getAppStatusLabel = (status) => APP_STATUS_LABELS[status] || status;
export const getShiftStatusLabel = (status) => SHIFT_STATUS_LABELS[status] || status;
export const getSwapStatusLabel = (status) => SWAP_STATUS_LABELS[status] || status;

export {
  LOCATION_STATUSES,
  LOCATION_SOURCES,
  VALID_LOCATION_SOURCES,
  VALID_LOCATION_STATUSES,
  normalizeAddressComponents,
} from './locationContract.js';

/** Validate coordinates strictly */
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

/** Calculate haversine distance between two lat/lng points in meters */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    return null;
  }
  const nLat1 = Number(lat1);
  const nLng1 = Number(lng1);
  const nLat2 = Number(lat2);
  const nLng2 = Number(lng2);

  const R = 6371000; // Earth radius in meters
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLng = ((nLng2 - nLng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Format distance for display */
export function formatDistance(meters) {
  if (meters === null || meters === undefined || !Number.isFinite(Number(meters))) return '';
  const n = Number(meters);
  if (n < 1000) return `${Math.round(n)}m`;
  return `${(n / 1000).toFixed(1)}km`;
}

/**
 * Compute job match score for a student (rule-based, no AI)
 * Returns score 0-100 and reasons[]
 *
 * Weights: time 50%, distance 30%, bus 20%
 * If schedule conflict → conflict flag (job should be warned)
 */
export function computeMatchScore(job, studentAvailability, studentLocation) {
  let timeScore = 0;
  let distScore = 0;
  let busScore = 0;
  const reasons = [];
  let hasConflict = false;

  // --- Time match (50%) ---
  if (studentAvailability && studentAvailability.length > 0 && job.schedule) {
    const jobSlots = job.schedule; // [{dayOfWeek, startTime, endTime}]
    let matched = 0;
    let conflicted = 0;
    for (const slot of jobSlots) {
      const avail = studentAvailability.find(
        (a) => a.dayOfWeek === slot.dayOfWeek && a.type === 'available'
      );
      const busy = studentAvailability.find(
        (a) =>
          a.dayOfWeek === slot.dayOfWeek &&
          a.type === 'class' &&
          timesOverlap(a.startTime, a.endTime, slot.startTime, slot.endTime)
      );
      if (busy) { conflicted++; hasConflict = true; }
      else if (avail && timesOverlap(avail.startTime, avail.endTime, slot.startTime, slot.endTime)) matched++;
    }
    const total = jobSlots.length;
    if (total > 0) {
      timeScore = Math.round((matched / total) * 100);
      reasons.push(`Phù hợp ${matched}/${total} khung giờ bạn đã chọn`);
      if (conflicted > 0) reasons.push(`⚠ Trùng ${conflicted} ca với lịch học`);
    }
  } else {
    reasons.push('Chưa có lịch rảnh để so sánh');
  }

  // --- Distance (30%) ---
  if (studentLocation && job.location?.lat && job.location?.lng) {
    const dist = haversineDistance(
      studentLocation.lat, studentLocation.lng,
      job.location.lat, job.location.lng
    );
    if (dist <= 500) distScore = 100;
    else if (dist <= 1000) distScore = 80;
    else if (dist <= 2000) distScore = 60;
    else if (dist <= 5000) distScore = 40;
    else distScore = 10;
    reasons.push(`Cách vị trí của bạn khoảng ${formatDistance(dist)}`);
  } else {
    reasons.push('Chưa có thông tin vị trí để tính khoảng cách');
  }

  // --- Bus route (20%) ---
  if (job.busRoutes && job.busRoutes.length > 0) {
    busScore = 70;
    reasons.push(`Có tuyến xe buýt kết nối phù hợp`);
  } else {
    reasons.push('Không có dữ liệu xe buýt cho vị trí này');
  }

  const total = timeScore * 0.5 + distScore * 0.3 + busScore * 0.2;
  return {
    score: Math.round(total),
    timeScore,
    distScore,
    busScore,
    hasConflict,
    reasons,
    available: studentAvailability?.length > 0,
  };
}

function timesOverlap(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}

/** Calculate payroll for a single shift
 *  Formula: approved_minutes / 60 * hourly_rate_snapshot
 *  Only for hourly jobs
 */
export function calcShiftPay(approvedMinutes, hourlyRateSnapshot) {
  if (!approvedMinutes || !hourlyRateSnapshot) return 0;
  const raw = (approvedMinutes / 60) * hourlyRateSnapshot;
  return Math.round(raw / 1000) * 1000; // round to nearest 1000 VND
}

/** Build payroll summary for a payroll period */
export function buildPayrollSummary(shifts, adjustments = []) {
  const shiftLines = shifts.map((s) => ({
    shiftId: s.id,
    studentId: s.studentId,
    date: s.date,
    approvedMinutes: s.attendance?.approvedMinutes || 0,
    rateSnapshot: s.rateSnapshot,
    pay: calcShiftPay(s.attendance?.approvedMinutes || 0, s.rateSnapshot),
  }));
  const shiftTotal = shiftLines.reduce((sum, l) => sum + l.pay, 0);
  const adjTotal = adjustments.reduce((sum, a) => sum + (a.amount || 0), 0);
  return {
    lines: shiftLines,
    shiftTotal,
    adjustments,
    adjTotal,
    grandTotal: shiftTotal + adjTotal,
  };
}

/** Check if two time ranges conflict (same day) */
export function hasTimeConflict(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}

/** Generate relative dates (always in the future) */
export function relativeDate(dayOffset, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function relativeDateStr(dayOffset) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().split('T')[0];
}

/** Clamp value */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/** Truncate text */
export function truncate(str, max = 100) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

/** Generate a simple UUID */
export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

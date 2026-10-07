import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { geocodeAddress } from '../services/geocodingService.js';
import { calculateHaversineDistanceMeters, isValidCoordinate } from '../utils/geoHelper.js';

/**
 * Bổ sung tọa độ ước tính cho tin chưa ghim vị trí, và đánh dấu tin đang "xác nhận" ở điểm mặc định.
 *  - Tin chưa có vị trí xác nhận: tìm tọa độ từ địa chỉ -> approxLocation (hiển thị khoảng cách "~").
 *  - Tin có vị trí xác nhận nhưng nằm sát điểm mặc định trung tâm Hòa Lạc: locationNeedsReview = true
 *    (giữ nguyên location để không làm hỏng chấm công đang chạy) và cũng tìm approxLocation từ địa chỉ.
 * Không bao giờ ghi vào location/locationStatus. Dry-run theo mặc định; thêm --apply để ghi.
 */
export const HOALAC_CENTER = { lat: 21.0128, lng: 105.5255 };
// Các điểm mặc định từng được dùng trong seed/script và bộ chọn bản đồ
export const DEFAULT_POINTS = [HOALAC_CENTER, { lat: 21.0132, lng: 105.5255 }, { lat: 21.0135, lng: 105.526 }];
const DEFAULT_RADIUS_M = 120;
const MAX_DISTANCE_FROM_HOALAC_M = 15000;
const ACTIVE_STATUSES = ['draft', 'pending', 'approved', 'active', 'paused'];

export function isDefaultPoint(lat, lng) {
  if (!isValidCoordinate(lat, lng)) return false;
  return DEFAULT_POINTS.some((p) => calculateHaversineDistanceMeters(lat, lng, p.lat, p.lng) <= DEFAULT_RADIUS_M);
}

export async function backfillJobLocations({ apply = false, log = () => {}, geocode = geocodeAddress } = {}) {
  const report = { scanned: 0, approxFound: 0, approxRejectedFar: [], approxNotFound: [], flaggedDefault: [], skipped: 0 };
  const ops = [];
  const jobs = await Job.collection.find(
    { status: { $in: ACTIVE_STATUSES } },
    { projection: { title: 1, address: 1, location: 1, locationStatus: 1, approxLocation: 1, locationNeedsReview: 1 } }
  ).toArray();

  for (const job of jobs) {
    report.scanned++;
    const id = String(job._id);
    const confirmed = job.locationStatus === 'confirmed' && isValidCoordinate(job.location?.lat, job.location?.lng);
    const atDefault = confirmed && isDefaultPoint(job.location.lat, job.location.lng);
    const set = {};

    if (atDefault && !job.locationNeedsReview) {
      set.locationNeedsReview = true;
      report.flaggedDefault.push({ id, title: job.title });
    }

    const needsApprox = (!confirmed || atDefault) && !job.approxLocation && job.address?.trim();
    if (needsApprox) {
      const result = await geocode(job.address);
      if (result?.success && isValidCoordinate(result.lat, result.lng)) {
        const distance = calculateHaversineDistanceMeters(result.lat, result.lng, HOALAC_CENTER.lat, HOALAC_CENTER.lng);
        if (distance > MAX_DISTANCE_FROM_HOALAC_M) {
          report.approxRejectedFar.push({ id, title: job.title, address: job.address, km: Math.round(distance / 100) / 10 });
        } else {
          set.approxLocation = {
            lat: Number(Number(result.lat).toFixed(6)),
            lng: Number(Number(result.lng).toFixed(6)),
            source: 'geocoded',
            query: job.address,
            geocodedAt: new Date(),
          };
          report.approxFound++;
        }
      } else {
        report.approxNotFound.push({ id, title: job.title, address: job.address, reason: result?.code || result?.error || 'unknown' });
      }
    } else if (!Object.keys(set).length) {
      report.skipped++;
    }

    if (Object.keys(set).length) ops.push({ updateOne: { filter: { _id: job._id }, update: { $set: set } } });
  }

  log(JSON.stringify(report, null, 2));
  if (apply && ops.length) await Job.collection.bulkWrite(ops, { ordered: false });
  return { ...report, updates: ops.length, applied: apply };
}

// CLI: node src/scripts/backfillJobLocations.js [--apply]
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/backfillJobLocations.js')) {
  const apply = process.argv.includes('--apply');
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('Thiếu MONGO_URI hoặc MONGODB_URI.');
  await mongoose.connect(mongoUri);
  try {
    const result = await backfillJobLocations({ apply, log: (text) => process.stdout.write(`${text}\n`) });
    process.stdout.write(apply
      ? `Đã cập nhật ${result.updates} tin.\n`
      : `Có ${result.updates} tin sẽ được cập nhật. Chưa thay đổi dữ liệu (thêm --apply để ghi).\n`);
  } finally {
    await mongoose.disconnect();
  }
}

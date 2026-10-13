/**
 * Kiểm tra (và tùy chọn sửa) tọa độ ghim của tin tuyển dụng.
 *   node src/scripts/auditJobPins.js            -> chỉ liệt kê, không ghi gì
 *   node src/scripts/auditJobPins.js --apply    -> đánh dấu locationNeedsReview cho tin còn hiển thị có ghim đáng ngờ (không đổi tọa độ)
 *
 * Ghim đáng ngờ: tọa độ ngoài phạm vi hợp lệ, hoán đổi lat/lng, trùng điểm mặc định (trung tâm Hòa Lạc)
 * nhưng đang ở trạng thái đã xác nhận, hoặc cách trung tâm Hòa Lạc quá xa (nền tảng chỉ phục vụ khu vực Hòa Lạc).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { isValidCoordinate, calculateHaversineDistanceMeters } from '../utils/geoHelper.js';

const APPLY = process.argv.includes('--apply');
const DEFAULT_CENTER = { lat: 21.0128, lng: 105.5255 };
const DEFAULT_RADIUS_M = 30;
const HOALAC_MAX_KM = 25; // ghim xa trung tâm Hòa Lạc hơn mức này là nghi sai

function diagnose(job) {
  const { lat, lng } = job.location || {};
  if (!isValidCoordinate(lat, lng)) return job.locationStatus === 'confirmed' ? 'confirmed_but_no_coordinates' : null;
  if (job.locationStatus !== 'confirmed') return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  // Việt Nam: vĩ độ ~8–24, kinh độ ~102–110. Hoán đổi thì lat ~105, lng ~21 (không hợp lệ làm lat) hoặc ngoài khoảng.
  if (nLat < 5 || nLat > 25 || nLng < 100 || nLng > 112) return 'outside_vietnam_or_swapped';
  const toDefault = calculateHaversineDistanceMeters(nLat, nLng, DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
  if (toDefault !== null && toDefault <= DEFAULT_RADIUS_M) return 'default_center_pin';
  if (toDefault !== null && toDefault > HOALAC_MAX_KM * 1000) return 'far_from_hoalac';
  return null;
}

await mongoose.connect(process.env.MONGO_URI);
const jobs = await Job.find({ 'location.lat': { $ne: null } }).select('title storeName area address location locationStatus locationNeedsReview status').lean();
const flagged = [];
for (const job of jobs) {
  const reason = diagnose(job);
  if (reason) flagged.push({ id: String(job._id), title: job.title, store: job.storeName, status: job.status, area: job.area, lat: job.location.lat, lng: job.location.lng, reason });
}
console.log(`Tổng tin có tọa độ: ${jobs.length}; nghi ghim sai: ${flagged.length}`);
console.table(flagged);

const live = flagged.filter((f) => ['pending', 'approved'].includes(f.status));
if (APPLY && live.length) {
  const res = await Job.updateMany({ _id: { $in: live.map((f) => f.id) } }, { $set: { locationNeedsReview: true } });
  console.log(`Đã đánh dấu cần ghim lại cho ${res.modifiedCount} tin đang hiển thị / chờ duyệt (không đổi tọa độ).`);
} else if (!APPLY) {
  console.log('Chạy lại với --apply để áp dụng.');
}
await mongoose.disconnect();

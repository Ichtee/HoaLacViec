/** Chỉ đọc: tìm tin có điểm ghim không có đường bộ tới (Vietmap Matrix trả -1) từ trung tâm Hòa Lạc. */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { vietmapMatrix } from '../services/vietmapService.js';

await mongoose.connect(process.env.MONGO_URI);
const jobs = await Job.find({ 'location.lat': { $ne: null } }).select('title address status locationStatus location approxLocation').lean();
const origin = { lat: 21.0136, lng: 105.5253 };
const rows = [];
for (let i = 0; i < jobs.length; i += 10) {
  const batch = jobs.slice(i, i + 10);
  const res = await vietmapMatrix({ origins: [origin], destinations: batch.map((j) => ({ lat: j.location.lat, lng: j.location.lng })) });
  if (!res.success) { console.log('Vietmap lỗi:', res.error); break; }
  batch.forEach((j, k) => rows.push({ id: String(j._id), title: j.title.slice(0, 28), status: j.status, loc: j.locationStatus, lat: j.location.lat, lng: j.location.lng, meters: res.distances[0][k], address: (j.address || '').slice(0, 45) }));
}
console.table(rows);
await mongoose.disconnect();

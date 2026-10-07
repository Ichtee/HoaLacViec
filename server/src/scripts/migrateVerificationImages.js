import 'dotenv/config';
import mongoose from 'mongoose';
import { StudentProfile } from '../models/StudentProfile.js';
import { EmployerVerification } from '../models/EmployerVerification.js';
import { persistImage, isDataUri, isImageStorageConfigured } from '../services/imageStorageService.js';

// Chuyển ảnh xác minh đang lưu dạng base64 trong MongoDB sang Cloudinary.
// Dry-run theo mặc định (chỉ đếm). Cần CLOUDINARY_* và --apply để thực hiện.
// Mỗi ảnh được thay thế riêng lẻ, chạy lại an toàn: ảnh đã là URL sẽ bị bỏ qua.
const apply = process.argv.includes('--apply');
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error('Thiếu MONGO_URI hoặc MONGODB_URI.');
if (apply && !isImageStorageConfigured()) {
  throw new Error('Thiếu CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.');
}

const PROFILE_FIELDS = [
  ['studentCardPhoto', 'student-cards'],
  ['idCardFrontPhoto', 'id-cards'],
  ['idCardBackPhoto', 'id-cards'],
];

let found = 0;
let moved = 0;
let failed = 0;

async function migrate(value, folder) {
  found++;
  if (!apply) return value;
  try {
    const url = await persistImage(value, { folder });
    moved++;
    return url;
  } catch (err) {
    failed++;
    process.stdout.write(`  Lỗi: ${err.message}\n`);
    return value;
  }
}

await mongoose.connect(mongoUri);
try {
  for await (const profile of StudentProfile.find().cursor()) {
    for (const [field, folder] of PROFILE_FIELDS) {
      if (!isDataUri(profile[field])) continue;
      process.stdout.write(`${apply ? 'APPLY' : 'CHECK'} StudentProfile ${profile._id} ${field}\n`);
      const next = await migrate(profile[field], folder);
      if (apply && next !== profile[field]) {
        await StudentProfile.updateOne({ _id: profile._id, [field]: profile[field] }, { $set: { [field]: next } });
      }
    }
  }

  for await (const verification of EmployerVerification.find().cursor()) {
    const documents = verification.documents || [];
    let changed = false;
    for (const doc of documents) {
      if (!isDataUri(doc.url)) continue;
      process.stdout.write(`${apply ? 'APPLY' : 'CHECK'} EmployerVerification ${verification._id} document\n`);
      const next = await migrate(doc.url, 'employer-docs');
      if (apply && next !== doc.url) {
        doc.url = next;
        changed = true;
      }
    }
    if (changed) await verification.save();
  }

  process.stdout.write(`Tìm thấy ${found} ảnh base64. ${apply ? `Đã chuyển ${moved}, lỗi ${failed}.` : 'Chưa thay đổi dữ liệu (thêm --apply để chuyển).'}\n`);
} finally {
  await mongoose.disconnect();
}

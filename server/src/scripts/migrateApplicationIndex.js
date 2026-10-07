import 'dotenv/config';
import mongoose from 'mongoose';
import { Application, INACTIVE_APPLICATION_STATUSES } from '../models/Application.js';

// Cho phép nộp lại đơn sau khi rút/bị từ chối:
//  1. Gán isActive cho các đơn cũ (đơn kết thúc -> false, còn lại -> true).
//  2. Gỡ unique index cũ (studentId_1_jobId_1) và tạo partial unique index mới.
// Dry-run theo mặc định; chỉ thay đổi dữ liệu khi có --apply.
const apply = process.argv.includes('--apply');
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error('Thiếu MONGO_URI hoặc MONGODB_URI.');

const OLD_INDEX = 'studentId_1_jobId_1';

await mongoose.connect(mongoUri);
try {
  const collection = Application.collection;
  const indexes = await collection.indexes();
  const oldIndex = indexes.find((i) => i.name === OLD_INDEX && i.unique);
  const missing = await Application.countDocuments({ isActive: { $exists: false } });
  const inactive = await Application.countDocuments({
    isActive: { $exists: false },
    status: { $in: INACTIVE_APPLICATION_STATUSES },
  });

  process.stdout.write(`Đơn chưa có isActive: ${missing} (trong đó ${inactive} đơn đã kết thúc).\n`);
  process.stdout.write(`Unique index cũ ${OLD_INDEX}: ${oldIndex ? 'còn' : 'không có'}.\n`);

  if (!apply) {
    process.stdout.write('Chưa thay đổi dữ liệu. Chạy lại với --apply để áp dụng.\n');
  } else {
    await Application.updateMany(
      { isActive: { $exists: false }, status: { $in: INACTIVE_APPLICATION_STATUSES } },
      { $set: { isActive: false } }
    );
    await Application.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
    if (oldIndex) await collection.dropIndex(OLD_INDEX);
    await Application.syncIndexes();
    process.stdout.write('Đã cập nhật isActive và đồng bộ index.\n');
  }
} finally {
  await mongoose.disconnect();
}

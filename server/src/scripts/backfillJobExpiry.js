import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { LISTING_DAYS } from '../config/credits.js';

/** Tin đã duyệt/tạm dừng chưa có closesAt -> closesAt = now + LISTING_DAYS. Dry-run theo mặc định; thêm --apply để ghi. */
export async function backfillJobExpiry({ apply = false, now = new Date(), log = () => {} } = {}) {
  const filter = { status: { $in: ['approved', 'paused'] }, closesAt: null };
  const matched = await Job.countDocuments(filter);
  let updated = 0;
  if (apply && matched) {
    const r = await Job.updateMany(filter, { $set: { closesAt: new Date(now.getTime() + LISTING_DAYS * 86400000) } });
    updated = r.modifiedCount || 0;
  }
  log(`matched=${matched} updated=${updated} apply=${apply}`);
  return { matched, updated };
}

// CLI: node src/scripts/backfillJobExpiry.js [--apply]
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/backfillJobExpiry.js')) {
  const apply = process.argv.includes('--apply');
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('Thiếu MONGO_URI hoặc MONGODB_URI.');
  await mongoose.connect(mongoUri);
  try {
    const result = await backfillJobExpiry({ apply, log: (text) => process.stdout.write(`${text}\n`) });
    process.stdout.write(apply
      ? `Đã cập nhật ${result.updated} tin.\n`
      : `Có ${result.matched} tin sẽ được cập nhật. Chưa thay đổi dữ liệu (thêm --apply để ghi).\n`);
  } finally {
    await mongoose.disconnect();
  }
}

import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';

// Legacy jobs sometimes kept slots > 0 while remainingOpenings stayed at its default 1.
// Dry-run by default. Apply only after reviewing the printed candidates.
const apply = process.argv.includes('--apply');
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error('Thiếu MONGO_URI hoặc MONGODB_URI.');

let reviewed = 0;
let changed = 0;
await mongoose.connect(mongoUri);
try {
  for await (const job of Job.find().select('_id title slots hiredCount headcountTarget remainingOpenings recruitmentStatus status').lean().cursor()) {
    reviewed++;
    const slots = Number(job.slots);
    const hired = Number(job.hiredCount);
    if (!Number.isInteger(slots) || slots < 0 || !Number.isInteger(hired) || hired < 0) continue;
    const headcountTarget = hired + slots;
    if (headcountTarget < 1 ||
        (job.headcountTarget === headcountTarget && job.remainingOpenings === slots)) continue;
    changed++;
    const patch = { headcountTarget, remainingOpenings: slots };
    if (job.recruitmentStatus === 'filled' && slots > 0 && job.status === 'approved') {
      patch.recruitmentStatus = 'open';
    }
    process.stdout.write(`${apply ? 'APPLY' : 'CHECK'} ${job._id} ${job.title}: ${JSON.stringify(patch)}\n`);
    if (apply) {
      await Job.updateOne(
        { _id: job._id, slots: job.slots, hiredCount: job.hiredCount },
        { $set: patch }
      );
    }
  }
  process.stdout.write(`Đã xem ${reviewed} tin; ${changed} tin cần đồng bộ. ${apply ? 'Đã áp dụng.' : 'Chưa thay đổi dữ liệu.'}\n`);
} finally {
  await mongoose.disconnect();
}

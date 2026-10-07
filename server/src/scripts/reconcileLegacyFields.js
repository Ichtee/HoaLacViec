import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { Shift } from '../models/Shift.js';
import { User } from '../models/User.js';
import { EmployerProfile } from '../models/EmployerProfile.js';
import { migrateLegacyStatusToCanonical } from '../domain/shiftLifecycle.js';

/**
 * Đối chiếu và (tùy chọn) backfill các trường cũ sang trường chuẩn:
 *   Job.employerId (profile hoặc user)  -> employerUserId / employerProfileId
 *   Application.employerId              -> employerUserId
 *   Application.status 'pending'/'reviewing' -> 'submitted'/'screening'
 *   Shift.employerId / studentId / employeeUserId -> employerUserId / studentUserId
 *   Shift.status (cũ)                   -> scheduleStatus/assignmentStatus/attendanceStatus/payrollStatus
 *
 * Chỉ BỔ SUNG trường còn thiếu, không xóa trường cũ và không ghi đè giá trị đã có.
 * Các bản ghi không xác định được chủ sở hữu hoặc có trạng thái cũ mơ hồ ('approved',
 * 'accepted') chỉ được báo cáo để xử lý tay.
 * Dry-run theo mặc định; thêm --apply để ghi.
 */
const STATUS_RENAMES = { pending: 'submitted', reviewing: 'screening' };

async function resolveUserId(id, cache) {
  if (!id) return null;
  const key = String(id);
  if (cache.has(key)) return cache.get(key);
  let userId = null;
  if (await User.exists({ _id: id })) userId = id;
  else {
    const profile = await EmployerProfile.findById(id).select('userId').lean();
    userId = profile?.userId || null;
  }
  cache.set(key, userId);
  return userId;
}

export async function reconcileLegacyFields({ apply = false, log = () => {} } = {}) {
  const userCache = new Map();
  const report = {
    jobs: { scanned: 0, fixable: 0, unresolved: [] },
    applications: { scanned: 0, fixable: 0, statusRenamed: 0, unresolved: [], ambiguousStatus: {} },
    shifts: { scanned: 0, fixable: 0, statusBackfilled: 0, unresolved: [] },
  };

  // --- Jobs ---
  const jobOps = [];
  for await (const job of Job.collection.find({}, { projection: { employerUserId: 1, employerProfileId: 1, employerId: 1 } })) {
    report.jobs.scanned++;
    const set = {};
    if (!job.employerUserId) {
      const userId = await resolveUserId(job.employerProfileId || job.employerId, userCache);
      if (userId) set.employerUserId = userId;
      else report.jobs.unresolved.push(String(job._id));
    }
    const ownerUserId = job.employerUserId || set.employerUserId;
    if (!job.employerProfileId && ownerUserId) {
      const profile = await EmployerProfile.findOne({ userId: ownerUserId }).select('_id').lean();
      if (profile) set.employerProfileId = profile._id;
    }
    if (Object.keys(set).length) {
      report.jobs.fixable++;
      jobOps.push({ updateOne: { filter: { _id: job._id }, update: { $set: set } } });
    }
  }

  // --- Applications ---
  const appOps = [];
  const jobOwner = new Map();
  for await (const app of Application.collection.find({}, { projection: { employerUserId: 1, employerId: 1, jobId: 1, status: 1 } })) {
    report.applications.scanned++;
    const set = {};
    if (!app.employerUserId) {
      let userId = await resolveUserId(app.employerId, userCache);
      if (!userId && app.jobId) {
        const key = String(app.jobId);
        if (!jobOwner.has(key)) {
          const job = await Job.collection.findOne({ _id: app.jobId }, { projection: { employerUserId: 1, employerProfileId: 1, employerId: 1 } });
          jobOwner.set(key, job ? (job.employerUserId || await resolveUserId(job.employerProfileId || job.employerId, userCache)) : null);
        }
        userId = jobOwner.get(key);
      }
      if (userId) set.employerUserId = userId;
      else report.applications.unresolved.push(String(app._id));
    }
    if (STATUS_RENAMES[app.status]) {
      set.status = STATUS_RENAMES[app.status];
      report.applications.statusRenamed++;
    } else if (app.status === 'approved' || app.status === 'accepted') {
      report.applications.ambiguousStatus[app.status] = (report.applications.ambiguousStatus[app.status] || 0) + 1;
    }
    if (Object.keys(set).length) {
      report.applications.fixable++;
      appOps.push({ updateOne: { filter: { _id: app._id }, update: { $set: set } } });
    }
  }

  // --- Shifts ---
  const shiftOps = [];
  for await (const shift of Shift.collection.find({})) {
    report.shifts.scanned++;
    const set = {};
    const employer = shift.employerUserId || (await resolveUserId(shift.employerId, userCache));
    if (!shift.employerUserId) {
      if (employer) set.employerUserId = employer;
      else report.shifts.unresolved.push(String(shift._id));
    }
    const worker = shift.studentUserId || shift.employeeUserId || shift.studentId;
    if (!shift.studentUserId && worker) set.studentUserId = worker;
    if (!shift.employeeUserId && worker) set.employeeUserId = worker;

    if (!shift.scheduleStatus || !shift.attendanceStatus || !shift.payrollStatus || !shift.assignmentStatus) {
      const canonical = migrateLegacyStatusToCanonical(shift.status);
      for (const [key, value] of Object.entries(canonical)) if (!shift[key]) set[key] = value;
      report.shifts.statusBackfilled++;
    }
    if (Object.keys(set).length) {
      report.shifts.fixable++;
      shiftOps.push({ updateOne: { filter: { _id: shift._id }, update: { $set: set } } });
    }
  }

  log(JSON.stringify(report, null, 2));
  if (apply) {
    // Ghi qua collection thô để tránh hook validate đổi thêm trường (ví dụ status cũ tự tính lại)
    if (jobOps.length) await Job.collection.bulkWrite(jobOps, { ordered: false });
    if (appOps.length) await Application.collection.bulkWrite(appOps, { ordered: false });
    if (shiftOps.length) await Shift.collection.bulkWrite(shiftOps, { ordered: false });
  }
  return { ...report, applied: apply };
}

// CLI: node src/scripts/reconcileLegacyFields.js [--apply]
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/reconcileLegacyFields.js')) {
  const apply = process.argv.includes('--apply');
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('Thiếu MONGO_URI hoặc MONGODB_URI.');
  await mongoose.connect(mongoUri);
  try {
    const result = await reconcileLegacyFields({ apply, log: (text) => process.stdout.write(`${text}\n`) });
    const total = result.jobs.fixable + result.applications.fixable + result.shifts.fixable;
    process.stdout.write(apply
      ? `Đã bổ sung trường chuẩn cho ${total} bản ghi.\n`
      : `Có ${total} bản ghi cần bổ sung. Chưa thay đổi dữ liệu (thêm --apply để ghi).\n`);
  } finally {
    await mongoose.disconnect();
  }
}

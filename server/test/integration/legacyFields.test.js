/**
 * Kiểm chứng script đối chiếu trường cũ trên dữ liệu "kiểu cũ" thật (chèn thẳng vào collection,
 * bỏ qua default/hook của Mongoose), trên MongoDB trong bộ nhớ.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startTestServer, createUser, createApprovedJob } from '../e2e/testServer.mjs';
import { reconcileLegacyFields } from '../../src/scripts/reconcileLegacyFields.js';

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.stop(); });

test('dry-run reports legacy gaps without writing; --apply backfills only what is missing', async () => {
  const m = t.models;
  const employer = await createUser(m, { role: 'employer' });
  const student = await createUser(m, { role: 'student' });
  const profile = await m.EmployerProfile.findOne({ userId: employer._id });
  const col = (name) => mongoose.connection.collection(name);

  // Tin cũ: chỉ có employerId trỏ tới EmployerProfile (không có employerUserId)
  const legacyJob = await createApprovedJob(m, employer);
  await col('jobs').updateOne({ _id: legacyJob._id }, { $unset: { employerUserId: '', employerProfileId: '' }, $set: { employerId: profile._id } });
  // Tin cũ không xác định được chủ sở hữu
  const orphanJob = await createApprovedJob(m, employer);
  await col('jobs').updateOne({ _id: orphanJob._id }, { $unset: { employerUserId: '', employerProfileId: '' }, $set: { employerId: new mongoose.Types.ObjectId() } });
  // Tin đã đầy đủ: không được đụng tới
  const modernJob = await createApprovedJob(m, employer);

  // Đơn cũ: trạng thái 'pending', employerId là profile, không có employerUserId
  const insert = async (name, doc) => (await col(name).insertOne(doc)).insertedId;
  const pendingApp = await insert('applications', {
    studentId: student._id, studentName: 'SV', jobId: legacyJob._id, employerId: profile._id, status: 'pending',
    createdAt: new Date(), updatedAt: new Date(),
  });
  const approvedApp = await insert('applications', {
    studentId: student._id, studentName: 'SV', jobId: modernJob._id, employerUserId: employer._id, status: 'approved',
    createdAt: new Date(), updatedAt: new Date(),
  });

  // Ca cũ: chỉ có status 'checked_in', employerId/studentId, không có các trường canonical
  const legacyShift = await insert('shifts', {
    employerId: employer._id, studentId: student._id, date: '2026-10-01', startTime: '09:00', endTime: '13:00',
    startAt: new Date('2026-10-01T02:00:00Z'), endAt: new Date('2026-10-01T06:00:00Z'), status: 'checked_in',
    createdAt: new Date(), updatedAt: new Date(),
  });

  const lines = [];
  const dry = await reconcileLegacyFields({ apply: false, log: (l) => lines.push(l) });
  assert.equal(dry.applied, false);
  // Cần bổ sung: tin cũ (employerUserId + employerProfileId) và tin mới thiếu liên kết employerProfileId.
  // Tin mồ côi không xác định được chủ nên không được sửa.
  assert.equal(dry.jobs.fixable, 2);
  assert.deepEqual(dry.jobs.unresolved, [String(orphanJob._id)]);
  assert.equal(dry.applications.statusRenamed, 1);
  assert.deepEqual(dry.applications.ambiguousStatus, { approved: 1 });
  assert.equal(dry.shifts.statusBackfilled, 1);

  // Dry-run không thay đổi dữ liệu
  assert.equal((await col('jobs').findOne({ _id: legacyJob._id })).employerUserId, undefined);
  assert.equal((await col('applications').findOne({ _id: pendingApp })).status, 'pending');
  assert.equal((await col('shifts').findOne({ _id: legacyShift })).scheduleStatus, undefined);

  await reconcileLegacyFields({ apply: true });

  const job = await col('jobs').findOne({ _id: legacyJob._id });
  assert.equal(String(job.employerUserId), String(employer._id));
  assert.equal(String(job.employerProfileId), String(profile._id));
  assert.equal(String(job.employerId), String(profile._id), 'legacy field is kept, never removed');
  const orphan = await col('jobs').findOne({ _id: orphanJob._id });
  assert.equal(orphan.employerUserId, undefined, 'unresolved owner left for manual review');
  assert.equal(orphan.employerProfileId, undefined, 'never links an unrelated profile');
  assert.equal(String((await col('jobs').findOne({ _id: modernJob._id })).employerProfileId), String(profile._id));

  const app = await col('applications').findOne({ _id: pendingApp });
  assert.equal(app.status, 'submitted');
  assert.equal(String(app.employerUserId), String(employer._id));
  assert.equal((await col('applications').findOne({ _id: approvedApp })).status, 'approved', 'ambiguous legacy status is not guessed');

  const shift = await col('shifts').findOne({ _id: legacyShift });
  assert.equal(String(shift.employerUserId), String(employer._id));
  assert.equal(String(shift.studentUserId), String(student._id));
  assert.equal(shift.attendanceStatus, 'checked_in');
  assert.equal(shift.scheduleStatus, 'published');
  assert.equal(shift.status, 'checked_in', 'legacy status untouched');

  // Chạy lại là no-op (idempotent)
  const again = await reconcileLegacyFields({ apply: true });
  assert.equal(again.jobs.fixable, 0);
  assert.equal(again.applications.fixable, 0);
  assert.equal(again.shifts.fixable, 0);
});

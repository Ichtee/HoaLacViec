import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { User } from '../src/models/User.js';
import { Shift } from '../src/models/Shift.js';
import { Review } from '../src/models/Review.js';
import { StudentProfile } from '../src/models/StudentProfile.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { Notification } from '../src/models/Notification.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-two-way-reviews';
const { default: app } = await import('../src/app.js');

test('employer reviews the worker of an approved shift (two-way reviews)', async (t) => {
  const studentId = '507f1f77bcf86cd799439031';
  const employerId = '507f1f77bcf86cd799439032';
  const otherEmployerId = '507f1f77bcf86cd799439033';
  const shiftId = '507f1f77bcf86cd799439034';
  const originals = {
    userFindById: User.findById, shiftFindById: Shift.findById, studentUpdate: StudentProfile.findOneAndUpdate,
    employerUpdate: EmployerProfile.findOneAndUpdate, reviewFindOne: Review.findOne, reviewCreate: Review.create,
    reviewAggregate: Review.aggregate, notificationCreate: Notification.create,
  };
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    User.findById = originals.userFindById; Shift.findById = originals.shiftFindById;
    StudentProfile.findOneAndUpdate = originals.studentUpdate; EmployerProfile.findOneAndUpdate = originals.employerUpdate;
    Review.findOne = originals.reviewFindOne; Review.create = originals.reviewCreate;
    Review.aggregate = originals.reviewAggregate; Notification.create = originals.notificationCreate;
    await new Promise((resolve) => server.close(resolve));
  });

  let actor = { _id: employerId, name: 'Chủ quán', role: 'employer', status: 'active', tokenVersion: 0 };
  let shift = {
    _id: shiftId, studentUserId: studentId, employerUserId: employerId, storeName: 'Quán A',
    attendanceStatus: 'approved', payrollStatus: 'paid',
  };
  let created = null;
  let studentSync = null;
  let employerSync = null;
  let notification = null;
  User.findById = async () => actor;
  Shift.findById = async () => shift;
  Review.findOne = async () => null;
  Review.create = async (data) => { created = data; return { ...data, toObject: () => data }; };
  Review.aggregate = async () => [{ averageRating: 4.5, totalReviews: 2 }];
  StudentProfile.findOneAndUpdate = async (filter, update) => { studentSync = { filter, update }; };
  EmployerProfile.findOneAndUpdate = async (filter, update) => { employerSync = { filter, update }; };
  Notification.create = async (n) => { notification = n; return n; };

  const call = async (body) => {
    const token = jwt.sign({ id: actor._id, tokenVersion: 0 }, process.env.JWT_SECRET);
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reviews`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionType: 'shift', transactionId: shiftId, rating: 5, ...body }),
    });
    return { status: response.status, body: await response.json() };
  };

  // Target and store cannot be spoofed; reputation lands on the worker's StudentProfile
  const ok = await call({ targetId: otherEmployerId, criteria: { punctuality: 5, attitude: 4, skill: 3 }, comment: 'Làm tốt' });
  assert.equal(ok.status, 201);
  assert.equal(String(created.targetId), studentId);
  assert.equal(created.reviewerRole, 'employer');
  assert.equal(created.criteria.punctuality, 5);
  assert.equal(String(studentSync.filter.userId), studentId);
  assert.deepEqual(studentSync.update.$set, { reputationScore: 4.5, reputationCount: 2 });
  assert.equal(employerSync, null);
  assert.equal(String(notification.userId), studentId);
  assert.equal(notification.link, '/student/reviews');

  // Store-side criteria are rejected for an employer reviewer
  assert.equal((await call({ criteria: { payment: 5 } })).body.code, 'INVALID_CRITERIA');

  // Another employer (not the shift owner) is forbidden
  actor = { ...actor, _id: otherEmployerId };
  assert.equal((await call({})).body.code, 'FORBIDDEN');
  actor = { ...actor, _id: employerId };

  // Unapproved shift cannot be reviewed
  shift = { ...shift, attendanceStatus: 'checked_out' };
  assert.equal((await call({})).body.code, 'SHIFT_NOT_COMPLETED');
});

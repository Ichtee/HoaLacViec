import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { User } from '../src/models/User.js';
import { Shift } from '../src/models/Shift.js';
import { Review } from '../src/models/Review.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { Notification } from '../src/models/Notification.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-store-reviews';
const { default: app } = await import('../src/app.js');

test('student reviews the store of an approved shift', async (t) => {
  const studentId = '507f1f77bcf86cd799439011';
  const employerId = '507f1f77bcf86cd799439012';
  const otherId = '507f1f77bcf86cd799439013';
  const shiftId = '507f1f77bcf86cd799439014';
  const originals = {
    userFindById: User.findById, shiftFindById: Shift.findById,
    profileFindOne: EmployerProfile.findOne, profileUpdate: EmployerProfile.findOneAndUpdate,
    reviewFindOne: Review.findOne, reviewFind: Review.find, reviewCreate: Review.create,
    reviewAggregate: Review.aggregate, notificationCreate: Notification.create,
  };
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    User.findById = originals.userFindById;
    Shift.findById = originals.shiftFindById;
    EmployerProfile.findOne = originals.profileFindOne;
    EmployerProfile.findOneAndUpdate = originals.profileUpdate;
    Review.findOne = originals.reviewFindOne;
    Review.find = originals.reviewFind;
    Review.create = originals.reviewCreate;
    Review.aggregate = originals.reviewAggregate;
    Notification.create = originals.notificationCreate;
    await new Promise((resolve) => server.close(resolve));
  });

  let actor = { _id: studentId, name: 'Sinh viên', role: 'student', status: 'active', tokenVersion: 0 };
  let shift = { _id: shiftId, studentUserId: studentId, employerUserId: employerId,
    storeName: 'Cửa hàng A', attendanceStatus: 'approved', status: 'paid', payrollStatus: 'paid' };
  let existing = null;
  let created = null;
  let synced = null;
  User.findById = async () => actor;
  Shift.findById = async () => shift;
  EmployerProfile.findOne = async () => ({ userId: employerId, storeName: 'Cửa hàng A' });
  EmployerProfile.findOneAndUpdate = async (filter, update) => { synced = { filter, update }; };
  Review.findOne = async () => existing;
  Review.create = async (data) => { created = data; return { ...data, _id: otherId, toObject: () => ({ ...data, _id: otherId }) }; };
  Review.aggregate = async () => [{ averageRating: 4, totalReviews: 1 }];
  Notification.create = async () => ({});

  const call = async (body) => {
    const token = jwt.sign({ id: actor._id, tokenVersion: 0 }, process.env.JWT_SECRET);
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reviews`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionType: 'shift', transactionId: shiftId, rating: 4, ...body }),
    });
    return { status: response.status, body: await response.json() };
  };

  const success = await call({ targetId: otherId, storeName: 'Giả mạo', criteria: { jobAccuracy: 5, payment: 4 } });
  assert.equal(success.status, 201);
  assert.equal(String(created.targetId), employerId);
  assert.equal(created.storeName, 'Cửa hàng A');
  assert.equal(created.criteria.payment, 4);
  assert.equal(String(synced.filter.userId), employerId);
  assert.equal(synced.update.$set.rating, 4);

  Review.find = () => {
    const query = {
      sort: () => query,
      lean: async () => [{ _id: otherId, reviewerId: studentId, targetId: employerId,
        storeName: 'Cửa hàng A', transactionType: 'shift', rating: 4, type: 'received' }],
    };
    return query;
  };
  const listing = await fetch(`http://127.0.0.1:${server.address().port}/api/reviews?studentId=${studentId}`);
  assert.equal((await listing.json())[0].type, 'given');

  existing = { _id: otherId };
  assert.equal((await call({})).body.code, 'DUPLICATE_REVIEW');
  existing = null;
  actor = { ...actor, _id: otherId };
  assert.equal((await call({})).body.code, 'FORBIDDEN');
  actor = { ...actor, _id: studentId };
  shift = { ...shift, payrollStatus: 'not_ready' };
  assert.equal((await call({ criteria: { payment: 5 } })).body.code, 'INVALID_CRITERIA');
});

test('store comment is optional while task comment remains required', () => {
  const studentId = '507f1f77bcf86cd799439011';
  const employerId = '507f1f77bcf86cd799439012';
  const fields = { reviewerId: studentId, reviewerName: 'Sinh viên', reviewerRole: 'student',
    targetId: employerId, rating: 4 };
  assert.equal(new Review({ ...fields, transactionType: 'shift', comment: '' }).validateSync(), undefined);
  assert.ok(new Review({ ...fields, transactionType: 'task', comment: '' }).validateSync()?.errors?.comment);
});

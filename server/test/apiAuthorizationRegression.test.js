import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Application } from '../src/models/Application.js';
import { Employment } from '../src/models/Employment.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { Job } from '../src/models/Job.js';
import { Shift } from '../src/models/Shift.js';
import { TimeOffRequest } from '../src/models/TimeOffRequest.js';
import { Notification } from '../src/models/Notification.js';
import { createResetToken } from '../src/services/passwordResetService.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-only-for-api-regression';
const { default: app } = await import('../src/app.js');

const candidateId = '507f1f77bcf86cd799439011';
const otherCandidateId = '507f1f77bcf86cd799439012';
const employerId = '507f1f77bcf86cd799439013';
const otherEmployerId = '507f1f77bcf86cd799439014';
const applicationId = '507f1f77bcf86cd799439015';
const shiftId = '507f1f77bcf86cd799439016';

function chain(result, terminal = 'lean') {
  const query = { populate: () => query, sort: () => query, lean: async () => result };
  if (terminal === 'sort') query.sort = async () => result;
  return query;
}

test('API authorization regression: roles, ownership and private application fields', async (t) => {
  const originals = {
    userFindById: User.findById,
    userFindOneAndUpdate: User.findOneAndUpdate,
    applicationFind: Application.find,
    applicationFindById: Application.findById,
    applicationFindOne: Application.findOne,
    applicationCreate: Application.create,
    employmentFind: Employment.find,
    employerProfileFindOne: EmployerProfile.findOne,
    jobFindById: Job.findById,
    jobCreate: Job.create,
    shiftFind: Shift.find,
    shiftFindById: Shift.findById,
    shiftFindByIdAndDelete: Shift.findByIdAndDelete,
    timeOffFindById: TimeOffRequest.findById,
    timeOffFindOne: TimeOffRequest.findOne,
    timeOffFindOneAndUpdate: TimeOffRequest.findOneAndUpdate,
    notificationCreate: Notification.create,
    startSession: mongoose.startSession,
  };
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    User.findById = originals.userFindById;
    User.findOneAndUpdate = originals.userFindOneAndUpdate;
    Application.find = originals.applicationFind;
    Application.findById = originals.applicationFindById;
    Application.findOne = originals.applicationFindOne;
    Application.create = originals.applicationCreate;
    Employment.find = originals.employmentFind;
    EmployerProfile.findOne = originals.employerProfileFindOne;
    Job.findById = originals.jobFindById;
    Job.create = originals.jobCreate;
    Shift.find = originals.shiftFind;
    Shift.findById = originals.shiftFindById;
    Shift.findByIdAndDelete = originals.shiftFindByIdAndDelete;
    TimeOffRequest.findById = originals.timeOffFindById;
    TimeOffRequest.findOne = originals.timeOffFindOne;
    TimeOffRequest.findOneAndUpdate = originals.timeOffFindOneAndUpdate;
    Notification.create = originals.notificationCreate;
    mongoose.startSession = originals.startSession;
    await new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let actor = { _id: candidateId, role: 'worker', status: 'active', tokenVersion: 0 };
  User.findById = async () => actor;
  const token = () => jwt.sign({ id: actor._id, tokenVersion: 0 }, process.env.JWT_SECRET);
  const call = async (path, method = 'GET') => {
    const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token()}` } });
    return { status: response.status, body: await response.json() };
  };

  await t.test('worker sees only own applications and no internal history', async () => {
    let filter;
    Application.find = conditions => {
      filter = conditions;
      return chain([{ _id: applicationId, studentId: candidateId, status: 'submitted', internalNote: 'private', employerNote: 'private', statusHistory: [{ reason: 'private', note: 'private', candidateVisibleMessage: 'Đã nhận' }] }], 'sort');
    };
    const result = await call('/api/applications');
    assert.equal(result.status, 200);
    assert.equal(String(filter.studentId), candidateId);
    assert.equal(result.body[0].internalNote, undefined);
    assert.equal(result.body[0].employerNote, undefined);
    assert.equal(result.body[0].statusHistory[0].reason, undefined);
  });

  await t.test('worker cannot read another applicant by ID', async () => {
    Application.findById = () => chain({ _id: applicationId, studentId: { _id: otherCandidateId }, jobId: {}, internalNote: 'private' });
    const result = await call(`/api/applications/${applicationId}`);
    assert.equal(result.status, 403);
  });

  await t.test('unrelated employer cannot read application by ID', async () => {
    actor = { _id: otherEmployerId, role: 'employer', status: 'active', tokenVersion: 0 };
    EmployerProfile.findOne = async () => null;
    Job.findById = async () => ({ employerUserId: employerId });
    const result = await call(`/api/applications/${applicationId}`);
    assert.equal(result.status, 403);
  });

  await t.test('freelancer employment list is scoped to their own user ID', async () => {
    actor = { _id: candidateId, role: 'freelancer', status: 'active', tokenVersion: 0 };
    let filter;
    Employment.find = conditions => {
      filter = conditions;
      return chain([]);
    };
    const result = await call('/api/employments');
    assert.equal(result.status, 200);
    assert.equal(String(filter.employeeUserId), candidateId);
  });

  await t.test('employer cannot delete another employer draft shift', async () => {
    actor = { _id: otherEmployerId, role: 'employer', status: 'active', tokenVersion: 0 };
    let deleteCalls = 0;
    Shift.findById = async () => ({ _id: shiftId, employerUserId: employerId, scheduleStatus: 'draft' });
    Shift.findByIdAndDelete = async () => { deleteCalls++; };
    const result = await call(`/api/shifts/${shiftId}`, 'DELETE');
    assert.equal(result.status, 403);
    assert.equal(deleteCalls, 0);
  });

  await t.test('worker cannot override published-only shift filter with query parameter', async () => {
    actor = { _id: candidateId, role: 'worker', status: 'active', tokenVersion: 0 };
    let filter;
    Shift.find = conditions => {
      filter = conditions;
      return chain([]);
    };
    const result = await call('/api/shifts?scheduleStatus=draft');
    assert.equal(result.status, 200);
    assert.deepEqual(filter.scheduleStatus, { $in: ['published', 'cancelled'] });
  });

  await t.test('approving leave only searches shifts from that employer', async () => {
    actor = { _id: employerId, role: 'employer', status: 'active', tokenVersion: 0 };
    const leave = {
      _id: applicationId,
      employeeUserId: candidateId,
      employerUserId: employerId,
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 2 * 86400000),
      status: 'pending',
      reviewNote: '',
      toObject() { return { ...this }; },
    };
    TimeOffRequest.findById = async () => leave;
    TimeOffRequest.findOne = () => ({ session: async () => ({ ...leave, save: async () => {} }) });
    mongoose.startSession = async () => ({ withTransaction: async callback => callback(), endSession: async () => {} });
    Notification.create = async () => ({});
    let filter;
    Shift.find = conditions => {
      filter = conditions;
      return { session: async () => [] };
    };
    const response = await fetch(`${base}/api/time-off/${applicationId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', conflictingShiftAction: 'unassign' }),
    });
    assert.equal(response.status, 200);
    assert.equal(String(filter.employerUserId), employerId);
    assert.equal(String(filter.$or[0].employeeUserId), candidateId);
  });

  await t.test('repeated leave decision cannot approve twice', async () => {
    actor = { _id: employerId, role: 'employer', status: 'active', tokenVersion: 0 };
    TimeOffRequest.findById = async () => ({
      _id: applicationId,
      employeeUserId: candidateId,
      employerUserId: employerId,
      status: 'pending',
      reviewNote: '',
    });
    TimeOffRequest.findOneAndUpdate = async () => null;
    const response = await fetch(`${base}/api/time-off/${applicationId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', conflictingShiftAction: 'warn' }),
    });
    assert.equal(response.status, 409);
  });

  await t.test('employer cannot self-approve or set protected job fields', async () => {
    actor = { _id: employerId, role: 'employer', status: 'active', tokenVersion: 0 };
    EmployerProfile.findOne = async () => ({ _id: otherEmployerId, verified: true, storeName: 'Quán thử nghiệm' });
    let created;
    Job.create = async data => {
      created = data;
      return { _id: applicationId, ...data };
    };
    const response = await fetch(`${base}/api/jobs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Phục vụ', storeName: 'Quán', salaryAmount: 30000, slots: 3, status: 'approved', featured: true, hiredCount: 99, moderatedBy: otherEmployerId, address: 'Thôn 3, Thạch Hòa', location: { lat: 21.0201, lng: 105.5312 }, locationStatus: 'confirmed' }),
    });
    assert.equal(response.status, 201);
    assert.equal(created.status, 'pending');
    assert.equal(created.featured, undefined);
    assert.equal(created.hiredCount, 0);
    assert.equal(created.remainingOpenings, 3);
    assert.equal(String(created.employerUserId), employerId);
  });

  await t.test('employer cannot publish a job without a confirmed map location', async () => {
    actor = { _id: employerId, role: 'employer', status: 'active', tokenVersion: 0 };
    EmployerProfile.findOne = async () => ({ _id: otherEmployerId, verified: true, storeName: 'Quán thử nghiệm' });
    let createCalled = false;
    Job.create = async (data) => { createCalled = true; return { _id: applicationId, ...data }; };
    for (const extra of [{}, { address: 'Thôn 3', location: { lat: 21.02, lng: 105.53 }, locationStatus: 'pending_confirmation' }]) {
      const response = await fetch(`${base}/api/jobs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Phục vụ', storeName: 'Quán', salaryAmount: 30000, slots: 1, ...extra }),
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, 'LOCATION_REQUIRED');
    }
    assert.equal(createCalled, false);
  });

  await t.test('password reset token is consumed once and invalidates old sessions', async () => {
    const { token, tokenHash } = createResetToken();
    let consumed = false;
    const resetUser = { password: 'old', tokenVersion: 0, save: async () => {} };
    User.findOneAndUpdate = async filter => {
      assert.equal(filter.passwordResetTokenHash, tokenHash);
      if (consumed) return null;
      consumed = true;
      return resetUser;
    };
    const send = () => fetch(`${base}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'new-secret-password' }),
    });
    assert.equal((await send()).status, 200);
    assert.equal(resetUser.tokenVersion, 1);
    assert.equal((await send()).status, 400);
  });

  await t.test('active worker can apply for an approved job', async () => {
    actor = { _id: candidateId, role: 'worker', status: 'active', tokenVersion: 0, name: 'Người tìm việc', email: 'worker@example.test' };
    Job.findById = async () => ({ _id: applicationId, employerUserId: employerId, title: 'Phục vụ', status: 'approved', remainingOpenings: 1, slots: 1 });
    Application.findOne = async () => null;
    Application.create = async data => ({ _id: shiftId, toObject: () => data });
    Notification.create = async () => ({});
    const response = await fetch(`${base}/api/applications`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: applicationId }),
    });
    assert.equal(response.status, 201);
  });
});

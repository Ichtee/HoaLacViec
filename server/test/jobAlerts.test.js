import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { JobAlert } from '../src/models/JobAlert.js';
import { Notification } from '../src/models/Notification.js';
import { alertMatchesJob, notifyJobAlerts } from '../src/services/jobAlertService.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-job-alerts';
const { default: app } = await import('../src/app.js');

const job = {
  _id: 'j1', title: 'Nhân viên pha chế', storeName: 'Quán Cà Phê Hòa Lạc', description: 'Làm ca tối',
  category: 'cafe', area: 'fpt_university', type: 'shift', salaryAmount: 30000, employerUserId: 'emp1',
};

test('alert matching requires every set condition and ignores empty ones', () => {
  assert.equal(alertMatchesJob({ keyword: 'pha chế' }, job), true);
  assert.equal(alertMatchesJob({ keyword: 'PHA CHẾ', category: 'cafe', minSalary: 25000 }, job), true);
  assert.equal(alertMatchesJob({ keyword: 'gia sư' }, job), false);
  assert.equal(alertMatchesJob({ category: 'shipper' }, job), false);
  assert.equal(alertMatchesJob({ minSalary: 40000 }, job), false);
  assert.equal(alertMatchesJob({ type: 'event' }, job), false);
  assert.equal(alertMatchesJob({}, job), true);
});

test('notifyJobAlerts sends one notification per matching user', async (t) => {
  const originals = { find: JobAlert.find, notify: Notification.create };
  const stateDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  t.after(() => {
    JobAlert.find = originals.find; Notification.create = originals.notify;
    if (stateDescriptor) Object.defineProperty(mongoose.connection, 'readyState', stateDescriptor);
    else delete mongoose.connection.readyState;
  });

  let filter = null;
  JobAlert.find = (f) => { filter = f; return { limit: () => ({ lean: async () => [
    { userId: 'u1', keyword: 'pha chế' },
    { userId: 'u1', category: 'cafe' }, // same user, second match: ignored
    { userId: 'u2', keyword: 'gia sư' }, // no match
    { userId: 'u3', minSalary: 20000 },
  ] }) }; };
  const sent = [];
  Notification.create = async (n) => { sent.push(n); return n; };

  assert.equal(await notifyJobAlerts(job), 2);
  assert.deepEqual(sent.map((n) => n.userId), ['u1', 'u3']);
  assert.equal(sent[0].link, '/jobs/j1');
  assert.equal(filter.userId.$ne, 'emp1', 'the employer is never alerted about their own job');
});

test('job alert endpoints are limited to job seekers, validated, capped and owner-scoped', async (t) => {
  const originals = { userFindById: User.findById, count: JobAlert.countDocuments, create: JobAlert.create, del: JobAlert.findOneAndDelete };
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    User.findById = originals.userFindById; JobAlert.countDocuments = originals.count;
    JobAlert.create = originals.create; JobAlert.findOneAndDelete = originals.del;
    await new Promise((resolve) => server.close(resolve));
  });
  const studentId = '507f1f77bcf86cd799439071';
  const employerId = '507f1f77bcf86cd799439072';
  const users = {
    [studentId]: { _id: studentId, role: 'student', status: 'active', tokenVersion: 0 },
    [employerId]: { _id: employerId, role: 'employer', status: 'active', tokenVersion: 0 },
  };
  User.findById = async (id) => users[String(id)];
  let count = 0;
  JobAlert.countDocuments = async () => count;
  JobAlert.create = async (data) => data;
  let deleteFilter = null;
  JobAlert.findOneAndDelete = async (f) => { deleteFilter = f; return null; };

  const call = async (id, path = '', method = 'GET', body) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/job-alerts${path}`, {
      method,
      headers: { Authorization: `Bearer ${jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  assert.equal((await call(employerId, '', 'POST', { keyword: 'x' })).status, 403);
  assert.equal((await call(studentId, '', 'POST', {})).body.code, 'EMPTY_FILTER');
  assert.equal((await call(studentId, '', 'POST', { type: 'bogus' })).body.code, 'INVALID_FILTER');
  const created = await call(studentId, '', 'POST', { keyword: 'pha chế', minSalary: 25000 });
  assert.equal(created.status, 201);
  assert.equal(String(created.body.userId), studentId);
  count = 5;
  assert.equal((await call(studentId, '', 'POST', { keyword: 'khác' })).body.code, 'LIMIT_REACHED');
  assert.equal((await call(studentId, '/507f1f77bcf86cd799439073', 'DELETE')).status, 404);
  assert.equal(String(deleteFilter.userId), studentId);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { Employment } from '../src/models/Employment.js';
import { Shift } from '../src/models/Shift.js';
import { Application } from '../src/models/Application.js';
import { Message } from '../src/models/Message.js';
import { averageHoursToFirstHire, employerReturnRate } from '../src/services/metricsService.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-metrics';
const { default: app } = await import('../src/app.js');

test('pure metric helpers handle empty and invalid inputs', () => {
  assert.equal(averageHoursToFirstHire([]), null);
  assert.equal(averageHoursToFirstHire([
    { postedAt: '2026-10-01T00:00:00Z', firstHireAt: '2026-10-01T10:00:00Z' },
    { postedAt: '2026-10-01T00:00:00Z', firstHireAt: '2026-10-02T14:00:00Z' },
    { postedAt: '2026-10-05T00:00:00Z', firstHireAt: '2026-10-01T00:00:00Z' }, // hire before post: ignored
  ]), 24);
  assert.equal(employerReturnRate([]), null);
  assert.equal(employerReturnRate([1, 2, 3, 1]), 50);
});

test('GET /api/admin/metrics is admin-only and combines the aggregates', async (t) => {
  const originals = {
    userFindById: User.findById, empAgg: Employment.aggregate, jobAgg: Job.aggregate, jobDistinct: Job.distinct,
    shiftAgg: Shift.aggregate, appAgg: Application.aggregate, appDistinct: Application.distinct, msgDistinct: Message.distinct,
  };
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    User.findById = originals.userFindById; Employment.aggregate = originals.empAgg; Job.aggregate = originals.jobAgg;
    Job.distinct = originals.jobDistinct; Shift.aggregate = originals.shiftAgg; Application.aggregate = originals.appAgg;
    Application.distinct = originals.appDistinct; Message.distinct = originals.msgDistinct;
    await new Promise((resolve) => server.close(resolve));
  });

  const adminId = '507f1f77bcf86cd799439081';
  const employerId = '507f1f77bcf86cd799439082';
  const users = {
    [adminId]: { _id: adminId, role: 'admin', status: 'active', tokenVersion: 0 },
    [employerId]: { _id: employerId, role: 'employer', status: 'active', tokenVersion: 0 },
  };
  User.findById = async (id) => users[String(id)];
  Employment.aggregate = async () => [{ postedAt: '2026-10-01T00:00:00Z', firstHireAt: '2026-10-02T00:00:00Z' }];
  let jobCall = 0;
  Job.aggregate = async () => (jobCall++ === 0 ? [{ hired: 6, target: 8 }] : [{ jobs: 1 }, { jobs: 3 }]);
  Shift.aggregate = async () => [{ _id: 'approved', count: 18 }, { _id: 'no_show', count: 2 }, { _id: 'not_started', count: 5 }];
  Application.aggregate = async () => [{ _id: 'submitted', count: 4 }, { _id: 'hired', count: 6 }];
  Application.distinct = async () => ['s1', 's2'];
  Job.distinct = async () => ['e1'];
  Message.distinct = async () => ['s1', 'e1'];

  const get = (id) => fetch(`http://127.0.0.1:${server.address().port}/api/admin/metrics`, {
    headers: { Authorization: `Bearer ${jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET)}` },
  });
  assert.equal((await get(employerId)).status, 403);

  const res = await get(adminId);
  assert.equal(res.status, 200);
  const metrics = await res.json();
  assert.equal(metrics.avgHoursToFirstHire, 24);
  assert.equal(metrics.fillRate, 75);
  assert.equal(metrics.noShowRate, 10);
  assert.deepEqual(metrics.shifts30d, { completed: 18, noShows: 2, total: 25 });
  assert.equal(metrics.employerReturnRate, 50);
  assert.equal(metrics.weeklyActiveUsers, 3); // s1, s2, e1 (deduplicated)
  assert.deepEqual(metrics.applicationFunnel, { submitted: 4, hired: 6 });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { User } from '../src/models/User.js';
import { StudentProfile } from '../src/models/StudentProfile.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { Availability } from '../src/models/Availability.js';
import { Application } from '../src/models/Application.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-phase0';
const { default: app } = await import('../src/app.js');

const adminId = '507f1f77bcf86cd799439021';
const studentId = '507f1f77bcf86cd799439022';
const otherStudentId = '507f1f77bcf86cd799439023';
const employerId = '507f1f77bcf86cd799439024';
const otherEmployerId = '507f1f77bcf86cd799439025';

test('phase 0 hardening: admin role change, geo tools auth, CORS, availability privacy', async (t) => {
  const originals = {
    userFindById: User.findById,
    studentFindOne: StudentProfile.findOne,
    studentCreate: StudentProfile.create,
    employerFindOne: EmployerProfile.findOne,
    employerCreate: EmployerProfile.create,
    availFindOne: Availability.findOne,
    appExists: Application.exists,
  };
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    User.findById = originals.userFindById;
    StudentProfile.findOne = originals.studentFindOne;
    StudentProfile.create = originals.studentCreate;
    EmployerProfile.findOne = originals.employerFindOne;
    EmployerProfile.create = originals.employerCreate;
    Availability.findOne = originals.availFindOne;
    Application.exists = originals.appExists;
    await new Promise((resolve) => server.close(resolve));
  });

  const users = {
    [adminId]: { _id: adminId, role: 'admin', status: 'active', tokenVersion: 0 },
    [studentId]: { _id: studentId, role: 'student', status: 'active', tokenVersion: 0 },
    [otherStudentId]: { _id: otherStudentId, role: 'student', status: 'active', tokenVersion: 0 },
    [employerId]: { _id: employerId, role: 'employer', status: 'active', tokenVersion: 0 },
    [otherEmployerId]: { _id: otherEmployerId, role: 'employer', status: 'active', tokenVersion: 0 },
  };
  const pendingTarget = {
    _id: '507f1f77bcf86cd799439026', name: 'Người mới', role: 'pending', status: 'pending',
    save: async () => pendingTarget, select: async () => pendingTarget,
  };
  User.findById = (id) => (String(id) === pendingTarget._id ? pendingTarget : users[String(id)] || null);

  const base = () => `http://127.0.0.1:${server.address().port}`;
  const as = (id) => ({ Authorization: `Bearer ${jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET)}` });
  const json = { 'Content-Type': 'application/json' };

  await t.test('0.2 role change creates empty unverified profiles without fake identity data', async () => {
    let student = null;
    let employer = null;
    StudentProfile.findOne = async () => null;
    EmployerProfile.findOne = async () => null;
    StudentProfile.create = async (data) => { student = data; return data; };
    EmployerProfile.create = async (data) => { employer = data; return data; };

    let res = await fetch(`${base()}/api/admin/users/${pendingTarget._id}/role`, {
      method: 'PUT', headers: { ...as(adminId), ...json }, body: JSON.stringify({ role: 'student' }),
    });
    assert.equal(res.status, 200);
    assert.equal(student.verified, false);
    assert.equal(student.studentCode, undefined);
    assert.equal(student.idCardNumber, undefined);
    assert.equal(student.location, undefined);

    student = null;
    res = await fetch(`${base()}/api/admin/users/${pendingTarget._id}/role`, {
      method: 'PUT', headers: { ...as(adminId), ...json }, body: JSON.stringify({ role: 'worker' }),
    });
    assert.equal(res.status, 200);
    assert.equal(student.profileType, 'worker');
    assert.equal(student.verified, false);
    assert.equal(student.idCardNumber, undefined);

    res = await fetch(`${base()}/api/admin/users/${pendingTarget._id}/role`, {
      method: 'PUT', headers: { ...as(adminId), ...json }, body: JSON.stringify({ role: 'employer' }),
    });
    assert.equal(res.status, 200);
    assert.equal(employer.verified, false);
    assert.equal(employer.locationStatus, 'unconfirmed');
    assert.equal(employer.location, undefined);
    assert.equal(employer.geoPoint, undefined);
  });

  await t.test('0.3 geocode, search-places and resolve-map-link require authentication', async () => {
    for (const path of ['geocode', 'search-places', 'resolve-map-link']) {
      const res = await fetch(`${base()}/api/jobs/${path}`, {
        method: 'POST', headers: json, body: JSON.stringify({ address: 'Hòa Lạc', query: 'Hòa Lạc', input: '21.0,105.5' }),
      });
      assert.equal(res.status, 401, path);
    }
    const ok = await fetch(`${base()}/api/jobs/resolve-map-link`, {
      method: 'POST', headers: { ...as(employerId), ...json }, body: JSON.stringify({ input: '21.03752, 105.51203' }),
    });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { success: true, lat: 21.03752, lng: 105.51203 });
  });

  await t.test('0.4 CORS in production only allows whitelisted origins', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      for (const origin of ['https://evil.vercel.app', 'https://evil.onrender.com', 'https://evil.example']) {
        const res = await fetch(`${base()}/api/health`, { headers: { Origin: origin } });
        assert.equal(res.status, 403, origin);
      }
      const noOrigin = await fetch(`${base()}/api/health`);
      assert.notEqual(noOrigin.status, 403);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  await t.test('0.5 availability is private to self, admin and employers with an application', async () => {
    Availability.findOne = async () => ({ slots: { mon: ['morning'] } });
    let hasApplication = false;
    Application.exists = async () => (hasApplication ? { _id: 'a' } : null);
    const get = (id) => fetch(`${base()}/api/profiles/availability/${studentId}`, { headers: id ? as(id) : {} });

    assert.equal((await get(null)).status, 401);
    assert.equal((await get(otherStudentId)).status, 403);
    assert.equal((await get(otherEmployerId)).status, 403);
    assert.equal((await get(studentId)).status, 200);
    assert.equal((await get(adminId)).status, 200);

    hasApplication = true;
    assert.equal((await get(employerId)).status, 200);
    assert.equal((await get(otherStudentId)).status, 403);
  });
});

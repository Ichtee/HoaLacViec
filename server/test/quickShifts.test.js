import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { User } from '../src/models/User.js';
import { EmployerProfile } from '../src/models/EmployerProfile.js';
import { QuickShift } from '../src/models/QuickShift.js';
import { Shift } from '../src/models/Shift.js';
import { Notification } from '../src/models/Notification.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-quick-shifts';
const { default: app } = await import('../src/app.js');

const employerId = '507f1f77bcf86cd799439041';
const studentId = '507f1f77bcf86cd799439042';
const quickId = '507f1f77bcf86cd799439043';

// Giờ Việt Nam (UTC+7) cách hiện tại `hoursAhead` giờ
function vnSlot(hoursAhead, durationHours = 4) {
  const fmt = (ms) => {
    const d = new Date(ms + 7 * 60 * 60 * 1000);
    const iso = d.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  };
  const start = Date.now() + hoursAhead * 3600 * 1000;
  const s = fmt(start);
  const e = fmt(start + durationHours * 3600 * 1000);
  return { date: s.date, startTime: s.time, endTime: e.time, startAt: new Date(start), endAt: new Date(start + durationHours * 3600 * 1000) };
}

test('quick shifts: post, claim atomically, conflicts, withdraw and cancel', async (t) => {
  const originals = {
    userFindById: User.findById,
    profileFindOne: EmployerProfile.findOne,
    qCreate: QuickShift.create, qFindById: QuickShift.findById, qFindOneAndUpdate: QuickShift.findOneAndUpdate,
    qUpdateOne: QuickShift.updateOne,
    shiftFindOne: Shift.findOne, shiftCreate: Shift.create, shiftUpdateOne: Shift.updateOne, shiftUpdateMany: Shift.updateMany,
    notify: Notification.create,
  };
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    User.findById = originals.userFindById;
    EmployerProfile.findOne = originals.profileFindOne;
    QuickShift.create = originals.qCreate; QuickShift.findById = originals.qFindById;
    QuickShift.findOneAndUpdate = originals.qFindOneAndUpdate; QuickShift.updateOne = originals.qUpdateOne;
    Shift.findOne = originals.shiftFindOne; Shift.create = originals.shiftCreate;
    Shift.updateOne = originals.shiftUpdateOne; Shift.updateMany = originals.shiftUpdateMany;
    Notification.create = originals.notify;
    await new Promise((resolve) => server.close(resolve));
  });

  const users = {
    [employerId]: { _id: employerId, name: 'Quán A', role: 'employer', status: 'active', tokenVersion: 0 },
    [studentId]: { _id: studentId, name: 'Sinh viên', phone: '0900000000', role: 'student', status: 'active', tokenVersion: 0 },
  };
  User.findById = async (id) => users[String(id)] || null;
  const notes = [];
  Notification.create = async (n) => { notes.push(n); return n; };

  const base = () => `http://127.0.0.1:${server.address().port}/api/quick-shifts`;
  const call = async (path, as, method = 'GET', body) => {
    const res = await fetch(`${base()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${jwt.sign({ id: as, tokenVersion: 0 }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  await t.test('only verified employers can post, with validated input', async () => {
    const slot = vnSlot(2);
    const valid = { title: 'Phục vụ bàn', date: slot.date, startTime: slot.startTime, endTime: slot.endTime, headcount: 2, wageRate: 30000 };
    let created = null;
    QuickShift.create = async (data) => { created = data; return { ...data, _id: quickId, claims: [], toObject() { return { ...data, _id: quickId, claims: [] }; } }; };

    EmployerProfile.findOne = async () => ({ verified: false, storeName: 'Quán A' });
    assert.equal((await call('/', employerId, 'POST', valid)).body.code, 'EMPLOYER_NOT_VERIFIED');

    EmployerProfile.findOne = async () => ({ verified: true, storeName: 'Quán A', address: 'Hòa Lạc', location: { lat: 21, lng: 105.5 } });
    assert.equal((await call('/', studentId, 'POST', valid)).status, 403);
    assert.equal((await call('/', employerId, 'POST', { ...valid, headcount: 99 })).body.code, 'INVALID_HEADCOUNT');
    assert.equal((await call('/', employerId, 'POST', { ...valid, wageRate: 100 })).body.code, 'INVALID_WAGE');
    assert.equal((await call('/', employerId, 'POST', { ...valid, date: '2020-01-01' })).body.code, 'PAST_SHIFT');
    const far = vnSlot(24 * 10);
    assert.equal((await call('/', employerId, 'POST', { ...valid, date: far.date, startTime: far.startTime, endTime: far.endTime })).body.code, 'TOO_FAR');

    const ok = await call('/', employerId, 'POST', valid);
    assert.equal(ok.status, 201);
    assert.equal(created.storeName, 'Quán A');
    assert.equal(String(created.employerUserId), employerId);
    assert.equal(ok.body.remaining, 2);
  });

  const slot = vnSlot(3);
  const quickDoc = {
    _id: quickId, employerUserId: employerId, storeName: 'Quán A', title: 'Phục vụ bàn', date: slot.date,
    startTime: slot.startTime, endTime: slot.endTime, startAt: slot.startAt, endAt: slot.endAt,
    headcount: 1, wageRate: 30000, status: 'open', claims: [],
  };
  const lean = (doc) => ({ lean: async () => doc });

  await t.test('claim creates a real published shift and fills the slot', async () => {
    QuickShift.findById = () => lean(quickDoc);
    Shift.findOne = () => lean(null);
    let claimFilter = null;
    QuickShift.findOneAndUpdate = async (filter, update) => {
      claimFilter = filter;
      const claims = [update.$push.claims];
      return { ...quickDoc, claims, toObject() { return { ...quickDoc, claims }; } };
    };
    let shiftData = null;
    Shift.create = async (data) => { shiftData = data; return { _id: '507f1f77bcf86cd799439044', ...data }; };
    const updates = [];
    QuickShift.updateOne = async (f, u) => { updates.push([f, u]); return {}; };

    const res = await call(`/${quickId}/claim`, studentId, 'POST');
    assert.equal(res.status, 201);
    assert.equal(claimFilter.status, 'open');
    assert.deepEqual(claimFilter['claims.userId'], { $ne: studentId });
    assert.ok(claimFilter.$expr, 'capacity is enforced inside the atomic update');
    assert.equal(String(shiftData.studentUserId), studentId);
    assert.equal(shiftData.assignmentStatus, 'accepted');
    assert.equal(shiftData.wageRate, 30000);
    assert.equal(updates.some(([, u]) => u.$set?.status === 'filled'), true);
    assert.equal(String(notes.at(-1).userId), employerId);
  });

  await t.test('claim is rejected for conflicts, full shifts, the owner and employers', async () => {
    QuickShift.findById = () => lean(quickDoc);
    Shift.findOne = () => lean({ _id: 'x' });
    assert.equal((await call(`/${quickId}/claim`, studentId, 'POST')).body.code, 'SHIFT_CONFLICT');

    Shift.findOne = () => lean(null);
    QuickShift.findOneAndUpdate = async () => null;
    assert.equal((await call(`/${quickId}/claim`, studentId, 'POST')).body.code, 'CLAIM_UNAVAILABLE');

    assert.equal((await call(`/${quickId}/claim`, employerId, 'POST')).body.code, 'FORBIDDEN');
  });

  await t.test('rolls back the claim when the shift cannot be created', async () => {
    QuickShift.findById = () => lean(quickDoc);
    Shift.findOne = () => lean(null);
    QuickShift.findOneAndUpdate = async (f, u) => ({ ...quickDoc, claims: [u.$push.claims] });
    Shift.create = async () => { throw new Error('boom'); };
    const pulls = [];
    QuickShift.updateOne = async (f, u) => { pulls.push(u); return {}; };
    const res = await call(`/${quickId}/claim`, studentId, 'POST');
    assert.equal(res.status, 500);
    assert.ok(pulls.some((u) => u.$pull?.claims));
  });

  await t.test('employer cancel notifies claimers and cancels their shifts', async () => {
    const shiftId = '507f1f77bcf86cd799439044';
    let cancelFilter = null;
    QuickShift.findOneAndUpdate = async (f) => {
      cancelFilter = f;
      return { ...quickDoc, status: 'cancelled', claims: [{ userId: studentId, shiftId }] };
    };
    let shiftUpdate = null;
    Shift.updateMany = async (f, u) => { shiftUpdate = { f, u }; return {}; };
    const before = notes.length;

    assert.equal((await call(`/${quickId}/cancel`, studentId, 'POST')).status, 403);
    const res = await call(`/${quickId}/cancel`, employerId, 'POST');
    assert.equal(res.status, 200);
    assert.equal(String(cancelFilter.employerUserId), employerId);
    assert.equal(shiftUpdate.u.$set.scheduleStatus, 'cancelled');
    assert.equal(notes.length, before + 1);
    assert.equal(String(notes.at(-1).userId), studentId);
  });

  await t.test('withdraw is refused less than one hour before the shift', async () => {
    const soon = vnSlot(0.5, 2);
    QuickShift.findById = () => lean({ ...quickDoc, startAt: soon.startAt, claims: [{ userId: studentId, shiftId: 's1' }] });
    assert.equal((await call(`/${quickId}/withdraw`, studentId, 'POST')).body.code, 'TOO_LATE');
  });
});

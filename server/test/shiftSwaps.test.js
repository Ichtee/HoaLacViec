import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { User } from '../src/models/User.js';
import { Shift } from '../src/models/Shift.js';
import { Employment } from '../src/models/Employment.js';
import { TimeOffRequest } from '../src/models/TimeOffRequest.js';
import { ShiftSwap } from '../src/models/ShiftSwap.js';
import { Notification } from '../src/models/Notification.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-swaps';
const { default: app } = await import('../src/app.js');

const ids = {
  a: '507f1f77bcf86cd799439091', // người nhờ
  b: '507f1f77bcf86cd799439092', // đồng nghiệp
  c: '507f1f77bcf86cd799439093', // nhân viên khác
  employer: '507f1f77bcf86cd799439094',
  otherEmployer: '507f1f77bcf86cd799439095',
  shift: '507f1f77bcf86cd799439096',
  swap: '507f1f77bcf86cd799439097',
};

test('shift swap: peer accepts, employer approves and the shift moves atomically', async (t) => {
  const originals = {
    userFindById: User.findById, shiftFindById: Shift.findById, shiftFindOne: Shift.findOne, shiftFindOneAndUpdate: Shift.findOneAndUpdate,
    empFindOne: Employment.findOne, timeOff: TimeOffRequest.findOne,
    swapExists: ShiftSwap.exists, swapCreate: ShiftSwap.create, swapFindById: ShiftSwap.findById,
    swapFindOneAndUpdate: ShiftSwap.findOneAndUpdate, swapUpdateOne: ShiftSwap.updateOne,
    notify: Notification.create,
  };
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    User.findById = originals.userFindById; Shift.findById = originals.shiftFindById; Shift.findOne = originals.shiftFindOne;
    Shift.findOneAndUpdate = originals.shiftFindOneAndUpdate; Employment.findOne = originals.empFindOne;
    TimeOffRequest.findOne = originals.timeOff; ShiftSwap.exists = originals.swapExists; ShiftSwap.create = originals.swapCreate;
    ShiftSwap.findById = originals.swapFindById; ShiftSwap.findOneAndUpdate = originals.swapFindOneAndUpdate;
    ShiftSwap.updateOne = originals.swapUpdateOne; Notification.create = originals.notify;
    await new Promise((resolve) => server.close(resolve));
  });

  const users = {
    [ids.a]: { _id: ids.a, name: 'An', role: 'student', status: 'active', tokenVersion: 0 },
    [ids.b]: { _id: ids.b, name: 'Bình', phone: '0911', role: 'student', status: 'active', tokenVersion: 0 },
    [ids.c]: { _id: ids.c, name: 'Chi', role: 'student', status: 'active', tokenVersion: 0 },
    [ids.employer]: { _id: ids.employer, name: 'Quán', role: 'employer', status: 'active', tokenVersion: 0 },
    [ids.otherEmployer]: { _id: ids.otherEmployer, name: 'Quán khác', role: 'employer', status: 'active', tokenVersion: 0 },
  };
  User.findById = async (id) => users[String(id)] || null;
  const notes = [];
  Notification.create = async (n) => { notes.push(n); return n; };

  const future = new Date(Date.now() + 24 * 3600 * 1000);
  let shift = {
    _id: ids.shift, studentUserId: ids.a, employerUserId: ids.employer, storeName: 'Quán', date: '2026-10-09',
    startTime: '18:00', endTime: '22:00', startAt: future, endAt: new Date(future.getTime() + 4 * 3600 * 1000),
    scheduleStatus: 'published', attendanceStatus: 'not_started',
  };
  Shift.findById = () => ({ lean: async () => shift });
  Shift.findOne = () => ({ lean: async () => null }); // không trùng lịch
  TimeOffRequest.findOne = async () => null;
  Employment.findOne = async () => ({ _id: 'employment-b' });

  const call = async (id, path = '', method = 'GET', body) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/shift-swaps${path}`, {
      method,
      headers: { Authorization: `Bearer ${jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  // --- Tạo đề nghị ---
  let created = null;
  ShiftSwap.exists = async () => null;
  ShiftSwap.create = async (data) => { created = data; return { ...data, _id: ids.swap, toObject: () => ({ ...data, _id: ids.swap }) }; };

  assert.equal((await call(ids.employer, '', 'POST', { shiftId: ids.shift, targetUserId: ids.b })).status, 403);
  assert.equal((await call(ids.a, '', 'POST', { shiftId: ids.shift, targetUserId: ids.a })).body.code, 'SELF_SWAP');
  assert.equal((await call(ids.c, '', 'POST', { shiftId: ids.shift, targetUserId: ids.b })).status, 404, 'only the shift owner can ask');

  const pastShift = shift;
  shift = { ...shift, startAt: new Date(Date.now() - 1000) };
  assert.equal((await call(ids.a, '', 'POST', { shiftId: ids.shift, targetUserId: ids.b })).body.code, 'SHIFT_NOT_SWAPPABLE');
  shift = pastShift;

  Employment.findOne = async () => null;
  assert.equal((await call(ids.a, '', 'POST', { shiftId: ids.shift, targetUserId: ids.b })).body.code, 'TARGET_INELIGIBLE');
  Employment.findOne = async () => ({ _id: 'employment-b' });

  ShiftSwap.exists = async () => ({ _id: 'x' });
  assert.equal((await call(ids.a, '', 'POST', { shiftId: ids.shift, targetUserId: ids.b })).body.code, 'SWAP_EXISTS');
  ShiftSwap.exists = async () => null;

  const ok = await call(ids.a, '', 'POST', { shiftId: ids.shift, targetUserId: ids.b, message: 'Mình bận thi' });
  assert.equal(ok.status, 201);
  assert.equal(created.status, undefined, 'status is server-controlled (schema default)');
  assert.equal(String(created.targetUserId), ids.b);
  assert.equal(String(notes.at(-1).userId), ids.b);

  // --- Đồng nghiệp đồng ý ---
  let swap = {
    _id: ids.swap, shiftId: ids.shift, employerUserId: ids.employer, requesterUserId: ids.a, requesterName: 'An',
    targetUserId: ids.b, targetName: 'Bình', status: 'pending_peer',
  };
  ShiftSwap.findById = async () => swap;
  const transitions = [];
  ShiftSwap.findOneAndUpdate = async (filter, update) => {
    transitions.push({ filter, update });
    return filter.status === swap.status ? { ...swap, status: update.$set.status } : null;
  };
  ShiftSwap.updateOne = async () => ({});

  assert.equal((await call(ids.c, `/${ids.swap}/peer-accept`, 'POST')).status, 403);
  assert.equal((await call(ids.b, `/${ids.swap}/peer-accept`, 'POST')).status, 200);
  assert.equal(transitions.at(-1).filter.status, 'pending_peer');
  assert.equal(transitions.at(-1).update.$set.status, 'pending_employer');

  // Xung đột lịch của đồng nghiệp được báo ngay khi đồng ý
  Shift.findOne = () => ({ lean: async () => ({ date: '2026-10-09', startTime: '19:00', endTime: '21:00' }) });
  assert.equal((await call(ids.b, `/${ids.swap}/peer-accept`, 'POST')).body.code, 'SHIFT_CONFLICT');
  Shift.findOne = () => ({ lean: async () => null });

  // --- Cửa hàng duyệt ---
  swap = { ...swap, status: 'pending_employer' };
  let shiftUpdate = null;
  Shift.findOneAndUpdate = async (filter, update) => { shiftUpdate = { filter, update }; return { ...shift }; };

  assert.equal((await call(ids.a, `/${ids.swap}/approve`, 'POST')).status, 403);
  assert.equal((await call(ids.otherEmployer, `/${ids.swap}/approve`, 'POST')).status, 403);
  const approved = await call(ids.employer, `/${ids.swap}/approve`, 'POST');
  assert.equal(approved.status, 200);
  assert.equal(String(shiftUpdate.filter.studentUserId), ids.a, 'only moves if the requester still owns the shift');
  assert.equal(shiftUpdate.filter.attendanceStatus, 'not_started');
  assert.equal(String(shiftUpdate.update.$set.studentUserId), ids.b);
  assert.equal(shiftUpdate.update.$set.studentName, 'Bình');
  assert.equal(shiftUpdate.update.$set.employmentId, 'employment-b');
  assert.equal(transitions.at(-1).update.$set.status, 'approved');

  // Ca đã bị đổi người trong lúc chờ -> không chuyển
  Shift.findOneAndUpdate = async () => null;
  assert.equal((await call(ids.employer, `/${ids.swap}/approve`, 'POST')).body.code, 'SHIFT_CHANGED');

  // Đã xử lý rồi -> không duyệt lần hai
  swap = { ...swap, status: 'approved' };
  assert.equal((await call(ids.employer, `/${ids.swap}/approve`, 'POST')).body.code, 'INVALID_STATE');

  // --- Từ chối / rút lại ---
  swap = { ...swap, status: 'pending_employer' };
  assert.equal((await call(ids.employer, `/${ids.swap}/reject`, 'POST', { note: 'Thiếu người' })).status, 200);
  assert.equal(transitions.at(-1).update.$set.responseNote, 'Thiếu người');
  assert.equal((await call(ids.b, `/${ids.swap}/cancel`, 'POST')).status, 403);
  assert.equal((await call(ids.a, `/${ids.swap}/cancel`, 'POST')).status, 200);
});

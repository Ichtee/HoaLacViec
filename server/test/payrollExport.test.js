import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { User } from '../src/models/User.js';
import { Shift } from '../src/models/Shift.js';
import { buildPayrollCsv } from '../src/utils/payrollCsv.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-payroll';
const { default: app } = await import('../src/app.js');

const approved = (extra = {}) => ({
  attendanceStatus: 'approved', date: '2026-10-02', startTime: '18:00', endTime: '22:00',
  studentName: 'Nguyễn Văn A', positionTitle: 'Pha chế', workedMinutes: 240, wageRate: 30000, totalPay: 120000,
  payrollStatus: 'paid', ...extra,
});

test('payroll CSV: BOM, escaping, formula-injection guard, totals, approved shifts only', () => {
  const csv = buildPayrollCsv([
    approved({ date: '2026-10-03', studentName: '=HYPERLINK("x")' }),
    approved({ studentName: 'Trần, "B"', workedMinutes: 90, totalPay: 45000, payrollStatus: 'ready' }),
    approved({ attendanceStatus: 'checked_out', totalPay: 999999 }),
  ]);
  assert.ok(csv.startsWith('﻿Ngày,Nhân viên'));
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 4); // header + 2 approved + total
  assert.ok(lines[1].includes('"Trần, ""B"""'), 'sorted by date, quotes escaped');
  assert.ok(lines[2].includes("'=HYPERLINK"), 'formula neutralised');
  assert.ok(lines[1].endsWith('Chờ thanh toán'));
  assert.equal(lines[3], ',,,,Tổng cộng,5.5,,165000,');
});

test('payroll export endpoint is employer-scoped and validates the date range', async (t) => {
  const originals = { userFindById: User.findById, shiftFind: Shift.find };
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    User.findById = originals.userFindById; Shift.find = originals.shiftFind;
    await new Promise((resolve) => server.close(resolve));
  });
  const employerId = '507f1f77bcf86cd799439051';
  const studentId = '507f1f77bcf86cd799439052';
  const users = {
    [employerId]: { _id: employerId, role: 'employer', status: 'active', tokenVersion: 0 },
    [studentId]: { _id: studentId, role: 'student', status: 'active', tokenVersion: 0 },
  };
  User.findById = async (id) => users[String(id)];
  let filter = null;
  Shift.find = (f) => { filter = f; return { lean: async () => [approved()] }; };

  const get = (id, qs) => fetch(`http://127.0.0.1:${server.address().port}/api/shifts/payroll-export?${qs}`, {
    headers: { Authorization: `Bearer ${jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET)}` },
  });

  assert.equal((await get(studentId, 'from=2026-10-01&to=2026-10-31')).status, 403);
  assert.equal((await get(employerId, 'from=2026-10-31&to=2026-10-01')).status, 400);
  assert.equal((await get(employerId, 'from=abc&to=2026-10-01')).status, 400);

  const res = await get(employerId, 'from=2026-10-01&to=2026-10-31');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /bang-luong-2026-10-01_2026-10-31\.csv/);
  assert.equal(String(filter.employerUserId), employerId);
  assert.equal(filter.attendanceStatus, 'approved');
  assert.match(await res.text(), /Pha chế/);
});

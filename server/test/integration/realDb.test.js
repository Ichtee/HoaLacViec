/**
 * Kiểm thử tích hợp trên MongoDB thật (replica set trong bộ nhớ), không mock.
 * Xác nhận những gì test mock không chứng minh được: transaction, index một phần,
 * cập nhật nguyên tử dưới tải đồng thời và các pipeline aggregate.
 * Chạy: npm run test:integration
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, createUser, createApprovedJob, api } from '../e2e/testServer.mjs';

let t;
let http;
let m;
before(async () => {
  t = await startTestServer();
  m = t.models;
  http = api(t.url);
  // Bảo đảm các index (kể cả unique/partial) đã được dựng trước khi kiểm thử
  const { Application } = await import('../../src/models/Application.js');
  const { QuickShift } = await import('../../src/models/QuickShift.js');
  const { RefreshToken } = await import('../../src/models/RefreshToken.js');
  await Promise.all([Application.init(), QuickShift.init(), RefreshToken.init()]);
});
after(async () => { await t.stop(); });

// Giờ Việt Nam (UTC+7), cách hiện tại `hoursAhead` giờ
function vnSlot(hoursAhead, durationHours = 4) {
  const fmt = (ms) => {
    const iso = new Date(ms + 7 * 3600 * 1000).toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  };
  const start = Date.now() + hoursAhead * 3600 * 1000;
  const s = fmt(start);
  const e = fmt(start + durationHours * 3600 * 1000);
  return { date: s.date, startTime: s.time, endTime: e.time };
}

test('hiring: apply -> screening -> offer -> accept creates Employment and consumes capacity in a transaction', async () => {
  const employer = await createUser(m, { role: 'employer' });
  const student = await createUser(m, { role: 'student' });
  const job = await createApprovedJob(m, employer, { headcountTarget: 2, remainingOpenings: 2, slots: 2 });
  const eToken = (await http.login(employer.email)).token;
  const sToken = (await http.login(student.email)).token;

  const applied = await http.call('/applications', { method: 'POST', token: sToken, body: { jobId: String(job._id), note: 'Em rảnh ca tối', phone: '0901234567' } });
  assert.equal(applied.status, 201, JSON.stringify(applied.body));
  const appId = applied.body.application.id;

  // Nhà tuyển dụng chưa thấy liên hệ ứng viên trước offer
  const before = await http.call('/applications', { token: eToken });
  const row = before.body.find((a) => a.id === appId);
  assert.equal(row.contactHidden, true);
  assert.equal(row.studentPhone, undefined);

  assert.equal((await http.call(`/applications/${appId}`, { method: 'PUT', token: eToken, body: { status: 'screening' } })).status, 200);
  const offer = await http.call(`/applications/${appId}/offer`, { method: 'POST', token: eToken, body: { position: 'Pha chế', wage: 32000, expiryDays: 3 } });
  assert.equal(offer.status, 200, JSON.stringify(offer.body));

  const afterOffer = await http.call('/applications', { token: eToken });
  assert.equal(afterOffer.body.find((a) => a.id === appId).studentPhone, '0901234567', 'contact is revealed once an offer is sent');

  const accepted = await http.call(`/applications/${appId}/accept-offer`, { method: 'POST', token: sToken, body: {} });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));

  const employment = await m.Employment.findOne({ employeeUserId: student._id, employerUserId: employer._id });
  assert.ok(employment, 'employment created');
  const updatedJob = await m.Job.findById(job._id);
  assert.equal(updatedJob.hiredCount, 1);
  assert.equal(updatedJob.remainingOpenings, 1);

  // Chấp nhận lần hai không tạo thêm quan hệ việc làm hay trừ thêm chỉ tiêu
  await http.call(`/applications/${appId}/accept-offer`, { method: 'POST', token: sToken, body: {} });
  assert.equal(await m.Employment.countDocuments({ sourceApplicationId: appId }), 1);
  assert.equal((await m.Job.findById(job._id)).hiredCount, 1);

  // Nhắn tin theo nhân viên dùng chung cuộc trò chuyện của đơn đã tuyển (không tách hai luồng)
  const byApplication = await http.call('/chats/open', { method: 'POST', token: sToken, body: { kind: 'application', refId: appId } });
  const byEmployment = await http.call('/chats/open', { method: 'POST', token: eToken, body: { kind: 'employment', refId: String(employment._id) } });
  assert.equal(byEmployment.status, 200, JSON.stringify(byEmployment.body));
  assert.equal(String(byEmployment.body.id), String(byApplication.body.id));
  const outsider = await createUser(m, { role: 'student' });
  const outsiderToken = (await http.login(outsider.email)).token;
  const denied = await http.call('/chats/open', { method: 'POST', token: outsiderToken, body: { kind: 'employment', refId: String(employment._id) } });
  assert.equal(denied.status, 403);

  // Thông báo tuyển dụng được ghi nhận thật (từng bị nuốt lỗi vì type 'employment' không hợp lệ)
  const { Notification } = await import('../../src/models/Notification.js');
  const hired = await Notification.find({ type: 'employment' });
  assert.ok(hired.some((n) => String(n.userId) === String(student._id)), 'student notified of employment');
});

test('re-applying: blocked while active, allowed after withdrawing (partial unique index)', async () => {
  const employer = await createUser(m, { role: 'employer' });
  const student = await createUser(m, { role: 'student' });
  const job = await createApprovedJob(m, employer);
  const token = (await http.login(student.email)).token;
  const body = { jobId: String(job._id), phone: '0911111111' };

  const first = await http.call('/applications', { method: 'POST', token, body });
  assert.equal(first.status, 201);
  assert.equal((await http.call('/applications', { method: 'POST', token, body })).status, 409);

  assert.equal((await http.call(`/applications/${first.body.application.id}/withdraw`, { method: 'PUT', token })).status, 200);
  const again = await http.call('/applications', { method: 'POST', token, body });
  assert.equal(again.status, 201, JSON.stringify(again.body));
  assert.equal(await m.Job.db.model('Application').countDocuments({ studentId: student._id, jobId: job._id }), 2);

  // Chỉ một đơn đang hoạt động được phép tồn tại: index chặn cả khi vượt qua kiểm tra ở route
  const { Application } = await import('../../src/models/Application.js');
  await assert.rejects(
    Application.create({ studentId: student._id, jobId: job._id, studentName: 'x', status: 'submitted' }),
    (err) => err.code === 11000
  );
});

test('quick shifts: concurrent claims never exceed headcount and every winner gets a real shift', async () => {
  const employer = await createUser(m, { role: 'employer' });
  const eToken = (await http.login(employer.email)).token;
  const slot = vnSlot(3);
  const posted = await http.call('/quick-shifts', {
    method: 'POST', token: eToken,
    body: { title: 'Phục vụ', ...slot, headcount: 2, wageRate: 30000 },
  });
  assert.equal(posted.status, 201, JSON.stringify(posted.body));
  const quickId = posted.body.id;

  const students = await Promise.all(Array.from({ length: 8 }, () => createUser(m, { role: 'student' })));
  const tokens = await Promise.all(students.map(async (s) => (await http.login(s.email)).token));
  const results = await Promise.all(tokens.map((token) => http.call(`/quick-shifts/${quickId}/claim`, { method: 'POST', token })));

  const won = results.filter((r) => r.status === 201);
  assert.equal(won.length, 2, `statuses: ${results.map((r) => r.status).join(',')}`);
  assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 409));

  const { QuickShift } = await import('../../src/models/QuickShift.js');
  const doc = await QuickShift.findById(quickId);
  assert.equal(doc.claims.length, 2);
  assert.equal(doc.status, 'filled');
  assert.equal(await m.Shift.countDocuments({ quickShiftId: quickId }), 2);
  assert.equal((await http.call('/quick-shifts', { token: tokens[0] })).body.some((q) => q.id === quickId), false, 'filled shifts leave the open list');

  // Người thắng trả ca -> ca mở lại cho người khác
  const winnerToken = tokens[results.findIndex((r) => r.status === 201)];
  assert.equal((await http.call(`/quick-shifts/${quickId}/withdraw`, { method: 'POST', token: winnerToken })).status, 200);
  assert.equal((await QuickShift.findById(quickId)).status, 'open');
});

test('shift swap: peer accepts, employer approves, shift moves to the colleague', async () => {
  const employer = await createUser(m, { role: 'employer' });
  const a = await createUser(m, { role: 'student', name: 'An' });
  const b = await createUser(m, { role: 'student', name: 'Bình' });
  const job = await createApprovedJob(m, employer);
  for (const s of [a, b]) {
    await m.Employment.create({ employerUserId: employer._id, employeeUserId: s._id, jobId: job._id, status: 'active', positionTitle: 'Pha chế' });
  }
  const slot = vnSlot(30);
  const shift = await m.Shift.create({
    employerUserId: employer._id, studentUserId: a._id, studentName: 'An', storeName: 'Quán', ...slot,
    scheduleStatus: 'published', assignmentStatus: 'accepted',
  });
  const [eT, aT, bT] = await Promise.all([employer, a, b].map(async (u) => (await http.login(u.email)).token));

  const colleagues = await http.call(`/shift-swaps/colleagues?shiftId=${shift._id}`, { token: aT });
  assert.deepEqual(colleagues.body.map((c) => c.name), ['Bình']);

  const created = await http.call('/shift-swaps', { method: 'POST', token: aT, body: { shiftId: String(shift._id), targetUserId: String(b._id), message: 'Bận thi' } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const swapId = created.body.id;
  assert.equal((await http.call('/shift-swaps', { method: 'POST', token: aT, body: { shiftId: String(shift._id), targetUserId: String(b._id) } })).body.code, 'SWAP_EXISTS');

  assert.equal((await http.call(`/shift-swaps/${swapId}/approve`, { method: 'POST', token: eT })).body.code, 'INVALID_STATE', 'cannot skip the peer step');
  assert.equal((await http.call(`/shift-swaps/${swapId}/peer-accept`, { method: 'POST', token: bT })).status, 200);
  assert.equal((await http.call(`/shift-swaps/${swapId}/approve`, { method: 'POST', token: eT })).status, 200);

  const moved = await m.Shift.findById(shift._id);
  assert.equal(String(moved.studentUserId), String(b._id));
  assert.equal(moved.studentName, 'Bình');
  assert.equal((await http.call(`/shift-swaps/${swapId}/approve`, { method: 'POST', token: eT })).body.code, 'INVALID_STATE', 'double approval is rejected');
});

test('refresh tokens: rotate on use, replay fails, logout revokes (real cookies and TTL index)', async () => {
  const student = await createUser(m, { role: 'student' });
  const login = await http.login(student.email);
  const cookieOf = (setCookie) => setCookie.find((c) => c.startsWith('hlv_rt='))?.split(';')[0];
  const first = cookieOf(login.setCookie);
  assert.ok(first, 'login sets the refresh cookie');
  assert.ok(login.setCookie.some((c) => /HttpOnly/i.test(c)));

  const refreshed = await http.call('/auth/refresh', { method: 'POST', cookie: first, body: {} });
  assert.equal(refreshed.status, 200);
  const second = cookieOf(refreshed.headers.getSetCookie());
  assert.notEqual(second, first);
  assert.equal((await http.call('/auth/me', { token: refreshed.body.token })).status, 200);

  assert.equal((await http.call('/auth/refresh', { method: 'POST', cookie: first, body: {} })).status, 401, 'replay of a rotated token');
  assert.equal((await http.call('/auth/logout', { method: 'POST', cookie: second, body: {} })).status, 200);
  assert.equal((await http.call('/auth/refresh', { method: 'POST', cookie: second, body: {} })).status, 401, 'revoked on logout');

  // Đổi mật khẩu thu hồi mọi refresh token còn lại
  const again = await http.login(student.email);
  const cookie = cookieOf(again.setCookie);
  const changed = await http.call('/auth/change-password', { method: 'POST', token: again.token, body: { oldPassword: 'Passw0rd!', newPassword: 'NewPassw0rd!' } });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal((await http.call('/auth/refresh', { method: 'POST', cookie, body: {} })).status, 401);
});

test('chat: only the two parties talk; unread counts and read receipts work', async () => {
  const employer = await createUser(m, { role: 'employer' });
  const student = await createUser(m, { role: 'student' });
  const stranger = await createUser(m, { role: 'student' });
  const job = await createApprovedJob(m, employer);
  const [eT, sT, xT] = await Promise.all([employer, student, stranger].map(async (u) => (await http.login(u.email)).token));
  const applied = await http.call('/applications', { method: 'POST', token: sT, body: { jobId: String(job._id), phone: '0922222222' } });
  const appId = applied.body.application.id;

  assert.equal((await http.call('/chats/open', { method: 'POST', token: xT, body: { kind: 'application', refId: appId } })).status, 403);
  const opened = await http.call('/chats/open', { method: 'POST', token: sT, body: { kind: 'application', refId: appId } });
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  const again = await http.call('/chats/open', { method: 'POST', token: eT, body: { kind: 'application', refId: appId } });
  assert.equal(again.body.id, opened.body.id, 'one conversation per application');

  const convo = opened.body.id;
  assert.equal((await http.call(`/chats/${convo}/messages`, { method: 'POST', token: sT, body: { body: 'Chào quán ạ' } })).status, 201);
  assert.equal((await http.call(`/chats/${convo}/messages`, { token: xT })).status, 404);
  assert.equal((await http.call('/chats/unread-count', { token: eT })).body.count, 1);

  const read = await http.call(`/chats/${convo}/messages`, { token: eT });
  assert.equal(read.body.messages.length, 1);
  assert.equal(read.body.messages[0].mine, false);
  assert.equal((await http.call('/chats/unread-count', { token: eT })).body.count, 0, 'reading clears unread');

  await http.call(`/chats/${convo}/messages`, { method: 'POST', token: eT, body: { body: 'Mời em qua phỏng vấn' } });
  const incremental = await http.call(`/chats/${convo}/messages?after=${encodeURIComponent(read.body.messages[0].createdAt)}`, { token: sT });
  assert.deepEqual(incremental.body.messages.map((x) => x.body), ['Mời em qua phỏng vấn']);
});

test('payroll export, work history and admin metrics run on real data', async () => {
  const employer = await createUser(m, { role: 'employer' });
  const student = await createUser(m, { role: 'student' });
  const admin = await createUser(m, { role: 'admin' });
  const job = await createApprovedJob(m, employer);
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const shift = await m.Shift.create({
    employerUserId: employer._id, studentUserId: student._id, studentName: 'Nguyễn, "Văn" A', storeName: 'Quán', jobId: job._id,
    date: today, startTime: '10:00', endTime: '14:00',
    scheduleStatus: 'published', assignmentStatus: 'accepted', attendanceStatus: 'approved', payrollStatus: 'paid',
    workedMinutes: 240, wageRate: 30000, totalPay: 120000,
  });
  const [eT, sT, aT] = await Promise.all([employer, student, admin].map(async (u) => (await http.login(u.email)).token));

  const csv = await fetch(`${t.url}/api/shifts/payroll-export?from=${today}&to=${today}`, { headers: { Authorization: `Bearer ${eT}` } });
  assert.equal(csv.status, 200);
  const text = await csv.text();
  assert.ok(text.includes('"Nguyễn, ""Văn"" A"'));
  assert.ok(text.includes('120000'));

  const history = await http.call(`/profiles/student/${student._id}/work-history`, { token: sT });
  assert.equal(history.status, 200);
  assert.equal(history.body.completedShifts, 1);
  assert.equal(history.body.totalHours, 4);

  const metrics = await http.call('/admin/metrics', { token: aT });
  assert.equal(metrics.status, 200, JSON.stringify(metrics.body));
  assert.equal(typeof metrics.body.weeklyActiveUsers, 'number');
  assert.ok(metrics.body.shifts30d.completed >= 0);
  assert.equal(shift.attendanceStatus, 'approved');
});

test('job alerts notify matching users when admin approves a job; maintenance expires overdue offers', async () => {
  const employer = await createUser(m, { role: 'employer' });
  const student = await createUser(m, { role: 'student' });
  const other = await createUser(m, { role: 'student' });
  const admin = await createUser(m, { role: 'admin' });
  const [sT, oT, aT] = await Promise.all([student, other, admin].map(async (u) => (await http.login(u.email)).token));
  assert.equal((await http.call('/job-alerts', { method: 'POST', token: sT, body: { keyword: 'barista', minSalary: 25000 } })).status, 201);
  assert.equal((await http.call('/job-alerts', { method: 'POST', token: oT, body: { keyword: 'gia sư' } })).status, 201);

  const pending = await createApprovedJob(m, employer, { title: 'Barista ca tối', status: 'pending', recruitmentStatus: 'open' });
  const approve = await http.call(`/jobs/${pending._id}/approve`, { method: 'POST', token: aT });
  assert.equal(approve.status, 200, JSON.stringify(approve.body));

  const { Notification } = await import('../../src/models/Notification.js');
  let hits = [];
  for (let i = 0; i < 20 && hits.length === 0; i++) {
    hits = await Notification.find({ link: `/jobs/${pending._id}`, title: /bộ lọc/ });
    if (!hits.length) await new Promise((r) => setTimeout(r, 100));
  }
  assert.deepEqual(hits.map((h) => String(h.userId)), [String(student._id)], 'only the matching user is alerted');

  // Maintenance: offer quá hạn -> offer_expired và nhả chỗ nộp lại
  const { Application } = await import('../../src/models/Application.js');
  const job = await createApprovedJob(m, employer);
  const app = await Application.create({
    studentId: student._id, studentName: 'SV', jobId: job._id, employerUserId: employer._id, status: 'offer_sent',
    offer: { position: 'Pha chế', status: 'sent', expiryDate: new Date(Date.now() - 3600 * 1000) },
  });
  const { runMaintenance } = await import('../../src/services/maintenanceService.js');
  const result = await runMaintenance();
  assert.ok(result.offersExpired >= 1);
  const refreshed = await Application.findById(app._id);
  assert.equal(refreshed.status, 'offer_expired');
  assert.equal(refreshed.isActive, false);
});

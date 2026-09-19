/**
 * Mock localStorage store
 * Version-aware: resets if DATA_VERSION changes
 * All writes are synchronous to keep demo interactions consistent
 */

import {
  DATA_VERSION,
  USERS,
  STUDENT_PROFILES,
  EMPLOYER_PROFILES,
  AVAILABILITY,
  JOBS,
  APPLICATIONS,
  REVIEWS,
  SAVED_JOBS,
  VERIFICATION_REQUESTS,
  REPORTS,
  DEMO_CREDENTIALS,
  buildShifts,
  buildSwapRequests,
  buildPayrollStatements,
} from './seed.js';

const STORAGE_KEY = 'hlv_mock_store';
const VERSION_KEY = 'hlv_mock_version';

function buildInitialState() {
  return {
    users: USERS,
    studentProfiles: STUDENT_PROFILES,
    employerProfiles: EMPLOYER_PROFILES,
    availability: AVAILABILITY,
    jobs: JOBS,
    applications: APPLICATIONS,
    shifts: buildShifts(),
    swapRequests: buildSwapRequests(),
    reviews: REVIEWS,
    payrollStatements: buildPayrollStatements(),
    savedJobs: SAVED_JOBS,
    verificationRequests: VERIFICATION_REQUESTS,
    reports: REPORTS,
    notifications: [],
  };
}

function loadStore() {
  try {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    if (storedVersion !== String(DATA_VERSION)) {
      return null; // version mismatch — will reset
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveStore(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(VERSION_KEY, String(DATA_VERSION));
  } catch (e) {
    console.warn('[MockStore] Could not save to localStorage:', e);
  }
}

// Singleton store
let _store = null;

function getStore() {
  if (!_store) {
    const loaded = loadStore();
    _store = loaded || buildInitialState();
    if (!loaded) saveStore(_store);
  }
  return _store;
}

export function resetStore() {
  _store = buildInitialState();
  saveStore(_store);
  return _store;
}

// ─── Generic helpers ──────────────────────────────────────────────
function read(collection) {
  return getStore()[collection] || [];
}

function write(collection, data) {
  const s = getStore();
  s[collection] = data;
  saveStore(s);
}

function findById(collection, id) {
  return read(collection).find((item) => item.id === id) || null;
}

function updateById(collection, id, patch) {
  const items = read(collection);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error(`${collection}[${id}] not found`);
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  write(collection, items);
  return items[idx];
}

function insertOne(collection, item) {
  const items = read(collection);
  items.push(item);
  write(collection, items);
  return item;
}

function removeById(collection, id) {
  const items = read(collection).filter((i) => i.id !== id);
  write(collection, items);
}

// ─── Simulated async delay ────────────────────────────────────────
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// ─── AUTH ─────────────────────────────────────────────────────────
export async function mockLogin(email, passwordOrRole) {
  await delay(300);
  const normalizedEmail = (email || '').toLowerCase().trim();
  const users = read('users');
  const user = users.find((u) => (u.email || '').toLowerCase().trim() === normalizedEmail);

  if (!user) {
    const cred = DEMO_CREDENTIALS.find(
      (c) => c.email.toLowerCase() === normalizedEmail
    );
    if (!cred) throw new Error('Email không tồn tại trong hệ thống.');
    const credUser = users.find((u) => u.id === cred.userId);
    return { user: credUser, profileId: cred.profileId };
  }

  // If password was entered, check password (or allow demo role match)
  if (user.password && passwordOrRole && user.password !== passwordOrRole && user.role !== passwordOrRole) {
    throw new Error('Mật khẩu không chính xác.');
  }

  let profileId = null;
  if (user.role === 'student') {
    const sp = read('studentProfiles').find((p) => p.userId === user.id);
    profileId = sp?.id || null;
  } else if (user.role === 'employer') {
    const ep = read('employerProfiles').find((p) => p.userId === user.id);
    profileId = ep?.id || null;
  }

  return { user, profileId };
}

export async function mockRegister({ role, name, email, phone = '', password = '123456', university = '', address = '' }) {
  await delay(300);
  const normalizedEmail = (email || '').toLowerCase().trim();
  const exists = read('users').some((u) => (u.email || '').toLowerCase().trim() === normalizedEmail);
  if (exists) throw new Error('Email đã được sử dụng.');
  const id = `user-${Date.now()}`;
  const newUser = { id, role, name, email: normalizedEmail, phone, password, createdAt: new Date().toISOString() };
  insertOne('users', newUser);
  if (role === 'student') {
    const profileId = `sp-${Date.now()}`;
    insertOne('studentProfiles', {
      id: profileId, userId: id, university: university || 'Đại học FPT Hòa Lạc', yearOfStudy: 1, major: '',
      area: 'fpt_university', location: null, bio: '', skills: [], transport: 'xe_may', reputationScore: 5.0,
      reputationCount: 0, profileComplete: true,
    });
    return { user: newUser, profileId };
  }
  if (role === 'employer') {
    const profileId = `ep-${Date.now()}`;
    insertOne('employerProfiles', {
      id: profileId, userId: id, storeName: name, storeType: 'Cửa hàng', address: address || 'Khu CNC Hòa Lạc',
      area: 'fpt_university', location: null, contactName: name, contactPhone: phone, description: '',
      verified: true, verifiedAt: new Date().toISOString(), checkinRadius: 200, busRoutes: [], rating: 5.0, ratingCount: 0,
    });
    return { user: newUser, profileId };
  }
  return { user: newUser, profileId: null };
}

// ─── JOBS ─────────────────────────────────────────────────────────
export async function mockGetJobs(filters = {}) {
  await delay(150);
  let jobs = read('jobs').filter((j) => {
    if (filters.status && j.status !== filters.status) return false;
    if (filters.employerId && j.employerId !== filters.employerId) return false;
    return true;
  });

  // Public listing: only approved jobs
  if (filters.public) jobs = jobs.filter((j) => j.status === 'approved');

  if (filters.type) jobs = jobs.filter((j) => j.type === filters.type);
  if (filters.area) jobs = jobs.filter((j) => j.area === filters.area);
  if (filters.verified) {
    const verifiedIds = read('employerProfiles').filter((e) => e.verified).map((e) => e.id);
    jobs = jobs.filter((j) => verifiedIds.includes(j.employerId));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    jobs = jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        (j.description || '').toLowerCase().includes(q)
    );
  }
  // Attach employer info
  return jobs.map((j) => {
    const emp = findById('employerProfiles', j.employerId);
    return { ...j, employer: emp };
  });
}

export async function mockGetJob(id) {
  await delay(100);
  const job = findById('jobs', id);
  if (!job) throw new Error('Không tìm thấy tin việc.');
  const emp = findById('employerProfiles', job.employerId);
  return { ...job, employer: emp };
}

export async function mockCreateJob(employerId, data) {
  await delay(200);
  const id = `job-${Date.now()}`;
  const job = {
    id, employerId, ...data,
    status: data.status || 'draft',
    postedAt: new Date().toISOString(),
    featured: false,
    busRoutes: data.busRoutes || [],
    tags: data.tags || [],
  };
  return insertOne('jobs', job);
}

export async function mockUpdateJob(id, patch) {
  await delay(150);
  return updateById('jobs', id, patch);
}

export async function mockDeleteJob(id) {
  await delay(150);
  removeById('jobs', id);
}

// ─── APPLICATIONS ─────────────────────────────────────────────────
export async function mockApply(studentId, jobId, note = '') {
  await delay(200);
  const existing = read('applications').find(
    (a) => a.studentId === studentId && a.jobId === jobId
  );
  if (existing) throw new Error('Bạn đã ứng tuyển vào vị trí này rồi.');
  const job = findById('jobs', jobId);
  if (!job || job.status !== 'approved') throw new Error('Tin tuyển dụng không hợp lệ.');

  const profile = read('studentProfiles').find((p) => p.userId === studentId || p.id === studentId);
  if (!profile?.profileComplete) throw new Error('Vui lòng hoàn thiện hồ sơ trước khi ứng tuyển.');

  const id = `app-${Date.now()}`;
  const app = {
    id, studentId, jobId, employerId: job.employerId,
    status: 'pending', note, employerNote: '',
    appliedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return insertOne('applications', app);
}

export async function mockGetApplications(filters = {}) {
  await delay(150);
  let apps = read('applications');
  if (filters.studentId) apps = apps.filter((a) => a.studentId === filters.studentId);
  if (filters.jobId) apps = apps.filter((a) => a.jobId === filters.jobId);
  if (filters.employerId) apps = apps.filter((a) => a.employerId === filters.employerId);
  if (filters.status) apps = apps.filter((a) => a.status === filters.status);
  return apps.map((a) => {
    const job = findById('jobs', a.jobId);
    const student = read('studentProfiles').find((p) => p.id === a.studentId);
    return { ...a, job, student };
  });
}

export async function mockUpdateApplication(id, patch) {
  await delay(150);
  return updateById('applications', id, patch);
}

export async function mockWithdrawApplication(id, studentId) {
  await delay(150);
  const app = findById('applications', id);
  if (!app) throw new Error('Không tìm thấy đơn.');
  if (app.studentId !== studentId) throw new Error('Không có quyền.');
  if (app.status !== 'pending') throw new Error('Chỉ rút đơn khi đang chờ duyệt.');
  return updateById('applications', id, { status: 'withdrawn' });
}

// ─── SHIFTS ───────────────────────────────────────────────────────
export async function mockGetShifts(filters = {}) {
  await delay(150);
  let shifts = read('shifts');
  if (filters.studentId) shifts = shifts.filter((s) => s.studentId === filters.studentId);
  if (filters.employerId) shifts = shifts.filter((s) => s.employerId === filters.employerId);
  if (filters.jobId) shifts = shifts.filter((s) => s.jobId === filters.jobId);
  if (filters.status) shifts = shifts.filter((s) => s.status === filters.status);
  return shifts.map((s) => {
    const job = findById('jobs', s.jobId);
    const student = read('studentProfiles').find((p) => p.id === s.studentId);
    const employer = findById('employerProfiles', s.employerId);
    return { ...s, job, student, employer };
  });
}

export async function mockCreateShift(data) {
  await delay(200);
  // Conflict check: same student, overlapping time on same date
  const existing = read('shifts').filter(
    (s) => s.studentId === data.studentId && s.date === data.date && s.status !== 'cancelled'
  );
  for (const s of existing) {
    if (s.startTime < data.endTime && s.endTime > data.startTime) {
      throw new Error('Sinh viên đã có ca khác trùng giờ trong ngày này.');
    }
  }
  const id = `shift-${Date.now()}`;
  const shift = { id, ...data, status: 'scheduled', attendance: null };
  return insertOne('shifts', shift);
}

export async function mockCheckIn(shiftId, studentId, isSimulated = false, coords = null) {
  await delay(200);
  const shift = findById('shifts', shiftId);
  if (!shift) throw new Error('Không tìm thấy ca.');
  if (shift.studentId !== studentId) throw new Error('Không được phân ca này.');
  if (shift.attendance?.checkInAt) throw new Error('Đã check-in rồi.');
  if (shift.status !== 'scheduled') throw new Error('Ca không ở trạng thái hợp lệ.');
  return updateById('shifts', shiftId, {
    status: 'checked_in',
    attendance: {
      checkInAt: new Date().toISOString(),
      checkInSimulated: isSimulated,
      checkInCoords: coords,
      checkOutAt: null,
      approvedMinutes: null,
      status: 'pending',
    },
  });
}

export async function mockCheckOut(shiftId, studentId, isSimulated = false, coords = null) {
  await delay(200);
  const shift = findById('shifts', shiftId);
  if (!shift) throw new Error('Không tìm thấy ca.');
  if (shift.studentId !== studentId) throw new Error('Không được phân ca này.');
  if (!shift.attendance?.checkInAt) throw new Error('Chưa check-in.');
  if (shift.attendance?.checkOutAt) throw new Error('Đã check-out rồi.');
  const checkIn = new Date(shift.attendance.checkInAt);
  const checkOut = new Date();
  const minutes = Math.round((checkOut - checkIn) / 60000);
  return updateById('shifts', shiftId, {
    status: 'completed',
    attendance: {
      ...shift.attendance,
      checkOutAt: checkOut.toISOString(),
      checkOutSimulated: isSimulated,
      checkOutCoords: coords,
      approvedMinutes: minutes,
      status: 'pending',
    },
  });
}

export async function mockApproveAttendance(shiftId, employerId) {
  await delay(150);
  const shift = findById('shifts', shiftId);
  if (!shift) throw new Error('Không tìm thấy ca.');
  if (shift.employerId !== employerId) throw new Error('Không có quyền.');
  return updateById('shifts', shiftId, {
    attendance: {
      ...shift.attendance,
      status: 'approved',
      approvedAt: new Date().toISOString(),
    },
  });
}

// ─── SWAP REQUESTS ────────────────────────────────────────────────
export async function mockGetSwapRequests(filters = {}) {
  await delay(150);
  let reqs = read('swapRequests');
  if (filters.employerId) {
    const empShiftIds = read('shifts').filter((s) => s.employerId === filters.employerId).map((s) => s.id);
    reqs = reqs.filter((r) => empShiftIds.includes(r.shiftId));
  }
  if (filters.studentId) reqs = reqs.filter((r) => r.originalStudentId === filters.studentId || r.applicants?.includes(filters.studentId));
  if (filters.status) reqs = reqs.filter((r) => r.status === filters.status);
  return reqs.map((r) => {
    const shift = findById('shifts', r.shiftId);
    const job = shift ? findById('jobs', shift.jobId) : null;
    return { ...r, shift, job };
  });
}

export async function mockCreateSwapRequest(shiftId, studentId, reason) {
  await delay(200);
  const shift = findById('shifts', shiftId);
  if (!shift) throw new Error('Không tìm thấy ca.');
  if (shift.studentId !== studentId) throw new Error('Không phải ca của bạn.');
  if (shift.status !== 'scheduled') throw new Error('Ca phải chưa bắt đầu.');
  const existing = read('swapRequests').find((r) => r.shiftId === shiftId && r.status === 'open');
  if (existing) throw new Error('Đã có yêu cầu đổi ca cho ca này rồi.');
  const id = `swap-${Date.now()}`;
  return insertOne('swapRequests', {
    id, shiftId, originalStudentId: studentId, employerId: shift.employerId,
    status: 'open', reason, applicants: [], selectedApplicant: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
}

export async function mockApplySwap(swapId, studentId) {
  await delay(200);
  const req = findById('swapRequests', swapId);
  if (!req) throw new Error('Không tìm thấy yêu cầu.');
  if (req.status !== 'open') throw new Error('Yêu cầu đã được xử lý.');
  if (req.originalStudentId === studentId) throw new Error('Không thể nhận ca của chính mình.');
  if (req.applicants?.includes(studentId)) throw new Error('Bạn đã đăng ký nhận ca này rồi.');
  return updateById('swapRequests', swapId, {
    status: 'applied',
    applicants: [...(req.applicants || []), studentId],
  });
}

export async function mockApproveSwap(swapId, employerId, selectedStudentId) {
  await delay(200);
  const req = findById('swapRequests', swapId);
  if (!req) throw new Error('Không tìm thấy yêu cầu.');
  if (req.employerId !== employerId) throw new Error('Không có quyền.');
  // Check new student conflict
  const shift = findById('shifts', req.shiftId);
  const conflicting = read('shifts').filter(
    (s) => s.studentId === selectedStudentId && s.date === shift.date && s.id !== shift.id && s.status !== 'cancelled'
  );
  for (const s of conflicting) {
    if (s.startTime < shift.endTime && s.endTime > shift.startTime) {
      throw new Error('Người nhận ca bị trùng lịch.');
    }
  }
  // Update shift assignee
  updateById('shifts', req.shiftId, { studentId: selectedStudentId });
  // Close this request
  updateById('swapRequests', swapId, {
    status: 'approved', selectedApplicant: selectedStudentId,
  });
  // Close competing requests for same shift (none in MVP, but guard anyway)
}

export async function mockRejectSwap(swapId, employerId) {
  await delay(150);
  const req = findById('swapRequests', swapId);
  if (!req) throw new Error('Không tìm thấy yêu cầu.');
  if (req.employerId !== employerId) throw new Error('Không có quyền.');
  return updateById('swapRequests', swapId, { status: 'rejected' });
}

// ─── REVIEWS ─────────────────────────────────────────────────────
export async function mockGetReviews(filters = {}) {
  await delay(100);
  let reviews = read('reviews');
  if (filters.targetId) reviews = reviews.filter((r) => r.targetId === filters.targetId);
  if (filters.reviewerId) reviews = reviews.filter((r) => r.reviewerId === filters.reviewerId);
  return reviews;
}

export async function mockCreateReview(shiftId, reviewerId, reviewerRole, targetId, targetRole, rating, comment) {
  await delay(200);
  const existing = read('reviews').find(
    (r) => r.shiftId === shiftId && r.reviewerId === reviewerId
  );
  if (existing) throw new Error('Bạn đã đánh giá ca này rồi.');
  const shift = findById('shifts', shiftId);
  if (!shift || shift.status !== 'completed') throw new Error('Ca chưa hoàn thành.');
  const id = `rev-${Date.now()}`;
  return insertOne('reviews', {
    id, shiftId, reviewerId, reviewerRole, targetId, targetRole, rating, comment,
    createdAt: new Date().toISOString(),
  });
}

// ─── PAYROLL ──────────────────────────────────────────────────────
export async function mockGetPayrollStatements(filters = {}) {
  await delay(150);
  let stmts = read('payrollStatements');
  if (filters.employerId) stmts = stmts.filter((s) => s.employerId === filters.employerId);
  if (filters.studentId) stmts = stmts.filter((s) => s.studentId === filters.studentId);
  return stmts;
}

export async function mockFinalizePayroll(id, employerId) {
  await delay(200);
  const stmt = findById('payrollStatements', id);
  if (!stmt) throw new Error('Không tìm thấy bảng đối soát.');
  if (stmt.employerId !== employerId) throw new Error('Không có quyền.');
  return updateById('payrollStatements', id, { status: 'finalized', finalizedAt: new Date().toISOString() });
}

export async function mockAddAdjustment(id, employerId, adjustment) {
  await delay(150);
  const stmt = findById('payrollStatements', id);
  if (!stmt) throw new Error('Không tìm thấy bảng đối soát.');
  if (stmt.status === 'finalized') throw new Error('Bảng đối soát đã chốt.');
  const adjs = [...(stmt.adjustments || []), { ...adjustment, id: `adj-${Date.now()}` }];
  const adjTotal = adjs.reduce((s, a) => s + a.amount, 0);
  return updateById('payrollStatements', id, {
    adjustments: adjs,
    adjTotal,
    grandTotal: stmt.shiftTotal + adjTotal,
  });
}

// ─── STUDENT PROFILE ─────────────────────────────────────────────
export async function mockGetStudentProfile(profileId) {
  await delay(100);
  const profile = findById('studentProfiles', profileId);
  if (!profile) throw new Error('Không tìm thấy hồ sơ.');
  return profile;
}

export async function mockUpdateStudentProfile(profileId, patch) {
  await delay(150);
  return updateById('studentProfiles', profileId, patch);
}

// ─── EMPLOYER PROFILE ─────────────────────────────────────────────
export async function mockGetEmployerProfile(profileId) {
  await delay(100);
  const profile = findById('employerProfiles', profileId);
  if (!profile) throw new Error('Không tìm thấy hồ sơ.');
  return profile;
}

export async function mockUpdateEmployerProfile(profileId, patch) {
  await delay(150);
  return updateById('employerProfiles', profileId, patch);
}

// ─── AVAILABILITY ─────────────────────────────────────────────────
export async function mockGetAvailability(studentId) {
  await delay(100);
  return read('availability').filter((a) => a.studentId === studentId);
}

export async function mockUpsertAvailability(studentId, slots) {
  await delay(150);
  const others = read('availability').filter((a) => a.studentId !== studentId);
  const updated = slots.map((s, i) => ({ ...s, id: s.id || `av-${Date.now()}-${i}`, studentId }));
  write('availability', [...others, ...updated]);
  return updated;
}

// ─── SAVED JOBS ───────────────────────────────────────────────────
export async function mockGetSavedJobs(studentId) {
  await delay(100);
  const saved = read('savedJobs').filter((s) => s.studentId === studentId).map((s) => s.jobId);
  const jobs = read('jobs').filter((j) => saved.includes(j.id) && j.status === 'approved');
  return jobs.map((j) => ({ ...j, employer: findById('employerProfiles', j.employerId) }));
}

export async function mockToggleSaveJob(studentId, jobId) {
  await delay(100);
  const saved = read('savedJobs');
  const idx = saved.findIndex((s) => s.studentId === studentId && s.jobId === jobId);
  if (idx >= 0) {
    write('savedJobs', saved.filter((_, i) => i !== idx));
    return { saved: false };
  } else {
    write('savedJobs', [...saved, { studentId, jobId }]);
    return { saved: true };
  }
}

export async function mockIsSavedJob(studentId, jobId) {
  await delay(50);
  return read('savedJobs').some((s) => s.studentId === studentId && s.jobId === jobId);
}

// ─── ADMIN ────────────────────────────────────────────────────────
export async function mockGetVerificationRequests(filters = {}) {
  await delay(100);
  let reqs = read('verificationRequests');
  if (filters.status) reqs = reqs.filter((r) => r.status === filters.status);
  return reqs.map((r) => ({
    ...r,
    employer: findById('employerProfiles', r.employerId),
  }));
}

export async function mockReviewVerification(id, status, note) {
  await delay(150);
  updateById('verificationRequests', id, {
    status, reviewNote: note, reviewedAt: new Date().toISOString(),
  });
  if (status === 'approved') {
    const req = findById('verificationRequests', id);
    if (req) {
      updateById('employerProfiles', req.employerId, { verified: true, verifiedAt: new Date().toISOString() });
    }
  }
}

export async function mockGetReports(filters = {}) {
  await delay(100);
  let reports = read('reports');
  if (filters.status) reports = reports.filter((r) => r.status === filters.status);
  return reports;
}

export async function mockResolveReport(id, status) {
  await delay(150);
  return updateById('reports', id, { status, resolvedAt: new Date().toISOString() });
}

export async function mockAdminGetJobs(filters = {}) {
  await delay(150);
  let jobs = read('jobs');
  if (filters.status) jobs = jobs.filter((j) => j.status === filters.status);
  return jobs.map((j) => ({ ...j, employer: findById('employerProfiles', j.employerId) }));
}

export async function mockAdminUpdateJob(id, patch) {
  await delay(150);
  return updateById('jobs', id, patch);
}

export async function mockGetAllUsers() {
  await delay(100);
  return read('users');
}

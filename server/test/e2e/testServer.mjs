/**
 * Máy chủ kiểm thử với MongoDB replica set TRONG BỘ NHỚ (hỗ trợ transaction).
 * Không bao giờ dùng MONGO_URI trong .env: kết nối tường minh tới 127.0.0.1.
 *
 * - Dùng trong test tích hợp: const t = await startTestServer(); ... await t.stop();
 * - Chạy độc lập cho Playwright:  node test/e2e/testServer.mjs  (mặc định cổng 5055)
 */
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Dùng chung một thư mục cache cho binary mongod dù chạy từ server/ hay client/
process.env.MONGOMS_DOWNLOAD_DIR ||= fileURLToPath(new URL('../../node_modules/.cache/mongodb-memory-server', import.meta.url));

export const PASSWORD = 'Passw0rd!';

export async function startTestServer({ port = 0 } = {}) {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET ||= 'e2e-secret-not-for-production';
  process.env.DISABLE_MAINTENANCE_JOBS = 'true';
  delete process.env.DISABLE_ACCOUNT_VERIFICATION;

  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri('hlv_e2e');
  if (!/^mongodb:\/\/127\.0\.0\.1[:/]/.test(uri)) throw new Error('Từ chối: URI kiểm thử không phải localhost.');
  await mongoose.connect(uri);

  const { default: app } = await import('../../src/app.js');
  const server = await new Promise((resolve) => {
    const listener = app.listen(port, '127.0.0.1', () => resolve(listener));
  });
  const url = `http://127.0.0.1:${server.address().port}`;

  const models = {
    User: (await import('../../src/models/User.js')).User,
    StudentProfile: (await import('../../src/models/StudentProfile.js')).StudentProfile,
    EmployerProfile: (await import('../../src/models/EmployerProfile.js')).EmployerProfile,
    Job: (await import('../../src/models/Job.js')).Job,
    Employment: (await import('../../src/models/Employment.js')).Employment,
    Shift: (await import('../../src/models/Shift.js')).Shift,
  };

  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await replSet.stop();
  }

  return { url, stop, models, replSet };
}

let counter = 0;

/**
 * Endpoint chỉ dành cho E2E: tạo dữ liệu nhanh để các spec không phải bấm qua mọi bước chuẩn bị.
 * Chỉ tồn tại trong tiến trình testServer độc lập, không nằm trong ứng dụng thật.
 */
async function mountSeedRoutes(t) {
  const { default: express } = await import('express');
  const { default: app } = await import('../../src/app.js');
  const router = express.Router();
  router.use(express.json());
  const { models } = t;
  const vnSlot = (hoursAhead, durationHours = 4) => {
    const fmt = (ms) => {
      const iso = new Date(ms + 7 * 3600 * 1000).toISOString();
      return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
    };
    const start = Date.now() + hoursAhead * 3600 * 1000;
    const a = fmt(start);
    const b = fmt(start + durationHours * 3600 * 1000);
    return { date: a.date, startTime: a.time, endTime: b.time };
  };
  router.post('/user', async (req, res) => {
    const user = await createUser(models, req.body);
    res.json({ id: user._id, email: user.email, name: user.name });
  });
  router.post('/job', async (req, res) => {
    const employer = await models.User.findById(req.body.employerId);
    const job = await createApprovedJob(models, employer, req.body.extra || {});
    res.json({ id: job._id, title: job.title });
  });
  router.post('/employment', async (req, res) => {
    const { employerId, employeeId, jobId } = req.body;
    const employment = await models.Employment.create({
      employerUserId: employerId, employeeUserId: employeeId, jobId, status: 'active', positionTitle: 'Pha chế',
    });
    res.json({ id: employment._id });
  });
  router.post('/shift', async (req, res) => {
    const { employerId, studentId, studentName, hoursAhead = 24, extra = {} } = req.body;
    const slot = vnSlot(hoursAhead);
    const shift = await models.Shift.create({
      employerUserId: employerId, studentUserId: studentId, studentName, storeName: 'Quán E2E', ...slot,
      scheduleStatus: 'published', assignmentStatus: 'accepted', wageRate: 30000, ...extra,
    });
    res.json({ id: shift._id, ...slot });
  });
  app.use('/__e2e', router);
}

export async function createUser(models, { role, name, email, extra = {} }) {
  counter += 1;
  const user = await models.User.create({
    name: name || `${role}-${counter}`,
    email: email || `${role}${counter}-${Date.now()}@e2e.test`,
    password: PASSWORD,
    phone: `09000${String(counter).padStart(5, '0')}`,
    role,
    status: 'active',
    ...extra,
  });
  if (role === 'student') {
    await models.StudentProfile.create({ userId: user._id, profileType: 'student', verified: true, verificationStatus: 'approved' });
  }
  if (role === 'employer') {
    await models.EmployerProfile.create({
      userId: user._id, storeName: `Quán ${user.name}`, address: 'Hòa Lạc, Thạch Thất, Hà Nội', verified: true,
      location: { lat: 21.0135, lng: 105.5252 },
    });
  }
  return user;
}

export async function createApprovedJob(models, employer, extra = {}) {
  return models.Job.create({
    employerUserId: employer._id,
    storeName: `Quán ${employer.name}`,
    title: 'Nhân viên pha chế',
    category: 'cafe',
    salaryAmount: 30000,
    salaryUnit: 'hour',
    address: 'Hòa Lạc, Thạch Thất, Hà Nội',
    location: { lat: 21.0135, lng: 105.5252 },
    locationStatus: 'confirmed',
    headcountTarget: 2,
    remainingOpenings: 2,
    slots: 2,
    status: 'approved',
    recruitmentStatus: 'open',
    ...extra,
  });
}

export function api(baseUrl) {
  async function call(path, { method = 'GET', token, body, cookie } = {}) {
    const res = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, body: data, headers: res.headers };
  }
  async function login(email) {
    const res = await call('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    return { token: res.body.token, user: res.body.user, setCookie: res.headers.getSetCookie() };
  }
  return { call, login };
}

// Chạy độc lập (Playwright webServer): seed dữ liệu mẫu và giữ tiến trình sống
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('testServer.mjs')) {
  const port = Number(process.env.E2E_SERVER_PORT) || 5055;
  const t = await startTestServer({ port });
  const admin = await createUser(t.models, { role: 'admin', name: 'Admin E2E', email: 'admin@e2e.test' });
  const employer = await createUser(t.models, { role: 'employer', name: 'Chủ Quán E2E', email: 'employer@e2e.test' });
  await createUser(t.models, { role: 'student', name: 'Sinh Viên E2E', email: 'student@e2e.test' });
  await createUser(t.models, { role: 'student', name: 'Sinh Viên Hai', email: 'student2@e2e.test' });
  await createApprovedJob(t.models, employer);
  await mountSeedRoutes(t);
  console.log(`[e2e] server ready on ${t.url} (admin id ${admin._id})`);
  const shutdown = async () => { await t.stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

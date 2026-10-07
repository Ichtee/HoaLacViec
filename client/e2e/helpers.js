const API = 'http://127.0.0.1:5055';
export const PASSWORD = 'Passw0rd!';

let counter = 0;
const unique = (prefix) => `${prefix}-${Date.now().toString(36)}-${++counter}`;

async function seed(path, body) {
  const res = await fetch(`${API}/__e2e/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`seed ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export const seedUser = (role, name, extra) => seed('user', { role, name: name || unique(role), email: `${unique(role)}@e2e.test`, extra });
export const seedJob = (employerId, extra) => seed('job', { employerId, extra });
export const seedEmployment = (employerId, employeeId, jobId) => seed('employment', { employerId, employeeId, jobId });
export const seedShift = (body) => seed('shift', body);

/** Gọi API trực tiếp (dùng để chuẩn bị hoặc kiểm tra trạng thái phía máy chủ). */
export async function apiCall(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, body: data };
}

export async function apiLogin(email) {
  const res = await apiCall('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  if (res.status !== 200) throw new Error(`login ${email} -> ${res.status}`);
  return res.body;
}

/** Đăng nhập nhanh: nạp phiên vào trình duyệt (bỏ qua form) để spec tập trung vào luồng cần kiểm thử. */
export async function signIn(page, email) {
  const { token, user } = await apiLogin(email);
  const session = JSON.stringify({ user, profileId: user.profileId || null });
  await page.addInitScript(([t, s]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('hlv_auth_session', s);
    sessionStorage.setItem('hlv_auth_session', s);
  }, [token, session]);
  return { token, user };
}

/** Thời điểm cách hiện tại `hoursAhead` giờ theo giờ Việt Nam (UTC+7). */
export function vnSlot(hoursAhead, durationHours = 4) {
  const fmt = (ms) => {
    const iso = new Date(ms + 7 * 3600 * 1000).toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  };
  const start = Date.now() + hoursAhead * 3600 * 1000;
  const a = fmt(start);
  const b = fmt(start + durationHours * 3600 * 1000);
  return { date: a.date, startTime: a.time, endTime: b.time };
}

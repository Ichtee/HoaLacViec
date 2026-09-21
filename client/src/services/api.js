/**
 * Real API client connecting to Express.js + MongoDB backend
 * Base URL is /api (proxied to http://localhost:5000 by Vite)
 */

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || data?.message || `Yêu cầu thất bại (Mã lỗi: ${res.status})`);
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('NetworkError'))) {
      throw new Error('Không thể kết nối máy chủ. Máy chủ có thể đang khởi động lại (mất ~30s), vui lòng thử lại sau giây lát.');
    }
    throw err;
  }
}

// ─── AUTH ─────────────────────────────────────────────────────────
export async function apiLogin(email, password) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: normalizedEmail, password }),
  });
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data.user;
}

export async function apiRegister(userData) {
  const normalizedEmail = (userData.email || '').trim().toLowerCase();
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      ...userData,
      email: normalizedEmail,
    }),
  });
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data.user;
}

export async function apiGetMe() {
  return request('/auth/me');
}

// ─── JOBS ─────────────────────────────────────────────────────────
export async function apiGetJobs(params = {}) {
  const query = new URLSearchParams(params).toString();
  const data = await request(`/jobs${query ? `?${query}` : ''}`);
  return data.jobs || data;
}

export async function apiGetJob(id, studentId) {
  const query = studentId ? `?studentId=${studentId}` : '';
  return request(`/jobs/${id}${query}`);
}

export async function apiCreateJob(jobData) {
  return request('/jobs', {
    method: 'POST',
    body: JSON.stringify(jobData),
  });
}

export async function apiResolveMapLink(input) {
  return request('/jobs/resolve-map-link', {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export async function apiSearchPlaces(query, center) {
  return request('/jobs/search-places', {
    method: 'POST',
    body: JSON.stringify({ query, center }),
  });
}

export async function apiUpdateJob(id, jobData) {
  return request(`/jobs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(jobData),
  });
}

export async function apiDeleteJob(id) {
  return request(`/jobs/${id}`, {
    method: 'DELETE',
  });
}

// ─── APPLICATIONS ─────────────────────────────────────────────────
export async function apiApply(studentId, jobId, note, candidateData = {}) {
  const session = JSON.parse(sessionStorage.getItem('hlv_auth_session') || localStorage.getItem('hlv_auth_session') || '{}');
  const user = session.user || {};
  return request('/applications', {
    method: 'POST',
    body: JSON.stringify({
      studentId,
      studentName: candidateData.name || user.name || 'Sinh viên',
      studentPhone: candidateData.phone || user.phone || '',
      studentEmail: candidateData.email || user.email || '',
      jobId,
      note,
    }),
  });
}

export async function apiGetApplications(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/applications${query ? `?${query}` : ''}`);
}

export async function apiUpdateApplication(id, updates) {
  return request(`/applications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function apiWithdrawApplication(id) {
  return request(`/applications/${id}/withdraw`, {
    method: 'PUT',
  });
}

// ─── SHIFTS ───────────────────────────────────────────────────────
export async function apiGetShifts(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/shifts${query ? `?${query}` : ''}`);
}

export async function apiCreateShift(shiftData) {
  return request('/shifts', {
    method: 'POST',
    body: JSON.stringify(shiftData),
  });
}

export async function apiCheckIn(shiftId, coords = {}) {
  return request(`/shifts/${shiftId}/checkin`, {
    method: 'POST',
    body: JSON.stringify(coords),
  });
}

export async function apiCheckOut(shiftId, coords = {}) {
  return request(`/shifts/${shiftId}/checkout`, {
    method: 'POST',
    body: JSON.stringify(coords),
  });
}

export async function apiApproveAttendance(shiftId) {
  return request(`/shifts/${shiftId}/approve`, { method: 'POST' });
}

export async function apiDisputeShift(shiftId, reason) {
  return request(`/shifts/${shiftId}/dispute`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ─── MICRO-TASKS (VIỆC VẶT SINH VIÊN) ─────────────────────────────
export async function apiGetTasks(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/tasks${query ? `?${query}` : ''}`);
}

export async function apiGetTask(id) {
  return request(`/tasks/${id}`);
}

export async function apiCreateTask(taskData) {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData),
  });
}

export async function apiAcceptTask(id, payload) {
  return request(`/tasks/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiCompleteTask(id) {
  return request(`/tasks/${id}/complete`, { method: 'POST' });
}

export async function apiDeleteTask(id) {
  return request(`/tasks/${id}`, { method: 'DELETE' });
}

// ─── BLOGS ────────────────────────────────────────────────────────
export async function apiGetBlogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/blogs${query ? `?${query}` : ''}`);
}

export async function apiGetBlog(idOrSlug) {
  return request(`/blogs/${idOrSlug}`);
}

export async function apiCreateBlog(blogData) {
  return request('/blogs', {
    method: 'POST',
    body: JSON.stringify(blogData),
  });
}

// ─── PROFILES & AVAILABILITY ──────────────────────────────────────
export async function apiGetStudentProfile(userId) {
  return request(`/profiles/student/${userId}`);
}

export async function apiUpdateStudentProfile(userId, data) {
  return request(`/profiles/student/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiGetAvailability(userId) {
  return request(`/profiles/availability/${userId}`);
}

export async function apiUpsertAvailability(userId, slots) {
  return request(`/profiles/availability/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(slots),
  });
}

export async function apiGetEmployerProfile(userId) {
  return request(`/profiles/employer/${userId}`);
}

export async function apiUpdateEmployerProfile(userId, data) {
  return request(`/profiles/employer/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── ADMIN ────────────────────────────────────────────────────────
export async function apiAdminGetStats() {
  return request('/admin/stats');
}

export async function apiGetAllUsers() {
  return request('/admin/users');
}

export async function apiAdminUpdateUserStatus(userId, status) {
  return request(`/admin/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function apiAdminGetJobs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/admin/jobs${query ? `?${query}` : ''}`);
}

export async function apiApproveJob(id) {
  return request(`/admin/jobs/${id}/approve`, {
    method: 'POST',
  });
}

export async function apiRejectJob(id, reason) {
  return request(`/admin/jobs/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function apiAdminUpdateJob(id, data) {
  return request(`/admin/jobs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiGetVerificationRequests(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/admin/verifications${query ? `?${query}` : ''}`);
}

export async function apiApproveVerification(id) {
  return request(`/admin/verifications/${id}/approve`, {
    method: 'POST',
  });
}

export async function apiRejectVerification(id, reason) {
  return request(`/admin/verifications/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function apiGetEmployerVerification() {
  return request('/profiles/employer-verification/me');
}

export async function apiSubmitEmployerVerification(verificationData) {
  return request('/profiles/employer-verification/submit', {
    method: 'POST',
    body: JSON.stringify(verificationData),
  });
}

// ─── REVIEWS ──────────────────────────────────────────────────────
export async function apiGetReviews(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/reviews${query ? `?${query}` : ''}`);
}

export async function apiCreateReview(reviewData) {
  return request('/reviews', {
    method: 'POST',
    body: JSON.stringify(reviewData),
  });
}

// ─── SAVED JOBS ───────────────────────────────────────────────────
export async function apiGetSavedJobs() {
  return request('/saved-jobs');
}

export async function apiGetSavedJobIds() {
  return request('/saved-jobs/ids');
}

export async function apiSaveJob(jobId) {
  return request(`/saved-jobs/${jobId}`, { method: 'POST' });
}

export async function apiUnsaveJob(jobId) {
  return request(`/saved-jobs/${jobId}`, { method: 'DELETE' });
}

export async function apiToggleSaveJob(jobId, isCurrentlySaved) {
  if (isCurrentlySaved) {
    return apiUnsaveJob(jobId);
  }
  return apiSaveJob(jobId);
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────
export async function apiGetNotifications(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/notifications${query ? `?${query}` : ''}`);
}

export async function apiGetUnreadNotificationCount() {
  return request('/notifications/unread-count');
}

export async function apiMarkNotificationRead(id) {
  return request(`/notifications/${id}/read`, { method: 'PUT' });
}

export async function apiMarkAllNotificationsRead() {
  return request('/notifications/read-all', { method: 'PUT' });
}

export async function apiDeleteNotification(id) {
  return request(`/notifications/${id}`, { method: 'DELETE' });
}

// ─── REPORTS ──────────────────────────────────────────────────────
export async function apiGetReports(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/reports${query ? `?${query}` : ''}`);
}

export async function apiCreateReport(reportData) {
  return request('/reports', {
    method: 'POST',
    body: JSON.stringify(reportData),
  });
}

export async function apiResolveReport(id, resolutionData) {
  return request(`/reports/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(resolutionData),
  });
}


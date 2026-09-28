/**
 * Real API client connecting to Express.js + MongoDB backend
 * Base URL is /api (proxied to http://localhost:5000 by Vite)
 */

const rawApiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`)
  : '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      value !== 'undefined' &&
      value !== 'null'
    ) {
      searchParams.set(key, String(value));
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
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

export async function apiGoogleLogin(credential) {
  const data = await request('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
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

export async function apiUpdateUserProfile(userData) {
  return request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(userData),
  });
}

export async function apiChangePassword(passwordData) {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(passwordData),
  });
}

// ─── JOBS ─────────────────────────────────────────────────────────
export async function apiGetJobs(params = {}) {
  const data = await request(`/jobs${buildQueryString(params)}`);
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

export async function apiGeocodeAddress(address) {
  return request('/jobs/geocode', {
    method: 'POST',
    body: JSON.stringify({ address }),
  });
}

export async function apiGetEmployerMyJobs(params = {}) {
  return request(`/jobs/employer/my-jobs${buildQueryString(params)}`);
}

export async function apiSubmitJobForReview(id) {
  return request(`/jobs/${id}/submit`, { method: 'POST' });
}

export async function apiPauseJob(id) {
  return request(`/jobs/${id}/pause`, { method: 'POST' });
}

export async function apiCloseJob(id) {
  return request(`/jobs/${id}/close`, { method: 'POST' });
}

export async function apiReopenJob(id) {
  return request(`/jobs/${id}/reopen`, { method: 'POST' });
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
      selectedPosition: candidateData.selectedPosition || '',
      selectedShift: candidateData.selectedShift || '',
    }),
  });
}

export async function apiGetApplications(params = {}) {
  return request(`/applications${buildQueryString(params)}`);
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

export async function apiSendOffer(applicationId, offerData) {
  return request(`/applications/${applicationId}/offer`, {
    method: 'POST',
    body: JSON.stringify(offerData),
  });
}

export async function apiRescindOffer(applicationId, reason = '') {
  return request(`/applications/${applicationId}/rescind-offer`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function apiAcceptOffer(applicationId, responseNote = '') {
  return request(`/applications/${applicationId}/accept-offer`, {
    method: 'POST',
    body: JSON.stringify({ responseNote }),
  });
}

export async function apiDeclineOffer(applicationId, reason = '') {
  return request(`/applications/${applicationId}/decline-offer`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ─── EMPLOYMENTS ──────────────────────────────────────────────────
export async function apiGetEmployments(params = {}) {
  return request(`/employments${buildQueryString(params)}`);
}

export async function apiGetEmployment(id) {
  return request(`/employments/${id}`);
}

export async function apiUpdateEmployment(id, data) {
  return request(`/employments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiTerminateEmployment(id, terminationData = {}) {
  return request(`/employments/${id}/terminate`, {
    method: 'POST',
    body: JSON.stringify(terminationData),
  });
}

// ─── SHIFT TEMPLATES ──────────────────────────────────────────────
export async function apiGetShiftTemplates(params = {}) {
  return request(`/shift-templates${buildQueryString(params)}`);
}

export async function apiCreateShiftTemplate(data) {
  return request('/shift-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateShiftTemplate(id, data) {
  return request(`/shift-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiDeleteShiftTemplate(id) {
  return request(`/shift-templates/${id}`, {
    method: 'DELETE',
  });
}

// ─── TIME OFF REQUESTS ────────────────────────────────────────────
export async function apiGetTimeOff(params = {}) {
  return request(`/time-off${buildQueryString(params)}`);
}

export async function apiSubmitTimeOff(data) {
  return request('/time-off', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateTimeOffStatus(id, data) {
  return request(`/time-off/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── SHIFTS ───────────────────────────────────────────────────────
export async function apiGetShifts(params = {}) {
  return request(`/shifts${buildQueryString(params)}`);
}

export async function apiCreateShift(shiftData) {
  return request('/shifts', {
    method: 'POST',
    body: JSON.stringify(shiftData),
  });
}

export async function apiPublishShifts(shiftIds) {
  return request('/shifts/publish', {
    method: 'POST',
    body: JSON.stringify({ shiftIds }),
  });
}

export async function apiAcknowledgeShift(shiftId) {
  return request(`/shifts/${shiftId}/acknowledge`, { method: 'POST' });
}

export async function apiRescheduleShift(shiftId, scheduleData) {
  return request(`/shifts/${shiftId}/reschedule`, {
    method: 'PUT',
    body: JSON.stringify(scheduleData),
  });
}

export async function apiMarkPayrollReady(shiftId) {
  return request(`/shifts/${shiftId}/payroll-ready`, { method: 'POST' });
}

export async function apiMarkPaid(shiftId) {
  return request(`/shifts/${shiftId}/pay`, { method: 'POST' });
}

export async function apiAdjustShiftTime(shiftId, data) {
  return request(`/shifts/${shiftId}/adjust`, {
    method: 'PUT',
    body: JSON.stringify(data),
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

export async function apiDeleteShift(shiftId) {
  return request(`/shifts/${shiftId}`, { method: 'DELETE' });
}

export async function apiCancelShift(shiftId, reason = '') {
  return request(`/shifts/${shiftId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ─── MICRO-TASKS (VIỆC VẶT SINH VIÊN) ─────────────────────────────
export async function apiGetTasks(params = {}) {
  return request(`/tasks${buildQueryString(params)}`);
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

export async function apiAcceptTask(id, payload = {}) {
  return request(`/tasks/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiSubmitTaskCompletion(id, payload = {}) {
  return request(`/tasks/${id}/submit-completion`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiCompleteTask(id) {
  return request(`/tasks/${id}/complete`, { method: 'POST' });
}

export async function apiDisputeTask(id, payload = {}) {
  return request(`/tasks/${id}/dispute`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiCancelTask(id, payload = {}) {
  return request(`/tasks/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteTask(id) {
  return request(`/tasks/${id}`, { method: 'DELETE' });
}

// ─── BLOGS ────────────────────────────────────────────────────────
export async function apiGetBlogs(params = {}) {
  return request(`/blogs${buildQueryString(params)}`);
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

export async function apiUpdateBlog(id, blogData) {
  return request(`/blogs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(blogData),
  });
}

export async function apiDeleteBlog(id) {
  return request(`/blogs/${id}`, {
    method: 'DELETE',
  });
}

// ─── PROFILES & AVAILABILITY ──────────────────────────────────────
export async function apiGetStudentProfile(userId) {
  return request(`/profiles/student/${userId}`);
}

export async function apiSubmitStudentVerification(data) {
  return request('/profiles/student-verification/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiGetStudentVerification() {
  return request('/profiles/student-verification/me');
}

export async function apiSubmitWorkerVerification(data) {
  return request('/profiles/worker-verification/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiGetWorkerVerification() {
  return request('/profiles/worker-verification/me');
}

export async function apiGetUniversities() {
  try {
    return await request('/universities');
  } catch (err) {
    // Direct Hipolabs fetch fallback
    try {
      const res = await fetch('http://universities.hipolabs.com/search?country=Vietnam');
      if (res.ok) {
        const data = await res.json();
        return data.map((u) => ({
          name: u.name,
          domain: u.domains?.[0] || '',
        }));
      }
    } catch {
      // Ignore and use static fallback below
    }

    return [
      { name: 'Đại học FPT Hòa Lạc (FPT University)', domain: 'fpt.edu.vn' },
      { name: 'Đại học Quốc gia Hà Nội - Hòa Lạc (VNU Hanoi)', domain: 'vnu.edu.vn' },
      { name: 'ĐH Công nghệ - ĐHQGHN (VNU-UET)', domain: 'uet.vnu.edu.vn' },
      { name: 'Đại học Bách Khoa Hà Nội (HUST)', domain: 'hust.edu.vn' },
      { name: 'Hanoi University (Đại học Hà Nội)', domain: 'hanu.edu.vn' },
      { name: 'Duy Tan University (Đại học Duy Tân)', domain: 'duytan.edu.vn' },
      { name: 'Ton Duc Thang University (Đại học Tôn Đức Thắng)', domain: 'tdtu.edu.vn' },
      { name: 'Foreign Trade University (Đại học Ngoại Thương)', domain: 'ftu.edu.vn' },
    ];
  }
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

export async function apiAdminUpdateUserRole(userId, role) {
  return request(`/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

export async function apiAdminGetJobs(params = {}) {
  return request(`/admin/jobs${buildQueryString(params)}`);
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
  return request(`/admin/verifications${buildQueryString(params)}`);
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
  return request(`/reviews${buildQueryString(params)}`);
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

export async function apiToggleSaveJob(jobId) {
  return request(`/saved-jobs/toggle/${jobId}`, { method: 'POST' });
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────
export async function apiGetNotifications(params = {}) {
  return request(`/notifications${buildQueryString(params)}`);
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
  return request(`/reports${buildQueryString(params)}`);
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

// ─── VIETMAP MAP SERVICES ──────────────────────────────────────────
// All map endpoints require JWT authentication (sent via getAuthHeaders()).

/**
 * Autocomplete v4: Type-ahead address suggestions.
 * Returns { success, items: [{ refId, name, display, distanceKm, boundaries, legacyAddress, currentAddress }] }
 */
export async function apiVietmapAutocomplete(text, focus, signal) {
  const params = new URLSearchParams();
  if (text) params.set('text', text);
  // focus = "lat,lng" string — split to focusLat/focusLng per backend spec
  if (focus && typeof focus === 'string') {
    const parts = focus.split(',');
    if (parts.length === 2) {
      params.set('focusLat', parts[0].trim());
      params.set('focusLng', parts[1].trim());
    }
  }
  return request(`/maps/autocomplete?${params.toString()}`, { signal });
}

/**
 * Search v4: Forward geocoding for full address strings (non-interactive).
 * Returns { success, items: [...] }
 */
export async function apiVietmapSearch(text, focus, signal) {
  const params = new URLSearchParams();
  if (text) params.set('text', text);
  if (focus && typeof focus === 'string') {
    const parts = focus.split(',');
    if (parts.length === 2) {
      params.set('focusLat', parts[0].trim());
      params.set('focusLng', parts[1].trim());
    }
  }
  return request(`/maps/search?${params.toString()}`, { signal });
}

/**
 * Place v4: Resolves refId → { provider, display, addressLine, lat, lng, addressComponents }.
 * Call ONLY when user selects a suggestion — not on every keystroke.
 */
export async function apiVietmapPlace(refId, signal) {
  const params = new URLSearchParams();
  if (refId) params.set('refid', refId);
  return request(`/maps/place?${params.toString()}`, { signal });
}

/**
 * Reverse v4: Coordinates → address.
 * Returns { success, provider, refId, display, addressLine, lat, lng, addressComponents }
 */
export async function apiVietmapReverse(lat, lng, signal) {
  const params = new URLSearchParams();
  params.set('lat', String(lat));
  params.set('lng', String(lng));
  return request(`/maps/reverse?${params.toString()}`, { signal });
}

/**
 * Route v4: Calculate road route between 2+ points.
 * vehicle: 'motorcycle' | 'car' (only these two in current phase)
 * Returns { success, provider, distanceMeters, durationMilliseconds, bbox, coordinates, instructions }
 */
export async function apiVietmapRoute({ origin, destination, points, vehicle = 'motorcycle' } = {}, signal) {
  return request('/maps/route', {
    method: 'POST',
    body: JSON.stringify({ origin, destination, points, vehicle }),
    signal,
  });
}

/**
 * Matrix v4: one origin -> many destinations.
 * Returns { success, provider, vehicle, entries: [{ id, distanceMeters, durationSeconds }] }.
 */
export async function apiVietmapMatrix({ origin, destinations, vehicle = 'motorcycle' } = {}, signal) {
  return request('/maps/matrix', {
    method: 'POST',
    body: JSON.stringify({ origin, destinations, vehicle }),
    signal,
  });
}


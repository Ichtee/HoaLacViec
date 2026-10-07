import { Shift } from '../models/Shift.js';
import { StudentProfile } from '../models/StudentProfile.js';

const ON_TIME_GRACE_MS = 10 * 60 * 1000;

/**
 * Tóm tắt hồ sơ làm việc từ dữ liệu ca (thay thế CV cho việc làm thêm).
 * Hàm thuần để dễ kiểm thử: nhận danh sách ca đã lean.
 */
export function summarizeWorkHistory(shifts = [], reputation = {}) {
  let completedShifts = 0;
  let noShows = 0;
  let workedMinutes = 0;
  let onTimeEligible = 0;
  let onTime = 0;
  const stores = new Set();
  const byRole = new Map();

  for (const shift of shifts) {
    if (shift.attendanceStatus === 'no_show') {
      noShows++;
      continue;
    }
    if (shift.attendanceStatus !== 'approved') continue;

    completedShifts++;
    workedMinutes += Number(shift.workedMinutes) || 0;
    const storeKey = String(shift.employerUserId || shift.storeName || '');
    if (storeKey) stores.add(storeKey);
    const role = shift.positionTitle || shift.role;
    if (role) byRole.set(role, (byRole.get(role) || 0) + 1);

    const checkInAt = shift.attendance?.checkInAt;
    if (checkInAt && shift.startAt) {
      onTimeEligible++;
      if (new Date(checkInAt).getTime() <= new Date(shift.startAt).getTime() + ON_TIME_GRACE_MS) onTime++;
    }
  }

  const attended = completedShifts + noShows;
  return {
    completedShifts,
    noShows,
    totalHours: Math.round((workedMinutes / 60) * 10) / 10,
    storesWorkedAt: stores.size,
    onTimeRate: onTimeEligible ? Math.round((onTime / onTimeEligible) * 100) : null,
    attendanceRate: attended ? Math.round((completedShifts / attended) * 100) : null,
    topRoles: [...byRole.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([title, count]) => ({ title, count })),
    reputationScore: reputation.reputationScore ?? null,
    reputationCount: reputation.reputationCount ?? 0,
  };
}

export async function getWorkHistory(userId) {
  const [shifts, profile] = await Promise.all([
    Shift.find({ studentUserId: userId })
      .select('attendanceStatus workedMinutes employerUserId storeName positionTitle role startAt attendance.checkInAt')
      .lean(),
    StudentProfile.findOne({ userId }).select('reputationScore reputationCount').lean(),
  ]);
  return summarizeWorkHistory(shifts, profile || {});
}

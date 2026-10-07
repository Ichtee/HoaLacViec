// Phân loại trạng thái đơn ứng tuyển / ca làm theo trạng thái chuẩn của máy chủ.
// Giá trị cũ (pending, reviewing, approved, accepted) vẫn được nhận để dữ liệu chưa gom không bị bỏ sót.

const APP_AWAITING = ['submitted', 'screening', 'shortlisted', 'interview', 'pending', 'reviewing'];
const APP_NEEDS_REPLY = ['offer_sent'];
const APP_HIRED = ['offer_accepted', 'hired', 'approved', 'accepted'];
const APP_ENDED = ['rejected', 'withdrawn', 'offer_declined', 'offer_expired', 'offer_rescinded'];

/** Đơn đang chờ nhà tuyển dụng xử lý (chưa có offer). */
export const isApplicationAwaiting = (status) => !status || APP_AWAITING.includes(status);
export const isApplicationOfferPending = (status) => APP_NEEDS_REPLY.includes(status);
export const isApplicationHired = (status) => APP_HIRED.includes(status);
export const isApplicationEnded = (status) => APP_ENDED.includes(status);

/** Ca còn hiệu lực và chưa kết thúc (sắp tới hoặc đang làm). */
export function isShiftUpcoming(shift, todayStr) {
  const cancelled = shift.scheduleStatus === 'cancelled' || shift.status === 'cancelled';
  if (cancelled || shift.scheduleStatus === 'draft') return false;
  if (shift.attendanceStatus === 'checked_in') return true;
  const notStarted = !shift.attendanceStatus || shift.attendanceStatus === 'not_started' || shift.status === 'scheduled';
  return notStarted && (shift.date || '') >= todayStr;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** "2026-10-08" -> "T5, 08/10". Trả nguyên giá trị nếu không đọc được. */
export function formatShortDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return dateStr || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${WEEKDAYS[d.getDay()]}, ${m[3]}/${m[2]}`;
}

/** Ngày hôm nay dạng YYYY-MM-DD theo giờ máy người dùng. */
export function todayString(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Cộng/trừ ngày cho chuỗi YYYY-MM-DD (tính theo lịch địa phương, không lệch múi giờ). */
export function addDaysToDateString(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return todayString(new Date(y, m - 1, d + days));
}

/** Bảy ngày của tuần chứa dateStr, bắt đầu từ thứ Hai. */
export function weekDaysOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay(); // 0 = CN
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = addDaysToDateString(dateStr, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDaysToDateString(monday, i));
}

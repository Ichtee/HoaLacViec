// Job types
export const JOB_TYPES = {
  PART_TIME: 'part_time',
  SHIFT: 'shift',
  HOURLY: 'hourly',
  EVENT: 'event',
};

export const JOB_TYPE_LABELS = {
  [JOB_TYPES.SHIFT]: 'Theo ca linh hoạt',
  [JOB_TYPES.PART_TIME]: 'Part-time cố định',
  [JOB_TYPES.HOURLY]: 'Theo giờ',
  [JOB_TYPES.EVENT]: 'Sự kiện / Tiệc',
};

// Salary units
export const SALARY_UNITS = {
  HOUR: 'hour',
  SHIFT: 'shift',
  MONTH: 'month',
  EVENT: 'event',
};

export const SALARY_UNIT_LABELS = {
  [SALARY_UNITS.HOUR]: '/giờ',
  [SALARY_UNITS.SHIFT]: '/ca',
  [SALARY_UNITS.MONTH]: '/tháng',
  [SALARY_UNITS.EVENT]: '/sự kiện',
};

// Job status
export const JOB_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  CLOSED: 'closed',
  REJECTED: 'rejected',
};

export const JOB_STATUS_LABELS = {
  [JOB_STATUS.DRAFT]: 'Nháp',
  [JOB_STATUS.PENDING]: 'Chờ duyệt',
  [JOB_STATUS.APPROVED]: 'Đang tuyển',
  [JOB_STATUS.CLOSED]: 'Đã đóng',
  [JOB_STATUS.REJECTED]: 'Từ chối',
};

// Application status
export const APP_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
};

export const APP_STATUS_LABELS = {
  [APP_STATUS.PENDING]: 'Đang chờ',
  [APP_STATUS.ACCEPTED]: 'Được nhận',
  [APP_STATUS.REJECTED]: 'Không phù hợp',
  [APP_STATUS.WITHDRAWN]: 'Đã rút',
};

// Shift status
export const SHIFT_STATUS = {
  SCHEDULED: 'scheduled',
  CHECKED_IN: 'checked_in',
  COMPLETED: 'completed',
  ABSENT: 'absent',
  CANCELLED: 'cancelled',
};

export const SHIFT_STATUS_LABELS = {
  [SHIFT_STATUS.SCHEDULED]: 'Đã lên lịch',
  [SHIFT_STATUS.CHECKED_IN]: 'Đang làm',
  [SHIFT_STATUS.COMPLETED]: 'Hoàn thành',
  [SHIFT_STATUS.ABSENT]: 'Vắng mặt',
  [SHIFT_STATUS.CANCELLED]: 'Đã hủy',
};


// Swap request status
export const SWAP_STATUS = {
  OPEN: 'open',
  APPLIED: 'applied',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

export const SWAP_STATUS_LABELS = {
  [SWAP_STATUS.OPEN]: 'Đang tìm người',
  [SWAP_STATUS.APPLIED]: 'Có người đăng ký',
  [SWAP_STATUS.APPROVED]: 'Đã duyệt',
  [SWAP_STATUS.REJECTED]: 'Từ chối',
  [SWAP_STATUS.CANCELLED]: 'Đã hủy',
};

// User roles
export const ROLES = {
  STUDENT: 'student',
  EMPLOYER: 'employer',
  ADMIN: 'admin',
};

// Area zones in Hoa Lac
export const AREAS = [
  { value: 'tan_xa', label: 'Xã Tân Xã (Hồ Tân Xã / Phố trọ FPT)' },
  { value: 'ktx_dhqg', label: 'Ký túc xá ĐHQG Hòa Lạc' },
  { value: 'thach_hoa', label: 'Xã Thạch Hòa (Cổng 11 / KTX ĐHQG)' },
  { value: 'fpt_university', label: 'Khu CNC Hòa Lạc & ĐH FPT' },
  { value: 'binh_yen', label: 'Xã Bình Yên' },
  { value: 'ha_bang', label: 'Xã Hạ Bằng' },
  { value: 'thach_that', label: 'Trung tâm Huyện Thạch Thất' },
];

// Payroll rounding rule (document for consistency)
// Rounded to nearest 1000 VND per payroll period total
export const PAYROLL_ROUNDING = 1000;
export const CHECKIN_RADIUS_METERS = 200; // default check-in radius

export const DAYS_OF_WEEK = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
export const DAYS_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Canonical workforce scheduling lifecycles
export const SCHEDULE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
};

export const SCHEDULE_STATUS_LABELS = {
  [SCHEDULE_STATUS.DRAFT]: 'Lịch nháp',
  [SCHEDULE_STATUS.PUBLISHED]: 'Đã công bố',
  [SCHEDULE_STATUS.CANCELLED]: 'Đã hủy ca',
};

export const ASSIGNMENT_STATUS = {
  UNASSIGNED: 'unassigned',
  ASSIGNED: 'assigned',
  ACKNOWLEDGED: 'acknowledged',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
};

export const ASSIGNMENT_STATUS_LABELS = {
  [ASSIGNMENT_STATUS.UNASSIGNED]: 'Chưa phân công',
  [ASSIGNMENT_STATUS.ASSIGNED]: 'Đã phân ca',
  [ASSIGNMENT_STATUS.ACKNOWLEDGED]: 'Đã xem lịch',
  [ASSIGNMENT_STATUS.ACCEPTED]: 'Đã nhận ca',
  [ASSIGNMENT_STATUS.DECLINED]: 'Đã từ chối',
};

export const ATTENDANCE_STATUS = {
  NOT_STARTED: 'not_started',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  NEEDS_REVIEW: 'needs_review',
  COMPLETED_PENDING_REVIEW: 'completed_pending_review',
  APPROVED: 'approved',
  DISPUTED: 'disputed',
  NO_SHOW: 'no_show',
};

export const ATTENDANCE_STATUS_LABELS = {
  [ATTENDANCE_STATUS.NOT_STARTED]: 'Chưa vào ca',
  [ATTENDANCE_STATUS.CHECKED_IN]: 'Đang làm việc',
  [ATTENDANCE_STATUS.CHECKED_OUT]: 'Đã tan ca',
  [ATTENDANCE_STATUS.NEEDS_REVIEW]: 'Chờ xem xét GPS',
  [ATTENDANCE_STATUS.COMPLETED_PENDING_REVIEW]: 'Chờ duyệt công',
  [ATTENDANCE_STATUS.APPROVED]: 'Đã duyệt công',
  [ATTENDANCE_STATUS.DISPUTED]: 'Đang đối soát',
  [ATTENDANCE_STATUS.NO_SHOW]: 'Vắng mặt',
};

export const PAYROLL_STATUS = {
  NOT_READY: 'not_ready',
  READY: 'ready',
  PAID: 'paid',
};

export const PAYROLL_STATUS_LABELS = {
  [PAYROLL_STATUS.NOT_READY]: 'Chưa tính lương',
  [PAYROLL_STATUS.READY]: 'Sẵn sàng tính lương',
  [PAYROLL_STATUS.PAID]: 'Đã thanh toán',
};


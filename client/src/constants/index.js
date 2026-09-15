// Job types
export const JOB_TYPES = {
  PART_TIME: 'part_time',
  SHIFT: 'shift',
  HOURLY: 'hourly',
  EVENT: 'event',
  INTERNSHIP: 'internship',
};

export const JOB_TYPE_LABELS = {
  [JOB_TYPES.PART_TIME]: 'Bán thời gian',
  [JOB_TYPES.SHIFT]: 'Theo ca',
  [JOB_TYPES.HOURLY]: 'Theo giờ',
  [JOB_TYPES.EVENT]: 'Sự kiện',
  [JOB_TYPES.INTERNSHIP]: 'Thực tập',
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

// Attendance status
export const ATTENDANCE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DISPUTED: 'disputed',
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
  { value: 'ktx_dhqg', label: 'KTX ĐHQG' },
  { value: 'fpt_university', label: 'ĐH FPT Hòa Lạc' },
  { value: 'hust_campus', label: 'BKHN Hòa Lạc' },
  { value: 'green_park', label: 'Green Park Residences' },
  { value: 'thach_that', label: 'Trung tâm Thạch Thất' },
  { value: 'dai_mo', label: 'Khu vực Đại Mỗ' },
];

// Payroll rounding rule (document for consistency)
// Rounded to nearest 1000 VND per payroll period total
export const PAYROLL_ROUNDING = 1000;
export const CHECKIN_RADIUS_METERS = 200; // default check-in radius

export const DAYS_OF_WEEK = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
export const DAYS_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

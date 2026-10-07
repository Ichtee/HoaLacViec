import { clsx } from 'clsx';

export function Badge({ children, variant = 'green', className, ...props }) {
  const variantClass = {
    green: 'badge-green',
    success: 'badge-green',
    pink: 'badge-pink',
    yellow: 'badge-yellow',
    warning: 'badge-yellow',
    red: 'badge-red',
    danger: 'badge-red',
    gray: 'badge-gray',
    default: 'badge-green',
    outline: 'badge-green',
    blue: 'badge-blue',
    info: 'badge-blue',
  }[variant] || 'badge-green';

  return (
    <span className={clsx('badge', variantClass, className)} {...props}>
      {children}
    </span>
  );
}

// Status badges for common statuses
export function AppStatusBadge({ status }) {
  const map = {
    submitted: { variant: 'blue', label: 'Mới nộp' },
    screening: { variant: 'blue', label: 'Đang sàng lọc' },
    shortlisted: { variant: 'yellow', label: 'Vào danh sách' },
    interview: { variant: 'yellow', label: 'Phỏng vấn' },
    offer_sent: { variant: 'yellow', label: 'Đã gửi offer' },
    offer_accepted: { variant: 'green', label: 'Đã nhận offer' },
    hired: { variant: 'green', label: 'Đã tuyển' },
    rejected: { variant: 'red', label: 'Không phù hợp' },
    withdrawn: { variant: 'gray', label: 'Đã rút hồ sơ' },
    pending: { variant: 'yellow', label: 'Chờ duyệt' },
    accepted: { variant: 'green', label: 'Được nhận' },
  };
  const { variant = 'gray', label = status } = map[status] || {};
  return <Badge variant={variant}>{label}</Badge>;
}

export function ShiftStatusBadge({ status }) {
  const map = {
    draft: { variant: 'gray', label: 'Nháp' },
    published: { variant: 'blue', label: 'Đã công bố' },
    acknowledged: { variant: 'green', label: 'Đã xác nhận' },
    scheduled: { variant: 'blue', label: 'Đã lên lịch' },
    checked_in: { variant: 'green', label: 'Đang làm việc' },
    checked_out: { variant: 'yellow', label: 'Đã tan ca' },
    completed_pending_review: { variant: 'yellow', label: 'Chờ duyệt công' },
    pending_approval: { variant: 'yellow', label: 'Chờ duyệt công' },
    approved: { variant: 'green', label: 'Đã duyệt công' },
    payroll_ready: { variant: 'blue', label: 'Sẵn sàng trả lương' },
    paid: { variant: 'green', label: 'Đã trả lương' },
    completed: { variant: 'green', label: 'Hoàn thành' },
    absent: { variant: 'red', label: 'Vắng mặt' },
    no_show: { variant: 'red', label: 'Vắng mặt' },
    accepted: { variant: 'green', label: 'Đã nhận ca' },
    declined: { variant: 'red', label: 'Từ chối ca' },
    cancelled: { variant: 'gray', label: 'Đã hủy' },
    disputed: { variant: 'red', label: 'Khiếu nại / Đối soát' },
  };
  const { variant = 'gray', label = status } = map[status] || {};
  return <Badge variant={variant}>{label}</Badge>;
}

export function JobStatusBadge({ status }) {
  const map = {
    draft: { variant: 'gray', label: 'Nháp' },
    pending: { variant: 'yellow', label: 'Chờ duyệt' },
    approved: { variant: 'green', label: 'Đang tuyển' },
    active: { variant: 'green', label: 'Đang hoạt động' },
    filled: { variant: 'blue', label: 'Đã đủ người' },
    closed: { variant: 'gray', label: 'Đã đóng' },
    rejected: { variant: 'red', label: 'Từ chối' },
  };
  const { variant = 'gray', label = status } = map[status] || {};
  return <Badge variant={variant}>{label}</Badge>;
}

export function SwapStatusBadge({ status }) {
  const map = {
    open: { variant: 'blue', label: 'Đang tìm người' },
    applied: { variant: 'yellow', label: 'Có người đăng ký' },
    approved: { variant: 'green', label: 'Đã duyệt đổi' },
    rejected: { variant: 'red', label: 'Từ chối' },
    cancelled: { variant: 'gray', label: 'Đã hủy' },
  };
  const { variant = 'gray', label = status } = map[status] || {};
  return <Badge variant={variant}>{label}</Badge>;
}

export function VerifiedBadge({ className }) {
  return (
    <Badge variant="green" className={clsx('gap-1', className)}>
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
        <path d="M5 8.5L2.5 6 3.5 5 5 6.5 8.5 3 9.5 4 5 8.5Z" fill="currentColor" />
        <circle cx="6" cy="6" r="5.5" stroke="currentColor" fill="none" />
      </svg>
      Đã xác thực
    </Badge>
  );
}

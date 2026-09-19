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
    default: 'badge-gray',
    outline: 'badge-gray',
    blue: 'badge-blue',
    info: 'badge-blue',
  }[variant] || 'badge-gray';

  return (
    <span className={clsx('badge', variantClass, className)} {...props}>
      {children}
    </span>
  );
}

// Status badges for common statuses
export function AppStatusBadge({ status }) {
  const map = {
    pending: { variant: 'yellow', label: 'Đang chờ' },
    accepted: { variant: 'green', label: 'Được nhận' },
    rejected: { variant: 'red', label: 'Không phù hợp' },
    withdrawn: { variant: 'gray', label: 'Đã rút' },
  };
  const { variant = 'gray', label = status } = map[status] || {};
  return <Badge variant={variant}>{label}</Badge>;
}

export function ShiftStatusBadge({ status }) {
  const map = {
    scheduled: { variant: 'blue', label: 'Đã lên lịch' },
    checked_in: { variant: 'yellow', label: 'Đang làm' },
    completed: { variant: 'green', label: 'Hoàn thành' },
    absent: { variant: 'red', label: 'Vắng mặt' },
    cancelled: { variant: 'gray', label: 'Đã hủy' },
  };
  const { variant = 'gray', label = status } = map[status] || {};
  return <Badge variant={variant}>{label}</Badge>;
}

export function JobStatusBadge({ status }) {
  const map = {
    draft: { variant: 'gray', label: 'Nháp' },
    pending: { variant: 'yellow', label: 'Chờ duyệt' },
    approved: { variant: 'green', label: 'Đang tuyển' },
    closed: { variant: 'red', label: 'Đã đóng' },
    rejected: { variant: 'red', label: 'Từ chối' },
  };
  const { variant = 'gray', label = status } = map[status] || {};
  return <Badge variant={variant}>{label}</Badge>;
}

export function SwapStatusBadge({ status }) {
  const map = {
    open: { variant: 'blue', label: 'Đang tìm' },
    applied: { variant: 'yellow', label: 'Có người đăng ký' },
    approved: { variant: 'green', label: 'Đã duyệt' },
    rejected: { variant: 'red', label: 'Từ chối' },
    cancelled: { variant: 'gray', label: 'Đã hủy' },
  };
  const { variant = 'gray', label = status } = map[status] || {};
  return <Badge variant={variant}>{label}</Badge>;
}

export function VerifiedBadge() {
  return (
    <Badge variant="green" className="gap-1">
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
        <path d="M5 8.5L2.5 6 3.5 5 5 6.5 8.5 3 9.5 4 5 8.5Z" fill="currentColor" />
        <circle cx="6" cy="6" r="5.5" stroke="currentColor" fill="none" />
      </svg>
      Đã xác thực
    </Badge>
  );
}

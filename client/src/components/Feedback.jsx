import { clsx } from 'clsx';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS = {
  success: 'bg-white border-green-300 text-green-900',
  error: 'bg-white border-red-300 text-red-900',
  info: 'bg-white border-blue-300 text-blue-900',
  warning: 'bg-white border-amber-300 text-amber-900',
};

const ICON_COLORS = {
  success: 'text-green-600',
  error: 'text-red-600',
  info: 'text-blue-600',
  warning: 'text-amber-600',
};

export function Toast({ id, message, type, onRemove, onClose }) {
  const Icon = ICONS[type] || Info;
  const handleClose = () => {
    if (onClose) onClose();
    if (onRemove && id) onRemove(id);
  };
  return (
    <div
      className={clsx(
        'flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-sm animate-slide-up min-w-[280px] max-w-sm fixed bottom-5 right-5 z-[100] bg-white',
        COLORS[type]
      )}
      role="alert"
    >
      <Icon className={clsx('w-4 h-4 flex-shrink-0 mt-0.5', ICON_COLORS[type])} />
      <p className="text-xs font-medium text-text-main flex-1 leading-snug">{message}</p>
      <button
        onClick={handleClose}
        aria-label="Đóng thông báo"
        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast {...t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

// Loading state
export function Spinner({ size = 'md', className }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-8 h-8' };
  return (
    <div className={clsx('animate-spin rounded-full border-2 border-gray-200 border-t-green-main', sizes[size], className)} />
  );
}

export function LoadingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Spinner size="md" />
      <p className="text-text-muted text-xs font-medium">Đang tải dữ liệu...</p>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 gap-3 text-center border border-dashed border-gray-200 rounded-xl bg-white/60">
      {icon && <div className="text-gray-400 mb-1">{icon}</div>}
      <div>
        <p className="font-semibold text-text-main text-sm">{title}</p>
        {description && <p className="text-text-muted text-xs mt-1 max-w-sm">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function ErrorAlert({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 px-4 text-center border border-red-200 rounded-xl bg-red-50/40">
      <AlertCircle className="w-8 h-8 text-red-500" />
      <p className="text-red-700 text-xs font-medium max-w-md">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-outline btn btn-sm bg-white">
          Thử lại
        </button>
      )}
    </div>
  );
}

export function StatCard({ label, value, sub, icon }) {
  return (
    <div className="card flex items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text-main tracking-tight">{value}</p>
        {sub && <p className="text-[11px] text-text-light">{sub}</p>}
      </div>
      {icon && (
        <div className="text-gray-400 p-1 flex-shrink-0">
          {icon}
        </div>
      )}
    </div>
  );
}

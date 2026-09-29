import { clsx } from 'clsx';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS = {
  success: 'bg-green-50 border-green-200 text-green-dark',
  error: 'bg-red-50 border-red-200 text-red-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
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
        'flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-card animate-slide-up min-w-[280px] max-w-sm fixed bottom-6 right-6 z-[100]',
        COLORS[type]
      )}
      role="alert"
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={handleClose}
        aria-label="Đóng thông báo"
        className="p-0.5 rounded-lg hover:opacity-70 transition-opacity flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
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
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={clsx('animate-spin rounded-full border-2 border-green-light border-t-green-main', sizes[size], className)} />
  );
}

export function LoadingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <Spinner size="lg" />
      <p className="text-text-muted text-sm">Đang tải...</p>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      {icon && <div className="text-text-light text-4xl">{icon}</div>}
      <div>
        <p className="font-semibold text-text-main text-lg">{title}</p>
        {description && <p className="text-text-muted text-sm mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorAlert({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-red-600 font-medium">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-outline btn btn-sm">
          Thử lại
        </button>
      )}
    </div>
  );
}

export function StatCard({ label, value, sub, icon, color = 'green' }) {
  const colorMap = {
    green: 'bg-green-light text-green-dark',
    pink: 'bg-pink-light text-pink-700',
    blue: 'bg-blue-50 text-blue-700',
    yellow: 'bg-yellow-50 text-yellow-800',
  };
  return (
    <div className="card flex items-center gap-4">
      {icon && (
        <div className={clsx('p-3 rounded-2xl flex-shrink-0', colorMap[color])}>
          {icon}
        </div>
      )}
      <div>
        <p className="text-2xl font-bold text-text-main">{value}</p>
        <p className="text-sm font-medium text-text-muted">{label}</p>
        {sub && <p className="text-xs text-text-light mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

import { clsx } from 'clsx';

/**
 * Tiêu đề trang dùng chung cho mọi khu (sinh viên, nhà tuyển dụng, quản trị).
 * Icon luôn nằm trong ô xanh nhạt, không dùng emoji; hành động nằm bên phải (xuống dưới trên điện thoại).
 */
export function PageHeader({ icon: Icon, title, description, badge, actions, className }) {
  return (
    <div className={clsx('flex flex-col sm:flex-row sm:items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="w-11 h-11 rounded-2xl bg-green-50 text-green-dark flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-text-main leading-tight">{title}</h1>
            {badge}
          </div>
          {description && <p className="text-sm text-text-muted mt-1 max-w-2xl">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

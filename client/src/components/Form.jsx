import { clsx } from 'clsx';

export function Input({ label, error, hint, id, className, required, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        id={id}
        className={clsx('input', error && 'input-error', className)}
        {...props}
      />
      {hint && !error && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, hint, id, className, required, rows = 3, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        className={clsx('input resize-none', error && 'input-error', className)}
        {...props}
      />
      {hint && !error && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}

export function Select({ label, error, hint, id, className, required, children, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        id={id}
        className={clsx('input appearance-none cursor-pointer', error && 'input-error', className)}
        {...props}
      >
        {children}
      </select>
      {hint && !error && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}

export function Checkbox({ label, id, error, className, ...props }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        id={id}
        className={clsx('w-4 h-4 rounded accent-green-main cursor-pointer', className)}
        {...props}
      />
      {label && <span className="text-sm text-text-main">{label}</span>}
      {error && <p className="error-msg">{error}</p>}
    </label>
  );
}

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

export function Select({ label, error, hint, id, className, required, options, children, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          className={clsx('input appearance-none cursor-pointer pr-10 bg-white', error && 'input-error', className)}
          {...props}
        >
          {options
            ? options.map((opt) => {
                const val = typeof opt === 'object' ? opt.value : opt;
                const lab = typeof opt === 'object' ? opt.label : opt;
                return (
                  <option key={val} value={val}>
                    {lab}
                  </option>
                );
              })
            : children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
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

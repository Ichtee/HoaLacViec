import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  leftIcon,
  rightIcon,
  ...props
}) {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
    pink: 'btn-pink',
  }[variant] || 'btn-primary';

  const sizeClass = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
  }[size] || 'btn-md';

  return (
    <button
      disabled={disabled || loading}
      className={clsx(variantClass, sizeClass, className)}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

export function IconButton({ icon, label, variant = 'ghost', size = 'md', className, ...props }) {
  const sizeClass = { sm: 'p-1.5', md: 'p-2', lg: 'p-2.5' }[size] || 'p-2';
  const variantClass = {
    ghost: 'text-text-muted hover:bg-gray-100 hover:text-text-main rounded-lg border border-transparent',
    primary: 'text-white bg-green-main hover:bg-green-dark rounded-lg shadow-xs',
    danger: 'text-red-600 hover:bg-red-50 rounded-lg border border-transparent',
    outline: 'text-text-main border border-gray-200 hover:bg-gray-50 rounded-lg',
  }[variant] || 'text-text-muted hover:bg-gray-100 rounded-lg';

  return (
    <button
      aria-label={label}
      className={clsx('inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-main', sizeClass, variantClass, className)}
      {...props}
    >
      {icon}
    </button>
  );
}

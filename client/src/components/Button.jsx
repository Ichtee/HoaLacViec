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
  }[variant];

  const sizeClass = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
  }[size];

  return (
    <button
      disabled={disabled || loading}
      className={clsx(variantClass, sizeClass, className)}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

export function IconButton({ icon, label, variant = 'ghost', size = 'md', className, ...props }) {
  const sizeClass = { sm: 'p-1.5', md: 'p-2', lg: 'p-3' }[size];
  const variantClass = {
    ghost: 'text-text-muted hover:bg-green-50 hover:text-green-dark rounded-xl',
    primary: 'text-white bg-green-main hover:bg-green-dark rounded-xl',
    danger: 'text-red-500 hover:bg-red-50 rounded-xl',
  }[variant];

  return (
    <button
      aria-label={label}
      className={clsx('transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-main', sizeClass, variantClass, className)}
      {...props}
    >
      {icon}
    </button>
  );
}

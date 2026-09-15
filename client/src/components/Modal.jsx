import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

export function Modal({ isOpen, onClose, title, children, size = 'md', className }) {
  const overlayRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement;
    closeRef.current?.focus();
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={clsx(
          'w-full bg-white rounded-3xl shadow-modal animate-scale-in flex flex-col max-h-[90vh]',
          sizeClass,
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-green-50 flex-shrink-0">
          <h2 className="text-lg font-bold text-text-main">{title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 rounded-xl hover:bg-green-50 text-text-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Xác nhận', danger = false, loading = false }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-text-muted mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-ghost btn btn-md" disabled={loading}>
          Hủy
        </button>
        <button
          onClick={onConfirm}
          className={clsx('btn btn-md', danger ? 'btn-danger' : 'btn-primary')}
          disabled={loading}
        >
          {loading ? '...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { MoreHorizontal } from 'lucide-react';

/**
 * Menu "⋯" gom các hành động phụ để hành động chính nổi bật hơn.
 * items: [{ label, icon?, onClick?, href?, danger?, hidden? }]. Đóng khi bấm ra ngoài hoặc nhấn Esc.
 */
export function ActionMenu({ items, label = 'Thêm hành động', className }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const visible = items.filter((item) => !item.hidden);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-xl text-text-muted hover:text-green-dark hover:bg-green-50 border border-transparent hover:border-green-200 transition-colors"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 bottom-full mb-2 z-30 min-w-[11rem] bg-white rounded-2xl border border-green-100 shadow-modal py-1.5 animate-scale-in">
          {visible.map((item) => {
            const Icon = item.icon;
            const cls = clsx(
              'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors',
              item.danger ? 'text-red-700 hover:bg-red-50' : 'text-text-main hover:bg-green-50'
            );
            const content = (
              <>
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                {item.label}
              </>
            );
            return item.href ? (
              <a key={item.label} role="menuitem" href={item.href} target="_blank" rel="noreferrer" className={cls} onClick={() => setOpen(false)}>
                {content}
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={cls}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

/**
 * Tab cuộn ngang: không bao giờ làm tràn trang, không cắt chữ, mờ dần ở mép khi còn nội dung bị che,
 * và tự cuộn để tab đang chọn luôn nhìn thấy.
 * items: [{ id, label, count?, icon? }]. variant: 'underline' | 'pill'.
 */
export function Tabs({ items, value, onChange, variant = 'underline', className, ariaLabel }) {
  const scrollerRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, items.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    const active = el?.querySelector('[aria-selected="true"]');
    if (el && active) {
      const left = active.offsetLeft - 16;
      const right = active.offsetLeft + active.offsetWidth + 16;
      if (left < el.scrollLeft) el.scrollTo({ left, behavior: 'smooth' });
      else if (right > el.scrollLeft + el.clientWidth) el.scrollTo({ left: right - el.clientWidth, behavior: 'smooth' });
    }
  }, [value]);

  const mask = [
    edges.left ? 'transparent, #000 28px' : '#000, #000',
    edges.right ? '#000 calc(100% - 28px), transparent' : '#000, #000',
  ];
  const maskImage = `linear-gradient(to right, ${mask[0]}, ${mask[1]})`;

  return (
    <div
      className={clsx(variant === 'underline' && 'border-b border-green-100', className)}
    >
      <div
        ref={scrollerRef}
        onScroll={measure}
        role="tablist"
        aria-label={ariaLabel}
        className={clsx(
          'flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          variant === 'underline' ? 'gap-1' : 'gap-1.5 p-1.5 bg-green-50/70 rounded-2xl'
        )}
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        {items.map((item) => {
          const active = item.id === value;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.id)}
              className={clsx(
                'shrink-0 whitespace-nowrap flex items-center gap-2 text-sm font-semibold transition-colors',
                variant === 'underline'
                  ? clsx(
                      'px-4 py-3 border-b-2 -mb-px',
                      active ? 'border-green-main text-green-dark' : 'border-transparent text-text-muted hover:text-text-main'
                    )
                  : clsx(
                      'px-3.5 py-2 rounded-xl',
                      active ? 'bg-white text-green-dark shadow-sm' : 'text-text-muted hover:text-text-main hover:bg-white/60'
                    )
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {item.label}
              {item.count !== undefined && item.count !== null && (
                <span
                  className={clsx(
                    'min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] leading-none text-center',
                    active ? 'bg-green-main text-white' : 'bg-green-50 text-green-dark'
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

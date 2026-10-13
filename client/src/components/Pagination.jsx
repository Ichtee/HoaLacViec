import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

export const DEFAULT_PAGE_SIZE = 10;

/** Cắt một danh sách theo trang; tự đưa về trang cuối nếu danh sách ngắn lại (đổi bộ lọc, xóa mục). */
export function usePagination(items, pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  useEffect(() => { if (page !== current) setPage(current); }, [page, current]);
  return {
    page: current,
    setPage,
    totalPages,
    total: items.length,
    pageSize,
    pageItems: items.slice((current - 1) * pageSize, current * pageSize),
  };
}

// 1 … 4 5 [6] 7 8 … 20
function pageWindow(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['gap-' + p, p] : [p]));
}

/** Thanh phân trang: "Hiển thị 11–20 / 87" + nút trước/sau + số trang. Ẩn khi chỉ có một trang. */
export function Pagination({ page, totalPages, total, pageSize, onPageChange, className }) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn = 'min-w-9 h-9 px-2 inline-flex items-center justify-center rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <nav aria-label="Phân trang" className={clsx('flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-green-50', className)}>
      <p className="text-xs text-text-muted" aria-live="polite">Hiển thị {from}–{to} / {total}</p>
      <div className="flex items-center gap-1">
        <button type="button" className={clsx(btn, 'text-text-main hover:bg-green-50')} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Trang trước">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pageWindow(page, totalPages).map((p) => (typeof p === 'string'
          ? <span key={p} className="px-1 text-text-muted" aria-hidden="true">…</span>
          : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Trang ${p}`}
              className={clsx(btn, p === page ? 'bg-green-dark text-white' : 'text-text-main hover:bg-green-50')}
            >
              {p}
            </button>
          )))}
        <button type="button" className={clsx(btn, 'text-text-main hover:bg-green-50')} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Trang sau">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}

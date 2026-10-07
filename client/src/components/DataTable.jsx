import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'vi', { sensitivity: 'base' });
}

/**
 * Bảng dữ liệu: bảng thật từ màn hình vừa trở lên (tiêu đề dính, bấm tiêu đề để sắp xếp),
 * xếp thành thẻ có nhãn trên điện thoại.
 * columns: [{ key, label, sortValue?(row), render(row), className?, primary? }]
 */
export function DataTable({ columns, rows, rowKey, emptyState, caption, initialSort }) {
  const [sort, setSort] = useState(initialSort || null); // { key, dir }

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareValues(column.sortValue(a), column.sortValue(b)));
  }, [rows, columns, sort]);

  function toggleSort(column) {
    if (!column.sortValue) return;
    setSort((prev) => (prev?.key === column.key ? { key: column.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key: column.key, dir: 'asc' }));
  }

  if (rows.length === 0) return emptyState || null;

  return (
    <div className="bg-white rounded-3xl border border-green-100 shadow-card overflow-hidden">
      {/* Bảng: màn hình vừa trở lên */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-green-50/70 text-left">
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={clsx('px-4 py-3 text-xs font-bold uppercase tracking-wide text-text-muted whitespace-nowrap', column.className)}
                  >
                    {column.sortValue ? (
                      <button type="button" onClick={() => toggleSort(column)} className="inline-flex items-center gap-1 hover:text-green-dark">
                        {column.label}
                        {active ? (sort.dir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-green-50">
            {sortedRows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-green-50/40 transition-colors">
                {columns.map((column) => (
                  <td key={column.key} className={clsx('px-4 py-3 align-middle', column.className)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Thẻ: điện thoại */}
      <ul className="md:hidden divide-y divide-green-50">
        {sortedRows.map((row) => (
          <li key={rowKey(row)} className="p-4 space-y-2.5">
            {columns.map((column) => (
              <div key={column.key} className={clsx(column.primary ? '' : 'flex items-center justify-between gap-3')}>
                {!column.primary && <span className="text-xs font-semibold text-text-muted shrink-0">{column.label}</span>}
                <div className={clsx(!column.primary && 'text-right min-w-0')}>{column.render(row)}</div>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
